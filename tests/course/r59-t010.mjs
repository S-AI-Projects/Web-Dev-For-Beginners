import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');
const appDir = path.join(rootDir, '5-browser-extension', 'start', 'dist');
const workDir = path.join(rootDir, 'work', 'R59-T010');
const fixtureDir = path.join(workDir, 'fixture');

fs.mkdirSync(workDir, { recursive: true });
fs.mkdirSync(fixtureDir, { recursive: true });

// Create temporary test fixture with deliberate style mutation (breaks img display)
const origHtml = fs.readFileSync(path.join(appDir, 'index.html'), 'utf-8');
const mutatedHtml = origHtml.replace(
  '</head>',
  '  <style>/* Deliberate test mutation breaking img rule */ img { display: none !important; }</style>\n</head>'
);
fs.writeFileSync(path.join(fixtureDir, 'index.html'), mutatedHtml, 'utf-8');

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.html': return 'text/html; charset=UTF-8';
    case '.css': return 'text/css; charset=UTF-8';
    case '.js': return 'application/javascript; charset=UTF-8';
    case '.png': return 'image/png';
    case '.svg': return 'image/svg+xml';
    case '.json': return 'application/json';
    default: return 'application/octet-stream';
  }
}

async function startServer() {
  const server = http.createServer((req, res) => {
    const rawUrl = req.url?.split('?')[0] || '/';
    let baseDir = appDir;
    let relPath = rawUrl === '/' ? 'index.html' : rawUrl.replace(/^\//, '');

    // Route to temporary fixture
    if (relPath.startsWith('fixture/')) {
      baseDir = fixtureDir;
      relPath = relPath.replace(/^fixture\//, '');
      // Fallback for assets referenced in fixture
      if (!fs.existsSync(path.join(baseDir, relPath))) {
        baseDir = appDir;
      }
    }

    const safePath = path.normalize(decodeURIComponent(relPath)).replace(/^(\.\.[\/\\])+/, '');
    const fullPath = path.join(baseDir, safePath);

    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
      res.writeHead(200, { 'Content-Type': getContentType(fullPath) });
      fs.createReadStream(fullPath).pipe(res);
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 8080;
  return {
    server,
    url: `http://127.0.0.1:${port}/index.html`,
    mutatedUrl: `http://127.0.0.1:${port}/fixture/index.html`
  };
}

// Reusable assertion function to test img element visibility and rendering
async function assertImgControlVisible(page, targetName) {
  const imgLocator = page.locator('img');
  const count = await imgLocator.count();
  if (count === 0) {
    throw new assert.AssertionError({
      message: `[${targetName}] Source anchor img element not found in DOM`,
      actual: count,
      expected: 1
    });
  }

  const isVisible = await imgLocator.first().isVisible();
  const box = await imgLocator.first().boundingBox();
  const computedStyle = await page.evaluate(() => {
    const el = document.querySelector('img');
    if (!el) return null;
    const cs = window.getComputedStyle(el);
    return {
      display: cs.display,
      visibility: cs.visibility,
      naturalWidth: el.naturalWidth,
      naturalHeight: el.naturalHeight
    };
  });

  if (!isVisible || !box || box.width <= 0 || box.height <= 0 || computedStyle?.display === 'none' || computedStyle?.visibility === 'hidden') {
    throw new assert.AssertionError({
      message: `[${targetName}] UI regression detected: img element is not visible or has zero dimensions`,
      actual: { isVisible, box, computedStyle },
      expected: 'Visible img with positive dimensions and display != none'
    });
  }

  return { isVisible, box, computedStyle };
}

async function run() {
  const { server, url, mutatedUrl } = await startServer();
  let browser;

  const results = {
    task: 'R59-T010',
    target: url,
    mutatedTarget: mutatedUrl,
    timestamp: new Date().toISOString(),
    toolVersions: {
      node: process.version,
      playwright: '^1.65.1'
    },
    checks: []
  };

  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 360, height: 600 }
    });
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    // -------------------------------------------------------------------------
    // 1. Test Baseline Correct Extension Popup Page
    // -------------------------------------------------------------------------
    await page.goto(url, { waitUntil: 'load' });

    // Assert page title and container
    const title = await page.title();
    assert.equal(title, 'My Carbon Trigger', 'Extension popup title must match');

    const containerCount = await page.locator('body.container').count();
    assert.equal(containerCount, 1, 'Body must have container class');

    // Run strict img visibility assertion on the correct page
    const baselineImgMetrics = await assertImgControlVisible(page, 'Baseline Production');
    assert.ok(
      baselineImgMetrics.computedStyle.naturalWidth > 0,
      'Image asset plants-people.png must successfully load'
    );

    // Verify h1 heading exists and is visible
    const h1Text = await page.textContent('h1');
    assert.ok(
      h1Text && h1Text.includes('Carbon Trigger'),
      `H1 heading must be present, got: ${h1Text}`
    );

    // Capture baseline screenshot
    const baselineScreenshot = path.join(workDir, 'baseline-correct.png');
    await page.screenshot({ path: baselineScreenshot });

    results.checks.push({
      check: 'Baseline correct extension popup initialized and source anchor img validated',
      status: 'PASS',
      metrics: baselineImgMetrics,
      screenshot: baselineScreenshot
    });

    // -------------------------------------------------------------------------
    // 2. Test Deliberate Mutation in Temporary Fixture
    // -------------------------------------------------------------------------
    const mutatedPage = await context.newPage();
    mutatedPage.on('pageerror', (err) => pageErrors.push(err.message));
    await mutatedPage.goto(mutatedUrl, { waitUntil: 'load' });

    let mutationDetected = false;
    let caughtMessage = '';

    try {
      await assertImgControlVisible(mutatedPage, 'Temporary Mutated Fixture');
    } catch (err) {
      mutationDetected = true;
      caughtMessage = err.message;
    }

    assert.ok(
      mutationDetected,
      'Assertion must fail on the mutated test fixture due to deliberate style regression'
    );
    assert.ok(
      caughtMessage.includes('UI regression detected'),
      `Expected regression message, got: ${caughtMessage}`
    );

    // Capture mutated screenshot
    const mutatedScreenshot = path.join(workDir, 'mutated-regression.png');
    await mutatedPage.screenshot({ path: mutatedScreenshot });

    results.checks.push({
      check: 'Deliberate fixture mutation correctly caught by behavioral UI assertion',
      status: 'PASS',
      caughtMessage,
      screenshot: mutatedScreenshot
    });

    await mutatedPage.close();

    // -------------------------------------------------------------------------
    // 3. Confirm Final Application Contains No Mutation
    // -------------------------------------------------------------------------
    const finalHtml = fs.readFileSync(path.join(appDir, 'index.html'), 'utf-8');
    const finalCss = fs.readFileSync(path.join(appDir, 'styles.css'), 'utf-8');

    assert.ok(!finalHtml.includes('Deliberate test mutation'), 'dist/index.html must not contain mutations');
    assert.ok(!finalCss.includes('display: none !important'), 'dist/styles.css must not contain mutations');

    results.checks.push({
      check: 'Production application files verified clean and unmutated',
      status: 'PASS'
    });

    assert.equal(pageErrors.length, 0, `Unexpected page errors observed during test: ${pageErrors.join(', ')}`);

    console.log('All checks passed for R59-T010.');
    await context.close();
  } finally {
    if (browser) await browser.close();
    server.close();
  }

  fs.writeFileSync(
    path.join(workDir, 'results.json'),
    JSON.stringify(results, null, 2),
    'utf-8'
  );
}

run().catch((err) => {
  console.error('R59-T010 check failed:', err);
  process.exit(1);
});

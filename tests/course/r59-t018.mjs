import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');
const appDir = path.join(rootDir, '3-terrarium', 'solution');
const workDir = path.join(rootDir, 'work', 'R59-T018');
fs.mkdirSync(workDir, { recursive: true });

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.html': return 'text/html; charset=UTF-8';
    case '.css': return 'text/css; charset=UTF-8';
    case '.js': return 'application/javascript; charset=UTF-8';
    case '.png': return 'image/png';
    default: return 'application/octet-stream';
  }
}

async function startServer() {
  const server = http.createServer((req, res) => {
    const rawUrl = req.url?.split('?')[0] || '/';
    const relPath = rawUrl === '/' ? 'index.html' : rawUrl.replace(/^\//, '');
    const safePath = path.normalize(decodeURIComponent(relPath)).replace(/^(\.\.[\/\\])+/, '');
    const fullPath = path.join(appDir, safePath);

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
    url: `http://127.0.0.1:${port}/index.html`
  };
}

async function run() {
  const { server, url } = await startServer();
  let browser;

  const results = {
    task: 'R59-T018',
    target: url,
    timestamp: new Date().toISOString(),
    checks: []
  };

  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.goto(url, { waitUntil: 'load' });
    assert.equal(pageErrors.length, 0, `Page errors on load: ${pageErrors.join(', ')}`);

    // 1. Verify required source anchors
    const anchors = await page.evaluate(() => ({
      hasPage: !!document.querySelector('#page'),
      hasPlantSelection: !!document.querySelector('#plant-selection'),
      hasLeftContainer: !!document.querySelector('#left-container'),
      hasPlant1: !!document.querySelector('#plant1')
    }));
    assert.ok(anchors.hasPage, '#page anchor must exist');
    assert.ok(anchors.hasPlantSelection, '#plant-selection anchor must exist');
    assert.ok(anchors.hasLeftContainer, '#left-container anchor must exist');
    assert.ok(anchors.hasPlant1, '#plant1 anchor must exist');
    results.checks.push({ check: 'Anchors #page, #plant-selection, #left-container, #plant1 verified', status: 'PASS' });

    // 2. Safe text rendering test with HTML/script injection payload
    const injectionPayload = '<img src=x onerror="window.__xss_flag=true">';
    await page.fill('#terrarium-title-input', injectionPayload);
    await page.waitForTimeout(100);

    // Verify textContent renders the raw string
    const displayDetails = await page.evaluate(() => {
      const displayEl = document.getElementById('terrarium-title-display');
      return {
        textContent: displayEl?.textContent,
        injectedImg: !!displayEl?.querySelector('img'),
        xssExecuted: window['__xss_flag'] === true
      };
    });

    assert.equal(
      displayDetails.textContent,
      injectionPayload,
      `Expected textContent to exactly equal payload string, got: "${displayDetails.textContent}"`
    );
    assert.equal(displayDetails.injectedImg, false, 'No <img> DOM element should be created from input string');
    assert.equal(displayDetails.xssExecuted, false, 'No script or onerror handler should be executed');
    results.checks.push({ check: 'Payload rendered as literal text without element injection or handler execution', status: 'PASS' });

    const screenshotPath = path.join(workDir, 'safe-text-rendered.png');
    await page.screenshot({ path: screenshotPath });

    console.log('All safe text rendering checks passed for R59-T018.');
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
  console.error('R59-T018 check failed:', err);
  process.exit(1);
});

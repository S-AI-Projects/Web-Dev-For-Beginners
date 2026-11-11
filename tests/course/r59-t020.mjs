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
const workDir = path.join(rootDir, 'work', 'R59-T020');
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
    task: 'R59-T020',
    target: url,
    timestamp: new Date().toISOString(),
    checks: []
  };

  try {
    browser = await chromium.launch({ headless: true });

    // 1. Correct Production Behavior Test
    {
      const context = await browser.newContext();
      const page = await context.newPage();
      const pageErrors = [];
      page.on('pageerror', (err) => pageErrors.push(err.message));

      await page.goto(url, { waitUntil: 'load' });
      assert.equal(pageErrors.length, 0, `Page errors on load: ${pageErrors.join(', ')}`);

      // Verify anchor img
      const hasImg = await page.evaluate(() => {
        const img = document.querySelector('img');
        return img && img.getAttribute('alt') === 'plants and people';
      });
      assert.ok(hasImg, 'Source anchor <img> with alt="plants and people" must exist');
      results.checks.push({ check: 'Source anchor img verified', status: 'PASS' });

      // Form should be visible initially
      const isFormVisible = await page.evaluate(() => {
        const form = document.querySelector('.form-data');
        return form && window.getComputedStyle(form).display !== 'none';
      });
      assert.ok(isFormVisible, 'Form must be visible when no credentials are saved in localStorage');

      // Fill in inputs and submit
      await page.fill('#region', 'FR');
      await page.fill('#api', 'sample-api-token-1234');
      await page.click('button.search-btn');
      await page.waitForTimeout(200);

      // Verify correct state: form hidden, results visible, storage updated
      const state = await page.evaluate(() => {
        const form = document.querySelector('.form-data');
        const resultsEl = document.querySelector('.result-container');
        const regionText = document.querySelector('.my-region')?.textContent;
        return {
          formHidden: form ? window.getComputedStyle(form).display === 'none' : false,
          resultsVisible: resultsEl ? window.getComputedStyle(resultsEl).display !== 'none' : false,
          regionText,
          savedRegion: localStorage.getItem('regionName')
        };
      });

      assert.ok(state.formHidden, 'Form must be hidden after successful submission');
      assert.ok(state.resultsVisible, 'Result container must be visible after submission');
      assert.equal(state.regionText, 'FR', 'Rendered region text must match entered region');
      assert.equal(state.savedRegion, 'FR', 'Entered region must be stored in localStorage');

      const screenshotCorrect = path.join(workDir, 'correct-state.png');
      await page.screenshot({ path: screenshotCorrect });
      results.checks.push({ check: 'Production form submission and state transition', status: 'PASS' });

      await context.close();
    }

    // 2. Deliberate Mutation Test Fixture: Break event handler in a test context
    {
      const context = await browser.newContext();
      const page = await context.newPage();

      // Intercept main.js and deliberately break the submit binding
      await page.route('**/main.js', (route) => {
        const originalContent = fs.readFileSync(path.join(appDir, 'main.js'), 'utf-8');
        // Mutate by commenting out form event listener
        const brokenContent = originalContent.replace(
          'form.addEventListener(\'submit\', handleSubmit);',
          '// MUTATION: form.addEventListener(\'submit\', handleSubmit);'
        );
        route.fulfill({
          status: 200,
          contentType: 'application/javascript',
          body: brokenContent
        });
      });

      await page.goto(url, { waitUntil: 'load' });
      await page.fill('#region', 'UK');
      await page.fill('#api', 'broken-test-key');
      await page.click('button.search-btn');
      await page.waitForTimeout(200);

      // Assert that the mutation is distinguished: form is NOT hidden and results are NOT updated
      const mutationState = await page.evaluate(() => {
        const form = document.querySelector('.form-data');
        const resultsEl = document.querySelector('.result-container');
        return {
          formStillVisible: form ? window.getComputedStyle(form).display !== 'none' : false,
          resultsNotRendered: resultsEl ? window.getComputedStyle(resultsEl).display === 'none' : true,
          storageEmpty: localStorage.getItem('regionName') === null
        };
      });

      assert.ok(
        mutationState.formStillVisible && mutationState.resultsNotRendered && mutationState.storageEmpty,
        'Regression check correctly caught the broken event binding mutation'
      );

      const screenshotMutated = path.join(workDir, 'mutated-state.png');
      await page.screenshot({ path: screenshotMutated });
      results.checks.push({ check: 'Deliberate mutation detected by regression check', status: 'PASS' });

      await context.close();
    }

    console.log('All regression and mutation detection checks passed for R59-T020.');
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
  console.error('R59-T020 check failed:', err);
  process.exit(1);
});

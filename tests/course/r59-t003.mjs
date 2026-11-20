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
const workDir = path.join(rootDir, 'work', 'R59-T003');
fs.mkdirSync(workDir, { recursive: true });

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.html': return 'text/html; charset=UTF-8';
    case '.css': return 'text/css; charset=UTF-8';
    case '.js': return 'application/javascript; charset=UTF-8';
    case '.png': return 'image/png';
    case '.json': return 'application/json';
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
    task: 'R59-T003',
    target: url,
    timestamp: new Date().toISOString(),
    checks: []
  };

  try {
    browser = await chromium.launch({ headless: true });

    // --- Scenario 1: Baseline Normal Load & Empty State Display ---
    {
      const context = await browser.newContext();
      const page = await context.newPage();
      const pageErrors = [];
      page.on('pageerror', (err) => pageErrors.push(err.message));

      await page.goto(url, { waitUntil: 'load' });
      assert.equal(pageErrors.length, 0, `Unexpected page errors on normal load: ${pageErrors.join(', ')}`);

      // 1. Verify anchor img exists
      const imgCount = await page.locator('img').count();
      assert.ok(imgCount >= 1, 'Source anchor img must exist in DOM');
      results.checks.push({ check: 'Source anchor img exists', status: 'PASS' });

      // 2. Verify empty state message is present and readable
      const emptyStateText = await page.textContent('#empty-state');
      assert.ok(emptyStateText && emptyStateText.includes('No carbon region selected'), 'Empty state message must guide the user');
      results.checks.push({ check: 'Meaningful empty state displayed initially', status: 'PASS' });

      const normalScreenshot = path.join(workDir, 'normal-initial-state.png');
      await page.screenshot({ path: normalScreenshot });
      results.checks.push({ check: 'Normal initial state screenshot', path: normalScreenshot });

      await context.close();
    }

    // --- Scenario 2: Failed Asset / Image Request Error Handling ---
    {
      const context = await browser.newContext();
      const page = await context.newPage();
      const pageErrors = [];
      page.on('pageerror', (err) => pageErrors.push(err.message));

      // Route image requests to abort, simulating failed/missing asset fixture
      await page.route('**/*.png', (route) => route.abort());

      await page.goto(url, { waitUntil: 'load' });
      await page.waitForTimeout(150);

      // Verify no uncaught page script errors were thrown
      assert.equal(pageErrors.length, 0, `Unexpected page script errors on asset abort: ${pageErrors.join(', ')}`);

      // Verify fallback badge is visible and broken image is hidden
      const fallbackVisible = await page.isVisible('#image-fallback');
      const imgHidden = await page.evaluate(() => {
        const img = document.getElementById('header-image');
        return !img || img.style.display === 'none';
      });

      assert.ok(fallbackVisible, 'Image fallback badge must be displayed when image fails to load');
      assert.ok(imgHidden, 'Failed image element must be hidden');
      results.checks.push({ check: 'Failed asset triggers readable fallback state without uncaught errors', status: 'PASS' });

      const fallbackScreenshot = path.join(workDir, 'failed-asset-fallback.png');
      await page.screenshot({ path: fallbackScreenshot });
      results.checks.push({ check: 'Fallback state screenshot captured', path: fallbackScreenshot });

      // --- Scenario 3: Recovery After Restored Fixture ---
      await page.unroute('**/*.png');
      await page.evaluate(() => {
        if (window.restoreImage) {
          window.restoreImage('images/plants-people.png');
        }
      });
      await page.waitForTimeout(150);

      const recoveredImgVisible = await page.evaluate(() => {
        const img = document.getElementById('header-image');
        return img && img.style.display !== 'none';
      });
      const recoveredFallbackHidden = await page.evaluate(() => {
        const fallback = document.getElementById('image-fallback');
        return !fallback || fallback.style.display === 'none';
      });

      assert.ok(recoveredImgVisible, 'Image must be visible after restoration');
      assert.ok(recoveredFallbackHidden, 'Fallback badge must be hidden after restoration');
      results.checks.push({ check: 'Page recovers cleanly after restoring asset fixture', status: 'PASS' });

      const recoveredScreenshot = path.join(workDir, 'recovered-state.png');
      await page.screenshot({ path: recoveredScreenshot });
      results.checks.push({ check: 'Recovered state screenshot captured', path: recoveredScreenshot });

      await context.close();
    }

    console.log('All checks passed for R59-T003.');
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
  console.error('R59-T003 check failed:', err);
  process.exit(1);
});

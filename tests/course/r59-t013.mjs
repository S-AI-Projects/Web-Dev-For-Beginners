import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');
const appDir = path.join(rootDir, '6-space-game', '2-drawing-to-canvas', 'solution');
const workDir = path.join(rootDir, 'work', 'R59-T013');
fs.mkdirSync(workDir, { recursive: true });

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.html': return 'text/html; charset=UTF-8';
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
    task: 'R59-T013',
    target: url,
    timestamp: new Date().toISOString(),
    tests: []
  };

  try {
    browser = await chromium.launch({ headless: true });

    // 1. Scenario A: Normal execution with valid assets
    {
      const context = await browser.newContext();
      const page = await context.newPage();
      const pageErrors = [];
      page.on('pageerror', (err) => pageErrors.push(err.message));

      await page.goto(url, { waitUntil: 'load' });
      // Wait for window.onload canvas drawing
      await page.waitForTimeout(300);

      assert.equal(pageErrors.length, 0, `Normal run emitted page errors: ${pageErrors.join(', ')}`);

      // Verify DOM anchors
      const anchors = await page.evaluate(() => ({
        score: document.getElementById('score')?.textContent,
        lives: document.getElementById('lives')?.textContent,
        hasCanvas: !!document.getElementById('canvas')
      }));
      assert.ok(anchors.hasCanvas, '#canvas anchor must exist');
      assert.equal(anchors.score, '0', '#score must be initialized to 0');
      assert.equal(anchors.lives, '3', '#lives must be initialized to 3');

      const screenshotNormal = path.join(workDir, 'normal-assets.png');
      await page.screenshot({ path: screenshotNormal });
      results.tests.push({ scenario: 'Normal Asset Load', status: 'PASS', screenshot: screenshotNormal });
      await context.close();
    }

    // 2. Scenario B: Failed asset fixture (images fail to load)
    {
      const context = await browser.newContext();
      const page = await context.newPage();
      const pageErrors = [];
      page.on('pageerror', (err) => pageErrors.push(err.message));

      // Route image assets to fail with 404
      await page.route('**/*.png', (route) => route.abort());

      await page.goto(url, { waitUntil: 'load' });
      await page.waitForTimeout(300);

      assert.equal(pageErrors.length, 0, `Failed asset scenario must not throw uncaught errors: ${pageErrors.join(', ')}`);

      const statusText = await page.evaluate(() => document.getElementById('game-status')?.textContent);
      assert.ok(
        statusText?.includes('Asset fallback active'),
        `Expected fallback status message, got: "${statusText}"`
      );

      // Verify canvas still drew content despite asset failure
      const hasDrawn = await page.evaluate(() => {
        const canvas = document.getElementById('canvas');
        const ctx = canvas.getContext('2d');
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        // Ensure not completely transparent/blank
        for (let i = 0; i < imgData.data.length; i += 4) {
          if (imgData.data[i + 3] > 0) return true;
        }
        return false;
      });
      assert.ok(hasDrawn, 'Canvas must render content even with fallback graphics');

      const screenshotFallback = path.join(workDir, 'fallback-assets.png');
      await page.screenshot({ path: screenshotFallback });
      results.tests.push({ scenario: 'Failed Asset Fallback', status: 'PASS', screenshot: screenshotFallback });
      await context.close();
    }

    console.log('All error and fallback display checks passed for R59-T013.');
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
  console.error('R59-T013 check failed:', err);
  process.exit(1);
});

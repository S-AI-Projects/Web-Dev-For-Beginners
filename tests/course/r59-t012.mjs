import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');
const appDir = path.join(rootDir, '7-bank-project', 'solution');
const workDir = path.join(rootDir, 'work', 'R59-T012');
fs.mkdirSync(workDir, { recursive: true });

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.html': return 'text/html; charset=UTF-8';
    case '.css': return 'text/css; charset=UTF-8';
    case '.js': return 'application/javascript; charset=UTF-8';
    case '.svg': return 'image/svg+xml';
    case '.png': return 'image/png';
    case '.json': return 'application/json';
    case '.woff2': return 'font/woff2';
    default: return 'application/octet-stream';
  }
}

async function startServer() {
  const server = http.createServer((req, res) => {
    const rawUrl = req.url?.split('?')[0] || '/';
    const relPath = rawUrl === '/' || rawUrl === '/login' || rawUrl === '/dashboard'
      ? 'index.html'
      : rawUrl.replace(/^\//, '');

    const safePath = path.normalize(decodeURIComponent(relPath)).replace(/^(\.\.[\/\\])+/, '');
    const fullPath = path.join(appDir, safePath);

    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
      res.writeHead(200, { 'Content-Type': getContentType(fullPath) });
      fs.createReadStream(fullPath).pipe(res);
      return;
    }

    const fallbackIndex = path.join(appDir, 'index.html');
    if (fs.existsSync(fallbackIndex)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=UTF-8' });
      fs.createReadStream(fallbackIndex).pipe(res);
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
    url: `http://127.0.0.1:${port}/login`
  };
}

async function run() {
  const { server, url } = await startServer();
  let browser;

  const results = {
    task: 'R59-T012',
    target: url,
    timestamp: new Date().toISOString(),
    viewportsTested: []
  };

  try {
    browser = await chromium.launch({ headless: true });

    for (const vp of [{ width: 360, height: 800 }, { width: 1280, height: 800 }]) {
      const context = await browser.newContext({ viewport: vp });
      const page = await context.newPage();

      const pageErrors = [];
      page.on('pageerror', (err) => pageErrors.push(err.message));

      await page.goto(url, { waitUntil: 'domcontentloaded' });
      assert.equal(pageErrors.length, 0, `Page emitted unexpected errors at ${vp.width}x${vp.height}: ${pageErrors.join(', ')}`);

      // 1. Verify anchors exist in DOM
      const anchors = await page.evaluate(() => ({
        hasApp: !!document.querySelector('#app'),
        hasLoginTemplate: !!document.querySelector('#login'),
        hasLoginTitle: !!document.querySelector('#loginTitle'),
        hasLoginHeading: !!document.querySelector('#loginHeading'),
        hasLoginForm: !!document.querySelector('#loginForm'),
        hasRegisterForm: !!document.querySelector('#registerForm')
      }));
      assert.ok(anchors.hasApp, 'Mount point #app must exist');
      assert.ok(anchors.hasLoginTitle, '#loginTitle must be rendered');
      assert.ok(anchors.hasLoginHeading, '#loginHeading must be rendered');
      assert.ok(anchors.hasLoginForm, '#loginForm must be rendered');
      assert.ok(anchors.hasRegisterForm, '#registerForm must be rendered');

      // 2. Check for unintended horizontal overflow
      const layoutMetrics = await page.evaluate(() => {
        const docEl = document.documentElement;
        return {
          scrollWidth: docEl.scrollWidth,
          clientWidth: docEl.clientWidth,
          hasHorizontalOverflow: docEl.scrollWidth > docEl.clientWidth
        };
      });
      assert.ok(
        !layoutMetrics.hasHorizontalOverflow,
        `Unintended horizontal overflow at ${vp.width}px: scrollWidth (${layoutMetrics.scrollWidth}) > clientWidth (${layoutMetrics.clientWidth})`
      );

      // 3. Verify form controls are not clipped and within visible bounds
      const controlsInBounds = await page.evaluate((viewportWidth) => {
        const inputs = Array.from(document.querySelectorAll('#loginForm input, #registerForm input, button'));
        return inputs.every((el) => {
          const rect = el.getBoundingClientRect();
          return rect.left >= 0 && rect.right <= viewportWidth && rect.width > 0 && rect.height > 0;
        });
      }, vp.width);
      assert.ok(controlsInBounds, `Form controls must be within viewport bounds at width ${vp.width}`);

      // 4. Save screenshot for review
      const screenshotPath = path.join(workDir, `viewport-${vp.width}x${vp.height}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });

      results.viewportsTested.push({
        viewport: vp,
        scrollWidth: layoutMetrics.scrollWidth,
        clientWidth: layoutMetrics.clientWidth,
        controlsInBounds: true,
        screenshot: screenshotPath,
        status: 'PASS'
      });

      await context.close();
    }

    console.log('All responsive layout checks passed for R59-T012.');
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
  console.error('R59-T012 check failed:', err);
  process.exit(1);
});

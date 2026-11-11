import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');
const workDir = path.join(rootDir, 'work', 'R59-T011');
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
    const safePath = path.normalize(decodeURIComponent(rawUrl)).replace(/^(\.\.[\/\\])+/, '');
    const fullPath = path.join(rootDir, safePath);

    if (!fs.existsSync(fullPath)) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
      return;
    }

    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      const indexHtml = path.join(fullPath, 'index.html');
      if (fs.existsSync(indexHtml)) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=UTF-8' });
        fs.createReadStream(indexHtml).pipe(res);
        return;
      }
    }

    res.writeHead(200, { 'Content-Type': getContentType(fullPath) });
    fs.createReadStream(fullPath).pipe(res);
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 8080;
  return {
    server,
    url: `http://127.0.0.1:${port}/5-browser-extension/start/dist/index.html`
  };
}

async function run() {
  const { server, url } = await startServer();
  let browser;

  const results = {
    task: 'R59-T011',
    target: url,
    timestamp: new Date().toISOString(),
    assertions: []
  };

  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.goto(url, { waitUntil: 'domcontentloaded' });
    assert.equal(pageErrors.length, 0, `Page emitted unexpected errors: ${pageErrors.join(', ')}`);
    results.assertions.push({ check: 'No unexpected page errors on load', status: 'PASS' });

    // 1. Verify no positive tabindex anywhere
    const positiveTabindices = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('[tabindex]'));
      return elements
        .filter((el) => {
          const val = parseInt(el.getAttribute('tabindex') || '0', 10);
          return val > 0;
        })
        .map((el) => el.outerHTML);
    });
    assert.equal(positiveTabindices.length, 0, `Found positive tabindex: ${positiveTabindices.join(', ')}`);
    results.assertions.push({ check: 'No positive tabindex present', status: 'PASS' });

    // 2. Test Tab traversal: Press Tab to focus skip link
    await page.keyboard.press('Tab');
    const activeTagName = await page.evaluate(() => document.activeElement?.tagName.toLowerCase());
    const activeClass = await page.evaluate(() => document.activeElement?.className);
    assert.equal(activeTagName, 'a', `Expected activeElement to be <a> but was ${activeTagName}`);
    assert.ok(activeClass.includes('skip-link'), `Expected activeElement class to include skip-link, was ${activeClass}`);
    results.assertions.push({ check: 'Tab key navigates to skip-link', status: 'PASS' });

    // 3. Test visible focus on skip link
    const isFocusVisible = await page.evaluate(() => {
      const link = document.querySelector('.skip-link');
      if (!link) return false;
      const rect = link.getBoundingClientRect();
      const style = window.getComputedStyle(link);
      const isVisibleOnScreen = rect.top >= 0 && rect.bottom > 0 && rect.width > 0;
      const hasOutlineOrVisibleStyle = style.outlineStyle !== 'none' || style.boxShadow !== 'none';
      return isVisibleOnScreen && hasOutlineOrVisibleStyle;
    });
    assert.ok(isFocusVisible, 'Skip link should be visibly positioned and styled on focus');
    results.assertions.push({ check: 'Skip link has visible focus styling', status: 'PASS' });

    // Save screenshot of focused skip link
    const screenshotPath = path.join(workDir, 'skip-link-focused.png');
    await page.screenshot({ path: screenshotPath });
    results.assertions.push({ check: 'Screenshot captured', path: screenshotPath });

    // 4. Test keyboard activation via Enter key
    await page.keyboard.press('Enter');
    const hash = await page.evaluate(() => window.location.hash);
    const activeId = await page.evaluate(() => document.activeElement?.id);
    assert.equal(hash, '#main-content', `Expected location hash to be #main-content, but got ${hash}`);
    assert.equal(activeId, 'main-content', `Expected target #main-content to receive focus, got ${activeId}`);
    results.assertions.push({ check: 'Enter key activates link and transfers focus to #main-content', status: 'PASS' });

    console.log('All checks passed for R59-T011.');
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
  console.error('R59-T011 check failed:', err);
  process.exit(1);
});

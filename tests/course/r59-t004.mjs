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
const workDir = path.join(rootDir, 'work', 'R59-T004');
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

    // SPA fallback: return index.html for virtual routes
    const indexHtml = path.join(appDir, 'index.html');
    if (fs.existsSync(indexHtml)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=UTF-8' });
      fs.createReadStream(indexHtml).pipe(res);
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
    task: 'R59-T004',
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

    // Clear localStorage to ensure predictable clean state
    await page.goto(url, { waitUntil: 'load' });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'load' });

    assert.equal(pageErrors.length, 0, `Unexpected page errors on initial load: ${pageErrors.join(', ')}`);

    // 1. Verify required source anchors
    const appEl = await page.$('#app');
    const loginTpl = await page.$('template#login');
    const loginTitleEl = await page.$('#loginTitle');
    const loginHeadingEl = await page.$('#loginHeading');

    assert.ok(appEl, 'Source anchor #app must exist');
    assert.ok(loginTpl, 'Source anchor template#login must exist');
    assert.ok(loginTitleEl, 'Source anchor #loginTitle must exist in rendered login view');
    assert.ok(loginHeadingEl, 'Source anchor #loginHeading must exist in rendered login view');
    results.checks.push({ check: 'Source anchors #app, #login, #loginTitle, #loginHeading exist', status: 'PASS' });

    // Capture initial login screenshot
    const loginScreenshot = path.join(workDir, 'login-initial.png');
    await page.screenshot({ path: loginScreenshot });
    results.checks.push({ check: 'Login initial screenshot captured', path: loginScreenshot });

    // 2. Test repeat initialization: invoke init() and updateRoute() multiple times
    const initialFormCount = await page.locator('#loginForm').count();
    assert.equal(initialFormCount, 1, 'Exactly one loginForm should exist initially');

    await page.evaluate(() => {
      window.init();
      window.init();
      window.updateRoute();
    });
    await page.waitForTimeout(100);

    const postInitFormCount = await page.locator('#loginForm').count();
    const postInitHeadingCount = await page.locator('#loginHeading').count();
    assert.equal(postInitFormCount, 1, 'Repeated initialization must not duplicate form DOM nodes');
    assert.equal(postInitHeadingCount, 1, 'Repeated initialization must not duplicate heading DOM nodes');
    results.checks.push({ check: 'Repeat initialization produces exactly one view without node duplication', status: 'PASS' });

    // 3. Test route change to an invalid route and verify 404 Not Found view
    await page.evaluate(() => {
      window.navigate('/non-existent-page-test');
    });
    await page.waitForTimeout(100);

    const notFoundTitle = await page.textContent('#notFoundTitle');
    assert.ok(notFoundTitle && notFoundTitle.includes('404'), `Expected 404 title, got: ${notFoundTitle}`);
    const notFoundCards = await page.locator('.page-error').count();
    assert.equal(notFoundCards, 1, 'Exactly one 404 error section rendered');
    results.checks.push({ check: 'Invalid route properly displays 404 not-found view', status: 'PASS' });

    // Capture not found view screenshot
    const notFoundScreenshot = path.join(workDir, 'not-found-view.png');
    await page.screenshot({ path: notFoundScreenshot });
    results.checks.push({ check: '404 not-found screenshot captured', path: notFoundScreenshot });

    // 4. Test repeat navigation to invalid route
    await page.evaluate(() => {
      window.navigate('/non-existent-page-test');
      window.updateRoute();
    });
    await page.waitForTimeout(100);
    const postRepeatNotFoundCards = await page.locator('.page-error').count();
    assert.equal(postRepeatNotFoundCards, 1, 'Repeated navigation to invalid route must not duplicate 404 cards');
    results.checks.push({ check: 'Repeat navigation to invalid route produces single view', status: 'PASS' });

    // 5. Test returning to login route via Go Home button
    await page.click('#goHomeBtn');
    await page.waitForTimeout(150);

    const returnedLoginTitle = await page.$('#loginTitle');
    assert.ok(returnedLoginTitle, 'Returned to login view successfully after clicking Go to Login');
    assert.equal(pageErrors.length, 0, `Unexpected page errors during route cycling: ${pageErrors.join(', ')}`);
    results.checks.push({ check: 'Navigation back to login route operates cleanly without errors', status: 'PASS' });

    console.log('All checks passed for R59-T004.');
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
  console.error('R59-T004 check failed:', err);
  process.exit(1);
});

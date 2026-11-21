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
const workDir = path.join(rootDir, 'work', 'R59-T008');
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
    task: 'R59-T008',
    target: url,
    timestamp: new Date().toISOString(),
    toolVersions: {
      node: process.version,
      playwright: '^1.65.1'
    },
    checks: []
  };

  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    // 1. Initial clean load: verify source anchors (#app, #login, #loginTitle, #loginHeading)
    await page.goto(url, { waitUntil: 'load' });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'load' });

    assert.equal(pageErrors.length, 0, `Unexpected page errors on initial load: ${pageErrors.join(', ')}`);

    const appEl = await page.$('#app');
    const loginTpl = await page.$('template#login');
    const loginTitleEl = await page.$('#loginTitle');
    const loginHeadingEl = await page.$('#loginHeading');

    assert.ok(appEl, 'Source anchor #app must exist');
    assert.ok(loginTpl, 'Source anchor template#login must exist');
    assert.ok(loginTitleEl, 'Source anchor #loginTitle must exist in rendered login view');
    assert.ok(loginHeadingEl, 'Source anchor #loginHeading must exist in rendered login view');

    results.checks.push({
      check: 'Source anchors #app, #login, #loginTitle, #loginHeading exist',
      status: 'PASS'
    });

    const baselineScreenshot = path.join(workDir, 'baseline-login.png');
    await page.screenshot({ path: baselineScreenshot });
    results.checks.push({
      check: 'Baseline clean login view screenshot captured',
      path: baselineScreenshot
    });

    // 2. Seed persisted account state containing <img src=x onerror=...> payloads
    const xssDesc = 'Checking <img src=x onerror=window.__xss_desc=true>';
    const xssUser = 'User<img src=x onerror=window.__xss_user=true>';
    const xssTx = 'Coffee <img src=x onerror=window.__xss_tx=true>';

    const testAccount = {
      user: xssUser,
      description: xssDesc,
      balance: 2500,
      currency: 'USD',
      transactions: [
        {
          id: 'tx-001',
          date: '2026-02-01',
          object: xssTx,
          amount: -12.5
        }
      ]
    };

    await page.evaluate((accountData) => {
      localStorage.setItem('savedAccount', JSON.stringify(accountData));
      localStorage.setItem('accounts', JSON.stringify([accountData]));
      history.replaceState(null, '', '/');
    }, testAccount);

    // 3. Reload or navigate to trigger session restoration from localStorage
    await page.evaluate(() => {
      if (typeof window.init === 'function') {
        window.init();
      } else {
        window.navigate('/dashboard');
      }
    });
    // Wait for async refresh() and updateDashboard() to complete
    await page.waitForSelector('table.transactions-table tbody tr');
    await page.waitForFunction(() => {
      const info = document.getElementById('account-info')?.textContent || '';
      return info.length > 0;
    });

    // 4. Verify safe text rendering: string appears as text, creates no injected element, executes no handler
    const renderedDesc = await page.textContent('#transactions-description');
    assert.ok(
      renderedDesc && renderedDesc.includes(xssDesc),
      `Expected description to contain raw text, got: ${renderedDesc}`
    );

    const renderedAccountInfo = await page.textContent('#account-info');
    assert.ok(
      renderedAccountInfo && renderedAccountInfo.includes(xssUser),
      `Expected account info to contain raw username text, got: ${renderedAccountInfo}`
    );

    const renderedTx = await page.textContent('table.transactions-table tbody td:nth-child(2)');
    assert.ok(
      renderedTx && renderedTx.includes(xssTx),
      `Expected transaction object to contain raw text, got: ${renderedTx}`
    );

    // Assert that no <img> elements with src="x" were created inside #app
    const injectedImgs = await page.locator('#app img[src="x"]').count();
    assert.equal(injectedImgs, 0, 'No injected <img> elements should exist in the DOM');

    // Assert that no onerror script handler executed on the window
    const xssFlags = await page.evaluate(() => ({
      desc: window.__xss_desc,
      user: window.__xss_user,
      tx: window.__xss_tx
    }));
    assert.equal(xssFlags.desc, undefined, 'window.__xss_desc must be undefined');
    assert.equal(xssFlags.user, undefined, 'window.__xss_user must be undefined');
    assert.equal(xssFlags.tx, undefined, 'window.__xss_tx must be undefined');

    results.checks.push({
      check: 'Persisted account/session text rendered safely as text without element injection or handler execution',
      status: 'PASS',
      renderedDescription: renderedDesc,
      renderedAccountInfo,
      renderedTransaction: renderedTx
    });

    const persistedScreenshot = path.join(workDir, 'persisted-safe-text.png');
    await page.screenshot({ path: persistedScreenshot });
    results.checks.push({
      check: 'Persisted safe text rendering screenshot captured',
      path: persistedScreenshot
    });

    // 5. Add a new transaction through the UI dialog with an XSS probe
    const xssTx2 = 'Bakery <img src=x onerror=window.__xss_tx2=true>';
    await page.click('button[onclick="addTransaction()"]');
    await page.waitForSelector('#transactionDialog.show');

    await page.fill('#transactionForm input[name="object"]', xssTx2);
    await page.fill('#transactionForm input[name="amount"]', '-8.25');
    await page.click('#transactionForm button[type="submit"]');

    // Wait for dialog to close and table to update
    await page.waitForSelector('#transactionDialog', { state: 'hidden' });
    await page.waitForTimeout(200);

    const txTableText = await page.textContent('table.transactions-table tbody');
    assert.ok(
      txTableText && txTableText.includes(xssTx2),
      'Newly added transaction must display raw text'
    );

    const injectedImgsPostAdd = await page.locator('#app img[src="x"]').count();
    assert.equal(injectedImgsPostAdd, 0, 'No injected <img> elements after UI transaction creation');

    const flagTx2 = await page.evaluate(() => window.__xss_tx2);
    assert.equal(flagTx2, undefined, 'window.__xss_tx2 must be undefined');

    results.checks.push({
      check: 'Dynamic transaction entry safely rendered as text without executing script',
      status: 'PASS'
    });

    // 6. Test session reset / logout behavior
    await page.click('button[onclick="logout()"]');
    await page.waitForSelector('#loginHeading');

    const savedAfterLogout = await page.evaluate(() => localStorage.getItem('savedAccount'));
    assert.ok(
      savedAfterLogout === null || savedAfterLogout === 'null',
      `Session state in localStorage must be cleared on logout, got: ${savedAfterLogout}`
    );

    // Refresh page to confirm session is completely reset and user stays on /login
    await page.reload({ waitUntil: 'load' });
    const postResetLoginHeading = await page.$('#loginHeading');
    assert.ok(postResetLoginHeading, 'Login view must remain active after refresh following logout');

    results.checks.push({
      check: 'Logout resets session and prevents automatic dashboard restore on refresh',
      status: 'PASS'
    });

    const resetScreenshot = path.join(workDir, 'logout-reset.png');
    await page.screenshot({ path: resetScreenshot });
    results.checks.push({
      check: 'Post-logout reset screenshot captured',
      path: resetScreenshot
    });

    assert.equal(pageErrors.length, 0, `Unexpected page errors observed during test run: ${pageErrors.join(', ')}`);

    console.log('All checks passed for R59-T008.');
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
  console.error('R59-T008 check failed:', err);
  process.exit(1);
});

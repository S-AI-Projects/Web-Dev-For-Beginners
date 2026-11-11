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
const workDir = path.join(rootDir, 'work', 'R59-T015');
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
    url: `http://127.0.0.1:${port}`
  };
}

const deterministicFixture = {
  user: 'alice',
  currency: 'USD',
  description: 'Checking Account',
  balance: 2450.50,
  transactions: [
    { id: 1, date: '2026-11-01', object: 'Payroll Deposit', amount: 2500 },
    { id: 2, date: '2026-11-02', object: 'Coffee Shop', amount: -49.50 }
  ]
};

async function getDomSnapshot(page) {
  return page.evaluate(() => {
    const user = document.querySelector('#accountUser')?.textContent?.trim() || '';
    const balance = document.querySelector('#accountBalance')?.textContent?.trim() || '';
    const desc = document.querySelector('#accountDescription')?.textContent?.trim() || '';
    const rows = Array.from(document.querySelectorAll('#transactionsTable tbody tr')).map(row => {
      const cells = Array.from(row.querySelectorAll('td')).map(td => td.textContent?.trim());
      return cells;
    });
    return { user, balance, desc, rows };
  });
}

async function run() {
  const { server, url } = await startServer();
  let browser;

  const results = {
    task: 'R59-T015',
    target: url,
    timestamp: new Date().toISOString(),
    checks: []
  };

  try {
    browser = await chromium.launch({ headless: true });

    // Context 1
    const context1 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page1 = await context1.newPage();
    const page1Errors = [];
    page1.on('pageerror', (err) => page1Errors.push(err.message));

    await page1.goto(url, { waitUntil: 'domcontentloaded' });
    // Seed localStorage with deterministic fixture
    await page1.evaluate((data) => {
      localStorage.setItem('savedAccount', JSON.stringify(data));
      localStorage.setItem('accounts', JSON.stringify([data]));
    }, deterministicFixture);
    await page1.goto(`${url}/dashboard`, { waitUntil: 'load' });
    await page1.waitForTimeout(200);

    assert.equal(page1Errors.length, 0, `Context 1 page errors: ${page1Errors.join(', ')}`);
    const snapshot1 = await getDomSnapshot(page1);
    const screenshotPath = path.join(workDir, 'deterministic-dashboard.png');
    await page1.screenshot({ path: screenshotPath });

    // Context 2 (Completely fresh context)
    const context2 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page2 = await context2.newPage();
    const page2Errors = [];
    page2.on('pageerror', (err) => page2Errors.push(err.message));

    await page2.goto(url, { waitUntil: 'domcontentloaded' });
    await page2.evaluate((data) => {
      localStorage.setItem('savedAccount', JSON.stringify(data));
      localStorage.setItem('accounts', JSON.stringify([data]));
    }, deterministicFixture);
    await page2.goto(`${url}/dashboard`, { waitUntil: 'load' });
    await page2.waitForTimeout(200);

    assert.equal(page2Errors.length, 0, `Context 2 page errors: ${page2Errors.join(', ')}`);
    const snapshot2 = await getDomSnapshot(page2);

    // Strict assertion: snapshots must be strictly identical across both independent contexts
    assert.deepEqual(snapshot1, snapshot2, 'DOM states between two fresh browser contexts must be identical');
    results.checks.push({
      check: 'Deterministic DOM state across two fresh browser contexts',
      snapshot: snapshot1,
      status: 'PASS'
    });

    // Test Reset / Logout state transition: clearing storage returns to login
    await page2.evaluate(() => {
      localStorage.clear();
      history.pushState({ path: '/login' }, '', '/login');
      // trigger route update
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    await page2.waitForTimeout(200);

    const hasLogin = await page2.evaluate(() => !!document.querySelector('#loginHeading'));
    assert.ok(hasLogin, 'Clearing session state must restore login screen (#loginHeading)');
    results.checks.push({
      check: 'Reset / clearing session state restores login screen',
      status: 'PASS'
    });

    console.log('All deterministic browser state tests passed for R59-T015.');
    await context1.close();
    await context2.close();
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
  console.error('R59-T015 check failed:', err);
  process.exit(1);
});

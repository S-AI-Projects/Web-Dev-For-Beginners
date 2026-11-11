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
const workDir = path.join(rootDir, 'work', 'R59-T017');
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

async function run() {
  const { server, url } = await startServer();
  let browser;

  const results = {
    task: 'R59-T017',
    entryPoint: `${url}/login`,
    timestamp: new Date().toISOString(),
    walkthroughSteps: []
  };

  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();

    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    // Step 1: Open entry point /login
    await page.goto(`${url}/login`, { waitUntil: 'load' });
    await page.waitForTimeout(200);
    assert.equal(pageErrors.length, 0, `Page errors on load: ${pageErrors.join(', ')}`);

    // Verify anchors
    const initialAnchors = await page.evaluate(() => ({
      hasApp: !!document.querySelector('#app'),
      hasLogin: !!document.querySelector('#login'),
      hasLoginTitle: !!document.querySelector('#loginTitle'),
      hasLoginHeading: !!document.querySelector('#loginHeading')
    }));
    assert.ok(initialAnchors.hasApp, '#app mount point must exist');
    assert.ok(initialAnchors.hasLogin, '#login template must exist');
    assert.ok(initialAnchors.hasLoginTitle, '#loginTitle must be visible');
    assert.ok(initialAnchors.hasLoginHeading, '#loginHeading must be visible');
    results.walkthroughSteps.push({ step: 1, action: 'Initial entry point loaded', status: 'PASS' });

    // Step 2: Test unknown account login -> error state display
    await page.fill('#username', 'unknown_user_999');
    await page.click('#loginForm button[type="submit"]');
    await page.waitForTimeout(150);

    const errorMessage = await page.evaluate(() => document.querySelector('#loginError')?.textContent);
    assert.ok(
      errorMessage && errorMessage.length > 0,
      `Expected #loginError to display error message, got: "${errorMessage}"`
    );
    const screenshotError = path.join(workDir, 'login-error.png');
    await page.screenshot({ path: screenshotError });
    results.walkthroughSteps.push({
      step: 2,
      action: 'Submit invalid user and observe error display',
      errorMessage,
      screenshot: screenshotError,
      status: 'PASS'
    });

    // Step 3: Register a new account -> transition to dashboard with rendered data
    await page.fill('#user', 'test_learner');
    await page.fill('#currency', 'USD');
    await page.fill('#description', 'Student Savings Account');
    await page.fill('#current-balance', '750');
    await page.click('#registerForm button[type="submit"]');
    await page.waitForTimeout(300);

    // Verify transition to /dashboard
    const currentPath = await page.evaluate(() => window.location.pathname);
    assert.equal(currentPath, '/dashboard', `Expected navigation to /dashboard, got ${currentPath}`);

    // Verify rendered account data
    const renderedData = await page.evaluate(() => ({
      balance: (document.querySelector('#balance')?.textContent || '').trim(),
      desc: (document.querySelector('#description')?.textContent || document.querySelector('#account-info')?.textContent || '').trim(),
      hasTransactionsTable: !!document.querySelector('#transactions')
    }));
    assert.ok(renderedData.balance.includes('750'), `Rendered balance should reflect 750, got "${renderedData.balance}"`);
    assert.ok(renderedData.hasTransactionsTable, 'Transactions container must exist');

    const screenshotDashboard = path.join(workDir, 'dashboard-data.png');
    await page.screenshot({ path: screenshotDashboard });
    results.walkthroughSteps.push({
      step: 3,
      action: 'Register account and observe dashboard data rendering',
      renderedData,
      screenshot: screenshotDashboard,
      status: 'PASS'
    });

    console.log('All walkthrough checks passed for R59-T017.');
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
  console.error('R59-T017 check failed:', err);
  process.exit(1);
});

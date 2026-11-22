import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../..');

const serveRoot = process.env.R59_SERVE_ROOT
  ? path.resolve(process.env.R59_SERVE_ROOT)
  : REPO_ROOT;
const label = process.env.R59_LABEL || 'changed';
const evidenceDir = path.join(REPO_ROOT, 'work', 'R59-T027');

const ALLOWED_404_URL = 'assets/fontawesome/css/all.min.css';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

function sanitizePath(baseDir, requestUrl) {
  const parsedPath = requestUrl.split('?')[0];
  const decoded = decodeURIComponent(parsedPath);
  const normalized = path.normalize(decoded);
  const resolved = path.join(baseDir, normalized);
  if (!resolved.startsWith(baseDir)) {
    return null;
  }
  return resolved;
}

function resolveFile(baseDir, reqUrl) {
  const directPath = sanitizePath(baseDir, reqUrl);
  if (!directPath) return { error: 403 };
  if (fs.existsSync(directPath) && fs.statSync(directPath).isFile()) {
    return { filePath: directPath };
  }
  if (fs.existsSync(directPath) && fs.statSync(directPath).isDirectory()) {
    const indexPath = path.join(directPath, 'index.html');
    if (fs.existsSync(indexPath)) return { filePath: indexPath };
  }

  // SPA fallback resolution for 7-bank-project assets & routes
  const bankDir = path.join(baseDir, '7-bank-project', 'solution');
  const bankAssetPath = sanitizePath(bankDir, reqUrl);
  if (bankAssetPath && fs.existsSync(bankAssetPath) && fs.statSync(bankAssetPath).isFile()) {
    return { filePath: bankAssetPath };
  }

  const cleanUrl = reqUrl.split('?')[0];
  if (cleanUrl === '/' || cleanUrl === '/login' || cleanUrl === '/dashboard') {
    const bankIndex = path.join(bankDir, 'index.html');
    if (fs.existsSync(bankIndex)) {
      return { filePath: bankIndex };
    }
  }

  return { error: 404 };
}

function createStaticServer(root) {
  return http.createServer((req, res) => {
    try {
      const { filePath, error } = resolveFile(root, req.url || '/');
      if (error === 403) {
        res.writeHead(403, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' });
        res.end('403 Forbidden');
        return;
      }
      if (error === 404 || !filePath) {
        res.writeHead(404, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' });
        res.end('404 Not Found');
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      const stats = fs.statSync(filePath);
      res.writeHead(200, {
        'Content-Type': contentType,
        'Content-Length': stats.size,
        'Cache-Control': 'no-store'
      });
      fs.createReadStream(filePath).pipe(res);
    } catch {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('500 Internal Server Error');
    }
  });
}

async function waitForServer(url, timeoutMs = 5000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // retry
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Server at ${url} did not respond within ${timeoutMs}ms`);
}

async function main() {
  fs.mkdirSync(evidenceDir, { recursive: true });

  const server = createStaticServer(serveRoot);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;
  const bankUrl = `${baseUrl}/7-bank-project/solution/index.html`;
  const companionUrl = `${baseUrl}/7-bank-project/1-template-route/companion.html`;

  await waitForServer(bankUrl);

  const browser = await chromium.launch({ headless: true });
  const browserVersion = browser.version();

  const results = [];
  const stubbedRequests = [];
  const capturedErrors = [];
  const allowlistedErrors = [];

  function recordResult(name, expected, actual, pass) {
    results.push({ name, expected, actual, pass });
    const mark = pass ? '[PASS]' : '[FAIL]';
    console.log(`${mark} ${name} (expected: ${JSON.stringify(expected)}, actual: ${JSON.stringify(actual)})`);
  }

  try {
    const baseContextOptions = {
      viewport: { width: 1280, height: 800 },
      locale: 'en-US',
      timezoneId: 'UTC',
      colorScheme: 'light',
      reducedMotion: 'no-preference',
      serviceWorkers: 'block'
    };

    function attachListeners(page) {
      page.on('pageerror', (err) => {
        capturedErrors.push({ type: 'pageerror', message: err.message });
      });

      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          const text = msg.text();
          const locationUrl = msg.location()?.url || '';
          if (locationUrl.includes(ALLOWED_404_URL) || (text.includes('404') && text.includes('Failed to load resource'))) {
            allowlistedErrors.push({
              type: 'console-allowlisted-404',
              text,
              locationUrl,
              reason: 'pre-existing missing fontawesome stylesheet in 7-bank-project/solution/index.html'
            });
          } else {
            capturedErrors.push({ type: 'console', message: text });
          }
        }
      });

      page.on('requestfailed', (req) => {
        const reqUrl = req.url();
        if (reqUrl.includes(ALLOWED_404_URL)) {
          allowlistedErrors.push({ type: 'requestfailed-allowlisted', url: reqUrl, reason: 'pre-existing missing fontawesome' });
        } else if (reqUrl.startsWith(baseUrl)) {
          capturedErrors.push({ type: 'requestfailed', url: reqUrl });
        }
      });

      page.on('response', (res) => {
        const resUrl = res.url();
        if (resUrl.includes(ALLOWED_404_URL) && res.status() === 404) {
          allowlistedErrors.push({ type: 'response-allowlisted-404', url: resUrl, reason: 'pre-existing missing fontawesome' });
        } else if (resUrl.startsWith(baseUrl) && res.status() >= 400) {
          capturedErrors.push({ type: 'response>=400', url: resUrl, status: res.status() });
        }
      });
    }

    // --- STEP 1: Verify Bank Solution Source Anchors & Routing ---
    const bankContext = await browser.newContext(baseContextOptions);

    // Seed account with XSS payload in description and transaction object
    const xssPayload = '<img src=x onerror="window.__xssPayloadFired=true">';
    const txXssPayload = '<img src=x onerror="window.__txXssFired=true">';

    await bankContext.addInitScript(({ xss, txXss }) => {
      const testAccount = {
        user: 'safeUser',
        currency: 'USD',
        description: xss,
        balance: 250,
        transactions: [
          {
            id: 'tx-001',
            date: '2025-01-15',
            object: txXss,
            amount: 50
          }
        ]
      };
      localStorage.setItem('accounts', JSON.stringify([testAccount]));
      localStorage.setItem('savedAccount', JSON.stringify(testAccount));
    }, { xss: xssPayload, txXss: txXssPayload });

    const bankPage = await bankContext.newPage();
    attachListeners(bankPage);

    await bankPage.goto(bankUrl, { waitUntil: 'load' });

    // 1a. Source Anchors check
    const anchorApp = await bankPage.$('#app');
    const anchorLoginTmpl = await bankPage.$('template#login');
    const hasLoginTitle = await bankPage.evaluate(() => {
      const tmpl = document.getElementById('login');
      return tmpl ? Boolean(tmpl.content.querySelector('#loginTitle')) : false;
    });
    const hasLoginHeading = await bankPage.evaluate(() => {
      const tmpl = document.getElementById('login');
      return tmpl ? Boolean(tmpl.content.querySelector('#loginHeading')) : false;
    });

    recordResult('source_anchor_app_exists', true, Boolean(anchorApp), Boolean(anchorApp));
    recordResult('source_anchor_login_template_exists', true, Boolean(anchorLoginTmpl), Boolean(anchorLoginTmpl));
    recordResult('source_anchor_loginTitle_exists', true, hasLoginTitle, hasLoginTitle);
    recordResult('source_anchor_loginHeading_exists', true, hasLoginHeading, hasLoginHeading);

    // 1b. Wait for async refresh() to populate account data in Dashboard
    await bankPage.waitForFunction((expectedPayload) => {
      const descEl = document.getElementById('description') || document.getElementById('transactions-description');
      return descEl && descEl.textContent.includes(expectedPayload);
    }, xssPayload, { timeout: 5000 });

    const safeTextResult = await bankPage.evaluate(({ expectedPayload, expectedTxPayload }) => {
      const descEl = document.getElementById('description') || document.getElementById('transactions-description');
      const descText = descEl ? descEl.textContent : '';
      const descImgs = descEl ? descEl.querySelectorAll('img').length : 0;

      const txTable = document.getElementById('transactions');
      const txText = txTable ? txTable.textContent : '';
      const txImgs = txTable ? txTable.querySelectorAll('img').length : 0;

      return {
        descMatchesLiteralText: descText.includes(expectedPayload),
        descInjectedImgCount: descImgs,
        txMatchesLiteralText: txText.includes(expectedTxPayload),
        txInjectedImgCount: txImgs,
        xssExecuted: Boolean(window.__xssPayloadFired || window.__txXssFired)
      };
    }, { expectedPayload: xssPayload, expectedTxPayload: txXssPayload });

    recordResult(
      'solution_safe_text_rendering_no_script_execution',
      {
        descMatchesLiteralText: true,
        descInjectedImgCount: 0,
        txMatchesLiteralText: true,
        txInjectedImgCount: 0,
        xssExecuted: false
      },
      safeTextResult,
      safeTextResult.descMatchesLiteralText &&
        safeTextResult.descInjectedImgCount === 0 &&
        safeTextResult.txMatchesLiteralText &&
        safeTextResult.txInjectedImgCount === 0 &&
        !safeTextResult.xssExecuted
    );

    // 1c. Route change test: navigate to /login and verify route change
    await bankPage.evaluate(() => {
      if (typeof window.navigate === 'function') {
        window.navigate('/login');
      } else {
        window.location.pathname = '/login';
      }
    });

    await bankPage.waitForSelector('#loginForm');
    const loginRendered = await bankPage.$eval('#loginForm', (el) => Boolean(el));
    recordResult('route_change_to_login_successful', true, loginRendered, loginRendered);

    await bankPage.screenshot({
      path: path.join(evidenceDir, 'bank-solution.png')
    });
    await bankContext.close();

    // --- STEP 2: Companion Safe Text & 404 Route Not-Found Verification ---
    const companionContext = await browser.newContext(baseContextOptions);
    const companionPage = await companionContext.newPage();
    attachListeners(companionPage);

    await companionPage.goto(companionUrl, { waitUntil: 'load' });

    // 2a. Verify default route rendered
    const defaultViewExists = await companionPage.$eval('#view-login', (el) => Boolean(el)).catch(() => false);
    recordResult('companion_default_view_rendered', true, defaultViewExists, defaultViewExists);

    // 2b. Test route transition via navigation links
    await companionPage.click('#link-dashboard');
    await companionPage.waitForSelector('#view-dashboard');
    const dashboardViewExists = await companionPage.$eval('#view-dashboard', (el) => Boolean(el));
    recordResult('companion_route_transition_works', true, dashboardViewExists, dashboardViewExists);

    // 2c. Test Not-Found view with XSS payload in URL route
    const notFoundXss = '<img src=x onerror="window.__notFoundXssFired=true">';
    await companionPage.evaluate((payload) => {
      window.location.hash = `#/unknown/${payload}`;
    }, notFoundXss);

    await companionPage.waitForSelector('#view-not-found');
    const notFoundResult = await companionPage.evaluate((expectedPayload) => {
      const pathEl = document.getElementById('requested-path');
      const text = pathEl ? pathEl.textContent : '';
      const imgs = pathEl ? pathEl.querySelectorAll('img').length : 0;
      return {
        pathContainsPayload: text.includes(expectedPayload),
        injectedImgCount: imgs,
        scriptExecuted: Boolean(window.__notFoundXssFired)
      };
    }, notFoundXss);

    recordResult(
      'not_found_view_safe_text_rendering',
      { pathContainsPayload: true, injectedImgCount: 0, scriptExecuted: false },
      notFoundResult,
      notFoundResult.pathContainsPayload && notFoundResult.injectedImgCount === 0 && !notFoundResult.scriptExecuted
    );

    // 2d. Test "Go to Login" navigation from 404 view
    await companionPage.click('#btn-go-home');
    await companionPage.waitForSelector('#view-login');
    const returnedToLogin = await companionPage.$eval('#view-login', (el) => Boolean(el));
    recordResult('not_found_go_home_navigation_works', true, returnedToLogin, returnedToLogin);

    await companionPage.screenshot({
      path: path.join(evidenceDir, 'companion-not-found.png')
    });
    await companionContext.close();

    // --- STEP 3: Error Policy ---
    recordResult(
      'zero_unexpected_page_errors',
      [],
      capturedErrors,
      capturedErrors.length === 0
    );
  } finally {
    await browser.close();
    await new Promise((resolve) => {
      server.closeAllConnections?.();
      server.close(resolve);
    });

    const totalPassed = results.filter((r) => r.pass).length;
    const totalFailed = results.filter((r) => !r.pass).length;

    const summary = {
      task: 'R59-T027',
      label,
      page: '7-bank-project/solution/index.html',
      companion: '7-bank-project/1-template-route/companion.html',
      url: bankUrl,
      viewports: [{ width: 1280, height: 800 }],
      versions: {
        node: process.version,
        playwright: '1.65.1',
        chromium: browserVersion
      },
      stubbedRequests: Array.from(new Set(stubbedRequests)),
      allowlistedErrors,
      capturedErrors,
      results,
      passed: totalPassed,
      failed: totalFailed
    };

    const outJsonPath = path.join(evidenceDir, `results-${label}.json`);
    fs.writeFileSync(outJsonPath, JSON.stringify(summary, null, 2), 'utf8');

    const outTxtPath = path.join(evidenceDir, `${label}-output.txt`);
    const logLines = results.map(
      (r) => `${r.pass ? '[PASS]' : '[FAIL]'} ${r.name}`
    );
    logLines.push(`Total: ${results.length}, Passed: ${totalPassed}, Failed: ${totalFailed}`);
    fs.writeFileSync(outTxtPath, logLines.join('\n') + '\n', 'utf8');

    if (totalFailed > 0 || results.length === 0) {
      process.exitCode = 1;
    } else {
      process.exitCode = 0;
    }
  }
}

main().catch((err) => {
  console.error('Unhandled test runner error:', err);
  process.exit(1);
});

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultRootDir = path.resolve(__dirname, '../..');
const serveRootDir = process.env.R59_SERVE_ROOT
  ? path.resolve(process.env.R59_SERVE_ROOT)
  : defaultRootDir;
const runLabel = process.env.R59_LABEL || 'changed';
const taskDir = path.join(defaultRootDir, 'work', 'R59-T021');

fs.mkdirSync(taskDir, { recursive: true });

const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.mjs': 'application/javascript; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.json': 'application/json; charset=UTF-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.ico': 'image/x-icon'
};

const ALLOWLISTED_ERRORS = [
  {
    urlPath: '/7-bank-project/solution/assets/fontawesome/css/all.min.css',
    status: 404,
    reason: 'Pre-existing missing fontawesome stylesheet in 7-bank-project/solution/index.html'
  }
];

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
  if (cleanUrl === '/' || cleanUrl === '/login' || cleanUrl === '/dashboard' || cleanUrl === '/unknown') {
    const bankIndex = path.join(bankDir, 'index.html');
    if (fs.existsSync(bankIndex)) {
      return { filePath: bankIndex };
    }
  }

  return { error: 404 };
}

function startStaticServer(baseDir) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const { filePath, error } = resolveFile(baseDir, req.url || '/');
      if (error === 403) {
        res.writeHead(403, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' });
        res.end('Forbidden');
        return;
      }
      if (error === 404 || !filePath) {
        res.writeHead(404, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' });
        res.end('Not Found');
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-store'
      });
      fs.createReadStream(filePath).pipe(res);
    });

    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      resolve({ server, port });
    });
    server.on('error', reject);
  });
}

async function waitForServerReady(url, maxAttempts = 50, delayMs = 100) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(url);
      if (res.status === 200) return;
    } catch {
      // retry
    }
    await new Promise(r => setTimeout(r, delayMs));
  }
  throw new Error(`Server failed to respond at ${url} within readiness timeout`);
}

async function main() {
  const { server, port } = await startStaticServer(serveRootDir);
  const baseUrl = `http://127.0.0.1:${port}`;
  const targetPagePath = '/7-bank-project/solution/index.html';
  const targetUrl = `${baseUrl}${targetPagePath}`;

  const assertionResults = [];
  const stubbedRequests = [];
  const recordedErrors = [];
  const logLines = [];

  function recordAssertion(name, expected, actual, pass) {
    const item = { name, expected, actual, pass: Boolean(pass) };
    assertionResults.push(item);
    const mark = item.pass ? 'PASS' : 'FAIL';
    const line = `[${mark}] ${name} (expected: ${JSON.stringify(expected)}, actual: ${JSON.stringify(actual)})`;
    logLines.push(line);
    console.log(line);
  }

  let browser;
  try {
    await waitForServerReady(targetUrl);

    browser = await chromium.launch({ headless: true });
    const browserVersion = browser.version();

    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      locale: 'en-US',
      timezoneId: 'UTC',
      colorScheme: 'light',
      reducedMotion: 'no-preference',
      serviceWorkers: 'block'
    });

    // Deterministic state fixture: seed valid account for authentication regression
    await context.addInitScript(() => {
      const fixtureAccount = {
        user: 'alice',
        currency: 'USD',
        description: 'Test Account',
        balance: 1000,
        transactions: []
      };
      localStorage.setItem('accounts', JSON.stringify([fixtureAccount]));
      localStorage.setItem('schemaVersion', '1');
    });

    // Offline determinism: continue local, stub external
    await context.route('**/*', (route) => {
      const reqUrl = route.request().url();
      if (reqUrl.startsWith(baseUrl)) {
        return route.continue();
      }
      stubbedRequests.push(reqUrl);
      const reqType = route.request().resourceType();
      let contentType = 'text/plain';
      if (reqType === 'stylesheet') contentType = 'text/css';
      else if (reqType === 'script') contentType = 'application/javascript';
      else if (reqType === 'image') contentType = 'image/png';
      else if (reqType === 'font') contentType = 'font/woff2';

      return route.fulfill({
        status: 200,
        contentType,
        body: ''
      });
    });

    const page = await context.newPage();

    // Error policy listeners
    page.on('pageerror', err => {
      recordedErrors.push({ type: 'pageerror', message: err.message, stack: err.stack });
    });
    page.on('console', msg => {
      if (msg.type() === 'error') {
        recordedErrors.push({ type: 'console-error', text: msg.text() });
      }
    });
    page.on('requestfailed', req => {
      const url = req.url();
      if (url.startsWith(baseUrl)) {
        recordedErrors.push({
          type: 'requestfailed',
          url,
          failure: req.failure()?.errorText || 'unknown'
        });
      }
    });
    page.on('response', res => {
      const url = res.url();
      if (url.startsWith(baseUrl) && res.status() >= 400) {
        const urlObj = new URL(url);
        recordedErrors.push({
          type: 'http-error',
          url: urlObj.pathname,
          status: res.status()
        });
      }
    });

    // 1. Initial Page Load
    await page.goto(targetUrl);
    await page.waitForSelector('#app');
    await page.waitForSelector('#loginForm');

    // Assertion 1: No positive tabindex
    const positiveTabindexElements = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('[tabindex]'))
        .filter(el => {
          const val = parseInt(el.getAttribute('tabindex') || '0', 10);
          return val > 0;
        })
        .map(el => ({ tag: el.tagName, id: el.id, tabindex: el.getAttribute('tabindex') }));
    });
    recordAssertion(
      'no_positive_tabindex',
      [],
      positiveTabindexElements,
      positiveTabindexElements.length === 0
    );

    // Assertion 2: Required anchors exist
    const anchorData = await page.evaluate(() => {
      const app = document.getElementById('app');
      const loginTpl = document.getElementById('login');
      const loginTitle = document.getElementById('loginTitle');
      const loginHeading = document.getElementById('loginHeading');
      return {
        hasApp: Boolean(app),
        hasLoginTemplate: Boolean(loginTpl),
        loginTitleText: loginTitle ? loginTitle.textContent.replace(/\s+/g, ' ').trim() : null,
        loginHeadingText: loginHeading ? loginHeading.textContent.replace(/\s+/g, ' ').trim() : null
      };
    });
    recordAssertion('source_anchor_app_exists', true, anchorData.hasApp, anchorData.hasApp);
    recordAssertion('source_anchor_login_template_exists', true, anchorData.hasLoginTemplate, anchorData.hasLoginTemplate);
    recordAssertion('source_anchor_loginTitle', 'Squirrel Banking', anchorData.loginTitleText, anchorData.loginTitleText === 'Squirrel Banking');
    recordAssertion('source_anchor_loginHeading', 'Login', anchorData.loginHeadingText, anchorData.loginHeadingText === 'Login');

    // Helper to inspect active element
    async function getActiveElementInfo() {
      return page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return null;
        const style = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return {
          tagName: el.tagName.toLowerCase(),
          id: el.id || '',
          name: el.getAttribute('name') || '',
          type: el.getAttribute('type') || '',
          outlineWidth: parseFloat(style.outlineWidth) || 0,
          outlineStyle: style.outlineStyle,
          outlineColor: style.outlineColor,
          boxShadow: style.boxShadow,
          borderColor: style.borderColor,
          width: rect.width,
          height: rect.height,
          isInViewport: rect.width > 0 && rect.height > 0
        };
      });
    }

    // Assertion 3 & 4: Forward Tab Traversal & Focus Visibility on Login View
    const expectedControls = [
      { id: 'username', tag: 'input', role: 'login-username' },
      { id: '', tag: 'button', text: 'Login', role: 'login-submit' },
      { id: 'user', tag: 'input', role: 'register-user' },
      { id: 'currency', tag: 'input', role: 'register-currency' },
      { id: 'description', tag: 'input', role: 'register-description' },
      { id: 'current-balance', tag: 'input', role: 'register-balance' },
      { id: '', tag: 'button', text: 'Register', role: 'register-submit' }
    ];

    const observedControls = [];
    const focusVisibilityChecks = [];

    for (let i = 0; i < expectedControls.length; i++) {
      await page.keyboard.press('Tab');
      const active = await getActiveElementInfo();
      observedControls.push(active);

      const hasVisibleOutline = active && active.outlineStyle !== 'none' && active.outlineWidth > 0;
      const hasVisibleBoxShadow = active && active.boxShadow && active.boxShadow !== 'none';
      const isVisible = Boolean(active && (hasVisibleOutline || hasVisibleBoxShadow) && active.isInViewport);
      focusVisibilityChecks.push({
        step: i + 1,
        controlId: active?.id || active?.tagName,
        hasVisibleOutline,
        hasVisibleBoxShadow,
        isVisible
      });
    }

    const traversalMatched = observedControls.every((ctrl, idx) => {
      if (!ctrl) return false;
      const exp = expectedControls[idx];
      if (exp.id && ctrl.id !== exp.id) return false;
      if (ctrl.tagName !== exp.tag) return false;
      return true;
    });

    recordAssertion(
      'login_tab_traversal_forward',
      expectedControls.map(c => `${c.tag}#${c.id}`),
      observedControls.map(c => `${c?.tagName}#${c?.id}`),
      traversalMatched
    );

    const allFocusVisible = focusVisibilityChecks.every(c => c.isVisible);
    recordAssertion(
      'login_controls_visible_focus',
      true,
      allFocusVisible,
      allFocusVisible
    );

    // Save screenshot of focused controls on login
    await page.screenshot({ path: path.join(taskDir, 'login-focused.png') });

    // Assertion 5: Shift+Tab Reverse Traversal
    for (let i = 0; i < expectedControls.length - 1; i++) {
      await page.keyboard.press('Shift+Tab');
    }
    const reversedActive = await getActiveElementInfo();
    recordAssertion(
      'login_tab_traversal_reverse',
      'username',
      reversedActive?.id,
      reversedActive?.id === 'username'
    );

    // Assertion 6: Keyboard Login Activation & Route Change to /dashboard
    // Focus is on #username. Type 'alice', press Tab to Login button, and press Enter
    await page.keyboard.type('alice');
    await page.keyboard.press('Tab'); // focus Login button
    await page.keyboard.press('Enter'); // submit login

    await page.waitForFunction(() => window.location.pathname === '/dashboard');
    await page.waitForSelector('.dash-header');

    const currentPathAfterLogin = await page.evaluate(() => window.location.pathname);
    recordAssertion(
      'keyboard_login_route_change_to_dashboard',
      '/dashboard',
      currentPathAfterLogin,
      currentPathAfterLogin === '/dashboard'
    );

    // Assertion 7: Dashboard Tab Traversal & Focus Visibility
    const dashControls = [];
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press('Tab');
      const active = await getActiveElementInfo();
      if (active) dashControls.push(active);
    }
    const themeToggleFocused = dashControls.some(c => c.id === 'themeToggle');
    const hasLogoutButton = dashControls.some(c => c.tagName === 'button');
    recordAssertion(
      'dashboard_controls_reachable_via_tab',
      true,
      themeToggleFocused && hasLogoutButton,
      themeToggleFocused && hasLogoutButton
    );

    await page.screenshot({ path: path.join(taskDir, 'dashboard-focused.png') });

    // Assertion 8: Keyboard Logout & Route Change back to /login
    await page.evaluate(() => {
      const logoutBtn = document.querySelector('button[onclick="logout()"]');
      if (logoutBtn) logoutBtn.focus();
    });
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.location.pathname === '/login');
    const pathAfterLogout = await page.evaluate(() => window.location.pathname);
    recordAssertion(
      'keyboard_logout_route_change_to_login',
      '/login',
      pathAfterLogout,
      pathAfterLogout === '/login'
    );

    // Assertion 9: Unknown route fallback handling
    await page.evaluate(() => {
      window.navigate('/unknown');
    });
    await page.waitForTimeout(200);
    const resolvedPath = await page.evaluate(() => window.location.pathname);
    const validFallback = resolvedPath === '/login' || resolvedPath === '/dashboard';
    recordAssertion(
      'unknown_route_fallback_handling',
      true,
      validFallback,
      validFallback
    );

    // Assertion 10: Error Policy Check
    const unexpectedErrors = recordedErrors.filter(err => {
      if (err.type === 'http-error') {
        const allowed = ALLOWLISTED_ERRORS.some(
          a => a.urlPath === err.url && a.status === err.status
        );
        if (allowed) return false;
      }
      if (err.type === 'requestfailed') {
        const allowed = ALLOWLISTED_ERRORS.some(
          a => err.url.includes(a.urlPath)
        );
        if (allowed) return false;
      }
      if (err.type === 'console-error') {
        if (err.text.includes('404') && err.text.includes('Failed to load resource')) {
          return false;
        }
      }
      return true;
    });

    recordAssertion(
      'zero_unexpected_page_errors',
      [],
      unexpectedErrors,
      unexpectedErrors.length === 0
    );

    // Write results JSON
    const passedCount = assertionResults.filter(r => r.pass).length;
    const failedCount = assertionResults.filter(r => !r.pass).length;

    const evidenceOutput = {
      task: 'R59-T021',
      label: runLabel,
      page: '7-bank-project/solution/index.html',
      url: targetUrl,
      viewports: [{ width: 1280, height: 800 }],
      versions: {
        node: process.version,
        playwright: '1.65.1',
        chromium: browserVersion
      },
      stubbedRequests,
      allowlistedErrors: ALLOWLISTED_ERRORS,
      results: assertionResults,
      passed: passedCount,
      failed: failedCount
    };

    fs.writeFileSync(
      path.join(taskDir, `results-${runLabel}.json`),
      JSON.stringify(evidenceOutput, null, 2),
      'utf8'
    );

    fs.writeFileSync(
      path.join(taskDir, `${runLabel}-output.txt`),
      logLines.join('\n') + `\n\nTotal: ${assertionResults.length}, Passed: ${passedCount}, Failed: ${failedCount}\n`,
      'utf8'
    );

    if (failedCount > 0 || assertionResults.length === 0) {
      process.exitCode = 1;
    } else {
      process.exitCode = 0;
    }
  } catch (err) {
    console.error('Fatal error during test execution:', err);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    server.closeAllConnections?.();
    server.close();
  }
}

main().catch(err => {
  console.error('Unhandled top-level error:', err);
  process.exit(1);
});

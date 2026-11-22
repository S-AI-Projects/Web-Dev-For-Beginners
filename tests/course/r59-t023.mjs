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
const taskDir = path.join(defaultRootDir, 'work', 'R59-T023');

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

  // Fallback for extension assets
  const distDir = path.join(baseDir, '5-browser-extension', 'start', 'dist');
  const distAsset = sanitizePath(distDir, reqUrl);
  if (distAsset && fs.existsSync(distAsset) && fs.statSync(distAsset).isFile()) {
    return { filePath: distAsset };
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
  const popupPagePath = '/5-browser-extension/start/dist/index.html';
  const popupUrl = `${baseUrl}${popupPagePath}`;
  const harnessPagePath = '/5-browser-extension/1-about-browsers/harness.html';
  const harnessUrl = `${baseUrl}${harnessPagePath}`;

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
    await waitForServerReady(popupUrl);

    browser = await chromium.launch({ headless: true });
    const browserVersion = browser.version();

    const context = await browser.newContext({
      viewport: { width: 450, height: 600 },
      locale: 'en-US',
      timezoneId: 'UTC',
      colorScheme: 'light',
      reducedMotion: 'no-preference',
      serviceWorkers: 'block'
    });

    // Lifecycle instrumentation and browser extension API stubs
    await context.addInitScript(() => {
      window.__r59Tracker = {
        listenerCalls: [],
        activeListenerCount: 0,
        activeIntervals: new Set(),
        activeTimeouts: new Set()
      };

      const origAdd = EventTarget.prototype.addEventListener;
      const origRemove = EventTarget.prototype.removeEventListener;

      EventTarget.prototype.addEventListener = function(type, fn, opts) {
        window.__r59Tracker.listenerCalls.push({ target: this === window ? 'window' : this === document ? 'document' : (this.id || this.tagName), type, fn });
        window.__r59Tracker.activeListenerCount++;
        return origAdd.call(this, type, fn, opts);
      };

      EventTarget.prototype.removeEventListener = function(type, fn, opts) {
        window.__r59Tracker.activeListenerCount = Math.max(0, window.__r59Tracker.activeListenerCount - 1);
        return origRemove.call(this, type, fn, opts);
      };

      const origSetInt = window.setInterval;
      const origClearInt = window.clearInterval;

      window.setInterval = function(fn, ms, ...args) {
        const id = origSetInt.call(window, fn, ms, ...args);
        window.__r59Tracker.activeIntervals.add(id);
        return id;
      };

      window.clearInterval = function(id) {
        window.__r59Tracker.activeIntervals.delete(id);
        return origClearInt.call(window, id);
      };

      const origSetTimeout = window.setTimeout;
      const origClearTimeout = window.clearTimeout;

      window.setTimeout = function(fn, ms, ...args) {
        const id = origSetTimeout.call(window, (...a) => {
          window.__r59Tracker.activeTimeouts.delete(id);
          fn?.(...a);
        }, ms, ...args);
        window.__r59Tracker.activeTimeouts.add(id);
        return id;
      };

      window.clearTimeout = function(id) {
        window.__r59Tracker.activeTimeouts.delete(id);
        return origClearTimeout.call(window, id);
      };

      // Stub extension context assumptions
      window.chrome = {
        runtime: {
          id: 'carbon-trigger-extension',
          getURL: (p) => `chrome-extension://carbon-trigger-extension/${p}`,
          sendMessage: (msg, cb) => cb?.({ ok: true })
        },
        storage: {
          local: {
            get: (keys, cb) => cb?.({}),
            set: (data, cb) => cb?.()
          }
        }
      };
    });

    // Offline determinism
    await context.route('**/*', (route) => {
      const reqUrl = route.request().url();
      if (reqUrl.startsWith(baseUrl)) {
        return route.continue();
      }
      stubbedRequests.push(reqUrl);
      return route.fulfill({ status: 200, contentType: 'text/plain', body: '' });
    });

    const page = await context.newPage();

    page.on('pageerror', err => {
      recordedErrors.push({ type: 'pageerror', message: err.message });
    });
    page.on('console', msg => {
      if (msg.type() === 'error') {
        recordedErrors.push({ type: 'console-error', text: msg.text() });
      }
    });
    page.on('requestfailed', req => {
      if (req.url().startsWith(baseUrl)) {
        recordedErrors.push({ type: 'requestfailed', url: req.url() });
      }
    });

    // --- SCENARIO 1: Primary Popup Skeleton (5-browser-extension/start/dist/index.html) ---
    await page.goto(popupUrl);
    await page.waitForSelector('img');

    // Assertion 1: Source anchor img exists with correct attributes
    const imgData = await page.evaluate(() => {
      const img = document.querySelector('img');
      return {
        exists: Boolean(img),
        src: img ? img.getAttribute('src') : null,
        alt: img ? img.getAttribute('alt') : null,
        naturalWidth: img ? img.naturalWidth : 0,
        naturalHeight: img ? img.naturalHeight : 0,
        visible: Boolean(img && img.offsetWidth > 0 && img.offsetHeight > 0)
      };
    });
    recordAssertion(
      'source_anchor_img_exists',
      { exists: true, src: 'images/plants-people.png', alt: 'plants and people' },
      { exists: imgData.exists, src: imgData.src, alt: imgData.alt },
      imgData.exists && imgData.src === 'images/plants-people.png' && imgData.alt === 'plants and people'
    );

    // Assertion 2: Source anchor img is rendered and visible
    recordAssertion(
      'source_anchor_img_visible',
      true,
      imgData.visible && imgData.naturalWidth > 0,
      imgData.visible && imgData.naturalWidth > 0
    );

    // Assertion 3: Browser extension context assumptions stubbed
    const extensionContextOk = await page.evaluate(() => {
      return Boolean(window.chrome && window.chrome.runtime && window.chrome.storage);
    });
    recordAssertion('extension_context_stubbed', true, extensionContextOk, extensionContextOk);

    // Capture initial popup screenshot
    await page.screenshot({ path: path.join(taskDir, 'popup-initial.png') });

    // Assertion 4: Static popup node stability on repeat reload
    await page.reload();
    await page.waitForSelector('img');
    const nodeCountsAfterReload = await page.evaluate(() => {
      return {
        imgCount: document.querySelectorAll('img').length,
        h1Count: document.querySelectorAll('h1').length
      };
    });
    recordAssertion(
      'static_popup_node_stability_on_reload',
      { imgCount: 1, h1Count: 1 },
      nodeCountsAfterReload,
      nodeCountsAfterReload.imgCount === 1 && nodeCountsAfterReload.h1Count === 1
    );

    // --- SCENARIO 2: Isolated Lifecycle Harness (5-browser-extension/1-about-browsers/harness.html) ---
    // If harness exists, test repeat initialization, idempotence, and teardown
    let harnessExists = false;
    try {
      const res = await fetch(harnessUrl);
      harnessExists = res.status === 200;
    } catch {
      harnessExists = false;
    }

    if (harnessExists) {
      await page.goto(harnessUrl);
      await page.waitForSelector('#status-container');

      // Initialize twice to test repeat initialization
      const initResult = await page.evaluate(() => {
        const first = window.initPopup ? window.initPopup() : null;
        const second = window.initPopup ? window.initPopup() : null;
        const badgeCount = document.querySelectorAll('#popup-status').length;
        const btnListeners = window.__r59Tracker.listenerCalls.filter(c => c.target === 'toggle-theme-btn' && c.type === 'click');
        const intervalCount = window.__r59Tracker.activeIntervals.size;

        return {
          first,
          second,
          badgeCount,
          btnListenerCount: btnListeners.length,
          intervalCount
        };
      });

      // Assertion 5: Exactly one DOM update on repeat initialization
      recordAssertion(
        'harness_single_dom_update_on_repeat_init',
        1,
        initResult.badgeCount,
        initResult.badgeCount === 1
      );

      // Assertion 6: No duplicate event listener attachments
      recordAssertion(
        'harness_no_duplicate_listeners',
        1,
        initResult.btnListenerCount,
        initResult.btnListenerCount === 1
      );

      // Assertion 7: No duplicate timers created
      recordAssertion(
        'harness_no_duplicate_timers',
        1,
        initResult.intervalCount,
        initResult.intervalCount <= 1
      );

      // Assertion 8: Repeated interactive toggle operates cleanly
      const toggleCheck = await page.evaluate(() => {
        window.toggleDemo?.();
        const dark1 = document.body.classList.contains('theme-dark');
        window.toggleDemo?.();
        const dark2 = document.body.classList.contains('theme-dark');
        return { darkAfterFirstToggle: dark1, darkAfterSecondToggle: dark2 };
      });
      recordAssertion(
        'harness_repeated_toggle_stability',
        { darkAfterFirstToggle: true, darkAfterSecondToggle: false },
        toggleCheck,
        toggleCheck.darkAfterFirstToggle === true && toggleCheck.darkAfterSecondToggle === false
      );

      // Capture toggled screenshot
      await page.screenshot({ path: path.join(taskDir, 'harness-toggled.png') });

      // Assertion 9: Cleanup leaves zero active test-created listeners or timers
      const cleanupResult = await page.evaluate(() => {
        window.destroyPopup?.();
        return {
          activeIntervalCount: window.__r59Tracker.activeIntervals.size,
          activeTimeoutCount: window.__r59Tracker.activeTimeouts.size
        };
      });
      recordAssertion(
        'harness_cleanup_leaves_zero_leaks',
        { activeIntervalCount: 0, activeTimeoutCount: 0 },
        cleanupResult,
        cleanupResult.activeIntervalCount === 0 && cleanupResult.activeTimeoutCount === 0
      );
    } else {
      // Baseline / initial state where harness does not exist yet
      recordAssertion('harness_single_dom_update_on_repeat_init', 1, 0, false);
      recordAssertion('harness_no_duplicate_listeners', 1, 0, false);
      recordAssertion('harness_no_duplicate_timers', 1, 0, false);
      recordAssertion('harness_repeated_toggle_stability', true, false, false);
      recordAssertion('harness_cleanup_leaves_zero_leaks', true, false, false);
    }

    // Assertion 10: Zero unexpected page errors
    recordAssertion(
      'zero_unexpected_page_errors',
      [],
      recordedErrors,
      recordedErrors.length === 0
    );

    const passedCount = assertionResults.filter(r => r.pass).length;
    const failedCount = assertionResults.filter(r => !r.pass).length;

    const evidenceOutput = {
      task: 'R59-T023',
      label: runLabel,
      page: '5-browser-extension/start/dist/index.html',
      harness: '5-browser-extension/1-about-browsers/harness.html',
      url: popupUrl,
      versions: {
        node: process.version,
        playwright: '1.65.1',
        chromium: browserVersion
      },
      stubbedRequests,
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

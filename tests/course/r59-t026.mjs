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
const evidenceDir = path.join(REPO_ROOT, 'work', 'R59-T026');

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

function createStaticServer(root) {
  return http.createServer((req, res) => {
    try {
      const parsedUrl = new URL(req.url, 'http://127.0.0.1');
      let pathname = decodeURIComponent(parsedUrl.pathname);
      if (pathname.endsWith('/')) {
        pathname += 'index.html';
      }
      const safePath = path.normalize(pathname).replace(/^(\.\.[/\\])+/, '');
      const filePath = path.join(root, safePath);

      if (!filePath.startsWith(root)) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('403 Forbidden');
        return;
      }

      fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('404 Not Found');
          return;
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        res.writeHead(200, {
          'Content-Type': contentType,
          'Content-Length': stats.size,
          'Cache-Control': 'no-store'
        });
        fs.createReadStream(filePath).pipe(res);
      });
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
  const starterPopupUrl = `${baseUrl}/5-browser-extension/start/dist/index.html`;
  const harnessUrl = `${baseUrl}/5-browser-extension/2-forms-browsers-local-storage/harness.html`;

  await waitForServer(starterPopupUrl);

  const browser = await chromium.launch({ headless: true });
  const browserVersion = browser.version();

  const results = [];
  const stubbedRequests = [];
  const capturedErrors = [];

  function recordResult(name, expected, actual, pass) {
    results.push({ name, expected, actual, pass });
    const mark = pass ? '[PASS]' : '[FAIL]';
    console.log(`${mark} ${name} (expected: ${JSON.stringify(expected)}, actual: ${JSON.stringify(actual)})`);
  }

  try {
    const baseContextOptions = {
      viewport: { width: 400, height: 600 },
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
          capturedErrors.push({ type: 'console', message: msg.text() });
        }
      });

      page.on('requestfailed', (req) => {
        const reqUrl = req.url();
        if (reqUrl.startsWith(baseUrl)) {
          capturedErrors.push({ type: 'requestfailed', url: reqUrl });
        }
      });

      page.on('response', (res) => {
        const resUrl = res.url();
        if (resUrl.startsWith(baseUrl) && res.status() >= 400) {
          capturedErrors.push({ type: 'response>=400', url: resUrl, status: res.status() });
        }
      });
    }

    // --- STEP 1: Verify Source Anchor on Starter Page ---
    const starterContext = await browser.newContext(baseContextOptions);
    const starterPage = await starterContext.newPage();
    attachListeners(starterPage);

    await starterPage.goto(starterPopupUrl, { waitUntil: 'load' });
    const imgInfo = await starterPage.$eval('img', (el) => ({
      exists: true,
      src: el.getAttribute('src'),
      alt: el.getAttribute('alt')
    })).catch(() => ({ exists: false, src: null, alt: null }));

    recordResult(
      'source_anchor_img_exists',
      { exists: true, src: 'images/plants-people.png', alt: 'plants and people' },
      imgInfo,
      imgInfo.exists && imgInfo.src === 'images/plants-people.png' && imgInfo.alt === 'plants and people'
    );

    const imgVisible = await starterPage.locator('img').isVisible();
    recordResult('source_anchor_img_visible', true, imgVisible, imgVisible);

    await starterPage.screenshot({
      path: path.join(evidenceDir, 'starter-popup.png')
    });
    await starterContext.close();

    // --- STEP 2: Feature-Present Scenario (Supported localStorage) ---
    const supportedContext = await browser.newContext(baseContextOptions);
    const supportedPage = await supportedContext.newPage();
    attachListeners(supportedPage);

    await supportedPage.goto(harnessUrl, { waitUntil: 'load' });

    // 2a. Verify form fields exist with 'required'
    const formFields = await supportedPage.evaluate(() => {
      const reg = document.getElementById('region');
      const api = document.getElementById('api');
      const btn = document.getElementById('submit-btn');
      return {
        regionExists: Boolean(reg),
        regionRequired: reg?.hasAttribute('required'),
        apiExists: Boolean(api),
        apiRequired: api?.hasAttribute('required'),
        submitExists: Boolean(btn)
      };
    });

    recordResult(
      'form_fields_rendered_with_validation',
      { regionExists: true, regionRequired: true, apiExists: true, apiRequired: true, submitExists: true },
      formFields,
      formFields.regionExists && formFields.regionRequired && formFields.apiExists && formFields.apiRequired && formFields.submitExists
    );

    // 2b. Submit validation blocks empty submission
    await supportedPage.click('#submit-btn');
    const emptyValidation = await supportedPage.evaluate(() => {
      const regError = document.getElementById('region-error');
      const apiError = document.getElementById('api-error');
      const form = document.getElementById('carbon-form');
      const result = document.getElementById('result-area');
      return {
        regionErrorVisible: regError?.style.display !== 'none',
        apiErrorVisible: apiError?.style.display !== 'none',
        formVisible: form?.style.display !== 'none',
        resultHidden: result?.style.display === 'none'
      };
    });

    recordResult(
      'submit_validation_blocks_empty_submission',
      { regionErrorVisible: true, apiErrorVisible: true, formVisible: true, resultHidden: true },
      emptyValidation,
      emptyValidation.regionErrorVisible && emptyValidation.apiErrorVisible && emptyValidation.formVisible && emptyValidation.resultHidden
    );

    // 2c. Successful submission with feature present
    await supportedPage.fill('#region', 'US');
    await supportedPage.fill('#api', 'demo-tmrow-key-12345');
    await supportedPage.click('#submit-btn');

    const supportedSubmission = await supportedPage.evaluate(() => {
      const result = document.getElementById('result-area');
      const myReg = document.getElementById('my-region')?.textContent;
      const mode = document.getElementById('storage-mode')?.textContent;
      const storedKey = window.localStorage.getItem('apiKey');
      const storedReg = window.localStorage.getItem('regionName');
      return {
        resultVisible: result?.style.display !== 'none',
        regionText: myReg,
        storageMode: mode,
        storedKey: storedKey,
        storedRegion: storedReg
      };
    });

    recordResult(
      'feature_present_storage_success',
      {
        resultVisible: true,
        regionText: 'US',
        storageMode: 'Persistent (Local Storage)',
        storedKey: 'demo-tmrow-key-12345',
        storedRegion: 'US'
      },
      supportedSubmission,
      supportedSubmission.resultVisible &&
        supportedSubmission.regionText === 'US' &&
        supportedSubmission.storageMode === 'Persistent (Local Storage)' &&
        supportedSubmission.storedKey === 'demo-tmrow-key-12345' &&
        supportedSubmission.storedRegion === 'US'
    );

    await supportedPage.screenshot({
      path: path.join(evidenceDir, 'feature-present-saved.png')
    });
    await supportedContext.close();

    // --- STEP 3: Feature-Absent Scenario (Unsupported/Blocked localStorage) ---
    const unsupportedContext = await browser.newContext(baseContextOptions);
    // Simulate disabled/blocked localStorage throwing SecurityError
    await unsupportedContext.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        enumerable: true,
        get: () => {
          throw new DOMException('Access to storage is denied.', 'SecurityError');
        }
      });
    });

    const unsupportedPage = await unsupportedContext.newPage();
    attachListeners(unsupportedPage);

    await unsupportedPage.goto(harnessUrl, { waitUntil: 'load' });

    // 3a. Verify fallback text is rendered
    const fallbackState = await unsupportedPage.evaluate(() => {
      const notice = document.getElementById('storage-notice');
      return {
        isActive: notice?.classList.contains('active'),
        noticeText: notice?.textContent?.trim(),
        isAppStorageSupported: window.__appState?.appStorage?.isSupported
      };
    });

    recordResult(
      'feature_absent_fallback_rendered',
      {
        isActive: true,
        noticeText: 'Storage unavailable: preferences will apply to this session only.',
        isAppStorageSupported: false
      },
      fallbackState,
      fallbackState.isActive &&
        fallbackState.noticeText === 'Storage unavailable: preferences will apply to this session only.' &&
        fallbackState.isAppStorageSupported === false
    );

    // 3b. Verify form submission works gracefully in-session without throwing
    await unsupportedPage.fill('#region', 'FR');
    await unsupportedPage.fill('#api', 'session-only-key-999');
    await unsupportedPage.click('#submit-btn');

    const unsupportedSubmission = await unsupportedPage.evaluate(() => {
      const result = document.getElementById('result-area');
      const myReg = document.getElementById('my-region')?.textContent;
      const mode = document.getElementById('storage-mode')?.textContent;
      return {
        resultVisible: result?.style.display !== 'none',
        regionText: myReg,
        storageMode: mode
      };
    });

    recordResult(
      'feature_absent_session_submission_works',
      {
        resultVisible: true,
        regionText: 'FR',
        storageMode: 'Session Only (In-Memory Fallback)'
      },
      unsupportedSubmission,
      unsupportedSubmission.resultVisible &&
        unsupportedSubmission.regionText === 'FR' &&
        unsupportedSubmission.storageMode === 'Session Only (In-Memory Fallback)'
    );

    // 3c. Verify CSS @supports fallback rule is present in DOM styles
    const hasCssSupportsFallback = await unsupportedPage.evaluate(() => {
      for (const sheet of document.styleSheets) {
        try {
          for (const rule of sheet.cssRules) {
            if (rule.conditionText && rule.conditionText.includes('gap')) {
              return true;
            }
          }
        } catch {
          // ignore CORS issues
        }
      }
      return false;
    });

    recordResult(
      'css_supports_fallback_declared',
      true,
      hasCssSupportsFallback,
      hasCssSupportsFallback
    );

    await unsupportedPage.screenshot({
      path: path.join(evidenceDir, 'feature-absent-fallback.png')
    });
    await unsupportedContext.close();

    // 4. Zero unexpected errors
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
      task: 'R59-T026',
      label,
      page: '5-browser-extension/start/dist/index.html',
      harness: '5-browser-extension/2-forms-browsers-local-storage/harness.html',
      url: starterPopupUrl,
      viewports: [{ width: 400, height: 600 }],
      versions: {
        node: process.version,
        playwright: '1.65.1',
        chromium: browserVersion
      },
      stubbedRequests: Array.from(new Set(stubbedRequests)),
      allowlistedErrors: [],
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

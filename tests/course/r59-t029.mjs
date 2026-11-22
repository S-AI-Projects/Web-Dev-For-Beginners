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
const taskDir = path.join(defaultRootDir, 'work', 'R59-T029');
const isMutant = process.argv.includes('--mutant') || process.env.R59_MUTANT === '1';

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

  // Fallback for terrarium solution files requested relative to solution root
  const terrariumDir = path.join(baseDir, '3-terrarium', 'solution');
  const terrariumAsset = sanitizePath(terrariumDir, reqUrl);
  if (terrariumAsset && fs.existsSync(terrariumAsset) && fs.statSync(terrariumAsset).isFile()) {
    return { filePath: terrariumAsset };
  }

  return { error: 404 };
}

function startStaticServer(baseDir) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const { filePath, error } = resolveFile(baseDir, req.url || '/');
      if (error === 403) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('Forbidden');
        return;
      }
      if (error === 404 || !filePath) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      try {
        const content = fs.readFileSync(filePath);
        res.writeHead(200, {
          'Content-Type': contentType,
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        });
        res.end(content);
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Internal Server Error');
      }
    });

    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      resolve({ server, port, origin: `http://127.0.0.1:${port}` });
    });

    server.on('error', reject);
  });
}

async function runSuite() {
  const results = {
    task: 'R59-T029',
    label: runLabel,
    target: '3-terrarium/solution/index.html',
    timestamp: new Date().toISOString(),
    status: 'pending',
    exitCode: 1,
    assertions: []
  };

  const unexpectedErrors = [];
  let serverInstance = null;
  let browser = null;

  function assertCheck(name, passed, details = {}) {
    results.assertions.push({
      name,
      passed: Boolean(passed),
      ...details
    });
  }

  try {
    const { server, origin } = await startStaticServer(serveRootDir);
    serverInstance = server;

    browser = await chromium.launch({
      headless: true
    });

    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 }
    });

    // Offline stubbing for external CDNs (Font Awesome)
    await context.route(/cdnjs\.cloudflare\.com/, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'text/css',
        body: '/* Font Awesome stubbed for offline testing */'
      });
    });

    const page = await context.newPage();

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        // Filter out expected 404 network errors when testing missing asset fallback
        const text = msg.text();
        if (text.includes('404') || text.includes('Failed to load resource')) {
          return;
        }
        unexpectedErrors.push(`[console.error] ${text}`);
      }
    });

    page.on('pageerror', (err) => {
      unexpectedErrors.push(`[pageerror] ${err.message}`);
    });

    // ---------------------------------------------------------
    // Phase 1: Verify Normal Initial State on 3-terrarium/solution/index.html
    // ---------------------------------------------------------
    const targetUrl = `${origin}/3-terrarium/solution/index.html`;
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});

    // Source anchors existence
    const pageAnchor = await page.$('#page');
    assertCheck('source_anchor_page_exists', Boolean(pageAnchor));

    const plantSelection = await page.$('#plant-selection');
    assertCheck('source_anchor_plant_selection_exists', Boolean(plantSelection));

    const leftContainer = await page.$('#left-container');
    assertCheck('source_anchor_left_container_exists', Boolean(leftContainer));

    const plant1 = await page.$('#plant1');
    assertCheck('source_anchor_plant1_exists', Boolean(plant1));

    // Stacking and layout checks
    const initialLayout = await page.evaluate(() => {
      const p1 = document.getElementById('plant1');
      const left = document.getElementById('left-container');
      const jar = document.querySelector('.jar-walls');
      if (!p1 || !left || !jar) return null;

      const p1Rect = p1.getBoundingClientRect();
      const leftRect = left.getBoundingClientRect();
      const p1Z = window.getComputedStyle(p1).zIndex;
      const jarZ = window.getComputedStyle(jar).zIndex;

      return {
        plant1InsideLeftContainer: p1Rect.left >= leftRect.left - 5 && p1Rect.right <= leftRect.right + 25,
        plant1ZIndex: parseInt(p1Z, 10) || 0,
        jarZIndex: parseInt(jarZ, 10) || 0,
        naturalWidth: p1.naturalWidth,
        naturalHeight: p1.naturalHeight,
        hasFallbackClass: p1.classList.contains('plant-fallback')
      };
    });

    const initialNormalValid = Boolean(
      initialLayout &&
      initialLayout.plant1InsideLeftContainer &&
      initialLayout.plant1ZIndex > initialLayout.jarZIndex &&
      initialLayout.naturalWidth > 0 &&
      !initialLayout.hasFallbackClass
    );
    assertCheck('initial_normal_state_rendered', initialNormalValid, { layout: initialLayout });

    // Capture normal screenshot
    const normalScreenshotPath = path.join(taskDir, 'terrarium-normal.png');
    await page.screenshot({ path: normalScreenshotPath, fullPage: false });

    // ---------------------------------------------------------
    // Phase 2: Missing Font / External CDN Fallback
    // ---------------------------------------------------------
    const fontFallback = await page.evaluate(() => {
      const h1 = document.querySelector('h1');
      const navLink = document.querySelector('nav li a');
      if (!h1 || !navLink) return { readable: false };
      const bodyFont = window.getComputedStyle(document.body).fontFamily.toLowerCase();
      const h1Text = h1.textContent.trim();
      const navText = navLink.textContent.trim();
      const hasSansFallback = bodyFont.includes('helvetica') || bodyFont.includes('arial') || bodyFont.includes('sans-serif');
      return {
        readable: hasSansFallback && h1Text.length > 0 && navText.length > 0,
        fontFamily: bodyFont,
        h1Text,
        navText
      };
    });
    assertCheck('font_fallback_readable', fontFallback.readable, fontFallback);

    // ---------------------------------------------------------
    // Phase 3: Exercise Failed Asset Request with Readable Fallback
    // ---------------------------------------------------------
    // Create fresh context to test missing asset with routing
    const errorContext = await browser.newContext({
      viewport: { width: 1280, height: 800 }
    });
    await errorContext.route(/cdnjs\.cloudflare\.com/, (r) => r.fulfill({ status: 200, body: '' }));

    // Abort plant1 image request to simulate missing / failed asset
    let blockPlant1 = true;
    await errorContext.route(/images\/plant1\.png/, (route) => {
      if (blockPlant1) {
        route.abort('failed');
      } else {
        route.continue();
      }
    });

    const errorPage = await errorContext.newPage();
    errorPage.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (text.includes('404') || text.includes('net::ERR_FAILED')) return;
        unexpectedErrors.push(`[console.error-fail-ctx] ${text}`);
      }
    });
    errorPage.on('pageerror', (err) => {
      unexpectedErrors.push(`[pageerror-fail-ctx] ${err.message}`);
    });

    await errorPage.goto(targetUrl, { waitUntil: 'domcontentloaded' });
    // Allow error events to propagate
    await errorPage.waitForTimeout(300);

    const fallbackState = await errorPage.evaluate(() => {
      const p1 = document.getElementById('plant1');
      const left = document.getElementById('left-container');
      if (!p1 || !left) return null;

      const p1Rect = p1.getBoundingClientRect();
      const leftRect = left.getBoundingClientRect();
      const hasFallbackClass = p1.classList.contains('plant-fallback');
      const hasFallbackAttr = p1.getAttribute('data-failed') === 'true';
      const altText = (p1.getAttribute('alt') || '').toLowerCase();
      const hasReadableAlt = altText.includes('unavailable') || altText.includes('failed') || altText.includes('plant');
      const boundsIntact = p1Rect.left >= leftRect.left - 10 && p1Rect.right <= leftRect.right + 30;

      return {
        hasFallbackClass,
        hasFallbackAttr,
        altText,
        hasReadableAlt,
        boundsIntact,
        naturalWidth: p1.naturalWidth
      };
    });

    let fallbackPassed = Boolean(
      fallbackState &&
      (fallbackState.hasFallbackClass || fallbackState.hasFallbackAttr) &&
      fallbackState.hasReadableAlt &&
      fallbackState.boundsIntact &&
      fallbackState.naturalWidth === 0
    );

    if (isMutant) {
      // Mutant deliberate failure: invert fallback assertion
      fallbackPassed = false;
    }

    assertCheck('failed_asset_displays_fallback_state', fallbackPassed, { fallbackState });

    // Capture fallback screenshot
    const fallbackScreenshotPath = path.join(taskDir, 'terrarium-fallback.png');
    await errorPage.screenshot({ path: fallbackScreenshotPath, fullPage: false });

    // ---------------------------------------------------------
    // Phase 4: Recovery on Restored Fixture / Asset
    // ---------------------------------------------------------
    blockPlant1 = false;
    const recoveryResult = await errorPage.evaluate(async () => {
      const p1 = document.getElementById('plant1');
      if (!p1) return { recovered: false };

      // Restore plant1 source with cachebuster to force reload
      return new Promise((resolve) => {
        p1.onload = () => {
          resolve({
            recovered: true,
            hasFallbackClass: p1.classList.contains('plant-fallback'),
            naturalWidth: p1.naturalWidth,
            altText: p1.getAttribute('alt')
          });
        };
        p1.onerror = () => {
          resolve({ recovered: false });
        };
        p1.src = './images/plant1.png?restore=' + Date.now();
      });
    });

    const recoveryPassed = Boolean(
      recoveryResult &&
      recoveryResult.recovered &&
      !recoveryResult.hasFallbackClass &&
      recoveryResult.naturalWidth > 0
    );
    assertCheck('failed_asset_recovers_on_restore', recoveryPassed, { recoveryResult });

    await errorContext.close();

    // ---------------------------------------------------------
    // Phase 5: Empty Result / Empty Shelf State & Recovery
    // ---------------------------------------------------------
    const emptyStateResult = await page.evaluate(() => {
      const left = document.getElementById('left-container');
      if (!left) return { ok: false };

      // Temporarily detach plants from left container to simulate empty shelf
      const plantHolders = Array.from(left.querySelectorAll('.plant-holder'));
      const fragment = document.createDocumentFragment();
      plantHolders.forEach((h) => fragment.appendChild(h));

      // Trigger update if function exists or trigger mutation
      if (typeof window.updateContainerEmptyStates === 'function') {
        window.updateContainerEmptyStates();
      } else {
        left.setAttribute('data-empty', 'true');
      }

      const notice = left.querySelector('.container-empty-notice');
      const isNoticeVisible = notice
        ? window.getComputedStyle(notice).display !== 'none'
        : false;
      const noticeText = notice ? notice.textContent.trim() : '';

      // Test recovery: re-attach plants
      left.appendChild(fragment);
      if (typeof window.updateContainerEmptyStates === 'function') {
        window.updateContainerEmptyStates();
      } else {
        left.removeAttribute('data-empty');
      }

      const noticeVisibleAfterRestore = notice
        ? window.getComputedStyle(notice).display !== 'none'
        : true;

      return {
        emptyNoticePresent: Boolean(notice),
        emptyNoticeVisibleWhenEmpty: isNoticeVisible,
        noticeText,
        emptyNoticeHiddenAfterRestore: !noticeVisibleAfterRestore
      };
    });

    assertCheck(
      'empty_container_displays_empty_state',
      Boolean(emptyStateResult && emptyStateResult.emptyNoticePresent && emptyStateResult.emptyNoticeVisibleWhenEmpty),
      { emptyStateResult }
    );

    assertCheck(
      'empty_container_recovers_on_restore',
      Boolean(emptyStateResult && emptyStateResult.emptyNoticeHiddenAfterRestore),
      { emptyStateResult }
    );

    // ---------------------------------------------------------
    // Phase 6: Verify Dedicated Static Companion Fixture
    // ---------------------------------------------------------
    const companionUrl = `${origin}/3-terrarium/2-intro-to-css/companion.html`;
    const companionResponse = await page.goto(companionUrl, { waitUntil: 'domcontentloaded' }).catch(() => null);
    const companionLoaded = companionResponse && companionResponse.status() === 200;

    let companionVerification = false;
    if (companionLoaded) {
      companionVerification = await page.evaluate(async () => {
        const emptyShelf = document.querySelector('#left-container[data-empty="true"]');
        const emptyNotice = document.querySelector('.container-empty-notice');
        const failedPlant = document.querySelector('#plant1.plant-fallback, #plant1[data-failed="true"]');

        const initialEmptyVisible = emptyNotice && window.getComputedStyle(emptyNotice).display !== 'none';
        const initialFallbackVisible = Boolean(failedPlant);

        // Click restore button in companion fixture
        const restoreBtn = document.getElementById('restore-btn');
        if (restoreBtn) {
          restoreBtn.click();
          await new Promise((r) => setTimeout(r, 200));
        }

        const noticeAfter = emptyNotice && window.getComputedStyle(emptyNotice).display === 'none';
        const plantAfter = document.getElementById('plant1');
        const recoveredPlant = plantAfter && !plantAfter.classList.contains('plant-fallback');

        return Boolean(initialEmptyVisible && initialFallbackVisible && noticeAfter && recoveredPlant);
      });
    }

    assertCheck(
      'companion_fixture_exercises_fallback_and_recovery',
      Boolean(companionLoaded && companionVerification),
      { companionLoaded, companionVerification }
    );

    // ---------------------------------------------------------
    // Phase 7: Zero Unexpected Page Errors
    // ---------------------------------------------------------
    assertCheck('zero_unexpected_page_errors', unexpectedErrors.length === 0, {
      errors: unexpectedErrors
    });

    const allPassed = results.assertions.every((a) => a.passed);
    results.status = allPassed ? 'pass' : 'fail';
    results.exitCode = allPassed ? 0 : 1;
  } catch (err) {
    results.status = 'error';
    results.exitCode = 1;
    results.error = err.message;
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
    if (serverInstance) {
      await new Promise((res) => serverInstance.close(res)).catch(() => {});
    }
  }

  // Write results to JSON
  const outputFileName = `results-${runLabel}.json`;
  const outputPath = path.join(taskDir, outputFileName);
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2), 'utf8');

  // Also print human-readable summary
  console.log(`\n=== R59-T029 Test Results [${runLabel.toUpperCase()}] ===`);
  for (const a of results.assertions) {
    console.log(`  ${a.passed ? '✓' : '✗'} ${a.name}`);
  }
  console.log(`Status: ${results.status.toUpperCase()} (exit code ${results.exitCode})`);

  if (unexpectedErrors.length > 0) {
    console.log('Unexpected errors encountered:');
    for (const e of unexpectedErrors) {
      console.log(`  - ${e}`);
    }
  }

  process.exit(results.exitCode);
}

runSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

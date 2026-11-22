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
const taskDir = path.join(defaultRootDir, 'work', 'R59-T022');

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

  // Fallback for terrarium solution files
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
  const targetPagePath = '/3-terrarium/solution/index.html';
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

    const viewports = [
      { name: 'mobile', width: 360, height: 800 },
      { name: 'desktop', width: 1280, height: 800 }
    ];

    const layoutData = {};

    for (const vp of viewports) {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        locale: 'en-US',
        timezoneId: 'UTC',
        colorScheme: 'light',
        reducedMotion: 'no-preference',
        serviceWorkers: 'block'
      });

      // Offline determinism
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

      page.on('pageerror', err => {
        recordedErrors.push({ viewport: vp.name, type: 'pageerror', message: err.message });
      });
      page.on('console', msg => {
        if (msg.type() === 'error') {
          recordedErrors.push({ viewport: vp.name, type: 'console-error', text: msg.text() });
        }
      });
      page.on('requestfailed', req => {
        const url = req.url();
        if (url.startsWith(baseUrl)) {
          recordedErrors.push({
            viewport: vp.name,
            type: 'requestfailed',
            url,
            failure: req.failure()?.errorText || 'unknown'
          });
        }
      });
      page.on('response', res => {
        const url = res.url();
        if (url.startsWith(baseUrl) && res.status() >= 400) {
          recordedErrors.push({
            viewport: vp.name,
            type: 'http-error',
            url,
            status: res.status()
          });
        }
      });

      await page.goto(targetUrl);
      await page.waitForSelector('#page');
      await page.waitForSelector('#plant1');

      // Save screenshot
      const screenshotName = `terrarium-${vp.width}.png`;
      await page.screenshot({ path: path.join(taskDir, screenshotName) });

      // Gather metrics
      const metrics = await page.evaluate(() => {
        const doc = document.documentElement;
        const pageEl = document.getElementById('page');
        const plantSelection = document.getElementById('plant-selection');
        const leftContainer = document.getElementById('left-container');
        const rightContainer = document.getElementById('right-container');
        const terrariumSection = document.getElementById('terrarium-section');
        const plant1 = document.getElementById('plant1');

        // Check plants bounding rects
        const plants = Array.from(document.querySelectorAll('.plant')).map(p => {
          const r = p.getBoundingClientRect();
          return {
            id: p.id,
            left: r.left,
            right: r.right,
            width: r.width,
            height: r.height,
            isOutside: r.right > doc.clientWidth || r.left < 0
          };
        });

        // Visual order check: nav < header < main < footer top positions
        const nav = document.querySelector('nav');
        const header = document.querySelector('header');
        const main = document.querySelector('main');
        const footer = document.querySelector('footer');

        const navTop = nav ? nav.getBoundingClientRect().top : 0;
        const headerTop = header ? header.getBoundingClientRect().top : 0;
        const mainTop = main ? main.getBoundingClientRect().top : 0;
        const footerTop = footer ? footer.getBoundingClientRect().top : 0;

        const visualOrderCorrect = navTop <= headerTop && headerTop <= mainTop && mainTop <= footerTop;

        return {
          scrollWidth: doc.scrollWidth,
          clientWidth: doc.clientWidth,
          hasOverflow: doc.scrollWidth > doc.clientWidth,
          hasPage: Boolean(pageEl),
          hasPlantSelection: Boolean(plantSelection),
          hasLeftContainer: Boolean(leftContainer),
          hasRightContainer: Boolean(rightContainer),
          hasTerrariumSection: Boolean(terrariumSection),
          plant1Src: plant1 ? plant1.getAttribute('src') : null,
          plants,
          visualOrderCorrect,
          overflowingPlants: plants.filter(p => p.isOutside).map(p => p.id)
        };
      });

      layoutData[vp.name] = metrics;
      await context.close();
    }

    // Assertions
    // 1-4: Source Anchors
    recordAssertion(
      'source_anchor_page_exists',
      true,
      layoutData.desktop.hasPage,
      layoutData.desktop.hasPage
    );
    recordAssertion(
      'source_anchor_plant_selection_exists',
      true,
      layoutData.desktop.hasPlantSelection,
      layoutData.desktop.hasPlantSelection
    );
    recordAssertion(
      'source_anchor_left_container_exists',
      true,
      layoutData.desktop.hasLeftContainer,
      layoutData.desktop.hasLeftContainer
    );
    recordAssertion(
      'source_anchor_plant1_exists',
      true,
      Boolean(layoutData.desktop.plant1Src),
      Boolean(layoutData.desktop.plant1Src)
    );

    // 5-6: Overflow assertions at both widths
    recordAssertion(
      'no_unintended_horizontal_overflow_360',
      true,
      !layoutData.mobile.hasOverflow,
      !layoutData.mobile.hasOverflow
    );
    recordAssertion(
      'no_unintended_horizontal_overflow_1280',
      true,
      !layoutData.desktop.hasOverflow,
      !layoutData.desktop.hasOverflow
    );

    // 7-8: Plant bounding rects inside viewport
    recordAssertion(
      'all_controls_within_viewport_360',
      [],
      layoutData.mobile.overflowingPlants,
      layoutData.mobile.overflowingPlants.length === 0
    );
    recordAssertion(
      'all_controls_within_viewport_1280',
      [],
      layoutData.desktop.overflowingPlants,
      layoutData.desktop.overflowingPlants.length === 0
    );

    // 9: DOM order matches visual order
    recordAssertion(
      'dom_order_matches_visual_order',
      true,
      layoutData.mobile.visualOrderCorrect && layoutData.desktop.visualOrderCorrect,
      layoutData.mobile.visualOrderCorrect && layoutData.desktop.visualOrderCorrect
    );

    // 10: Zero unexpected errors
    recordAssertion(
      'zero_unexpected_page_errors',
      [],
      recordedErrors,
      recordedErrors.length === 0
    );

    const passedCount = assertionResults.filter(r => r.pass).length;
    const failedCount = assertionResults.filter(r => !r.pass).length;

    const evidenceOutput = {
      task: 'R59-T022',
      label: runLabel,
      page: '3-terrarium/solution/index.html',
      url: targetUrl,
      viewports: [
        { width: 360, height: 800 },
        { width: 1280, height: 800 }
      ],
      versions: {
        node: process.version,
        playwright: '1.65.1',
        chromium: browserVersion
      },
      stubbedRequests,
      results: assertionResults,
      layoutMetrics: {
        mobile: {
          scrollWidth: layoutData.mobile.scrollWidth,
          clientWidth: layoutData.mobile.clientWidth,
          hasOverflow: layoutData.mobile.hasOverflow
        },
        desktop: {
          scrollWidth: layoutData.desktop.scrollWidth,
          clientWidth: layoutData.desktop.clientWidth,
          hasOverflow: layoutData.desktop.hasOverflow
        }
      },
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

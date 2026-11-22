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
const evidenceDir = path.join(REPO_ROOT, 'work', 'R59-T024');

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
      // wait and retry
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Server at ${url} did not become ready within ${timeoutMs}ms`);
}

async function main() {
  fs.mkdirSync(evidenceDir, { recursive: true });

  const server = createStaticServer(serveRoot);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;
  const targetPath = '/3-terrarium/solution/index.html';
  const targetUrl = `${baseUrl}${targetPath}`;

  await waitForServer(targetUrl);

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
    const contextOptions = {
      viewport: { width: 1280, height: 800 },
      locale: 'en-US',
      timezoneId: 'UTC',
      colorScheme: 'light',
      reducedMotion: 'no-preference',
      serviceWorkers: 'block'
    };

    async function setupContextAndPage() {
      const context = await browser.newContext(contextOptions);
      await context.route('**/*', (route) => {
        const reqUrl = route.request().url();
        if (reqUrl.startsWith(baseUrl)) {
          route.continue();
        } else {
          stubbedRequests.push(reqUrl);
          route.fulfill({
            status: 200,
            contentType: 'text/css',
            body: '/* stubbed external resource */'
          });
        }
      });

      const page = await context.newPage();

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

      return { context, page };
    }

    // --- CONTEXT A ---
    const { context: contextA, page: pageA } = await setupContextAndPage();
    await pageA.goto(targetUrl, { waitUntil: 'load' });

    // 1. Verify Source Anchors
    const pageAnchor = await pageA.$('#page');
    const plantSelectionAnchor = await pageA.$('#plant-selection');
    const leftContainerAnchor = await pageA.$('#left-container');
    const plant1Anchor = await pageA.$('#plant1');

    recordResult(
      'source_anchor_page_exists',
      true,
      Boolean(pageAnchor),
      Boolean(pageAnchor)
    );

    recordResult(
      'source_anchor_plant_selection_exists',
      true,
      Boolean(plantSelectionAnchor),
      Boolean(plantSelectionAnchor)
    );

    recordResult(
      'source_anchor_left_container_exists',
      true,
      Boolean(leftContainerAnchor),
      Boolean(leftContainerAnchor)
    );

    const plant1Src = await pageA.$eval('#plant1', (el) => el.getAttribute('src')).catch(() => null);
    recordResult(
      'source_anchor_plant1_exists',
      './images/plant1.png',
      plant1Src,
      plant1Src === './images/plant1.png'
    );

    // 2. Verify external Font Awesome request was stubbed offline
    const hasStubbedFontAwesome = stubbedRequests.some((url) =>
      url.includes('cdnjs.cloudflare.com') && url.includes('font-awesome')
    );
    recordResult(
      'external_requests_stubbed_offline',
      true,
      hasStubbedFontAwesome,
      hasStubbedFontAwesome
    );

    // 3. Drag interaction in Context A
    const plant1BoxA = await pageA.locator('#plant1').boundingBox();
    if (!plant1BoxA) {
      throw new Error('#plant1 has no bounding box in Context A');
    }

    const startXA = plant1BoxA.x + plant1BoxA.width / 2;
    const startYA = plant1BoxA.y + plant1BoxA.height / 2;
    const dragDeltaX = 150;
    const dragDeltaY = 100;
    const targetXA = startXA + dragDeltaX;
    const targetYA = startYA + dragDeltaY;

    // Perform pointer drag using mouse
    await pageA.mouse.move(startXA, startYA);
    await pageA.mouse.down();
    await pageA.mouse.move(targetXA, targetYA, { steps: 10 });
    await pageA.mouse.up();

    // Check Context A post-drag DOM state
    const posA = await pageA.evaluate(() => {
      const el = document.getElementById('plant1');
      return {
        top: el.style.top,
        left: el.style.left,
        hasPointerMove: document.onpointermove !== null,
        hasPointerUp: document.onpointerup !== null
      };
    });

    const boxAAfter = await pageA.locator('#plant1').boundingBox();

    recordResult(
      'context_a_drag_updates_position',
      { hasTop: true, hasLeft: true },
      { hasTop: Boolean(posA.top && posA.top.endsWith('px')), hasLeft: Boolean(posA.left && posA.left.endsWith('px')) },
      Boolean(posA.top && posA.top.endsWith('px') && posA.left && posA.left.endsWith('px'))
    );

    recordResult(
      'context_a_input_event_cleanup',
      { hasPointerMove: false, hasPointerUp: false },
      { hasPointerMove: posA.hasPointerMove, hasPointerUp: posA.hasPointerUp },
      !posA.hasPointerMove && !posA.hasPointerUp
    );

    // Screenshot Context A
    await pageA.screenshot({
      path: path.join(evidenceDir, 'terrarium-context-a.png')
    });

    // --- CONTEXT B (fresh context, identical interaction) ---
    const { context: contextB, page: pageB } = await setupContextAndPage();
    await pageB.goto(targetUrl, { waitUntil: 'load' });

    const plant1BoxB = await pageB.locator('#plant1').boundingBox();
    if (!plant1BoxB) {
      throw new Error('#plant1 has no bounding box in Context B');
    }

    const startXB = plant1BoxB.x + plant1BoxB.width / 2;
    const startYB = plant1BoxB.y + plant1BoxB.height / 2;
    const targetXB = startXB + dragDeltaX;
    const targetYB = startYB + dragDeltaY;

    await pageB.mouse.move(startXB, startYB);
    await pageB.mouse.down();
    await pageB.mouse.move(targetXB, targetYB, { steps: 10 });
    await pageB.mouse.up();

    const posB = await pageB.evaluate(() => {
      const el = document.getElementById('plant1');
      return {
        top: el.style.top,
        left: el.style.left,
        hasPointerMove: document.onpointermove !== null,
        hasPointerUp: document.onpointerup !== null
      };
    });

    const boxBAfter = await pageB.locator('#plant1').boundingBox();

    // 4. Assert determinism across Context A and Context B
    const stylesMatch = posA.top === posB.top && posA.left === posB.left;
    recordResult(
      'deterministic_dom_state_across_contexts',
      { top: posA.top, left: posA.left },
      { top: posB.top, left: posB.left },
      stylesMatch
    );

    const boundsMatch =
      Math.abs(boxAAfter.x - boxBAfter.x) < 0.01 &&
      Math.abs(boxAAfter.y - boxBAfter.y) < 0.01 &&
      Math.abs(boxAAfter.width - boxBAfter.width) < 0.01 &&
      Math.abs(boxAAfter.height - boxBAfter.height) < 0.01;

    recordResult(
      'deterministic_bounding_box_across_contexts',
      true,
      boundsMatch,
      boundsMatch
    );

    recordResult(
      'context_b_input_event_cleanup',
      { hasPointerMove: false, hasPointerUp: false },
      { hasPointerMove: posB.hasPointerMove, hasPointerUp: posB.hasPointerUp },
      !posB.hasPointerMove && !posB.hasPointerUp
    );

    // Screenshot Context B
    await pageB.screenshot({
      path: path.join(evidenceDir, 'terrarium-context-b.png')
    });

    // 5. Zero unexpected page errors
    recordResult(
      'zero_unexpected_page_errors',
      [],
      capturedErrors,
      capturedErrors.length === 0
    );

    await contextA.close();
    await contextB.close();
  } finally {
    await browser.close();
    await new Promise((resolve) => {
      server.closeAllConnections?.();
      server.close(resolve);
    });

    const totalPassed = results.filter((r) => r.pass).length;
    const totalFailed = results.filter((r) => !r.pass).length;

    const summary = {
      task: 'R59-T024',
      label,
      page: '3-terrarium/solution/index.html',
      url: targetUrl,
      viewports: [{ width: 1280, height: 800 }],
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

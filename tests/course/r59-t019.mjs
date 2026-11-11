import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');
const appDir = path.join(rootDir, '6-space-game', '4-collision-detection', 'solution');
const workDir = path.join(rootDir, 'work', 'R59-T019');
fs.mkdirSync(workDir, { recursive: true });

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.html': return 'text/html; charset=UTF-8';
    case '.css': return 'text/css; charset=UTF-8';
    case '.js': return 'application/javascript; charset=UTF-8';
    case '.png': return 'image/png';
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
    task: 'R59-T019',
    target: url,
    timestamp: new Date().toISOString(),
    viewportsTested: []
  };

  try {
    browser = await chromium.launch({ headless: true });

    for (const vp of [{ width: 360, height: 800 }, { width: 1280, height: 800 }]) {
      // Emulate reduced motion
      const context = await browser.newContext({
        viewport: vp,
        reducedMotion: 'reduce'
      });
      const page = await context.newPage();

      const pageErrors = [];
      page.on('pageerror', (err) => pageErrors.push(err.message));

      await page.goto(url, { waitUntil: 'load' });
      await page.waitForTimeout(200);

      assert.equal(pageErrors.length, 0, `Page errors at ${vp.width}px: ${pageErrors.join(', ')}`);

      // 1. Verify canvas anchor and focusability
      const canvasInfo = await page.evaluate(() => {
        const c = document.getElementById('canvas');
        return {
          exists: !!c,
          tabIndex: c?.getAttribute('tabindex'),
          ariaLabel: c?.getAttribute('aria-label')
        };
      });
      assert.ok(canvasInfo.exists, 'Canvas anchor #canvas must exist');
      assert.equal(canvasInfo.tabIndex, '0', 'Canvas must have tabindex="0" for keyboard accessibility');

      // 2. Tab into the canvas and verify visible focus indicator
      await page.keyboard.press('Tab');
      const focusInfo = await page.evaluate(() => {
        const active = document.activeElement;
        const style = active ? window.getComputedStyle(active) : null;
        return {
          activeId: active?.id,
          outlineStyle: style?.outlineStyle,
          outlineWidth: style?.outlineWidth,
          outlineColor: style?.outlineColor
        };
      });
      assert.equal(focusInfo.activeId, 'canvas', 'Focus must land on #canvas on Tab press');
      assert.ok(
        focusInfo.outlineStyle !== 'none' && focusInfo.outlineWidth !== '0px',
        `Canvas focus indicator must be visible at ${vp.width}px, got outline: ${focusInfo.outlineStyle}`
      );

      // 3. Verify reduced motion badge is active
      const isMotionBadgeVisible = await page.evaluate(() => {
        const badge = document.getElementById('motionBadge');
        if (!badge) return false;
        const style = window.getComputedStyle(badge);
        return style.display !== 'none';
      });
      assert.ok(isMotionBadgeVisible, 'Reduced motion badge should be displayed when reduced motion is preferred');

      // 4. Verify no horizontal overflow at this width
      const layout = await page.evaluate(() => {
        const doc = document.documentElement;
        return {
          scrollWidth: doc.scrollWidth,
          clientWidth: doc.clientWidth,
          hasOverflow: doc.scrollWidth > doc.clientWidth
        };
      });
      assert.ok(!layout.hasOverflow, `Unintended horizontal overflow at ${vp.width}px: scrollWidth ${layout.scrollWidth} > clientWidth ${layout.clientWidth}`);

      // 5. Screenshot
      const screenshotPath = path.join(workDir, `reduced-motion-${vp.width}x${vp.height}.png`);
      await page.screenshot({ path: screenshotPath });

      results.viewportsTested.push({
        viewport: vp,
        focusVisible: true,
        reducedMotionActive: true,
        scrollWidth: layout.scrollWidth,
        screenshot: screenshotPath,
        status: 'PASS'
      });

      await context.close();
    }

    console.log('All motion and focus preference checks passed for R59-T019.');
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
  console.error('R59-T019 check failed:', err);
  process.exit(1);
});

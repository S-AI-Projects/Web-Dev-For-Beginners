import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');
const appDir = path.join(rootDir, '6-space-game', '6-end-condition', 'solution');
const workDir = path.join(rootDir, 'work', 'R59-T009');
fs.mkdirSync(workDir, { recursive: true });

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.html': return 'text/html; charset=UTF-8';
    case '.css': return 'text/css; charset=UTF-8';
    case '.js': return 'application/javascript; charset=UTF-8';
    case '.png': return 'image/png';
    case '.svg': return 'image/svg+xml';
    case '.json': return 'application/json';
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
    task: 'R59-T009',
    target: url,
    timestamp: new Date().toISOString(),
    toolVersions: {
      node: process.version,
      playwright: '^1.65.1'
    },
    checks: []
  };

  try {
    browser = await chromium.launch({ headless: true });

    // -------------------------------------------------------------------------
    // 1. Desktop Viewport (1280x800) - Focus Indicator & Anchors
    // -------------------------------------------------------------------------
    const contextDesktop = await browser.newContext({
      viewport: { width: 1280, height: 800 }
    });
    const pageDesktop = await contextDesktop.newPage();
    const pageErrors = [];
    pageDesktop.on('pageerror', (err) => pageErrors.push(err.message));

    await pageDesktop.goto(url, { waitUntil: 'load' });
    await pageDesktop.waitForSelector('#canvas');
    await pageDesktop.waitForFunction(() => !!window.hero);

    const canvasEl = await pageDesktop.$('#canvas');
    assert.ok(canvasEl, 'Source anchor canvas must exist');
    results.checks.push({ check: 'Source anchor canvas exists', status: 'PASS' });

    // Focus canvas via keyboard Tab navigation
    await pageDesktop.keyboard.press('Tab');
    const isCanvasFocusedDesktop = await pageDesktop.evaluate(() => document.activeElement?.id === 'canvas');
    assert.ok(isCanvasFocusedDesktop, 'Canvas must be focusable via keyboard navigation');

    // Verify computed focus indicator on canvas
    const focusStyleDesktop = await pageDesktop.evaluate(() => {
      const el = document.getElementById('canvas');
      const cs = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return {
        outlineStyle: cs.outlineStyle,
        outlineWidth: cs.outlineWidth,
        outlineColor: cs.outlineColor,
        width: rect.width,
        height: rect.height,
        left: rect.left,
        right: rect.right
      };
    });

    assert.notEqual(focusStyleDesktop.outlineStyle, 'none', 'Canvas must have a visible outline when focused');
    assert.ok(parseFloat(focusStyleDesktop.outlineWidth) >= 2, 'Focus outline width must be at least 2px');
    assert.ok(focusStyleDesktop.width <= 1280, 'Canvas width must fit within 1280px viewport');

    const focusDesktopScreenshot = path.join(workDir, 'focus-desktop-1280.png');
    await pageDesktop.screenshot({ path: focusDesktopScreenshot });
    results.checks.push({
      check: 'Visible keyboard focus indicator verified at 1280px viewport',
      status: 'PASS',
      style: focusStyleDesktop,
      screenshot: focusDesktopScreenshot
    });

    await contextDesktop.close();

    // -------------------------------------------------------------------------
    // 2. Mobile Viewport (360x640) - Focus Indicator & Responsive Usability
    // -------------------------------------------------------------------------
    const contextMobile = await browser.newContext({
      viewport: { width: 360, height: 640 }
    });
    const pageMobile = await contextMobile.newPage();
    pageMobile.on('pageerror', (err) => pageErrors.push(err.message));

    await pageMobile.goto(url, { waitUntil: 'load' });
    await pageMobile.waitForSelector('#canvas');
    await pageMobile.waitForFunction(() => !!window.hero);

    await pageMobile.keyboard.press('Tab');
    const isCanvasFocusedMobile = await pageMobile.evaluate(() => document.activeElement?.id === 'canvas');
    assert.ok(isCanvasFocusedMobile, 'Canvas must be focusable at mobile width');

    const focusStyleMobile = await pageMobile.evaluate(() => {
      const el = document.getElementById('canvas');
      const cs = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return {
        outlineStyle: cs.outlineStyle,
        outlineWidth: cs.outlineWidth,
        outlineColor: cs.outlineColor,
        width: rect.width,
        height: rect.height,
        right: rect.right
      };
    });

    assert.notEqual(focusStyleMobile.outlineStyle, 'none', 'Canvas outline must remain visible at 360px');
    assert.ok(focusStyleMobile.width <= 360, 'Canvas must scale responsively to fit 360px viewport');

    const focusMobileScreenshot = path.join(workDir, 'focus-mobile-360.png');
    await pageMobile.screenshot({ path: focusMobileScreenshot });
    results.checks.push({
      check: 'Visible keyboard focus indicator and responsive scaling verified at 360px viewport',
      status: 'PASS',
      style: focusStyleMobile,
      screenshot: focusMobileScreenshot
    });

    await contextMobile.close();

    // -------------------------------------------------------------------------
    // 3. prefers-reduced-motion & End Condition Gameplay Verification
    // -------------------------------------------------------------------------
    const contextMotion = await browser.newContext({
      viewport: { width: 1024, height: 768 }
    });
    const pageMotion = await contextMotion.newPage();
    pageMotion.on('pageerror', (err) => pageErrors.push(err.message));

    // Emulate reduced motion preference
    await pageMotion.emulateMedia({ reducedMotion: 'reduce' });
    await pageMotion.goto(url, { waitUntil: 'load' });
    await pageMotion.waitForSelector('#canvas');
    await pageMotion.waitForFunction(() => !!window.hero);

    // Verify reduced-motion media query evaluation
    const prefersReducedMotionMatches = await pageMotion.evaluate(
      () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
    assert.ok(prefersReducedMotionMatches, 'prefers-reduced-motion media query must be active');

    // Verify controls operate under reduced motion
    const initialHeroX = await pageMotion.evaluate(() => window.hero.x);
    await pageMotion.keyboard.press('ArrowLeft');
    await pageMotion.waitForTimeout(50);
    const heroXAfterLeft = await pageMotion.evaluate(() => window.hero.x);
    assert.equal(heroXAfterLeft, initialHeroX - 20, 'Hero must respond to ArrowLeft under reduced motion');

    await pageMotion.keyboard.press('ArrowRight');
    await pageMotion.waitForTimeout(50);
    const heroXAfterRight = await pageMotion.evaluate(() => window.hero.x);
    assert.equal(heroXAfterRight, initialHeroX, 'Hero must respond to ArrowRight under reduced motion');

    // Test laser firing
    await pageMotion.keyboard.press('Space');
    await pageMotion.waitForTimeout(50);
    const laserCount = await pageMotion.evaluate(
      () => window.gameObjects.filter((go) => go.type === 'Laser').length
    );
    assert.ok(laserCount >= 1, 'Laser firing control must remain functional under reduced motion');

    results.checks.push({
      check: 'Game controls (ArrowLeft, ArrowRight, Space) operate properly under reduced motion',
      status: 'PASS'
    });

    // 4. Test Defeat End Condition
    await pageMotion.evaluate(() => {
      window.hero.life = 0;
      window.hero.dead = true;
      window.eventEmitter.emit(window.Messages.GAME_END_LOSS);
    });
    await pageMotion.waitForTimeout(300);

    const defeatScreenshot = path.join(workDir, 'end-condition-defeat.png');
    await pageMotion.screenshot({ path: defeatScreenshot });
    results.checks.push({
      check: 'Defeat end condition triggered and captured',
      screenshot: defeatScreenshot,
      status: 'PASS'
    });

    // 5. Test Restart Mechanic via Enter key
    await pageMotion.keyboard.press('Enter');
    await pageMotion.waitForTimeout(300);

    const postRestartHeroLives = await pageMotion.evaluate(() => window.hero?.life);
    const postRestartEnemies = await pageMotion.evaluate(
      () => window.gameObjects.filter((go) => go.type === 'Enemy').length
    );
    assert.equal(postRestartHeroLives, 3, 'Hero lives must be restored to 3 after Enter restart');
    assert.ok(postRestartEnemies > 0, 'Enemies must be recreated after restart');

    results.checks.push({
      check: 'Restart mechanism via Enter key cleanly resets game state',
      status: 'PASS'
    });

    // 6. Test Victory End Condition
    await pageMotion.evaluate(() => {
      window.gameObjects.forEach((go) => {
        if (go.type === 'Enemy') go.dead = true;
      });
      window.eventEmitter.emit(window.Messages.GAME_END_WIN);
    });
    await pageMotion.waitForTimeout(300);

    const victoryScreenshot = path.join(workDir, 'end-condition-victory.png');
    await pageMotion.screenshot({ path: victoryScreenshot });
    results.checks.push({
      check: 'Victory end condition triggered and captured',
      screenshot: victoryScreenshot,
      status: 'PASS'
    });

    assert.equal(pageErrors.length, 0, `Unexpected page errors observed during test run: ${pageErrors.join(', ')}`);

    console.log('All checks passed for R59-T009.');
    await contextMotion.close();
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
  console.error('R59-T009 check failed:', err);
  process.exit(1);
});

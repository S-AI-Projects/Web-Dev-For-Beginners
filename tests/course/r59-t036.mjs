// tests/course/r59-t036.mjs
// R59-T036 — Handle an unsupported browser feature: 6-space-game/3-moving-elements-around
// Page under test: 6-space-game/3-moving-elements-around/solution/index.html

import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';

const __dir = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(__dir, '../../');
const APP_DIR = join(ROOT, '6-space-game/3-moving-elements-around/solution');
const PORT = 8756;

const MIME = {
  '.html': 'text/html; charset=UTF-8',
  '.js':   'application/javascript; charset=UTF-8',
  '.css':  'text/css; charset=UTF-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
};

function serve(root) {
  return createServer((req, res) => {
    const rawUrl = req.url.split('?')[0];
    const decodedUrl = decodeURIComponent(rawUrl);
    const filePath = join(root, decodedUrl === '/' ? 'index.html' : decodedUrl);
    if (existsSync(filePath)) {
      const ext = extname(filePath);
      const ct = MIME[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': ct });
      res.end(readFileSync(filePath));
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  });
}

let passed = 0;
let failed = 0;

function assert(label, condition, detail = '') {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}${detail ? ': ' + detail : ''}`);
    failed++;
  }
}

const server = serve(APP_DIR);
await new Promise(r => server.listen(PORT, r));
console.log(`\n[R59-T036] Server running on http://localhost:${PORT}\n`);

const browser = await chromium.launch();
const errors = [];

try {
  // ── Block 1: Feature-Present Path (Supported Canvas) ────────────
  console.log('-- Block 1: Feature-Present Path (Supported Canvas 2D) --');
  const supportedContext = await browser.newContext({
    viewport: { width: 1024, height: 768 }
  });
  const supportedPage = await supportedContext.newPage();
  supportedPage.on('pageerror', e => errors.push(`[supported] ${e.message}`));

  const supRes = await supportedPage.goto(`http://localhost:${PORT}/index.html`, { waitUntil: 'load' });
  assert('supported page returns HTTP 200', supRes.status() === 200, `status=${supRes.status()}`);

  // Source anchor: canvas
  const canvasAnchor = await supportedPage.evaluate(() => {
    const c = document.getElementById('canvas');
    if (!c) return null;
    return {
      tagName: c.tagName.toLowerCase(),
      width: c.width,
      height: c.height,
      hasFallbackText: !!document.getElementById('canvas-fallback-text')
    };
  });

  assert('source anchor canvas exists', canvasAnchor !== null);
  assert('source anchor tag is canvas', canvasAnchor && canvasAnchor.tagName === 'canvas');
  assert('canvas width is 1024', canvasAnchor && canvasAnchor.width === 1024);
  assert('canvas height is 768', canvasAnchor && canvasAnchor.height === 768);
  assert('accessible fallback text exists inside canvas', canvasAnchor && canvasAnchor.hasFallbackText);

  // Wait for game initialization
  await supportedPage.waitForFunction(() => !!window.SpaceGameMovement, { timeout: 5000 });
  const isSupportedFlag = await supportedPage.evaluate(() => window.SpaceGameMovement.isSupported);
  assert('SpaceGameMovement reports isSupported=true', isSupportedFlag === true);

  // Fallback banner should not be displayed in supported mode
  const bannerHiddenInSupported = await supportedPage.evaluate(() => {
    const banner = document.getElementById('fallback-banner');
    return !banner || banner.dataset.visible !== 'true';
  });
  assert('fallback banner is hidden when feature is supported', bannerHiddenInSupported);

  // Verify interactive movement works in supported mode
  const initialHeroX = await supportedPage.evaluate(() => window.SpaceGameMovement.getHero()?.x);
  await supportedPage.evaluate(() => {
    window.SpaceGameMovement.getEventEmitter().emit(window.SpaceGameMovement.Messages.KEY_EVENT_RIGHT);
  });
  const movedHeroX = await supportedPage.evaluate(() => window.SpaceGameMovement.getHero()?.x);
  assert('hero moves on KEY_EVENT_RIGHT', movedHeroX === initialHeroX + 5, `initial=${initialHeroX}, moved=${movedHeroX}`);

  await supportedPage.screenshot({ path: join(ROOT, 'work/R59-T036/screenshot-supported.png') });
  await supportedPage.close();
  await supportedContext.close();

  // ── Block 2: Feature-Absent Path (Stubbed Unsupported Canvas) ───
  console.log('\n-- Block 2: Feature-Absent Path (Stubbed Unsupported 2D Context) --');
  const unsupportedContext = await browser.newContext({
    viewport: { width: 1024, height: 768 }
  });
  const unsupportedPage = await unsupportedContext.newPage();
  unsupportedPage.on('pageerror', e => errors.push(`[unsupported] ${e.message}`));

  // Stub canvas 2D context as null before loading
  await unsupportedPage.addInitScript(() => {
    HTMLCanvasElement.prototype.getContext = function(contextId) {
      if (contextId === '2d') return null;
      return null;
    };
  });

  const unsupRes = await unsupportedPage.goto(`http://localhost:${PORT}/index.html`, { waitUntil: 'load' });
  assert('unsupported page returns HTTP 200', unsupRes.status() === 200, `status=${unsupRes.status()}`);

  // Wait for game hook to register
  await unsupportedPage.waitForFunction(() => !!window.SpaceGameMovement, { timeout: 5000 });
  const unsupState = await unsupportedPage.evaluate(() => window.SpaceGameMovement);
  assert('SpaceGameMovement reports isSupported=false', unsupState.isSupported === false);

  // Check that fallback banner is visible and has informative text
  const fallbackDetails = await unsupportedPage.evaluate(() => {
    const banner = document.getElementById('fallback-banner');
    const msg = document.getElementById('fallback-message');
    return {
      bannerExists: !!banner,
      visibleAttr: banner ? banner.dataset.visible : null,
      displayed: banner ? window.getComputedStyle(banner).display : 'none',
      message: msg ? msg.textContent.trim() : ''
    };
  });

  assert('fallback banner element exists in unsupported mode', fallbackDetails.bannerExists);
  assert('fallback banner has data-visible=true', fallbackDetails.visibleAttr === 'true');
  assert('fallback banner is computed display block', fallbackDetails.displayed !== 'none');
  assert('fallback message explains canvas 2D unavailability',
    fallbackDetails.message.toLowerCase().includes('canvas 2d') || fallbackDetails.message.toLowerCase().includes('not supported'),
    `message="${fallbackDetails.message}"`);

  // Verify CSS @supports exists in page styles
  const hasCssSupports = await unsupportedPage.evaluate(() => {
    const styleEl = document.querySelector('style');
    return styleEl ? styleEl.textContent.includes('@supports') : false;
  });
  assert('page includes CSS @supports declaration', hasCssSupports);

  await unsupportedPage.screenshot({ path: join(ROOT, 'work/R59-T036/screenshot-unsupported.png') });
  await unsupportedPage.close();
  await unsupportedContext.close();

  // ── Block 3: Uncaught Error Check ──────────────────────────────
  console.log('\n-- Block 3: Error Checking --');
  assert('zero uncaught page errors across supported and unsupported runs', errors.length === 0, errors.join('; '));

} finally {
  await browser.close();
  server.close();
}

console.log(`\n[R59-T036] Results: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);

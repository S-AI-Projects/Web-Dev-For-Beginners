// tests/course/r59-t033.mjs
// R59-T033 — Empty/error states for 6-space-game/1-introduction
// Page under test: 6-space-game/solution/index.html

import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';

const __dir = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(__dir, '../../');
const PORT = 8753;

const MIME = {
  '.html': 'text/html',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
};

function serve(root) {
  return createServer((req, res) => {
    const url = req.url.split('?')[0];
    const filePath = join(root, url === '/' ? 'index.html' : url);
    if (existsSync(filePath)) {
      const ext = extname(filePath);
      const ct = MIME[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': ct });
      res.end(readFileSync(filePath));
    } else {
      res.writeHead(404); res.end('Not found');
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

const server = serve(join(ROOT, '6-space-game/solution'));
await new Promise(r => server.listen(PORT, r));
console.log(`\n[R59-T033] Server on http://localhost:${PORT}\n`);

const browser = await chromium.launch();
const errors = [];

try {
  // Block 1: HTTP 200
  console.log('-- Block 1: Page loads --');
  const tmpPage = await browser.newPage();
  const res = await tmpPage.goto(`http://localhost:${PORT}/index.html`);
  await tmpPage.close();
  assert('HTTP 200 response', res.status() === 200, `got ${res.status()}`);

  // Block 2: Source anchors
  console.log('\n-- Block 2: Source anchors (#main, #hud, #score, #level) --');
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(e.message));

  // Clear localStorage before navigation so we reliably get empty leaderboard
  await page.addInitScript(() => { localStorage.clear(); });

  await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: 'domcontentloaded' });

  const hasMain  = await page.evaluate(() => !!document.getElementById('main'));
  const hasHud   = await page.evaluate(() => !!document.getElementById('hud'));
  const hasScore = await page.evaluate(() => !!document.getElementById('score'));
  const hasLevel = await page.evaluate(() => !!document.getElementById('level'));
  assert('#main exists',  hasMain);
  assert('#hud exists',   hasHud);
  assert('#score exists', hasScore);
  assert('#level exists', hasLevel);

  // Block 3: Empty leaderboard state
  console.log('\n-- Block 3: Empty leaderboard state --');
  await page.waitForTimeout(300);

  const emptyEl = await page.evaluate(() => {
    const el = document.getElementById('empty-scores');
    return el ? el.textContent.trim() : null;
  });
  assert('#empty-scores element exists when localStorage is empty', emptyEl !== null, `got: ${emptyEl}`);
  assert('#empty-scores has meaningful text', emptyEl !== null && emptyEl.length > 5, `text: "${emptyEl}"`);

  // Block 4: asset-status element
  console.log('\n-- Block 4: Asset status element --');
  const hasAssetStatus = await page.evaluate(() => !!document.getElementById('asset-status'));
  assert('#asset-status element exists', hasAssetStatus);

  // Block 5: Error state on failed image URL
  console.log('\n-- Block 5: Error state on bad image URL --');
  await page.route('**/*.jpg', route => route.abort());
  await page.route('**/*.png', route => route.abort());

  await page.evaluate(() => {
    const inp = document.getElementById('bgImageUrl');
    inp.value = 'https://example.com/broken-image.jpg';
    inp.dispatchEvent(new Event('change'));
  });

  await page.waitForFunction(
    () => document.getElementById('asset-status')?.dataset.state === 'error',
    { timeout: 3000 }
  );

  const statusText = await page.evaluate(() => {
    const el = document.getElementById('asset-status');
    return el ? el.textContent.trim() : '';
  });
  const statusState = await page.evaluate(() => {
    const el = document.getElementById('asset-status');
    return el ? (el.dataset.state || '') : '';
  });

  assert('asset-status shows message on failed image', statusText.length > 0 && statusState === 'error',
    `text="${statusText}", state="${statusState}"`);
  assert('error message mentions failure',
    statusText.toLowerCase().includes('fail') || statusText.includes('⚠'),
    `text="${statusText}"`);

  // Block 6: Recovery on cleared URL
  console.log('\n-- Block 6: Recovery on cleared URL --');
  await page.evaluate(() => {
    const inp = document.getElementById('bgImageUrl');
    inp.value = '';
    inp.dispatchEvent(new Event('change'));
  });

  await page.waitForFunction(
    () => (document.getElementById('asset-status')?.textContent || '') === '',
    { timeout: 3000 }
  );

  const clearedText = await page.evaluate(() => {
    const el = document.getElementById('asset-status');
    return el ? el.textContent.trim() : 'NOT_FOUND';
  });
  assert('asset-status clears after URL is removed', clearedText === '', `text="${clearedText}"`);

  // Block 7: No uncaught errors
  console.log('\n-- Block 7: No uncaught errors --');
  assert('zero uncaught page errors', errors.length === 0,
    errors.length ? errors.join('; ') : '');

  await page.screenshot({ path: join(ROOT, 'work/R59-T033/screenshot-empty-leaderboard.png') });
  await page.close();
  await context.close();

} finally {
  await browser.close();
  server.close();
}

console.log(`\n[R59-T033] Results: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);

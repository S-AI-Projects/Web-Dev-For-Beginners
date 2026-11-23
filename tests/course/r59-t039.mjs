// tests/course/r59-t039.mjs
// R59-T039 — Respect motion and focus preferences: 5-browser-extension/3-background-tasks-and-performance
// Page under test: 5-browser-extension/start/dist/index.html

import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';

const __dir = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(__dir, '../../');
const APP_DIR = join(ROOT, '5-browser-extension/start/dist');
const PORT = 8757;

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
console.log(`\n[R59-T039] Server running on http://localhost:${PORT}\n`);

const browser = await chromium.launch();
const errors = [];

try {
  // ── Block 1: Desktop Viewport (1280x800) with Visible Keyboard Focus ─
  console.log('-- Block 1: Desktop Viewport (1280x800) Focus Indicator --');
  const desktopContext = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    reducedMotion: 'no-preference'
  });
  const desktopPage = await desktopContext.newPage();
  desktopPage.on('pageerror', e => errors.push(`[desktop] ${e.message}`));

  const deskRes = await desktopPage.goto(`http://localhost:${PORT}/index.html`, { waitUntil: 'load' });
  assert('desktop page returns HTTP 200', deskRes.status() === 200, `status=${deskRes.status()}`);

  // Source anchor: img
  const hasImg = await desktopPage.evaluate(() => {
    const img = document.querySelector('img');
    return !!(img && img.getAttribute('src') === 'images/plants-people.png');
  });
  assert('source anchor img exists with correct src', hasImg);

  // Tab navigation to focus skip-link
  await desktopPage.keyboard.press('Tab');
  const skipLinkFocus = await desktopPage.evaluate(() => {
    const el = document.activeElement;
    if (!el || !el.classList.contains('skip-link')) return null;
    const style = window.getComputedStyle(el);
    return {
      tagName: el.tagName.toLowerCase(),
      outlineStyle: style.outlineStyle,
      outlineWidth: parseFloat(style.outlineWidth) || 0,
      outlineColor: style.outlineColor
    };
  });
  assert('first Tab focuses skip-link', skipLinkFocus !== null);
  assert('skip-link has visible outline on focus', skipLinkFocus && skipLinkFocus.outlineStyle === 'solid' && skipLinkFocus.outlineWidth >= 2);

  // Tab navigation to focus status button
  await desktopPage.keyboard.press('Tab');
  const btnFocus = await desktopPage.evaluate(() => {
    const el = document.activeElement;
    if (!el || el.id !== 'check-status-btn') return null;
    const style = window.getComputedStyle(el);
    return {
      id: el.id,
      outlineStyle: style.outlineStyle,
      outlineWidth: parseFloat(style.outlineWidth) || 0
    };
  });
  assert('second Tab focuses check-status-btn', btnFocus !== null);
  assert('button has visible focus outline on desktop (1280px)', btnFocus && btnFocus.outlineStyle === 'solid' && btnFocus.outlineWidth >= 2);

  await desktopPage.screenshot({ path: join(ROOT, 'work/R59-T039/focus-desktop-1280.png') });
  await desktopPage.close();
  await desktopContext.close();

  // ── Block 2: Mobile Viewport (360x800) Focus & Overflow ────────
  console.log('\n-- Block 2: Mobile Viewport (360x800) Focus & Layout --');
  const mobileContext = await browser.newContext({
    viewport: { width: 360, height: 800 }
  });
  const mobilePage = await mobileContext.newPage();
  mobilePage.on('pageerror', e => errors.push(`[mobile] ${e.message}`));

  await mobilePage.goto(`http://localhost:${PORT}/index.html`, { waitUntil: 'load' });

  // Focus the button on mobile
  await mobilePage.focus('#check-status-btn');
  const mobileBtnFocus = await mobilePage.evaluate(() => {
    const el = document.getElementById('check-status-btn');
    const style = window.getComputedStyle(el);
    return {
      outlineStyle: style.outlineStyle,
      outlineWidth: parseFloat(style.outlineWidth) || 0
    };
  });
  assert('button has visible focus outline on mobile (360px)', mobileBtnFocus.outlineStyle === 'solid' && mobileBtnFocus.outlineWidth >= 2);

  // Ensure no horizontal page overflow
  const hasNoOverflow = await mobilePage.evaluate(() => {
    return document.documentElement.scrollWidth <= window.innerWidth;
  });
  assert('mobile layout has no horizontal overflow', hasNoOverflow);

  await mobilePage.screenshot({ path: join(ROOT, 'work/R59-T039/focus-mobile-360.png') });
  await mobilePage.close();
  await mobileContext.close();

  // ── Block 3: Prefers-Reduced-Motion Emulation ────────────────────
  console.log('\n-- Block 3: prefers-reduced-motion: reduce Emulation --');
  const motionContext = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    reducedMotion: 'reduce'
  });
  const motionPage = await motionContext.newPage();
  motionPage.on('pageerror', e => errors.push(`[motion] ${e.message}`));

  await motionPage.goto(`http://localhost:${PORT}/index.html`, { waitUntil: 'load' });

  // Verify reduced motion media query is applied
  const mediaMatches = await motionPage.evaluate(() => {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });
  assert('window.matchMedia reports reduced-motion is active', mediaMatches === true);

  // Verify interactive control remains functional under reduced motion
  await motionPage.click('#check-status-btn');
  const statusMsg = await motionPage.evaluate(() => {
    const el = document.getElementById('background-status');
    return el ? el.textContent.trim() : '';
  });
  assert('button interaction updates status under reduced motion', statusMsg.includes('active'));

  // Verify stylesheet contains reduced motion overrides
  const hasMotionStyles = await motionPage.evaluate(() => {
    for (const sheet of document.styleSheets) {
      try {
        for (const rule of sheet.cssRules) {
          if (rule.conditionText && rule.conditionText.includes('prefers-reduced-motion')) {
            return true;
          }
        }
      } catch (e) {}
    }
    return false;
  });
  assert('CSS includes @media (prefers-reduced-motion: reduce) rule', hasMotionStyles);

  await motionPage.screenshot({ path: join(ROOT, 'work/R59-T039/reduced-motion.png') });
  await motionPage.close();
  await motionContext.close();

  // ── Block 4: Zero Uncaught Errors ───────────────────────────────
  console.log('\n-- Block 4: Uncaught Error Check --');
  assert('zero uncaught page errors across all test viewports', errors.length === 0, errors.join('; '));

} finally {
  await browser.close();
  server.close();
}

console.log(`\n[R59-T039] Results: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);

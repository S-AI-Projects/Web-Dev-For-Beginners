// tests/course/r59-t034.mjs
// R59-T034 — Check repeat initialization: 5-browser-extension/2-forms-browsers-local-storage
// Target pages: 5-browser-extension/start/dist/index.html & 5-browser-extension/2-forms-browsers-local-storage/harness.html

import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';

const __dir = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(__dir, '../../');
const PORT = 8754;

const MIME = {
  '.html': 'text/html; charset=UTF-8',
  '.js':   'application/javascript; charset=UTF-8',
  '.css':  'text/css; charset=UTF-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.json': 'application/json; charset=UTF-8',
};

function serve(root) {
  return createServer((req, res) => {
    const rawUrl = req.url.split('?')[0];
    const decodedUrl = decodeURIComponent(rawUrl);
    const filePath = join(root, decodedUrl);
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

const server = serve(ROOT);
await new Promise(r => server.listen(PORT, r));
console.log(`\n[R59-T034] Server running on http://localhost:${PORT}\n`);

const browser = await chromium.launch();
const errors = [];

try {
  // ── Block 1: 5-browser-extension/start/dist/index.html ─────────
  console.log('-- Block 1: Starter page structure and source anchor --');
  const starterPage = await browser.newPage();
  starterPage.on('pageerror', e => errors.push(`[starter] ${e.message}`));

  const startRes = await starterPage.goto(`http://localhost:${PORT}/5-browser-extension/start/dist/index.html`);
  assert('starter page returns HTTP 200', startRes.status() === 200, `status=${startRes.status()}`);

  const hasImg = await starterPage.evaluate(() => {
    const img = document.querySelector('img');
    return !!(img && img.getAttribute('src') === 'images/plants-people.png');
  });
  assert('starter page has source anchor img', hasImg);

  const imgCount = await starterPage.evaluate(() => document.querySelectorAll('img').length);
  assert('starter page has exactly one img', imgCount === 1, `count=${imgCount}`);

  await starterPage.screenshot({ path: join(ROOT, 'work/R59-T034/screenshot-starter.png') });
  await starterPage.close();

  // ── Block 2: 5-browser-extension/2-forms-browsers-local-storage/harness.html ──
  console.log('\n-- Block 2: Harness initial load and source anchor --');
  const harnessPage = await browser.newPage();
  harnessPage.on('pageerror', e => errors.push(`[harness] ${e.message}`));

  const harnessRes = await harnessPage.goto(`http://localhost:${PORT}/5-browser-extension/2-forms-browsers-local-storage/harness.html`);
  assert('harness returns HTTP 200', harnessRes.status() === 200, `status=${harnessRes.status()}`);

  const hasHarnessImg = await harnessPage.evaluate(() => {
    const img = document.querySelector('img#harness-img');
    return !!img;
  });
  assert('harness contains source anchor img#harness-img', hasHarnessImg);

  // ── Block 3: Repeat initialization check ────────────────────────
  console.log('\n-- Block 3: Repeat initialization (idempotency check) --');
  const initState1 = await harnessPage.evaluate(() => window.FormLifecycle.getState());
  assert('harness initial state is initialized', initState1.initialized === true);
  assert('single badge rendered on first init', initState1.badgeCount === 1, `count=${initState1.badgeCount}`);
  assert('single form rendered on first init', initState1.formCount === 1, `count=${initState1.formCount}`);

  // Call init() a second time to simulate repeat initialization
  const reinitResult = await harnessPage.evaluate(() => window.FormLifecycle.init());
  assert('second init() flags duplicatePrevented', reinitResult.duplicatePrevented === true, `result=${JSON.stringify(reinitResult)}`);

  const initState2 = await harnessPage.evaluate(() => window.FormLifecycle.getState());
  assert('badge count unchanged after second init (no duplication)', initState2.badgeCount === 1, `count=${initState2.badgeCount}`);
  assert('form count unchanged after second init (no duplication)', initState2.formCount === 1, `count=${initState2.formCount}`);

  // ── Block 4: Form submit validation without duplication ────────
  console.log('\n-- Block 4: Form validation and repeated submission --');
  // Attempt to submit empty form
  await harnessPage.click('#submit-btn');

  const errorText = await harnessPage.evaluate(() => {
    const el = document.getElementById('error-message');
    return el ? el.textContent.trim() : '';
  });
  assert('validation error shown on empty submit', errorText.length > 0, `msg="${errorText}"`);

  // Submit again while empty: should not create duplicate error nodes
  await harnessPage.click('#submit-btn');
  const errorNodeCount = await harnessPage.evaluate(() => document.querySelectorAll('#error-message').length);
  assert('error message element not duplicated on second invalid submit', errorNodeCount === 1, `count=${errorNodeCount}`);

  // ── Block 5: Valid form submission and interaction ──────────────
  console.log('\n-- Block 5: Valid submission and reset lifecycle --');
  await harnessPage.fill('#region', 'US-CA');
  await harnessPage.fill('#api', 'demo-api-key-12345');
  await harnessPage.click('#submit-btn');

  const resultVisible = await harnessPage.evaluate(() => {
    const box = document.getElementById('result-box');
    return box && window.getComputedStyle(box).display !== 'none';
  });
  assert('results displayed after valid submit', resultVisible);

  const stateAfterSubmit = await harnessPage.evaluate(() => window.FormLifecycle.getState());
  assert('submit counter incremented predictably', stateAfterSubmit.submitCount >= 1, `count=${stateAfterSubmit.submitCount}`);

  // Test reset / change region button
  await harnessPage.click('#reset-btn');
  const formVisibleAfterReset = await harnessPage.evaluate(() => {
    const form = document.getElementById('carbon-form');
    return form && window.getComputedStyle(form).display !== 'none';
  });
  assert('form visible again after reset', formVisibleAfterReset);

  // ── Block 6: Teardown and timer cleanup ──────────────────────────
  console.log('\n-- Block 6: Teardown and cleanup of active timers/listeners --');
  const teardownResult = await harnessPage.evaluate(() => window.FormLifecycle.teardown());
  assert('teardown reports zero remaining timers', teardownResult.activeTimersRemaining === 0, `timers=${teardownResult.activeTimersRemaining}`);

  const postTeardownState = await harnessPage.evaluate(() => window.FormLifecycle.getState());
  assert('lifecycle state is torn down', postTeardownState.initialized === false);
  assert('status badge removed on teardown', postTeardownState.badgeCount === 0);

  // ── Block 7: Zero uncaught page errors ───────────────────────────
  console.log('\n-- Block 7: Zero uncaught page errors --');
  assert('zero uncaught page errors logged', errors.length === 0, errors.join('; '));

  await harnessPage.screenshot({ path: join(ROOT, 'work/R59-T034/screenshot-harness.png') });
  await harnessPage.close();

} finally {
  await browser.close();
  server.close();
}

console.log(`\n[R59-T034] Results: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);

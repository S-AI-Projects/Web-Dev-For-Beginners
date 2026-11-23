import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

if (process.argv.includes('--failure-probe')) {
  assert.fail('deliberate assertion failure probe');
}

const root = process.cwd();
const evidenceDir = resolve(root, 'work/R59-T049');
const evidencePrefix = process.env.EVIDENCE_PREFIX ?? 'results';

async function unusedPort() {
  const server = createServer();
  await new Promise((resolveListen, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolveListen);
  });
  const { port } = server.address();
  await new Promise((resolveClose, reject) => server.close((error) => error ? reject(error) : resolveClose()));
  return port;
}

async function waitForServer(url, serverProcess) {
  const deadline = Date.now() + 10000;
  let output = '';
  serverProcess.stdout.on('data', (chunk) => { output += chunk; });
  serverProcess.stderr.on('data', (chunk) => { output += chunk; });
  while (Date.now() < deadline) {
    if (serverProcess.exitCode !== null) throw new Error(`Local server exited early: ${output}`);
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await delay(100);
  }
  throw new Error(`Local server was not ready: ${output}`);
}

async function inspectViewport(browser, baseUrl, width, height) {
  const pageErrors = [];
  const geometry = {};
  for (const reducedMotion of ['no-preference', 'reduce']) {
    const context = await browser.newContext({ viewport: { width, height }, reducedMotion });
    const page = await context.newPage();
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForFunction(() => Array.from(document.images).every((image) => image.complete));
    const state = await page.evaluate(() => {
      const selectors = ['#page', '#plant-selection', '#left-container', '#plant1'];
      const elements = Object.fromEntries(selectors.map((selector) => {
        const element = document.querySelector(selector);
        if (!element) return [selector, null];
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return [selector, {
          rendered: style.display !== 'none' && style.visibility !== 'hidden',
          hasBox: rect.width > 0 && rect.height > 0,
          rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
          animationName: style.animationName,
          animationDuration: style.animationDuration,
        }];
      }));
      const plant = document.querySelector('#plant1');
      const transitionDurations = Object.fromEntries(['nav li a', 'footer a'].map((selector) => {
        const element = document.querySelector(selector);
        return [selector, element ? getComputedStyle(element).transitionDuration : null];
      }));
      return {
        reducedMotionMatches: matchMedia('(prefers-reduced-motion: reduce)').matches,
        elements,
        transitionDurations,
        plantLoaded: plant.complete && plant.naturalWidth > 0,
      };
    });
    assert.equal(state.reducedMotionMatches, reducedMotion === 'reduce');
    for (const [selector, element] of Object.entries(state.elements)) {
      assert.ok(element, `${selector} exists`);
      assert.ok(element.rendered, `${selector} is not hidden`);
      assert.equal(element.animationName, 'none', `${selector} has no animation`);
    }
    for (const selector of ['#page', '#left-container', '#plant1']) {
      assert.ok(state.elements[selector].hasBox, `${selector} has visible rendered dimensions`);
    }
    assert.ok(state.plantLoaded, '#plant1 image loaded');
    if (reducedMotion === 'no-preference') {
      geometry.normal = state.elements;
      geometry.normalTransitions = state.transitionDurations;
    } else {
      geometry.reduced = state.elements;
      geometry.reducedTransitions = state.transitionDurations;
      assert.deepEqual(state.elements, geometry.normal, 'reduced motion preserves the static layout');
      for (const [selector, duration] of Object.entries(state.transitionDurations)) {
        assert.equal(Number.parseFloat(duration), 0, `${selector} transition is disabled for reduced motion`);
      }
      await page.keyboard.press('Tab');
      const focus = await page.evaluate(() => {
        const element = document.activeElement;
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return {
          tag: element.tagName,
          inNavigation: Boolean(element.closest('nav')),
          backgroundColor: style.backgroundColor,
          boxShadow: style.boxShadow,
          outlineStyle: style.outlineStyle,
          rect: { x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom },
          viewport: { width: innerWidth, height: innerHeight },
        };
      });
      assert.equal(focus.tag, 'A', 'Tab focuses a link');
      assert.ok(focus.inNavigation, 'the first Tab stop is the navigation');
      assert.ok(focus.backgroundColor !== 'rgba(0, 0, 0, 0)' || focus.boxShadow !== 'none' || focus.outlineStyle !== 'none', 'keyboard focus has a visible indicator');
      assert.ok(focus.rect.x >= 0 && focus.rect.y >= 0 && focus.rect.right <= width && focus.rect.bottom <= height, 'focused link remains in the viewport');
      await page.screenshot({ path: resolve(evidenceDir, `${evidencePrefix}-${width}x${height}.png`) });
      geometry.focus = focus;
    }
    await context.close();
  }
  assert.deepEqual(pageErrors, [], 'page has no unexpected JavaScript errors');
  return { width, height, ...geometry, pageErrors };
}

await import('node:fs/promises').then(({ mkdir }) => mkdir(evidenceDir, { recursive: true }));
const port = await unusedPort();
const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1', '--directory', resolve(root, '3-terrarium/solution')], { stdio: ['ignore', 'pipe', 'pipe'] });
let browser;
try {
  const baseUrl = `http://127.0.0.1:${port}/`;
  await waitForServer(baseUrl, server);
  browser = await chromium.launch({ headless: true });
  const results = [];
  for (const [width, height] of [[360, 800], [1280, 800]]) {
    results.push(await inspectViewport(browser, baseUrl, width, height));
  }
  console.log(JSON.stringify({ url: baseUrl, results }, null, 2));
} finally {
  if (browser) await browser.close();
  server.kill('SIGTERM');
  await Promise.race([new Promise((resolveExit) => server.once('exit', resolveExit)), delay(2000)]);
}

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { cp, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright';

if (process.argv.includes('--failure-probe')) assert.fail('deliberate assertion failure probe');

const root = process.cwd();
const evidenceDir = resolve(root, 'work/R59-T050');
const prefix = process.env.EVIDENCE_PREFIX ?? 'results';
const baselineMode = process.argv.includes('--baseline');

async function unusedPort() {
  const server = createServer();
  await new Promise((resolveListen, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolveListen);
  });
  const port = server.address().port;
  await new Promise((resolveClose, reject) => server.close((error) => error ? reject(error) : resolveClose()));
  return port;
}

async function startServer(directory) {
  const port = await unusedPort();
  const child = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1', '--directory', directory], { stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk; });
  child.stderr.on('data', (chunk) => { output += chunk; });
  const url = `http://127.0.0.1:${port}/`;
  const deadline = Date.now() + 10000;
  try {
    while (Date.now() < deadline) {
      if (child.exitCode !== null) throw new Error(`Local server exited early: ${output}`);
      try {
        if ((await fetch(url)).ok) return { process: child, url };
      } catch {}
      await delay(100);
    }
    throw new Error(`Local server was not ready: ${output}`);
  } catch (error) {
    await stopServer(child);
    throw error;
  }
}

async function stopServer(server) {
  if (!server || server.exitCode !== null) return;
  const exitPromise = new Promise((resolveExit) => server.once('exit', resolveExit));
  server.kill('SIGTERM');
  const exited = await Promise.race([exitPromise.then(() => true), delay(2000).then(() => false)]);
  if (!exited && server.exitCode === null) {
    const forcedExit = new Promise((resolveExit) => server.once('exit', resolveExit));
    server.kill('SIGKILL');
    await Promise.race([forcedExit, delay(2000)]);
  }
}

async function inspect(browser, url, width, height, { mutation = false } = {}) {
  const context = await browser.newContext({ viewport: { width, height } });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForFunction(() => Array.from(document.images).every((image) => image.complete));
    const before = await page.evaluate(() => {
      const plant = document.querySelector('#plant1');
      const rect = plant.getBoundingClientRect();
      return {
        title: document.querySelector('h1')?.innerText.trim(),
        pagePresent: Boolean(document.querySelector('#page')),
        selectionPresent: Boolean(document.querySelector('#plant-selection')),
        selectionLabel: document.querySelector('#plant-selection')?.getAttribute('aria-label'),
        leftContainerRole: document.querySelector('#left-container')?.getAttribute('role'),
        leftContainerLabel: document.querySelector('#left-container')?.getAttribute('aria-label'),
        plantAlt: plant?.alt,
        plantLoaded: plant?.complete && plant.naturalWidth > 0,
        imageAlts: Array.from(document.querySelectorAll('#plant-selection img.plant'), (image) => image.alt),
        initialPosition: { left: plant.style.left, top: plant.style.top, x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        mainPresent: Boolean(document.querySelector('main')),
        terrariumPresent: Boolean(document.querySelector('#terrarium')),
      };
    });
    assert.ok(before.pagePresent && before.selectionPresent && before.mainPresent && before.terrariumPresent, 'main page structure is present');
    assert.ok(before.plantLoaded, '#plant1 image loaded');
    if (!baselineMode) {
      assert.equal(before.selectionLabel, 'Available plants');
      assert.equal(before.leftContainerRole, 'group');
      assert.equal(before.leftContainerLabel, 'Left plant choices');
      assert.equal(before.imageAlts.length, 14);
      assert.ok(before.imageAlts.every((alt) => alt.trim().length > 12), 'all plant images have descriptive alt text');
      assert.equal(new Set(before.imageAlts).size, 14, 'each plant has a distinct description');
    }
    const shotName = `${prefix}-${width}x${height}${mutation ? '-mutated' : ''}.png`;
    if (!mutation) await page.screenshot({ path: resolve(evidenceDir, shotName) });
    const startX = before.initialPosition.x + before.initialPosition.width / 2;
    const startY = before.initialPosition.y + before.initialPosition.height / 2;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 24, startY + 18, { steps: 4 });
    await page.mouse.up();
    const after = await page.locator('#plant1').evaluate((plant) => ({ left: plant.style.left, top: plant.style.top }));
    const moved = after.left !== before.initialPosition.left || after.top !== before.initialPosition.top;
    let mutationDetected = false;
    if (mutation) {
      assert.equal(moved, false, 'mutated fixture has no plant1 drag binding');
      assert.throws(
        () => assert.equal(moved, true, 'pointer drag moves plant1'),
        (error) => error.name === 'AssertionError' && error.message.includes('pointer drag moves plant1'),
        'the normal movement assertion rejects the mutated fixture',
      );
      mutationDetected = true;
    }
    else if (!baselineMode) assert.equal(moved, true, 'pointer drag moves plant1');
    assert.deepEqual(pageErrors, [], 'page has no unexpected JavaScript errors');
    return { width, height, before, after, moved, mutationDetected, pageErrors };
  } finally {
    await context.close();
  }
}

await mkdir(evidenceDir, { recursive: true });
const actualServer = await startServer(resolve(root, '3-terrarium/solution'));
let mutationServer;
let browser;
let fixtureDir;
try {
  browser = await chromium.launch({ headless: true });
  if (baselineMode) {
    const observations = [];
    for (const [width, height] of [[360, 800], [1280, 800]]) observations.push(await inspect(browser, actualServer.url, width, height));
    console.log(JSON.stringify({ mode: 'baseline-before-source-change', observations }, null, 2));
  } else {
    const actual = [];
    for (const [width, height] of [[360, 800], [1280, 800]]) actual.push(await inspect(browser, actualServer.url, width, height));

    fixtureDir = await mkdtemp(join(tmpdir(), 'r59-t050-mutated-'));
    for (const file of ['index.html', 'style.css', 'script.js']) await cp(resolve(root, '3-terrarium/solution', file), join(fixtureDir, file));
    await cp(resolve(root, '3-terrarium/solution/images'), join(fixtureDir, 'images'), { recursive: true });
    const scriptPath = join(fixtureDir, 'script.js');
    const script = await readFile(scriptPath, 'utf8');
    const binding = "dragElement(document.getElementById('plant1'));";
    assert.equal(script.split(binding).length - 1, 1, 'fixture contains exactly one plant1 binding');
    await writeFile(scriptPath, script.replace(binding, '// deliberate temporary regression: plant1 binding removed'), 'utf8');
    mutationServer = await startServer(fixtureDir);
    const mutated = await inspect(browser, mutationServer.url, 360, 800, { mutation: true });
    console.log(JSON.stringify({ actual, mutation: { ...mutated, expected: 'plant1 remains stationary because its binding was removed' } }, null, 2));
  }
} finally {
  if (browser) await browser.close();
  await stopServer(mutationServer?.process);
  await stopServer(actualServer.process);
  if (fixtureDir) await rm(fixtureDir, { recursive: true, force: true });
}

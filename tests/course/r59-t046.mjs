import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchChromium, startStaticServer } from './browser-support.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const extensionRoot = resolve(repoRoot, '5-browser-extension/start/dist');
const entryPath = '/5-browser-extension/start/dist/index.html';
const results = [];
let server;
let browser;
let failure;
let manifest;

try {
  manifest = JSON.parse(await readFile(resolve(extensionRoot, 'manifest.json'), 'utf8'));
  const backgroundSource = await readFile(resolve(extensionRoot, manifest.background.service_worker), 'utf8');
  server = await startStaticServer(repoRoot);
  browser = await launchChromium();

  for (const width of [360, 1280]) {
    const context = await browser.newContext({ viewport: { width, height: 800 } });
    try {
      const page = await context.newPage();
      const pageErrors = [];
      const failedRequests = [];
      const assetResponses = [];
      page.on('pageerror', (error) => pageErrors.push(error.message));
      page.on('requestfailed', (request) => failedRequests.push(request.url()));
      page.on('response', (response) => {
        if (response.url().includes('/5-browser-extension/start/dist/')) {
          assetResponses.push({ path: new URL(response.url()).pathname, status: response.status() });
        }
      });

      await page.goto(`${server.origin}${entryPath}`, { waitUntil: 'networkidle' });
      const actual = await page.evaluate(() => {
        const image = document.querySelector('img');
        const imageBox = image.getBoundingClientRect();
        const heading = document.querySelector('h1');
        return {
          title: document.title,
          heading: heading?.textContent.trim(),
          headingVisible: Boolean(heading?.getClientRects().length),
          imageAlt: image?.alt,
          imageLoaded: image?.complete && image.naturalWidth > 0,
          imageNaturalSize: { width: image?.naturalWidth, height: image?.naturalHeight },
          imageBox: { x: imageBox.x, y: imageBox.y, width: imageBox.width, height: imageBox.height, right: imageBox.right },
          documentWidth: document.documentElement.scrollWidth,
          viewportWidth: innerWidth,
          runtimeMessageApiAvailable: Boolean(globalThis.chrome?.runtime?.sendMessage),
        };
      });
      const record = {
        input: { entryPoint: entryPath, viewport: `${width}x800`, mode: 'static local preview' },
        expected: {
          title: 'My Carbon Trigger',
          heading: 'Welcome to Your Personal Carbon Trigger!',
          descriptiveImageAlt: 'plants and people',
          imageLoads: true,
          imageInsideViewport: true,
          noHorizontalOverflow: true,
          extensionRuntimeApiAvailable: false,
          noPageErrors: true,
        },
        actual: { ...actual, assetResponses, failedRequests, pageErrors },
      };
      results.push(record);

      assert.equal(actual.title, record.expected.title);
      assert.equal(actual.heading, record.expected.heading);
      assert.equal(actual.headingVisible, true, 'the welcome heading must be visible');
      assert.equal(actual.imageAlt, record.expected.descriptiveImageAlt);
      assert.equal(actual.imageLoaded, true, 'the popup illustration must load');
      assert.ok(actual.imageBox.width > 0 && actual.imageBox.height > 0, 'the image must have a visible layout box');
      assert.ok(actual.imageBox.x >= 0 && actual.imageBox.right <= width,
        `the illustration must fit within the ${width}px viewport`);
      assert.ok(actual.documentWidth <= width, `the page must not overflow at ${width}px`);
      assert.equal(actual.runtimeMessageApiAvailable, false,
        'a static preview must not pretend to provide the extension runtime');
      assert.equal(manifest.action.default_popup, 'index.html', 'the manifest must point to this popup entry');
      assert.equal(manifest.background.service_worker, 'background.js');
      assert.match(backgroundSource, /add listener here/i,
        'the starter worker placeholder must be described as not yet wired');
      assert.ok(assetResponses.length >= 3, 'the HTML, stylesheet, script, and illustration must be requested');
      assert.ok(assetResponses.every((response) => response.status === 200), 'walkthrough assets must load successfully');
      assert.deepEqual(failedRequests, [], 'the walkthrough must not have failed requests');
      assert.deepEqual(pageErrors, [], 'the walkthrough must not have JavaScript errors');

      const evidenceName = process.env.R59_T046_EVIDENCE ?? 'results';
      const screenshot = resolve(repoRoot, `work/R59-T046/${evidenceName}-${width}x800.png`);
      await mkdir(dirname(screenshot), { recursive: true });
      await page.screenshot({ path: screenshot, fullPage: true });
      record.actual.screenshot = `work/R59-T046/${evidenceName}-${width}x800.png`;
    } catch (error) {
      failure ??= error;
      const lastResult = results.at(-1);
      if (lastResult?.input.viewport !== `${width}x800`) {
        results.push({ input: { viewport: `${width}x800` }, failure: error.message });
      } else {
        lastResult.failure = error.message;
      }
    } finally {
      await context.close();
    }
  }
} catch (error) {
  failure ??= error;
} finally {
  if (browser) await browser.close();
  if (server) await server.close();
  const packageJson = JSON.parse(await readFile(resolve(repoRoot, 'tests/course/package.json'), 'utf8'));
  const evidenceName = process.env.R59_T046_EVIDENCE ?? 'results';
  const evidence = {
    task: 'R59-T046',
    command: 'node tests/course/r59-t046.mjs',
    tools: { node: process.version, playwright: packageJson.devDependencies.playwright, browser: browser?.version() ?? null },
    manifest: { popup: '5-browser-extension/start/dist/index.html', worker: manifest?.background?.service_worker ?? 'background.js' },
    results,
    failure: failure?.message ?? null,
  };
  const evidencePath = resolve(repoRoot, `work/R59-T046/${evidenceName}.json`);
  await mkdir(dirname(evidencePath), { recursive: true });
  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
}

if (failure) {
  console.error(`R59-T046 failed: ${failure.message}`);
  process.exitCode = 1;
} else {
  console.log('R59-T046 walkthrough passed at 360x800 and 1280x800.');
}

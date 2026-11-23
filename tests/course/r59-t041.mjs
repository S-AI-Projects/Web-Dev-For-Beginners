import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchChromium, startStaticServer } from './browser-support.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const pagePath = '/3-terrarium/solution/index.html';
const results = [];
let server;
let browser;
let failure;

try {
  server = await startStaticServer(repoRoot);
  browser = await launchChromium();

  for (const width of [360, 1280]) {
    const context = await browser.newContext({ viewport: { width, height: 800 } });
    try {
      const page = await context.newPage();
      const pageErrors = [];
      page.on('pageerror', (error) => pageErrors.push(error.message));
      await page.goto(`${server.origin}${pagePath}`, { waitUntil: 'networkidle' });

      const before = await page.locator('#plant1').boundingBox();
      assert.ok(before && before.width > 0 && before.height > 0, 'plant1 must be rendered');
      await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2);
      await page.mouse.down();
      await page.mouse.move(before.x + before.width / 2 + 30, before.y + before.height / 2 + 20);
      await page.mouse.up();

      const after = await page.locator('#plant1').boundingBox();
      const actual = await page.evaluate(() => {
        const rect = (selector) => {
          const element = document.querySelector(selector);
          return element ? element.getBoundingClientRect().toJSON() : null;
        };
        const images = [...document.querySelectorAll('#plant-selection img.plant')];
        const navLinks = [...document.querySelectorAll('nav a')];
        return {
          viewportWidth: innerWidth,
          documentWidth: document.documentElement.scrollWidth,
          page: rect('#page'),
          selection: rect('#plant-selection'),
          selectionDisplay: getComputedStyle(document.querySelector('#plant-selection')).display,
          left: rect('#left-container'),
          right: rect('#right-container'),
          terrarium: rect('#terrarium-section'),
          imageCount: images.length,
          unloadedImages: images.filter((image) => !image.complete || image.naturalWidth === 0)
            .map((image) => image.id),
          navLinkCount: navLinks.length,
          clippedNavLinks: navLinks.filter((link) => {
            const box = link.getBoundingClientRect();
            return box.left < 0 || box.right > innerWidth;
          }).map((link) => link.textContent.trim()),
          mainOrder: [...document.querySelector('main').children]
            .map((element) => element.id),
          moveHandlerAfterRelease: document.onpointermove === null,
          releaseHandlerAfterRelease: document.onpointerup === null,
        };
      });
      const drag = {
        x: Number((after.x - before.x).toFixed(1)),
        y: Number((after.y - before.y).toFixed(1)),
      };

      results.push({
        input: { viewport: `${width}x800`, dragDelta: { x: 30, y: 20 } },
        expected: {
          noHorizontalOverflow: true,
          visibleSelection: true,
          allPlantImagesLoaded: true,
          navLinksNotClipped: true,
          contentOrder: ['plant-selection', 'terrarium-section'],
          dragDelta: { x: 30, y: 20 },
          pointerHandlersRemovedOnRelease: true,
          noPageErrors: true,
        },
        actual: { ...actual, drag, pageErrors },
      });

      assert.ok(actual.documentWidth <= width,
        `unexpected horizontal overflow at ${width}px: document is ${actual.documentWidth}px wide`);
      assert.ok(actual.left && actual.right && actual.terrarium, 'both plant groups and the terrarium must render');
      if (width <= 700) {
        assert.ok(actual.selection?.height > 0, 'mobile plant selection must occupy layout space');
        assert.ok(actual.selection.bottom <= actual.terrarium.top,
          'mobile plant selection must appear before the terrarium');
      } else {
        assert.equal(actual.selectionDisplay, 'contents', 'desktop sidebars must participate in the main grid');
        assert.ok(actual.left.right <= actual.terrarium.left && actual.terrarium.right <= actual.right.left,
          'desktop content must read left plants, terrarium, right plants');
      }
      for (const [name, box] of Object.entries({ left: actual.left, right: actual.right, terrarium: actual.terrarium })) {
        assert.ok(box.left >= 0 && box.right <= width,
          `${name} must fit within the ${width}px viewport`);
      }
      assert.equal(actual.imageCount, 14, 'all fourteen plants must remain in the demo');
      assert.deepEqual(actual.unloadedImages, [], 'plant assets must load');
      assert.equal(actual.navLinkCount, 5, 'all five navigation links must remain visible');
      assert.deepEqual(actual.clippedNavLinks, [], 'navigation links must not be clipped');
      assert.deepEqual(actual.mainOrder, ['plant-selection', 'terrarium-section'], 'main content order must remain stable');
      assert.deepEqual(drag, { x: 30, y: 20 }, 'pointer movement must update the dragged plant position');
      assert.equal(actual.moveHandlerAfterRelease, true, 'pointer-move handler must be cleared on release');
      assert.equal(actual.releaseHandlerAfterRelease, true, 'pointer-up handler must be cleared on release');
      assert.deepEqual(pageErrors, [], 'the page must not report runtime errors');
      const screenshotPath = resolve(repoRoot, `work/R59-T041/viewport-${width}x800.png`);
      await mkdir(dirname(screenshotPath), { recursive: true });
      await page.screenshot({ path: screenshotPath, fullPage: true });
      results.at(-1).actual.screenshot = `work/R59-T041/viewport-${width}x800.png`;
    } catch (error) {
      failure ??= error;
      const lastResult = results.at(-1);
      if (lastResult?.input.viewport === `${width}x800`) {
        lastResult.failure = error.message;
      } else {
        results.push({ input: { viewport: `${width}x800` }, failure: error.message });
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
  const evidence = {
    task: 'R59-T041',
    command: 'node tests/course/r59-t041.mjs',
    tools: { node: process.version, playwright: packageJson.devDependencies.playwright, browser: browser?.version() ?? null },
    results,
    failure: failure?.message ?? null,
  };
  const evidenceName = process.env.R59_T041_EVIDENCE ?? 'results';
  const evidencePath = resolve(repoRoot, `work/R59-T041/${evidenceName}.json`);
  await mkdir(dirname(evidencePath), { recursive: true });
  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
}

if (failure) {
  console.error(`R59-T041 failed: ${failure.message}`);
  process.exitCode = 1;
} else {
  console.log(`R59-T041 passed at 360x800 and 1280x800; evidence: work/R59-T041/results.json`);
}

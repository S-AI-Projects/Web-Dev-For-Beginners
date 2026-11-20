// R59-T001: keyboard regression test for the terrarium plants.
// Run with: node tests/course/r59-t001.mjs
// Set R59_LABEL=baseline to name the evidence files for a run on the original code.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const require = createRequire(import.meta.url);
const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
// R59_SERVE_ROOT lets the baseline run serve a copy of the original files.
const ROOT = process.env.R59_SERVE_ROOT
	? path.resolve(process.env.R59_SERVE_ROOT) + path.sep
	: REPO_ROOT;
const PAGE_PATH = '/3-terrarium/solution/index.html';
const LABEL = process.env.R59_LABEL || 'changed';
const EVIDENCE_DIR = path.join(REPO_ROOT, 'work', 'R59-T001');
const STEP = 10;

const MIME = {
	'.html': 'text/html; charset=utf-8',
	'.js': 'text/javascript; charset=utf-8',
	'.css': 'text/css; charset=utf-8',
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.svg': 'image/svg+xml',
	'.json': 'application/json',
};

const results = [];
let failed = false;

// ---- recording helpers: every check is saved and printed ----
function record(name, expected, actual, ok) {
	results.push({ name, expected, actual, passed: ok });
	if (!ok) failed = true;
	console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
	if (!ok) {
		console.log(`      expected: ${JSON.stringify(expected)}`);
		console.log(`      actual:   ${JSON.stringify(actual)}`);
	}
}

function check(name, expected, actual) {
	try {
		assert.deepStrictEqual(actual, expected);
		record(name, expected, actual, true);
	} catch {
		record(name, expected, actual, false);
	}
}

function checkClose(name, expected, actual, tolerance = 1) {
	record(name, expected, actual, Math.abs(actual - expected) <= tolerance);
}

// ---- a tiny static web server for the course files ----
function startServer() {
	const server = http.createServer((req, res) => {
		const urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
		const filePath = path.join(ROOT, path.normalize(urlPath));
		if (!filePath.startsWith(ROOT)) {
			res.writeHead(403);
			res.end();
			return;
		}
		fs.readFile(filePath, (err, data) => {
			if (err) {
				res.writeHead(404);
				res.end('Not found');
				return;
			}
			res.writeHead(200, {
				'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream',
			});
			res.end(data);
		});
	});
	return new Promise((resolve) => {
		server.listen(0, '127.0.0.1', () => resolve(server));
	});
}

async function waitForReady(url) {
	for (let i = 0; i < 50; i++) {
		try {
			const response = await fetch(url);
			if (response.ok) return;
		} catch {
			// server not ready yet, try again
		}
		await new Promise((r) => setTimeout(r, 100));
	}
	throw new Error(`Server did not become ready: ${url}`);
}

// ---- small helpers for reading the page ----
const activeName = (page) =>
	page.evaluate(() => {
		const el = document.activeElement;
		return el ? el.id || el.className || el.tagName.toLowerCase() : null;
	});
const box = async (page, id) => {
	const b = await page.locator('#' + id).boundingBox();
	return { x: b.x, y: b.y };
};
const layoutPos = (page, id) =>
	page.locator('#' + id).evaluate((el) => ({ x: el.offsetLeft, y: el.offsetTop }));
const pressed = (page, id) => page.locator('#' + id).getAttribute('aria-pressed');
const outline = (page, selector) =>
	page.locator(selector).evaluate((el) => {
		const s = getComputedStyle(el);
		return { style: s.outlineStyle, width: parseFloat(s.outlineWidth) };
	});

async function main() {
	fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
	const server = await startServer();
	const origin = `http://127.0.0.1:${server.address().port}`;
	const url = origin + PAGE_PATH;
	let browser;
	let chromiumVersion = 'unknown';

	try {
		await waitForReady(url);
		browser = await chromium.launch();
		chromiumVersion = browser.version();

		// A fresh browser context: no cookies, storage or cache from earlier runs.
		const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });

		// Anything not served by our local server (icon fonts, CDNs) gets an empty reply,
		// so the test runs offline and gives the same result every time.
		await context.route('**/*', (route) => {
			const request = route.request();
			if (request.url().startsWith(origin)) return route.continue();
			const type = request.resourceType();
			const contentType =
				type === 'stylesheet' ? 'text/css' : type === 'script' ? 'text/javascript' : 'text/plain';
			return route.fulfill({ status: 200, contentType, body: '' });
		});

		const page = await context.newPage();
		const pageErrors = [];
		page.on('pageerror', (e) => pageErrors.push(`pageerror: ${e.message}`));
		page.on('console', (m) => {
			if (m.type() === 'error') pageErrors.push(`console.error: ${m.text()}`);
		});
		page.on('requestfailed', (r) => {
			if (r.url().startsWith(origin)) pageErrors.push(`requestfailed: ${r.url()}`);
		});

		await page.goto(url, { waitUntil: 'load' });

		// ---- 1. Structure ----
		const setup = await page.evaluate(() => {
			const plants = [...document.querySelectorAll('.plant')];
			return {
				count: plants.length,
				allFocusable: plants.every(
					(p) => p.getAttribute('tabindex') === '0' && p.getAttribute('role') === 'button'
				),
				allNotPressed: plants.every((p) => p.getAttribute('aria-pressed') === 'false'),
				positiveTabindex: [...document.querySelectorAll('[tabindex]')].filter(
					(e) => Number(e.getAttribute('tabindex')) > 0
				).length,
			};
		});
		check('14 plants are on the page', 14, setup.count);
		check('every plant has tabindex="0" and role="button"', true, setup.allFocusable);
		check('every plant starts with aria-pressed="false"', true, setup.allNotPressed);
		check('no positive tabindex anywhere', 0, setup.positiveTabindex);

		// ---- 2. Skip link ----
		const skipTopBefore = await page.locator('.skip-link').evaluate((el) => el.getBoundingClientRect().top);
		record('skip link is hidden off-screen before focus', '< 0', skipTopBefore, skipTopBefore < 0);

		await page.keyboard.press('Tab');
		check('first Tab focuses the skip link', 'skip-link', await activeName(page));
		await page.waitForFunction(() => document.querySelector('.skip-link').getBoundingClientRect().top >= 0);
		const skipTopFocused = await page.locator('.skip-link').evaluate((el) => el.getBoundingClientRect().top);
		record('skip link is visible when focused', '>= 0', skipTopFocused, skipTopFocused >= 0);
		const skipOutline = await outline(page, '.skip-link');
		check('focused skip link has a solid outline', 'solid', skipOutline.style);

		await page.keyboard.press('Enter');
		check('Enter on the skip link moves focus to #plant-selection', 'plant-selection', await activeName(page));
		check('URL hash is #plant-selection', '#plant-selection', new URL(page.url()).hash);

		// ---- 3. Tab order and visible focus ----
		const expectedOrder = Array.from({ length: 14 }, (_, i) => `plant${i + 1}`);
		const order = [];
		for (let i = 0; i < 14; i++) {
			await page.keyboard.press('Tab');
			order.push(await activeName(page));
		}
		check('Tab visits plant1 to plant14 in order', expectedOrder, order);
		for (let i = 0; i < 13; i++) await page.keyboard.press('Shift+Tab');
		check('Shift+Tab returns to plant1', 'plant1', await activeName(page));

		const focusOutline = await outline(page, '#plant1');
		check('focused plant has a solid outline', 'solid', focusOutline.style);
		record('focused plant outline is at least 2px wide', '>= 2', focusOutline.width, focusOutline.width >= 2);
		await page.screenshot({ path: path.join(EVIDENCE_DIR, `${LABEL}-focused.png`) });

		// ---- 4. Pick-up / drop state and position updates ----
		const start = await box(page, 'plant1');
		await page.keyboard.press('ArrowRight');
		check('arrow key does nothing before pick-up', start, await box(page, 'plant1'));

		await page.keyboard.press('Enter');
		check('Enter picks up the plant (aria-pressed)', 'true', await pressed(page, 'plant1'));
		const pickedOutline = await outline(page, '#plant1');
		check('picked-up plant shows a dashed outline', 'dashed', pickedOutline.style);
		await page.screenshot({ path: path.join(EVIDENCE_DIR, `${LABEL}-picked-up.png`) });

		for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight');
		let now = await box(page, 'plant1');
		checkClose('3 x ArrowRight moves 30px right', start.x + 3 * STEP, now.x);
		checkClose('ArrowRight leaves y unchanged', start.y, now.y);

		for (let i = 0; i < 2; i++) await page.keyboard.press('ArrowDown');
		now = await box(page, 'plant1');
		checkClose('2 x ArrowDown moves 20px down', start.y + 2 * STEP, now.y);

		await page.keyboard.press('ArrowLeft');
		now = await box(page, 'plant1');
		checkClose('ArrowLeft moves 10px left', start.x + 2 * STEP, now.x);

		await page.keyboard.press('ArrowUp');
		now = await box(page, 'plant1');
		checkClose('ArrowUp moves 10px up', start.y + STEP, now.y);

		// Space drops it
		await page.keyboard.press('Space');
		check('Space drops the plant', 'false', await pressed(page, 'plant1'));
		const droppedOutline = await outline(page, '#plant1');
		check('dropped plant shows the focus outline again', 'solid', droppedOutline.style);
		const dropped = await box(page, 'plant1');
		await page.keyboard.press('ArrowRight');
		check('arrow key does nothing after drop', dropped, await box(page, 'plant1'));

		// Escape drops it
		await page.keyboard.press('Space');
		check('Space picks the plant up again', 'true', await pressed(page, 'plant1'));
		await page.keyboard.press('Escape');
		check('Escape drops the plant', 'false', await pressed(page, 'plant1'));
		const afterEscape = await box(page, 'plant1');
		await page.keyboard.press('ArrowDown');
		check('arrow key does nothing after Escape', afterEscape, await box(page, 'plant1'));

		// ---- 5. Cleanup when focus leaves ----
		await page.keyboard.press('Enter');
		check('plant1 picked up before tabbing away', 'true', await pressed(page, 'plant1'));
		await page.keyboard.press('Tab');
		check('Tab moves focus to plant2', 'plant2', await activeName(page));
		check('plant1 is dropped when focus leaves it', 'false', await pressed(page, 'plant1'));
		check('plant2 is not picked up (state is per plant)', 'false', await pressed(page, 'plant2'));
		await page.keyboard.press('Shift+Tab');
		check('Shift+Tab returns to plant1', 'plant1', await activeName(page));
		const afterBlur = await box(page, 'plant1');
		await page.keyboard.press('ArrowRight');
		check('arrow key does nothing after focus returns', afterBlur, await box(page, 'plant1'));

		// ---- 6. Mouse dragging still works and cleans up ----
		// Positions here use offsetLeft/offsetTop (layout coordinates). The skip-link
		// step above scrolls the page, which would shift window coordinates.
		await page.evaluate(() => window.scrollTo(0, 0));
		const p8Box = await page.locator('#plant8').boundingBox();
		const cx = p8Box.x + p8Box.width / 2;
		const cy = p8Box.y + p8Box.height / 2;
		const p8Start = await layoutPos(page, 'plant8');
		await page.mouse.move(cx, cy);
		await page.mouse.down();
		await page.mouse.move(cx - 60, cy + 40, { steps: 10 });
		await page.mouse.up();
		const p8After = await layoutPos(page, 'plant8');
		checkClose('mouse drag moves plant8 60px left', p8Start.x - 60, p8After.x, 2);
		checkClose('mouse drag moves plant8 40px down', p8Start.y + 40, p8After.y, 2);

		const cleaned = await page.evaluate(
			() => document.onpointermove === null && document.onpointerup === null
		);
		check('pointer handlers are removed after mouse up', true, cleaned);
		await page.mouse.move(cx - 200, cy + 100);
		check('plant8 no longer follows the mouse after release', p8After, await layoutPos(page, 'plant8'));

		// ---- 7. No errors ----
		check('no page errors, console errors or failed local requests', [], pageErrors);
	} catch (err) {
		record('test run finished without crashing', 'no exception', String(err && err.message), false);
	} finally {
		const report = {
			task: 'R59-T001',
			label: LABEL,
			page: PAGE_PATH,
			versions: {
				node: process.version,
				playwright: require('playwright/package.json').version,
				chromium: chromiumVersion,
			},
			results,
		};
		fs.writeFileSync(path.join(EVIDENCE_DIR, `results-${LABEL}.json`), JSON.stringify(report, null, 2));
		if (browser) await browser.close();
		server.closeAllConnections();
		server.close();
	}
}

await main();
const passedCount = results.filter((r) => r.passed).length;
console.log(`\n${passedCount}/${results.length} checks passed (${LABEL})`);
process.exit(failed ? 1 : 0);
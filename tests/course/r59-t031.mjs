import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../..');
const workDir = path.resolve(repoRoot, 'work/R59-T031');

if (!fs.existsSync(workDir)) {
  fs.mkdirSync(workDir, { recursive: true });
}

const PORT = 8751;
let server;
let browser;

const results = {
  task: 'R59-T031',
  timestamp: new Date().toISOString(),
  checks: [],
  passed: 0,
  failed: 0
};

function recordCheck(name, pass, details) {
  results.checks.push({ name, pass, details });
  if (pass) {
    results.passed++;
    console.log(`✅ PASS: ${name} (${JSON.stringify(details)})`);
  } else {
    results.failed++;
    console.error(`❌ FAIL: ${name} (${JSON.stringify(details)})`);
  }
}

function startServer() {
  return new Promise((resolve, reject) => {
    server = http.createServer((req, res) => {
      let reqPath = req.url.split('?')[0];
      if (reqPath === '/') reqPath = '/3-terrarium/solution/index.html';
      const filePath = path.join(repoRoot, decodeURIComponent(reqPath));

      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      const mimeTypes = {
        '.html': 'text/html',
        '.js': 'application/javascript',
        '.css': 'text/css',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.svg': 'image/svg+xml',
        '.json': 'application/json'
      };
      const contentType = mimeTypes[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': contentType });
      fs.createReadStream(filePath).pipe(res);
    });

    server.listen(PORT, (err) => {
      if (err) reject(err);
      else resolve(`http://localhost:${PORT}`);
    });
  });
}

async function run() {
  try {
    const baseUrl = await startServer();
    browser = await chromium.launch({ headless: true });

    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 }
    });

    const pageErrors = [];
    const page = await context.newPage();
    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });

    const resp = await page.goto(`${baseUrl}/3-terrarium/solution/index.html`);
    recordCheck('Page responds with HTTP 200', resp.status() === 200, { status: resp.status() });

    // 1. Verify source anchors exist
    const anchorPage = await page.evaluate(() => !!document.getElementById('page'));
    const anchorSelection = await page.evaluate(() => !!document.getElementById('plant-selection'));
    const anchorLeft = await page.evaluate(() => !!document.getElementById('left-container'));
    const anchorPlant1 = await page.evaluate(() => !!document.getElementById('plant1'));
    recordCheck('Source anchors exist (#page, #plant-selection, #left-container, #plant1)',
      anchorPage && anchorSelection && anchorLeft && anchorPlant1,
      { anchorPage, anchorSelection, anchorLeft, anchorPlant1 }
    );

    // 2. Skip link off-screen initially
    const skipLinkInitialTop = await page.$eval('.skip-link', (el) => parseInt(window.getComputedStyle(el).top));
    recordCheck('Skip link is positioned off-screen initially', skipLinkInitialTop < 0, { top: skipLinkInitialTop });

    // 3. Tab to skip link and verify visible focus
    await page.keyboard.press('Tab');
    const active1 = await page.evaluate(() => document.activeElement ? document.activeElement.className : null);
    const skipLinkFocusedTop = await page.$eval('.skip-link', (el) => parseInt(window.getComputedStyle(el).top));
    const skipLinkOutline = await page.$eval('.skip-link', (el) => {
      const s = window.getComputedStyle(el);
      return { outlineStyle: s.outlineStyle, outlineWidth: s.outlineWidth };
    });

    const skipVisible = active1.includes('skip-link') && skipLinkFocusedTop >= 0 && skipLinkOutline.outlineStyle !== 'none';
    recordCheck('Tab focuses skip link and reveals it with visible outline', skipVisible, {
      active: active1,
      top: skipLinkFocusedTop,
      outline: skipLinkOutline
    });

    // 4. Activate skip link with Enter
    await page.keyboard.press('Enter');
    const hash = await page.evaluate(() => window.location.hash);
    recordCheck('Activating skip link navigates to #main anchor', hash === '#main', { hash });

    // 5. Navigate to plant1 via focus and check visible focus
    await page.focus('#plant1');
    const plant1Outline = await page.$eval('#plant1', (el) => {
      const s = window.getComputedStyle(el);
      return { outlineStyle: s.outlineStyle, outlineWidth: s.outlineWidth, outlineColor: s.outlineColor };
    });
    recordCheck('#plant1 displays visible focus outline', plant1Outline.outlineStyle !== 'none' && parseFloat(plant1Outline.outlineWidth) > 0, { outline: plant1Outline });

    await page.screenshot({ path: path.join(workDir, 'screenshot-focused.png') });

    // 6. Keyboard activation: Enter picks up plant1
    const initialPos = await page.$eval('#plant1', (el) => ({ top: el.offsetTop, left: el.offsetLeft }));
    await page.keyboard.press('Enter');
    const isGrabbed1 = await page.$eval('#plant1', (el) => el.getAttribute('aria-pressed'));
    recordCheck('Enter key picks up plant (aria-pressed === true)', isGrabbed1 === 'true', { isGrabbed: isGrabbed1 });

    // 7. Arrow keys move the picked-up plant
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');

    const movedPos = await page.$eval('#plant1', (el) => ({ top: el.offsetTop, left: el.offsetLeft }));
    const hasMoved = movedPos.left === initialPos.left + 20 && movedPos.top === initialPos.top + 20;
    recordCheck('Arrow keys reposition picked-up plant (+20px right, +20px down)', hasMoved, { initialPos, movedPos });

    await page.screenshot({ path: path.join(workDir, 'screenshot-moved.png') });

    // 8. Space key drops the plant
    await page.keyboard.press('Space');
    const isGrabbed2 = await page.$eval('#plant1', (el) => el.getAttribute('aria-pressed'));
    recordCheck('Space key drops plant (aria-pressed === false)', isGrabbed2 === 'false', { isGrabbed: isGrabbed2 });

    // 9. Verify all 14 plants have role="button", tabindex="0", and alt text
    const plantsAccessibility = await page.evaluate(() => {
      const plants = Array.from(document.querySelectorAll('.plant'));
      return {
        count: plants.length,
        allHaveRole: plants.every(p => p.getAttribute('role') === 'button'),
        allHaveTabindexZero: plants.every(p => p.getAttribute('tabindex') === '0'),
        allHaveAlt: plants.every(p => p.getAttribute('alt') && p.getAttribute('alt').length > 5)
      };
    });
    recordCheck('All 14 plants have accessible role, tabindex="0", and descriptive alt text',
      plantsAccessibility.count === 14 && plantsAccessibility.allHaveRole && plantsAccessibility.allHaveTabindexZero && plantsAccessibility.allHaveAlt,
      plantsAccessibility
    );

    // 10. Verify no positive tabindex elements exist
    const positiveTabindexCount = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll('[tabindex]'));
      return els.filter(el => {
        const val = parseInt(el.getAttribute('tabindex'), 10);
        return !isNaN(val) && val > 0;
      }).length;
    });
    recordCheck('Zero positive tabindex attributes in document', positiveTabindexCount === 0, { positiveTabindexCount });

    // 11. Check zero page errors
    recordCheck('Zero uncaught page errors during interaction', pageErrors.length === 0, { pageErrors });

    // Save outputs
    fs.writeFileSync(path.join(workDir, 'results.json'), JSON.stringify(results, null, 2), 'utf-8');
    const versions = {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      playwright: '^1.65.1'
    };
    fs.writeFileSync(path.join(workDir, 'versions.json'), JSON.stringify(versions, null, 2), 'utf-8');

    console.log(`\n🎉 Test completed: ${results.passed}/${results.checks.length} checks passed.`);
    if (results.failed > 0) {
      process.exitCode = 1;
    }
  } catch (err) {
    console.error('Test execution error:', err);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    if (server) server.close();
  }
}

run();

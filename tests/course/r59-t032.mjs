import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../..');
const workDir = path.resolve(repoRoot, 'work/R59-T032');

if (!fs.existsSync(workDir)) {
  fs.mkdirSync(workDir, { recursive: true });
}

const PORT = 8752;
let server;
let browser;

const results = {
  task: 'R59-T032',
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
      if (reqPath === '/') reqPath = '/6-space-game/5-keeping-score/solution/index.html';
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

    let totalErrors = 0;

    // -----------------------------------------------------------
    // Viewport 1: Mobile 360x800
    // -----------------------------------------------------------
    const mobileContext = await browser.newContext({
      viewport: { width: 360, height: 800 }
    });
    const mobilePage = await mobileContext.newPage();
    const mobileErrors = [];
    mobilePage.on('pageerror', (err) => {
      mobileErrors.push(err.message);
      totalErrors++;
    });

    const resp360 = await mobilePage.goto(`${baseUrl}/6-space-game/5-keeping-score/solution/index.html`);
    recordCheck('Page responds with HTTP 200 at 360x800', resp360.status() === 200, { status: resp360.status() });

    const canvasExists360 = await mobilePage.evaluate(() => !!document.getElementById('canvas'));
    recordCheck('Canvas source anchor exists at 360x800', canvasExists360, { canvasExists360 });

    // Wait for game loop / canvas ready
    await mobilePage.waitForTimeout(500);

    const overflow360 = await mobilePage.evaluate(() => {
      return {
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        hasOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
      };
    });
    recordCheck('Zero horizontal overflow at 360x800', !overflow360.hasOverflow, overflow360);

    const canvasBox360 = await mobilePage.locator('#canvas').boundingBox();
    const canvasContained360 = canvasBox360 && canvasBox360.x >= 0 && (canvasBox360.x + canvasBox360.width) <= 360.5;
    recordCheck('Canvas is contained within 360px viewport boundaries without clipping', canvasContained360, { canvasBox360 });

    await mobilePage.screenshot({ path: path.join(workDir, 'viewport-360x800.png') });
    recordCheck('Zero uncaught page errors at 360x800', mobileErrors.length === 0, { mobileErrors });
    await mobileContext.close();

    // -----------------------------------------------------------
    // Viewport 2: Desktop 1280x800
    // -----------------------------------------------------------
    const desktopContext = await browser.newContext({
      viewport: { width: 1280, height: 800 }
    });
    const desktopPage = await desktopContext.newPage();
    const desktopErrors = [];
    desktopPage.on('pageerror', (err) => {
      desktopErrors.push(err.message);
      totalErrors++;
    });

    const resp1280 = await desktopPage.goto(`${baseUrl}/6-space-game/5-keeping-score/solution/index.html`);
    recordCheck('Page responds with HTTP 200 at 1280x800', resp1280.status() === 200, { status: resp1280.status() });

    await desktopPage.waitForTimeout(500);

    const overflow1280 = await desktopPage.evaluate(() => {
      return {
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        hasOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
      };
    });
    recordCheck('Zero horizontal overflow at 1280x800', !overflow1280.hasOverflow, overflow1280);

    const canvasBox1280 = await desktopPage.locator('#canvas').boundingBox();
    const canvasRenderedDesktop = canvasBox1280 && canvasBox1280.width === 1024 && canvasBox1280.height === 768;
    recordCheck('Canvas renders at full 1024x768 resolution centered on desktop', canvasRenderedDesktop, { canvasBox1280 });

    await desktopPage.screenshot({ path: path.join(workDir, 'viewport-1280x800.png') });
    recordCheck('Zero uncaught page errors at 1280x800', desktopErrors.length === 0, { desktopErrors });
    await desktopContext.close();

    // Overall check
    recordCheck('Zero uncaught page errors across entire test execution', totalErrors === 0, { totalErrors });

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

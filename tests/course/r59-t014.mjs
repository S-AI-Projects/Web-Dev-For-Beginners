import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');
const appDir = path.join(rootDir, '6-space-game', '3-moving-elements-around', 'solution');
const workDir = path.join(rootDir, 'work', 'R59-T014');
fs.mkdirSync(workDir, { recursive: true });

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.html': return 'text/html; charset=UTF-8';
    case '.js': return 'application/javascript; charset=UTF-8';
    case '.png': return 'image/png';
    case '.json': return 'application/json';
    default: return 'application/octet-stream';
  }
}

async function startServer() {
  const server = http.createServer((req, res) => {
    const rawUrl = req.url?.split('?')[0] || '/';
    const relPath = rawUrl === '/' ? 'index.html' : rawUrl.replace(/^\//, '');
    const safePath = path.normalize(decodeURIComponent(relPath)).replace(/^(\.\.[\/\\])+/, '');
    const fullPath = path.join(appDir, safePath);

    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
      res.writeHead(200, { 'Content-Type': getContentType(fullPath) });
      fs.createReadStream(fullPath).pipe(res);
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 8080;
  return {
    server,
    url: `http://127.0.0.1:${port}/index.html`
  };
}

async function run() {
  const { server, url } = await startServer();
  let browser;

  const results = {
    task: 'R59-T014',
    target: url,
    timestamp: new Date().toISOString(),
    checks: []
  };

  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.goto(url, { waitUntil: 'load' });
    // Wait for window.onload and textures
    await page.waitForTimeout(300);
    assert.equal(pageErrors.length, 0, `Page threw errors on load: ${pageErrors.join(', ')}`);

    // Verify canvas anchor
    const hasCanvas = await page.evaluate(() => !!document.getElementById('canvas'));
    assert.ok(hasCanvas, 'Canvas element must be present in DOM');
    results.checks.push({ check: 'Canvas element present', status: 'PASS' });

    // Step 1: Initial state before any key press
    const initialPos = await page.evaluate(() => {
      const hero = window['__game']?.getHero();
      return { x: hero?.x, y: hero?.y, count: window['__game']?.getGameObjects().length };
    });
    assert.ok(initialPos.x !== undefined, 'Hero must be initialized');
    results.checks.push({ check: 'Hero initialized', pos: initialPos, status: 'PASS' });

    // Press ArrowUp once: hero moves by -5
    await page.keyboard.press('ArrowUp');
    const posAfterFirstPress = await page.evaluate(() => {
      const hero = window['__game']?.getHero();
      return { x: hero?.x, y: hero?.y };
    });
    assert.equal(posAfterFirstPress.y, initialPos.y - 5, 'Single ArrowUp must move hero by exactly -5px');
    results.checks.push({ check: 'First ArrowUp moves hero by 5px', status: 'PASS' });

    // Step 2: Call initGame a second time (repeat initialization)
    await page.evaluate(() => {
      window['__game'].initGame();
    });

    const posAfterSecondInit = await page.evaluate(() => {
      const hero = window['__game']?.getHero();
      const count = window['__game']?.getGameObjects().length;
      return { x: hero?.x, y: hero?.y, count };
    });
    // Objects must not duplicate (should be 26: 25 enemies + 1 hero)
    assert.equal(posAfterSecondInit.count, 26, `Game objects count should be 26 after repeat init, got ${posAfterSecondInit.count}`);
    results.checks.push({ check: 'Game objects not duplicated on repeat init', count: posAfterSecondInit.count, status: 'PASS' });

    // Step 3: Press ArrowUp again. It should STILL move by exactly -5px (NOT -10px due to duplicate listeners)
    await page.keyboard.press('ArrowUp');
    const posAfterSecondPress = await page.evaluate(() => {
      const hero = window['__game']?.getHero();
      return { x: hero?.x, y: hero?.y };
    });
    assert.equal(
      posAfterSecondPress.y,
      posAfterSecondInit.y - 5,
      `After repeat init, ArrowUp must still move hero by exactly -5px (got delta ${posAfterSecondPress.y - posAfterSecondInit.y})`
    );
    results.checks.push({ check: 'No duplicate event listener triggered after repeat init', status: 'PASS' });

    // Step 4: Verify cleanup
    await page.evaluate(() => {
      window['__game'].cleanupGame();
    });
    const cleanedCount = await page.evaluate(() => window['__game']?.getGameObjects().length);
    assert.equal(cleanedCount, 0, 'Cleanup should empty gameObjects array and clear enemy timers');
    results.checks.push({ check: 'Cleanup removes game objects and cancels timers', status: 'PASS' });

    const screenshotPath = path.join(workDir, 'repeat-init-verified.png');
    await page.screenshot({ path: screenshotPath });

    console.log('All repeat initialization checks passed for R59-T014.');
    await context.close();
  } finally {
    if (browser) await browser.close();
    server.close();
  }

  fs.writeFileSync(
    path.join(workDir, 'results.json'),
    JSON.stringify(results, null, 2),
    'utf-8'
  );
}

run().catch((err) => {
  console.error('R59-T014 check failed:', err);
  process.exit(1);
});

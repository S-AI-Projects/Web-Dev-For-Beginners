import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');
const appDir = path.join(rootDir, '6-space-game', '5-keeping-score', 'solution');
const workDir = path.join(rootDir, 'work', 'R59-T007');
fs.mkdirSync(workDir, { recursive: true });

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.html': return 'text/html; charset=UTF-8';
    case '.css': return 'text/css; charset=UTF-8';
    case '.js': return 'application/javascript; charset=UTF-8';
    case '.png': return 'image/png';
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
    task: 'R59-T007',
    target: url,
    timestamp: new Date().toISOString(),
    walkthrough: []
  };

  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.goto(url, { waitUntil: 'load' });
    await page.waitForFunction(() => window.hero !== undefined);

    assert.equal(pageErrors.length, 0, `Unexpected page errors on initial load: ${pageErrors.join(', ')}`);

    // 1. Verify source anchor canvas exists and has specified dimensions
    const canvasDimensions = await page.evaluate(() => {
      const c = document.getElementById('canvas');
      return c ? { width: c.width, height: c.height } : null;
    });

    assert.ok(canvasDimensions, 'Source anchor #canvas must exist');
    assert.equal(canvasDimensions.width, 1024, 'Canvas width must be 1024');
    assert.equal(canvasDimensions.height, 768, 'Canvas height must be 768');
    results.walkthrough.push({ step: 'Canvas anchor inspection', status: 'PASS', dimensions: canvasDimensions });

    // 2. Initial state verification: 0 points, 3 lives
    const initialState = await page.evaluate(() => ({
      points: window.hero.points,
      life: window.hero.life,
      x: window.hero.x,
      y: window.hero.y
    }));

    assert.equal(initialState.points, 0, 'Initial points must be 0');
    assert.equal(initialState.life, 3, 'Initial life count must be 3');
    results.walkthrough.push({ step: 'Initial game state (Points: 0, Lives: 3)', status: 'PASS', state: initialState });

    const initialScreenshot = path.join(workDir, 'gameplay-initial.png');
    await page.screenshot({ path: initialScreenshot });
    results.walkthrough.push({ step: 'Initial gameplay screenshot', path: initialScreenshot });

    // 3. Complete interaction walkthrough: Movement
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(50);

    const movedX = await page.evaluate(() => window.hero.x);
    assert.ok(movedX > initialState.x, `Hero X position must increase after pressing ArrowRight (was ${initialState.x}, now ${movedX})`);
    results.walkthrough.push({ step: 'Hero movement via keyboard', status: 'PASS', deltaX: movedX - initialState.x });

    // 4. Complete interaction walkthrough: Scoring 100 points
    await page.evaluate(() => {
      const dummyLaser = { dead: false };
      const dummyEnemy = { dead: false };
      window.eventEmitter.emit(window.Messages.COLLISION_ENEMY_LASER, { first: dummyEnemy, second: dummyLaser });
    });
    await page.waitForTimeout(150); // allow game loop tick

    const scoredPoints = await page.evaluate(() => window.hero.points);
    assert.equal(scoredPoints, 100, `Expected score to increment to 100, got: ${scoredPoints}`);
    results.walkthrough.push({ step: 'Enemy destruction scores 100 points', status: 'PASS', points: scoredPoints });

    const scoredScreenshot = path.join(workDir, 'scored-100-points.png');
    await page.screenshot({ path: scoredScreenshot });
    results.walkthrough.push({ step: 'Scored 100 points screenshot', path: scoredScreenshot });

    // 5. Complete interaction walkthrough: Life decrement on enemy collision
    await page.evaluate(() => {
      const dummyEnemy = { dead: false };
      window.eventEmitter.emit(window.Messages.COLLISION_ENEMY_HERO, { enemy: dummyEnemy });
    });
    await page.waitForTimeout(150);

    const updatedLife = await page.evaluate(() => window.hero.life);
    assert.equal(updatedLife, 2, `Expected life to decrement to 2, got: ${updatedLife}`);
    results.walkthrough.push({ step: 'Hero collision decrements life to 2', status: 'PASS', life: updatedLife });

    const lifeScreenshot = path.join(workDir, 'life-decremented.png');
    await page.screenshot({ path: lifeScreenshot });
    results.walkthrough.push({ step: 'Life decremented screenshot', path: lifeScreenshot });

    // Clean up game loop interval
    await page.evaluate(() => {
      if (window._gameLoopId) clearInterval(window._gameLoopId);
    });

    console.log('All walkthrough checks passed for R59-T007.');
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
  console.error('R59-T007 check failed:', err);
  process.exit(1);
});

// tests/course/r59-t035.mjs
// R59-T035 — Make browser tests deterministic: 6-space-game/4-collision-detection
// Page under test: 6-space-game/4-collision-detection/solution/index.html

import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';

const __dir = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(__dir, '../../');
const APP_DIR = join(ROOT, '6-space-game/4-collision-detection/solution');
const PORT = 8755;

const MIME = {
  '.html': 'text/html; charset=UTF-8',
  '.js':   'application/javascript; charset=UTF-8',
  '.css':  'text/css; charset=UTF-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
};

function serve(root) {
  return createServer((req, res) => {
    const rawUrl = req.url.split('?')[0];
    const decodedUrl = decodeURIComponent(rawUrl);
    const filePath = join(root, decodedUrl === '/' ? 'index.html' : decodedUrl);
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

const server = serve(APP_DIR);
await new Promise(r => server.listen(PORT, r));
console.log(`\n[R59-T035] Server running on http://localhost:${PORT}\n`);

const browser = await chromium.launch();
const errors = [];

try {
  // Helper to run identical test session in an isolated browser context
  async function testContext(label, screenshotName) {
    console.log(`\n-- Testing Context: ${label} --`);
    const context = await browser.newContext({
      viewport: { width: 1024, height: 768 }
    });
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(`[${label}] ${e.message}`));

    const res = await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: 'load' });
    assert(`[${label}] HTTP 200 response`, res.status() === 200, `status=${res.status()}`);

    // Wait for window.SpaceGameCollision to be available
    await page.waitForFunction(() => !!window.SpaceGameCollision, { timeout: 5000 });

    // Verify source anchor: canvas
    const canvasInfo = await page.evaluate(() => {
      const c = document.getElementById('canvas');
      if (!c) return null;
      return {
        id: c.id,
        tagName: c.tagName.toLowerCase(),
        width: c.width,
        height: c.height,
        offsetWidth: c.offsetWidth,
        offsetHeight: c.offsetHeight
      };
    });

    assert(`[${label}] canvas anchor exists`, canvasInfo !== null);
    assert(`[${label}] canvas tag is canvas`, canvasInfo && canvasInfo.tagName === 'canvas');
    assert(`[${label}] canvas internal width is 1024`, canvasInfo && canvasInfo.width === 1024);
    assert(`[${label}] canvas internal height is 768`, canvasInfo && canvasInfo.height === 768);

    // Test pure collision logic determinism using intersectRect fixture
    const collisionFixtures = await page.evaluate(() => {
      const intersect = window.SpaceGameCollision.intersectRect;
      // Overlapping rects
      const r1 = { top: 10, left: 10, bottom: 50, right: 50 };
      const r2 = { top: 20, left: 20, bottom: 60, right: 60 };
      // Separated rects
      const r3 = { top: 100, left: 100, bottom: 150, right: 150 };

      return {
        overlapResult: intersect(r1, r2),
        separatedResult: intersect(r1, r3)
      };
    });

    assert(`[${label}] intersectRect correctly detects collision`, collisionFixtures.overlapResult === true);
    assert(`[${label}] intersectRect correctly detects separation`, collisionFixtures.separatedResult === false);

    // Initial game state verification
    const gameState = await page.evaluate(() => {
      const hero = window.SpaceGameCollision.getHero();
      const objects = window.SpaceGameCollision.getGameObjects();
      const enemies = objects.filter(o => o.type === 'Enemy');
      return {
        heroExists: !!hero,
        heroLife: hero ? hero.life : null,
        heroPoints: hero ? hero.points : null,
        heroX: hero ? hero.x : null,
        heroY: hero ? hero.y : null,
        enemyCount: enemies.length
      };
    });

    assert(`[${label}] hero initialized with life=3`, gameState.heroLife === 3);
    assert(`[${label}] hero initialized with points=0`, gameState.heroPoints === 0);
    assert(`[${label}] 25 enemies created initially`, gameState.enemyCount === 25, `count=${gameState.enemyCount}`);

    // Simulate deterministic collision event: Laser hits Enemy
    const collisionSimResult = await page.evaluate(() => {
      const emitter = window.SpaceGameCollision.getEventEmitter();
      const hero = window.SpaceGameCollision.getHero();
      const objects = window.SpaceGameCollision.getGameObjects();
      const enemy = objects.find(o => o.type === 'Enemy' && !o.dead);

      // Create a simulated laser object
      const laser = {
        dead: false,
        type: 'Laser',
        x: enemy.x,
        y: enemy.y,
        width: 9,
        height: 33,
        rectFromGameObject: () => ({
          top: enemy.y,
          left: enemy.x,
          bottom: enemy.y + 33,
          right: enemy.x + 9
        })
      };

      emitter.emit(window.SpaceGameCollision.Messages.COLLISION_ENEMY_LASER, {
        first: laser,
        second: enemy
      });

      return {
        laserDead: laser.dead,
        enemyDead: enemy.dead,
        heroPointsAfter: hero.points
      };
    });

    assert(`[${label}] laser marked dead upon collision`, collisionSimResult.laserDead === true);
    assert(`[${label}] enemy marked dead upon collision`, collisionSimResult.enemyDead === true);
    assert(`[${label}] hero points incremented to 100`, collisionSimResult.heroPointsAfter === 100);

    await page.screenshot({ path: join(ROOT, screenshotName) });

    await page.close();
    await context.close();

    return { canvasInfo, gameState, collisionSimResult };
  }

  // Run Context A
  const resultA = await testContext('Context-A', 'work/R59-T035/screenshot-context-a.png');

  // Run Context B
  const resultB = await testContext('Context-B', 'work/R59-T035/screenshot-context-b.png');

  // Compare Context A and Context B for exact determinism
  console.log('\n-- Cross-Context Determinism Assertions --');
  assert('both contexts produced identical canvas width', resultA.canvasInfo.width === resultB.canvasInfo.width);
  assert('both contexts produced identical canvas height', resultA.canvasInfo.height === resultB.canvasInfo.height);
  assert('both contexts produced identical enemy count', resultA.gameState.enemyCount === resultB.gameState.enemyCount);
  assert('both contexts produced identical hero initial position', resultA.gameState.heroX === resultB.gameState.heroX && resultA.gameState.heroY === resultB.gameState.heroY);
  assert('both contexts produced identical post-collision score', resultA.collisionSimResult.heroPointsAfter === resultB.collisionSimResult.heroPointsAfter);

  // Check errors
  console.log('\n-- Uncaught Error Check --');
  assert('zero uncaught page errors across both contexts', errors.length === 0, errors.join('; '));

} finally {
  await browser.close();
  server.close();
}

console.log(`\n[R59-T035] Results: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);

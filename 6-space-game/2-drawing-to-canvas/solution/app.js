function createFallbackTexture(type) {
  const fallbackCanvas = document.createElement('canvas');
  fallbackCanvas.width = 90;
  fallbackCanvas.height = 90;
  const fCtx = fallbackCanvas.getContext('2d');
  fCtx.fillStyle = type === 'hero' ? '#00e5ff' : '#ff0055';
  fCtx.beginPath();
  if (type === 'hero') {
    fCtx.moveTo(45, 10);
    fCtx.lineTo(80, 80);
    fCtx.lineTo(45, 65);
    fCtx.lineTo(10, 80);
  } else {
    fCtx.arc(45, 45, 30, 0, Math.PI * 2);
  }
  fCtx.closePath();
  fCtx.fill();
  return fallbackCanvas;
}

let assetFallbackUsed = false;

async function loadTexture(path, fallbackType = 'hero') {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = path;
    img.onload = () => resolve(img);
    img.onerror = () => {
      assetFallbackUsed = true;
      const status = document.getElementById('game-status');
      if (status) {
        status.textContent = 'Asset fallback active: using vector graphics';
      }
      resolve(createFallbackTexture(fallbackType));
    };
  });
}
    function drawText(ctx, text, x, y, fontSize = 40, color = "#ff007f", align = "center") {
      ctx.save();
      ctx.font = `${fontSize}px Orbitron, monospace`;
      ctx.fillStyle = color;
      ctx.textAlign = align;
      ctx.shadowColor = "#181733";
      ctx.shadowBlur = 12;
      ctx.fillText(text, x, y);
      ctx.restore();
    }
    function createEnemies(ctx, canvas, enemyImg) {
      const MONSTER_TOTAL = 7;
      const MONSTER_ROWS = 5;
      const ENEMY_SIZE = 65;
      const START_X = (canvas.width - (MONSTER_TOTAL * ENEMY_SIZE)) / 2;
      for (let row = 0; row < MONSTER_ROWS; row++) {
        for (let col = 0; col < MONSTER_TOTAL; col++) {
          const x = START_X + col * ENEMY_SIZE;
          const y = 60 + row * ENEMY_SIZE;
          ctx.drawImage(enemyImg, x, y, ENEMY_SIZE, ENEMY_SIZE);
        }
      }
    }
    window.onload = async () => {
      const canvas = document.getElementById("canvas");
      const ctx = canvas.getContext("2d");
      // Use emoji icons as game characters if images aren't available
      const heroImg = await loadTexture('assets/player.png', 'hero');
      const enemyImg = await loadTexture('assets/enemyShip.png', 'enemy');
      ctx.fillStyle = '#181733';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      drawText(ctx, "Prepare for Battle!", canvas.width/2, 70, 48, "#fff");
      // Draw hero
      ctx.drawImage(heroImg, canvas.width/2 - 45, canvas.height - (canvas.height / 4), 90, 90);
      createEnemies(ctx, canvas, enemyImg);
      // Example: Draw power up icon beside hero
      ctx.font = "38px FontAwesome";
      ctx.fillStyle = "#ffd700";
      ctx.fillText("\uf059", canvas.width/2 + 60, canvas.height - (canvas.height / 4) + 42); // Star icon
    };

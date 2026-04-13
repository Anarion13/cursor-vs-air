'use strict';

// ============================================================
// CONFIG
// ============================================================
const W = 800, H = 600;
const HALF_W = W / 2, HALF_H = H / 2;
const FOV = Math.PI / 3;       // 60-degree field of view
const HALF_FOV = FOV / 2;
const MAX_DEPTH = 24;

// RGB wall colors by tile type
const WALL_COLORS = [
  null,
  [139,   0,   0],   // 1 – border (dark red)
  [ 60, 100, 180],   // 2 – blue
  [160,  80,  20],   // 3 – brown
  [ 30, 140,  70],   // 4 – green
  [150,   0, 180],   // 5 – purple
];

// ============================================================
// MAP  (20 × 20)
// ============================================================
const MAP = [
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,2,2,2,2,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,2,0,0,0,0,0,0,0,3,3,3,0,0,0,0,1],
  [1,0,0,0,2,0,0,0,0,0,0,0,3,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,3,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,3,3,3,0,0,0,0,1],
  [1,0,4,4,4,0,0,0,0,0,0,0,0,0,0,0,4,4,4,1],
  [1,0,4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4,1],
  [1,0,4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4,1],
  [1,0,4,4,4,0,0,0,0,0,0,0,0,0,0,0,4,4,4,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,5,5,5,0,0,0,0,0,0,0,5,5,5,0,0,0,1],
  [1,0,0,5,0,0,0,0,0,0,0,0,0,0,0,5,0,0,0,1],
  [1,0,0,5,5,5,0,0,0,0,0,0,0,5,5,5,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
];
const MAP_W = MAP[0].length;
const MAP_H = MAP.length;

// ============================================================
// GAME STATE
// ============================================================
const player = {
  x: 2.5, y: 2.5,
  angle: 0.3,
  health: 100,
  ammo: 50,
  kills: 0,
};

const enemies = [
  { x: 6.5,  y: 6.5,  hp: 30, alive: true },
  { x: 15.5, y: 4.5,  hp: 30, alive: true },
  { x: 17.5, y: 9.5,  hp: 30, alive: true },
  { x: 4.5,  y: 14.5, hp: 30, alive: true },
  { x: 14.5, y: 14.5, hp: 30, alive: true },
  { x: 10.5, y: 9.5,  hp: 30, alive: true },
  { x: 8.5,  y: 17.5, hp: 30, alive: true },
];

const input = { keys: {}, mouseX: 0 };
let mouseLocked  = false;
let gunCooldown  = 0;
let muzzleFlash  = 0;
let walkBob      = 0;
let gameState    = 'start'; // 'start' | 'playing' | 'dead' | 'won'

// ============================================================
// CANVAS
// ============================================================
const canvas = document.getElementById('canvas');
const ctx    = canvas.getContext('2d');

// Pre-built image buffer for the 3-D view (skips transparent overdraw)
const imgData = ctx.createImageData(W, H);
const pixels  = imgData.data;

// ============================================================
// INPUT
// ============================================================
document.addEventListener('keydown', e => {
  input.keys[e.code] = true;
  input.keys[e.key]  = true;
  if (e.code === 'Space') e.preventDefault();
});
document.addEventListener('keyup', e => {
  input.keys[e.code] = false;
  input.keys[e.key]  = false;
});

canvas.addEventListener('click', () => {
  if (gameState !== 'playing') return;
  if (!mouseLocked) {
    canvas.requestPointerLock();
  } else {
    shoot();
  }
});

document.addEventListener('mousemove', e => {
  if (mouseLocked) input.mouseX += e.movementX;
});

document.addEventListener('pointerlockchange', () => {
  mouseLocked = document.pointerLockElement === canvas;
});

// ============================================================
// HELPER – passability
// ============================================================
function passable(x, y) {
  const mx = Math.floor(x);
  const my = Math.floor(y);
  if (mx < 0 || mx >= MAP_W || my < 0 || my >= MAP_H) return false;
  return MAP[my][mx] === 0;
}

// ============================================================
// DDA RAYCASTER
// ============================================================
function castRay(angle) {
  const sinA = Math.sin(angle);
  const cosA = Math.cos(angle);

  let mapX = Math.floor(player.x);
  let mapY = Math.floor(player.y);

  // Avoid division by zero
  const deltaDistX = cosA === 0 ? 1e30 : Math.abs(1 / cosA);
  const deltaDistY = sinA === 0 ? 1e30 : Math.abs(1 / sinA);

  const stepX = cosA > 0 ? 1 : -1;
  const stepY = sinA > 0 ? 1 : -1;

  let sideDistX = cosA > 0
    ? (mapX + 1 - player.x) * deltaDistX
    : (player.x - mapX) * deltaDistX;
  let sideDistY = sinA > 0
    ? (mapY + 1 - player.y) * deltaDistY
    : (player.y - mapY) * deltaDistY;

  let side = 0;
  let wallType = 1;

  for (let i = 0; i < 64; i++) {
    if (sideDistX < sideDistY) {
      sideDistX += deltaDistX;
      mapX += stepX;
      side = 0;
    } else {
      sideDistY += deltaDistY;
      mapY += stepY;
      side = 1;
    }
    if (mapX < 0 || mapX >= MAP_W || mapY < 0 || mapY >= MAP_H) break;
    if (MAP[mapY][mapX] !== 0) { wallType = MAP[mapY][mapX]; break; }
  }

  // Perpendicular wall distance (already fish-eye-corrected by DDA)
  const perpDist = side === 0 ? sideDistX - deltaDistX : sideDistY - deltaDistY;
  return { dist: Math.max(0.05, perpDist), side, wallType };
}

// ============================================================
// SHOOTING
// ============================================================
function shoot() {
  if (player.ammo <= 0 || gunCooldown > 0) return;
  player.ammo--;
  gunCooldown = 18;
  muzzleFlash = 10;

  const step = 0.12;
  for (let d = step; d < MAX_DEPTH; d += step) {
    const rx = player.x + Math.cos(player.angle) * d;
    const ry = player.y + Math.sin(player.angle) * d;
    const mx = Math.floor(rx);
    const my = Math.floor(ry);
    if (mx < 0 || mx >= MAP_W || my < 0 || my >= MAP_H) break;
    if (MAP[my][mx] !== 0) break;
    for (const e of enemies) {
      if (!e.alive) continue;
      if (Math.hypot(rx - e.x, ry - e.y) < 0.45) {
        e.hp -= 34;
        if (e.hp <= 0) { e.alive = false; player.kills++; }
        return;
      }
    }
  }
}

// ============================================================
// UPDATE
// ============================================================
function update(dt) {
  if (gameState !== 'playing') return;

  const moveSpd = 3.8 * dt;
  const rotSpd  = 2.2 * dt;

  // Rotation (arrow keys fallback)
  if (input.keys['ArrowLeft'])  player.angle -= rotSpd;
  if (input.keys['ArrowRight']) player.angle += rotSpd;

  // Mouse look
  if (mouseLocked) {
    player.angle += input.mouseX * 0.0022;
    input.mouseX = 0;
  }

  // Movement
  let dx = 0, dy = 0;
  const fwd = (input.keys['KeyW'] || input.keys['ArrowUp']);
  const bwd = (input.keys['KeyS'] || input.keys['ArrowDown']);
  const sl  = input.keys['KeyA'];
  const sr  = input.keys['KeyD'];

  if (fwd) { dx += Math.cos(player.angle) * moveSpd; dy += Math.sin(player.angle) * moveSpd; }
  if (bwd) { dx -= Math.cos(player.angle) * moveSpd; dy -= Math.sin(player.angle) * moveSpd; }
  if (sl)  { dx += Math.cos(player.angle - Math.PI/2) * moveSpd; dy += Math.sin(player.angle - Math.PI/2) * moveSpd; }
  if (sr)  { dx += Math.cos(player.angle + Math.PI/2) * moveSpd; dy += Math.sin(player.angle + Math.PI/2) * moveSpd; }

  const moving = fwd || bwd || sl || sr;
  walkBob = moving ? walkBob + dt * 9 : walkBob * 0.88;

  // Slide-based collision (check axes independently)
  const m = 0.28;
  if (dx !== 0 && passable(player.x + dx + Math.sign(dx) * m, player.y)) player.x += dx;
  if (dy !== 0 && passable(player.x, player.y + dy + Math.sign(dy) * m)) player.y += dy;

  // Spacebar shoot
  if (input.keys['Space']) shoot();

  if (gunCooldown > 0) gunCooldown--;
  if (muzzleFlash  > 0) muzzleFlash--;

  // Enemy AI – chase player
  const now = performance.now();
  for (const e of enemies) {
    if (!e.alive) continue;
    const relX = e.x - player.x;
    const relY = e.y - player.y;
    const dist = Math.hypot(relX, relY);

    if (dist > 0.5 && dist < 14) {
      const spd = 1.3 * dt;
      const nx  = e.x - (relX / dist) * spd;
      const ny  = e.y - (relY / dist) * spd;
      if (passable(nx, e.y)) e.x = nx;
      if (passable(e.x, ny)) e.y = ny;
    }

    // Melee damage
    if (dist < 0.75) {
      player.health -= 18 * dt;
    }
  }

  if (player.health <= 0) {
    player.health = 0;
    gameState = 'dead';
    if (mouseLocked) document.exitPointerLock();
  }
  if (enemies.every(e => !e.alive)) {
    gameState = 'won';
    if (mouseLocked) document.exitPointerLock();
  }
}

// ============================================================
// RENDER – 3-D WALLS via pixel buffer
// ============================================================
function renderWalls(zBuf) {
  // Pre-fill ceiling and floor into pixel buffer
  for (let y = 0; y < H; y++) {
    const isCeiling = y < HALF_H;
    // Gradient: ceiling darkens toward top, floor darkens toward bottom
    const t = isCeiling
      ? (HALF_H - y) / HALF_H
      : (y - HALF_H) / HALF_H;
    const cR = isCeiling ? Math.floor(10 + t * 5)  : Math.floor(28 + (1-t)*10);
    const cG = isCeiling ? Math.floor(10 + t * 5)  : Math.floor(28 + (1-t)*10);
    const cB = isCeiling ? Math.floor(20 + t * 20) : Math.floor(10);
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      pixels[i]   = cR;
      pixels[i+1] = cG;
      pixels[i+2] = cB;
      pixels[i+3] = 255;
    }
  }

  // Cast one ray per screen column
  for (let col = 0; col < W; col++) {
    const rayAngle = player.angle - HALF_FOV + (col / W) * FOV;
    const { dist, side, wallType } = castRay(rayAngle);
    zBuf[col] = dist;

    const wallH  = Math.min(H / dist, H * 3) | 0;
    const wallT  = Math.max(0, ((HALF_H - wallH / 2) | 0));
    const wallB  = Math.min(H, wallT + wallH);

    const [wr, wg, wb] = WALL_COLORS[wallType] || [128, 128, 128];
    const shade  = Math.max(0.08, 1 - dist / 18);
    const side_f = side === 1 ? 0.5 : 1.0;
    const s      = shade * side_f;

    const fr = Math.floor(wr * s);
    const fg = Math.floor(wg * s);
    const fb = Math.floor(wb * s);

    for (let y = wallT; y < wallB; y++) {
      const i = (y * W + col) * 4;
      pixels[i]   = fr;
      pixels[i+1] = fg;
      pixels[i+2] = fb;
      pixels[i+3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);
}

// ============================================================
// RENDER – ENEMY SPRITES
// ============================================================
function renderSprites(zBuf) {
  const alive = enemies.filter(e => e.alive);
  // Draw far-to-near so closer sprites overdraw distant ones
  alive.sort((a, b) =>
    Math.hypot(b.x - player.x, b.y - player.y) - Math.hypot(a.x - player.x, a.y - player.y)
  );

  for (const e of alive) {
    const relX = e.x - player.x;
    const relY = e.y - player.y;
    const euDist = Math.hypot(relX, relY);
    if (euDist < 0.3) continue;

    // Angle of sprite relative to player facing
    let da = Math.atan2(relY, relX) - player.angle;
    while (da < -Math.PI) da += Math.PI * 2;
    while (da >  Math.PI) da -= Math.PI * 2;
    if (Math.abs(da) > HALF_FOV + 0.4) continue;

    // Perpendicular distance for correct size / z-test
    const perpDist = euDist * Math.cos(da);
    if (perpDist < 0.1) continue;

    const screenX = ((0.5 + da / FOV) * W) | 0;
    const sprH = Math.min(H / perpDist * 0.85, H * 2) | 0;
    const sprW = (sprH * 0.7) | 0;
    const sprT = ((HALF_H - sprH / 2) | 0);
    const sprL = screenX - (sprW >> 1);

    const shade = Math.max(0.1, 1 - perpDist / 14);
    const bR = Math.floor(220 * shade);
    const bG = Math.floor( 35 * shade);
    const bB = Math.floor( 35 * shade);

    const startCol = Math.max(0, sprL);
    const endCol   = Math.min(W - 1, sprL + sprW);

    for (let col = startCol; col <= endCol; col++) {
      if (zBuf[col] < perpDist) continue; // wall occludes sprite

      const tx = (col - sprL) / sprW; // 0..1 across sprite
      if (tx < 0.1 || tx > 0.9) continue; // transparent edges

      const edgeDark = (tx < 0.22 || tx > 0.78) ? 0.6 : 1.0;

      // Draw full-height body column
      const bodyT = Math.max(0, sprT + (sprH * 0.05) | 0);
      const bodyB = Math.min(H, sprT + (sprH * 0.95) | 0);
      for (let y = bodyT; y < bodyB; y++) {
        const i = (y * W + col) * 4;
        pixels[i]   = Math.floor(bR * edgeDark);
        pixels[i+1] = Math.floor(bG * edgeDark);
        pixels[i+2] = Math.floor(bB * edgeDark);
        pixels[i+3] = 255;
      }

      // Eyes (only when close)
      if (perpDist < 10 && ((tx > 0.25 && tx < 0.42) || (tx > 0.58 && tx < 0.75))) {
        const eyeT = Math.max(0, sprT + (sprH * 0.15) | 0);
        const eyeB = Math.min(H, sprT + (sprH * 0.28) | 0);
        const eY   = Math.floor(255 * shade);
        for (let y = eyeT; y < eyeB; y++) {
          const i = (y * W + col) * 4;
          pixels[i]   = eY;
          pixels[i+1] = eY;
          pixels[i+2] = 0;
          pixels[i+3] = 255;
        }
      }
    }
  }

  // Re-blit pixel buffer after sprite overdraw
  ctx.putImageData(imgData, 0, 0);
}

// ============================================================
// RENDER – GUN
// ============================================================
function renderGun() {
  const bob    = Math.sin(walkBob) * 9;
  const recoil = gunCooldown > 10 ? (18 - gunCooldown) * 5 : 0;
  const gx     = HALF_W - 55;
  const gy     = H - 175 + bob + recoil;

  // Muzzle flash
  if (muzzleFlash > 0) {
    const a = muzzleFlash / 10;
    const r = 28 + muzzleFlash * 4;
    const g = ctx.createRadialGradient(HALF_W, gy - 40, 0, HALF_W, gy - 40, r);
    g.addColorStop(0,   `rgba(255,255,180,${a})`);
    g.addColorStop(0.5, `rgba(255,160,  0,${a * 0.7})`);
    g.addColorStop(1,   `rgba(255, 80,  0,0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(HALF_W, gy - 40, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Barrel
  ctx.fillStyle = '#686868'; ctx.fillRect(gx + 36, gy - 75, 24, 55);
  ctx.fillStyle = '#909090'; ctx.fillRect(gx + 38, gy - 75, 7,  55);
  ctx.fillStyle = '#484848'; ctx.fillRect(gx + 52, gy - 75, 6,  55);

  // Slide
  ctx.fillStyle = '#585858'; ctx.fillRect(gx + 14, gy - 44, 68, 30);
  ctx.fillStyle = '#787878'; ctx.fillRect(gx + 14, gy - 44, 68,  7);
  ctx.fillStyle = '#383838'; ctx.fillRect(gx + 70, gy - 44, 12, 30);

  // Ejection port detail
  ctx.fillStyle = '#2a2a2a'; ctx.fillRect(gx + 20, gy - 38, 40, 12);

  // Grip
  ctx.fillStyle = '#3c2810'; ctx.fillRect(gx + 24, gy - 22, 26, 48);
  ctx.fillStyle = '#2c1a08'; ctx.fillRect(gx + 26, gy - 20, 10, 44);
  ctx.fillStyle = '#4a3218'; ctx.fillRect(gx + 38, gy - 20, 10, 44);

  // Trigger guard
  ctx.fillStyle = '#505050'; ctx.fillRect(gx + 18, gy - 8, 38, 5);

  // Front sight
  ctx.fillStyle = '#ff4444'; ctx.fillRect(gx + 45, gy - 78, 4,  5);
}

// ============================================================
// RENDER – HUD
// ============================================================
function renderHUD() {
  // Bottom bar
  ctx.fillStyle = 'rgba(0,0,0,0.78)';
  ctx.fillRect(0, H - 52, W, 52);

  ctx.font = 'bold 21px "Courier New"';

  // Health icon + number
  ctx.fillStyle = '#ff4444';
  ctx.fillText('\u2665 ' + Math.ceil(player.health), 18, H - 18);

  // Health bar
  ctx.fillStyle = '#2a2a2a'; ctx.fillRect(18, H - 12, 118, 7);
  const hpFrac = player.health / 100;
  ctx.fillStyle = hpFrac > 0.6 ? '#44ee44' : hpFrac > 0.3 ? '#ffaa00' : '#ff2222';
  ctx.fillRect(18, H - 12, 118 * hpFrac, 7);

  // Ammo
  ctx.fillStyle = '#ffcc00';
  ctx.fillText('\u26a1 ' + player.ammo, 200, H - 18);

  // Kill counter
  const killRatio = player.kills + '/' + enemies.length;
  ctx.fillStyle = '#aaaaff';
  ctx.fillText('\u2620 ' + killRatio, 370, H - 18);

  // Controls reminder when mouse is unlocked
  if (!mouseLocked) {
    ctx.fillStyle = 'rgba(255,220,80,0.75)';
    ctx.font = '13px "Courier New"';
    ctx.textAlign = 'center';
    ctx.fillText('[ CLICK TO ENABLE MOUSE AIM ]', HALF_W, 26);
    ctx.textAlign = 'left';
  }

  // Crosshair
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 1.5;
  const cl = 10, cg = 5;
  ctx.beginPath();
  ctx.moveTo(HALF_W - cl - cg, HALF_H); ctx.lineTo(HALF_W - cg, HALF_H);
  ctx.moveTo(HALF_W + cg, HALF_H);      ctx.lineTo(HALF_W + cl + cg, HALF_H);
  ctx.moveTo(HALF_W, HALF_H - cl - cg); ctx.lineTo(HALF_W, HALF_H - cg);
  ctx.moveTo(HALF_W, HALF_H + cg);      ctx.lineTo(HALF_W, HALF_H + cl + cg);
  ctx.stroke();
  // dot
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.beginPath(); ctx.arc(HALF_W, HALF_H, 1.5, 0, Math.PI * 2); ctx.fill();
}

// ============================================================
// RENDER – MINIMAP
// ============================================================
function renderMinimap() {
  const sc  = 5;
  const ox  = W - MAP_W * sc - 8;
  const oy  = 8;

  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(ox - 1, oy - 1, MAP_W * sc + 2, MAP_H * sc + 2);

  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const t = MAP[y][x];
      if (t !== 0) {
        const [r, g, b] = WALL_COLORS[t] || [128, 128, 128];
        ctx.fillStyle = `rgb(${r},${g},${b})`;
      } else {
        ctx.fillStyle = 'rgba(44,44,44,0.9)';
      }
      ctx.fillRect(ox + x * sc, oy + y * sc, sc - 1, sc - 1);
    }
  }

  // Player dot + direction
  const px = ox + player.x * sc;
  const py = oy + player.y * sc;
  ctx.fillStyle = '#00ff00';
  ctx.beginPath(); ctx.arc(px, py, 3, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#00ff00'; ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.lineTo(px + Math.cos(player.angle) * sc * 2.2, py + Math.sin(player.angle) * sc * 2.2);
  ctx.stroke();

  // Enemy dots
  ctx.fillStyle = '#ff4444';
  for (const e of enemies) {
    if (!e.alive) continue;
    ctx.beginPath();
    ctx.arc(ox + e.x * sc, oy + e.y * sc, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ============================================================
// RENDER – DEATH / WIN SCREENS
// ============================================================
function renderDeadScreen() {
  ctx.fillStyle = 'rgba(100,0,0,0.65)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff2222';
  ctx.font = 'bold 78px "Courier New"';
  ctx.fillText('YOU DIED', HALF_W, HALF_H - 20);
  ctx.fillStyle = '#888';
  ctx.font = '22px "Courier New"';
  ctx.fillText('Kills: ' + player.kills + ' / ' + enemies.length, HALF_W, HALF_H + 34);
  ctx.fillText('Press F5 to restart', HALF_W, HALF_H + 70);
  ctx.textAlign = 'left';
}

function renderWinScreen() {
  ctx.fillStyle = 'rgba(0,0,80,0.65)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffcc00';
  ctx.font = 'bold 72px "Courier New"';
  ctx.fillText('YOU WIN!', HALF_W, HALF_H - 20);
  ctx.fillStyle = '#aaa';
  ctx.font = '22px "Courier New"';
  ctx.fillText('All ' + enemies.length + ' demons slain!', HALF_W, HALF_H + 34);
  ctx.fillText('Press F5 to play again', HALF_W, HALF_H + 70);
  ctx.textAlign = 'left';
}

// ============================================================
// MAIN RENDER
// ============================================================
function render() {
  const zBuf = new Float32Array(W);
  renderWalls(zBuf);
  renderSprites(zBuf);

  if (gameState === 'playing') {
    renderGun();
    renderHUD();
    renderMinimap();
  } else if (gameState === 'dead') {
    renderDeadScreen();
  } else if (gameState === 'won') {
    renderWinScreen();
  }
}

// ============================================================
// START GAME (called from HTML button)
// ============================================================
function startGame() {
  document.getElementById('overlay').style.display = 'none';
  gameState = 'playing';
  canvas.requestPointerLock();
}

// ============================================================
// GAME LOOP
// ============================================================
let lastTime = performance.now();

function loop(ts) {
  const dt = Math.min((ts - lastTime) / 1000, 0.05);
  lastTime = ts;
  update(dt);
  render();
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);

// ============================================================
//  RuneWord Chronicle - Lineage Remaster Procedural Sprite Engine
//  Ultra-detailed Canvas2D rendering with advanced lighting & materials
// ============================================================
const SpriteCache = {};
const EnvCache = {};
const TileCache = {};

function clearArtCaches() {
  for (const key of Object.keys(SpriteCache)) delete SpriteCache[key];
  for (const key of Object.keys(EnvCache)) delete EnvCache[key];
  for (const key of Object.keys(TileCache)) delete TileCache[key];
}

function loadImageAsset(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

function canvasFromImageSlice(img, sx, sy, sw, sh) {
  const canvas = makeCanvas(sw, sh);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
  return canvas;
}

async function loadRemasterAssets(manifestUrl) {
  const manifestPath = manifestUrl || 'assets/remaster/manifest.json';
  try {
    const res = await fetch(manifestPath, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Manifest HTTP ${res.status}`);
    const manifest = await res.json();
    const loadedSprites = {};
    const loadedEnvironment = {};
    const loadedTiles = {};
    const failures = [];

    for (const [key, sprite] of Object.entries(manifest.sprites || {})) {
      try {
        const img = await loadImageAsset(sprite.src);
        const cache = {};
        for (const row of sprite.rows || []) {
          const frames = [];
          for (let i = 0; i < row.frames; i++) {
            frames.push(
              canvasFromImageSlice(
                img,
                i * sprite.frameWidth,
                row.row * sprite.frameHeight,
                sprite.frameWidth,
                sprite.frameHeight
              )
            );
          }
          cache[row.name] = frames;
        }
        loadedSprites[key] = cache;
      } catch (error) {
        failures.push({ kind: 'sprite', key, src: sprite.src, error: error.message });
      }
    }

    for (const [key, env] of Object.entries(manifest.environment || {})) {
      try {
        const img = await loadImageAsset(env.src);
        loadedEnvironment[key] = canvasFromImageSlice(img, 0, 0, img.width, img.height);
      } catch (error) {
        failures.push({ kind: 'environment', key, src: env.src, error: error.message });
      }
    }

    for (const [key, tile] of Object.entries(manifest.tiles || {})) {
      try {
        const img = await loadImageAsset(tile.src);
        loadedTiles[key] = canvasFromImageSlice(img, 0, 0, img.width, img.height);
      } catch (error) {
        failures.push({ kind: 'tile', key, src: tile.src, error: error.message });
      }
    }

    clearArtCaches();
    if (failures.length) {
      console.warn('[SPRITES] Partial remaster load failure, filling gaps procedurally:', failures);
      generateAllSprites();
    }

    Object.assign(SpriteCache, loadedSprites);
    Object.assign(EnvCache, loadedEnvironment);
    Object.assign(TileCache, loadedTiles);

    const loadedAnything = Object.keys(SpriteCache).length || Object.keys(EnvCache).length || Object.keys(TileCache).length;
    if (!loadedAnything) {
      throw new Error('No remaster assets could be loaded');
    }

    console.log(
      '[SPRITES] Loaded remaster asset pack:',
      Object.keys(SpriteCache).length,
      'entities,',
      Object.keys(EnvCache).length,
      'env,',
      Object.keys(TileCache).length,
      'tiles'
    );
    return true;
  } catch (error) {
    console.warn('[SPRITES] Asset pack unavailable, falling back to procedural generation:', error);
    return false;
  }
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function tintSpriteMask(canvas, fillStyle) {
  const c = makeCanvas(canvas.width, canvas.height);
  const ctx = c.getContext('2d');
  ctx.drawImage(canvas, 0, 0);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = fillStyle;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.globalCompositeOperation = 'source-over';
  return c;
}

function spriteNoise(seed, x, y) {
  const n = Math.sin((x + 1) * 12.9898 + (y + 1) * 78.233 + seed * 37.719) * 43758.5453;
  return n - Math.floor(n);
}

function remasterSpriteFrame(canvas, seed) {
  const w = canvas.width, h = canvas.height;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const outline = tintSpriteMask(canvas, 'rgba(12, 10, 10, 0.42)');
  const warmRim = tintSpriteMask(canvas, 'rgba(255, 214, 150, 0.14)');
  const coolRim = tintSpriteMask(canvas, 'rgba(130, 185, 255, 0.10)');

  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, 1], [1, 1]]) {
    ctx.drawImage(outline, dx, dy);
  }

  ctx.drawImage(canvas, 0, 0);

  ctx.save();
  ctx.drawImage(canvas, 0, 0);
  ctx.globalCompositeOperation = 'source-atop';

  const highlight = ctx.createLinearGradient(0, 0, w, h);
  highlight.addColorStop(0, 'rgba(255,255,255,0.16)');
  highlight.addColorStop(0.28, 'rgba(255,240,210,0.09)');
  highlight.addColorStop(0.58, 'rgba(255,255,255,0)');
  highlight.addColorStop(1, 'rgba(0,0,0,0.18)');
  ctx.fillStyle = highlight;
  ctx.fillRect(0, 0, w, h);

  const topGlow = ctx.createRadialGradient(w * 0.34, h * 0.22, 0, w * 0.34, h * 0.22, Math.max(w, h) * 0.72);
  topGlow.addColorStop(0, 'rgba(255,245,220,0.12)');
  topGlow.addColorStop(0.35, 'rgba(255,210,160,0.06)');
  topGlow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = topGlow;
  ctx.fillRect(0, 0, w, h);

  ctx.globalAlpha = 0.85;
  ctx.drawImage(warmRim, -1, -1);
  ctx.globalAlpha = 0.7;
  ctx.drawImage(coolRim, 1, 0);
  ctx.globalAlpha = 1;

  for (let y = 1; y < h - 1; y += 2) {
    for (let x = 1; x < w - 1; x += 2) {
      const n = spriteNoise(seed, x, y);
      if (n > 0.82) {
        ctx.fillStyle = `rgba(255,255,255,${0.03 + (n - 0.82) * 0.12})`;
        ctx.fillRect(x, y, 1, 1);
      } else if (n < 0.1) {
        ctx.fillStyle = `rgba(0,0,0,${0.025 + (0.1 - n) * 0.1})`;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }

  ctx.restore();
  return c;
}

function remasterSpriteFrames(key, frames) {
  return frames.map((frame, index) => remasterSpriteFrame(frame, key.length * 13 + index * 17));
}

// ============================================================
//  DIRECTIONAL SPRITE FRAMEWORK
// ============================================================
// Flip canvas horizontally (used to generate LEFT from RIGHT)
function flipH(canvas) {
  const c = makeCanvas(canvas.width, canvas.height);
  const ctx = c.getContext('2d');
  ctx.translate(canvas.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(canvas, 0, 0);
  return c;
}

// Store 8-directional sprites with optional attack frames
// Mirrors: left=flip(right), down_left=flip(down_right), up_left=flip(up_right)
// Basic: setDirCache(key, down, up, right, atkDown, atkUp, atkRight)
// Full 8-dir: setDirCache8(key, {down,down_right,right,up_right,up, atk_down,atk_down_right,atk_right,atk_up_right,atk_up})
function setDirCache(key, down, up, right, atkDown, atkUp, atkRight) {
  const downFrames = remasterSpriteFrames(key + '_down', down);
  const rightFrames = remasterSpriteFrames(key + '_right', right || down);
  const upFrames = remasterSpriteFrames(key + '_up', up || down);
  const r = rightFrames, u = upFrames;
  const cache = {
    down: downFrames, up: u, right: r,
    down_right: r, up_right: u,
    left: r.map(c => flipH(c)),
    down_left: r.map(c => flipH(c)),
    up_left: u.map(c => flipH(c)),
  };
  if (atkDown) {
    const atkDownFrames = remasterSpriteFrames(key + '_atk_down', atkDown);
    const ar = remasterSpriteFrames(key + '_atk_right', atkRight || atkDown);
    const au = remasterSpriteFrames(key + '_atk_up', atkUp || atkDown);
    cache.atk_down = atkDownFrames; cache.atk_up = au; cache.atk_right = ar;
    cache.atk_down_right = ar; cache.atk_up_right = au;
    cache.atk_left = ar.map(c => flipH(c));
    cache.atk_down_left = ar.map(c => flipH(c));
    cache.atk_up_left = au.map(c => flipH(c));
  }
  SpriteCache[key] = cache;
}

// Full 8-direction cache with diagonals as unique sprites
function setDirCache8(key, s) {
  const down = remasterSpriteFrames(key + '_down', s.down);
  const r = remasterSpriteFrames(key + '_right', s.right || s.down);
  const u = remasterSpriteFrames(key + '_up', s.up || s.down);
  const dr = remasterSpriteFrames(key + '_down_right', s.down_right || s.right || s.down);
  const ur = remasterSpriteFrames(key + '_up_right', s.up_right || s.up || s.down);
  const cache = {
    down, up: u, right: r,
    down_right: dr, up_right: ur,
    left: r.map(c => flipH(c)),
    down_left: dr.map(c => flipH(c)),
    up_left: ur.map(c => flipH(c)),
  };
  // Attack frames
  if (s.atk_down) {
    const atkDown = remasterSpriteFrames(key + '_atk_down', s.atk_down);
    const ar = remasterSpriteFrames(key + '_atk_right', s.atk_right || s.atk_down);
    const au = remasterSpriteFrames(key + '_atk_up', s.atk_up || s.atk_down);
    const adr = remasterSpriteFrames(key + '_atk_down_right', s.atk_down_right || s.atk_right || s.atk_down);
    const aur = remasterSpriteFrames(key + '_atk_up_right', s.atk_up_right || s.atk_up || s.atk_down);
    cache.atk_down = atkDown; cache.atk_up = au; cache.atk_right = ar;
    cache.atk_down_right = adr; cache.atk_up_right = aur;
    cache.atk_left = ar.map(c => flipH(c));
    cache.atk_down_left = adr.map(c => flipH(c));
    cache.atk_up_left = aur.map(c => flipH(c));
  }
  SpriteCache[key] = cache;
}

// ============================================================
//  CORE RENDERING HELPERS
// ============================================================
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function colorShift(hex, amt) {
  let r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  r = clamp(r + amt, 0, 255); g = clamp(g + amt, 0, 255); b = clamp(b + amt, 0, 255);
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

function hexToRgb(hex) {
  return { r: parseInt(hex.slice(1, 3), 16), g: parseInt(hex.slice(3, 5), 16), b: parseInt(hex.slice(5, 7), 16) };
}

function rgbStr(r, g, b, a) {
  if (a !== undefined) return `rgba(${clamp(r|0,0,255)},${clamp(g|0,0,255)},${clamp(b|0,0,255)},${a})`;
  return `rgb(${clamp(r|0,0,255)},${clamp(g|0,0,255)},${clamp(b|0,0,255)})`;
}

function draw3DShadow(ctx, cx, cy, rx, ry) {
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rx);
  g.addColorStop(0, 'rgba(0,0,0,0.4)');
  g.addColorStop(0.5, 'rgba(0,0,0,0.18)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry || rx * 0.35, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawSphere(ctx, cx, cy, r, baseC, lightC, darkC) {
  const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.05, cx, cy, r);
  g.addColorStop(0, lightC);
  g.addColorStop(0.5, baseC);
  g.addColorStop(1, darkC);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  addSpecular(ctx, cx - r * 0.25, cy - r * 0.3, r * 0.22, r * 0.15);
}

function drawCylinder(ctx, x, y, w, h, baseC, lightC, darkC) {
  const g = ctx.createLinearGradient(x, y, x + w, y);
  g.addColorStop(0, darkC);
  g.addColorStop(0.25, lightC);
  g.addColorStop(0.55, baseC);
  g.addColorStop(1, darkC);
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  // top highlight
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(x + 1, y, w - 2, 2);
}

function drawMetalPlate(ctx, x, y, w, h, baseC, lightC, darkC) {
  const g = ctx.createLinearGradient(x, y, x + w * 0.3, y + h);
  g.addColorStop(0, lightC || '#bbbbbb');
  g.addColorStop(0.35, baseC || '#888888');
  g.addColorStop(1, darkC || '#555555');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 2);
  ctx.fill();
  // top bevel
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(x + 1, y + 1, w - 2, 2);
  // bottom shadow
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.fillRect(x + 1, y + h - 2, w - 2, 1);
  // left bevel
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.fillRect(x, y + 2, 1, h - 4);
  // right shadow
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.fillRect(x + w - 1, y + 2, 1, h - 4);
}

function addSpecular(ctx, cx, cy, rx, ry, alpha) {
  ctx.fillStyle = `rgba(255,255,255,${alpha || 0.45})`;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry || rx * 0.6, -0.4, 0, Math.PI * 2);
  ctx.fill();
}

function addRimLight(ctx, cx, cy, r, color, alpha) {
  ctx.strokeStyle = color || 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = alpha || 0.3;
  ctx.beginPath();
  ctx.arc(cx, cy, r, -Math.PI * 0.7, Math.PI * 0.1);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function addAO(ctx, cx, cy, rx, ry) {
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry || 3, 0, 0, Math.PI * 2);
  ctx.fill();
}

// Advanced: draw a rounded organic shape with radial gradient
function drawOrganicBlob(ctx, cx, cy, r, baseC, lightC, darkC, bumps) {
  const g = ctx.createRadialGradient(cx - r * 0.25, cy - r * 0.25, r * 0.05, cx, cy, r);
  g.addColorStop(0, lightC);
  g.addColorStop(0.5, baseC);
  g.addColorStop(1, darkC);
  ctx.fillStyle = g;
  ctx.beginPath();
  for (let i = 0; i <= 36; i++) {
    const a = (i / 36) * Math.PI * 2;
    const bumpVal = bumps ? (1 + Math.sin(a * bumps) * 0.08) : 1;
    const px = cx + Math.cos(a) * r * bumpVal;
    const py = cy + Math.sin(a) * r * bumpVal;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}

// Draw detailed eye with iris, pupil, highlight
function drawDetailedEye(ctx, cx, cy, r, irisC, pupilDir) {
  const dx = (pupilDir || 0) * r * 0.15;
  // White
  const eg = ctx.createRadialGradient(cx - r * 0.2, cy - r * 0.2, r * 0.05, cx, cy, r);
  eg.addColorStop(0, '#ffffff');
  eg.addColorStop(0.8, '#eeeeee');
  eg.addColorStop(1, '#cccccc');
  ctx.fillStyle = eg;
  ctx.beginPath();
  ctx.ellipse(cx, cy, r, r * 1.15, 0, 0, Math.PI * 2);
  ctx.fill();
  // Iris
  const ig = ctx.createRadialGradient(cx + dx - r * 0.1, cy - r * 0.1, r * 0.05, cx + dx, cy, r * 0.55);
  ig.addColorStop(0, colorShift(irisC, 30));
  ig.addColorStop(0.6, irisC);
  ig.addColorStop(1, colorShift(irisC, -40));
  ctx.fillStyle = ig;
  ctx.beginPath();
  ctx.arc(cx + dx, cy + r * 0.08, r * 0.55, 0, Math.PI * 2);
  ctx.fill();
  // Pupil
  ctx.fillStyle = '#111111';
  ctx.beginPath();
  ctx.arc(cx + dx, cy + r * 0.1, r * 0.28, 0, Math.PI * 2);
  ctx.fill();
  // Highlight
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.beginPath();
  ctx.arc(cx + dx - r * 0.18, cy - r * 0.18, r * 0.18, 0, Math.PI * 2);
  ctx.fill();
  // Secondary highlight
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.arc(cx + dx + r * 0.2, cy + r * 0.2, r * 0.1, 0, Math.PI * 2);
  ctx.fill();
}

// Draw a metal rivet/stud
function drawRivet(ctx, cx, cy, r) {
  const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, 0, cx, cy, r);
  g.addColorStop(0, '#dddddd');
  g.addColorStop(0.5, '#999999');
  g.addColorStop(1, '#555555');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
}

// Draw gem inlay
function drawGem(ctx, cx, cy, r, color) {
  const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.4, r * 0.05, cx, cy, r);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.3, colorShift(color, 50));
  g.addColorStop(0.7, color);
  g.addColorStop(1, colorShift(color, -60));
  ctx.fillStyle = g;
  ctx.beginPath();
  // Faceted shape
  ctx.moveTo(cx, cy - r);
  ctx.lineTo(cx + r * 0.85, cy - r * 0.15);
  ctx.lineTo(cx + r * 0.5, cy + r * 0.8);
  ctx.lineTo(cx - r * 0.5, cy + r * 0.8);
  ctx.lineTo(cx - r * 0.85, cy - r * 0.15);
  ctx.closePath();
  ctx.fill();
  // Facet highlight
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.beginPath();
  ctx.moveTo(cx, cy - r);
  ctx.lineTo(cx + r * 0.4, cy - r * 0.1);
  ctx.lineTo(cx, cy + r * 0.2);
  ctx.lineTo(cx - r * 0.4, cy - r * 0.1);
  ctx.closePath();
  ctx.fill();
}

// Draw engraved trim line
function drawEngravingLine(ctx, x1, y1, x2, y2, color) {
  ctx.strokeStyle = colorShift(color, -30);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.strokeStyle = colorShift(color, 20);
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(x1, y1 + 1);
  ctx.lineTo(x2, y2 + 1);
  ctx.stroke();
}

// Draw flowing cape with wind animation per frame
function drawCape(ctx, cx, topY, width, length, color, frame) {
  const windPhase = Math.sin(frame * Math.PI / 2) * 3;
  const windPhase2 = Math.cos(frame * Math.PI / 2) * 2;
  const cg = ctx.createLinearGradient(cx - width / 2, topY, cx + width / 2, topY + length);
  cg.addColorStop(0, color);
  cg.addColorStop(0.4, colorShift(color, -15));
  cg.addColorStop(0.8, colorShift(color, -35));
  cg.addColorStop(1, colorShift(color, -50));
  ctx.fillStyle = cg;
  ctx.beginPath();
  ctx.moveTo(cx - width / 2, topY);
  ctx.bezierCurveTo(
    cx - width / 2 - 2, topY + length * 0.3,
    cx - width / 2 - 1 + windPhase, topY + length * 0.7,
    cx - width / 2 + 2 + windPhase, topY + length
  );
  ctx.lineTo(cx + width / 2 - 2 + windPhase2, topY + length);
  ctx.bezierCurveTo(
    cx + width / 2 + 1 + windPhase2, topY + length * 0.7,
    cx + width / 2 + 2, topY + length * 0.3,
    cx + width / 2, topY
  );
  ctx.closePath();
  ctx.fill();
  // Fold shadows
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.beginPath();
  ctx.moveTo(cx + 2, topY + 2);
  ctx.bezierCurveTo(cx + 3, topY + length * 0.4, cx + 1 + windPhase2, topY + length * 0.7, cx + windPhase2, topY + length);
  ctx.lineTo(cx + width / 2 - 2 + windPhase2, topY + length);
  ctx.bezierCurveTo(cx + width / 2, topY + length * 0.6, cx + width / 2 + 1, topY + length * 0.3, cx + width / 2, topY);
  ctx.lineTo(cx + 2, topY);
  ctx.closePath();
  ctx.fill();
  // Edge highlight
  ctx.strokeStyle = colorShift(color, 20);
  ctx.lineWidth = 0.6;
  ctx.globalAlpha = 0.3;
  ctx.beginPath();
  ctx.moveTo(cx - width / 2, topY);
  ctx.bezierCurveTo(
    cx - width / 2 - 2, topY + length * 0.3,
    cx - width / 2 - 1 + windPhase, topY + length * 0.7,
    cx - width / 2 + 2 + windPhase, topY + length
  );
  ctx.stroke();
  ctx.globalAlpha = 1;
}

// Draw ornate sword blade
function drawSwordBlade(ctx, x, y, length, width, metalC) {
  const g = ctx.createLinearGradient(x, y, x + width, y);
  g.addColorStop(0, colorShift(metalC, -20));
  g.addColorStop(0.3, colorShift(metalC, 40));
  g.addColorStop(0.5, metalC);
  g.addColorStop(0.7, colorShift(metalC, 30));
  g.addColorStop(1, colorShift(metalC, -30));
  ctx.fillStyle = g;
  // Blade shape (tapered)
  ctx.beginPath();
  ctx.moveTo(x + width * 0.3, y);
  ctx.lineTo(x + width * 0.7, y);
  ctx.lineTo(x + width * 0.6, y + length * 0.92);
  ctx.lineTo(x + width * 0.5, y + length);
  ctx.lineTo(x + width * 0.4, y + length * 0.92);
  ctx.closePath();
  ctx.fill();
  // Edge highlight
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(x + width * 0.35, y + 1);
  ctx.lineTo(x + width * 0.45, y + length * 0.9);
  ctx.stroke();
  // Fuller (blood groove)
  ctx.strokeStyle = colorShift(metalC, -15);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + width * 0.5, y + 3);
  ctx.lineTo(x + width * 0.5, y + length * 0.7);
  ctx.stroke();
}

function drawHumanoidRegalia(ctx, cx, topY, bodyW, bodyH, palette, dir) {
  const {
    armorC,
    armorL,
    armorD,
    clothC = '#6a1420',
    gemC = '#ffd36a'
  } = palette;

  const shoulderY = topY + 3;
  const frontFacing = dir === 'down' || dir === 'down_right';
  const backFacing = dir === 'up' || dir === 'up_right';
  const sideFacing = dir === 'right';

  if (!sideFacing) {
    drawMetalPlate(ctx, cx - bodyW * 0.66, shoulderY, 7, 6, armorC, armorL, armorD);
    drawMetalPlate(ctx, cx + bodyW * 0.66 - 7, shoulderY, 7, 6, armorC, armorL, armorD);
    drawRivet(ctx, cx - bodyW * 0.66 + 2, shoulderY + 2, 1);
    drawRivet(ctx, cx + bodyW * 0.66 - 2, shoulderY + 2, 1);
  } else {
    drawMetalPlate(ctx, cx + bodyW * 0.35, shoulderY, 7, 6, armorC, armorL, armorD);
    drawRivet(ctx, cx + bodyW * 0.35 + 2, shoulderY + 2, 1);
  }

  if (frontFacing) {
    ctx.fillStyle = clothC;
    ctx.beginPath();
    ctx.moveTo(cx - 4, topY + bodyH * 0.32);
    ctx.lineTo(cx + 4, topY + bodyH * 0.32);
    ctx.lineTo(cx + 7, topY + bodyH + 1);
    ctx.lineTo(cx, topY + bodyH + 5);
    ctx.lineTo(cx - 7, topY + bodyH + 1);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.beginPath();
    ctx.moveTo(cx - 2, topY + bodyH * 0.34);
    ctx.lineTo(cx + 1, topY + bodyH * 0.34);
    ctx.lineTo(cx, topY + bodyH + 2);
    ctx.closePath();
    ctx.fill();
    drawGem(ctx, cx, topY + bodyH * 0.42, 2.2, gemC);
  } else if (backFacing) {
    ctx.strokeStyle = colorShift(armorD, -10);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, topY + 4);
    ctx.lineTo(cx, topY + bodyH - 1);
    ctx.stroke();
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = armorL;
    ctx.beginPath();
    ctx.ellipse(cx, topY + bodyH * 0.35, bodyW * 0.18, bodyH * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  } else {
    ctx.fillStyle = clothC;
    ctx.beginPath();
    ctx.moveTo(cx + bodyW * 0.1, topY + bodyH * 0.4);
    ctx.lineTo(cx + bodyW * 0.34, topY + bodyH * 0.55);
    ctx.lineTo(cx + bodyW * 0.12, topY + bodyH + 2);
    ctx.closePath();
    ctx.fill();
  }

  ctx.strokeStyle = colorShift(armorL, 6);
  ctx.globalAlpha = 0.28;
  ctx.beginPath();
  ctx.moveTo(cx - bodyW * 0.26, topY + 4);
  ctx.lineTo(cx + bodyW * 0.26, topY + 4);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

// ============================================================
//  SLIME SPRITES (Translucent jelly with subsurface scattering)
// ============================================================
function _drawSlimeBody(x, cx, baseY, rw, rh, s, mainC, lightC, darkC) {
  draw3DShadow(x, cx, s * 0.88, rw * 0.8, 5);
  x.fillStyle = lightC; x.globalAlpha = 0.15;
  x.beginPath(); x.ellipse(cx, baseY + 3, rw * 0.95, rh * 0.85, 0, 0, Math.PI * 2); x.fill();
  x.globalAlpha = 1;
  x.fillStyle = darkC;
  x.beginPath(); x.ellipse(cx, baseY + 1, rw + 2, rh + 2, 0, 0, Math.PI * 2); x.fill();
  const bg = x.createRadialGradient(cx - s * 0.1, baseY - s * 0.12, s * 0.02, cx + s * 0.02, baseY + s * 0.02, rw * 1.05);
  bg.addColorStop(0, lightC); bg.addColorStop(0.3, mainC); bg.addColorStop(0.65, darkC); bg.addColorStop(1, colorShift(darkC, -30));
  x.fillStyle = bg;
  x.beginPath(); x.ellipse(cx, baseY, rw, rh, 0, 0, Math.PI * 2); x.fill();
  const ig = x.createRadialGradient(cx + s * 0.03, baseY + rh * 0.2, 0, cx, baseY, rw * 0.7);
  ig.addColorStop(0, 'rgba(255,255,255,0.15)'); ig.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = ig;
  x.beginPath(); x.ellipse(cx + 2, baseY + rh * 0.12, rw * 0.55, rh * 0.45, 0, 0, Math.PI * 2); x.fill();
  x.fillStyle = 'rgba(255,255,255,0.06)';
  x.beginPath(); x.ellipse(cx - rw * 0.2, baseY + rh * 0.2, rw * 0.3, rh * 0.2, 0.3, 0, Math.PI * 2); x.fill();
  x.fillStyle = 'rgba(255,255,255,0.5)';
  x.beginPath(); x.ellipse(cx - s * 0.08, baseY - rh * 0.5, rw * 0.3, rh * 0.14, -0.5, 0, Math.PI * 2); x.fill();
  x.fillStyle = 'rgba(255,255,255,0.7)';
  x.beginPath(); x.ellipse(cx - s * 0.12, baseY - rh * 0.55, rw * 0.1, rh * 0.06, -0.3, 0, Math.PI * 2); x.fill();
  x.strokeStyle = lightC; x.lineWidth = 1.5; x.globalAlpha = 0.4;
  x.beginPath(); x.arc(cx, baseY, rw * 0.88, -Math.PI * 0.8, -Math.PI * 0.05); x.stroke();
  x.globalAlpha = 1;
}

function genSlime(key, mainC, lightC, darkC, size) {
  const dirs = { down: [], down_right: [], up: [], up_right: [], right: [] };
  for (const dir of ['down', 'down_right', 'right', 'up_right', 'up']) {
    for (let f = 0; f < 4; f++) {
      const s = size || 56;
      const c = makeCanvas(s, s);
      const x = c.getContext('2d');
      const cx = s / 2, cy = s / 2 + 3;
      const squish = 1 + Math.sin(f * Math.PI / 2) * 0.18;
      const rw = s * 0.4 * squish, rh = s * 0.34 / squish;
      const baseY = cy + (1 - 1 / squish) * s * 0.1;

      _drawSlimeBody(x, cx, baseY, rw, rh, s, mainC, lightC, darkC);

      if (dir === 'down') {
        const eyeY = baseY - rh * 0.18;
        [-5.5, 5.5].forEach(ox => { drawDetailedEye(x, cx + ox, eyeY, 4.5, '#333333', ox > 0 ? 1 : -1); });
        x.strokeStyle = darkC; x.lineWidth = 1.5; x.lineCap = 'round';
        x.beginPath(); x.arc(cx + 1, baseY + rh * 0.2, 4.5, 0.25, Math.PI - 0.25); x.stroke();
        x.fillStyle = 'rgba(255,140,140,0.22)';
        x.beginPath(); x.ellipse(cx - 11, baseY + 2, 4.5, 2.5, 0, 0, Math.PI * 2); x.fill();
        x.beginPath(); x.ellipse(cx + 13, baseY + 2, 4.5, 2.5, 0, 0, Math.PI * 2); x.fill();
      } else if (dir === 'down_right') {
        // 3/4 front-right: one full eye right, one smaller left
        const eyeY = baseY - rh * 0.18;
        drawDetailedEye(x, cx + 7, eyeY, 4.5, '#333333', 1);
        drawDetailedEye(x, cx - 2, eyeY, 3.5, '#333333', -1);
        x.strokeStyle = darkC; x.lineWidth = 1.5; x.lineCap = 'round';
        x.beginPath(); x.arc(cx + 5, baseY + rh * 0.18, 4, 0.2, Math.PI - 0.3); x.stroke();
        x.fillStyle = 'rgba(255,140,140,0.22)';
        x.beginPath(); x.ellipse(cx + 14, baseY + 2, 4, 2.5, 0, 0, Math.PI * 2); x.fill();
      } else if (dir === 'right') {
        const eyeY = baseY - rh * 0.18;
        [2, 10].forEach(ox => { drawDetailedEye(x, cx + ox, eyeY, 4, '#333333', 1); });
        x.strokeStyle = darkC; x.lineWidth = 1.5; x.lineCap = 'round';
        x.beginPath(); x.arc(cx + 8, baseY + rh * 0.15, 3.5, 0.2, Math.PI - 0.2); x.stroke();
        x.fillStyle = 'rgba(255,140,140,0.22)';
        x.beginPath(); x.ellipse(cx + 14, baseY + 2, 4, 2.5, 0, 0, Math.PI * 2); x.fill();
      } else if (dir === 'up_right') {
        // 3/4 back-right: back of body with slight side visible
        x.fillStyle = 'rgba(255,255,255,0.1)';
        x.beginPath(); x.ellipse(cx + 3, baseY - rh * 0.1, rw * 0.35, rh * 0.25, 0, 0, Math.PI * 2); x.fill();
        // Slight eye peek from side
        const eyeY = baseY - rh * 0.22;
        drawDetailedEye(x, cx + 8, eyeY, 2.5, '#333333', 1);
      } else {
        // 'up' = no face (back view)
        x.fillStyle = 'rgba(255,255,255,0.12)';
        x.beginPath(); x.ellipse(cx, baseY - rh * 0.1, rw * 0.4, rh * 0.3, 0, 0, Math.PI * 2); x.fill();
      }

      // Bounce particles
      if (f === 0 || f === 2) {
        x.fillStyle = lightC; x.globalAlpha = 0.35;
        for (let i = 0; i < 4; i++) {
          const pa = i * Math.PI / 2 + f * 0.5;
          const pr = rw * 0.6 + i * 2;
          x.beginPath(); x.arc(cx + Math.cos(pa) * pr, baseY + rh * 0.8 + Math.sin(pa) * 3, 1.5 + Math.random(), 0, Math.PI * 2); x.fill();
        }
        x.globalAlpha = 1;
      }
      dirs[dir].push(c);
    }
  }
  // Attack frames
  const atk = {down: [], down_right: [], up: [], up_right: [], right: []};
  for (const dir of ['down', 'down_right', 'right', 'up_right', 'up']) {
    for (let f = 0; f < 4; f++) {
      const s = size || 56;
      const c = makeCanvas(s, s);
      const x = c.getContext('2d');
      const cx = s / 2, cy = s / 2 + 3;
      const atkPhase = f / 3;
      const squish = 1 + Math.sin(atkPhase * Math.PI) * 0.35;
      const rw = s * 0.4 * squish, rh = s * 0.34 / squish;
      const lungeX = (dir === 'right' || dir === 'down_right' || dir === 'up_right') ? atkPhase * 4 * (dir === 'right' ? 1 : 0.7) : 0;
      const lungeY = (dir === 'down' || dir === 'down_right') ? atkPhase * 3 * (dir === 'down' ? 1 : 0.7) : (dir === 'up' || dir === 'up_right') ? -atkPhase * 3 * (dir === 'up' ? 1 : 0.7) : 0;
      const baseY = cy + (1 - 1 / squish) * s * 0.1 + lungeY;

      _drawSlimeBody(x, cx + lungeX, baseY, rw, rh, s, mainC, lightC, darkC);

      if (dir === 'down') {
        const eyeY = baseY - rh * 0.18;
        [-5.5, 5.5].forEach(ox => {
          x.fillStyle = '#ffffff';
          x.beginPath(); x.ellipse(cx + ox, eyeY, 4.5, 3, ox > 0 ? 0.3 : -0.3, 0, Math.PI * 2); x.fill();
          x.fillStyle = '#cc0000';
          x.beginPath(); x.arc(cx + ox + (ox > 0 ? 1 : -1), eyeY + 0.5, 2.5, 0, Math.PI * 2); x.fill();
          x.fillStyle = '#111111';
          x.beginPath(); x.arc(cx + ox + (ox > 0 ? 1 : -1), eyeY + 0.5, 1.2, 0, Math.PI * 2); x.fill();
          x.strokeStyle = darkC; x.lineWidth = 2;
          x.beginPath();
          x.moveTo(cx + ox - 4, eyeY - 4 + (ox > 0 ? -1 : 1));
          x.lineTo(cx + ox + 4, eyeY - 4 + (ox > 0 ? 1 : -1));
          x.stroke();
        });
        x.fillStyle = '#220000';
        x.beginPath(); x.ellipse(cx, baseY + rh * 0.25, 7 + atkPhase * 3, 4 + atkPhase * 2, 0, 0, Math.PI * 2); x.fill();
        x.fillStyle = '#ffffff'; x.globalAlpha = 0.8;
        for (let i = -2; i <= 2; i++) {
          x.beginPath(); x.moveTo(cx + i * 3, baseY + rh * 0.15);
          x.lineTo(cx + i * 3 - 1, baseY + rh * 0.25); x.lineTo(cx + i * 3 + 1, baseY + rh * 0.25); x.fill();
        }
        x.globalAlpha = 1;
      } else if (dir === 'down_right') {
        // 3/4 front-right angry face
        const eyeY = baseY - rh * 0.18;
        x.fillStyle = '#ffffff';
        x.beginPath(); x.ellipse(cx + lungeX + 7, eyeY, 4.5, 3, 0.3, 0, Math.PI * 2); x.fill();
        x.fillStyle = '#cc0000';
        x.beginPath(); x.arc(cx + lungeX + 8, eyeY + 0.5, 2.5, 0, Math.PI * 2); x.fill();
        x.fillStyle = '#111111';
        x.beginPath(); x.arc(cx + lungeX + 8, eyeY + 0.5, 1.2, 0, Math.PI * 2); x.fill();
        x.fillStyle = '#ffffff';
        x.beginPath(); x.ellipse(cx + lungeX - 1, eyeY, 3.5, 2.5, -0.2, 0, Math.PI * 2); x.fill();
        x.fillStyle = '#cc0000';
        x.beginPath(); x.arc(cx + lungeX - 1, eyeY + 0.5, 2, 0, Math.PI * 2); x.fill();
        x.fillStyle = '#111111';
        x.beginPath(); x.arc(cx + lungeX - 1, eyeY + 0.5, 0.9, 0, Math.PI * 2); x.fill();
        x.strokeStyle = darkC; x.lineWidth = 2;
        x.beginPath(); x.moveTo(cx + lungeX + 3, eyeY - 5); x.lineTo(cx + lungeX + 11, eyeY - 3); x.stroke();
        x.beginPath(); x.moveTo(cx + lungeX - 5, eyeY - 4); x.lineTo(cx + lungeX + 2, eyeY - 5); x.stroke();
        x.fillStyle = '#220000';
        x.beginPath(); x.ellipse(cx + lungeX + 5, baseY + rh * 0.22, 6 + atkPhase * 2, 3.5 + atkPhase * 1.5, 0.15, 0, Math.PI * 2); x.fill();
        x.fillStyle = '#ffffff'; x.globalAlpha = 0.8;
        for (let i = -1; i <= 2; i++) {
          x.beginPath(); x.moveTo(cx + lungeX + 2 + i * 3, baseY + rh * 0.12);
          x.lineTo(cx + lungeX + 1 + i * 3, baseY + rh * 0.22); x.lineTo(cx + lungeX + 3 + i * 3, baseY + rh * 0.22); x.fill();
        }
        x.globalAlpha = 1;
      } else if (dir === 'right') {
        const eyeY = baseY - rh * 0.18;
        x.fillStyle = '#ffffff';
        x.beginPath(); x.ellipse(cx + lungeX + 6, eyeY, 4, 2.8, 0.3, 0, Math.PI * 2); x.fill();
        x.fillStyle = '#cc0000';
        x.beginPath(); x.arc(cx + lungeX + 7, eyeY + 0.5, 2.2, 0, Math.PI * 2); x.fill();
        x.fillStyle = '#111111';
        x.beginPath(); x.arc(cx + lungeX + 7, eyeY + 0.5, 1, 0, Math.PI * 2); x.fill();
        x.strokeStyle = darkC; x.lineWidth = 2;
        x.beginPath(); x.moveTo(cx + lungeX + 1, eyeY - 5); x.lineTo(cx + lungeX + 10, eyeY - 3); x.stroke();
        x.fillStyle = '#220000';
        x.beginPath(); x.ellipse(cx + lungeX + 10, baseY + rh * 0.2, 5 + atkPhase * 2, 3 + atkPhase * 1.5, 0.2, 0, Math.PI * 2); x.fill();
        x.fillStyle = '#ffffff'; x.globalAlpha = 0.8;
        x.beginPath(); x.moveTo(cx + lungeX + 8, baseY + rh * 0.1);
        x.lineTo(cx + lungeX + 7, baseY + rh * 0.2); x.lineTo(cx + lungeX + 9, baseY + rh * 0.2); x.fill();
        x.beginPath(); x.moveTo(cx + lungeX + 12, baseY + rh * 0.1);
        x.lineTo(cx + lungeX + 11, baseY + rh * 0.2); x.lineTo(cx + lungeX + 13, baseY + rh * 0.2); x.fill();
        x.globalAlpha = 1;
      } else if (dir === 'up_right') {
        // 3/4 back-right angry
        x.fillStyle = 'rgba(255,255,255,0.1)';
        x.beginPath(); x.ellipse(cx + lungeX + 3, baseY - rh * 0.1, rw * 0.35, rh * 0.25, 0, 0, Math.PI * 2); x.fill();
        // Angry back spikes shifted right
        x.fillStyle = darkC; x.globalAlpha = 0.6;
        for (let i = -1; i <= 2; i++) {
          x.beginPath();
          x.moveTo(cx + lungeX + i * 5 + 2, baseY - rh * 0.6);
          x.lineTo(cx + lungeX + i * 5, baseY - rh * 0.3);
          x.lineTo(cx + lungeX + i * 5 + 4, baseY - rh * 0.3);
          x.fill();
        }
        x.globalAlpha = 1;
        // Slight angry eye peek
        const eyeY = baseY - rh * 0.22;
        x.fillStyle = '#ffffff';
        x.beginPath(); x.ellipse(cx + lungeX + 8, eyeY, 3, 2, 0.3, 0, Math.PI * 2); x.fill();
        x.fillStyle = '#cc0000';
        x.beginPath(); x.arc(cx + lungeX + 8.5, eyeY + 0.3, 1.5, 0, Math.PI * 2); x.fill();
        x.fillStyle = '#111111';
        x.beginPath(); x.arc(cx + lungeX + 8.5, eyeY + 0.3, 0.7, 0, Math.PI * 2); x.fill();
      } else {
        // 'up'
        x.fillStyle = 'rgba(255,255,255,0.12)';
        x.beginPath(); x.ellipse(cx, baseY - rh * 0.1, rw * 0.4, rh * 0.3, 0, 0, Math.PI * 2); x.fill();
        x.fillStyle = darkC; x.globalAlpha = 0.6;
        for (let i = -2; i <= 2; i++) {
          x.beginPath();
          x.moveTo(cx + i * 5, baseY - rh * 0.6);
          x.lineTo(cx + i * 5 - 2, baseY - rh * 0.3);
          x.lineTo(cx + i * 5 + 2, baseY - rh * 0.3);
          x.fill();
        }
        x.globalAlpha = 1;
      }

      // Attack particles
      x.fillStyle = lightC; x.globalAlpha = 0.5;
      for (let i = 0; i < 6; i++) {
        const pa = i * Math.PI / 3 + f * 0.7;
        const pr = rw * 0.7 + i * 2;
        x.beginPath(); x.arc(cx + lungeX + Math.cos(pa) * pr, baseY + rh * 0.7 + Math.sin(pa) * 4, 2 + Math.random(), 0, Math.PI * 2); x.fill();
      }
      x.globalAlpha = 1;

      atk[dir].push(c);
    }
  }
  setDirCache8(key, {
    down: dirs.down, down_right: dirs.down_right, right: dirs.right,
    up_right: dirs.up_right, up: dirs.up,
    atk_down: atk.down, atk_down_right: atk.down_right, atk_right: atk.right,
    atk_up_right: atk.up_right, atk_up: atk.up
  });
}

// ============================================================
//  WOLF SPRITE (Muscular beast with detailed fur)
// ============================================================
function _genWolfSide(bodyC, lightC, darkC, f) {
  // Side-facing wolf (used for RIGHT direction)
  const c = makeCanvas(68, 52);
  const x = c.getContext('2d');
  const cx = 34, legOff = Math.sin(f * Math.PI / 2) * 4;
  draw3DShadow(x, cx, 47, 24, 5);
  // Tail
  x.strokeStyle = bodyC; x.lineWidth = 6; x.lineCap = 'round';
  x.beginPath(); x.moveTo(10, 24);
  x.bezierCurveTo(6, 18 + Math.sin(f * Math.PI / 2) * 4, 4, 12, 7, 7); x.stroke();
  x.strokeStyle = lightC; x.lineWidth = 3;
  x.beginPath(); x.moveTo(10, 24); x.bezierCurveTo(6, 18, 5, 13, 8, 9); x.stroke();
  x.fillStyle = lightC; x.beginPath(); x.arc(7, 7, 3, 0, Math.PI * 2); x.fill();
  // Legs
  [14, 20].forEach((lx, i) => {
    const lo = i === 0 ? -legOff : legOff;
    drawCylinder(x, lx - 1, 28 + lo, 8, 8, bodyC, lightC, darkC);
    drawCylinder(x, lx, 34 + lo, 6, 10 - lo * 0.2, bodyC, lightC, darkC);
    x.fillStyle = darkC; x.beginPath(); x.ellipse(lx + 3, 44 + lo * 0.2, 5.5, 3.5, 0, 0, Math.PI * 2); x.fill();
  });
  [40, 46].forEach((lx, i) => {
    const lo = i === 0 ? legOff : -legOff;
    drawCylinder(x, lx - 1, 28 + lo, 8, 8, bodyC, lightC, darkC);
    drawCylinder(x, lx, 34 + lo, 6, 10 - lo * 0.2, bodyC, lightC, darkC);
    x.fillStyle = darkC; x.beginPath(); x.ellipse(lx + 3, 44 + lo * 0.2, 5.5, 3.5, 0, 0, Math.PI * 2); x.fill();
  });
  // Body
  const bg = x.createRadialGradient(cx - 5, 18, 3, cx, 26, 23);
  bg.addColorStop(0, lightC); bg.addColorStop(0.45, bodyC); bg.addColorStop(1, darkC);
  x.fillStyle = bg; x.beginPath(); x.ellipse(cx, 26, 23, 12, 0, 0, Math.PI * 2); x.fill();
  x.fillStyle = lightC; x.globalAlpha = 0.15;
  x.beginPath(); x.ellipse(cx, 30, 16, 5, 0, 0, Math.PI * 2); x.fill(); x.globalAlpha = 1;
  addRimLight(x, cx, 26, 22, lightC, 0.25);
  // Neck + Head
  const ng = x.createLinearGradient(42, 18, 52, 24);
  ng.addColorStop(0, bodyC); ng.addColorStop(1, lightC);
  x.fillStyle = ng; x.beginPath(); x.ellipse(46, 22, 8, 6, 0.3, 0, Math.PI * 2); x.fill();
  drawSphere(x, 52, 18, 11, bodyC, lightC, darkC);
  // Muzzle
  const sg = x.createRadialGradient(58, 20, 1, 58, 22, 7);
  sg.addColorStop(0, lightC); sg.addColorStop(1, darkC);
  x.fillStyle = sg; x.beginPath(); x.ellipse(58, 22, 7, 5, 0.2, 0, Math.PI * 2); x.fill();
  x.fillStyle = '#1a1a1a'; x.beginPath(); x.ellipse(62, 21, 3, 2.2, 0, 0, Math.PI * 2); x.fill();
  addSpecular(x, 61, 20, 1.2, 0.8, 0.55);
  // Ears
  x.fillStyle = bodyC;
  x.beginPath(); x.moveTo(44, 12); x.lineTo(39, 2); x.lineTo(47, 10); x.fill();
  x.beginPath(); x.moveTo(53, 11); x.lineTo(50, 1); x.lineTo(56, 9); x.fill();
  x.fillStyle = '#cc8888';
  x.beginPath(); x.moveTo(44, 11); x.lineTo(41, 5); x.lineTo(46, 10); x.fill();
  x.beginPath(); x.moveTo(53, 10); x.lineTo(51, 4); x.lineTo(55, 9); x.fill();
  // Eye (one visible from side)
  x.shadowColor = '#ffcc44'; x.shadowBlur = 5;
  x.fillStyle = '#ffcc44'; x.beginPath(); x.ellipse(47, 16, 3.5, 4, 0, 0, Math.PI * 2); x.fill();
  x.shadowBlur = 0;
  const eyeG = x.createRadialGradient(47, 16, 0.5, 47, 16, 3.5);
  eyeG.addColorStop(0, '#ffee66'); eyeG.addColorStop(0.5, '#ffaa22'); eyeG.addColorStop(1, '#885500');
  x.fillStyle = eyeG; x.beginPath(); x.ellipse(47, 16, 3.5, 4, 0, 0, Math.PI * 2); x.fill();
  x.fillStyle = '#111111'; x.beginPath(); x.ellipse(47.5, 16, 1.2, 3.2, 0, 0, Math.PI * 2); x.fill();
  x.fillStyle = '#ffffff'; x.beginPath(); x.arc(46, 14.5, 1.2, 0, Math.PI * 2); x.fill();
  // Teeth
  x.fillStyle = '#ffffff'; x.globalAlpha = 0.75;
  x.beginPath(); x.moveTo(54, 25); x.lineTo(53, 28); x.lineTo(55, 28); x.fill();
  x.beginPath(); x.moveTo(57, 25); x.lineTo(56, 28); x.lineTo(58, 28); x.fill();
  x.beginPath(); x.moveTo(60, 25); x.lineTo(59, 27); x.lineTo(61, 27); x.fill();
  x.globalAlpha = 1;
  x.strokeStyle = darkC; x.lineWidth = 1;
  x.beginPath(); x.moveTo(53, 25); x.lineTo(63, 24); x.stroke();
  return c;
}

function _genWolfFront(bodyC, lightC, darkC, f) {
  // Front-facing wolf (DOWN direction)
  const c = makeCanvas(68, 52);
  const x = c.getContext('2d');
  const cx = 34, legOff = Math.sin(f * Math.PI / 2) * 3;
  draw3DShadow(x, cx, 47, 20, 5);
  // Tail behind (visible poking up)
  x.strokeStyle = bodyC; x.lineWidth = 4; x.lineCap = 'round';
  x.beginPath(); x.moveTo(cx, 16); x.bezierCurveTo(cx - 8, 8, cx - 12, 4, cx - 10, 1); x.stroke();
  // Legs (4 visible from front)
  [-12, -5, 5, 12].forEach((lx, i) => {
    const lo = (i < 2 ? -legOff : legOff) * (i % 2 === 0 ? 1 : -1);
    drawCylinder(x, cx + lx - 2, 32 + lo, 5, 12 - lo * 0.2, bodyC, lightC, darkC);
    x.fillStyle = darkC; x.beginPath(); x.ellipse(cx + lx, 44 + lo * 0.2, 4, 3, 0, 0, Math.PI * 2); x.fill();
  });
  // Body (wider from front)
  const bg = x.createRadialGradient(cx, 20, 3, cx, 28, 18);
  bg.addColorStop(0, lightC); bg.addColorStop(0.5, bodyC); bg.addColorStop(1, darkC);
  x.fillStyle = bg; x.beginPath(); x.ellipse(cx, 28, 18, 12, 0, 0, Math.PI * 2); x.fill();
  // Chest fur
  x.fillStyle = lightC; x.globalAlpha = 0.2;
  x.beginPath(); x.ellipse(cx, 32, 10, 6, 0, 0, Math.PI * 2); x.fill(); x.globalAlpha = 1;
  // Head (facing forward)
  drawSphere(x, cx, 16, 12, bodyC, lightC, darkC);
  // Muzzle (shorter from front)
  x.fillStyle = lightC; x.beginPath(); x.ellipse(cx, 22, 6, 4, 0, 0, Math.PI * 2); x.fill();
  x.fillStyle = '#1a1a1a'; x.beginPath(); x.ellipse(cx, 20, 3, 2, 0, 0, Math.PI * 2); x.fill();
  addSpecular(x, cx - 1, 19, 1, 0.7, 0.5);
  // Ears (both visible)
  x.fillStyle = bodyC;
  x.beginPath(); x.moveTo(cx - 10, 10); x.lineTo(cx - 14, 0); x.lineTo(cx - 6, 8); x.fill();
  x.beginPath(); x.moveTo(cx + 10, 10); x.lineTo(cx + 14, 0); x.lineTo(cx + 6, 8); x.fill();
  x.fillStyle = '#cc8888';
  x.beginPath(); x.moveTo(cx - 9, 10); x.lineTo(cx - 12, 3); x.lineTo(cx - 7, 9); x.fill();
  x.beginPath(); x.moveTo(cx + 9, 10); x.lineTo(cx + 12, 3); x.lineTo(cx + 7, 9); x.fill();
  // Eyes (both)
  [-6, 6].forEach(ox => {
    x.shadowColor = '#ffcc44'; x.shadowBlur = 4;
    const eyeG = x.createRadialGradient(cx + ox, 14, 0.5, cx + ox, 14, 3);
    eyeG.addColorStop(0, '#ffee66'); eyeG.addColorStop(0.5, '#ffaa22'); eyeG.addColorStop(1, '#885500');
    x.fillStyle = eyeG; x.beginPath(); x.ellipse(cx + ox, 14, 3, 3.5, 0, 0, Math.PI * 2); x.fill();
    x.shadowBlur = 0;
    x.fillStyle = '#111'; x.beginPath(); x.ellipse(cx + ox, 14, 1, 2.5, 0, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#fff'; x.beginPath(); x.arc(cx + ox - 1, 13, 1, 0, Math.PI * 2); x.fill();
  });
  // Mouth/fangs
  x.strokeStyle = darkC; x.lineWidth = 1;
  x.beginPath(); x.moveTo(cx - 4, 24); x.lineTo(cx + 4, 24); x.stroke();
  x.fillStyle = '#fff'; x.globalAlpha = 0.8;
  x.beginPath(); x.moveTo(cx - 3, 24); x.lineTo(cx - 2, 27); x.lineTo(cx - 4, 24); x.fill();
  x.beginPath(); x.moveTo(cx + 3, 24); x.lineTo(cx + 2, 27); x.lineTo(cx + 4, 24); x.fill();
  x.globalAlpha = 1;
  return c;
}

function _genWolfBack(bodyC, lightC, darkC, f) {
  // Back-facing wolf (UP direction)
  const c = makeCanvas(68, 52);
  const x = c.getContext('2d');
  const cx = 34, legOff = Math.sin(f * Math.PI / 2) * 3;
  draw3DShadow(x, cx, 47, 20, 5);
  // Legs
  [-12, -5, 5, 12].forEach((lx, i) => {
    const lo = (i < 2 ? -legOff : legOff) * (i % 2 === 0 ? 1 : -1);
    drawCylinder(x, cx + lx - 2, 32 + lo, 5, 12, bodyC, lightC, darkC);
    x.fillStyle = darkC; x.beginPath(); x.ellipse(cx + lx, 44 + lo * 0.2, 4, 3, 0, 0, Math.PI * 2); x.fill();
  });
  // Body
  const bg = x.createRadialGradient(cx, 22, 3, cx, 28, 18);
  bg.addColorStop(0, lightC); bg.addColorStop(0.5, bodyC); bg.addColorStop(1, darkC);
  x.fillStyle = bg; x.beginPath(); x.ellipse(cx, 28, 18, 12, 0, 0, Math.PI * 2); x.fill();
  // Fur tufts on back
  x.strokeStyle = lightC; x.lineWidth = 1.2; x.globalAlpha = 0.5;
  for (let i = 0; i < 6; i++) {
    const fx = cx - 8 + i * 3, fy = 20 + Math.sin(i) * 2;
    x.beginPath(); x.moveTo(fx, fy + 2); x.lineTo(fx, fy - 2); x.stroke();
  }
  x.globalAlpha = 1;
  // Back of head
  drawSphere(x, cx, 16, 12, bodyC, lightC, darkC);
  // Ears from behind
  x.fillStyle = bodyC;
  x.beginPath(); x.moveTo(cx - 10, 10); x.lineTo(cx - 14, 0); x.lineTo(cx - 6, 8); x.fill();
  x.beginPath(); x.moveTo(cx + 10, 10); x.lineTo(cx + 14, 0); x.lineTo(cx + 6, 8); x.fill();
  // Tail (flowing up with animation)
  const tailWave = Math.sin(f * Math.PI / 2) * 5;
  x.strokeStyle = bodyC; x.lineWidth = 5; x.lineCap = 'round';
  x.beginPath(); x.moveTo(cx, 38); x.bezierCurveTo(cx + tailWave, 32, cx + tailWave * 1.5, 26, cx + tailWave * 0.5, 20); x.stroke();
  x.strokeStyle = lightC; x.lineWidth = 2.5;
  x.beginPath(); x.moveTo(cx, 38); x.bezierCurveTo(cx + tailWave, 32, cx + tailWave * 1.5, 26, cx + tailWave * 0.5, 21); x.stroke();
  return c;
}

function _genWolfAtkSide(bodyC, lightC, darkC, f) {
  const c = makeCanvas(68, 52);
  const x = c.getContext('2d');
  const atkPhase = f / 3;
  const cx = 34, lunge = atkPhase * 6;
  draw3DShadow(x, cx + lunge * 0.3, 47, 24, 5);
  // Tail (tense, raised)
  x.strokeStyle = bodyC; x.lineWidth = 6; x.lineCap = 'round';
  x.beginPath(); x.moveTo(10, 24);
  x.bezierCurveTo(6, 14, 4, 8, 8, 4); x.stroke();
  x.strokeStyle = lightC; x.lineWidth = 3;
  x.beginPath(); x.moveTo(10, 24); x.bezierCurveTo(6, 14, 5, 9, 9, 6); x.stroke();
  x.fillStyle = lightC; x.beginPath(); x.arc(8, 4, 3, 0, Math.PI * 2); x.fill();
  // Legs (lunging forward)
  const frontExt = Math.sin(atkPhase * Math.PI) * 5;
  [14, 20].forEach((lx, i) => {
    drawCylinder(x, lx - 1 + lunge * 0.2, 28 - frontExt * 0.3, 8, 8, bodyC, lightC, darkC);
    drawCylinder(x, lx + lunge * 0.2, 34 - frontExt * 0.2, 6, 10, bodyC, lightC, darkC);
    x.fillStyle = darkC; x.beginPath(); x.ellipse(lx + 3 + lunge * 0.2, 44, 5.5, 3.5, 0, 0, Math.PI * 2); x.fill();
  });
  [40, 46].forEach((lx, i) => {
    drawCylinder(x, lx - 1 + lunge * 0.5, 28 + frontExt * 0.3, 8, 8, bodyC, lightC, darkC);
    drawCylinder(x, lx + lunge * 0.5, 34 + frontExt * 0.2, 6, 10, bodyC, lightC, darkC);
    x.fillStyle = darkC; x.beginPath(); x.ellipse(lx + 3 + lunge * 0.5, 44, 5.5, 3.5, 0, 0, Math.PI * 2); x.fill();
  });
  // Body (leaning forward)
  const bg = x.createRadialGradient(cx + lunge * 0.3 - 5, 18, 3, cx + lunge * 0.3, 26, 23);
  bg.addColorStop(0, lightC); bg.addColorStop(0.45, bodyC); bg.addColorStop(1, darkC);
  x.fillStyle = bg; x.beginPath(); x.ellipse(cx + lunge * 0.3, 26, 23, 12, 0, 0, Math.PI * 2); x.fill();
  addRimLight(x, cx + lunge * 0.3, 26, 22, lightC, 0.25);
  // Neck + Head (extended forward)
  const headX = 52 + lunge;
  const ng = x.createLinearGradient(42 + lunge * 0.5, 18, headX, 24);
  ng.addColorStop(0, bodyC); ng.addColorStop(1, lightC);
  x.fillStyle = ng; x.beginPath(); x.ellipse(46 + lunge * 0.5, 22, 8, 6, 0.3, 0, Math.PI * 2); x.fill();
  drawSphere(x, headX, 18, 11, bodyC, lightC, darkC);
  // Open jaws
  const jawOpen = Math.sin(atkPhase * Math.PI) * 6;
  // Upper jaw / muzzle
  const sg = x.createRadialGradient(headX + 6, 18, 1, headX + 6, 20, 7);
  sg.addColorStop(0, lightC); sg.addColorStop(1, darkC);
  x.fillStyle = sg; x.beginPath(); x.ellipse(headX + 6, 20 - jawOpen * 0.3, 7, 4, 0.1, 0, Math.PI * 2); x.fill();
  // Lower jaw
  x.fillStyle = darkC; x.beginPath();
  x.ellipse(headX + 5, 24 + jawOpen * 0.5, 6, 3, 0.1, 0, Math.PI * 2); x.fill();
  // Inside mouth
  if (jawOpen > 1) {
    x.fillStyle = '#880000'; x.beginPath();
    x.ellipse(headX + 5, 22 + jawOpen * 0.1, 5, jawOpen * 0.4, 0, 0, Math.PI * 2); x.fill();
  }
  // Nose
  x.fillStyle = '#1a1a1a'; x.beginPath(); x.ellipse(headX + 10, 19 - jawOpen * 0.3, 3, 2.2, 0, 0, Math.PI * 2); x.fill();
  addSpecular(x, headX + 9, 18 - jawOpen * 0.3, 1.2, 0.8, 0.55);
  // Ears (flattened back in attack)
  x.fillStyle = bodyC;
  x.beginPath(); x.moveTo(headX - 8, 12); x.lineTo(headX - 14, 4); x.lineTo(headX - 6, 10); x.fill();
  x.beginPath(); x.moveTo(headX - 1, 11); x.lineTo(headX - 4, 3); x.lineTo(headX + 2, 9); x.fill();
  x.fillStyle = '#cc8888';
  x.beginPath(); x.moveTo(headX - 8, 11); x.lineTo(headX - 12, 6); x.lineTo(headX - 7, 10); x.fill();
  // Eye (fierce)
  x.shadowColor = '#ff4400'; x.shadowBlur = 6;
  x.fillStyle = '#ff6600'; x.beginPath(); x.ellipse(headX - 5, 16, 3.5, 3.5, 0, 0, Math.PI * 2); x.fill();
  x.shadowBlur = 0;
  x.fillStyle = '#111111'; x.beginPath(); x.ellipse(headX - 4.5, 16, 1.5, 3, 0, 0, Math.PI * 2); x.fill();
  x.fillStyle = '#ffffff'; x.beginPath(); x.arc(headX - 6, 14.5, 1.2, 0, Math.PI * 2); x.fill();
  // Teeth (prominent)
  x.fillStyle = '#ffffff'; x.globalAlpha = 0.9;
  for (let i = 0; i < 4; i++) {
    x.beginPath(); x.moveTo(headX + 1 + i * 3, 20 - jawOpen * 0.2);
    x.lineTo(headX + i * 3, 23 + jawOpen * 0.2); x.lineTo(headX + 2 + i * 3, 23 + jawOpen * 0.2); x.fill();
  }
  // Lower teeth
  for (let i = 0; i < 3; i++) {
    x.beginPath(); x.moveTo(headX + 2 + i * 2.5, 24 + jawOpen * 0.4);
    x.lineTo(headX + 1 + i * 2.5, 22 + jawOpen * 0.2); x.lineTo(headX + 3 + i * 2.5, 22 + jawOpen * 0.2); x.fill();
  }
  x.globalAlpha = 1;
  return c;
}

function _genWolfAtkFront(bodyC, lightC, darkC, f) {
  const c = makeCanvas(68, 52);
  const x = c.getContext('2d');
  const atkPhase = f / 3;
  const cx = 34, lunge = atkPhase * 3;
  draw3DShadow(x, cx, 47 + lunge * 0.3, 20, 5);
  // Tail (raised tense)
  x.strokeStyle = bodyC; x.lineWidth = 4; x.lineCap = 'round';
  x.beginPath(); x.moveTo(cx, 16); x.bezierCurveTo(cx - 8, 6, cx - 12, 2, cx - 10, -1); x.stroke();
  // Legs (crouched, ready to pounce)
  const legSpread = Math.sin(atkPhase * Math.PI) * 2;
  [-14, -6, 6, 14].forEach((lx, i) => {
    const lo = (i < 2 ? 1 : -1) * legSpread;
    drawCylinder(x, cx + lx - 2, 32 + lunge + lo, 5, 12, bodyC, lightC, darkC);
    x.fillStyle = darkC; x.beginPath(); x.ellipse(cx + lx, 44 + lunge * 0.5, 4, 3, 0, 0, Math.PI * 2); x.fill();
  });
  // Body (surging forward/down)
  const bg = x.createRadialGradient(cx, 20, 3, cx, 28 + lunge, 18);
  bg.addColorStop(0, lightC); bg.addColorStop(0.5, bodyC); bg.addColorStop(1, darkC);
  x.fillStyle = bg; x.beginPath(); x.ellipse(cx, 28 + lunge * 0.5, 18, 12, 0, 0, Math.PI * 2); x.fill();
  // Head (lowered, jaws open)
  drawSphere(x, cx, 14 + lunge, 12, bodyC, lightC, darkC);
  // Open jaws
  const jawOpen = Math.sin(atkPhase * Math.PI) * 5;
  // Upper muzzle
  x.fillStyle = lightC; x.beginPath(); x.ellipse(cx, 20 + lunge - jawOpen * 0.2, 6, 3.5, 0, 0, Math.PI * 2); x.fill();
  // Lower jaw
  x.fillStyle = darkC; x.beginPath(); x.ellipse(cx, 22 + lunge + jawOpen * 0.4, 5, 3, 0, 0, Math.PI * 2); x.fill();
  // Mouth interior
  if (jawOpen > 1) {
    x.fillStyle = '#880000'; x.beginPath();
    x.ellipse(cx, 21 + lunge + jawOpen * 0.1, 4, jawOpen * 0.35, 0, 0, Math.PI * 2); x.fill();
  }
  x.fillStyle = '#1a1a1a'; x.beginPath(); x.ellipse(cx, 19 + lunge - jawOpen * 0.2, 3, 2, 0, 0, Math.PI * 2); x.fill();
  addSpecular(x, cx - 1, 18 + lunge - jawOpen * 0.2, 1, 0.7, 0.5);
  // Ears (flattened)
  x.fillStyle = bodyC;
  x.beginPath(); x.moveTo(cx - 10, 8 + lunge); x.lineTo(cx - 16, -1 + lunge); x.lineTo(cx - 6, 6 + lunge); x.fill();
  x.beginPath(); x.moveTo(cx + 10, 8 + lunge); x.lineTo(cx + 16, -1 + lunge); x.lineTo(cx + 6, 6 + lunge); x.fill();
  x.fillStyle = '#cc8888';
  x.beginPath(); x.moveTo(cx - 9, 8 + lunge); x.lineTo(cx - 14, 2 + lunge); x.lineTo(cx - 7, 7 + lunge); x.fill();
  x.beginPath(); x.moveTo(cx + 9, 8 + lunge); x.lineTo(cx + 14, 2 + lunge); x.lineTo(cx + 7, 7 + lunge); x.fill();
  // Eyes (fierce, glowing red tint)
  [-6, 6].forEach(ox => {
    x.shadowColor = '#ff4400'; x.shadowBlur = 5;
    const eyeG = x.createRadialGradient(cx + ox, 12 + lunge, 0.5, cx + ox, 12 + lunge, 3);
    eyeG.addColorStop(0, '#ff6644'); eyeG.addColorStop(0.5, '#ff4400'); eyeG.addColorStop(1, '#882200');
    x.fillStyle = eyeG; x.beginPath(); x.ellipse(cx + ox, 12 + lunge, 3, 3, 0, 0, Math.PI * 2); x.fill();
    x.shadowBlur = 0;
    x.fillStyle = '#111'; x.beginPath(); x.ellipse(cx + ox, 12 + lunge, 1, 2.5, 0, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#fff'; x.beginPath(); x.arc(cx + ox - 1, 11 + lunge, 1, 0, Math.PI * 2); x.fill();
  });
  // Teeth/fangs (prominent)
  x.fillStyle = '#fff'; x.globalAlpha = 0.9;
  x.beginPath(); x.moveTo(cx - 4, 22 + lunge - jawOpen * 0.1); x.lineTo(cx - 3, 26 + lunge + jawOpen * 0.2); x.lineTo(cx - 5, 22 + lunge); x.fill();
  x.beginPath(); x.moveTo(cx + 4, 22 + lunge - jawOpen * 0.1); x.lineTo(cx + 3, 26 + lunge + jawOpen * 0.2); x.lineTo(cx + 5, 22 + lunge); x.fill();
  for (let i = -2; i <= 2; i++) {
    x.beginPath(); x.moveTo(cx + i * 2, 22 + lunge); x.lineTo(cx + i * 2, 24 + lunge + jawOpen * 0.15); x.stroke();
  }
  x.globalAlpha = 1;
  return c;
}

function _genWolfAtkBack(bodyC, lightC, darkC, f) {
  const c = makeCanvas(68, 52);
  const x = c.getContext('2d');
  const atkPhase = f / 3;
  const cx = 34, lunge = atkPhase * -3;
  draw3DShadow(x, cx, 47, 20, 5);
  // Legs (tense)
  const legSpread = Math.sin(atkPhase * Math.PI) * 2;
  [-12, -5, 5, 12].forEach((lx, i) => {
    const lo = (i < 2 ? -1 : 1) * legSpread;
    drawCylinder(x, cx + lx - 2, 32 + lo, 5, 12, bodyC, lightC, darkC);
    x.fillStyle = darkC; x.beginPath(); x.ellipse(cx + lx, 44, 4, 3, 0, 0, Math.PI * 2); x.fill();
  });
  // Body
  const bg = x.createRadialGradient(cx, 22, 3, cx, 28 + lunge * 0.3, 18);
  bg.addColorStop(0, lightC); bg.addColorStop(0.5, bodyC); bg.addColorStop(1, darkC);
  x.fillStyle = bg; x.beginPath(); x.ellipse(cx, 28 + lunge * 0.3, 18, 12, 0, 0, Math.PI * 2); x.fill();
  // Fur bristling (attack tension)
  x.strokeStyle = lightC; x.lineWidth = 1.5; x.globalAlpha = 0.6;
  for (let i = 0; i < 8; i++) {
    const fx = cx - 10 + i * 3, fy = 20 + Math.sin(i) * 2 + lunge * 0.3;
    x.beginPath(); x.moveTo(fx, fy + 2); x.lineTo(fx + (i % 2 ? 1 : -1), fy - 4); x.stroke();
  }
  x.globalAlpha = 1;
  // Back of head (lunging up)
  drawSphere(x, cx, 14 + lunge, 12, bodyC, lightC, darkC);
  // Ears flattened back
  x.fillStyle = bodyC;
  x.beginPath(); x.moveTo(cx - 10, 8 + lunge); x.lineTo(cx - 16, -1 + lunge); x.lineTo(cx - 6, 6 + lunge); x.fill();
  x.beginPath(); x.moveTo(cx + 10, 8 + lunge); x.lineTo(cx + 16, -1 + lunge); x.lineTo(cx + 6, 6 + lunge); x.fill();
  // Tail (raised aggressively)
  const tailWave = Math.sin(atkPhase * Math.PI) * 3;
  x.strokeStyle = bodyC; x.lineWidth = 5; x.lineCap = 'round';
  x.beginPath(); x.moveTo(cx, 38); x.bezierCurveTo(cx + tailWave, 28, cx + tailWave * 2, 18, cx + tailWave, 12); x.stroke();
  x.strokeStyle = lightC; x.lineWidth = 2.5;
  x.beginPath(); x.moveTo(cx, 38); x.bezierCurveTo(cx + tailWave, 28, cx + tailWave * 2, 18, cx + tailWave, 13); x.stroke();
  return c;
}

function _genWolfDiagFront(bodyC, lightC, darkC, f) {
  // 3/4 front-right wolf (down_right direction)
  const c = makeCanvas(68, 52);
  const x = c.getContext('2d');
  const cx = 34, legOff = Math.sin(f * Math.PI / 2) * 3.5;
  draw3DShadow(x, cx, 47, 22, 5);
  // Tail behind (angled)
  x.strokeStyle = bodyC; x.lineWidth = 5; x.lineCap = 'round';
  x.beginPath(); x.moveTo(cx - 6, 18);
  x.bezierCurveTo(cx - 14, 10, cx - 18, 6, cx - 16, 2); x.stroke();
  // Legs (3/4 view - 3 visible)
  [-10, -3, 8].forEach((lx, i) => {
    const lo = (i < 2 ? -legOff : legOff) * (i % 2 === 0 ? 1 : -1);
    drawCylinder(x, cx + lx - 2, 32 + lo, 6, 12 - lo * 0.2, bodyC, lightC, darkC);
    x.fillStyle = darkC; x.beginPath(); x.ellipse(cx + lx + 1, 44 + lo * 0.2, 4.5, 3, 0, 0, Math.PI * 2); x.fill();
  });
  // Body (angled)
  const bg = x.createRadialGradient(cx + 2, 20, 3, cx + 2, 28, 20);
  bg.addColorStop(0, lightC); bg.addColorStop(0.5, bodyC); bg.addColorStop(1, darkC);
  x.fillStyle = bg; x.beginPath(); x.ellipse(cx + 2, 28, 20, 12, 0.15, 0, Math.PI * 2); x.fill();
  x.fillStyle = lightC; x.globalAlpha = 0.18;
  x.beginPath(); x.ellipse(cx + 4, 31, 12, 5, 0, 0, Math.PI * 2); x.fill(); x.globalAlpha = 1;
  // Head (3/4 facing)
  drawSphere(x, cx + 8, 16, 11.5, bodyC, lightC, darkC);
  // Muzzle (3/4 - between front and side)
  const sg = x.createRadialGradient(cx + 14, 20, 1, cx + 14, 22, 6);
  sg.addColorStop(0, lightC); sg.addColorStop(1, darkC);
  x.fillStyle = sg; x.beginPath(); x.ellipse(cx + 14, 22, 6.5, 4.5, 0.15, 0, Math.PI * 2); x.fill();
  x.fillStyle = '#1a1a1a'; x.beginPath(); x.ellipse(cx + 17, 20.5, 2.8, 2, 0, 0, Math.PI * 2); x.fill();
  addSpecular(x, cx + 16, 19.5, 1, 0.7, 0.5);
  // Ears (both visible, right more prominent)
  x.fillStyle = bodyC;
  x.beginPath(); x.moveTo(cx + 1, 10); x.lineTo(cx - 3, 0); x.lineTo(cx + 5, 8); x.fill();
  x.beginPath(); x.moveTo(cx + 13, 9); x.lineTo(cx + 16, -1); x.lineTo(cx + 10, 7); x.fill();
  x.fillStyle = '#cc8888';
  x.beginPath(); x.moveTo(cx + 2, 10); x.lineTo(cx - 1, 3); x.lineTo(cx + 4, 9); x.fill();
  x.beginPath(); x.moveTo(cx + 12, 9); x.lineTo(cx + 14, 2); x.lineTo(cx + 11, 8); x.fill();
  // Eyes (right eye full, left eye partial)
  x.shadowColor = '#ffcc44'; x.shadowBlur = 4;
  const eyeG1 = x.createRadialGradient(cx + 12, 14, 0.5, cx + 12, 14, 3.5);
  eyeG1.addColorStop(0, '#ffee66'); eyeG1.addColorStop(0.5, '#ffaa22'); eyeG1.addColorStop(1, '#885500');
  x.fillStyle = eyeG1; x.beginPath(); x.ellipse(cx + 12, 14, 3.5, 3.5, 0, 0, Math.PI * 2); x.fill();
  x.shadowBlur = 0;
  x.fillStyle = '#111'; x.beginPath(); x.ellipse(cx + 12.5, 14, 1.2, 2.8, 0, 0, Math.PI * 2); x.fill();
  x.fillStyle = '#fff'; x.beginPath(); x.arc(cx + 11, 13, 1, 0, Math.PI * 2); x.fill();
  // Left eye (smaller, 3/4 view)
  x.shadowColor = '#ffcc44'; x.shadowBlur = 3;
  const eyeG2 = x.createRadialGradient(cx + 3, 14.5, 0.3, cx + 3, 14.5, 2.5);
  eyeG2.addColorStop(0, '#ffee66'); eyeG2.addColorStop(0.5, '#ffaa22'); eyeG2.addColorStop(1, '#885500');
  x.fillStyle = eyeG2; x.beginPath(); x.ellipse(cx + 3, 14.5, 2.5, 3, 0, 0, Math.PI * 2); x.fill();
  x.shadowBlur = 0;
  x.fillStyle = '#111'; x.beginPath(); x.ellipse(cx + 3, 14.5, 0.8, 2.2, 0, 0, Math.PI * 2); x.fill();
  // Teeth
  x.fillStyle = '#fff'; x.globalAlpha = 0.75;
  x.beginPath(); x.moveTo(cx + 11, 24); x.lineTo(cx + 10, 27); x.lineTo(cx + 12, 27); x.fill();
  x.beginPath(); x.moveTo(cx + 15, 24); x.lineTo(cx + 14, 27); x.lineTo(cx + 16, 27); x.fill();
  x.globalAlpha = 1;
  x.strokeStyle = darkC; x.lineWidth = 1;
  x.beginPath(); x.moveTo(cx + 10, 24); x.lineTo(cx + 19, 23); x.stroke();
  return c;
}

function _genWolfDiagBack(bodyC, lightC, darkC, f) {
  // 3/4 back-right wolf (up_right direction)
  const c = makeCanvas(68, 52);
  const x = c.getContext('2d');
  const cx = 34, legOff = Math.sin(f * Math.PI / 2) * 3;
  draw3DShadow(x, cx, 47, 20, 5);
  // Legs (3/4 back)
  [-10, -3, 8].forEach((lx, i) => {
    const lo = (i < 2 ? -legOff : legOff) * (i % 2 === 0 ? 1 : -1);
    drawCylinder(x, cx + lx - 2, 32 + lo, 5, 12, bodyC, lightC, darkC);
    x.fillStyle = darkC; x.beginPath(); x.ellipse(cx + lx, 44 + lo * 0.2, 4, 3, 0, 0, Math.PI * 2); x.fill();
  });
  // Body
  const bg = x.createRadialGradient(cx + 2, 22, 3, cx + 2, 28, 18);
  bg.addColorStop(0, lightC); bg.addColorStop(0.5, bodyC); bg.addColorStop(1, darkC);
  x.fillStyle = bg; x.beginPath(); x.ellipse(cx + 2, 28, 19, 12, 0.1, 0, Math.PI * 2); x.fill();
  // Fur tufts on back
  x.strokeStyle = lightC; x.lineWidth = 1.2; x.globalAlpha = 0.5;
  for (let i = 0; i < 5; i++) {
    const fx = cx - 4 + i * 4, fy = 20 + Math.sin(i) * 2;
    x.beginPath(); x.moveTo(fx, fy + 2); x.lineTo(fx, fy - 2); x.stroke();
  }
  x.globalAlpha = 1;
  // Back of head (angled right)
  drawSphere(x, cx + 6, 16, 11.5, bodyC, lightC, darkC);
  // Ears from 3/4 behind
  x.fillStyle = bodyC;
  x.beginPath(); x.moveTo(cx - 1, 10); x.lineTo(cx - 5, 0); x.lineTo(cx + 3, 8); x.fill();
  x.beginPath(); x.moveTo(cx + 13, 9); x.lineTo(cx + 16, -1); x.lineTo(cx + 10, 7); x.fill();
  // Tail (flowing with animation)
  const tailWave = Math.sin(f * Math.PI / 2) * 5;
  x.strokeStyle = bodyC; x.lineWidth = 5; x.lineCap = 'round';
  x.beginPath(); x.moveTo(cx - 6, 36); x.bezierCurveTo(cx - 8 + tailWave, 28, cx - 10 + tailWave * 1.5, 22, cx - 8 + tailWave * 0.5, 16); x.stroke();
  x.strokeStyle = lightC; x.lineWidth = 2.5;
  x.beginPath(); x.moveTo(cx - 6, 36); x.bezierCurveTo(cx - 8 + tailWave, 28, cx - 10 + tailWave * 1.5, 22, cx - 8 + tailWave * 0.5, 17); x.stroke();
  // Slight ear/cheek visible from right
  x.fillStyle = bodyC; x.globalAlpha = 0.4;
  x.beginPath(); x.arc(cx + 14, 18, 4, 0, Math.PI * 2); x.fill();
  x.globalAlpha = 1;
  return c;
}

function _genWolfAtkDiagFront(bodyC, lightC, darkC, f) {
  // 3/4 front-right attack wolf
  const c = makeCanvas(68, 52);
  const x = c.getContext('2d');
  const atkPhase = f / 3;
  const cx = 34, lunge = atkPhase * 4.5;
  draw3DShadow(x, cx + lunge * 0.3, 47, 22, 5);
  // Tail (tense)
  x.strokeStyle = bodyC; x.lineWidth = 5; x.lineCap = 'round';
  x.beginPath(); x.moveTo(cx - 6 - lunge * 0.2, 18);
  x.bezierCurveTo(cx - 14, 8, cx - 16, 4, cx - 14, 1); x.stroke();
  // Legs (lunging at angle)
  const frontExt = Math.sin(atkPhase * Math.PI) * 4;
  [-10, -3, 8].forEach((lx, i) => {
    const lo = (i < 2 ? -1 : 1) * frontExt * 0.5;
    drawCylinder(x, cx + lx - 2 + lunge * (i > 1 ? 0.5 : 0.2), 32 + lo, 6, 12, bodyC, lightC, darkC);
    x.fillStyle = darkC; x.beginPath(); x.ellipse(cx + lx + lunge * (i > 1 ? 0.5 : 0.2), 44, 4.5, 3, 0, 0, Math.PI * 2); x.fill();
  });
  // Body
  const bg = x.createRadialGradient(cx + 2 + lunge * 0.3, 20, 3, cx + 2 + lunge * 0.3, 28, 20);
  bg.addColorStop(0, lightC); bg.addColorStop(0.45, bodyC); bg.addColorStop(1, darkC);
  x.fillStyle = bg; x.beginPath(); x.ellipse(cx + 2 + lunge * 0.3, 28, 20, 12, 0.15, 0, Math.PI * 2); x.fill();
  addRimLight(x, cx + 2 + lunge * 0.3, 28, 19, lightC, 0.25);
  // Head (extended forward-right)
  const headX = cx + 8 + lunge;
  drawSphere(x, headX, 14 + lunge * 0.3, 11.5, bodyC, lightC, darkC);
  // Open jaws
  const jawOpen = Math.sin(atkPhase * Math.PI) * 5.5;
  x.fillStyle = lightC; x.beginPath(); x.ellipse(headX + 6, 19 + lunge * 0.3 - jawOpen * 0.25, 6, 3.5, 0.1, 0, Math.PI * 2); x.fill();
  x.fillStyle = darkC; x.beginPath(); x.ellipse(headX + 5, 23 + lunge * 0.3 + jawOpen * 0.4, 5.5, 3, 0.1, 0, Math.PI * 2); x.fill();
  if (jawOpen > 1) {
    x.fillStyle = '#880000'; x.beginPath();
    x.ellipse(headX + 5, 21 + lunge * 0.3 + jawOpen * 0.1, 4.5, jawOpen * 0.35, 0, 0, Math.PI * 2); x.fill();
  }
  x.fillStyle = '#1a1a1a'; x.beginPath(); x.ellipse(headX + 10, 18 + lunge * 0.3 - jawOpen * 0.25, 2.8, 2, 0, 0, Math.PI * 2); x.fill();
  // Ears flattened
  x.fillStyle = bodyC;
  x.beginPath(); x.moveTo(headX - 7, 8 + lunge * 0.2); x.lineTo(headX - 12, 0); x.lineTo(headX - 4, 7 + lunge * 0.2); x.fill();
  x.beginPath(); x.moveTo(headX + 4, 7 + lunge * 0.2); x.lineTo(headX + 7, -1); x.lineTo(headX + 1, 6 + lunge * 0.2); x.fill();
  // Eyes (fierce)
  x.shadowColor = '#ff4400'; x.shadowBlur = 5;
  x.fillStyle = '#ff6600'; x.beginPath(); x.ellipse(headX + 3, 12 + lunge * 0.3, 3.5, 3.5, 0, 0, Math.PI * 2); x.fill();
  x.shadowBlur = 0;
  x.fillStyle = '#111'; x.beginPath(); x.ellipse(headX + 3.5, 12 + lunge * 0.3, 1.5, 3, 0, 0, Math.PI * 2); x.fill();
  x.fillStyle = '#fff'; x.beginPath(); x.arc(headX + 2, 11 + lunge * 0.3, 1.2, 0, Math.PI * 2); x.fill();
  // Left eye (smaller)
  x.shadowColor = '#ff4400'; x.shadowBlur = 3;
  x.fillStyle = '#ff6600'; x.beginPath(); x.ellipse(headX - 5, 12.5 + lunge * 0.3, 2.5, 2.5, 0, 0, Math.PI * 2); x.fill();
  x.shadowBlur = 0;
  x.fillStyle = '#111'; x.beginPath(); x.ellipse(headX - 4.5, 12.5 + lunge * 0.3, 1, 2, 0, 0, Math.PI * 2); x.fill();
  // Teeth
  x.fillStyle = '#fff'; x.globalAlpha = 0.9;
  for (let i = 0; i < 3; i++) {
    x.beginPath(); x.moveTo(headX + 2 + i * 3, 19 + lunge * 0.3 - jawOpen * 0.15);
    x.lineTo(headX + 1 + i * 3, 22 + lunge * 0.3 + jawOpen * 0.2); x.lineTo(headX + 3 + i * 3, 22 + lunge * 0.3 + jawOpen * 0.2); x.fill();
  }
  x.globalAlpha = 1;
  return c;
}

function _genWolfAtkDiagBack(bodyC, lightC, darkC, f) {
  // 3/4 back-right attack wolf
  const c = makeCanvas(68, 52);
  const x = c.getContext('2d');
  const atkPhase = f / 3;
  const cx = 34, lunge = atkPhase * -2;
  draw3DShadow(x, cx, 47, 20, 5);
  const legSpread = Math.sin(atkPhase * Math.PI) * 2;
  [-10, -3, 8].forEach((lx, i) => {
    const lo = (i < 2 ? -1 : 1) * legSpread;
    drawCylinder(x, cx + lx - 2, 32 + lo, 5, 12, bodyC, lightC, darkC);
    x.fillStyle = darkC; x.beginPath(); x.ellipse(cx + lx, 44, 4, 3, 0, 0, Math.PI * 2); x.fill();
  });
  const bg = x.createRadialGradient(cx + 2, 22, 3, cx + 2, 28 + lunge * 0.3, 18);
  bg.addColorStop(0, lightC); bg.addColorStop(0.5, bodyC); bg.addColorStop(1, darkC);
  x.fillStyle = bg; x.beginPath(); x.ellipse(cx + 2, 28 + lunge * 0.3, 19, 12, 0.1, 0, Math.PI * 2); x.fill();
  // Fur bristling
  x.strokeStyle = lightC; x.lineWidth = 1.5; x.globalAlpha = 0.6;
  for (let i = 0; i < 6; i++) {
    const fx = cx - 4 + i * 4, fy = 20 + Math.sin(i) * 2 + lunge * 0.3;
    x.beginPath(); x.moveTo(fx, fy + 2); x.lineTo(fx + (i % 2 ? 1 : -1), fy - 4); x.stroke();
  }
  x.globalAlpha = 1;
  drawSphere(x, cx + 6, 14 + lunge, 11.5, bodyC, lightC, darkC);
  x.fillStyle = bodyC;
  x.beginPath(); x.moveTo(cx - 1, 8 + lunge); x.lineTo(cx - 5, -1 + lunge); x.lineTo(cx + 3, 6 + lunge); x.fill();
  x.beginPath(); x.moveTo(cx + 13, 7 + lunge); x.lineTo(cx + 16, -2 + lunge); x.lineTo(cx + 10, 5 + lunge); x.fill();
  // Tail raised
  const tailWave = Math.sin(atkPhase * Math.PI) * 3;
  x.strokeStyle = bodyC; x.lineWidth = 5; x.lineCap = 'round';
  x.beginPath(); x.moveTo(cx - 6, 36); x.bezierCurveTo(cx - 8 + tailWave, 26, cx - 10 + tailWave * 2, 16, cx - 8 + tailWave, 10); x.stroke();
  x.strokeStyle = lightC; x.lineWidth = 2.5;
  x.beginPath(); x.moveTo(cx - 6, 36); x.bezierCurveTo(cx - 8 + tailWave, 26, cx - 10 + tailWave * 2, 16, cx - 8 + tailWave, 11); x.stroke();
  return c;
}

function genWolf(key, bodyC, lightC, darkC) {
  const down = [], down_right = [], up = [], up_right = [], right = [];
  for (let f = 0; f < 4; f++) {
    right.push(_genWolfSide(bodyC, lightC, darkC, f));
    down.push(_genWolfFront(bodyC, lightC, darkC, f));
    up.push(_genWolfBack(bodyC, lightC, darkC, f));
    down_right.push(_genWolfDiagFront(bodyC, lightC, darkC, f));
    up_right.push(_genWolfDiagBack(bodyC, lightC, darkC, f));
  }
  // Attack frames
  const atkDown = [], atkDown_right = [], atkUp = [], atkUp_right = [], atkRight = [];
  for (let f = 0; f < 4; f++) {
    atkRight.push(_genWolfAtkSide(bodyC, lightC, darkC, f));
    atkDown.push(_genWolfAtkFront(bodyC, lightC, darkC, f));
    atkUp.push(_genWolfAtkBack(bodyC, lightC, darkC, f));
    atkDown_right.push(_genWolfAtkDiagFront(bodyC, lightC, darkC, f));
    atkUp_right.push(_genWolfAtkDiagBack(bodyC, lightC, darkC, f));
  }
  setDirCache8(key, {
    down, down_right, right, up_right, up,
    atk_down: atkDown, atk_down_right: atkDown_right, atk_right: atkRight,
    atk_up_right: atkUp_right, atk_up: atkUp
  });
}

// ============================================================
//  HUMANOID SPRITE (3D shaded with armor/cloth materials)
// ============================================================
function genHumanoid(key, opts) {
  const dirs = { down: [], down_right: [], up: [], up_right: [], right: [] };
  const {
    skinC = '#d4a07a', skinD = '#b08050', skinL = '#e8c8a0',
    hairC = '#553322', armorC = '#888888', armorD = '#555555', armorL = '#aaaaaa',
    capeC = null, weaponType = 'none', weaponC = '#aaaaaa',
    eyeC = '#333333', height = 64, width = 48,
    hatType = 'none', hatC = '#444444',
    special = null, auraC = null, glow = null
  } = opts;

  for (const dir of ['down', 'down_right', 'right', 'up_right', 'up']) {
    for (let f = 0; f < 4; f++) {
      const c = makeCanvas(width, height);
      const x = c.getContext('2d');
      const cx = width / 2, bob = Math.sin(f * Math.PI / 2) * 1.5;
      const legPhase = Math.sin(f * Math.PI / 2) * 2.5;
      const armSwing = Math.sin(f * Math.PI / 2) * 3;

      draw3DShadow(x, cx, height - 4, 14, 4);

      // Aura
      if (auraC) {
        x.fillStyle = auraC;
        x.beginPath(); x.ellipse(cx, height * 0.5, width * 0.48, height * 0.46, 0, 0, Math.PI * 2); x.fill();
      }

      // Cape (behind body for all, wider for up)
      if (capeC) {
        if (dir === 'up') {
          drawCape(x, cx, height * 0.33 + bob, 22, height * 0.52, capeC, f);
        } else if (dir === 'right') {
          drawCape(x, cx - 4, height * 0.35 + bob, 16, height * 0.48, capeC, f);
        } else if (dir === 'up_right') {
          drawCape(x, cx - 2, height * 0.34 + bob, 20, height * 0.50, capeC, f);
        } else if (dir === 'down_right') {
          drawCape(x, cx - 2, height * 0.35 + bob, 18, height * 0.48, capeC, f);
        } else {
          drawCape(x, cx, height * 0.35 + bob, 20, height * 0.48, capeC, f);
        }
      }

      // Legs with 3D shading (same for all)
      drawCylinder(x, cx - 6, height * 0.63 + bob, 5, 12 + legPhase * 0.5, armorC, armorL, armorD);
      drawCylinder(x, cx + 1, height * 0.63 + bob, 5, 12 - legPhase * 0.5, armorC, armorL, armorD);
      // Boots
      x.fillStyle = '#3a2820';
      x.beginPath(); x.roundRect(cx - 7, height * 0.82 + bob + legPhase * 0.3, 7, 5, 2); x.fill();
      x.beginPath(); x.roundRect(cx, height * 0.82 + bob - legPhase * 0.3, 7, 5, 2); x.fill();
      x.fillStyle = 'rgba(255,255,255,0.08)';
      x.fillRect(cx - 6, height * 0.82 + bob + legPhase * 0.3, 5, 2);
      x.fillRect(cx + 1, height * 0.82 + bob - legPhase * 0.3, 5, 2);

      // Body/Armor (same for all)
      drawMetalPlate(x, cx - 10, height * 0.34 + bob, 20, height * 0.32, armorC, armorL, armorD);
      drawHumanoidRegalia(x, cx, height * 0.34 + bob, 20, height * 0.32, {
        armorC, armorL, armorD, clothC: capeC || colorShift(armorD, -18), gemC: eyeC || '#ffd36a'
      }, dir);
      if (dir !== 'up' && dir !== 'up_right') {
        x.strokeStyle = armorD; x.lineWidth = 0.8;
        x.beginPath(); x.moveTo(cx, height * 0.36 + bob); x.lineTo(cx, height * 0.64 + bob); x.stroke();
      }
      // Belt
      x.fillStyle = '#5a4030';
      x.fillRect(cx - 10, height * 0.6 + bob, 20, 3);
      if (dir !== 'up' && dir !== 'up_right') {
        x.fillStyle = '#ffd700';
        x.fillRect(cx - 2, height * 0.6 + bob, 4, 3);
      }

      // Arms (same for all)
      drawCylinder(x, cx - 14, height * 0.37 + bob + armSwing, 5, 15, armorC, armorL, armorD);
      drawCylinder(x, cx + 9, height * 0.37 + bob - armSwing, 5, 15, armorC, armorL, armorD);
      drawSphere(x, cx - 11.5, height * 0.57 + bob + armSwing, 3, skinC, skinL, skinD);
      drawSphere(x, cx + 11.5, height * 0.57 + bob - armSwing, 3, skinC, skinL, skinD);

      // Weapon (visible for down/right/diag-down, on back for up/diag-up)
      if (dir === 'down' || dir === 'right' || dir === 'down_right') {
        if (weaponType === 'sword') {
          drawSwordBlade(x, cx + 11, height * 0.25 + bob - armSwing, 24, 4, '#cccccc');
          x.fillStyle = '#ffd700';
          x.fillRect(cx + 9.5, height * 0.5 + bob - armSwing, 8, 3);
          x.fillStyle = '#5a3a1a';
          x.fillRect(cx + 12, height * 0.53 + bob - armSwing, 3, 5);
        } else if (weaponType === 'staff') {
          x.fillStyle = '#5a3a18';
          x.fillRect(cx + 12, height * 0.15 + bob, 2.5, 34);
          drawSphere(x, cx + 13.25, height * 0.12 + bob, 6, weaponC, colorShift(weaponC, 40), colorShift(weaponC, -40));
          x.fillStyle = weaponC; x.globalAlpha = 0.18;
          x.beginPath(); x.arc(cx + 13.25, height * 0.12 + bob, 10, 0, Math.PI * 2); x.fill();
          x.globalAlpha = 1;
        } else if (weaponType === 'dagger') {
          x.fillStyle = '#cccccc';
          x.fillRect(cx - 15, height * 0.44 + bob + armSwing, 2, 12);
          x.fillRect(cx + 13, height * 0.44 + bob - armSwing, 2, 12);
          x.fillStyle = 'rgba(255,255,255,0.3)';
          x.fillRect(cx - 15, height * 0.44 + bob + armSwing, 0.8, 12);
          x.fillRect(cx + 13, height * 0.44 + bob - armSwing, 0.8, 12);
        } else if (weaponType === 'spear') {
          x.fillStyle = '#6a4a2a';
          x.fillRect(cx + 12, height * 0.08 + bob, 2.5, 40);
          x.fillStyle = '#cccccc';
          x.beginPath(); x.moveTo(cx + 13.25, height * 0.03 + bob);
          x.lineTo(cx + 10, height * 0.12 + bob); x.lineTo(cx + 16.5, height * 0.12 + bob); x.fill();
          x.fillStyle = 'rgba(255,255,255,0.25)';
          x.beginPath(); x.moveTo(cx + 13.25, height * 0.03 + bob);
          x.lineTo(cx + 11, height * 0.11 + bob); x.lineTo(cx + 13, height * 0.12 + bob); x.fill();
        }
      } else {
        // UP: weapon on back
        if (weaponType === 'sword') {
          x.fillStyle = '#5a3a1a';
          x.save(); x.translate(cx + 4, height * 0.2 + bob); x.rotate(0.3);
          x.fillRect(-1.5, 0, 3, 24); x.restore();
          x.fillStyle = '#cccccc';
          x.save(); x.translate(cx + 4, height * 0.2 + bob); x.rotate(0.3);
          x.fillRect(-1, -10, 2, 12); x.restore();
        } else if (weaponType === 'staff') {
          x.fillStyle = '#5a3a18';
          x.fillRect(cx + 8, height * 0.15 + bob, 2.5, 34);
          drawSphere(x, cx + 9.25, height * 0.12 + bob, 5, weaponC, colorShift(weaponC, 40), colorShift(weaponC, -40));
        } else if (weaponType === 'spear') {
          x.fillStyle = '#6a4a2a';
          x.fillRect(cx + 8, height * 0.08 + bob, 2.5, 40);
          x.fillStyle = '#cccccc';
          x.beginPath(); x.moveTo(cx + 9.25, height * 0.03 + bob);
          x.lineTo(cx + 6.5, height * 0.1 + bob); x.lineTo(cx + 12, height * 0.1 + bob); x.fill();
        }
      }

      // Head
      drawSphere(x, cx, height * 0.25 + bob, 9, skinC, skinL, skinD);

      // --- Direction-specific head/face ---
      if (dir === 'down' || dir === 'down_right') {
        // Hair/Hat (front / 3/4 front view)
        if (hatType === 'none') {
          x.fillStyle = hairC;
          x.beginPath(); x.arc(cx, height * 0.21 + bob, 9.5, Math.PI, 0); x.fill();
          x.fillRect(cx - 9, height * 0.21 + bob, 3, 7);
        } else if (hatType === 'wizard') {
          const hg = x.createLinearGradient(cx, height * 0.02 + bob, cx, height * 0.23 + bob);
          hg.addColorStop(0, colorShift(hatC, 20)); hg.addColorStop(1, hatC);
          x.fillStyle = hg;
          x.beginPath();
          x.moveTo(cx + 2, height * 0.02 + bob);
          x.lineTo(cx - 12, height * 0.2 + bob);
          x.lineTo(cx + 12, height * 0.2 + bob);
          x.fill();
          x.fillStyle = colorShift(hatC, -20);
          x.fillRect(cx - 13, height * 0.19 + bob, 26, 5);
          x.fillStyle = '#ffd700';
          x.fillRect(cx - 12, height * 0.19 + bob, 24, 2.5);
        } else if (hatType === 'hood') {
          x.fillStyle = hatC;
          x.beginPath();
          x.arc(cx, height * 0.23 + bob, 11, Math.PI, 0);
          x.lineTo(cx + 11, height * 0.33 + bob);
          x.lineTo(cx - 11, height * 0.33 + bob);
          x.fill();
        } else if (hatType === 'helm') {
          drawMetalPlate(x, cx - 10, height * 0.14 + bob, 20, 14, hatC, colorShift(hatC, 30), colorShift(hatC, -30));
          x.fillStyle = '#222222';
          x.fillRect(cx - 6, height * 0.24 + bob, 12, 2);
        } else if (hatType === 'crown') {
          x.fillStyle = '#ffd700';
          x.fillRect(cx - 8, height * 0.13 + bob, 16, 7);
          for (let i = -2; i <= 2; i++) {
            x.fillRect(cx + i * 3.5 - 1, height * 0.1 + bob, 2.5, 5);
          }
          drawGem(x, cx, height * 0.14 + bob, 2, '#ff2244');
        }
        // Eyes (front / 3/4 front)
        if (dir === 'down_right') {
          // 3/4 front-right: right eye full, left eye smaller, shifted right
          x.fillStyle = '#ffffff';
          x.fillRect(cx + 1.5, height * 0.23 + bob, 4, 3.5);
          x.fillRect(cx - 4, height * 0.23 + bob, 3, 3);
          x.fillStyle = eyeC;
          x.fillRect(cx + 2.5, height * 0.235 + bob, 2.5, 3);
          x.fillRect(cx - 3.5, height * 0.235 + bob, 2, 2.5);
          x.fillStyle = '#ffffff';
          x.fillRect(cx + 2.5, height * 0.23 + bob, 1, 1);
          x.fillRect(cx - 3.5, height * 0.23 + bob, 0.8, 0.8);
          x.fillStyle = skinD;
          x.fillRect(cx, height * 0.3 + bob, 3.5, 1.2);
        } else {
          x.fillStyle = '#ffffff';
          x.fillRect(cx - 5.5, height * 0.23 + bob, 4, 3.5);
          x.fillRect(cx + 1.5, height * 0.23 + bob, 4, 3.5);
          x.fillStyle = eyeC;
          x.fillRect(cx - 4.5, height * 0.235 + bob, 2.5, 3);
          x.fillRect(cx + 2.5, height * 0.235 + bob, 2.5, 3);
          x.fillStyle = '#ffffff';
          x.fillRect(cx - 4.5, height * 0.23 + bob, 1, 1);
          x.fillRect(cx + 2.5, height * 0.23 + bob, 1, 1);
          // Mouth
          x.fillStyle = skinD;
          x.fillRect(cx - 2, height * 0.3 + bob, 4, 1.2);
        }
        if (special === 'undead') {
          x.globalAlpha = 0.45; x.fillStyle = '#88ff88';
          x.beginPath(); x.arc(cx - 3, height * 0.24 + bob, 3.5, 0, Math.PI * 2); x.fill();
          x.beginPath(); x.arc(cx + 3, height * 0.24 + bob, 3.5, 0, Math.PI * 2); x.fill();
          x.globalAlpha = 1;
        }
      } else if (dir === 'right') {
        // Hair/Hat (side view)
        if (hatType === 'none') {
          x.fillStyle = hairC;
          x.beginPath(); x.arc(cx, height * 0.21 + bob, 9.5, Math.PI, 0); x.fill();
          x.fillRect(cx - 9, height * 0.21 + bob, 3, 9);
        } else if (hatType === 'wizard') {
          const hg = x.createLinearGradient(cx, height * 0.02 + bob, cx, height * 0.23 + bob);
          hg.addColorStop(0, colorShift(hatC, 20)); hg.addColorStop(1, hatC);
          x.fillStyle = hg;
          x.beginPath();
          x.moveTo(cx + 4, height * 0.02 + bob);
          x.lineTo(cx - 10, height * 0.2 + bob);
          x.lineTo(cx + 12, height * 0.2 + bob);
          x.fill();
          x.fillStyle = colorShift(hatC, -20);
          x.fillRect(cx - 11, height * 0.19 + bob, 24, 5);
          x.fillStyle = '#ffd700';
          x.fillRect(cx - 10, height * 0.19 + bob, 22, 2.5);
        } else if (hatType === 'hood') {
          x.fillStyle = hatC;
          x.beginPath();
          x.arc(cx, height * 0.23 + bob, 11, Math.PI, 0);
          x.lineTo(cx + 11, height * 0.33 + bob);
          x.lineTo(cx - 11, height * 0.33 + bob);
          x.fill();
        } else if (hatType === 'helm') {
          drawMetalPlate(x, cx - 10, height * 0.14 + bob, 20, 14, hatC, colorShift(hatC, 30), colorShift(hatC, -30));
          x.fillStyle = '#222222';
          x.fillRect(cx + 1, height * 0.24 + bob, 8, 2);
        } else if (hatType === 'crown') {
          x.fillStyle = '#ffd700';
          x.fillRect(cx - 6, height * 0.13 + bob, 14, 7);
          for (let i = -1; i <= 2; i++) {
            x.fillRect(cx + i * 3.5, height * 0.1 + bob, 2.5, 5);
          }
          drawGem(x, cx + 2, height * 0.14 + bob, 2, '#ff2244');
        }
        // Eyes (side - one visible, shifted right)
        x.fillStyle = '#ffffff';
        x.fillRect(cx + 2, height * 0.23 + bob, 4, 3.5);
        x.fillStyle = eyeC;
        x.fillRect(cx + 3, height * 0.235 + bob, 2.5, 3);
        x.fillStyle = '#ffffff';
        x.fillRect(cx + 3, height * 0.23 + bob, 1, 1);
        // Mouth (side)
        x.fillStyle = skinD;
        x.fillRect(cx + 1, height * 0.3 + bob, 3, 1.2);
        if (special === 'undead') {
          x.globalAlpha = 0.45; x.fillStyle = '#88ff88';
          x.beginPath(); x.arc(cx + 4, height * 0.24 + bob, 3.5, 0, Math.PI * 2); x.fill();
          x.globalAlpha = 1;
        }
      } else {
        // UP / UP_RIGHT (back view) - hair/hat from behind
        if (hatType === 'none') {
          x.fillStyle = hairC;
          x.beginPath(); x.arc(cx, height * 0.22 + bob, 9.5, 0, Math.PI * 2); x.fill();
          x.fillRect(cx - 9, height * 0.22 + bob, 3, 7);
          x.fillRect(cx + 6, height * 0.22 + bob, 3, 7);
        } else if (hatType === 'wizard') {
          const hg = x.createLinearGradient(cx, height * 0.02 + bob, cx, height * 0.23 + bob);
          hg.addColorStop(0, colorShift(hatC, 20)); hg.addColorStop(1, hatC);
          x.fillStyle = hg;
          x.beginPath();
          x.moveTo(cx - 2, height * 0.02 + bob);
          x.lineTo(cx - 12, height * 0.2 + bob);
          x.lineTo(cx + 12, height * 0.2 + bob);
          x.fill();
          x.fillStyle = colorShift(hatC, -20);
          x.fillRect(cx - 13, height * 0.19 + bob, 26, 5);
          x.fillStyle = '#ffd700';
          x.fillRect(cx - 12, height * 0.19 + bob, 24, 2.5);
        } else if (hatType === 'hood') {
          x.fillStyle = hatC;
          x.beginPath(); x.arc(cx, height * 0.23 + bob, 11, 0, Math.PI * 2); x.fill();
          x.fillStyle = colorShift(hatC, -15);
          x.beginPath(); x.arc(cx, height * 0.25 + bob, 10, 0, Math.PI); x.fill();
        } else if (hatType === 'helm') {
          drawMetalPlate(x, cx - 10, height * 0.14 + bob, 20, 14, hatC, colorShift(hatC, 30), colorShift(hatC, -30));
          x.fillStyle = colorShift(hatC, -10);
          x.fillRect(cx - 6, height * 0.16 + bob, 12, 10);
        } else if (hatType === 'crown') {
          x.fillStyle = '#ffd700';
          x.fillRect(cx - 8, height * 0.13 + bob, 16, 7);
          for (let i = -2; i <= 2; i++) {
            x.fillRect(cx + i * 3.5 - 1, height * 0.1 + bob, 2.5, 5);
          }
        }
        if (dir === 'up_right') {
          // 3/4 back-right: slight ear/cheek visible on right side
          x.fillStyle = skinC;
          x.beginPath(); x.arc(cx + 8, height * 0.26 + bob, 3, 0, Math.PI * 2); x.fill();
          x.fillStyle = 'rgba(255,255,255,0.06)';
          x.beginPath(); x.arc(cx + 2, height * 0.24 + bob, 6, 0, Math.PI * 2); x.fill();
        } else {
          // Back of head highlight
          x.fillStyle = 'rgba(255,255,255,0.08)';
          x.beginPath(); x.arc(cx, height * 0.24 + bob, 6, 0, Math.PI * 2); x.fill();
        }
      }

      // Glow (all directions)
      if (glow) {
        x.shadowColor = glow; x.shadowBlur = 10;
        x.fillStyle = glow; x.globalAlpha = 0.08;
        x.beginPath(); x.ellipse(cx, height * 0.5, width * 0.4, height * 0.4, 0, 0, Math.PI * 2); x.fill();
        x.globalAlpha = 1; x.shadowBlur = 0;
      }

      dirs[dir].push(c);
    }
  }

  // Attack frames
  const atk = {down: [], down_right: [], up: [], up_right: [], right: []};
  for (const dir of ['down', 'down_right', 'right', 'up_right', 'up']) {
    for (let f = 0; f < 4; f++) {
      const c = makeCanvas(width, height);
      const x = c.getContext('2d');
      const cx = width / 2;
      const atkPhase = f / 3; // 0 to 1
      const swingAngle = Math.sin(atkPhase * Math.PI) * 0.6;
      const leanX = dir === 'right' ? atkPhase * 4 : (dir === 'down_right' || dir === 'up_right') ? atkPhase * 2.5 : 0;
      const leanY = dir === 'down' ? atkPhase * 3 : dir === 'down_right' ? atkPhase * 2 : dir === 'up' ? -atkPhase * 3 : dir === 'up_right' ? -atkPhase * 2 : 0;
      const bob = leanY * 0.3;

      draw3DShadow(x, cx + leanX, height - 4, 14, 4);

      // Aura
      if (auraC) {
        x.fillStyle = auraC;
        x.beginPath(); x.ellipse(cx + leanX, height * 0.5 + leanY, width * 0.48, height * 0.46, 0, 0, Math.PI * 2); x.fill();
      }

      // Cape
      if (capeC) {
        if (dir === 'up') {
          drawCape(x, cx, height * 0.33 + bob, 22, height * 0.52, capeC, f);
        } else if (dir === 'up_right') {
          drawCape(x, cx - 2, height * 0.34 + bob, 20, height * 0.50, capeC, f);
        } else if (dir === 'right') {
          drawCape(x, cx - 4 + leanX * 0.3, height * 0.35 + bob, 16, height * 0.48, capeC, f);
        } else if (dir === 'down_right') {
          drawCape(x, cx - 2, height * 0.35 + bob, 18, height * 0.48, capeC, f);
        } else {
          drawCape(x, cx, height * 0.35 + bob, 20, height * 0.48, capeC, f);
        }
      }

      // Legs (planted for attack)
      const legSpread = Math.sin(atkPhase * Math.PI) * 1.5;
      drawCylinder(x, cx - 6 - legSpread + leanX, height * 0.63 + bob, 5, 12, armorC, armorL, armorD);
      drawCylinder(x, cx + 1 + legSpread + leanX, height * 0.63 + bob, 5, 12, armorC, armorL, armorD);
      x.fillStyle = '#3a2820';
      x.beginPath(); x.roundRect(cx - 7 - legSpread + leanX, height * 0.82 + bob, 7, 5, 2); x.fill();
      x.beginPath(); x.roundRect(cx + legSpread + leanX, height * 0.82 + bob, 7, 5, 2); x.fill();

      // Body (leaning into attack)
      drawMetalPlate(x, cx - 10 + leanX, height * 0.34 + bob, 20, height * 0.32, armorC, armorL, armorD);
      drawHumanoidRegalia(x, cx + leanX, height * 0.34 + bob, 20, height * 0.32, {
        armorC, armorL, armorD, clothC: capeC || colorShift(armorD, -18), gemC: eyeC || '#ffd36a'
      }, dir);
      if (dir !== 'up' && dir !== 'up_right') {
        x.strokeStyle = armorD; x.lineWidth = 0.8;
        x.beginPath(); x.moveTo(cx + leanX, height * 0.36 + bob); x.lineTo(cx + leanX, height * 0.64 + bob); x.stroke();
      }
      // Belt
      x.fillStyle = '#5a4030';
      x.fillRect(cx - 10 + leanX, height * 0.6 + bob, 20, 3);
      if (dir !== 'up' && dir !== 'up_right') { x.fillStyle = '#ffd700'; x.fillRect(cx - 2 + leanX, height * 0.6 + bob, 4, 3); }

      // Arms (attack swing)
      if (dir === 'down' || dir === 'right' || dir === 'down_right') {
        // Left arm pulled back
        const leftArmSwing = -swingAngle * 8;
        drawCylinder(x, cx - 14 + leanX, height * 0.37 + bob + leftArmSwing, 5, 15, armorC, armorL, armorD);
        drawSphere(x, cx - 11.5 + leanX, height * 0.57 + bob + leftArmSwing, 3, skinC, skinL, skinD);
        // Right arm swinging weapon forward
        const rightArmSwing = swingAngle * 12;
        drawCylinder(x, cx + 9 + leanX, height * 0.37 + bob - rightArmSwing, 5, 15, armorC, armorL, armorD);
        drawSphere(x, cx + 11.5 + leanX, height * 0.57 + bob - rightArmSwing, 3, skinC, skinL, skinD);

        // Weapon swing
        if (weaponType === 'sword') {
          x.save();
          x.translate(cx + 13 + leanX, height * 0.45 + bob - rightArmSwing);
          x.rotate(-0.5 + swingAngle * 2.5);
          drawSwordBlade(x, -2, -20, 24, 4, '#cccccc');
          x.fillStyle = '#ffd700'; x.fillRect(-3, -2, 8, 3);
          x.fillStyle = '#5a3a1a'; x.fillRect(0, 1, 3, 5);
          x.restore();
        } else if (weaponType === 'staff') {
          x.save();
          x.translate(cx + 13 + leanX, height * 0.15 + bob);
          x.rotate(swingAngle * 1.5);
          x.fillStyle = '#5a3a18'; x.fillRect(-1, 0, 2.5, 34);
          drawSphere(x, 1, -3, 6, weaponC, colorShift(weaponC, 40), colorShift(weaponC, -40));
          x.fillStyle = weaponC; x.globalAlpha = 0.25 + atkPhase * 0.3;
          x.beginPath(); x.arc(1, -3, 12, 0, Math.PI * 2); x.fill();
          x.globalAlpha = 1;
          x.restore();
        } else if (weaponType === 'dagger') {
          x.save();
          x.translate(cx - 15 + leanX, height * 0.44 + bob + leftArmSwing);
          x.rotate(swingAngle * 2);
          x.fillStyle = '#cccccc'; x.fillRect(0, 0, 2, 12);
          x.fillStyle = 'rgba(255,255,255,0.3)'; x.fillRect(0, 0, 0.8, 12);
          x.restore();
          x.save();
          x.translate(cx + 13 + leanX, height * 0.44 + bob - rightArmSwing);
          x.rotate(-swingAngle * 2);
          x.fillStyle = '#cccccc'; x.fillRect(0, 0, 2, 12);
          x.fillStyle = 'rgba(255,255,255,0.3)'; x.fillRect(0, 0, 0.8, 12);
          x.restore();
        } else if (weaponType === 'spear') {
          x.save();
          x.translate(cx + 13 + leanX, height * 0.08 + bob);
          x.rotate(swingAngle * 1.2);
          x.fillStyle = '#6a4a2a'; x.fillRect(-1, 0, 2.5, 40);
          x.fillStyle = '#cccccc';
          x.beginPath(); x.moveTo(0.25, -5); x.lineTo(-3, 4); x.lineTo(3.5, 4); x.fill();
          x.fillStyle = 'rgba(255,255,255,0.25)';
          x.beginPath(); x.moveTo(0.25, -5); x.lineTo(-2, 3); x.lineTo(0.5, 4); x.fill();
          x.restore();
        }
      } else {
        // UP direction - arms and weapon from behind
        const armSwingUp = swingAngle * 8;
        drawCylinder(x, cx - 14, height * 0.37 + bob - armSwingUp, 5, 15, armorC, armorL, armorD);
        drawCylinder(x, cx + 9, height * 0.37 + bob + armSwingUp, 5, 15, armorC, armorL, armorD);
        drawSphere(x, cx - 11.5, height * 0.57 + bob - armSwingUp, 3, skinC, skinL, skinD);
        drawSphere(x, cx + 11.5, height * 0.57 + bob + armSwingUp, 3, skinC, skinL, skinD);
        if (weaponType === 'sword') {
          x.save(); x.translate(cx + 4, height * 0.2 + bob);
          x.rotate(0.3 - swingAngle * 2);
          x.fillStyle = '#5a3a1a'; x.fillRect(-1.5, 0, 3, 24);
          x.fillStyle = '#cccccc'; x.fillRect(-1, -10, 2, 12);
          x.restore();
        } else if (weaponType === 'staff') {
          x.save(); x.translate(cx + 8, height * 0.15 + bob);
          x.rotate(swingAngle * 1.5);
          x.fillStyle = '#5a3a18'; x.fillRect(0, 0, 2.5, 34);
          drawSphere(x, 1.25, -3, 5, weaponC, colorShift(weaponC, 40), colorShift(weaponC, -40));
          x.restore();
        } else if (weaponType === 'spear') {
          x.save(); x.translate(cx + 8, height * 0.08 + bob);
          x.rotate(swingAngle * 1.2);
          x.fillStyle = '#6a4a2a'; x.fillRect(0, 0, 2.5, 40);
          x.fillStyle = '#cccccc';
          x.beginPath(); x.moveTo(1.25, -5); x.lineTo(-1.5, 2); x.lineTo(4, 2); x.fill();
          x.restore();
        }
      }

      // Head
      drawSphere(x, cx + leanX, height * 0.25 + bob, 9, skinC, skinL, skinD);

      // Face per direction
      if (dir === 'down' || dir === 'down_right') {
        if (hatType === 'none') {
          x.fillStyle = hairC;
          x.beginPath(); x.arc(cx + leanX, height * 0.21 + bob, 9.5, Math.PI, 0); x.fill();
          x.fillRect(cx - 9 + leanX, height * 0.21 + bob, 3, 7);
        } else if (hatType === 'wizard') {
          const hg = x.createLinearGradient(cx, height * 0.02 + bob, cx, height * 0.23 + bob);
          hg.addColorStop(0, colorShift(hatC, 20)); hg.addColorStop(1, hatC);
          x.fillStyle = hg; x.beginPath();
          x.moveTo(cx + 2, height * 0.02 + bob); x.lineTo(cx - 12, height * 0.2 + bob); x.lineTo(cx + 12, height * 0.2 + bob); x.fill();
          x.fillStyle = colorShift(hatC, -20); x.fillRect(cx - 13, height * 0.19 + bob, 26, 5);
          x.fillStyle = '#ffd700'; x.fillRect(cx - 12, height * 0.19 + bob, 24, 2.5);
        } else if (hatType === 'hood') {
          x.fillStyle = hatC; x.beginPath();
          x.arc(cx, height * 0.23 + bob, 11, Math.PI, 0);
          x.lineTo(cx + 11, height * 0.33 + bob); x.lineTo(cx - 11, height * 0.33 + bob); x.fill();
        } else if (hatType === 'helm') {
          drawMetalPlate(x, cx - 10, height * 0.14 + bob, 20, 14, hatC, colorShift(hatC, 30), colorShift(hatC, -30));
          x.fillStyle = '#222222'; x.fillRect(cx - 6, height * 0.24 + bob, 12, 2);
        } else if (hatType === 'crown') {
          x.fillStyle = '#ffd700'; x.fillRect(cx - 8, height * 0.13 + bob, 16, 7);
          for (let i = -2; i <= 2; i++) x.fillRect(cx + i * 3.5 - 1, height * 0.1 + bob, 2.5, 5);
          drawGem(x, cx, height * 0.14 + bob, 2, '#ff2244');
        }
        if (dir === 'down_right') {
          // 3/4 front-right fierce eyes
          x.fillStyle = '#ffffff';
          x.fillRect(cx + 1.5 + leanX, height * 0.23 + bob, 4, 3);
          x.fillRect(cx - 4 + leanX, height * 0.23 + bob, 3, 3);
          x.fillStyle = eyeC;
          x.fillRect(cx + 2.5 + leanX, height * 0.235 + bob, 2.5, 3);
          x.fillRect(cx - 3.5 + leanX, height * 0.235 + bob, 2, 2.5);
          x.fillStyle = '#ffffff';
          x.fillRect(cx + 2.5 + leanX, height * 0.23 + bob, 1, 1);
          x.fillRect(cx - 3.5 + leanX, height * 0.23 + bob, 0.8, 0.8);
          x.fillStyle = skinD;
          x.fillRect(cx + leanX, height * 0.3 + bob, 3.5, 1.5);
        } else {
          // Fierce eyes (front)
          x.fillStyle = '#ffffff';
          x.fillRect(cx - 5.5, height * 0.23 + bob, 4, 3);
          x.fillRect(cx + 1.5, height * 0.23 + bob, 4, 3);
          x.fillStyle = eyeC;
          x.fillRect(cx - 4.5, height * 0.235 + bob, 2.5, 3);
          x.fillRect(cx + 2.5, height * 0.235 + bob, 2.5, 3);
          x.fillStyle = '#ffffff';
          x.fillRect(cx - 4.5, height * 0.23 + bob, 1, 1);
          x.fillRect(cx + 2.5, height * 0.23 + bob, 1, 1);
          // Grimace
          x.fillStyle = skinD;
          x.fillRect(cx - 3, height * 0.3 + bob, 6, 1.5);
        }
      } else if (dir === 'right') {
        if (hatType === 'none') {
          x.fillStyle = hairC;
          x.beginPath(); x.arc(cx + leanX, height * 0.21 + bob, 9.5, Math.PI, 0); x.fill();
          x.fillRect(cx - 9 + leanX, height * 0.21 + bob, 3, 9);
        } else if (hatType === 'wizard') {
          const hg = x.createLinearGradient(cx, height * 0.02 + bob, cx, height * 0.23 + bob);
          hg.addColorStop(0, colorShift(hatC, 20)); hg.addColorStop(1, hatC);
          x.fillStyle = hg; x.beginPath();
          x.moveTo(cx + 4 + leanX, height * 0.02 + bob); x.lineTo(cx - 10 + leanX, height * 0.2 + bob); x.lineTo(cx + 12 + leanX, height * 0.2 + bob); x.fill();
          x.fillStyle = colorShift(hatC, -20); x.fillRect(cx - 11 + leanX, height * 0.19 + bob, 24, 5);
          x.fillStyle = '#ffd700'; x.fillRect(cx - 10 + leanX, height * 0.19 + bob, 22, 2.5);
        } else if (hatType === 'hood') {
          x.fillStyle = hatC; x.beginPath();
          x.arc(cx + leanX, height * 0.23 + bob, 11, Math.PI, 0);
          x.lineTo(cx + 11 + leanX, height * 0.33 + bob); x.lineTo(cx - 11 + leanX, height * 0.33 + bob); x.fill();
        } else if (hatType === 'helm') {
          drawMetalPlate(x, cx - 10 + leanX, height * 0.14 + bob, 20, 14, hatC, colorShift(hatC, 30), colorShift(hatC, -30));
          x.fillStyle = '#222222'; x.fillRect(cx + 1 + leanX, height * 0.24 + bob, 8, 2);
        } else if (hatType === 'crown') {
          x.fillStyle = '#ffd700'; x.fillRect(cx - 6 + leanX, height * 0.13 + bob, 14, 7);
          for (let i = -1; i <= 2; i++) x.fillRect(cx + i * 3.5 + leanX, height * 0.1 + bob, 2.5, 5);
          drawGem(x, cx + 2 + leanX, height * 0.14 + bob, 2, '#ff2244');
        }
        x.fillStyle = '#ffffff';
        x.fillRect(cx + 2 + leanX, height * 0.23 + bob, 4, 3.5);
        x.fillStyle = eyeC;
        x.fillRect(cx + 3 + leanX, height * 0.235 + bob, 2.5, 3);
        x.fillStyle = '#ffffff';
        x.fillRect(cx + 3 + leanX, height * 0.23 + bob, 1, 1);
        x.fillStyle = skinD;
        x.fillRect(cx + 1 + leanX, height * 0.3 + bob, 3, 1.5);
      } else {
        // UP / UP_RIGHT
        if (hatType === 'none') {
          x.fillStyle = hairC;
          x.beginPath(); x.arc(cx, height * 0.22 + bob, 9.5, 0, Math.PI * 2); x.fill();
          x.fillRect(cx - 9, height * 0.22 + bob, 3, 7);
          x.fillRect(cx + 6, height * 0.22 + bob, 3, 7);
        } else if (hatType === 'wizard') {
          const hg = x.createLinearGradient(cx, height * 0.02 + bob, cx, height * 0.23 + bob);
          hg.addColorStop(0, colorShift(hatC, 20)); hg.addColorStop(1, hatC);
          x.fillStyle = hg; x.beginPath();
          x.moveTo(cx - 2, height * 0.02 + bob); x.lineTo(cx - 12, height * 0.2 + bob); x.lineTo(cx + 12, height * 0.2 + bob); x.fill();
          x.fillStyle = colorShift(hatC, -20); x.fillRect(cx - 13, height * 0.19 + bob, 26, 5);
          x.fillStyle = '#ffd700'; x.fillRect(cx - 12, height * 0.19 + bob, 24, 2.5);
        } else if (hatType === 'hood') {
          x.fillStyle = hatC; x.beginPath(); x.arc(cx, height * 0.23 + bob, 11, 0, Math.PI * 2); x.fill();
          x.fillStyle = colorShift(hatC, -15);
          x.beginPath(); x.arc(cx, height * 0.25 + bob, 10, 0, Math.PI); x.fill();
        } else if (hatType === 'helm') {
          drawMetalPlate(x, cx - 10, height * 0.14 + bob, 20, 14, hatC, colorShift(hatC, 30), colorShift(hatC, -30));
          x.fillStyle = colorShift(hatC, -10); x.fillRect(cx - 6, height * 0.16 + bob, 12, 10);
        } else if (hatType === 'crown') {
          x.fillStyle = '#ffd700'; x.fillRect(cx - 8, height * 0.13 + bob, 16, 7);
          for (let i = -2; i <= 2; i++) x.fillRect(cx + i * 3.5 - 1, height * 0.1 + bob, 2.5, 5);
        }
        if (dir === 'up_right') {
          x.fillStyle = skinC;
          x.beginPath(); x.arc(cx + 8, height * 0.26 + bob, 3, 0, Math.PI * 2); x.fill();
          x.fillStyle = 'rgba(255,255,255,0.06)';
          x.beginPath(); x.arc(cx + 2, height * 0.24 + bob, 6, 0, Math.PI * 2); x.fill();
        } else {
          x.fillStyle = 'rgba(255,255,255,0.08)';
          x.beginPath(); x.arc(cx, height * 0.24 + bob, 6, 0, Math.PI * 2); x.fill();
        }
      }

      // Glow
      if (glow) {
        x.shadowColor = glow; x.shadowBlur = 10;
        x.fillStyle = glow; x.globalAlpha = 0.08;
        x.beginPath(); x.ellipse(cx + leanX, height * 0.5 + leanY, width * 0.4, height * 0.4, 0, 0, Math.PI * 2); x.fill();
        x.globalAlpha = 1; x.shadowBlur = 0;
      }

      // Weapon impact effect (slash arc)
      if (f === 2 && (dir === 'down' || dir === 'right' || dir === 'down_right') && weaponType !== 'none') {
        x.strokeStyle = 'rgba(255,255,255,0.4)'; x.lineWidth = 2;
        x.beginPath();
        const arcX = (dir === 'right' || dir === 'down_right') ? cx + 18 + leanX : cx + 12;
        const arcY = height * 0.3 + bob;
        x.arc(arcX, arcY, 14, -Math.PI * 0.6, Math.PI * 0.3);
        x.stroke();
      }

      atk[dir].push(c);
    }
  }
  setDirCache8(key, {
    down: dirs.down, down_right: dirs.down_right, right: dirs.right, up_right: dirs.up_right, up: dirs.up,
    atk_down: atk.down, atk_down_right: atk.down_right, atk_right: atk.right,
    atk_up_right: atk.up_right, atk_up: atk.up
  });
}

// ============================================================
//  SKELETON SPRITE (Bone structure with glowing eyes)
// ============================================================
function genSkeleton(key) {
  const dirs = { down: [], down_right: [], up: [], up_right: [], right: [] };
  const bone = '#f0e8d8', bonD = '#c8b898', bonL = '#fff8f0';
  for (const dir of ['down', 'down_right', 'right', 'up_right', 'up']) {
    for (let f = 0; f < 4; f++) {
      const c = makeCanvas(48, 64);
      const x = c.getContext('2d');
      const cx = 24, bob = Math.sin(f * Math.PI / 2) * 1.2;

      draw3DShadow(x, cx, 58, 13, 4);

      // Legs (same for all directions)
      const lp = Math.sin(f * Math.PI / 2) * 2.5;
      x.strokeStyle = bone; x.lineWidth = 4; x.lineCap = 'round';
      x.beginPath(); x.moveTo(cx - 5, 42 + bob); x.lineTo(cx - 6, 54 + lp); x.stroke();
      x.beginPath(); x.moveTo(cx + 5, 42 + bob); x.lineTo(cx + 6, 54 - lp); x.stroke();
      drawSphere(x, cx - 5, 42 + bob, 3, bone, bonL, bonD);
      drawSphere(x, cx + 5, 42 + bob, 3, bone, bonL, bonD);
      drawSphere(x, cx - 6, 54 + lp, 2.5, bone, bonL, bonD);
      drawSphere(x, cx + 6, 54 - lp, 2.5, bone, bonL, bonD);
      x.fillStyle = bonD;
      x.fillRect(cx - 9, 53 + lp, 7, 2);
      x.fillRect(cx + 3, 53 - lp, 7, 2);

      // Ribcage (same for all directions)
      drawSphere(x, cx, 34 + bob, 10, bone, bonL, bonD);
      x.strokeStyle = bonD; x.lineWidth = 1.2;
      for (let i = -2; i <= 2; i++) {
        x.beginPath();
        x.moveTo(cx - 8, 31 + i * 3.5 + bob);
        x.quadraticCurveTo(cx, 29.5 + i * 3.5 + bob, cx + 8, 31 + i * 3.5 + bob);
        x.stroke();
      }
      // Spine
      x.strokeStyle = bone; x.lineWidth = 3;
      x.beginPath(); x.moveTo(cx, 24 + bob); x.lineTo(cx, 46 + bob); x.stroke();
      x.strokeStyle = bonD; x.lineWidth = 1;
      for (let i = 0; i < 5; i++) {
        const sy = 26 + i * 4 + bob;
        x.beginPath(); x.moveTo(cx - 2, sy); x.lineTo(cx + 2, sy); x.stroke();
      }

      // Arms (same for all directions)
      const as = Math.sin(f * Math.PI / 2) * 3;
      x.strokeStyle = bone; x.lineWidth = 3;
      x.beginPath(); x.moveTo(cx - 10, 28 + bob); x.lineTo(cx - 16, 42 + bob + as); x.stroke();
      x.beginPath(); x.moveTo(cx + 10, 28 + bob); x.lineTo(cx + 16, 42 + bob - as); x.stroke();
      drawSphere(x, cx - 10, 28 + bob, 2.5, bone, bonL, bonD);
      drawSphere(x, cx + 10, 28 + bob, 2.5, bone, bonL, bonD);
      x.strokeStyle = bone; x.lineWidth = 1;
      for (let i = -1; i <= 1; i++) {
        x.beginPath(); x.moveTo(cx - 16, 42 + bob + as); x.lineTo(cx - 18 + i * 2, 46 + bob + as); x.stroke();
        x.beginPath(); x.moveTo(cx + 16, 42 + bob - as); x.lineTo(cx + 18 + i * 2, 46 + bob - as); x.stroke();
      }

      // Sword (visible for down/right/diag, on back for up)
      if (dir === 'down' || dir === 'right' || dir === 'down_right') {
        const swG = x.createLinearGradient(cx + 17, 24, cx + 19, 24);
        swG.addColorStop(0, '#888888'); swG.addColorStop(0.5, '#bbbbbb'); swG.addColorStop(1, '#666666');
        x.fillStyle = swG;
        x.fillRect(cx + 17, 22 + bob - as, 2.5, 20);
        x.fillStyle = 'rgba(139,90,43,0.3)';
        x.fillRect(cx + 17, 28 + bob - as, 2, 3);
        x.fillStyle = '#8a6a3a';
        x.fillRect(cx + 14, 40 + bob - as, 8, 3);
      } else {
        // UP: sword on back
        x.fillStyle = '#888888';
        x.save(); x.translate(cx + 3, 14 + bob); x.rotate(0.25);
        x.fillRect(-1, 0, 2.5, 20); x.restore();
        x.fillStyle = '#8a6a3a';
        x.save(); x.translate(cx + 3, 14 + bob); x.rotate(0.25);
        x.fillRect(-3, 18, 7, 3); x.restore();
      }

      // Skull
      drawSphere(x, cx, 17 + bob, 10, bone, bonL, bonD);

      if (dir === 'down' || dir === 'down_right') {
        // Jaw (front / 3/4 front)
        x.fillStyle = bone;
        x.beginPath();
        x.moveTo(cx - 7, 22 + bob); x.lineTo(cx - 5, 27 + bob);
        x.lineTo(cx + 5, 27 + bob); x.lineTo(cx + 7, 22 + bob); x.fill();
        if (dir === 'down_right') {
          // 3/4 front-right: right eye full, left eye smaller
          x.fillStyle = '#1a0808';
          x.beginPath(); x.ellipse(cx + 3, 15 + bob, 3.5, 4, 0, 0, Math.PI * 2); x.fill();
          x.beginPath(); x.ellipse(cx - 5, 15 + bob, 2.5, 3, 0, 0, Math.PI * 2); x.fill();
          x.fillStyle = '#ff4444'; x.shadowColor = '#ff2222'; x.shadowBlur = 8;
          x.globalAlpha = 0.7 + Math.sin(f * Math.PI / 2) * 0.3;
          x.beginPath(); x.arc(cx + 3, 15 + bob, 2.2, 0, Math.PI * 2); x.fill();
          x.beginPath(); x.arc(cx - 5, 15 + bob, 1.6, 0, Math.PI * 2); x.fill();
          x.globalAlpha = 1; x.shadowBlur = 0;
          x.fillStyle = '#ffaaaa';
          x.beginPath(); x.arc(cx + 3, 15 + bob, 0.8, 0, Math.PI * 2); x.fill();
          x.fillStyle = '#2a1a1a';
          x.beginPath(); x.moveTo(cx + 1, 19 + bob); x.lineTo(cx - 1, 21.5 + bob); x.lineTo(cx + 3, 21.5 + bob); x.fill();
        } else {
          // Eye sockets (front - both)
          x.fillStyle = '#1a0808';
          x.beginPath(); x.ellipse(cx - 4, 15 + bob, 3.5, 4, 0, 0, Math.PI * 2); x.fill();
          x.beginPath(); x.ellipse(cx + 4, 15 + bob, 3.5, 4, 0, 0, Math.PI * 2); x.fill();
          // Glowing eyes
          x.fillStyle = '#ff4444'; x.shadowColor = '#ff2222'; x.shadowBlur = 8;
          x.globalAlpha = 0.7 + Math.sin(f * Math.PI / 2) * 0.3;
          x.beginPath(); x.arc(cx - 4, 15 + bob, 2.2, 0, Math.PI * 2); x.fill();
          x.beginPath(); x.arc(cx + 4, 15 + bob, 2.2, 0, Math.PI * 2); x.fill();
          x.globalAlpha = 1; x.shadowBlur = 0;
          x.fillStyle = '#ffaaaa';
          x.beginPath(); x.arc(cx - 4, 15 + bob, 0.8, 0, Math.PI * 2); x.fill();
          x.beginPath(); x.arc(cx + 4, 15 + bob, 0.8, 0, Math.PI * 2); x.fill();
          // Nose hole
          x.fillStyle = '#2a1a1a';
          x.beginPath(); x.moveTo(cx, 19 + bob); x.lineTo(cx - 2, 21.5 + bob); x.lineTo(cx + 2, 21.5 + bob); x.fill();
        }
        // Teeth
        x.fillStyle = bonL;
        for (let i = -3; i <= 3; i++) {
          x.fillRect(cx + i * 1.5 - 0.5, 24 + bob, 1.2, 2.5);
        }
        // Skull crack
        x.strokeStyle = bonD; x.lineWidth = 0.6; x.globalAlpha = 0.5;
        x.beginPath(); x.moveTo(cx + 2, 8 + bob); x.lineTo(cx + 5, 13 + bob); x.lineTo(cx + 3, 16 + bob); x.stroke();
        x.globalAlpha = 1;
      } else if (dir === 'right') {
        // Jaw (side)
        x.fillStyle = bone;
        x.beginPath();
        x.moveTo(cx + 1, 22 + bob); x.lineTo(cx + 2, 27 + bob);
        x.lineTo(cx + 8, 26 + bob); x.lineTo(cx + 8, 22 + bob); x.fill();
        // Eye socket (side - one visible, shifted right)
        x.fillStyle = '#1a0808';
        x.beginPath(); x.ellipse(cx + 3, 15 + bob, 3, 3.5, 0, 0, Math.PI * 2); x.fill();
        // Glowing eye
        x.fillStyle = '#ff4444'; x.shadowColor = '#ff2222'; x.shadowBlur = 8;
        x.globalAlpha = 0.7 + Math.sin(f * Math.PI / 2) * 0.3;
        x.beginPath(); x.arc(cx + 3, 15 + bob, 2, 0, Math.PI * 2); x.fill();
        x.globalAlpha = 1; x.shadowBlur = 0;
        x.fillStyle = '#ffaaaa';
        x.beginPath(); x.arc(cx + 3, 15 + bob, 0.7, 0, Math.PI * 2); x.fill();
        // Nose hole (side)
        x.fillStyle = '#2a1a1a';
        x.beginPath(); x.arc(cx + 6, 19 + bob, 1.5, 0, Math.PI * 2); x.fill();
        // Teeth (side)
        x.fillStyle = bonL;
        for (let i = 0; i < 4; i++) {
          x.fillRect(cx + 2 + i * 1.5, 24 + bob, 1.2, 2.5);
        }
        // Skull crack
        x.strokeStyle = bonD; x.lineWidth = 0.6; x.globalAlpha = 0.5;
        x.beginPath(); x.moveTo(cx + 2, 8 + bob); x.lineTo(cx + 5, 13 + bob); x.lineTo(cx + 3, 16 + bob); x.stroke();
        x.globalAlpha = 1;
      } else {
        // UP / UP_RIGHT (back) - back of skull
        x.fillStyle = bonD; x.globalAlpha = 0.3;
        x.beginPath(); x.arc(cx, 15 + bob, 6, 0, Math.PI * 2); x.fill();
        x.globalAlpha = 1;
        x.strokeStyle = bonD; x.lineWidth = 0.6; x.globalAlpha = 0.5;
        x.beginPath(); x.moveTo(cx - 2, 9 + bob); x.lineTo(cx - 4, 14 + bob); x.lineTo(cx - 1, 18 + bob); x.stroke();
        x.beginPath(); x.moveTo(cx + 3, 10 + bob); x.lineTo(cx + 5, 15 + bob); x.stroke();
        x.globalAlpha = 1;
        x.fillStyle = bone;
        x.beginPath();
        x.moveTo(cx - 6, 23 + bob); x.lineTo(cx - 5, 26 + bob);
        x.lineTo(cx + 5, 26 + bob); x.lineTo(cx + 6, 23 + bob); x.fill();
        if (dir === 'up_right') {
          // 3/4 back-right: slight jaw visible on right
          x.fillStyle = bone; x.globalAlpha = 0.5;
          x.beginPath(); x.arc(cx + 7, 18 + bob, 2.5, 0, Math.PI * 2); x.fill();
          x.globalAlpha = 1;
        }
      }

      dirs[dir].push(c);
    }
  }

  // Attack frames
  const atk = {down: [], down_right: [], up: [], up_right: [], right: []};
  for (const dir of ['down', 'down_right', 'right', 'up_right', 'up']) {
    for (let f = 0; f < 4; f++) {
      const c = makeCanvas(48, 64);
      const x = c.getContext('2d');
      const cx = 24;
      const atkPhase = f / 3;
      const swingAngle = Math.sin(atkPhase * Math.PI);
      const leanX = dir === 'right' ? atkPhase * 3 : (dir === 'down_right' || dir === 'up_right') ? atkPhase * 2 : 0;
      const leanY = dir === 'down' ? atkPhase * 2 : dir === 'down_right' ? atkPhase * 1.5 : dir === 'up' ? -atkPhase * 2 : dir === 'up_right' ? -atkPhase * 1.5 : 0;
      const bob = leanY * 0.4;

      draw3DShadow(x, cx + leanX, 58, 13, 4);

      // Legs (lurching forward)
      const lp = swingAngle * 3;
      x.strokeStyle = bone; x.lineWidth = 4; x.lineCap = 'round';
      x.beginPath(); x.moveTo(cx - 5 + leanX, 42 + bob); x.lineTo(cx - 7 + leanX, 54 + lp); x.stroke();
      x.beginPath(); x.moveTo(cx + 5 + leanX, 42 + bob); x.lineTo(cx + 7 + leanX, 54 - lp); x.stroke();
      drawSphere(x, cx - 5 + leanX, 42 + bob, 3, bone, bonL, bonD);
      drawSphere(x, cx + 5 + leanX, 42 + bob, 3, bone, bonL, bonD);
      drawSphere(x, cx - 7 + leanX, 54 + lp, 2.5, bone, bonL, bonD);
      drawSphere(x, cx + 7 + leanX, 54 - lp, 2.5, bone, bonL, bonD);
      x.fillStyle = bonD;
      x.fillRect(cx - 10 + leanX, 53 + lp, 7, 2);
      x.fillRect(cx + 4 + leanX, 53 - lp, 7, 2);

      // Ribcage
      drawSphere(x, cx + leanX, 34 + bob, 10, bone, bonL, bonD);
      x.strokeStyle = bonD; x.lineWidth = 1.2;
      for (let i = -2; i <= 2; i++) {
        x.beginPath();
        x.moveTo(cx - 8 + leanX, 31 + i * 3.5 + bob);
        x.quadraticCurveTo(cx + leanX, 29.5 + i * 3.5 + bob, cx + 8 + leanX, 31 + i * 3.5 + bob);
        x.stroke();
      }
      // Spine
      x.strokeStyle = bone; x.lineWidth = 3;
      x.beginPath(); x.moveTo(cx + leanX, 24 + bob); x.lineTo(cx + leanX, 46 + bob); x.stroke();
      x.strokeStyle = bonD; x.lineWidth = 1;
      for (let i = 0; i < 5; i++) {
        const sy = 26 + i * 4 + bob;
        x.beginPath(); x.moveTo(cx - 2 + leanX, sy); x.lineTo(cx + 2 + leanX, sy); x.stroke();
      }

      // Arms - sword slashing
      const swordSwing = swingAngle * 1.2;
      // Left arm (pulled back)
      x.strokeStyle = bone; x.lineWidth = 3;
      x.beginPath(); x.moveTo(cx - 10 + leanX, 28 + bob); x.lineTo(cx - 14 + leanX, 42 + bob + swingAngle * 4); x.stroke();
      drawSphere(x, cx - 10 + leanX, 28 + bob, 2.5, bone, bonL, bonD);
      x.strokeStyle = bone; x.lineWidth = 1;
      for (let i = -1; i <= 1; i++) {
        x.beginPath(); x.moveTo(cx - 14 + leanX, 42 + bob + swingAngle * 4);
        x.lineTo(cx - 16 + i * 2 + leanX, 46 + bob + swingAngle * 4); x.stroke();
      }
      // Right arm (swinging sword)
      x.strokeStyle = bone; x.lineWidth = 3;
      x.beginPath(); x.moveTo(cx + 10 + leanX, 28 + bob); x.lineTo(cx + 16 + leanX, 38 + bob - swingAngle * 8); x.stroke();
      drawSphere(x, cx + 10 + leanX, 28 + bob, 2.5, bone, bonL, bonD);

      // Sword in attack
      if (dir === 'down' || dir === 'right' || dir === 'down_right') {
        x.save();
        x.translate(cx + 16 + leanX, 36 + bob - swingAngle * 8);
        x.rotate(-0.3 + swordSwing * 2.2);
        const swG = x.createLinearGradient(0, 0, 3, 0);
        swG.addColorStop(0, '#888888'); swG.addColorStop(0.5, '#cccccc'); swG.addColorStop(1, '#666666');
        x.fillStyle = swG; x.fillRect(0, -18, 2.5, 22);
        x.fillStyle = '#8a6a3a'; x.fillRect(-3, 2, 8, 3);
        // Slash trail effect
        if (f === 1 || f === 2) {
          x.strokeStyle = 'rgba(255,255,255,0.35)'; x.lineWidth = 1.5;
          x.beginPath(); x.arc(0, -8, 12, -Math.PI * 0.6, Math.PI * 0.2); x.stroke();
        }
        x.restore();
      } else {
        // UP: sword from behind
        x.save(); x.translate(cx + 3 + leanX, 14 + bob);
        x.rotate(0.25 - swordSwing * 1.5);
        x.fillStyle = '#888888'; x.fillRect(-1, 0, 2.5, 20);
        x.fillStyle = '#8a6a3a'; x.fillRect(-3, 18, 7, 3);
        x.restore();
      }

      // Skull (lurching)
      drawSphere(x, cx + leanX, 17 + bob, 10, bone, bonL, bonD);

      if (dir === 'down' || dir === 'down_right') {
        // Jaw (open wider in attack)
        const jawOpen = swingAngle * 3;
        x.fillStyle = bone;
        x.beginPath();
        x.moveTo(cx - 7 + leanX, 22 + bob); x.lineTo(cx - 5 + leanX, 27 + bob + jawOpen);
        x.lineTo(cx + 5 + leanX, 27 + bob + jawOpen); x.lineTo(cx + 7 + leanX, 22 + bob); x.fill();
        if (jawOpen > 0.5) {
          x.fillStyle = '#1a0808'; x.beginPath();
          x.ellipse(cx + leanX, 24 + bob + jawOpen * 0.3, 4, jawOpen * 0.5, 0, 0, Math.PI * 2); x.fill();
        }
        if (dir === 'down_right') {
          // 3/4 front-right attack eyes
          x.fillStyle = '#1a0808';
          x.beginPath(); x.ellipse(cx + 3 + leanX, 15 + bob, 3.5, 4, 0, 0, Math.PI * 2); x.fill();
          x.beginPath(); x.ellipse(cx - 5 + leanX, 15 + bob, 2.5, 3, 0, 0, Math.PI * 2); x.fill();
          x.fillStyle = '#ff2222'; x.shadowColor = '#ff0000'; x.shadowBlur = 12;
          x.globalAlpha = 0.9;
          x.beginPath(); x.arc(cx + 3 + leanX, 15 + bob, 2.5, 0, Math.PI * 2); x.fill();
          x.beginPath(); x.arc(cx - 5 + leanX, 15 + bob, 1.6, 0, Math.PI * 2); x.fill();
          x.globalAlpha = 1; x.shadowBlur = 0;
          x.fillStyle = '#ffaaaa';
          x.beginPath(); x.arc(cx + 3 + leanX, 15 + bob, 1, 0, Math.PI * 2); x.fill();
          x.fillStyle = '#2a1a1a';
          x.beginPath(); x.moveTo(cx + 1 + leanX, 19 + bob); x.lineTo(cx - 1 + leanX, 21.5 + bob); x.lineTo(cx + 3 + leanX, 21.5 + bob); x.fill();
        } else {
          x.fillStyle = '#1a0808';
          x.beginPath(); x.ellipse(cx - 4 + leanX, 15 + bob, 3.5, 4, 0, 0, Math.PI * 2); x.fill();
          x.beginPath(); x.ellipse(cx + 4 + leanX, 15 + bob, 3.5, 4, 0, 0, Math.PI * 2); x.fill();
          x.fillStyle = '#ff2222'; x.shadowColor = '#ff0000'; x.shadowBlur = 12;
          x.globalAlpha = 0.9;
          x.beginPath(); x.arc(cx - 4 + leanX, 15 + bob, 2.5, 0, Math.PI * 2); x.fill();
          x.beginPath(); x.arc(cx + 4 + leanX, 15 + bob, 2.5, 0, Math.PI * 2); x.fill();
          x.globalAlpha = 1; x.shadowBlur = 0;
          x.fillStyle = '#ffaaaa';
          x.beginPath(); x.arc(cx - 4 + leanX, 15 + bob, 1, 0, Math.PI * 2); x.fill();
          x.beginPath(); x.arc(cx + 4 + leanX, 15 + bob, 1, 0, Math.PI * 2); x.fill();
          x.fillStyle = '#2a1a1a';
          x.beginPath(); x.moveTo(cx + leanX, 19 + bob); x.lineTo(cx - 2 + leanX, 21.5 + bob); x.lineTo(cx + 2 + leanX, 21.5 + bob); x.fill();
        }
        x.fillStyle = bonL;
        for (let i = -3; i <= 3; i++) {
          x.fillRect(cx + i * 1.5 - 0.5 + leanX, 24 + bob, 1.2, 2.5);
        }
      } else if (dir === 'right') {
        const jawOpen = swingAngle * 3;
        x.fillStyle = bone;
        x.beginPath();
        x.moveTo(cx + 1 + leanX, 22 + bob); x.lineTo(cx + 2 + leanX, 27 + bob + jawOpen);
        x.lineTo(cx + 8 + leanX, 26 + bob + jawOpen); x.lineTo(cx + 8 + leanX, 22 + bob); x.fill();
        if (jawOpen > 0.5) {
          x.fillStyle = '#1a0808'; x.beginPath();
          x.ellipse(cx + 5 + leanX, 24 + bob + jawOpen * 0.3, 3, jawOpen * 0.4, 0, 0, Math.PI * 2); x.fill();
        }
        x.fillStyle = '#1a0808';
        x.beginPath(); x.ellipse(cx + 3 + leanX, 15 + bob, 3, 3.5, 0, 0, Math.PI * 2); x.fill();
        x.fillStyle = '#ff2222'; x.shadowColor = '#ff0000'; x.shadowBlur = 12;
        x.globalAlpha = 0.9;
        x.beginPath(); x.arc(cx + 3 + leanX, 15 + bob, 2.2, 0, Math.PI * 2); x.fill();
        x.globalAlpha = 1; x.shadowBlur = 0;
        x.fillStyle = '#ffaaaa';
        x.beginPath(); x.arc(cx + 3 + leanX, 15 + bob, 0.8, 0, Math.PI * 2); x.fill();
        x.fillStyle = bonL;
        for (let i = 0; i < 4; i++) {
          x.fillRect(cx + 2 + i * 1.5 + leanX, 24 + bob, 1.2, 2.5);
        }
      } else {
        // UP / UP_RIGHT (back)
        x.fillStyle = bonD; x.globalAlpha = 0.3;
        x.beginPath(); x.arc(cx, 15 + bob, 6, 0, Math.PI * 2); x.fill();
        x.globalAlpha = 1;
        x.strokeStyle = bonD; x.lineWidth = 0.6; x.globalAlpha = 0.5;
        x.beginPath(); x.moveTo(cx - 2, 9 + bob); x.lineTo(cx - 4, 14 + bob); x.lineTo(cx - 1, 18 + bob); x.stroke();
        x.globalAlpha = 1;
        x.fillStyle = bone;
        x.beginPath();
        x.moveTo(cx - 6, 23 + bob); x.lineTo(cx - 5, 26 + bob);
        x.lineTo(cx + 5, 26 + bob); x.lineTo(cx + 6, 23 + bob); x.fill();
        if (dir === 'up_right') {
          x.fillStyle = bone; x.globalAlpha = 0.5;
          x.beginPath(); x.arc(cx + 7, 18 + bob, 2.5, 0, Math.PI * 2); x.fill();
          x.globalAlpha = 1;
        }
      }

      atk[dir].push(c);
    }
  }
  setDirCache8(key, {
    down: dirs.down, down_right: dirs.down_right, right: dirs.right, up_right: dirs.up_right, up: dirs.up,
    atk_down: atk.down, atk_down_right: atk.down_right, atk_right: atk.right,
    atk_up_right: atk.up_right, atk_up: atk.up
  });
}

// ============================================================
//  GOLEM SPRITE (Crystal/stone with rune glow)
// ============================================================
function genGolem(key, mainC, lightC, darkC, glowC) {
  const dirs = { down: [], down_right: [], up: [], up_right: [], right: [] };
  for (const dir of ['down', 'down_right', 'right', 'up_right', 'up']) {
    for (let f = 0; f < 4; f++) {
      const c = makeCanvas(64, 72);
      const x = c.getContext('2d');
      const cx = 32, bob = Math.sin(f * Math.PI / 2) * 1.2;

      draw3DShadow(x, cx, 66, 20, 5);

      // Legs (same for all)
      drawCylinder(x, cx - 14, 48 + bob, 10, 16, mainC, lightC, darkC);
      drawCylinder(x, cx + 4, 48 + bob, 10, 16, mainC, lightC, darkC);
      x.fillStyle = darkC;
      x.beginPath(); x.roundRect(cx - 16, 63 + bob, 14, 4, 2); x.fill();
      x.beginPath(); x.roundRect(cx + 2, 63 + bob, 14, 4, 2); x.fill();
      addAO(x, cx - 9, 48 + bob, 6, 2);
      addAO(x, cx + 9, 48 + bob, 6, 2);

      // Body (same for all)
      const bg = x.createLinearGradient(cx - 18, 22, cx + 18, 52);
      bg.addColorStop(0, lightC); bg.addColorStop(0.3, mainC); bg.addColorStop(0.7, mainC); bg.addColorStop(1, darkC);
      x.fillStyle = bg;
      x.beginPath();
      x.moveTo(cx - 16, 50 + bob); x.lineTo(cx - 20, 28 + bob);
      x.lineTo(cx - 10, 20 + bob); x.lineTo(cx + 10, 20 + bob);
      x.lineTo(cx + 20, 28 + bob); x.lineTo(cx + 16, 50 + bob);
      x.fill();

      // Cracks (same for all)
      x.strokeStyle = darkC; x.lineWidth = 0.8; x.globalAlpha = 0.45;
      x.beginPath(); x.moveTo(cx - 8, 25 + bob); x.lineTo(cx - 14, 42 + bob); x.stroke();
      x.beginPath(); x.moveTo(cx + 6, 24 + bob); x.lineTo(cx + 12, 38 + bob); x.stroke();
      x.beginPath(); x.moveTo(cx - 2, 30 + bob); x.lineTo(cx - 5, 46 + bob); x.stroke();
      x.globalAlpha = 1;

      // Rune glow (front/right only, back shows back-rune)
      if (glowC) {
        x.globalAlpha = 0.55 + Math.sin(f * Math.PI / 2) * 0.3;
        x.strokeStyle = glowC; x.lineWidth = 2;
        x.shadowColor = glowC; x.shadowBlur = 10;
        if (dir === 'up' || dir === 'up_right') {
          // Back rune: simpler cross pattern
          x.beginPath(); x.moveTo(cx, 28 + bob); x.lineTo(cx, 42 + bob); x.stroke();
          x.beginPath(); x.moveTo(cx - 8, 35 + bob); x.lineTo(cx + 8, 35 + bob); x.stroke();
        } else {
          x.beginPath(); x.moveTo(cx - 6, 28 + bob); x.lineTo(cx, 40 + bob); x.lineTo(cx + 6, 28 + bob); x.stroke();
          x.beginPath(); x.moveTo(cx - 10, 36 + bob); x.lineTo(cx + 10, 36 + bob); x.stroke();
          x.beginPath(); x.arc(cx, 34 + bob, 3, 0, Math.PI * 2); x.stroke();
        }
        x.shadowBlur = 0; x.globalAlpha = 1;
      }

      // Arms (same for all)
      const as = Math.sin(f * Math.PI / 2) * 2.5;
      drawCylinder(x, cx - 28, 26 + bob + as, 10, 20, mainC, lightC, darkC);
      drawCylinder(x, cx + 18, 26 + bob - as, 10, 20, mainC, lightC, darkC);
      drawSphere(x, cx - 23, 48 + bob + as, 7, mainC, lightC, darkC);
      drawSphere(x, cx + 23, 48 + bob - as, 7, mainC, lightC, darkC);
      x.strokeStyle = darkC; x.lineWidth = 0.6; x.globalAlpha = 0.4;
      x.beginPath(); x.moveTo(cx - 25, 45 + bob + as); x.lineTo(cx - 21, 50 + bob + as); x.stroke();
      x.globalAlpha = 1;

      // Head (same shape for all)
      const hg = x.createRadialGradient(cx - 2, 14 + bob, 1, cx, 16 + bob, 10);
      hg.addColorStop(0, lightC); hg.addColorStop(1, mainC);
      x.fillStyle = hg;
      x.beginPath();
      x.moveTo(cx - 9, 10 + bob); x.lineTo(cx + 9, 10 + bob);
      x.lineTo(cx + 8, 24 + bob); x.lineTo(cx - 8, 24 + bob);
      x.fill();
      x.fillStyle = 'rgba(255,255,255,0.1)';
      x.fillRect(cx - 9, 10 + bob, 18, 3);

      // Eyes per direction
      if (dir === 'down' || dir === 'down_right') {
        x.fillStyle = glowC || '#ff4400';
        x.shadowColor = glowC || '#ff4400'; x.shadowBlur = 8;
        x.globalAlpha = 0.9;
        if (dir === 'down_right') {
          // 3/4 front-right: right eye full, left eye smaller
          x.fillRect(cx + 1, 14 + bob, 5, 4);
          x.fillRect(cx - 6, 14 + bob, 3, 3.5);
          x.globalAlpha = 1; x.shadowBlur = 0;
          x.fillStyle = '#ffffff'; x.globalAlpha = 0.4;
          x.fillRect(cx + 2, 15 + bob, 2, 2);
          x.fillRect(cx - 5, 15 + bob, 1.5, 1.5);
        } else {
          x.fillRect(cx - 6, 14 + bob, 4, 4);
          x.fillRect(cx + 2, 14 + bob, 4, 4);
          x.globalAlpha = 1; x.shadowBlur = 0;
          x.fillStyle = '#ffffff'; x.globalAlpha = 0.4;
          x.fillRect(cx - 5, 15 + bob, 2, 2);
          x.fillRect(cx + 3, 15 + bob, 2, 2);
        }
        x.globalAlpha = 1;
      } else if (dir === 'right') {
        x.fillStyle = glowC || '#ff4400';
        x.shadowColor = glowC || '#ff4400'; x.shadowBlur = 8;
        x.globalAlpha = 0.9;
        x.fillRect(cx + 1, 14 + bob, 5, 4);
        x.globalAlpha = 1; x.shadowBlur = 0;
        x.fillStyle = '#ffffff'; x.globalAlpha = 0.4;
        x.fillRect(cx + 2, 15 + bob, 2, 2);
        x.globalAlpha = 1;
      } else {
        // UP / UP_RIGHT: back of head
        x.fillStyle = darkC; x.globalAlpha = 0.2;
        x.fillRect(cx - 6, 12 + bob, 12, 8);
        x.globalAlpha = 1;
        if (dir === 'up_right') {
          // Slight glow visible from back-right angle
          x.fillStyle = glowC || '#ff4400'; x.globalAlpha = 0.3;
          x.shadowColor = glowC || '#ff4400'; x.shadowBlur = 5;
          x.fillRect(cx + 5, 14 + bob, 3, 3);
          x.shadowBlur = 0; x.globalAlpha = 1;
        }
      }

      // Shoulder highlight (same for all)
      x.fillStyle = 'rgba(255,255,255,0.1)';
      x.fillRect(cx - 16, 24 + bob, 8, 14);

      dirs[dir].push(c);
    }
  }

  // Attack frames - arms raised overhead smashing down
  const atk = {down: [], down_right: [], up: [], up_right: [], right: []};
  for (const dir of ['down', 'down_right', 'right', 'up_right', 'up']) {
    for (let f = 0; f < 4; f++) {
      const c = makeCanvas(64, 72);
      const x = c.getContext('2d');
      const cx = 32;
      const atkPhase = f / 3;
      const smashPhase = f <= 1 ? f / 1 : (3 - f) / 2;
      const armRaise = f <= 1 ? (1 - f) * 12 : 0;
      const armSmash = f >= 1 ? Math.sin((f - 1) / 2 * Math.PI) * 10 : 0;
      const rockY = f >= 2 ? 2 : 0;
      const bob = Math.sin(f * Math.PI / 2) * 1.2 + rockY;
      const leanX = dir === 'right' ? atkPhase * 3 : (dir === 'down_right' || dir === 'up_right') ? atkPhase * 2 : 0;
      const leanY = dir === 'down' ? atkPhase * 2 : dir === 'down_right' ? atkPhase * 1.5 : dir === 'up' ? -atkPhase * 2 : dir === 'up_right' ? -atkPhase * 1.5 : 0;

      draw3DShadow(x, cx + leanX, 66, 20 + armSmash * 0.3, 5 + armSmash * 0.2);

      // Ground impact effect
      if (f === 2) {
        x.strokeStyle = glowC || '#ff4400'; x.lineWidth = 2;
        x.globalAlpha = 0.5;
        x.beginPath(); x.arc(cx + leanX, 66, 18 + armSmash, 0, Math.PI * 2); x.stroke();
        x.globalAlpha = 1;
        // Debris particles
        x.fillStyle = mainC; x.globalAlpha = 0.6;
        for (let i = 0; i < 6; i++) {
          const pa = i * Math.PI / 3;
          const pr = 14 + i * 3;
          x.fillRect(cx + leanX + Math.cos(pa) * pr - 1.5, 62 - i * 2, 3, 3);
        }
        x.globalAlpha = 1;
      }

      // Legs (planted wide)
      drawCylinder(x, cx - 14 + leanX, 48 + bob + leanY, 10, 16, mainC, lightC, darkC);
      drawCylinder(x, cx + 4 + leanX, 48 + bob + leanY, 10, 16, mainC, lightC, darkC);
      x.fillStyle = darkC;
      x.beginPath(); x.roundRect(cx - 16 + leanX, 63 + bob + leanY, 14, 4, 2); x.fill();
      x.beginPath(); x.roundRect(cx + 2 + leanX, 63 + bob + leanY, 14, 4, 2); x.fill();

      // Body (rocking forward)
      const bg = x.createLinearGradient(cx - 18 + leanX, 22, cx + 18 + leanX, 52);
      bg.addColorStop(0, lightC); bg.addColorStop(0.3, mainC); bg.addColorStop(0.7, mainC); bg.addColorStop(1, darkC);
      x.fillStyle = bg;
      x.beginPath();
      x.moveTo(cx - 16 + leanX, 50 + bob + leanY); x.lineTo(cx - 20 + leanX, 28 + bob + leanY);
      x.lineTo(cx - 10 + leanX, 20 + bob + leanY); x.lineTo(cx + 10 + leanX, 20 + bob + leanY);
      x.lineTo(cx + 20 + leanX, 28 + bob + leanY); x.lineTo(cx + 16 + leanX, 50 + bob + leanY);
      x.fill();

      // Cracks
      x.strokeStyle = darkC; x.lineWidth = 0.8; x.globalAlpha = 0.45;
      x.beginPath(); x.moveTo(cx - 8 + leanX, 25 + bob + leanY); x.lineTo(cx - 14 + leanX, 42 + bob + leanY); x.stroke();
      x.beginPath(); x.moveTo(cx + 6 + leanX, 24 + bob + leanY); x.lineTo(cx + 12 + leanX, 38 + bob + leanY); x.stroke();
      x.globalAlpha = 1;

      // Rune glow (brighter during attack)
      if (glowC) {
        x.globalAlpha = 0.7 + Math.sin(atkPhase * Math.PI) * 0.3;
        x.strokeStyle = glowC; x.lineWidth = 2.5;
        x.shadowColor = glowC; x.shadowBlur = 14;
        if (dir === 'up' || dir === 'up_right') {
          x.beginPath(); x.moveTo(cx, 28 + bob + leanY); x.lineTo(cx, 42 + bob + leanY); x.stroke();
          x.beginPath(); x.moveTo(cx - 8, 35 + bob + leanY); x.lineTo(cx + 8, 35 + bob + leanY); x.stroke();
        } else {
          x.beginPath(); x.moveTo(cx - 6 + leanX, 28 + bob + leanY); x.lineTo(cx + leanX, 40 + bob + leanY); x.lineTo(cx + 6 + leanX, 28 + bob + leanY); x.stroke();
          x.beginPath(); x.moveTo(cx - 10 + leanX, 36 + bob + leanY); x.lineTo(cx + 10 + leanX, 36 + bob + leanY); x.stroke();
          x.beginPath(); x.arc(cx + leanX, 34 + bob + leanY, 3, 0, Math.PI * 2); x.stroke();
        }
        x.shadowBlur = 0; x.globalAlpha = 1;
      }

      // Arms raised overhead (wind-up) then smashing down
      const armY = 26 + bob + leanY - armRaise + armSmash;
      drawCylinder(x, cx - 28 + leanX, armY - 6, 10, 20, mainC, lightC, darkC);
      drawCylinder(x, cx + 18 + leanX, armY - 6, 10, 20, mainC, lightC, darkC);
      // Fists (larger, emphasized)
      drawSphere(x, cx - 23 + leanX, armY + 16, 8, mainC, lightC, darkC);
      drawSphere(x, cx + 23 + leanX, armY + 16, 8, mainC, lightC, darkC);

      // Fist glow on impact
      if (f === 2 && glowC) {
        x.fillStyle = glowC; x.globalAlpha = 0.4;
        x.shadowColor = glowC; x.shadowBlur = 12;
        x.beginPath(); x.arc(cx - 23 + leanX, armY + 16, 10, 0, Math.PI * 2); x.fill();
        x.beginPath(); x.arc(cx + 23 + leanX, armY + 16, 10, 0, Math.PI * 2); x.fill();
        x.globalAlpha = 1; x.shadowBlur = 0;
      }

      // Head
      const hg = x.createRadialGradient(cx - 2 + leanX, 14 + bob + leanY, 1, cx + leanX, 16 + bob + leanY, 10);
      hg.addColorStop(0, lightC); hg.addColorStop(1, mainC);
      x.fillStyle = hg;
      x.beginPath();
      x.moveTo(cx - 9 + leanX, 10 + bob + leanY); x.lineTo(cx + 9 + leanX, 10 + bob + leanY);
      x.lineTo(cx + 8 + leanX, 24 + bob + leanY); x.lineTo(cx - 8 + leanX, 24 + bob + leanY);
      x.fill();
      x.fillStyle = 'rgba(255,255,255,0.1)';
      x.fillRect(cx - 9 + leanX, 10 + bob + leanY, 18, 3);

      // Eyes (fiercer glow)
      if (dir === 'down' || dir === 'down_right') {
        x.fillStyle = glowC || '#ff4400';
        x.shadowColor = glowC || '#ff4400'; x.shadowBlur = 12;
        x.globalAlpha = 1;
        if (dir === 'down_right') {
          x.fillRect(cx + 1 + leanX, 14 + bob + leanY, 5, 4);
          x.fillRect(cx - 6 + leanX, 14 + bob + leanY, 3, 3.5);
          x.shadowBlur = 0;
          x.fillStyle = '#ffffff'; x.globalAlpha = 0.5;
          x.fillRect(cx + 2 + leanX, 15 + bob + leanY, 2, 2);
          x.fillRect(cx - 5 + leanX, 15 + bob + leanY, 1.5, 1.5);
        } else {
          x.fillRect(cx - 6 + leanX, 14 + bob + leanY, 4, 4);
          x.fillRect(cx + 2 + leanX, 14 + bob + leanY, 4, 4);
          x.shadowBlur = 0;
          x.fillStyle = '#ffffff'; x.globalAlpha = 0.5;
          x.fillRect(cx - 5 + leanX, 15 + bob + leanY, 2, 2);
          x.fillRect(cx + 3 + leanX, 15 + bob + leanY, 2, 2);
        }
        x.globalAlpha = 1;
      } else if (dir === 'right') {
        x.fillStyle = glowC || '#ff4400';
        x.shadowColor = glowC || '#ff4400'; x.shadowBlur = 12;
        x.globalAlpha = 1;
        x.fillRect(cx + 1 + leanX, 14 + bob + leanY, 5, 4);
        x.shadowBlur = 0;
        x.fillStyle = '#ffffff'; x.globalAlpha = 0.5;
        x.fillRect(cx + 2 + leanX, 15 + bob + leanY, 2, 2);
        x.globalAlpha = 1;
      } else {
        // UP / UP_RIGHT
        x.fillStyle = darkC; x.globalAlpha = 0.2;
        x.fillRect(cx - 6, 12 + bob + leanY, 12, 8);
        x.globalAlpha = 1;
        if (dir === 'up_right') {
          x.fillStyle = glowC || '#ff4400'; x.globalAlpha = 0.3;
          x.shadowColor = glowC || '#ff4400'; x.shadowBlur = 5;
          x.fillRect(cx + 5, 14 + bob + leanY, 3, 3);
          x.shadowBlur = 0; x.globalAlpha = 1;
        }
      }

      x.fillStyle = 'rgba(255,255,255,0.1)';
      x.fillRect(cx - 16 + leanX, 24 + bob + leanY, 8, 14);

      atk[dir].push(c);
    }
  }
  setDirCache8(key, {
    down: dirs.down, down_right: dirs.down_right, right: dirs.right, up_right: dirs.up_right, up: dirs.up,
    atk_down: atk.down, atk_down_right: atk.down_right, atk_right: atk.right,
    atk_up_right: atk.up_right, atk_up: atk.up
  });
}

// ============================================================
//  DRAGON SPRITE (Winged boss with scales and fire)
// ============================================================
function genDragon(key, mainC, lightC, darkC, wingC) {
  const dirs = { down: [], down_right: [], up: [], up_right: [], right: [] };
  for (const dir of ['down', 'down_right', 'right', 'up_right', 'up']) {
    for (let f = 0; f < 4; f++) {
      const c = makeCanvas(110, 96);
      const x = c.getContext('2d');
      const cx = 55, cy = 52, bob = Math.sin(f * Math.PI / 2) * 2.5;
      const wingFlap = Math.sin(f * Math.PI / 2) * 15;
      const wc = wingC || darkC;

      draw3DShadow(x, cx, 88, 34, 7);

      if (dir === 'right') {
        // === SIDE VIEW (original code) ===
        // Wings
        x.fillStyle = wc;
        x.beginPath();
        x.moveTo(cx - 12, cy - 14 + bob);
        x.bezierCurveTo(cx - 30, cy - 35 + wingFlap, cx - 48, cy - 30 + wingFlap, cx - 50, cy - 15 + wingFlap);
        x.bezierCurveTo(cx - 42, cy - 2, cx - 25, cy + 5, cx - 12, cy + bob);
        x.fill();
        x.beginPath();
        x.moveTo(cx + 12, cy - 14 + bob);
        x.bezierCurveTo(cx + 30, cy - 35 + wingFlap, cx + 48, cy - 30 + wingFlap, cx + 50, cy - 15 + wingFlap);
        x.bezierCurveTo(cx + 42, cy - 2, cx + 25, cy + 5, cx + 12, cy + bob);
        x.fill();
        x.strokeStyle = darkC; x.lineWidth = 1.2;
        for (let i = 0; i < 4; i++) {
          const t = (i + 1) / 5;
          x.beginPath(); x.moveTo(cx - 12, cy - 10 + bob);
          x.lineTo(cx - 18 - i * 9, cy - 28 + wingFlap * t); x.stroke();
          x.beginPath(); x.moveTo(cx + 12, cy - 10 + bob);
          x.lineTo(cx + 18 + i * 9, cy - 28 + wingFlap * t); x.stroke();
        }
        x.fillStyle = 'rgba(255,255,255,0.08)';
        x.beginPath();
        x.moveTo(cx - 12, cy - 14 + bob);
        x.bezierCurveTo(cx - 28, cy - 30 + wingFlap, cx - 38, cy - 22 + wingFlap, cx - 35, cy - 10 + wingFlap);
        x.bezierCurveTo(cx - 25, cy - 5, cx - 18, cy, cx - 12, cy + bob);
        x.fill();
        // Tail
        x.strokeStyle = mainC; x.lineWidth = 8; x.lineCap = 'round';
        x.beginPath();
        x.moveTo(cx - 10, cy + 14 + bob);
        x.bezierCurveTo(cx - 25, cy + 22 + bob, cx - 38, cy + 15 + bob, cx - 42, cy + 6 + Math.sin(f * Math.PI / 2) * 4);
        x.stroke();
        x.fillStyle = darkC;
        x.beginPath(); x.moveTo(cx - 40, cy + 5 + bob);
        x.lineTo(cx - 48, cy + 1 + bob); x.lineTo(cx - 38, cy + 9 + bob); x.fill();
        x.beginPath(); x.moveTo(cx - 33, cy + 12 + bob);
        x.lineTo(cx - 38, cy + 6 + bob); x.lineTo(cx - 30, cy + 14 + bob); x.fill();
        // Legs
        drawCylinder(x, cx - 12, cy + 12 + bob, 9, 20, mainC, lightC, darkC);
        drawCylinder(x, cx + 4, cy + 12 + bob, 9, 20, mainC, lightC, darkC);
        x.fillStyle = '#333333';
        for (let ci = -1; ci <= 1; ci++) {
          x.beginPath(); x.moveTo(cx - 8 + ci * 4, cy + 32 + bob);
          x.lineTo(cx - 9 + ci * 4, cy + 37 + bob); x.lineTo(cx - 7 + ci * 4, cy + 37 + bob); x.fill();
          x.beginPath(); x.moveTo(cx + 8 + ci * 4, cy + 32 + bob);
          x.lineTo(cx + 7 + ci * 4, cy + 37 + bob); x.lineTo(cx + 9 + ci * 4, cy + 37 + bob); x.fill();
        }
        // Body
        const bodyG = x.createRadialGradient(cx - 5, cy - 5 + bob, 4, cx, cy + bob, 22);
        bodyG.addColorStop(0, lightC); bodyG.addColorStop(0.45, mainC); bodyG.addColorStop(1, darkC);
        x.fillStyle = bodyG;
        x.beginPath(); x.ellipse(cx, cy + bob, 20, 17, 0, 0, Math.PI * 2); x.fill();
        x.fillStyle = lightC; x.globalAlpha = 0.25;
        x.beginPath(); x.ellipse(cx + 2, cy + 4 + bob, 10, 10, 0, 0, Math.PI * 2); x.fill();
        x.globalAlpha = 1;
        // Scales
        x.strokeStyle = darkC; x.lineWidth = 0.7; x.globalAlpha = 0.4;
        for (let sy = -10; sy < 12; sy += 4) {
          for (let sx = -14; sx < 14; sx += 5) {
            x.beginPath(); x.arc(cx + sx, cy + sy + bob, 2.5, 0, Math.PI); x.stroke();
          }
        }
        x.globalAlpha = 1;
        addRimLight(x, cx, cy + bob, 19, lightC, 0.28);
        // Neck
        const ng = x.createLinearGradient(cx + 5, cy - 18, cx + 22, cy - 8);
        ng.addColorStop(0, lightC); ng.addColorStop(1, mainC);
        x.fillStyle = ng;
        x.beginPath();
        x.moveTo(cx + 10, cy - 10 + bob);
        x.quadraticCurveTo(cx + 24, cy - 24 + bob, cx + 20, cy - 32 + bob);
        x.lineTo(cx + 10, cy - 28 + bob);
        x.quadraticCurveTo(cx + 14, cy - 18 + bob, cx + 4, cy - 10 + bob);
        x.fill();
        // Head
        drawSphere(x, cx + 20, cy - 34 + bob, 12, mainC, lightC, darkC);
        // Horns
        x.fillStyle = '#444444';
        x.beginPath(); x.moveTo(cx + 13, cy - 42 + bob);
        x.bezierCurveTo(cx + 10, cy - 48 + bob, cx + 7, cy - 52 + bob, cx + 8, cy - 54 + bob);
        x.lineTo(cx + 15, cy - 40 + bob); x.fill();
        x.beginPath(); x.moveTo(cx + 24, cy - 42 + bob);
        x.bezierCurveTo(cx + 28, cy - 48 + bob, cx + 31, cy - 52 + bob, cx + 30, cy - 54 + bob);
        x.lineTo(cx + 22, cy - 40 + bob); x.fill();
        x.fillStyle = 'rgba(255,255,255,0.15)';
        x.beginPath(); x.moveTo(cx + 13, cy - 42 + bob); x.lineTo(cx + 9, cy - 51 + bob);
        x.lineTo(cx + 14, cy - 41 + bob); x.fill();
        // Snout/nostril
        x.fillStyle = darkC;
        x.beginPath(); x.ellipse(cx + 30, cy - 32 + bob, 8, 5.5, 0.3, 0, Math.PI * 2); x.fill();
        x.fillStyle = '#ff4400'; x.shadowColor = '#ff4400'; x.shadowBlur = 8;
        x.globalAlpha = 0.55 + Math.sin(f * Math.PI) * 0.3;
        x.beginPath(); x.arc(cx + 35, cy - 32 + bob, 3.5, 0, Math.PI * 2); x.fill();
        x.beginPath(); x.arc(cx + 37 + Math.sin(f) * 2, cy - 34 + bob, 1.5, 0, Math.PI * 2); x.fill();
        x.globalAlpha = 1; x.shadowBlur = 0;
        // Eye
        x.fillStyle = '#ff8800'; x.shadowColor = '#ff8800'; x.shadowBlur = 6;
        x.beginPath(); x.ellipse(cx + 18, cy - 36 + bob, 4.5, 3.5, 0, 0, Math.PI * 2); x.fill();
        x.shadowBlur = 0;
        const eyeG = x.createRadialGradient(cx + 18, cy - 36 + bob, 0.5, cx + 18, cy - 36 + bob, 4);
        eyeG.addColorStop(0, '#ffee44'); eyeG.addColorStop(0.4, '#ff8800'); eyeG.addColorStop(1, '#882200');
        x.fillStyle = eyeG;
        x.beginPath(); x.ellipse(cx + 18, cy - 36 + bob, 4.5, 3.5, 0, 0, Math.PI * 2); x.fill();
        x.fillStyle = '#111111';
        x.beginPath(); x.ellipse(cx + 19, cy - 36 + bob, 1.5, 3, 0, 0, Math.PI * 2); x.fill();
        x.fillStyle = '#ffffff';
        x.beginPath(); x.arc(cx + 17, cy - 38 + bob, 1.5, 0, Math.PI * 2); x.fill();
        // Teeth
        x.fillStyle = '#eeeeee'; x.globalAlpha = 0.7;
        for (let i = 0; i < 4; i++) {
          x.beginPath(); x.moveTo(cx + 25 + i * 3, cy - 28 + bob);
          x.lineTo(cx + 24 + i * 3, cy - 25 + bob); x.lineTo(cx + 26 + i * 3, cy - 25 + bob); x.fill();
        }
        x.globalAlpha = 1;

      } else if (dir === 'down' || dir === 'down_right') {
        // === FRONT VIEW (and 3/4 front) ===
        // Wings (spread to both sides)
        x.fillStyle = wc;
        x.beginPath();
        x.moveTo(cx - 14, cy - 12 + bob);
        x.bezierCurveTo(cx - 34, cy - 34 + wingFlap, cx - 50, cy - 28 + wingFlap, cx - 52, cy - 12 + wingFlap);
        x.bezierCurveTo(cx - 44, cy, cx - 26, cy + 6, cx - 14, cy + bob);
        x.fill();
        x.beginPath();
        x.moveTo(cx + 14, cy - 12 + bob);
        x.bezierCurveTo(cx + 34, cy - 34 + wingFlap, cx + 50, cy - 28 + wingFlap, cx + 52, cy - 12 + wingFlap);
        x.bezierCurveTo(cx + 44, cy, cx + 26, cy + 6, cx + 14, cy + bob);
        x.fill();
        // Wing bones
        x.strokeStyle = darkC; x.lineWidth = 1.2;
        for (let i = 0; i < 4; i++) {
          const t = (i + 1) / 5;
          x.beginPath(); x.moveTo(cx - 14, cy - 8 + bob);
          x.lineTo(cx - 20 - i * 9, cy - 26 + wingFlap * t); x.stroke();
          x.beginPath(); x.moveTo(cx + 14, cy - 8 + bob);
          x.lineTo(cx + 20 + i * 9, cy - 26 + wingFlap * t); x.stroke();
        }
        // Tail (behind, poking up or to side)
        x.strokeStyle = mainC; x.lineWidth = 7; x.lineCap = 'round';
        x.beginPath();
        x.moveTo(cx, cy + 16 + bob);
        x.bezierCurveTo(cx - 10, cy + 24 + bob, cx - 16, cy + 28 + bob, cx - 20 + Math.sin(f * Math.PI / 2) * 5, cy + 22 + bob);
        x.stroke();
        // Legs
        drawCylinder(x, cx - 12, cy + 12 + bob, 9, 20, mainC, lightC, darkC);
        drawCylinder(x, cx + 4, cy + 12 + bob, 9, 20, mainC, lightC, darkC);
        x.fillStyle = '#333333';
        for (let ci = -1; ci <= 1; ci++) {
          x.beginPath(); x.moveTo(cx - 8 + ci * 4, cy + 32 + bob);
          x.lineTo(cx - 9 + ci * 4, cy + 37 + bob); x.lineTo(cx - 7 + ci * 4, cy + 37 + bob); x.fill();
          x.beginPath(); x.moveTo(cx + 8 + ci * 4, cy + 32 + bob);
          x.lineTo(cx + 7 + ci * 4, cy + 37 + bob); x.lineTo(cx + 9 + ci * 4, cy + 37 + bob); x.fill();
        }
        // Body
        const bodyGf = x.createRadialGradient(cx, cy - 5 + bob, 4, cx, cy + bob, 22);
        bodyGf.addColorStop(0, lightC); bodyGf.addColorStop(0.45, mainC); bodyGf.addColorStop(1, darkC);
        x.fillStyle = bodyGf;
        x.beginPath(); x.ellipse(cx, cy + bob, 20, 17, 0, 0, Math.PI * 2); x.fill();
        // Belly lighter
        x.fillStyle = lightC; x.globalAlpha = 0.25;
        x.beginPath(); x.ellipse(cx, cy + 4 + bob, 10, 10, 0, 0, Math.PI * 2); x.fill();
        x.globalAlpha = 1;
        // Scales
        x.strokeStyle = darkC; x.lineWidth = 0.7; x.globalAlpha = 0.4;
        for (let sy = -10; sy < 12; sy += 4) {
          for (let sx = -14; sx < 14; sx += 5) {
            x.beginPath(); x.arc(cx + sx, cy + sy + bob, 2.5, 0, Math.PI); x.stroke();
          }
        }
        x.globalAlpha = 1;
        addRimLight(x, cx, cy + bob, 19, lightC, 0.28);
        // Neck (coming up from body center)
        const ngf = x.createLinearGradient(cx - 5, cy - 16, cx + 5, cy - 8);
        ngf.addColorStop(0, lightC); ngf.addColorStop(1, mainC);
        x.fillStyle = ngf;
        x.beginPath();
        x.moveTo(cx - 6, cy - 10 + bob);
        x.quadraticCurveTo(cx - 8, cy - 22 + bob, cx, cy - 28 + bob);
        x.quadraticCurveTo(cx + 8, cy - 22 + bob, cx + 6, cy - 10 + bob);
        x.fill();
        // Head (front-facing)
        drawSphere(x, cx, cy - 30 + bob, 12, mainC, lightC, darkC);
        // Horns (symmetric)
        x.fillStyle = '#444444';
        x.beginPath(); x.moveTo(cx - 8, cy - 38 + bob);
        x.bezierCurveTo(cx - 14, cy - 48 + bob, cx - 16, cy - 52 + bob, cx - 12, cy - 54 + bob);
        x.lineTo(cx - 5, cy - 36 + bob); x.fill();
        x.beginPath(); x.moveTo(cx + 8, cy - 38 + bob);
        x.bezierCurveTo(cx + 14, cy - 48 + bob, cx + 16, cy - 52 + bob, cx + 12, cy - 54 + bob);
        x.lineTo(cx + 5, cy - 36 + bob); x.fill();
        // Snout (short from front)
        x.fillStyle = darkC;
        x.beginPath(); x.ellipse(cx, cy - 24 + bob, 7, 4, 0, 0, Math.PI * 2); x.fill();
        // Nostrils
        x.fillStyle = '#ff4400'; x.shadowColor = '#ff4400'; x.shadowBlur = 6;
        x.globalAlpha = 0.5 + Math.sin(f * Math.PI) * 0.3;
        x.beginPath(); x.arc(cx - 3, cy - 24 + bob, 2, 0, Math.PI * 2); x.fill();
        x.beginPath(); x.arc(cx + 3, cy - 24 + bob, 2, 0, Math.PI * 2); x.fill();
        x.globalAlpha = 1; x.shadowBlur = 0;
        // Eyes
        if (dir === 'down_right') {
          // 3/4 front-right: right eye full, left eye smaller
          [{ ox: 5, sz: 4, szY: 3 }, { ox: -8, sz: 3, szY: 2.2 }].forEach(({ ox, sz, szY }) => {
            x.fillStyle = '#ff8800'; x.shadowColor = '#ff8800'; x.shadowBlur = 6;
            x.beginPath(); x.ellipse(cx + ox, cy - 32 + bob, sz, szY, 0, 0, Math.PI * 2); x.fill();
            x.shadowBlur = 0;
            const eg = x.createRadialGradient(cx + ox, cy - 32 + bob, 0.5, cx + ox, cy - 32 + bob, sz);
            eg.addColorStop(0, '#ffee44'); eg.addColorStop(0.4, '#ff8800'); eg.addColorStop(1, '#882200');
            x.fillStyle = eg;
            x.beginPath(); x.ellipse(cx + ox, cy - 32 + bob, sz, szY, 0, 0, Math.PI * 2); x.fill();
            x.fillStyle = '#111111';
            x.beginPath(); x.ellipse(cx + ox, cy - 32 + bob, sz * 0.3, szY * 0.8, 0, 0, Math.PI * 2); x.fill();
            x.fillStyle = '#ffffff';
            x.beginPath(); x.arc(cx + ox - 1, cy - 33.5 + bob, sz * 0.3, 0, Math.PI * 2); x.fill();
          });
        } else {
          [-7, 7].forEach(ox => {
            x.fillStyle = '#ff8800'; x.shadowColor = '#ff8800'; x.shadowBlur = 6;
            x.beginPath(); x.ellipse(cx + ox, cy - 32 + bob, 4, 3, 0, 0, Math.PI * 2); x.fill();
            x.shadowBlur = 0;
            const eg = x.createRadialGradient(cx + ox, cy - 32 + bob, 0.5, cx + ox, cy - 32 + bob, 3.5);
            eg.addColorStop(0, '#ffee44'); eg.addColorStop(0.4, '#ff8800'); eg.addColorStop(1, '#882200');
            x.fillStyle = eg;
            x.beginPath(); x.ellipse(cx + ox, cy - 32 + bob, 4, 3, 0, 0, Math.PI * 2); x.fill();
            x.fillStyle = '#111111';
            x.beginPath(); x.ellipse(cx + ox, cy - 32 + bob, 1.2, 2.5, 0, 0, Math.PI * 2); x.fill();
            x.fillStyle = '#ffffff';
            x.beginPath(); x.arc(cx + ox - 1, cy - 33.5 + bob, 1.2, 0, Math.PI * 2); x.fill();
          });
        }
        // Teeth (front view)
        x.fillStyle = '#eeeeee'; x.globalAlpha = 0.7;
        for (let i = -2; i <= 2; i++) {
          x.beginPath(); x.moveTo(cx + i * 3, cy - 22 + bob);
          x.lineTo(cx + i * 3 - 1, cy - 19 + bob); x.lineTo(cx + i * 3 + 1, cy - 19 + bob); x.fill();
        }
        x.globalAlpha = 1;

      } else {
        // === BACK VIEW (UP / UP_RIGHT) ===
        // Wings (from behind)
        x.fillStyle = wc;
        x.beginPath();
        x.moveTo(cx - 14, cy - 12 + bob);
        x.bezierCurveTo(cx - 34, cy - 34 + wingFlap, cx - 50, cy - 28 + wingFlap, cx - 52, cy - 12 + wingFlap);
        x.bezierCurveTo(cx - 44, cy, cx - 26, cy + 6, cx - 14, cy + bob);
        x.fill();
        x.beginPath();
        x.moveTo(cx + 14, cy - 12 + bob);
        x.bezierCurveTo(cx + 34, cy - 34 + wingFlap, cx + 50, cy - 28 + wingFlap, cx + 52, cy - 12 + wingFlap);
        x.bezierCurveTo(cx + 44, cy, cx + 26, cy + 6, cx + 14, cy + bob);
        x.fill();
        x.strokeStyle = darkC; x.lineWidth = 1.2;
        for (let i = 0; i < 4; i++) {
          const t = (i + 1) / 5;
          x.beginPath(); x.moveTo(cx - 14, cy - 8 + bob);
          x.lineTo(cx - 20 - i * 9, cy - 26 + wingFlap * t); x.stroke();
          x.beginPath(); x.moveTo(cx + 14, cy - 8 + bob);
          x.lineTo(cx + 20 + i * 9, cy - 26 + wingFlap * t); x.stroke();
        }
        // Tail (visible going down/away)
        x.strokeStyle = mainC; x.lineWidth = 8; x.lineCap = 'round';
        x.beginPath();
        x.moveTo(cx, cy + 16 + bob);
        x.bezierCurveTo(cx, cy + 26 + bob, cx + Math.sin(f * Math.PI / 2) * 8, cy + 34 + bob, cx + Math.sin(f * Math.PI / 2) * 12, cy + 38 + bob);
        x.stroke();
        // Tail spikes
        x.fillStyle = darkC;
        const tx = cx + Math.sin(f * Math.PI / 2) * 12, ty = cy + 38 + bob;
        x.beginPath(); x.moveTo(tx - 3, ty); x.lineTo(tx, ty + 5); x.lineTo(tx + 3, ty); x.fill();
        // Legs
        drawCylinder(x, cx - 12, cy + 12 + bob, 9, 20, mainC, lightC, darkC);
        drawCylinder(x, cx + 4, cy + 12 + bob, 9, 20, mainC, lightC, darkC);
        x.fillStyle = '#333333';
        for (let ci = -1; ci <= 1; ci++) {
          x.beginPath(); x.moveTo(cx - 8 + ci * 4, cy + 32 + bob);
          x.lineTo(cx - 9 + ci * 4, cy + 37 + bob); x.lineTo(cx - 7 + ci * 4, cy + 37 + bob); x.fill();
          x.beginPath(); x.moveTo(cx + 8 + ci * 4, cy + 32 + bob);
          x.lineTo(cx + 7 + ci * 4, cy + 37 + bob); x.lineTo(cx + 9 + ci * 4, cy + 37 + bob); x.fill();
        }
        // Body
        const bodyGb = x.createRadialGradient(cx, cy - 5 + bob, 4, cx, cy + bob, 22);
        bodyGb.addColorStop(0, lightC); bodyGb.addColorStop(0.45, mainC); bodyGb.addColorStop(1, darkC);
        x.fillStyle = bodyGb;
        x.beginPath(); x.ellipse(cx, cy + bob, 20, 17, 0, 0, Math.PI * 2); x.fill();
        // Scales on back
        x.strokeStyle = darkC; x.lineWidth = 0.7; x.globalAlpha = 0.4;
        for (let sy = -10; sy < 12; sy += 4) {
          for (let sx = -14; sx < 14; sx += 5) {
            x.beginPath(); x.arc(cx + sx, cy + sy + bob, 2.5, 0, Math.PI); x.stroke();
          }
        }
        x.globalAlpha = 1;
        // Dorsal spines
        x.fillStyle = darkC;
        for (let i = -3; i <= 1; i++) {
          x.beginPath();
          x.moveTo(cx + i * 4, cy + i * 3 + bob - 2);
          x.lineTo(cx + i * 4 - 2, cy + i * 3 + bob + 3);
          x.lineTo(cx + i * 4 + 2, cy + i * 3 + bob + 3);
          x.fill();
        }
        addRimLight(x, cx, cy + bob, 19, lightC, 0.28);
        // Neck (from behind, going up)
        const ngb = x.createLinearGradient(cx - 5, cy - 16, cx + 5, cy - 8);
        ngb.addColorStop(0, mainC); ngb.addColorStop(1, darkC);
        x.fillStyle = ngb;
        x.beginPath();
        x.moveTo(cx - 6, cy - 10 + bob);
        x.quadraticCurveTo(cx - 8, cy - 22 + bob, cx, cy - 28 + bob);
        x.quadraticCurveTo(cx + 8, cy - 22 + bob, cx + 6, cy - 10 + bob);
        x.fill();
        // Back of head
        drawSphere(x, cx, cy - 30 + bob, 12, mainC, lightC, darkC);
        // Horns (from behind)
        x.fillStyle = '#444444';
        x.beginPath(); x.moveTo(cx - 8, cy - 38 + bob);
        x.bezierCurveTo(cx - 14, cy - 48 + bob, cx - 16, cy - 52 + bob, cx - 12, cy - 54 + bob);
        x.lineTo(cx - 5, cy - 36 + bob); x.fill();
        x.beginPath(); x.moveTo(cx + 8, cy - 38 + bob);
        x.bezierCurveTo(cx + 14, cy - 48 + bob, cx + 16, cy - 52 + bob, cx + 12, cy - 54 + bob);
        x.lineTo(cx + 5, cy - 36 + bob); x.fill();
        // Back of head highlight
        x.fillStyle = 'rgba(255,255,255,0.1)';
        x.beginPath(); x.arc(cx, cy - 30 + bob, 8, 0, Math.PI * 2); x.fill();
      }

      dirs[dir].push(c);
    }
  }
  // Dragon attack frames - fire breath, wings spread wide
  const atkDrg = {down: [], down_right: [], up: [], up_right: [], right: []};
  for (const dir of ['down', 'down_right', 'right', 'up_right', 'up']) {
    for (let f = 0; f < 4; f++) {
      const c = makeCanvas(110, 96);
      const x = c.getContext('2d');
      const cx = 55, cy = 52;
      const atkPhase = f / 3;
      const bob = Math.sin(atkPhase * Math.PI) * 2;
      const wingFlap = Math.sin(atkPhase * Math.PI) * 20 + 8;
      const wc = wingC || darkC;
      const fireInt = Math.sin(atkPhase * Math.PI);
      draw3DShadow(x, cx, 88, 34 + fireInt * 4, 7);
      // Wings spread wide (all dirs)
      x.fillStyle = wc;
      x.beginPath(); x.moveTo(cx-14,cy-12+bob); x.bezierCurveTo(cx-38,cy-38+wingFlap,cx-55,cy-32+wingFlap,cx-55,cy-14+wingFlap); x.bezierCurveTo(cx-46,cy,cx-26,cy+6,cx-14,cy+bob); x.fill();
      x.beginPath(); x.moveTo(cx+14,cy-12+bob); x.bezierCurveTo(cx+38,cy-38+wingFlap,cx+55,cy-32+wingFlap,cx+55,cy-14+wingFlap); x.bezierCurveTo(cx+46,cy,cx+26,cy+6,cx+14,cy+bob); x.fill();
      x.strokeStyle = darkC; x.lineWidth = 1.4;
      for(let i=0;i<4;i++){const t=(i+1)/5;x.beginPath();x.moveTo(cx-14,cy-10+bob);x.lineTo(cx-22-i*10,cy-32+wingFlap*t);x.stroke();x.beginPath();x.moveTo(cx+14,cy-10+bob);x.lineTo(cx+22+i*10,cy-32+wingFlap*t);x.stroke();}
      // Tail per direction
      x.strokeStyle=mainC; x.lineWidth=8; x.lineCap='round';
      if(dir==='right'){x.beginPath();x.moveTo(cx-10,cy+14+bob);x.bezierCurveTo(cx-25,cy+22+bob,cx-38,cy+15+bob,cx-42,cy+6+bob);x.stroke();x.fillStyle=darkC;x.beginPath();x.moveTo(cx-40,cy+5+bob);x.lineTo(cx-48,cy+1+bob);x.lineTo(cx-38,cy+9+bob);x.fill();}
      else if(dir==='down'||dir==='down_right'){x.beginPath();x.moveTo(cx,cy+16+bob);x.bezierCurveTo(cx-10,cy+24+bob,cx-16,cy+28+bob,cx-20,cy+22+bob);x.stroke();}
      else{x.beginPath();x.moveTo(cx,cy+16+bob);x.bezierCurveTo(cx,cy+26+bob,cx+atkPhase*8,cy+34+bob,cx+atkPhase*12,cy+38+bob);x.stroke();x.fillStyle=darkC;const ttx=cx+atkPhase*12,tty=cy+38+bob;x.beginPath();x.moveTo(ttx-3,tty);x.lineTo(ttx,tty+5);x.lineTo(ttx+3,tty);x.fill();}
      // Legs
      drawCylinder(x,cx-12,cy+12+bob,9,20,mainC,lightC,darkC);
      drawCylinder(x,cx+4,cy+12+bob,9,20,mainC,lightC,darkC);
      x.fillStyle='#333333';
      for(let ci=-1;ci<=1;ci++){x.beginPath();x.moveTo(cx-8+ci*4,cy+32+bob);x.lineTo(cx-9+ci*4,cy+37+bob);x.lineTo(cx-7+ci*4,cy+37+bob);x.fill();x.beginPath();x.moveTo(cx+8+ci*4,cy+32+bob);x.lineTo(cx+7+ci*4,cy+37+bob);x.lineTo(cx+9+ci*4,cy+37+bob);x.fill();}
      // Body
      const bdG=x.createRadialGradient(cx-5,cy-5+bob,4,cx,cy+bob,22);bdG.addColorStop(0,lightC);bdG.addColorStop(0.45,mainC);bdG.addColorStop(1,darkC);
      x.fillStyle=bdG;x.beginPath();x.ellipse(cx,cy+bob,20,17,0,0,Math.PI*2);x.fill();
      x.strokeStyle=darkC;x.lineWidth=0.7;x.globalAlpha=0.4;
      for(let sy=-10;sy<12;sy+=4)for(let sx=-14;sx<14;sx+=5){x.beginPath();x.arc(cx+sx,cy+sy+bob,2.5,0,Math.PI);x.stroke();}
      x.globalAlpha=1;addRimLight(x,cx,cy+bob,19,lightC,0.28);
      if(dir==='right'){
        const ne=atkPhase*6;const ng=x.createLinearGradient(cx+5,cy-18,cx+28+ne,cy-8);ng.addColorStop(0,lightC);ng.addColorStop(1,mainC);
        x.fillStyle=ng;x.beginPath();x.moveTo(cx+10,cy-10+bob);x.quadraticCurveTo(cx+28+ne,cy-28+bob,cx+24+ne,cy-36+bob);x.lineTo(cx+14+ne,cy-32+bob);x.quadraticCurveTo(cx+18+ne*0.5,cy-18+bob,cx+4,cy-10+bob);x.fill();
        const hx=cx+24+ne,hy=cy-38+bob;drawSphere(x,hx,hy,12,mainC,lightC,darkC);
        x.fillStyle='#444444';x.beginPath();x.moveTo(hx-7,hy-8);x.bezierCurveTo(hx-10,hy-14,hx-7,hy-18,hx-8,hy-20);x.lineTo(hx-5,hy-6);x.fill();
        x.beginPath();x.moveTo(hx+4,hy-8);x.bezierCurveTo(hx+8,hy-14,hx+11,hy-18,hx+10,hy-20);x.lineTo(hx+2,hy-6);x.fill();
        const jw=fireInt*8;x.fillStyle=darkC;x.beginPath();x.ellipse(hx+8,hy-jw*0.3,8,5.5,0.3,0,Math.PI*2);x.fill();
        x.fillStyle=colorShift(darkC,-20);x.beginPath();x.ellipse(hx+7,hy+4+jw*0.4,7,4,0.3,0,Math.PI*2);x.fill();
        if(jw>1){x.fillStyle='#ff4400';x.globalAlpha=0.6;x.beginPath();x.ellipse(hx+7,hy+2,6,jw*0.4,0.3,0,Math.PI*2);x.fill();x.globalAlpha=1;}
        if(f>=1){const fl=fireInt*25;const fg=x.createLinearGradient(hx+12,hy,hx+12+fl,hy);fg.addColorStop(0,'#ffff00');fg.addColorStop(0.3,'#ff8800');fg.addColorStop(0.6,'#ff4400');fg.addColorStop(1,'rgba(255,0,0,0)');x.fillStyle=fg;x.globalAlpha=0.7+fireInt*0.3;x.beginPath();x.moveTo(hx+12,hy-2);x.lineTo(hx+12+fl,hy-6-fl*0.15);x.lineTo(hx+12+fl,hy+6+fl*0.15);x.lineTo(hx+12,hy+4);x.fill();x.fillStyle='#ffcc00';x.globalAlpha=0.5;for(let i=0;i<5;i++){x.beginPath();x.arc(hx+14+i*fl*0.2,hy+(Math.random()-0.5)*(4+i*2),1.5+Math.random(),0,Math.PI*2);x.fill();}x.globalAlpha=1;}
        x.fillStyle='#ff4400';x.shadowColor='#ff4400';x.shadowBlur=10;x.beginPath();x.ellipse(hx-2,hy-2,4.5,3.5,0,0,Math.PI*2);x.fill();x.shadowBlur=0;
        const eyG=x.createRadialGradient(hx-2,hy-2,0.5,hx-2,hy-2,4);eyG.addColorStop(0,'#ffff44');eyG.addColorStop(0.4,'#ff8800');eyG.addColorStop(1,'#882200');
        x.fillStyle=eyG;x.beginPath();x.ellipse(hx-2,hy-2,4.5,3.5,0,0,Math.PI*2);x.fill();x.fillStyle='#111';x.beginPath();x.ellipse(hx-1,hy-2,1.5,3,0,0,Math.PI*2);x.fill();x.fillStyle='#fff';x.beginPath();x.arc(hx-3,hy-4,1.5,0,Math.PI*2);x.fill();
        x.fillStyle='#eee';x.globalAlpha=0.7;for(let i=0;i<4;i++){x.beginPath();x.moveTo(hx+3+i*3,hy+jw*0.1);x.lineTo(hx+2+i*3,hy+3+jw*0.2);x.lineTo(hx+4+i*3,hy+3+jw*0.2);x.fill();}x.globalAlpha=1;
      }else if(dir==='down'||dir==='down_right'){
        const nd=atkPhase*4;const ngf=x.createLinearGradient(cx-5,cy-16,cx+5,cy-8);ngf.addColorStop(0,lightC);ngf.addColorStop(1,mainC);
        x.fillStyle=ngf;x.beginPath();x.moveTo(cx-6,cy-10+bob);x.quadraticCurveTo(cx-8,cy-22+bob+nd,cx,cy-26+bob+nd);x.quadraticCurveTo(cx+8,cy-22+bob+nd,cx+6,cy-10+bob);x.fill();
        const hfy=cy-28+bob+nd;drawSphere(x,cx,hfy,12,mainC,lightC,darkC);
        x.fillStyle='#444444';x.beginPath();x.moveTo(cx-8,hfy-8);x.bezierCurveTo(cx-14,hfy-18,cx-16,hfy-22,cx-12,hfy-24);x.lineTo(cx-5,hfy-6);x.fill();
        x.beginPath();x.moveTo(cx+8,hfy-8);x.bezierCurveTo(cx+14,hfy-18,cx+16,hfy-22,cx+12,hfy-24);x.lineTo(cx+5,hfy-6);x.fill();
        const jwF=fireInt*7;x.fillStyle=darkC;x.beginPath();x.ellipse(cx,hfy+4-jwF*0.2,7,4,0,0,Math.PI*2);x.fill();
        x.fillStyle=colorShift(darkC,-20);x.beginPath();x.ellipse(cx,hfy+8+jwF*0.4,6,3.5,0,0,Math.PI*2);x.fill();
        if(f>=1){const fl=fireInt*20;const fg=x.createLinearGradient(cx,hfy+10,cx,hfy+10+fl);fg.addColorStop(0,'#ffff00');fg.addColorStop(0.3,'#ff8800');fg.addColorStop(0.6,'#ff4400');fg.addColorStop(1,'rgba(255,0,0,0)');x.fillStyle=fg;x.globalAlpha=0.7+fireInt*0.3;x.beginPath();x.moveTo(cx-3,hfy+10);x.lineTo(cx-8-fl*0.15,hfy+10+fl);x.lineTo(cx+8+fl*0.15,hfy+10+fl);x.lineTo(cx+3,hfy+10);x.fill();x.fillStyle='#ffcc00';x.globalAlpha=0.5;for(let i=0;i<5;i++){x.beginPath();x.arc(cx+(Math.random()-0.5)*(4+i*2),hfy+12+i*fl*0.2,1.5+Math.random(),0,Math.PI*2);x.fill();}x.globalAlpha=1;}
        x.fillStyle='#ff8800';x.shadowColor='#ff4400';x.shadowBlur=10;x.globalAlpha=0.7+fireInt*0.3;
        x.beginPath();x.arc(cx-3,hfy+4,2.5,0,Math.PI*2);x.fill();x.beginPath();x.arc(cx+3,hfy+4,2.5,0,Math.PI*2);x.fill();x.globalAlpha=1;x.shadowBlur=0;
        [-7,7].forEach(ox=>{x.fillStyle='#ff4400';x.shadowColor='#ff4400';x.shadowBlur=8;x.beginPath();x.ellipse(cx+ox,hfy-2,4,3,0,0,Math.PI*2);x.fill();x.shadowBlur=0;const efg=x.createRadialGradient(cx+ox,hfy-2,0.5,cx+ox,hfy-2,3.5);efg.addColorStop(0,'#ffff44');efg.addColorStop(0.4,'#ff8800');efg.addColorStop(1,'#882200');x.fillStyle=efg;x.beginPath();x.ellipse(cx+ox,hfy-2,4,3,0,0,Math.PI*2);x.fill();x.fillStyle='#111';x.beginPath();x.ellipse(cx+ox,hfy-2,1.2,2.5,0,0,Math.PI*2);x.fill();x.fillStyle='#fff';x.beginPath();x.arc(cx+ox-1,hfy-3.5,1.2,0,Math.PI*2);x.fill();});
        x.fillStyle='#eee';x.globalAlpha=0.8;for(let i=-2;i<=2;i++){x.beginPath();x.moveTo(cx+i*3,hfy+6);x.lineTo(cx+i*3-1,hfy+9);x.lineTo(cx+i*3+1,hfy+9);x.fill();}x.globalAlpha=1;
      }else{
        // Back spines
        x.fillStyle=darkC;for(let i=-3;i<=1;i++){const spH=4+fireInt*3;x.beginPath();x.moveTo(cx+i*4,cy+i*3+bob-spH);x.lineTo(cx+i*4-2,cy+i*3+bob+3);x.lineTo(cx+i*4+2,cy+i*3+bob+3);x.fill();}
        const nu=atkPhase*-4;const ngb=x.createLinearGradient(cx-5,cy-16,cx+5,cy-8);ngb.addColorStop(0,mainC);ngb.addColorStop(1,darkC);
        x.fillStyle=ngb;x.beginPath();x.moveTo(cx-6,cy-10+bob);x.quadraticCurveTo(cx-8,cy-22+bob+nu,cx,cy-28+bob+nu);x.quadraticCurveTo(cx+8,cy-22+bob+nu,cx+6,cy-10+bob);x.fill();
        drawSphere(x,cx,cy-30+bob+nu,12,mainC,lightC,darkC);
        x.fillStyle='#444444';x.beginPath();x.moveTo(cx-8,cy-38+bob+nu);x.bezierCurveTo(cx-14,cy-48+bob+nu,cx-16,cy-52+bob+nu,cx-12,cy-54+bob+nu);x.lineTo(cx-5,cy-36+bob+nu);x.fill();
        x.beginPath();x.moveTo(cx+8,cy-38+bob+nu);x.bezierCurveTo(cx+14,cy-48+bob+nu,cx+16,cy-52+bob+nu,cx+12,cy-54+bob+nu);x.lineTo(cx+5,cy-36+bob+nu);x.fill();
        if(f>=1){x.fillStyle='#ff4400';x.globalAlpha=0.15+fireInt*0.15;x.beginPath();x.arc(cx,cy-30+bob+nu,16,0,Math.PI*2);x.fill();x.globalAlpha=1;}
        x.fillStyle='rgba(255,255,255,0.1)';x.beginPath();x.arc(cx,cy-30+bob+nu,8,0,Math.PI*2);x.fill();
      }
      atkDrg[dir].push(c);
    }
  }
  setDirCache8(key, {
    down: dirs.down, down_right: dirs.down_right, right: dirs.right, up_right: dirs.up_right, up: dirs.up,
    atk_down: atkDrg.down, atk_down_right: atkDrg.down_right, atk_right: atkDrg.right,
    atk_up_right: atkDrg.up_right, atk_up: atkDrg.up
  });
}

// ============================================================
//  DEMON SPRITE (Boss demon with dark aura)
// ============================================================
function genDemon(key) {
  const dirs = { down: [], down_right: [], up: [], up_right: [], right: [] };
  for (const dir of ['down', 'down_right', 'right', 'up_right', 'up']) {
    for (let f = 0; f < 4; f++) {
      const c = makeCanvas(88, 92);
      const x = c.getContext('2d');
      const cx = 44, cy = 50, bob = Math.sin(f * Math.PI / 2) * 1.8;

      draw3DShadow(x, cx, 84, 26, 6);

      // Dark aura (same for all)
      const ag = x.createRadialGradient(cx, cy, 10, cx, cy, 40);
      ag.addColorStop(0, 'rgba(136,0,0,0.18)'); ag.addColorStop(1, 'rgba(136,0,0,0)');
      x.fillStyle = ag;
      x.beginPath(); x.arc(cx, cy, 40, 0, Math.PI * 2); x.fill();

      // Wings (same for all)
      const wf = Math.sin(f * Math.PI / 2) * 12;
      x.fillStyle = '#440000';
      x.beginPath(); x.moveTo(cx - 10, cy - 16 + bob);
      x.bezierCurveTo(cx - 30, cy - 36 + wf, cx - 40, cy - 28 + wf, cx - 40, cy - 6 + wf);
      x.bezierCurveTo(cx - 28, cy + 8, cx - 15, cy + 5, cx - 10, cy + bob); x.fill();
      x.beginPath(); x.moveTo(cx + 10, cy - 16 + bob);
      x.bezierCurveTo(cx + 30, cy - 36 + wf, cx + 40, cy - 28 + wf, cx + 40, cy - 6 + wf);
      x.bezierCurveTo(cx + 28, cy + 8, cx + 15, cy + 5, cx + 10, cy + bob); x.fill();
      x.strokeStyle = '#660000'; x.lineWidth = 0.8; x.globalAlpha = 0.5;
      for (let i = 0; i < 3; i++) {
        x.beginPath(); x.moveTo(cx - 10, cy - 10 + bob);
        x.lineTo(cx - 20 - i * 7, cy - 22 + wf * (i + 1) / 4); x.stroke();
        x.beginPath(); x.moveTo(cx + 10, cy - 10 + bob);
        x.lineTo(cx + 20 + i * 7, cy - 22 + wf * (i + 1) / 4); x.stroke();
      }
      x.globalAlpha = 1;

      // Legs (same for all)
      drawCylinder(x, cx - 12, cy + 14 + bob, 9, 20, '#771111', '#993333', '#440000');
      drawCylinder(x, cx + 3, cy + 14 + bob, 9, 20, '#771111', '#993333', '#440000');
      x.fillStyle = '#222222';
      x.beginPath(); x.roundRect(cx - 13, cy + 33 + bob, 11, 5, 2); x.fill();
      x.beginPath(); x.roundRect(cx + 2, cy + 33 + bob, 11, 5, 2); x.fill();
      x.fillStyle = 'rgba(255,68,0,0.2)';
      x.beginPath(); x.ellipse(cx - 7, cy + 37 + bob, 6, 3, 0, 0, Math.PI * 2); x.fill();
      x.beginPath(); x.ellipse(cx + 7, cy + 37 + bob, 6, 3, 0, 0, Math.PI * 2); x.fill();

      // Body (same for all)
      const bodyBG = x.createRadialGradient(cx - 3, cy - 8 + bob, 4, cx, cy + bob, 20);
      bodyBG.addColorStop(0, '#cc2222'); bodyBG.addColorStop(0.5, '#881111'); bodyBG.addColorStop(1, '#440000');
      x.fillStyle = bodyBG;
      x.beginPath(); x.ellipse(cx, cy + bob, 18, 20, 0, 0, Math.PI * 2); x.fill();

      // Muscle lines (front/side only)
      if (dir !== 'up' && dir !== 'up_right') {
        x.strokeStyle = '#aa2222'; x.lineWidth = 0.8; x.globalAlpha = 0.3;
        x.beginPath(); x.arc(cx - 6, cy - 4 + bob, 6, 0, Math.PI); x.stroke();
        x.beginPath(); x.arc(cx + 6, cy - 4 + bob, 6, 0, Math.PI); x.stroke();
        x.globalAlpha = 1;
      }

      // Rune glow on body
      x.strokeStyle = '#ff4400'; x.lineWidth = 1.5;
      x.shadowColor = '#ff4400'; x.shadowBlur = 8;
      x.globalAlpha = 0.55 + Math.sin(f * Math.PI / 2) * 0.3;
      if (dir === 'up' || dir === 'up_right') {
        // Back rune pattern
        x.beginPath();
        x.moveTo(cx, cy - 10 + bob); x.lineTo(cx, cy + 8 + bob);
        x.moveTo(cx - 10, cy - 2 + bob); x.lineTo(cx + 10, cy - 2 + bob);
        x.stroke();
      } else {
        x.beginPath();
        x.moveTo(cx - 8, cy - 8 + bob); x.lineTo(cx, cy + 6 + bob); x.lineTo(cx + 8, cy - 8 + bob);
        x.moveTo(cx - 10, cy + bob); x.lineTo(cx + 10, cy + bob);
        x.stroke();
      }
      x.globalAlpha = 1; x.shadowBlur = 0;
      addRimLight(x, cx, cy + bob, 18, '#ff4400', 0.22);

      // Arms (same for all)
      drawCylinder(x, cx - 26, cy - 10 + bob, 9, 22, '#881111', '#aa3333', '#550000');
      drawCylinder(x, cx + 17, cy - 10 + bob, 9, 22, '#881111', '#aa3333', '#550000');
      x.fillStyle = '#222222';
      for (let i = -1; i <= 1; i++) {
        x.beginPath(); x.moveTo(cx - 22 + i * 3, cy + 12 + bob);
        x.lineTo(cx - 23 + i * 3, cy + 18 + bob); x.lineTo(cx - 21 + i * 3, cy + 18 + bob); x.fill();
        x.beginPath(); x.moveTo(cx + 22 + i * 3, cy + 12 + bob);
        x.lineTo(cx + 21 + i * 3, cy + 18 + bob); x.lineTo(cx + 23 + i * 3, cy + 18 + bob); x.fill();
      }

      // Head
      drawSphere(x, cx, cy - 24 + bob, 13, '#991111', '#bb3333', '#550000');

      // Horns (same for all)
      x.fillStyle = '#333333';
      x.beginPath(); x.moveTo(cx - 10, cy - 32 + bob);
      x.bezierCurveTo(cx - 16, cy - 44 + bob, cx - 18, cy - 50 + bob, cx - 14, cy - 52 + bob);
      x.lineTo(cx - 7, cy - 30 + bob); x.fill();
      x.beginPath(); x.moveTo(cx + 10, cy - 32 + bob);
      x.bezierCurveTo(cx + 16, cy - 44 + bob, cx + 18, cy - 50 + bob, cx + 14, cy - 52 + bob);
      x.lineTo(cx + 7, cy - 30 + bob); x.fill();
      x.strokeStyle = '#555555'; x.lineWidth = 0.5; x.globalAlpha = 0.4;
      for (let i = 0; i < 4; i++) {
        const hy = cy - 34 - i * 4 + bob;
        x.beginPath(); x.moveTo(cx - 10 - i, hy); x.lineTo(cx - 8, hy + 1); x.stroke();
        x.beginPath(); x.moveTo(cx + 10 + i, hy); x.lineTo(cx + 8, hy + 1); x.stroke();
      }
      x.globalAlpha = 1;

      // --- Direction-specific face ---
      if (dir === 'down' || dir === 'down_right') {
        // Eyes (front / 3/4 front)
        x.fillStyle = '#ffff00'; x.shadowColor = '#ffff00'; x.shadowBlur = 10;
        x.globalAlpha = 0.9;
        if (dir === 'down_right') {
          // 3/4 front-right: right eye full, left smaller
          x.beginPath(); x.ellipse(cx + 4, cy - 25 + bob, 4, 2.5, 0, 0, Math.PI * 2); x.fill();
          x.beginPath(); x.ellipse(cx - 6, cy - 25 + bob, 3, 2, 0, 0, Math.PI * 2); x.fill();
          x.fillStyle = '#ff0000';
          x.beginPath(); x.ellipse(cx + 4, cy - 25 + bob, 2, 2, 0, 0, Math.PI * 2); x.fill();
          x.beginPath(); x.ellipse(cx - 6, cy - 25 + bob, 1.5, 1.5, 0, 0, Math.PI * 2); x.fill();
        } else {
          x.beginPath(); x.ellipse(cx - 5, cy - 25 + bob, 4, 2.5, 0, 0, Math.PI * 2); x.fill();
          x.beginPath(); x.ellipse(cx + 5, cy - 25 + bob, 4, 2.5, 0, 0, Math.PI * 2); x.fill();
          x.fillStyle = '#ff0000';
          x.beginPath(); x.ellipse(cx - 5, cy - 25 + bob, 2, 2, 0, 0, Math.PI * 2); x.fill();
          x.beginPath(); x.ellipse(cx + 5, cy - 25 + bob, 2, 2, 0, 0, Math.PI * 2); x.fill();
        }
        x.globalAlpha = 1; x.shadowBlur = 0;
        // Mouth + fangs
        x.strokeStyle = '#330000'; x.lineWidth = 1;
        x.beginPath(); x.moveTo(cx - 6, cy - 18 + bob); x.lineTo(cx + 6, cy - 18 + bob); x.stroke();
        x.fillStyle = '#eeeeee';
        x.beginPath(); x.moveTo(cx - 4, cy - 18 + bob); x.lineTo(cx - 5, cy - 14 + bob); x.lineTo(cx - 3, cy - 18 + bob); x.fill();
        x.beginPath(); x.moveTo(cx + 4, cy - 18 + bob); x.lineTo(cx + 5, cy - 14 + bob); x.lineTo(cx + 3, cy - 18 + bob); x.fill();
      } else if (dir === 'right') {
        // Eyes (side - one visible, shifted right)
        x.fillStyle = '#ffff00'; x.shadowColor = '#ffff00'; x.shadowBlur = 10;
        x.globalAlpha = 0.9;
        x.beginPath(); x.ellipse(cx + 4, cy - 25 + bob, 4, 2.5, 0, 0, Math.PI * 2); x.fill();
        x.fillStyle = '#ff0000';
        x.beginPath(); x.ellipse(cx + 4, cy - 25 + bob, 2, 2, 0, 0, Math.PI * 2); x.fill();
        x.globalAlpha = 1; x.shadowBlur = 0;
        // Mouth + fang (side)
        x.strokeStyle = '#330000'; x.lineWidth = 1;
        x.beginPath(); x.moveTo(cx, cy - 18 + bob); x.lineTo(cx + 8, cy - 18 + bob); x.stroke();
        x.fillStyle = '#eeeeee';
        x.beginPath(); x.moveTo(cx + 3, cy - 18 + bob); x.lineTo(cx + 2, cy - 14 + bob); x.lineTo(cx + 4, cy - 18 + bob); x.fill();
        x.beginPath(); x.moveTo(cx + 7, cy - 18 + bob); x.lineTo(cx + 8, cy - 14 + bob); x.lineTo(cx + 6, cy - 18 + bob); x.fill();
      } else {
        // UP / UP_RIGHT (back) - no face, back of head detail
        x.fillStyle = '#550000'; x.globalAlpha = 0.3;
        x.beginPath(); x.arc(cx, cy - 24 + bob, 8, 0, Math.PI * 2); x.fill();
        x.globalAlpha = 1;
        x.fillStyle = 'rgba(255,68,0,0.12)';
        x.beginPath(); x.arc(cx, cy - 22 + bob, 6, 0, Math.PI * 2); x.fill();
        if (dir === 'up_right') {
          // Slight glow from right side
          x.fillStyle = '#ffff00'; x.globalAlpha = 0.15;
          x.shadowColor = '#ffff00'; x.shadowBlur = 6;
          x.beginPath(); x.arc(cx + 8, cy - 25 + bob, 3, 0, Math.PI * 2); x.fill();
          x.shadowBlur = 0; x.globalAlpha = 1;
        }
      }

      dirs[dir].push(c);
    }
  }

  // Demon attack frames - claws extended, body surging, mouth open
  const atk = {down: [], down_right: [], up: [], up_right: [], right: []};
  for (const dir of ['down', 'down_right', 'right', 'up_right', 'up']) {
    for (let f = 0; f < 4; f++) {
      const c = makeCanvas(88, 92);
      const x = c.getContext('2d');
      const cx = 44, cy = 50;
      const atkPhase = f / 3;
      const bob = Math.sin(atkPhase * Math.PI) * 1.8;
      const surgeX = dir === 'right' ? atkPhase * 5 : (dir === 'down_right' || dir === 'up_right') ? atkPhase * 3 : 0;
      const surgeY = dir === 'down' ? atkPhase * 4 : dir === 'down_right' ? atkPhase * 3 : dir === 'up' ? -atkPhase * 4 : dir === 'up_right' ? -atkPhase * 3 : 0;
      const clawExt = Math.sin(atkPhase * Math.PI);

      draw3DShadow(x, cx + surgeX, 84, 26 + clawExt * 4, 6);

      // Dark aura (intensified)
      const ag = x.createRadialGradient(cx + surgeX, cy + surgeY, 10, cx + surgeX, cy + surgeY, 44);
      ag.addColorStop(0, 'rgba(255,0,0,0.25)'); ag.addColorStop(1, 'rgba(136,0,0,0)');
      x.fillStyle = ag;
      x.beginPath(); x.arc(cx + surgeX, cy + surgeY, 44, 0, Math.PI * 2); x.fill();

      // Wings (flared aggressively)
      const wf = Math.sin(atkPhase * Math.PI) * 16 + 5;
      x.fillStyle = '#440000';
      x.beginPath(); x.moveTo(cx - 10 + surgeX, cy - 16 + bob + surgeY);
      x.bezierCurveTo(cx - 35 + surgeX, cy - 40 + wf + surgeY, cx - 44 + surgeX, cy - 32 + wf + surgeY, cx - 44 + surgeX, cy - 6 + wf + surgeY);
      x.bezierCurveTo(cx - 30 + surgeX, cy + 8 + surgeY, cx - 15 + surgeX, cy + 5 + surgeY, cx - 10 + surgeX, cy + bob + surgeY); x.fill();
      x.beginPath(); x.moveTo(cx + 10 + surgeX, cy - 16 + bob + surgeY);
      x.bezierCurveTo(cx + 35 + surgeX, cy - 40 + wf + surgeY, cx + 44 + surgeX, cy - 32 + wf + surgeY, cx + 44 + surgeX, cy - 6 + wf + surgeY);
      x.bezierCurveTo(cx + 30 + surgeX, cy + 8 + surgeY, cx + 15 + surgeX, cy + 5 + surgeY, cx + 10 + surgeX, cy + bob + surgeY); x.fill();
      x.strokeStyle = '#660000'; x.lineWidth = 0.8; x.globalAlpha = 0.5;
      for (let i = 0; i < 3; i++) {
        x.beginPath(); x.moveTo(cx - 10 + surgeX, cy - 10 + bob + surgeY);
        x.lineTo(cx - 22 - i * 8 + surgeX, cy - 26 + wf * (i + 1) / 4 + surgeY); x.stroke();
        x.beginPath(); x.moveTo(cx + 10 + surgeX, cy - 10 + bob + surgeY);
        x.lineTo(cx + 22 + i * 8 + surgeX, cy - 26 + wf * (i + 1) / 4 + surgeY); x.stroke();
      }
      x.globalAlpha = 1;

      // Legs (planted, surging)
      drawCylinder(x, cx - 12 + surgeX, cy + 14 + bob + surgeY, 9, 20, '#771111', '#993333', '#440000');
      drawCylinder(x, cx + 3 + surgeX, cy + 14 + bob + surgeY, 9, 20, '#771111', '#993333', '#440000');
      x.fillStyle = '#222222';
      x.beginPath(); x.roundRect(cx - 13 + surgeX, cy + 33 + bob + surgeY, 11, 5, 2); x.fill();
      x.beginPath(); x.roundRect(cx + 2 + surgeX, cy + 33 + bob + surgeY, 11, 5, 2); x.fill();
      x.fillStyle = 'rgba(255,68,0,0.3)';
      x.beginPath(); x.ellipse(cx - 7 + surgeX, cy + 37 + bob + surgeY, 6, 3, 0, 0, Math.PI * 2); x.fill();
      x.beginPath(); x.ellipse(cx + 7 + surgeX, cy + 37 + bob + surgeY, 6, 3, 0, 0, Math.PI * 2); x.fill();

      // Body (surging forward)
      const bodyBG = x.createRadialGradient(cx - 3 + surgeX, cy - 8 + bob + surgeY, 4, cx + surgeX, cy + bob + surgeY, 20);
      bodyBG.addColorStop(0, '#cc2222'); bodyBG.addColorStop(0.5, '#881111'); bodyBG.addColorStop(1, '#440000');
      x.fillStyle = bodyBG;
      x.beginPath(); x.ellipse(cx + surgeX, cy + bob + surgeY, 18, 20, 0, 0, Math.PI * 2); x.fill();

      // Muscle lines (pulsing)
      if (dir !== 'up' && dir !== 'up_right') {
        x.strokeStyle = '#cc3333'; x.lineWidth = 1; x.globalAlpha = 0.4 + clawExt * 0.2;
        x.beginPath(); x.arc(cx - 6 + surgeX, cy - 4 + bob + surgeY, 6, 0, Math.PI); x.stroke();
        x.beginPath(); x.arc(cx + 6 + surgeX, cy - 4 + bob + surgeY, 6, 0, Math.PI); x.stroke();
        x.globalAlpha = 1;
      }

      // Rune glow (brighter during attack)
      x.strokeStyle = '#ff4400'; x.lineWidth = 2;
      x.shadowColor = '#ff4400'; x.shadowBlur = 12;
      x.globalAlpha = 0.7 + clawExt * 0.3;
      if (dir === 'up' || dir === 'up_right') {
        x.beginPath();
        x.moveTo(cx + surgeX, cy - 10 + bob + surgeY); x.lineTo(cx + surgeX, cy + 8 + bob + surgeY);
        x.moveTo(cx - 10 + surgeX, cy - 2 + bob + surgeY); x.lineTo(cx + 10 + surgeX, cy - 2 + bob + surgeY);
        x.stroke();
      } else {
        x.beginPath();
        x.moveTo(cx - 8 + surgeX, cy - 8 + bob + surgeY); x.lineTo(cx + surgeX, cy + 6 + bob + surgeY); x.lineTo(cx + 8 + surgeX, cy - 8 + bob + surgeY);
        x.moveTo(cx - 10 + surgeX, cy + bob + surgeY); x.lineTo(cx + 10 + surgeX, cy + bob + surgeY);
        x.stroke();
      }
      x.globalAlpha = 1; x.shadowBlur = 0;
      addRimLight(x, cx + surgeX, cy + bob + surgeY, 18, '#ff4400', 0.3);

      // Arms with claws extended
      const clawSwing = clawExt * 10;
      drawCylinder(x, cx - 26 + surgeX, cy - 10 + bob + surgeY - clawSwing, 9, 22, '#881111', '#aa3333', '#550000');
      drawCylinder(x, cx + 17 + surgeX, cy - 10 + bob + surgeY + clawSwing * 0.5, 9, 22, '#881111', '#aa3333', '#550000');
      // Claws (extended and splayed)
      x.fillStyle = '#222222';
      for (let i = -1; i <= 1; i++) {
        const clawLen = 6 + clawExt * 5;
        // Left claws (reaching forward/up)
        x.beginPath(); x.moveTo(cx - 22 + i * 3 + surgeX, cy + 12 + bob + surgeY - clawSwing);
        x.lineTo(cx - 24 + i * 4 + surgeX, cy + 12 + clawLen + bob + surgeY - clawSwing);
        x.lineTo(cx - 20 + i * 2 + surgeX, cy + 12 + clawLen - 2 + bob + surgeY - clawSwing); x.fill();
        // Right claws
        x.beginPath(); x.moveTo(cx + 22 + i * 3 + surgeX, cy + 12 + bob + surgeY + clawSwing * 0.5);
        x.lineTo(cx + 24 + i * 4 + surgeX, cy + 12 + clawLen + bob + surgeY + clawSwing * 0.5);
        x.lineTo(cx + 20 + i * 2 + surgeX, cy + 12 + clawLen - 2 + bob + surgeY + clawSwing * 0.5); x.fill();
      }

      // Claw slash effect
      if (f === 2) {
        x.strokeStyle = 'rgba(255,100,0,0.5)'; x.lineWidth = 2;
        const slashX = dir === 'right' ? cx + 28 + surgeX : cx + surgeX;
        const slashY = cy - 5 + bob + surgeY;
        for (let i = -1; i <= 1; i++) {
          x.beginPath();
          x.moveTo(slashX - 8 + i * 3, slashY - 10);
          x.lineTo(slashX + 8 + i * 3, slashY + 10);
          x.stroke();
        }
      }

      // Head
      drawSphere(x, cx + surgeX, cy - 24 + bob + surgeY, 13, '#991111', '#bb3333', '#550000');

      // Horns (same for all)
      x.fillStyle = '#333333';
      x.beginPath(); x.moveTo(cx - 10 + surgeX, cy - 32 + bob + surgeY);
      x.bezierCurveTo(cx - 16 + surgeX, cy - 44 + bob + surgeY, cx - 18 + surgeX, cy - 50 + bob + surgeY, cx - 14 + surgeX, cy - 52 + bob + surgeY);
      x.lineTo(cx - 7 + surgeX, cy - 30 + bob + surgeY); x.fill();
      x.beginPath(); x.moveTo(cx + 10 + surgeX, cy - 32 + bob + surgeY);
      x.bezierCurveTo(cx + 16 + surgeX, cy - 44 + bob + surgeY, cx + 18 + surgeX, cy - 50 + bob + surgeY, cx + 14 + surgeX, cy - 52 + bob + surgeY);
      x.lineTo(cx + 7 + surgeX, cy - 30 + bob + surgeY); x.fill();

      // Face per direction
      if (dir === 'down' || dir === 'down_right') {
        // Eyes (blazing)
        x.fillStyle = '#ffff00'; x.shadowColor = '#ffff00'; x.shadowBlur = 14;
        x.globalAlpha = 1;
        if (dir === 'down_right') {
          x.beginPath(); x.ellipse(cx + 4, cy - 25 + bob + surgeY, 4.5, 3, 0, 0, Math.PI * 2); x.fill();
          x.beginPath(); x.ellipse(cx - 6, cy - 25 + bob + surgeY, 3.5, 2.2, 0, 0, Math.PI * 2); x.fill();
          x.fillStyle = '#ff0000';
          x.beginPath(); x.ellipse(cx + 4, cy - 25 + bob + surgeY, 2.5, 2.5, 0, 0, Math.PI * 2); x.fill();
          x.beginPath(); x.ellipse(cx - 6, cy - 25 + bob + surgeY, 1.8, 1.8, 0, 0, Math.PI * 2); x.fill();
        } else {
          x.beginPath(); x.ellipse(cx - 5, cy - 25 + bob + surgeY, 4.5, 3, 0, 0, Math.PI * 2); x.fill();
          x.beginPath(); x.ellipse(cx + 5, cy - 25 + bob + surgeY, 4.5, 3, 0, 0, Math.PI * 2); x.fill();
          x.fillStyle = '#ff0000';
          x.beginPath(); x.ellipse(cx - 5, cy - 25 + bob + surgeY, 2.5, 2.5, 0, 0, Math.PI * 2); x.fill();
          x.beginPath(); x.ellipse(cx + 5, cy - 25 + bob + surgeY, 2.5, 2.5, 0, 0, Math.PI * 2); x.fill();
        }
        x.shadowBlur = 0;
        // Wide open mouth with fangs
        const mouthOpen = 4 + clawExt * 5;
        x.fillStyle = '#220000';
        x.beginPath(); x.ellipse(cx, cy - 17 + bob + surgeY, 7, mouthOpen * 0.6, 0, 0, Math.PI * 2); x.fill();
        x.fillStyle = '#eeeeee';
        // Upper fangs
        x.beginPath(); x.moveTo(cx - 5, cy - 18 + bob + surgeY - mouthOpen * 0.3); x.lineTo(cx - 6, cy - 13 + bob + surgeY); x.lineTo(cx - 4, cy - 18 + bob + surgeY - mouthOpen * 0.2); x.fill();
        x.beginPath(); x.moveTo(cx + 5, cy - 18 + bob + surgeY - mouthOpen * 0.3); x.lineTo(cx + 6, cy - 13 + bob + surgeY); x.lineTo(cx + 4, cy - 18 + bob + surgeY - mouthOpen * 0.2); x.fill();
        // Lower fangs
        x.beginPath(); x.moveTo(cx - 3, cy - 14 + bob + surgeY + mouthOpen * 0.3); x.lineTo(cx - 4, cy - 18 + bob + surgeY); x.lineTo(cx - 2, cy - 14 + bob + surgeY + mouthOpen * 0.2); x.fill();
        x.beginPath(); x.moveTo(cx + 3, cy - 14 + bob + surgeY + mouthOpen * 0.3); x.lineTo(cx + 4, cy - 18 + bob + surgeY); x.lineTo(cx + 2, cy - 14 + bob + surgeY + mouthOpen * 0.2); x.fill();
      } else if (dir === 'right') {
        // Eye (blazing, side)
        x.fillStyle = '#ffff00'; x.shadowColor = '#ffff00'; x.shadowBlur = 14;
        x.globalAlpha = 1;
        x.beginPath(); x.ellipse(cx + 4 + surgeX, cy - 25 + bob + surgeY, 4.5, 3, 0, 0, Math.PI * 2); x.fill();
        x.fillStyle = '#ff0000';
        x.beginPath(); x.ellipse(cx + 4 + surgeX, cy - 25 + bob + surgeY, 2.5, 2.5, 0, 0, Math.PI * 2); x.fill();
        x.shadowBlur = 0;
        // Open mouth (side)
        const mouthOpen = 4 + clawExt * 5;
        x.fillStyle = '#220000';
        x.beginPath(); x.ellipse(cx + 4 + surgeX, cy - 17 + bob + surgeY, 5, mouthOpen * 0.5, 0.2, 0, Math.PI * 2); x.fill();
        x.fillStyle = '#eeeeee';
        x.beginPath(); x.moveTo(cx + 3 + surgeX, cy - 18 + bob + surgeY - mouthOpen * 0.2); x.lineTo(cx + 2 + surgeX, cy - 13 + bob + surgeY); x.lineTo(cx + 4 + surgeX, cy - 18 + bob + surgeY); x.fill();
        x.beginPath(); x.moveTo(cx + 7 + surgeX, cy - 18 + bob + surgeY - mouthOpen * 0.2); x.lineTo(cx + 8 + surgeX, cy - 13 + bob + surgeY); x.lineTo(cx + 6 + surgeX, cy - 18 + bob + surgeY); x.fill();
      } else {
        // UP / UP_RIGHT (back) - no face, back glow accent intensified
        x.fillStyle = '#550000'; x.globalAlpha = 0.3;
        x.beginPath(); x.arc(cx, cy - 24 + bob + surgeY, 8, 0, Math.PI * 2); x.fill();
        x.globalAlpha = 1;
        x.fillStyle = 'rgba(255,68,0,0.2)';
        x.beginPath(); x.arc(cx, cy - 22 + bob + surgeY, 8, 0, Math.PI * 2); x.fill();
        if (dir === 'up_right') {
          x.fillStyle = '#ffff00'; x.globalAlpha = 0.15;
          x.shadowColor = '#ffff00'; x.shadowBlur = 6;
          x.beginPath(); x.arc(cx + 8, cy - 25 + bob + surgeY, 3, 0, Math.PI * 2); x.fill();
          x.shadowBlur = 0; x.globalAlpha = 1;
        }
      }

      atk[dir].push(c);
    }
  }
  setDirCache8(key, {
    down: dirs.down, down_right: dirs.down_right, right: dirs.right, up_right: dirs.up_right, up: dirs.up,
    atk_down: atk.down, atk_down_right: atk.down_right, atk_right: atk.right,
    atk_up_right: atk.up_right, atk_up: atk.up
  });
}

// ============================================================
//  PLAYER WARRIOR (Full plate knight - 64x84, 4-directional)
// ============================================================
function genPlayerWarrior() {
  const dirs = {down: [], down_right: [], up: [], up_right: [], right: []};
  for (const dir of ['down', 'down_right', 'right', 'up_right', 'up']) {
    for (let f = 0; f < 4; f++) {
      const c = makeCanvas(64, 84);
      const x = c.getContext('2d');
      const cx = 32, bob = Math.sin(f * Math.PI / 2) * 1.8;
      const lp = Math.sin(f * Math.PI / 2) * 3, as = Math.sin(f * Math.PI / 2) * 3.5;
      const side = dir === 'right';

      draw3DShadow(x, cx, 78, 16, 5);

      // Cape (behind body, more visible from back)
      if (dir === 'up') {
        drawCape(x, cx, 26 + bob, 24, 44, '#8b2020', f);
      } else if (dir === 'up_right') {
        drawCape(x, cx - 2, 27 + bob, 22, 42, '#8b2020', f);
      } else if (dir === 'down_right') {
        drawCape(x, cx - 2, 28 + bob, 20, 40, '#8b2020', f);
      } else if (!side) {
        drawCape(x, cx, 28 + bob, 22, 40, '#8b2020', f);
      } else {
        drawCape(x, cx + 2, 28 + bob, 12, 38, '#8b2020', f);
      }

      // Plate legs
      if (side) {
        drawMetalPlate(x, cx - 4, 52 + bob, 8, 16 + lp * 0.3, '#778899', '#99aabb', '#556677');
        drawRivet(x, cx, 56 + bob, 1.5);
        drawMetalPlate(x, cx - 5, 66 + bob + lp * 0.2, 10, 7, '#5a6a7a', '#7a8a9a', '#3a4a5a');
        x.fillStyle = '#4a3a2a'; x.fillRect(cx - 4, 68 + bob + lp * 0.2, 8, 1.5);
      } else {
        drawMetalPlate(x, cx - 8, 52 + bob, 7, 16 + lp * 0.5, '#778899', '#99aabb', '#556677');
        drawMetalPlate(x, cx + 1, 52 + bob, 7, 16 - lp * 0.5, '#778899', '#99aabb', '#556677');
        drawRivet(x, cx - 4.5, 56 + bob + lp * 0.2, 1.5);
        drawRivet(x, cx + 4.5, 56 + bob - lp * 0.2, 1.5);
        drawMetalPlate(x, cx - 9, 66 + bob + lp * 0.3, 9, 7, '#5a6a7a', '#7a8a9a', '#3a4a5a');
        drawMetalPlate(x, cx, 66 + bob - lp * 0.3, 9, 7, '#5a6a7a', '#7a8a9a', '#3a4a5a');
        x.fillStyle = '#4a3a2a';
        x.fillRect(cx - 8, 68 + bob + lp * 0.3, 7, 1.5);
        x.fillRect(cx + 1, 68 + bob - lp * 0.3, 7, 1.5);
      }

      // Body - plate armor
      const bodyW = side ? 20 : 26;
      const bodyX = side ? cx - 10 : cx - 13;
      drawMetalPlate(x, bodyX, 26 + bob, bodyW, 28, '#8899aa', '#aabbcc', '#556677');
      if (dir === 'down' || dir === 'down_right') {
        // Chest cross emblem
        x.fillStyle = '#ffd700';
        x.fillRect(cx - 1.5, 32 + bob, 3, 10);
        x.fillRect(cx - 5, 35 + bob, 10, 3);
      } else if (dir === 'up' || dir === 'up_right') {
        // Back plate lines
        drawEngravingLine(x, cx, 30 + bob, cx, 50 + bob, '#8899aa');
      }
      // Engravings
      drawEngravingLine(x, bodyX + 2, 30 + bob, bodyX + 2, 50 + bob, '#8899aa');
      drawEngravingLine(x, bodyX + bodyW - 2, 30 + bob, bodyX + bodyW - 2, 50 + bob, '#8899aa');
      // Rivets
      drawRivet(x, bodyX + 4, 30 + bob, 1.2);
      drawRivet(x, bodyX + bodyW - 4, 30 + bob, 1.2);
      drawRivet(x, bodyX + 4, 42 + bob, 1.2);
      drawRivet(x, bodyX + bodyW - 4, 42 + bob, 1.2);
      // Belt
      x.fillStyle = '#6a5030';
      x.fillRect(bodyX, 50 + bob, bodyW, 4);
      drawGem(x, cx, 52 + bob, 2.5, '#dd2222');

      // Shoulders & arms
      if (side) {
        // Single visible shoulder + arm
        drawSphere(x, cx, 29 + bob, 6.5, '#8899aa', '#bbccdd', '#556677');
        x.fillStyle = '#ccddee';
        x.beginPath(); x.moveTo(cx + 3, 28 + bob); x.lineTo(cx + 8, 21 + bob); x.lineTo(cx + 1, 26 + bob); x.fill();
        drawRivet(x, cx + 2, 28 + bob, 1);
        drawCylinder(x, cx - 3, 30 + bob + as, 6, 18, '#778899', '#99aabb', '#556677');
        drawSphere(x, cx, 50 + bob + as, 4, '#8899aa', '#bbccdd', '#556677');
        x.fillStyle = '#778899';
        for (let gi = -1; gi <= 1; gi++) x.fillRect(cx - 2 + gi * 2, 53 + bob + as, 2, 2);
      } else {
        drawSphere(x, cx - 16, 29 + bob, 6.5, '#8899aa', '#bbccdd', '#556677');
        drawSphere(x, cx + 16, 29 + bob, 6.5, '#8899aa', '#bbccdd', '#556677');
        x.fillStyle = '#ccddee';
        x.beginPath(); x.moveTo(cx - 19, 28 + bob); x.lineTo(cx - 24, 21 + bob); x.lineTo(cx - 17, 26 + bob); x.fill();
        x.beginPath(); x.moveTo(cx + 19, 28 + bob); x.lineTo(cx + 24, 21 + bob); x.lineTo(cx + 17, 26 + bob); x.fill();
        drawRivet(x, cx - 14, 28 + bob, 1);
        drawRivet(x, cx + 14, 28 + bob, 1);
        drawCylinder(x, cx - 20, 30 + bob + as, 6, 18, '#778899', '#99aabb', '#556677');
        drawCylinder(x, cx + 14, 30 + bob - as, 6, 18, '#778899', '#99aabb', '#556677');
        drawSphere(x, cx - 17, 50 + bob + as, 4, '#8899aa', '#bbccdd', '#556677');
        drawSphere(x, cx + 17, 50 + bob - as, 4, '#8899aa', '#bbccdd', '#556677');
        x.fillStyle = '#778899';
        for (let gi = -1; gi <= 1; gi++) {
          x.fillRect(cx - 19 + gi * 2, 53 + bob + as, 2, 2);
          x.fillRect(cx + 15 + gi * 2, 53 + bob - as, 2, 2);
        }
      }

      // Weapon & Shield
      if (side) {
        // Sword in front
        drawSwordBlade(x, cx + 6, 20 + bob - as, 30, 4, '#dddddd');
        x.fillStyle = '#ffd700'; x.fillRect(cx + 3, 48 + bob - as, 10, 3);
        drawGem(x, cx + 8, 49.5 + bob - as, 1.5, '#4488ff');
        x.fillStyle = '#5a3a1a'; x.fillRect(cx + 7, 51 + bob - as, 3, 5);
        drawSphere(x, cx + 8.5, 57 + bob - as, 2, '#ffd700', '#ffee88', '#cc8800');
      } else if (dir === 'down' || dir === 'down_right') {
        // Sword right hand
        drawSwordBlade(x, cx + 17, 18 + bob - as, 32, 5, '#dddddd');
        x.fillStyle = '#ffd700'; x.fillRect(cx + 14, 48 + bob - as, 11, 3);
        drawGem(x, cx + 19.5, 49.5 + bob - as, 1.5, '#4488ff');
        x.fillStyle = '#5a3a1a'; x.fillRect(cx + 18, 51 + bob - as, 3, 6);
        drawSphere(x, cx + 19.5, 58 + bob - as, 2.5, '#ffd700', '#ffee88', '#cc8800');
        // Shield left hand
        const shG = x.createLinearGradient(cx - 24, 30, cx - 14, 50);
        shG.addColorStop(0, '#8899bb'); shG.addColorStop(0.5, '#667788'); shG.addColorStop(1, '#445566');
        x.fillStyle = shG;
        x.beginPath();
        x.moveTo(cx - 24, 32 + bob + as); x.lineTo(cx - 14, 30 + bob + as);
        x.lineTo(cx - 14, 48 + bob + as); x.lineTo(cx - 19, 54 + bob + as);
        x.lineTo(cx - 24, 48 + bob + as); x.fill();
        x.fillStyle = 'rgba(255,255,255,0.12)';
        x.beginPath();
        x.moveTo(cx - 24, 32 + bob + as); x.lineTo(cx - 19, 31 + bob + as);
        x.lineTo(cx - 19, 44 + bob + as); x.lineTo(cx - 24, 42 + bob + as); x.fill();
        drawGem(x, cx - 19, 40 + bob + as, 3.5, '#ffd700');
        drawRivet(x, cx - 22, 34 + bob + as, 1); drawRivet(x, cx - 16, 34 + bob + as, 1);
        drawRivet(x, cx - 22, 46 + bob + as, 1); drawRivet(x, cx - 16, 46 + bob + as, 1);
      } else {
        // UP: sword handle behind shoulder, shield on back
        x.fillStyle = '#5a3a1a'; x.fillRect(cx + 8, 10 + bob, 3, 10);
        drawSphere(x, cx + 9.5, 8 + bob, 2, '#ffd700', '#ffee88', '#cc8800');
        // Shield on back
        const shG = x.createLinearGradient(cx - 8, 28, cx + 8, 42);
        shG.addColorStop(0, '#667788'); shG.addColorStop(1, '#445566');
        x.fillStyle = shG;
        x.beginPath();
        x.moveTo(cx - 6, 30 + bob); x.lineTo(cx + 6, 30 + bob);
        x.lineTo(cx + 6, 44 + bob); x.lineTo(cx, 48 + bob);
        x.lineTo(cx - 6, 44 + bob); x.fill();
        drawRivet(x, cx - 4, 33 + bob, 1); drawRivet(x, cx + 4, 33 + bob, 1);
      }

      // Head
      drawSphere(x, cx, 18 + bob, 10, '#e8c8a0', '#f5ddc0', '#c0a080');

      // Helmet (all directions)
      drawMetalPlate(x, cx - 11, 7 + bob, 22, 15, '#8899aa', '#bbccdd', '#556677');
      const crestG = x.createLinearGradient(cx - 2, 2, cx + 2, 10);
      crestG.addColorStop(0, '#cc3333'); crestG.addColorStop(1, '#881111');
      x.fillStyle = crestG;
      x.fillRect(cx - 2, 2 + bob, 4, 9);
      x.fillStyle = '#dd4444';
      x.beginPath(); x.moveTo(cx, 2 + bob); x.lineTo(cx - 4, -2 + bob); x.lineTo(cx + 4, -2 + bob); x.fill();

      if (dir === 'down' || dir === 'down_right') {
        // Visor slit + glowing eyes
        x.fillStyle = '#222222'; x.fillRect(cx - 7, 17 + bob, 14, 3);
        x.fillStyle = '#4488ff'; x.shadowColor = '#4488ff'; x.shadowBlur = 4;
        if (dir === 'down_right') {
          // 3/4 front-right: right eye full, left eye smaller
          x.fillRect(cx + 1, 17.5 + bob, 3.5, 2);
          x.fillRect(cx - 4, 17.5 + bob, 2, 1.5);
        } else {
          x.fillRect(cx - 5, 17.5 + bob, 3, 2);
          x.fillRect(cx + 2, 17.5 + bob, 3, 2);
        }
        x.shadowBlur = 0;
        x.fillStyle = '#8899aa'; x.fillRect(cx - 1, 14 + bob, 2, 7);
      } else if (dir === 'right') {
        x.fillStyle = '#222222'; x.fillRect(cx - 3, 17 + bob, 10, 3);
        x.fillStyle = '#4488ff'; x.shadowColor = '#4488ff'; x.shadowBlur = 4;
        x.fillRect(cx + 1, 17.5 + bob, 3, 2);
        x.shadowBlur = 0;
        x.fillStyle = '#8899aa'; x.fillRect(cx + 5, 14 + bob, 2, 7);
      } else {
        // UP / UP_RIGHT: back of helmet, no visor
        x.fillStyle = '#556677';
        x.fillRect(cx - 9, 14 + bob, 18, 3);
        drawMetalPlate(x, cx - 8, 20 + bob, 16, 6, '#778899', '#99aabb', '#556677');
        if (dir === 'up_right') {
          // Slight visor edge visible from right
          x.fillStyle = '#222222'; x.fillRect(cx + 8, 17 + bob, 2, 2);
        }
      }
      // Helmet rivets
      drawRivet(x, cx - 9, 12 + bob, 1);
      drawRivet(x, cx + 9, 12 + bob, 1);

      // Aura particles
      x.fillStyle = `rgba(255,100,50,${0.2 + Math.sin(f * Math.PI / 2) * 0.1})`;
      for (let i = 0; i < 3; i++) {
        const pa = f * Math.PI / 2 + i * Math.PI * 2 / 3;
        const px = cx + Math.cos(pa) * 22, py = 44 + bob + Math.sin(pa) * 16;
        x.beginPath(); x.arc(px, py, 1.5, 0, Math.PI * 2); x.fill();
      }

      dirs[dir].push(c);
    }
  }
  // Attack frames - heavy sword slash
  const atk = {down: [], down_right: [], up: [], up_right: [], right: []};
  for (const dir of ['down', 'down_right', 'right', 'up_right', 'up']) {
    for (let f = 0; f < 4; f++) {
      const c = makeCanvas(64, 84);
      const x = c.getContext('2d');
      const cx = 32;
      const atkPhase = f / 3;
      const side = dir === 'right';
      const lean = Math.sin(atkPhase * Math.PI) * 2;

      draw3DShadow(x, cx, 78, 16, 5);

      // Cape
      if (dir === 'up') drawCape(x, cx, 26 + lean, 24, 44, '#8b2020', f);
      else if (dir === 'up_right') drawCape(x, cx - 2, 27 + lean, 22, 42, '#8b2020', f);
      else if (side) drawCape(x, cx + 2, 28 + lean, 12, 38, '#8b2020', f);
      else if (dir === 'down_right') drawCape(x, cx - 2, 28 + lean, 20, 40, '#8b2020', f);
      else drawCape(x, cx, 28 + lean, 22, 40, '#8b2020', f);

      // Plate legs (wide attack stance)
      if (side) {
        drawMetalPlate(x, cx - 4, 52 + lean, 8, 16, '#778899', '#99aabb', '#556677');
        drawRivet(x, cx, 56 + lean, 1.5);
        drawMetalPlate(x, cx - 5, 66 + lean, 10, 7, '#5a6a7a', '#7a8a9a', '#3a4a5a');
      } else {
        const stW = 1 + atkPhase * 1.5;
        drawMetalPlate(x, cx - 8 - stW, 52 + lean, 7, 16, '#778899', '#99aabb', '#556677');
        drawMetalPlate(x, cx + 1 + stW, 52 + lean, 7, 16, '#778899', '#99aabb', '#556677');
        drawMetalPlate(x, cx - 9 - stW, 66 + lean, 9, 7, '#5a6a7a', '#7a8a9a', '#3a4a5a');
        drawMetalPlate(x, cx + stW, 66 + lean, 9, 7, '#5a6a7a', '#7a8a9a', '#3a4a5a');
      }

      // Body plate armor
      const bodyW = side ? 20 : 26, bodyX = side ? cx - 10 : cx - 13;
      drawMetalPlate(x, bodyX, 26 + lean, bodyW, 28, '#8899aa', '#aabbcc', '#556677');
      if (dir === 'down' || dir === 'down_right') {
        x.fillStyle = '#ffd700'; x.fillRect(cx - 1.5, 32 + lean, 3, 10); x.fillRect(cx - 5, 35 + lean, 10, 3);
      }
      drawEngravingLine(x, bodyX + 2, 30 + lean, bodyX + 2, 50 + lean, '#8899aa');
      drawEngravingLine(x, bodyX + bodyW - 2, 30 + lean, bodyX + bodyW - 2, 50 + lean, '#8899aa');
      drawRivet(x, bodyX + 4, 30 + lean, 1.2); drawRivet(x, bodyX + bodyW - 4, 30 + lean, 1.2);
      x.fillStyle = '#6a5030'; x.fillRect(bodyX, 50 + lean, bodyW, 4);
      drawGem(x, cx, 52 + lean, 2.5, '#dd2222');

      // Shoulders & sword attack arm
      if (side) {
        drawSphere(x, cx, 29 + lean, 6.5, '#8899aa', '#bbccdd', '#556677');
        drawRivet(x, cx + 2, 28 + lean, 1);
        const armAng = -1.2 + atkPhase * 2.0;
        const aX = cx + Math.sin(armAng) * 14, aY = 36 + lean + Math.cos(armAng) * 10;
        drawCylinder(x, aX - 3, aY - 4, 6, 18, '#778899', '#99aabb', '#556677');
        drawSphere(x, aX, aY + 14, 4, '#8899aa', '#bbccdd', '#556677');
        x.save(); x.translate(aX, aY - 4); x.rotate(-1.8 + atkPhase * 2.6);
        drawSwordBlade(x, -2, -32, 32, 5, '#dddddd');
        x.fillStyle = '#ffd700'; x.fillRect(-4, -2, 10, 3);
        x.fillStyle = '#5a3a1a'; x.fillRect(-1, 1, 3, 5);
        x.restore();
        if (f === 2) { x.fillStyle = 'rgba(255,220,100,0.7)'; for (let i = 0; i < 4; i++) { const sa = i * Math.PI / 2 + 0.3; x.beginPath(); x.arc(aX + Math.cos(sa) * 8, aY - 12 + Math.sin(sa) * 6, 1.5, 0, Math.PI * 2); x.fill(); } }
      } else if (dir === 'down' || dir === 'down_right') {
        drawSphere(x, cx - 16, 29 + lean, 6.5, '#8899aa', '#bbccdd', '#556677');
        drawSphere(x, cx + 16, 29 + lean, 6.5, '#8899aa', '#bbccdd', '#556677');
        drawRivet(x, cx - 14, 28 + lean, 1); drawRivet(x, cx + 14, 28 + lean, 1);
        drawCylinder(x, cx - 20, 30 + lean, 6, 18, '#778899', '#99aabb', '#556677');
        drawSphere(x, cx - 17, 50 + lean, 4, '#8899aa', '#bbccdd', '#556677');
        const shG = x.createLinearGradient(cx - 24, 30, cx - 14, 50);
        shG.addColorStop(0, '#8899bb'); shG.addColorStop(0.5, '#667788'); shG.addColorStop(1, '#445566');
        x.fillStyle = shG;
        x.beginPath(); x.moveTo(cx - 24, 32 + lean); x.lineTo(cx - 14, 30 + lean); x.lineTo(cx - 14, 48 + lean); x.lineTo(cx - 19, 54 + lean); x.lineTo(cx - 24, 48 + lean); x.fill();
        drawGem(x, cx - 19, 40 + lean, 3.5, '#ffd700');
        const sAY = 30 + lean - 8 + atkPhase * 20, sR = -2.2 + atkPhase * 2.8;
        drawCylinder(x, cx + 14, sAY, 6, 18, '#778899', '#99aabb', '#556677');
        drawSphere(x, cx + 17, sAY + 18, 4, '#8899aa', '#bbccdd', '#556677');
        x.save(); x.translate(cx + 17, sAY + 2); x.rotate(sR);
        drawSwordBlade(x, -2, -34, 34, 5, '#dddddd');
        x.fillStyle = '#ffd700'; x.fillRect(-4, -2, 11, 3);
        x.fillStyle = '#5a3a1a'; x.fillRect(0, 1, 3, 6);
        x.restore();
        if (f === 2) { x.fillStyle = 'rgba(255,200,50,0.8)'; for (let i = 0; i < 5; i++) { const sa = i * Math.PI * 2 / 5; x.beginPath(); x.arc(cx + 17 + Math.cos(sa) * 10, sAY - 6 + Math.sin(sa) * 8, 1.5, 0, Math.PI * 2); x.fill(); } }
      } else {
        // UP / UP_RIGHT direction
        drawSphere(x, cx - 16, 29 + lean, 6.5, '#8899aa', '#bbccdd', '#556677');
        drawSphere(x, cx + 16, 29 + lean, 6.5, '#8899aa', '#bbccdd', '#556677');
        drawCylinder(x, cx - 20, 30 + lean, 6, 18, '#778899', '#99aabb', '#556677');
        drawSphere(x, cx - 17, 50 + lean, 4, '#8899aa', '#bbccdd', '#556677');
        const sAY = 26 + lean - 6 + atkPhase * 16;
        drawCylinder(x, cx + 14, sAY, 6, 18, '#778899', '#99aabb', '#556677');
        x.save(); x.translate(cx + 17, sAY); x.rotate(-1.0 + atkPhase * 1.5);
        x.fillStyle = '#5a3a1a'; x.fillRect(-1, -10, 3, 10);
        drawSphere(x, 0.5, -12, 2, '#ffd700', '#ffee88', '#cc8800');
        x.restore();
        // Shield on back
        const shG = x.createLinearGradient(cx - 8, 28, cx + 8, 42);
        shG.addColorStop(0, '#667788'); shG.addColorStop(1, '#445566');
        x.fillStyle = shG;
        x.beginPath(); x.moveTo(cx - 6, 30 + lean); x.lineTo(cx + 6, 30 + lean); x.lineTo(cx + 6, 44 + lean); x.lineTo(cx, 48 + lean); x.lineTo(cx - 6, 44 + lean); x.fill();
      }

      // Head + Helmet
      drawSphere(x, cx, 18 + lean, 10, '#e8c8a0', '#f5ddc0', '#c0a080');
      drawMetalPlate(x, cx - 11, 7 + lean, 22, 15, '#8899aa', '#bbccdd', '#556677');
      const cG = x.createLinearGradient(cx - 2, 2, cx + 2, 10);
      cG.addColorStop(0, '#cc3333'); cG.addColorStop(1, '#881111');
      x.fillStyle = cG; x.fillRect(cx - 2, 2 + lean, 4, 9);
      x.fillStyle = '#dd4444'; x.beginPath(); x.moveTo(cx, 2 + lean); x.lineTo(cx - 4, -2 + lean); x.lineTo(cx + 4, -2 + lean); x.fill();
      if (dir === 'down' || dir === 'down_right') {
        x.fillStyle = '#222222'; x.fillRect(cx - 7, 17 + lean, 14, 3);
        x.fillStyle = '#4488ff'; x.shadowColor = '#4488ff'; x.shadowBlur = 4;
        if (dir === 'down_right') {
          x.fillRect(cx + 1, 17.5 + lean, 3.5, 2);
          x.fillRect(cx - 4, 17.5 + lean, 2, 1.5);
        } else {
          x.fillRect(cx - 5, 17.5 + lean, 3, 2); x.fillRect(cx + 2, 17.5 + lean, 3, 2);
        }
        x.shadowBlur = 0;
        x.fillStyle = '#8899aa'; x.fillRect(cx - 1, 14 + lean, 2, 7);
      } else if (dir === 'right') {
        x.fillStyle = '#222222'; x.fillRect(cx - 3, 17 + lean, 10, 3);
        x.fillStyle = '#4488ff'; x.shadowColor = '#4488ff'; x.shadowBlur = 4;
        x.fillRect(cx + 1, 17.5 + lean, 3, 2); x.shadowBlur = 0;
        x.fillStyle = '#8899aa'; x.fillRect(cx + 5, 14 + lean, 2, 7);
      } else {
        x.fillStyle = '#556677'; x.fillRect(cx - 9, 14 + lean, 18, 3);
        drawMetalPlate(x, cx - 8, 20 + lean, 16, 6, '#778899', '#99aabb', '#556677');
        if (dir === 'up_right') {
          x.fillStyle = '#222222'; x.fillRect(cx + 8, 17 + lean, 2, 2);
        }
      }
      drawRivet(x, cx - 9, 12 + lean, 1); drawRivet(x, cx + 9, 12 + lean, 1);

      // Attack aura
      x.fillStyle = `rgba(255,100,30,${0.15 + Math.sin(atkPhase * Math.PI) * 0.2})`;
      for (let i = 0; i < 5; i++) { const pa = atkPhase * Math.PI * 2 + i * Math.PI * 2 / 5; x.beginPath(); x.arc(cx + Math.cos(pa) * 24, 44 + lean + Math.sin(pa) * 16, 2, 0, Math.PI * 2); x.fill(); }

      atk[dir].push(c);
    }
  }

  setDirCache8('player_WARRIOR', {
    down: dirs.down, down_right: dirs.down_right, right: dirs.right, up_right: dirs.up_right, up: dirs.up,
    atk_down: atk.down, atk_down_right: atk.down_right, atk_right: atk.right,
    atk_up_right: atk.up_right, atk_up: atk.up
  });
}

// ============================================================
//  PLAYER MAGE (Arcane wizard - 64x84, 4-directional)
// ============================================================
function genPlayerMage() {
  const dirs = {down: [], down_right: [], up: [], up_right: [], right: []};
  for (const dir of ['down', 'down_right', 'right', 'up_right', 'up']) {
    for (let f = 0; f < 4; f++) {
      const c = makeCanvas(64, 84);
      const x = c.getContext('2d');
      const cx = 32, bob = Math.sin(f * Math.PI / 2) * 1.5;
      const as = Math.sin(f * Math.PI / 2) * 3;
      const side = dir === 'right';

      draw3DShadow(x, cx, 78, 16, 5);

      // Magic aura
      const auraAlpha = 0.05 + Math.sin(f * Math.PI / 2) * 0.03;
      const auraG = x.createRadialGradient(cx, 46, 5, cx, 46, 30);
      auraG.addColorStop(0, `rgba(80,120,255,${auraAlpha * 2})`);
      auraG.addColorStop(1, `rgba(80,120,255,0)`);
      x.fillStyle = auraG;
      x.beginPath(); x.ellipse(cx, 46, 28, 36, 0, 0, Math.PI * 2); x.fill();

      // Robe
      const robeHL = side ? 10 : 14, robeHR = side ? 16 : 14;
      const robeBL = side ? 12 : 18, robeBR = side ? 20 : 18;
      const rg = x.createLinearGradient(cx - 16, 28, cx + 16, 72);
      rg.addColorStop(0, '#2a4ab0'); rg.addColorStop(0.3, '#1e3898');
      rg.addColorStop(0.6, '#152880'); rg.addColorStop(1, '#0f2060');
      x.fillStyle = rg;
      x.beginPath();
      x.moveTo(cx - robeHL, 28 + bob); x.lineTo(cx - robeBL, 72);
      x.lineTo(cx + robeBR, 72); x.lineTo(cx + robeHR, 28 + bob);
      x.fill();
      // Fold shadows
      x.fillStyle = 'rgba(0,0,0,0.12)';
      x.beginPath(); x.moveTo(cx + 2, 34 + bob);
      x.lineTo(cx - 4, 72); x.lineTo(cx + 6, 72); x.fill();
      if (!side) {
        x.beginPath(); x.moveTo(cx - 6, 38 + bob);
        x.lineTo(cx - 10, 72); x.lineTo(cx - 4, 72); x.fill();
      }
      // Star/moon patterns
      if (dir !== 'up' && dir !== 'up_right') {
        x.fillStyle = 'rgba(200,220,255,0.15)';
        [{sx: cx - 8, sy: 40}, {sx: cx + 7, sy: 48}, {sx: cx - 4, sy: 58}, {sx: cx + 9, sy: 38}, {sx: cx - 10, sy: 52}].forEach(sp => {
          x.beginPath(); x.arc(sp.sx, sp.sy + bob, 1.8, 0, Math.PI * 2); x.fill();
        });
        x.strokeStyle = 'rgba(200,220,255,0.12)'; x.lineWidth = 1;
        x.beginPath(); x.arc(cx + 3, 54 + bob, 3, 0.5, Math.PI * 1.5); x.stroke();
      }
      // Gold trim bottom + center
      x.strokeStyle = '#ccaa44'; x.lineWidth = 2;
      x.beginPath(); x.moveTo(cx - robeBL, 72); x.lineTo(cx + robeBR, 72); x.stroke();
      if (dir === 'down' || dir === 'down_right') {
        x.lineWidth = 1.2;
        x.beginPath(); x.moveTo(cx, 28 + bob); x.lineTo(cx, 72); x.stroke();
      }
      // Sash
      x.fillStyle = '#ccaa44'; x.fillRect(cx - robeHL, 48 + bob, robeHL + robeHR, 3.5);
      drawGem(x, cx, 49.5 + bob, 3, '#4488ff');
      if (dir === 'down' || dir === 'down_right') {
        x.fillStyle = '#ccaa44';
        x.beginPath(); x.moveTo(cx - 3, 51.5 + bob); x.lineTo(cx - 5, 58 + bob); x.lineTo(cx - 1, 58 + bob); x.fill();
        x.beginPath(); x.moveTo(cx + 3, 51.5 + bob); x.lineTo(cx + 1, 58 + bob); x.lineTo(cx + 5, 58 + bob); x.fill();
      }

      // Sleeves & hands
      if (side) {
        x.fillStyle = '#1a3388';
        x.beginPath(); x.moveTo(cx - 2, 30 + bob + as); x.lineTo(cx - 10, 46 + bob + as);
        x.lineTo(cx - 2, 48 + bob + as); x.fill();
        x.strokeStyle = '#ccaa44'; x.lineWidth = 1.2;
        x.beginPath(); x.moveTo(cx - 10, 46 + bob + as); x.lineTo(cx - 2, 48 + bob + as); x.stroke();
        drawSphere(x, cx - 6, 47 + bob + as, 3.5, '#e8c8a0', '#f5ddc0', '#c0a080');
      } else {
        x.fillStyle = '#1a3388';
        x.beginPath(); x.moveTo(cx - 14, 30 + bob + as); x.lineTo(cx - 22, 46 + bob + as);
        x.lineTo(cx - 14, 48 + bob + as); x.fill();
        x.beginPath(); x.moveTo(cx + 14, 30 + bob - as); x.lineTo(cx + 22, 46 + bob - as);
        x.lineTo(cx + 14, 48 + bob - as); x.fill();
        x.strokeStyle = '#ccaa44'; x.lineWidth = 1.2;
        x.beginPath(); x.moveTo(cx - 22, 46 + bob + as); x.lineTo(cx - 14, 48 + bob + as); x.stroke();
        x.beginPath(); x.moveTo(cx + 22, 46 + bob - as); x.lineTo(cx + 14, 48 + bob - as); x.stroke();
        drawSphere(x, cx - 18, 47 + bob + as, 3.5, '#e8c8a0', '#f5ddc0', '#c0a080');
        drawSphere(x, cx + 18, 47 + bob - as, 3.5, '#e8c8a0', '#f5ddc0', '#c0a080');
      }

      // Staff
      if (side) {
        // Staff in front hand
        const sx = cx + 8;
        x.fillStyle = '#5a3a18'; x.fillRect(sx, 6 + bob, 3, 50);
        x.fillStyle = '#ccaa44';
        x.fillRect(sx - 1, 20 + bob, 5, 2); x.fillRect(sx - 1, 35 + bob, 5, 2);
        drawSphere(x, sx + 1.5, 5 + bob, 7.5, '#4488ff', '#aaccff', '#1144aa');
        const orbG = x.createRadialGradient(sx + 1.5, 5 + bob, 0, sx + 1.5, 5 + bob, 7);
        orbG.addColorStop(0, 'rgba(150,200,255,0.5)'); orbG.addColorStop(1, 'rgba(100,150,255,0)');
        x.fillStyle = orbG;
        x.beginPath(); x.arc(sx + 1.5, 5 + bob, 7, 0, Math.PI * 2); x.fill();
        x.fillStyle = `rgba(100,150,255,${0.12 + Math.sin(f * Math.PI / 2) * 0.08})`;
        x.beginPath(); x.arc(sx + 1.5, 5 + bob, 12, 0, Math.PI * 2); x.fill();
        x.fillStyle = '#ccaa44';
        for (let i = -1; i <= 1; i++) {
          x.beginPath(); x.moveTo(sx + 1.5 + i * 4, 12 + bob);
          x.lineTo(sx + 1.5 + i * 5, 6 + bob); x.lineTo(sx + 1.5 + i * 3, 6 + bob); x.fill();
        }
      } else if (dir === 'up' || dir === 'up_right') {
        // Staff behind, shaft visible
        const sx = cx + 10;
        x.fillStyle = '#5a3a18'; x.fillRect(sx, 6 + bob, 3, 50);
        x.fillStyle = '#ccaa44'; x.fillRect(sx - 1, 20 + bob, 5, 2); x.fillRect(sx - 1, 35 + bob, 5, 2);
        drawSphere(x, sx + 1.5, 5 + bob, 7.5, '#4488ff', '#aaccff', '#1144aa');
        x.fillStyle = `rgba(100,150,255,${0.12 + Math.sin(f * Math.PI / 2) * 0.08})`;
        x.beginPath(); x.arc(sx + 1.5, 5 + bob, 10, 0, Math.PI * 2); x.fill();
      } else {
        // DOWN: staff on right side (original)
        x.fillStyle = '#5a3a18'; x.fillRect(cx + 19, 6 + bob, 3, 50);
        x.fillStyle = '#ccaa44';
        x.fillRect(cx + 18, 20 + bob, 5, 2); x.fillRect(cx + 18, 35 + bob, 5, 2);
        drawSphere(x, cx + 20.5, 5 + bob, 7.5, '#4488ff', '#aaccff', '#1144aa');
        const orbG = x.createRadialGradient(cx + 20.5, 5 + bob, 0, cx + 20.5, 5 + bob, 7);
        orbG.addColorStop(0, 'rgba(150,200,255,0.5)'); orbG.addColorStop(1, 'rgba(100,150,255,0)');
        x.fillStyle = orbG;
        x.beginPath(); x.arc(cx + 20.5, 5 + bob, 7, 0, Math.PI * 2); x.fill();
        x.fillStyle = `rgba(100,150,255,${0.12 + Math.sin(f * Math.PI / 2) * 0.08})`;
        x.beginPath(); x.arc(cx + 20.5, 5 + bob, 12, 0, Math.PI * 2); x.fill();
        x.fillStyle = '#ccaa44';
        for (let i = -1; i <= 1; i++) {
          x.beginPath(); x.moveTo(cx + 20.5 + i * 4, 12 + bob);
          x.lineTo(cx + 20.5 + i * 5, 6 + bob); x.lineTo(cx + 20.5 + i * 3, 6 + bob); x.fill();
        }
      }

      // Head
      drawSphere(x, cx, 18 + bob, 10, '#e8c8a0', '#f5ddc0', '#c0a080');

      // Wizard hat (all dirs)
      const hg = x.createLinearGradient(cx, -4 + bob, cx, 16 + bob);
      hg.addColorStop(0, '#3355cc'); hg.addColorStop(0.5, '#2244aa'); hg.addColorStop(1, '#112266');
      x.fillStyle = hg;
      if (side) {
        // Side hat - tip leans right
        x.beginPath();
        x.moveTo(cx + 8, -6 + bob);
        x.bezierCurveTo(cx + 10, -2 + bob, cx - 4, 4 + bob, cx - 12, 14 + bob);
        x.lineTo(cx + 12, 14 + bob);
        x.bezierCurveTo(cx + 10, 6 + bob, cx + 8, -2 + bob, cx + 8, -6 + bob);
        x.fill();
      } else {
        x.beginPath();
        x.moveTo(cx + 3, -6 + bob);
        x.bezierCurveTo(cx + 6, -2 + bob, cx - 8, 4 + bob, cx - 16, 14 + bob);
        x.lineTo(cx + 16, 14 + bob);
        x.bezierCurveTo(cx + 12, 6 + bob, cx + 4, -2 + bob, cx + 3, -6 + bob);
        x.fill();
      }
      // Hat brim
      x.fillStyle = '#0f2060';
      x.beginPath(); x.ellipse(cx, 14 + bob, side ? 13 : 17, 4, 0, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#ccaa44';
      x.fillRect(cx - (side ? 12 : 16), 13 + bob, side ? 24 : 32, 3);
      // Hat star
      if (dir !== 'up' && dir !== 'up_right') {
        x.fillStyle = '#ffd700';
        x.beginPath(); x.arc(side ? cx + 6 : cx + 2, 2 + bob, 2.5, 0, Math.PI * 2); x.fill();
      }

      // Face / back of head
      if (dir === 'down' || dir === 'down_right') {
        // Beard
        const beardG = x.createLinearGradient(cx, 22 + bob, cx, 42 + bob);
        beardG.addColorStop(0, '#dddddd'); beardG.addColorStop(1, '#aaaaaa');
        x.fillStyle = beardG;
        x.beginPath();
        x.moveTo(cx - 5, 24 + bob);
        x.bezierCurveTo(cx - 8, 30 + bob, cx - 7, 36 + bob, cx - 3, 42 + bob);
        x.lineTo(cx + 3, 42 + bob);
        x.bezierCurveTo(cx + 7, 36 + bob, cx + 8, 30 + bob, cx + 5, 24 + bob);
        x.fill();
        x.strokeStyle = 'rgba(180,180,180,0.3)'; x.lineWidth = 0.5;
        x.beginPath(); x.moveTo(cx - 2, 26 + bob); x.lineTo(cx - 3, 40 + bob); x.stroke();
        x.beginPath(); x.moveTo(cx + 2, 26 + bob); x.lineTo(cx + 1, 40 + bob); x.stroke();
        // Eyebrows
        x.fillStyle = '#cccccc';
        if (dir === 'down_right') {
          x.fillRect(cx + 1, 14.5 + bob, 5, 1.5); x.fillRect(cx - 5, 14.5 + bob, 4, 1.2);
          x.fillStyle = '#4488ff'; x.shadowColor = '#4488ff'; x.shadowBlur = 5;
          x.fillRect(cx + 1.5, 16.5 + bob, 3.5, 2.5); x.fillRect(cx - 4.5, 16.5 + bob, 2.5, 2);
          x.shadowBlur = 0;
          x.fillStyle = '#aaccff'; x.fillRect(cx + 2, 16.5 + bob, 1, 1);
          x.fillStyle = '#d0a880'; x.fillRect(cx, 19 + bob, 2, 3);
        } else {
          x.fillRect(cx - 7, 14.5 + bob, 5, 1.5); x.fillRect(cx + 2, 14.5 + bob, 5, 1.5);
          x.fillStyle = '#4488ff'; x.shadowColor = '#4488ff'; x.shadowBlur = 5;
          x.fillRect(cx - 6, 16.5 + bob, 3.5, 2.5); x.fillRect(cx + 2.5, 16.5 + bob, 3.5, 2.5);
          x.shadowBlur = 0;
          x.fillStyle = '#aaccff';
          x.fillRect(cx - 5.5, 16.5 + bob, 1, 1); x.fillRect(cx + 3, 16.5 + bob, 1, 1);
          x.fillStyle = '#d0a880'; x.fillRect(cx - 1, 19 + bob, 2, 3);
        }
      } else if (dir === 'right') {
        // Side beard
        const beardG = x.createLinearGradient(cx, 22 + bob, cx + 4, 38 + bob);
        beardG.addColorStop(0, '#dddddd'); beardG.addColorStop(1, '#aaaaaa');
        x.fillStyle = beardG;
        x.beginPath();
        x.moveTo(cx + 2, 24 + bob);
        x.bezierCurveTo(cx + 6, 30 + bob, cx + 5, 34 + bob, cx + 2, 40 + bob);
        x.lineTo(cx - 1, 40 + bob);
        x.bezierCurveTo(cx + 2, 34 + bob, cx + 3, 28 + bob, cx - 1, 24 + bob);
        x.fill();
        // One eyebrow
        x.fillStyle = '#cccccc'; x.fillRect(cx + 2, 14.5 + bob, 5, 1.5);
        // One glowing eye
        x.fillStyle = '#4488ff'; x.shadowColor = '#4488ff'; x.shadowBlur = 5;
        x.fillRect(cx + 2.5, 16.5 + bob, 3.5, 2.5);
        x.shadowBlur = 0;
        x.fillStyle = '#aaccff'; x.fillRect(cx + 3, 16.5 + bob, 1, 1);
        // Nose
        x.fillStyle = '#d0a880'; x.fillRect(cx + 6, 19 + bob, 2, 3);
      } else {
        // UP / UP_RIGHT: back of head - hair visible under hat, no face
        x.fillStyle = '#cccccc';
        x.beginPath();
        x.arc(cx, 20 + bob, 8, 0.3, Math.PI - 0.3);
        x.fill();
        if (dir === 'up_right') {
          // Slight beard edge visible from right
          x.fillStyle = '#cccccc'; x.globalAlpha = 0.4;
          x.beginPath(); x.arc(cx + 8, 24 + bob, 3, 0, Math.PI * 2); x.fill();
          x.globalAlpha = 1;
        }
      }

      // Magic particles
      x.fillStyle = `rgba(100,180,255,${0.45 + Math.sin(f * Math.PI / 2) * 0.25})`;
      for (let i = 0; i < 5; i++) {
        const pa = f * Math.PI / 2 + i * Math.PI * 2 / 5;
        const pr = 18 + Math.sin(pa * 2) * 4;
        const px = cx + Math.cos(pa) * pr;
        const py = 42 + bob + Math.sin(pa) * 14;
        x.beginPath(); x.arc(px, py, 1.2 + Math.sin(f + i) * 0.3, 0, Math.PI * 2); x.fill();
      }

      dirs[dir].push(c);
    }
  }
  // Attack frames - staff thrust with magic burst
  const atk = {down: [], down_right: [], up: [], up_right: [], right: []};
  for (const dir of ['down', 'down_right', 'right', 'up_right', 'up']) {
    for (let f = 0; f < 4; f++) {
      const c = makeCanvas(64, 84);
      const x = c.getContext('2d');
      const cx = 32;
      const atkPhase = f / 3;
      const side = dir === 'right';
      const lean = Math.sin(atkPhase * Math.PI) * 1.5;

      draw3DShadow(x, cx, 78, 16, 5);

      // Magic attack aura (intensifies at impact)
      const auraI = 0.06 + atkPhase * 0.12;
      const auraG = x.createRadialGradient(cx, 46, 5, cx, 46, 30);
      auraG.addColorStop(0, `rgba(80,120,255,${auraI * 2})`);
      auraG.addColorStop(1, 'rgba(80,120,255,0)');
      x.fillStyle = auraG;
      x.beginPath(); x.ellipse(cx, 46, 28, 36, 0, 0, Math.PI * 2); x.fill();

      // Robe
      const robeHL = side ? 10 : 14, robeHR = side ? 16 : 14;
      const robeBL = side ? 12 : 18, robeBR = side ? 20 : 18;
      const rg = x.createLinearGradient(cx - 16, 28, cx + 16, 72);
      rg.addColorStop(0, '#2a4ab0'); rg.addColorStop(0.3, '#1e3898');
      rg.addColorStop(0.6, '#152880'); rg.addColorStop(1, '#0f2060');
      x.fillStyle = rg;
      x.beginPath();
      x.moveTo(cx - robeHL, 28 + lean); x.lineTo(cx - robeBL, 72);
      x.lineTo(cx + robeBR, 72); x.lineTo(cx + robeHR, 28 + lean); x.fill();
      // Fold shadows
      x.fillStyle = 'rgba(0,0,0,0.12)';
      x.beginPath(); x.moveTo(cx + 2, 34 + lean); x.lineTo(cx - 4, 72); x.lineTo(cx + 6, 72); x.fill();
      if (!side) { x.beginPath(); x.moveTo(cx - 6, 38 + lean); x.lineTo(cx - 10, 72); x.lineTo(cx - 4, 72); x.fill(); }
      // Star patterns
      if (dir !== 'up' && dir !== 'up_right') {
        x.fillStyle = 'rgba(200,220,255,0.15)';
        [{sx: cx - 8, sy: 40}, {sx: cx + 7, sy: 48}, {sx: cx - 4, sy: 58}].forEach(sp => {
          x.beginPath(); x.arc(sp.sx, sp.sy + lean, 1.8, 0, Math.PI * 2); x.fill();
        });
      }
      // Gold trim
      x.strokeStyle = '#ccaa44'; x.lineWidth = 2;
      x.beginPath(); x.moveTo(cx - robeBL, 72); x.lineTo(cx + robeBR, 72); x.stroke();
      if (dir === 'down' || dir === 'down_right') { x.lineWidth = 1.2; x.beginPath(); x.moveTo(cx, 28 + lean); x.lineTo(cx, 72); x.stroke(); }
      // Sash
      x.fillStyle = '#ccaa44'; x.fillRect(cx - robeHL, 48 + lean, robeHL + robeHR, 3.5);
      drawGem(x, cx, 49.5 + lean, 3, '#4488ff');

      // Attack sleeves & hands (thrusting motion)
      const thrustOff = (-4 + atkPhase * 12) * (dir === 'down' ? 1 : 1); // thrust forward
      if (side) {
        // Staff-holding arm thrusts forward
        x.fillStyle = '#1a3388';
        x.beginPath(); x.moveTo(cx - 2, 30 + lean); x.lineTo(cx - 10 + thrustOff * 0.3, 46 + lean);
        x.lineTo(cx - 2, 48 + lean); x.fill();
        x.strokeStyle = '#ccaa44'; x.lineWidth = 1.2;
        x.beginPath(); x.moveTo(cx - 10 + thrustOff * 0.3, 46 + lean); x.lineTo(cx - 2, 48 + lean); x.stroke();
        drawSphere(x, cx - 6 + thrustOff * 0.3, 47 + lean, 3.5, '#e8c8a0', '#f5ddc0', '#c0a080');
      } else {
        // Both arms: right arm thrusts staff, left arm back
        x.fillStyle = '#1a3388';
        x.beginPath(); x.moveTo(cx - 14, 30 + lean); x.lineTo(cx - 22, 46 + lean);
        x.lineTo(cx - 14, 48 + lean); x.fill();
        x.beginPath(); x.moveTo(cx + 14, 30 + lean); x.lineTo(cx + 22 + thrustOff * 0.5, 46 + lean);
        x.lineTo(cx + 14, 48 + lean); x.fill();
        x.strokeStyle = '#ccaa44'; x.lineWidth = 1.2;
        x.beginPath(); x.moveTo(cx - 22, 46 + lean); x.lineTo(cx - 14, 48 + lean); x.stroke();
        x.beginPath(); x.moveTo(cx + 22 + thrustOff * 0.5, 46 + lean); x.lineTo(cx + 14, 48 + lean); x.stroke();
        drawSphere(x, cx - 18, 47 + lean, 3.5, '#e8c8a0', '#f5ddc0', '#c0a080');
        drawSphere(x, cx + 18 + thrustOff * 0.5, 47 + lean, 3.5, '#e8c8a0', '#f5ddc0', '#c0a080');
      }

      // Staff with thrust animation
      if (side) {
        const sx = cx + 8 + thrustOff;
        x.fillStyle = '#5a3a18'; x.fillRect(sx, 6 + lean, 3, 50);
        x.fillStyle = '#ccaa44'; x.fillRect(sx - 1, 20 + lean, 5, 2); x.fillRect(sx - 1, 35 + lean, 5, 2);
        drawSphere(x, sx + 1.5, 5 + lean, 7.5, '#4488ff', '#aaccff', '#1144aa');
        // Magic burst at frame 2
        if (f >= 2) {
          const burstR = f === 2 ? 14 : 10;
          const burstA = f === 2 ? 0.5 : 0.2;
          x.fillStyle = `rgba(100,150,255,${burstA})`;
          x.beginPath(); x.arc(sx + 1.5, 5 + lean, burstR, 0, Math.PI * 2); x.fill();
          // Energy ring
          x.strokeStyle = `rgba(150,200,255,${burstA})`;
          x.lineWidth = 2;
          x.beginPath(); x.ellipse(sx + 1.5, 5 + lean, burstR + 2, burstR * 0.6, 0, 0, Math.PI * 2); x.stroke();
        } else {
          x.fillStyle = `rgba(100,150,255,0.12)`;
          x.beginPath(); x.arc(sx + 1.5, 5 + lean, 10, 0, Math.PI * 2); x.fill();
        }
        x.fillStyle = '#ccaa44';
        for (let i = -1; i <= 1; i++) { x.beginPath(); x.moveTo(sx + 1.5 + i * 4, 12 + lean); x.lineTo(sx + 1.5 + i * 5, 6 + lean); x.lineTo(sx + 1.5 + i * 3, 6 + lean); x.fill(); }
      } else if (dir === 'down' || dir === 'down_right') {
        const sx = cx + 19 + thrustOff;
        x.fillStyle = '#5a3a18'; x.fillRect(sx, 6 + lean, 3, 50);
        x.fillStyle = '#ccaa44'; x.fillRect(sx - 1, 20 + lean, 5, 2); x.fillRect(sx - 1, 35 + lean, 5, 2);
        drawSphere(x, sx + 1.5, 5 + lean, 7.5, '#4488ff', '#aaccff', '#1144aa');
        if (f >= 2) {
          const burstR = f === 2 ? 16 : 10;
          const burstA = f === 2 ? 0.55 : 0.2;
          x.fillStyle = `rgba(100,150,255,${burstA})`;
          x.beginPath(); x.arc(sx + 1.5, 5 + lean, burstR, 0, Math.PI * 2); x.fill();
          x.strokeStyle = `rgba(150,200,255,${burstA})`; x.lineWidth = 2;
          x.beginPath(); x.ellipse(sx + 1.5, 5 + lean, burstR + 2, burstR * 0.6, 0, 0, Math.PI * 2); x.stroke();
        } else {
          x.fillStyle = `rgba(100,150,255,0.12)`;
          x.beginPath(); x.arc(sx + 1.5, 5 + lean, 12, 0, Math.PI * 2); x.fill();
        }
        x.fillStyle = '#ccaa44';
        for (let i = -1; i <= 1; i++) { x.beginPath(); x.moveTo(sx + 1.5 + i * 4, 12 + lean); x.lineTo(sx + 1.5 + i * 5, 6 + lean); x.lineTo(sx + 1.5 + i * 3, 6 + lean); x.fill(); }
      } else {
        // UP: staff behind
        const sx = cx + 10;
        x.fillStyle = '#5a3a18'; x.fillRect(sx, 6 + lean, 3, 50);
        x.fillStyle = '#ccaa44'; x.fillRect(sx - 1, 20 + lean, 5, 2); x.fillRect(sx - 1, 35 + lean, 5, 2);
        drawSphere(x, sx + 1.5, 5 + lean, 7.5, '#4488ff', '#aaccff', '#1144aa');
        if (f >= 2) {
          x.fillStyle = `rgba(100,150,255,${f === 2 ? 0.4 : 0.15})`;
          x.beginPath(); x.arc(sx + 1.5, 5 + lean, f === 2 ? 12 : 8, 0, Math.PI * 2); x.fill();
        }
      }

      // Head
      drawSphere(x, cx, 18 + lean, 10, '#e8c8a0', '#f5ddc0', '#c0a080');

      // Wizard hat
      const hg = x.createLinearGradient(cx, -4 + lean, cx, 16 + lean);
      hg.addColorStop(0, '#3355cc'); hg.addColorStop(0.5, '#2244aa'); hg.addColorStop(1, '#112266');
      x.fillStyle = hg;
      if (side) {
        x.beginPath(); x.moveTo(cx + 8, -6 + lean);
        x.bezierCurveTo(cx + 10, -2 + lean, cx - 4, 4 + lean, cx - 12, 14 + lean);
        x.lineTo(cx + 12, 14 + lean);
        x.bezierCurveTo(cx + 10, 6 + lean, cx + 8, -2 + lean, cx + 8, -6 + lean); x.fill();
      } else {
        x.beginPath(); x.moveTo(cx + 3, -6 + lean);
        x.bezierCurveTo(cx + 6, -2 + lean, cx - 8, 4 + lean, cx - 16, 14 + lean);
        x.lineTo(cx + 16, 14 + lean);
        x.bezierCurveTo(cx + 12, 6 + lean, cx + 4, -2 + lean, cx + 3, -6 + lean); x.fill();
      }
      // Brim
      x.fillStyle = '#0f2060';
      x.beginPath(); x.ellipse(cx, 14 + lean, side ? 13 : 17, 4, 0, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#ccaa44'; x.fillRect(cx - (side ? 12 : 16), 13 + lean, side ? 24 : 32, 3);
      if (dir !== 'up' && dir !== 'up_right') { x.fillStyle = '#ffd700'; x.beginPath(); x.arc(side ? cx + 6 : cx + 2, 2 + lean, 2.5, 0, Math.PI * 2); x.fill(); }

      // Face
      if (dir === 'down' || dir === 'down_right') {
        const beardG = x.createLinearGradient(cx, 22 + lean, cx, 42 + lean);
        beardG.addColorStop(0, '#dddddd'); beardG.addColorStop(1, '#aaaaaa');
        x.fillStyle = beardG;
        x.beginPath(); x.moveTo(cx - 5, 24 + lean); x.bezierCurveTo(cx - 8, 30 + lean, cx - 7, 36 + lean, cx - 3, 42 + lean);
        x.lineTo(cx + 3, 42 + lean); x.bezierCurveTo(cx + 7, 36 + lean, cx + 8, 30 + lean, cx + 5, 24 + lean); x.fill();
        x.fillStyle = '#cccccc';
        if (dir === 'down_right') {
          x.fillRect(cx + 1, 14.5 + lean, 5, 1.5); x.fillRect(cx - 5, 14.5 + lean, 4, 1.2);
          x.fillStyle = '#4488ff'; x.shadowColor = '#4488ff'; x.shadowBlur = 5;
          x.fillRect(cx + 1.5, 16.5 + lean, 3.5, 2.5); x.fillRect(cx - 4.5, 16.5 + lean, 2.5, 2); x.shadowBlur = 0;
        } else {
          x.fillRect(cx - 7, 14.5 + lean, 5, 1.5); x.fillRect(cx + 2, 14.5 + lean, 5, 1.5);
          x.fillStyle = '#4488ff'; x.shadowColor = '#4488ff'; x.shadowBlur = 5;
          x.fillRect(cx - 6, 16.5 + lean, 3.5, 2.5); x.fillRect(cx + 2.5, 16.5 + lean, 3.5, 2.5); x.shadowBlur = 0;
        }
      } else if (dir === 'right') {
        const beardG = x.createLinearGradient(cx, 22 + lean, cx + 4, 38 + lean);
        beardG.addColorStop(0, '#dddddd'); beardG.addColorStop(1, '#aaaaaa');
        x.fillStyle = beardG;
        x.beginPath(); x.moveTo(cx + 2, 24 + lean); x.bezierCurveTo(cx + 6, 30 + lean, cx + 5, 34 + lean, cx + 2, 40 + lean);
        x.lineTo(cx - 1, 40 + lean); x.bezierCurveTo(cx + 2, 34 + lean, cx + 3, 28 + lean, cx - 1, 24 + lean); x.fill();
        x.fillStyle = '#cccccc'; x.fillRect(cx + 2, 14.5 + lean, 5, 1.5);
        x.fillStyle = '#4488ff'; x.shadowColor = '#4488ff'; x.shadowBlur = 5;
        x.fillRect(cx + 2.5, 16.5 + lean, 3.5, 2.5); x.shadowBlur = 0;
      } else {
        // UP / UP_RIGHT
        x.fillStyle = '#cccccc'; x.beginPath(); x.arc(cx, 20 + lean, 8, 0.3, Math.PI - 0.3); x.fill();
        if (dir === 'up_right') {
          x.fillStyle = '#cccccc'; x.globalAlpha = 0.4;
          x.beginPath(); x.arc(cx + 8, 24 + lean, 3, 0, Math.PI * 2); x.fill();
          x.globalAlpha = 1;
        }
      }

      // Magic particles (more intense during attack)
      const pAlpha = 0.4 + atkPhase * 0.4;
      x.fillStyle = `rgba(100,180,255,${pAlpha})`;
      for (let i = 0; i < 6; i++) {
        const pa = atkPhase * Math.PI * 2 + i * Math.PI * 2 / 6;
        const pr = 18 + Math.sin(pa * 2) * 4;
        x.beginPath(); x.arc(cx + Math.cos(pa) * pr, 42 + lean + Math.sin(pa) * 14, 1.5, 0, Math.PI * 2); x.fill();
      }

      atk[dir].push(c);
    }
  }

  setDirCache8('player_MAGE', {
    down: dirs.down, down_right: dirs.down_right, right: dirs.right, up_right: dirs.up_right, up: dirs.up,
    atk_down: atk.down, atk_down_right: atk.down_right, atk_right: atk.right,
    atk_up_right: atk.up_right, atk_up: atk.up
  });
}

// ============================================================
//  PLAYER ROGUE (Shadow assassin - 64x84)
// ============================================================
function genPlayerRogue() {
  const dirs = {down: [], down_right: [], up: [], up_right: [], right: []};
  for (const dir of ['down', 'down_right', 'right', 'up_right', 'up']) {
    for (let f = 0; f < 4; f++) {
      const c = makeCanvas(64, 84);
      const x = c.getContext('2d');
      const cx = 32, bob = Math.sin(f * Math.PI / 2) * 1.8;
      const lp = Math.sin(f * Math.PI / 2) * 3.5, as = Math.sin(f * Math.PI / 2) * 4;
      const side = dir === 'right';

      draw3DShadow(x, cx, 78, 15, 5);

      // Shadow cloak (larger from back)
      const cloakW = (dir === 'up' || dir === 'up_right') ? 14 : (side ? 8 : 10);
      x.fillStyle = '#2a2a35';
      x.beginPath();
      x.moveTo(cx - cloakW, 26 + bob);
      x.bezierCurveTo(cx - cloakW - 5, 40, cx - cloakW - 3 + Math.sin(f) * 2, 50, cx - cloakW + Math.sin(f) * 3, 56);
      x.lineTo(cx + cloakW - Math.sin(f) * 3, 56);
      x.bezierCurveTo(cx + cloakW + 3 - Math.sin(f) * 2, 50, cx + cloakW + 5, 40, cx + cloakW, 26 + bob);
      x.fill();
      x.strokeStyle = '#3a3a48'; x.lineWidth = 0.5;
      x.beginPath();
      x.moveTo(cx - cloakW, 26 + bob);
      x.bezierCurveTo(cx - cloakW - 5, 40, cx - cloakW - 3 + Math.sin(f) * 2, 50, cx - cloakW + Math.sin(f) * 3, 56);
      x.stroke();

      // Leather legs
      if (side) {
        const legG = x.createLinearGradient(cx - 4, 52, cx + 4, 52);
        legG.addColorStop(0, '#3a2a1a'); legG.addColorStop(0.5, '#5a4a3a'); legG.addColorStop(1, '#3a2a1a');
        x.fillStyle = legG;
        x.fillRect(cx - 4, 52 + bob, 8, 16 + lp * 0.3);
        x.fillStyle = '#2a1a10'; x.fillRect(cx - 4, 58 + bob, 8, 1.5);
        x.fillStyle = '#2a1a10';
        x.beginPath(); x.roundRect(cx - 5, 66 + bob + lp * 0.2, 10, 6, 2); x.fill();
        drawRivet(x, cx, 68 + bob + lp * 0.2, 0.8);
      } else {
        const legG = x.createLinearGradient(cx - 7, 52, cx + 7, 52);
        legG.addColorStop(0, '#3a2a1a'); legG.addColorStop(0.5, '#5a4a3a'); legG.addColorStop(1, '#3a2a1a');
        x.fillStyle = legG;
        x.fillRect(cx - 7, 52 + bob, 6, 16 + lp * 0.5);
        x.fillRect(cx + 1, 52 + bob, 6, 16 - lp * 0.5);
        x.fillStyle = '#2a1a10';
        x.fillRect(cx - 7, 58 + bob + lp * 0.2, 6, 1.5);
        x.fillRect(cx + 1, 58 + bob - lp * 0.2, 6, 1.5);
        x.fillStyle = '#2a1a10';
        x.beginPath(); x.roundRect(cx - 8, 66 + bob + lp * 0.3, 8, 6, 2); x.fill();
        x.beginPath(); x.roundRect(cx, 66 + bob - lp * 0.3, 8, 6, 2); x.fill();
        drawRivet(x, cx - 4, 68 + bob + lp * 0.3, 0.8);
        drawRivet(x, cx + 4, 68 + bob - lp * 0.3, 0.8);
      }

      // Body - leather armor
      const bodyW = side ? 18 : 24, bodyX = side ? cx - 9 : cx - 12;
      drawMetalPlate(x, bodyX, 26 + bob, bodyW, 26, '#4a3a2a', '#5a4a3a', '#3a2a1a');
      x.strokeStyle = '#3a2a1a'; x.lineWidth = 0.5; x.globalAlpha = 0.3;
      for (let i = 0; i < 4; i++) {
        x.beginPath(); x.moveTo(bodyX + 2, 30 + i * 5 + bob); x.lineTo(bodyX + bodyW - 2, 30 + i * 5 + bob); x.stroke();
      }
      x.globalAlpha = 1;
      if (dir === 'down' || dir === 'down_right') {
        x.fillStyle = '#aaaaaa';
        for (let i = 0; i < 3; i++) {
          x.fillRect(cx - 2, 28 + i * 5 + bob, 4, 2);
          drawRivet(x, cx - 3, 29 + i * 5 + bob, 0.6);
          drawRivet(x, cx + 3, 29 + i * 5 + bob, 0.6);
        }
      } else if (side) {
        x.fillStyle = '#aaaaaa';
        for (let i = 0; i < 3; i++) drawRivet(x, cx + 4, 29 + i * 5 + bob, 0.6);
      }
      x.fillStyle = '#3a2a1a'; x.fillRect(bodyX, 48 + bob, bodyW, 4);
      drawRivet(x, cx, 50 + bob, 1.5);
      if (dir !== 'up' && dir !== 'up_right') {
        x.fillStyle = '#4a3a28';
        x.beginPath(); x.roundRect(bodyX, 44 + bob, 6, 7, 1); x.fill();
        if (!side) { x.beginPath(); x.roundRect(bodyX + bodyW - 6, 44 + bob, 6, 7, 1); x.fill(); }
      }

      // Arms & daggers
      if (side) {
        drawCylinder(x, cx - 3, 28 + bob + as, 6, 18, '#4a3a2a', '#5a4a3a', '#3a2a1a');
        x.fillStyle = '#5a4a3a'; x.fillRect(cx - 3, 40 + bob + as, 6, 3);
        drawRivet(x, cx, 41.5 + bob + as, 0.6);
        drawSphere(x, cx, 48 + bob + as, 3.5, '#d4a07a', '#e8c8a0', '#b08050');
        x.save();
        x.translate(cx + 3, 42 + bob + as); x.rotate(0.2);
        const dg = x.createLinearGradient(-1, -14, 2, -14);
        dg.addColorStop(0, '#999999'); dg.addColorStop(0.5, '#eeeeee'); dg.addColorStop(1, '#aaaaaa');
        x.fillStyle = dg;
        x.beginPath(); x.moveTo(0, -14); x.lineTo(2.5, -2); x.lineTo(-0.5, -2); x.fill();
        x.fillStyle = 'rgba(255,255,255,0.3)';
        x.beginPath(); x.moveTo(0.3, -13); x.lineTo(1.5, -3); x.lineTo(0, -3); x.fill();
        x.fillStyle = '#8a6a3a'; x.fillRect(-3, -2, 7, 2);
        x.restore();
      } else {
        drawCylinder(x, cx - 17, 28 + bob + as, 6, 18, '#4a3a2a', '#5a4a3a', '#3a2a1a');
        drawCylinder(x, cx + 11, 28 + bob - as, 6, 18, '#4a3a2a', '#5a4a3a', '#3a2a1a');
        x.fillStyle = '#5a4a3a';
        x.fillRect(cx - 17, 40 + bob + as, 6, 3); x.fillRect(cx + 11, 40 + bob - as, 6, 3);
        drawRivet(x, cx - 14, 41.5 + bob + as, 0.6); drawRivet(x, cx + 14, 41.5 + bob - as, 0.6);
        drawSphere(x, cx - 14, 48 + bob + as, 3.5, '#d4a07a', '#e8c8a0', '#b08050');
        drawSphere(x, cx + 14, 48 + bob - as, 3.5, '#d4a07a', '#e8c8a0', '#b08050');
        if (dir === 'down' || dir === 'down_right') {
          x.save();
          x.translate(cx - 17, 42 + bob + as); x.rotate(-0.35);
          const dg1 = x.createLinearGradient(-1, -14, 2, -14);
          dg1.addColorStop(0, '#999999'); dg1.addColorStop(0.5, '#eeeeee'); dg1.addColorStop(1, '#aaaaaa');
          x.fillStyle = dg1;
          x.beginPath(); x.moveTo(0, -14); x.lineTo(2.5, -2); x.lineTo(-0.5, -2); x.fill();
          x.fillStyle = 'rgba(255,255,255,0.3)';
          x.beginPath(); x.moveTo(0.3, -13); x.lineTo(1.5, -3); x.lineTo(0, -3); x.fill();
          x.fillStyle = '#8a6a3a'; x.fillRect(-3, -2, 7, 2);
          x.restore();
          x.save();
          x.translate(cx + 17, 42 + bob - as); x.rotate(0.35);
          const dg2 = x.createLinearGradient(-1, -14, 2, -14);
          dg2.addColorStop(0, '#999999'); dg2.addColorStop(0.5, '#eeeeee'); dg2.addColorStop(1, '#aaaaaa');
          x.fillStyle = dg2;
          x.beginPath(); x.moveTo(0, -14); x.lineTo(2.5, -2); x.lineTo(-0.5, -2); x.fill();
          x.fillStyle = 'rgba(255,255,255,0.3)';
          x.beginPath(); x.moveTo(0.3, -13); x.lineTo(1.5, -3); x.lineTo(0, -3); x.fill();
          x.fillStyle = '#8a6a3a'; x.fillRect(-3, -2, 7, 2);
          x.restore();
        } else {
          x.fillStyle = '#8a6a3a';
          x.fillRect(cx - 16, 22 + bob, 3, 6); x.fillRect(cx + 13, 22 + bob, 3, 6);
          x.fillStyle = '#5a3a1a';
          x.fillRect(cx - 15.5, 18 + bob, 2, 5); x.fillRect(cx + 13.5, 18 + bob, 2, 5);
        }
      }

      // Head
      drawSphere(x, cx, 18 + bob, 9.5, '#e0c098', '#f0d8b8', '#b89070');

      // Hood (all directions)
      const hoodG = x.createLinearGradient(cx - 11, 7, cx + 11, 20);
      hoodG.addColorStop(0, '#333340'); hoodG.addColorStop(1, '#22222d');
      x.fillStyle = hoodG;
      x.beginPath();
      x.arc(cx, 15 + bob, 11.5, Math.PI + 0.2, -0.2);
      x.lineTo(cx + 11, 26 + bob); x.lineTo(cx - 11, 26 + bob);
      x.fill();
      x.fillStyle = 'rgba(0,0,0,0.15)';
      x.beginPath(); x.arc(cx, 16 + bob, 9, Math.PI + 0.4, -0.4); x.fill();

      if (dir === 'down' || dir === 'down_right') {
        x.fillStyle = '#1a1a25';
        x.beginPath();
        x.moveTo(cx - 7.5, 20 + bob); x.lineTo(cx + 7.5, 20 + bob);
        x.lineTo(cx + 6, 26 + bob); x.lineTo(cx - 6, 26 + bob); x.fill();
        x.strokeStyle = '#553322'; x.lineWidth = 3; x.lineCap = 'round';
        x.beginPath();
        x.moveTo(cx + 8, 14 + bob);
        x.bezierCurveTo(cx + 14, 18 + bob, cx + 16, 24 + bob, cx + 14, 30 + bob);
        x.stroke();
        x.fillStyle = '#3a3a48'; x.fillRect(cx + 12, 18 + bob, 3, 2);
        x.fillStyle = '#33cc33'; x.shadowColor = '#33cc33'; x.shadowBlur = 5;
        if (dir === 'down_right') {
          // 3/4 front-right: right eye full, left eye smaller
          x.beginPath(); x.ellipse(cx + 3, 17 + bob, 3, 2.2, 0, 0, Math.PI * 2); x.fill();
          x.beginPath(); x.ellipse(cx - 5, 17 + bob, 2, 1.8, 0, 0, Math.PI * 2); x.fill();
          x.shadowBlur = 0;
          x.fillStyle = '#111111';
          x.beginPath(); x.ellipse(cx + 3.2, 17.2 + bob, 1, 1.8, 0, 0, Math.PI * 2); x.fill();
          x.beginPath(); x.ellipse(cx - 4.8, 17.2 + bob, 0.8, 1.4, 0, 0, Math.PI * 2); x.fill();
          x.fillStyle = '#ffffff';
          x.beginPath(); x.arc(cx + 2.5, 16.2 + bob, 0.8, 0, Math.PI * 2); x.fill();
        } else {
          x.beginPath(); x.ellipse(cx - 4, 17 + bob, 3, 2.2, 0, 0, Math.PI * 2); x.fill();
          x.beginPath(); x.ellipse(cx + 4, 17 + bob, 3, 2.2, 0, 0, Math.PI * 2); x.fill();
          x.shadowBlur = 0;
          x.fillStyle = '#111111';
          x.beginPath(); x.ellipse(cx - 3.8, 17.2 + bob, 1, 1.8, 0, 0, Math.PI * 2); x.fill();
          x.beginPath(); x.ellipse(cx + 4.2, 17.2 + bob, 1, 1.8, 0, 0, Math.PI * 2); x.fill();
          x.fillStyle = '#ffffff';
          x.beginPath(); x.arc(cx - 4.5, 16.2 + bob, 0.8, 0, Math.PI * 2); x.fill();
          x.beginPath(); x.arc(cx + 3.5, 16.2 + bob, 0.8, 0, Math.PI * 2); x.fill();
        }
      } else if (dir === 'right') {
        x.fillStyle = '#1a1a25';
        x.beginPath();
        x.moveTo(cx - 2, 20 + bob); x.lineTo(cx + 7.5, 20 + bob);
        x.lineTo(cx + 6, 26 + bob); x.lineTo(cx - 1, 26 + bob); x.fill();
        x.fillStyle = '#33cc33'; x.shadowColor = '#33cc33'; x.shadowBlur = 5;
        x.beginPath(); x.ellipse(cx + 4, 17 + bob, 3, 2.2, 0, 0, Math.PI * 2); x.fill();
        x.shadowBlur = 0;
        x.fillStyle = '#111111';
        x.beginPath(); x.ellipse(cx + 4.2, 17.2 + bob, 1, 1.8, 0, 0, Math.PI * 2); x.fill();
        x.fillStyle = '#ffffff';
        x.beginPath(); x.arc(cx + 3.5, 16.2 + bob, 0.8, 0, Math.PI * 2); x.fill();
      } else {
        // UP and UP_RIGHT: back of hood
        x.strokeStyle = '#553322'; x.lineWidth = 3.5; x.lineCap = 'round';
        x.beginPath();
        x.moveTo(cx, 20 + bob);
        x.bezierCurveTo(cx + 2, 28 + bob, cx + 1, 34 + bob, cx - 1, 40 + bob);
        x.stroke();
        x.fillStyle = '#3a3a48'; x.fillRect(cx - 2, 22 + bob, 4, 2);
        x.strokeStyle = '#3a3a48'; x.lineWidth = 0.5;
        x.beginPath(); x.moveTo(cx, 6 + bob); x.lineTo(cx, 20 + bob); x.stroke();
        if (dir === 'up_right') {
          // 3/4 back-right: slight eye glow visible from side
          x.fillStyle = 'rgba(51,204,51,0.35)'; x.shadowColor = '#33cc33'; x.shadowBlur = 4;
          x.beginPath(); x.ellipse(cx + 7, 17 + bob, 1.5, 1.5, 0, 0, Math.PI * 2); x.fill();
          x.shadowBlur = 0;
        }
      }

      // Shadow particles
      x.fillStyle = `rgba(80,60,120,${0.25 + Math.sin(f * Math.PI / 2) * 0.15})`;
      for (let i = 0; i < 4; i++) {
        const pa = f * Math.PI / 2 + i * Math.PI / 2;
        const px = cx + Math.cos(pa) * 20, py = 50 + bob + Math.sin(pa) * 14;
        x.beginPath(); x.arc(px, py, 1, 0, Math.PI * 2); x.fill();
      }

      dirs[dir].push(c);
    }
  }
  // Attack frames - fast dual dagger stab
  const atk = {down: [], down_right: [], up: [], up_right: [], right: []};
  for (const dir of ['down', 'down_right', 'right', 'up_right', 'up']) {
    for (let f = 0; f < 4; f++) {
      const c = makeCanvas(64, 84);
      const x = c.getContext('2d');
      const cx = 32;
      const atkPhase = f / 3;
      const side = dir === 'right';
      const leanX = (dir === 'down_right' || dir === 'up_right') ? Math.sin(atkPhase * Math.PI) * 1.8 : 0;
      const leanY = (dir === 'down' || dir === 'down_right') ? Math.sin(atkPhase * Math.PI) * 2.5 : (dir === 'up' || dir === 'up_right') ? -Math.sin(atkPhase * Math.PI) * 2.5 : 0;
      const lean = Math.sin(atkPhase * Math.PI) * 2.5;

      draw3DShadow(x, cx, 78, 15, 5);

      // Shadow cloak
      const cloakW = (dir === 'up' || dir === 'up_right') ? 14 : (side ? 8 : 10);
      x.fillStyle = '#2a2a35';
      x.beginPath();
      x.moveTo(cx - cloakW, 26 + lean);
      x.bezierCurveTo(cx - cloakW - 5, 40, cx - cloakW - 3, 50, cx - cloakW, 56);
      x.lineTo(cx + cloakW, 56);
      x.bezierCurveTo(cx + cloakW + 5, 50, cx + cloakW + 3, 40, cx + cloakW, 26 + lean);
      x.fill();

      // Leather legs (crouched attack stance)
      if (side) {
        const legG = x.createLinearGradient(cx - 4, 52, cx + 4, 52);
        legG.addColorStop(0, '#3a2a1a'); legG.addColorStop(0.5, '#5a4a3a'); legG.addColorStop(1, '#3a2a1a');
        x.fillStyle = legG;
        x.fillRect(cx - 4, 52 + lean, 8, 16);
        x.fillStyle = '#2a1a10';
        x.beginPath(); x.roundRect(cx - 5, 66 + lean, 10, 6, 2); x.fill();
      } else {
        const legG = x.createLinearGradient(cx - 7, 52, cx + 7, 52);
        legG.addColorStop(0, '#3a2a1a'); legG.addColorStop(0.5, '#5a4a3a'); legG.addColorStop(1, '#3a2a1a');
        x.fillStyle = legG;
        const stW = atkPhase * 2;
        x.fillRect(cx - 7 - stW, 52 + lean, 6, 16);
        x.fillRect(cx + 1 + stW, 52 + lean, 6, 16);
        x.fillStyle = '#2a1a10';
        x.beginPath(); x.roundRect(cx - 8 - stW, 66 + lean, 8, 6, 2); x.fill();
        x.beginPath(); x.roundRect(cx + stW, 66 + lean, 8, 6, 2); x.fill();
      }

      // Body leather armor
      const bodyW = side ? 18 : 24, bodyX = side ? cx - 9 : cx - 12;
      drawMetalPlate(x, bodyX, 26 + lean, bodyW, 26, '#4a3a2a', '#5a4a3a', '#3a2a1a');
      x.strokeStyle = '#3a2a1a'; x.lineWidth = 0.5; x.globalAlpha = 0.3;
      for (let i = 0; i < 4; i++) { x.beginPath(); x.moveTo(bodyX + 2, 30 + i * 5 + lean); x.lineTo(bodyX + bodyW - 2, 30 + i * 5 + lean); x.stroke(); }
      x.globalAlpha = 1;
      if (dir === 'down' || dir === 'down_right') {
        x.fillStyle = '#aaaaaa';
        for (let i = 0; i < 3; i++) { x.fillRect(cx - 2, 28 + i * 5 + lean, 4, 2); drawRivet(x, cx - 3, 29 + i * 5 + lean, 0.6); drawRivet(x, cx + 3, 29 + i * 5 + lean, 0.6); }
      }
      x.fillStyle = '#3a2a1a'; x.fillRect(bodyX, 48 + lean, bodyW, 4);
      drawRivet(x, cx, 50 + lean, 1.5);

      // Arms & dagger attack animation
      // Phase: 0=crossed at chest, 0.33=right thrust, 0.67=both extended X, 1=retract
      if (side) {
        // Single arm with dagger thrusting forward
        const thrustX = -4 + atkPhase * 14;
        drawCylinder(x, cx - 3 + thrustX * 0.3, 28 + lean, 6, 18, '#4a3a2a', '#5a4a3a', '#3a2a1a');
        drawSphere(x, cx + thrustX * 0.4, 48 + lean, 3.5, '#d4a07a', '#e8c8a0', '#b08050');
        // Dagger
        x.save();
        x.translate(cx + 3 + thrustX * 0.5, 42 + lean);
        x.rotate(0.2 - atkPhase * 0.4);
        const dg = x.createLinearGradient(-1, -14, 2, -14);
        dg.addColorStop(0, '#999999'); dg.addColorStop(0.5, '#eeeeee'); dg.addColorStop(1, '#aaaaaa');
        x.fillStyle = dg;
        x.beginPath(); x.moveTo(0, -16); x.lineTo(2.5, -2); x.lineTo(-0.5, -2); x.fill();
        x.fillStyle = 'rgba(255,255,255,0.3)';
        x.beginPath(); x.moveTo(0.3, -15); x.lineTo(1.5, -3); x.lineTo(0, -3); x.fill();
        x.fillStyle = '#8a6a3a'; x.fillRect(-3, -2, 7, 2);
        x.restore();
        // Slash effect at extend
        if (f === 2) {
          x.strokeStyle = 'rgba(200,200,255,0.5)'; x.lineWidth = 2;
          x.beginPath(); x.arc(cx + 12, 36 + lean, 10, -0.5, 0.5); x.stroke();
        }
      } else {
        // Dual daggers: cross -> thrust -> X extend -> retract
        const lArmX = cx - 14 - (f === 0 ? -4 : f === 1 ? -2 : f === 2 ? 6 : 0);
        const rArmX = cx + 14 + (f === 0 ? -4 : f === 1 ? 6 : f === 2 ? 6 : 0);
        const lArmOff = f === 0 ? 4 : f === 1 ? 0 : f === 2 ? -2 : 2;
        const rArmOff = f === 0 ? 4 : f === 1 ? -4 : f === 2 ? -2 : 2;
        drawCylinder(x, lArmX - 3, 28 + lean + lArmOff, 6, 18, '#4a3a2a', '#5a4a3a', '#3a2a1a');
        drawCylinder(x, rArmX - 3, 28 + lean + rArmOff, 6, 18, '#4a3a2a', '#5a4a3a', '#3a2a1a');
        drawSphere(x, lArmX, 48 + lean + lArmOff, 3.5, '#d4a07a', '#e8c8a0', '#b08050');
        drawSphere(x, rArmX, 48 + lean + rArmOff, 3.5, '#d4a07a', '#e8c8a0', '#b08050');
        if (dir === 'down' || dir === 'down_right') {
          // Left dagger
          const lRot = f === 0 ? 0.3 : f === 1 ? -0.2 : f === 2 ? -0.5 : 0.1;
          x.save(); x.translate(lArmX - 3, 42 + lean + lArmOff); x.rotate(-0.35 + lRot);
          const dg1 = x.createLinearGradient(-1, -14, 2, -14);
          dg1.addColorStop(0, '#999999'); dg1.addColorStop(0.5, '#eeeeee'); dg1.addColorStop(1, '#aaaaaa');
          x.fillStyle = dg1;
          x.beginPath(); x.moveTo(0, -16); x.lineTo(2.5, -2); x.lineTo(-0.5, -2); x.fill();
          x.fillStyle = '#8a6a3a'; x.fillRect(-3, -2, 7, 2);
          x.restore();
          // Right dagger
          const rRot = f === 0 ? -0.3 : f === 1 ? 0.5 : f === 2 ? 0.5 : -0.1;
          x.save(); x.translate(rArmX + 3, 42 + lean + rArmOff); x.rotate(0.35 + rRot);
          const dg2 = x.createLinearGradient(-1, -14, 2, -14);
          dg2.addColorStop(0, '#999999'); dg2.addColorStop(0.5, '#eeeeee'); dg2.addColorStop(1, '#aaaaaa');
          x.fillStyle = dg2;
          x.beginPath(); x.moveTo(0, -16); x.lineTo(2.5, -2); x.lineTo(-0.5, -2); x.fill();
          x.fillStyle = '#8a6a3a'; x.fillRect(-3, -2, 7, 2);
          x.restore();
          // Slash trails at extend
          if (f === 2) {
            x.strokeStyle = 'rgba(200,200,255,0.4)'; x.lineWidth = 1.5;
            x.beginPath(); x.arc(lArmX - 6, 34 + lean, 10, 0.2, 1.2); x.stroke();
            x.beginPath(); x.arc(rArmX + 6, 34 + lean, 10, Math.PI - 1.2, Math.PI - 0.2); x.stroke();
          }
        } else {
          // UP / UP_RIGHT: daggers behind
          x.fillStyle = '#8a6a3a';
          x.fillRect(lArmX - 1.5, 22 + lean, 3, 6); x.fillRect(rArmX - 1.5, 22 + lean, 3, 6);
        }
      }

      // Head
      drawSphere(x, cx, 18 + lean, 9.5, '#e0c098', '#f0d8b8', '#b89070');

      // Hood
      const hoodG = x.createLinearGradient(cx - 11, 7, cx + 11, 20);
      hoodG.addColorStop(0, '#333340'); hoodG.addColorStop(1, '#22222d');
      x.fillStyle = hoodG;
      x.beginPath();
      x.arc(cx, 15 + lean, 11.5, Math.PI + 0.2, -0.2);
      x.lineTo(cx + 11, 26 + lean); x.lineTo(cx - 11, 26 + lean); x.fill();
      x.fillStyle = 'rgba(0,0,0,0.15)';
      x.beginPath(); x.arc(cx, 16 + lean, 9, Math.PI + 0.4, -0.4); x.fill();

      if (dir === 'down' || dir === 'down_right') {
        x.fillStyle = '#1a1a25';
        x.beginPath(); x.moveTo(cx - 7.5, 20 + lean); x.lineTo(cx + 7.5, 20 + lean); x.lineTo(cx + 6, 26 + lean); x.lineTo(cx - 6, 26 + lean); x.fill();
        // Glowing eyes (more intense during attack)
        const eyeGlow = 0.6 + atkPhase * 0.4;
        x.fillStyle = `rgba(51,204,51,${eyeGlow})`; x.shadowColor = '#33cc33'; x.shadowBlur = 6 + atkPhase * 4;
        if (dir === 'down_right') {
          // 3/4 front-right: right eye full, left eye smaller
          x.beginPath(); x.ellipse(cx + 3, 17 + lean, 3, 2.2, 0, 0, Math.PI * 2); x.fill();
          x.beginPath(); x.ellipse(cx - 5, 17 + lean, 2, 1.8, 0, 0, Math.PI * 2); x.fill();
          x.shadowBlur = 0;
          x.fillStyle = '#111111';
          x.beginPath(); x.ellipse(cx + 3.2, 17.2 + lean, 1, 1.8, 0, 0, Math.PI * 2); x.fill();
          x.beginPath(); x.ellipse(cx - 4.8, 17.2 + lean, 0.8, 1.4, 0, 0, Math.PI * 2); x.fill();
        } else {
          x.beginPath(); x.ellipse(cx - 4, 17 + lean, 3, 2.2, 0, 0, Math.PI * 2); x.fill();
          x.beginPath(); x.ellipse(cx + 4, 17 + lean, 3, 2.2, 0, 0, Math.PI * 2); x.fill();
          x.shadowBlur = 0;
          x.fillStyle = '#111111';
          x.beginPath(); x.ellipse(cx - 3.8, 17.2 + lean, 1, 1.8, 0, 0, Math.PI * 2); x.fill();
          x.beginPath(); x.ellipse(cx + 4.2, 17.2 + lean, 1, 1.8, 0, 0, Math.PI * 2); x.fill();
        }
      } else if (dir === 'right') {
        x.fillStyle = '#1a1a25';
        x.beginPath(); x.moveTo(cx - 2, 20 + lean); x.lineTo(cx + 7.5, 20 + lean); x.lineTo(cx + 6, 26 + lean); x.lineTo(cx - 1, 26 + lean); x.fill();
        x.fillStyle = `rgba(51,204,51,${0.6 + atkPhase * 0.4})`; x.shadowColor = '#33cc33'; x.shadowBlur = 6 + atkPhase * 4;
        x.beginPath(); x.ellipse(cx + 4, 17 + lean, 3, 2.2, 0, 0, Math.PI * 2); x.fill();
        x.shadowBlur = 0;
        x.fillStyle = '#111111';
        x.beginPath(); x.ellipse(cx + 4.2, 17.2 + lean, 1, 1.8, 0, 0, Math.PI * 2); x.fill();
      } else {
        // UP / UP_RIGHT: back of hood
        x.strokeStyle = '#553322'; x.lineWidth = 3.5; x.lineCap = 'round';
        x.beginPath(); x.moveTo(cx, 20 + lean);
        x.bezierCurveTo(cx + 2, 28 + lean, cx + 1, 34 + lean, cx - 1, 40 + lean); x.stroke();
        if (dir === 'up_right') {
          // 3/4 back-right: slight eye glow visible from side
          x.fillStyle = `rgba(51,204,51,${0.3 + atkPhase * 0.3})`; x.shadowColor = '#33cc33'; x.shadowBlur = 4 + atkPhase * 3;
          x.beginPath(); x.ellipse(cx + 7, 17 + lean, 1.5, 1.5, 0, 0, Math.PI * 2); x.fill();
          x.shadowBlur = 0;
        }
      }

      // Shadow particles (faster during attack)
      x.fillStyle = `rgba(80,60,120,${0.3 + atkPhase * 0.3})`;
      for (let i = 0; i < 5; i++) {
        const pa = atkPhase * Math.PI * 3 + i * Math.PI * 2 / 5;
        x.beginPath(); x.arc(cx + Math.cos(pa) * 20, 50 + lean + Math.sin(pa) * 14, 1.2, 0, Math.PI * 2); x.fill();
      }

      atk[dir].push(c);
    }
  }

  setDirCache8('player_ROGUE', {down: dirs.down, down_right: dirs.down_right, right: dirs.right, up_right: dirs.up_right, up: dirs.up, atk_down: atk.down, atk_down_right: atk.down_right, atk_right: atk.right, atk_up_right: atk.up_right, atk_up: atk.up});
}

// ============================================================
//  PLAYER HEALER (Holy priest - 64x84)
// ============================================================
function genPlayerHealer() {
  const dirs = {down: [], down_right: [], up: [], up_right: [], right: []};
  for (const dir of ['down', 'down_right', 'right', 'up_right', 'up']) {
    for (let f = 0; f < 4; f++) {
      const c = makeCanvas(64, 84);
      const x = c.getContext('2d');
      const cx = 32, bob = Math.sin(f * Math.PI / 2) * 1.5;
      const as = Math.sin(f * Math.PI / 2) * 2.5;
      const side = dir === 'right';

      draw3DShadow(x, cx, 78, 16, 5);

      // Healing aura
      const auraG = x.createRadialGradient(cx, 46, 5, cx, 46, 30);
      auraG.addColorStop(0, `rgba(255,220,100,${0.06 + Math.sin(f * Math.PI / 2) * 0.03})`);
      auraG.addColorStop(1, 'rgba(255,220,100,0)');
      x.fillStyle = auraG;
      x.beginPath(); x.ellipse(cx, 46, 28, 36, 0, 0, Math.PI * 2); x.fill();

      // White/gold robe
      const robeHL = side ? 10 : 14, robeHR = side ? 16 : 14;
      const robeBL = side ? 12 : 18, robeBR = side ? 20 : 18;
      const rg = x.createLinearGradient(cx - 16, 26, cx + 16, 72);
      rg.addColorStop(0, '#f5f5fa'); rg.addColorStop(0.3, '#e8e8f0');
      rg.addColorStop(0.6, '#dddde8'); rg.addColorStop(1, '#c8c8d0');
      x.fillStyle = rg;
      x.beginPath();
      x.moveTo(cx - robeHL, 26 + bob); x.lineTo(cx - robeBL, 72);
      x.lineTo(cx + robeBR, 72); x.lineTo(cx + robeHR, 26 + bob);
      x.fill();
      // Fold shadows
      x.fillStyle = 'rgba(0,0,0,0.07)';
      x.beginPath(); x.moveTo(cx + 3, 32 + bob);
      x.lineTo(cx - 2, 72); x.lineTo(cx + 7, 72); x.fill();
      if (!side) {
        x.beginPath(); x.moveTo(cx - 5, 36 + bob);
        x.lineTo(cx - 9, 72); x.lineTo(cx - 3, 72); x.fill();
      }
      // Gold trim bottom + center
      x.strokeStyle = '#ccaa44'; x.lineWidth = 2.5;
      x.beginPath(); x.moveTo(cx - robeBL, 72); x.lineTo(cx + robeBR, 72); x.stroke();
      if (dir === 'down' || dir === 'down_right') {
        x.lineWidth = 1.5;
        x.beginPath(); x.moveTo(cx, 26 + bob); x.lineTo(cx, 72); x.stroke();
        // Cross emblem
        x.fillStyle = '#dd3333';
        x.fillRect(cx - 2.5, 30 + bob, 5, 14);
        x.fillRect(cx - 6.5, 34 + bob, 13, 5);
      }
      // Belt
      x.fillStyle = '#ccaa44'; x.fillRect(cx - robeHL, 48 + bob, robeHL + robeHR, 3.5);
      drawGem(x, cx, 49.5 + bob, 3, '#44ff88');

      // Sleeves & hands
      if (side) {
        const slG = x.createLinearGradient(cx - 10, 28, cx, 48);
        slG.addColorStop(0, '#eeeef6'); slG.addColorStop(1, '#d5d5dd');
        x.fillStyle = slG;
        x.beginPath();
        x.moveTo(cx - 2, 28 + bob + as); x.lineTo(cx - 12, 46 + bob + as);
        x.lineTo(cx - 2, 48 + bob + as); x.fill();
        x.strokeStyle = '#ccaa44'; x.lineWidth = 1.5;
        x.beginPath(); x.moveTo(cx - 12, 46 + bob + as); x.lineTo(cx - 2, 48 + bob + as); x.stroke();
        drawSphere(x, cx - 8, 47 + bob + as, 3.5, '#f0d8c0', '#ffeedd', '#d0b8a0');
      } else {
        const slG = x.createLinearGradient(cx - 22, 28, cx - 12, 48);
        slG.addColorStop(0, '#eeeef6'); slG.addColorStop(1, '#d5d5dd');
        x.fillStyle = slG;
        x.beginPath();
        x.moveTo(cx - 14, 28 + bob + as); x.lineTo(cx - 24, 46 + bob + as);
        x.lineTo(cx - 14, 48 + bob + as); x.fill();
        x.beginPath();
        x.moveTo(cx + 14, 28 + bob - as); x.lineTo(cx + 24, 46 + bob - as);
        x.lineTo(cx + 14, 48 + bob - as); x.fill();
        x.strokeStyle = '#ccaa44'; x.lineWidth = 1.5;
        x.beginPath(); x.moveTo(cx - 24, 46 + bob + as); x.lineTo(cx - 14, 48 + bob + as); x.stroke();
        x.beginPath(); x.moveTo(cx + 24, 46 + bob - as); x.lineTo(cx + 14, 48 + bob - as); x.stroke();
        drawSphere(x, cx - 20, 47 + bob + as, 3.5, '#f0d8c0', '#ffeedd', '#d0b8a0');
        drawSphere(x, cx + 20, 47 + bob - as, 3.5, '#f0d8c0', '#ffeedd', '#d0b8a0');
      }

      // Holy staff & book
      if (side) {
        // Staff in front
        const sx = cx + 6;
        x.fillStyle = '#ccaa44'; x.fillRect(sx, 4 + bob, 3.5, 46);
        x.fillStyle = '#ffd700';
        x.fillRect(sx - 4, 4 + bob, 10, 3); x.fillRect(sx, 0 + bob, 3.5, 12);
        drawSphere(x, sx + 1.75, 0 + bob, 4, '#ffd700', '#ffee88', '#cc8800');
        x.fillStyle = `rgba(255,220,100,${0.22 + Math.sin(f * Math.PI / 2) * 0.12})`;
        x.beginPath(); x.arc(sx + 1.75, 0 + bob, 8, 0, Math.PI * 2); x.fill();
      } else if (dir === 'down' || dir === 'down_right') {
        // Staff left hand
        x.fillStyle = '#ccaa44'; x.fillRect(cx - 22, 4 + bob, 3.5, 46);
        x.fillStyle = '#ffd700';
        x.fillRect(cx - 26, 4 + bob, 10, 3); x.fillRect(cx - 22, 0 + bob, 3.5, 12);
        drawSphere(x, cx - 20.25, 0 + bob, 4, '#ffd700', '#ffee88', '#cc8800');
        x.fillStyle = `rgba(255,220,100,${0.22 + Math.sin(f * Math.PI / 2) * 0.12})`;
        x.beginPath(); x.arc(cx - 20.25, 0 + bob, 8, 0, Math.PI * 2); x.fill();
        // Holy book right hand
        x.fillStyle = '#8b4513';
        x.beginPath(); x.roundRect(cx + 15, 42 + bob - as, 10, 11, 1); x.fill();
        x.fillStyle = '#ffd700'; x.fillRect(cx + 16, 43 + bob - as, 8, 2);
        x.fillStyle = '#f5f5dc'; x.fillRect(cx + 16, 46 + bob - as, 8, 6);
        x.fillStyle = '#dd3333';
        x.fillRect(cx + 19.5, 47 + bob - as, 1.5, 4);
        x.fillRect(cx + 18, 48.5 + bob - as, 4, 1.5);
        x.fillStyle = 'rgba(255,255,200,0.1)';
        x.beginPath(); x.arc(cx + 20, 48 + bob - as, 6, 0, Math.PI * 2); x.fill();
      } else {
        // UP / UP_RIGHT: staff behind
        x.fillStyle = '#ccaa44'; x.fillRect(cx + 8, 4 + bob, 3.5, 46);
        x.fillStyle = '#ffd700';
        x.fillRect(cx + 4, 4 + bob, 10, 3); x.fillRect(cx + 8, 0 + bob, 3.5, 12);
        drawSphere(x, cx + 9.75, 0 + bob, 4, '#ffd700', '#ffee88', '#cc8800');
        x.fillStyle = `rgba(255,220,100,${0.15 + Math.sin(f * Math.PI / 2) * 0.08})`;
        x.beginPath(); x.arc(cx + 9.75, 0 + bob, 6, 0, Math.PI * 2); x.fill();
      }

      // Heal particles
      x.fillStyle = `rgba(100,255,100,${0.4 + Math.sin(f * Math.PI / 2) * 0.2})`;
      for (let i = 0; i < 5; i++) {
        const pa = f * Math.PI / 2 + i * Math.PI * 2 / 5;
        const px = cx + Math.cos(pa) * 20, py = 40 + bob + Math.sin(pa) * 16;
        x.fillRect(px - 2.5, py - 0.5, 5, 1);
        x.fillRect(px - 0.5, py - 2.5, 1, 5);
      }

      // Head
      drawSphere(x, cx, 18 + bob, 10, '#f0d8c0', '#ffeedd', '#d0b8a0');

      // Hair (all directions)
      const hairG = x.createLinearGradient(cx - 10, 8, cx + 10, 30);
      hairG.addColorStop(0, '#eebb66'); hairG.addColorStop(0.5, '#ddbb66'); hairG.addColorStop(1, '#bb9944');
      x.fillStyle = hairG;
      x.beginPath(); x.arc(cx, 14 + bob, 10.5, Math.PI, 0); x.fill();

      if (dir === 'down' || dir === 'down_right') {
        // Side hair flowing
        x.fillRect(cx - 10.5, 14 + bob, 4, 16);
        x.fillRect(cx + 6.5, 14 + bob, 4, 16);
        // Hair shine
        x.fillStyle = 'rgba(255,230,150,0.35)';
        x.beginPath(); x.arc(cx - 3, 10 + bob, 5.5, Math.PI, 0); x.fill();
        x.strokeStyle = 'rgba(200,170,80,0.2)'; x.lineWidth = 0.5;
        x.beginPath(); x.moveTo(cx - 8, 14 + bob); x.lineTo(cx - 9, 28 + bob); x.stroke();
        x.beginPath(); x.moveTo(cx + 8, 14 + bob); x.lineTo(cx + 9, 28 + bob); x.stroke();
        // Circlet
        x.fillStyle = '#ffd700'; x.fillRect(cx - 9, 10 + bob, 18, 3);
        drawGem(x, cx, 11.5 + bob, 3, '#44ff88');
        // Eyes
        if (dir === 'down_right') {
          // 3/4 front-right: right eye full, left eye smaller
          x.fillStyle = '#ffffff';
          x.fillRect(cx + 1, 16.5 + bob, 4.5, 3.5); x.fillRect(cx - 6, 16.5 + bob, 3.5, 3);
          x.fillStyle = '#44aa88';
          x.fillRect(cx + 2, 17 + bob, 3, 3); x.fillRect(cx - 5.5, 17 + bob, 2.5, 2.5);
          x.fillStyle = '#223344';
          x.fillRect(cx + 3, 17.5 + bob, 1.5, 2); x.fillRect(cx - 4.5, 17.5 + bob, 1.2, 1.8);
          x.fillStyle = '#ffffff';
          x.fillRect(cx + 1.5, 16.5 + bob, 1, 1); x.fillRect(cx - 5.5, 16.5 + bob, 0.8, 0.8);
        } else {
          x.fillStyle = '#ffffff';
          x.fillRect(cx - 6.5, 16.5 + bob, 4.5, 3.5); x.fillRect(cx + 2, 16.5 + bob, 4.5, 3.5);
          x.fillStyle = '#44aa88';
          x.fillRect(cx - 5.5, 17 + bob, 3, 3); x.fillRect(cx + 3, 17 + bob, 3, 3);
          x.fillStyle = '#223344';
          x.fillRect(cx - 4.5, 17.5 + bob, 1.5, 2); x.fillRect(cx + 4, 17.5 + bob, 1.5, 2);
          x.fillStyle = '#ffffff';
          x.fillRect(cx - 5.5, 16.5 + bob, 1, 1); x.fillRect(cx + 3, 16.5 + bob, 1, 1);
        }
        // Nose
        x.fillStyle = '#e0c0a0'; x.fillRect(cx - 1, 20 + bob, 2, 2.5);
        // Smile
        x.strokeStyle = '#d0b8a0'; x.lineWidth = 1; x.lineCap = 'round';
        x.beginPath(); x.arc(cx, 23.5 + bob, 3, 0.2, Math.PI - 0.2); x.stroke();
        // Eyebrows
        x.strokeStyle = '#bb9944'; x.lineWidth = 1;
        x.beginPath(); x.moveTo(cx - 6.5, 16 + bob); x.quadraticCurveTo(cx - 4, 14.5 + bob, cx - 2, 15.5 + bob); x.stroke();
        x.beginPath(); x.moveTo(cx + 6.5, 16 + bob); x.quadraticCurveTo(cx + 4, 14.5 + bob, cx + 2, 15.5 + bob); x.stroke();
      } else if (dir === 'right') {
        // Side hair
        x.fillRect(cx + 6.5, 14 + bob, 4, 14);
        x.fillStyle = 'rgba(255,230,150,0.35)';
        x.beginPath(); x.arc(cx, 10 + bob, 5, Math.PI, 0); x.fill();
        // Circlet
        x.fillStyle = '#ffd700'; x.fillRect(cx - 5, 10 + bob, 14, 3);
        drawGem(x, cx + 3, 11.5 + bob, 2.5, '#44ff88');
        // One eye
        x.fillStyle = '#ffffff'; x.fillRect(cx + 2, 16.5 + bob, 4.5, 3.5);
        x.fillStyle = '#44aa88'; x.fillRect(cx + 3, 17 + bob, 3, 3);
        x.fillStyle = '#223344'; x.fillRect(cx + 4, 17.5 + bob, 1.5, 2);
        x.fillStyle = '#ffffff'; x.fillRect(cx + 3, 16.5 + bob, 1, 1);
        // Nose
        x.fillStyle = '#e0c0a0'; x.fillRect(cx + 7, 20 + bob, 2, 2.5);
        // Eyebrow
        x.strokeStyle = '#bb9944'; x.lineWidth = 1;
        x.beginPath(); x.moveTo(cx + 6.5, 16 + bob); x.quadraticCurveTo(cx + 4, 14.5 + bob, cx + 2, 15.5 + bob); x.stroke();
      } else {
        // UP / UP_RIGHT: back of hair, long flowing down
        x.fillStyle = hairG;
        x.fillRect(cx - 10, 14 + bob, 20, 20);
        x.fillStyle = 'rgba(200,170,80,0.15)';
        x.beginPath(); x.arc(cx, 10 + bob, 5.5, Math.PI, 0); x.fill();
        x.strokeStyle = 'rgba(200,170,80,0.25)'; x.lineWidth = 0.5;
        x.beginPath(); x.moveTo(cx - 5, 14 + bob); x.lineTo(cx - 6, 32 + bob); x.stroke();
        x.beginPath(); x.moveTo(cx + 5, 14 + bob); x.lineTo(cx + 6, 32 + bob); x.stroke();
        x.beginPath(); x.moveTo(cx, 14 + bob); x.lineTo(cx, 34 + bob); x.stroke();
        // Circlet from behind
        x.fillStyle = '#ffd700'; x.fillRect(cx - 9, 10 + bob, 18, 3);
        if (dir === 'up_right') {
          // 3/4 back-right: slight ear/cheek visible
          x.fillStyle = '#f0d8c0';
          x.beginPath(); x.ellipse(cx + 9, 17 + bob, 2, 3, 0, 0, Math.PI * 2); x.fill();
        }
      }

      dirs[dir].push(c);
    }
  }
  // Attack frames - holy staff swing with golden glow
  const atk = {down: [], down_right: [], up: [], up_right: [], right: []};
  for (const dir of ['down', 'down_right', 'right', 'up_right', 'up']) {
    for (let f = 0; f < 4; f++) {
      const c = makeCanvas(64, 84);
      const x = c.getContext('2d');
      const cx = 32;
      const atkPhase = f / 3;
      const side = dir === 'right';
      const lean = Math.sin(atkPhase * Math.PI) * 1.5;

      draw3DShadow(x, cx, 78, 16, 5);

      // Healing aura (intensifies at impact)
      const auraI = 0.06 + atkPhase * 0.14;
      const auraG = x.createRadialGradient(cx, 46, 5, cx, 46, 30);
      auraG.addColorStop(0, `rgba(255,220,100,${auraI * 2.5})`);
      auraG.addColorStop(1, 'rgba(255,220,100,0)');
      x.fillStyle = auraG;
      x.beginPath(); x.ellipse(cx, 46, 28, 36, 0, 0, Math.PI * 2); x.fill();

      // White/gold robe
      const robeHL = side ? 10 : 14, robeHR = side ? 16 : 14;
      const robeBL = side ? 12 : 18, robeBR = side ? 20 : 18;
      const rg = x.createLinearGradient(cx - 16, 26, cx + 16, 72);
      rg.addColorStop(0, '#f5f5fa'); rg.addColorStop(0.3, '#e8e8f0');
      rg.addColorStop(0.6, '#dddde8'); rg.addColorStop(1, '#c8c8d0');
      x.fillStyle = rg;
      x.beginPath();
      x.moveTo(cx - robeHL, 26 + lean); x.lineTo(cx - robeBL, 72);
      x.lineTo(cx + robeBR, 72); x.lineTo(cx + robeHR, 26 + lean); x.fill();
      // Fold shadows
      x.fillStyle = 'rgba(0,0,0,0.07)';
      x.beginPath(); x.moveTo(cx + 3, 32 + lean); x.lineTo(cx - 2, 72); x.lineTo(cx + 7, 72); x.fill();
      if (!side) { x.beginPath(); x.moveTo(cx - 5, 36 + lean); x.lineTo(cx - 9, 72); x.lineTo(cx - 3, 72); x.fill(); }
      // Gold trim
      x.strokeStyle = '#ccaa44'; x.lineWidth = 2.5;
      x.beginPath(); x.moveTo(cx - robeBL, 72); x.lineTo(cx + robeBR, 72); x.stroke();
      if (dir === 'down' || dir === 'down_right') {
        x.lineWidth = 1.5; x.beginPath(); x.moveTo(cx, 26 + lean); x.lineTo(cx, 72); x.stroke();
        x.fillStyle = '#dd3333'; x.fillRect(cx - 2.5, 30 + lean, 5, 14); x.fillRect(cx - 6.5, 34 + lean, 13, 5);
      }
      // Belt
      x.fillStyle = '#ccaa44'; x.fillRect(cx - robeHL, 48 + lean, robeHL + robeHR, 3.5);
      drawGem(x, cx, 49.5 + lean, 3, '#44ff88');

      // Sleeves & hands (sweeping motion)
      const sweepAngle = -0.5 + atkPhase * 1.5;
      if (side) {
        const slG = x.createLinearGradient(cx - 10, 28, cx, 48);
        slG.addColorStop(0, '#eeeef6'); slG.addColorStop(1, '#d5d5dd');
        x.fillStyle = slG;
        const handX = cx - 8 + Math.sin(sweepAngle) * 10;
        const handY = 40 + lean + Math.cos(sweepAngle) * 6;
        x.beginPath(); x.moveTo(cx - 2, 28 + lean); x.lineTo(handX - 4, handY);
        x.lineTo(cx - 2, handY + 2); x.fill();
        x.strokeStyle = '#ccaa44'; x.lineWidth = 1.5;
        x.beginPath(); x.moveTo(handX - 4, handY); x.lineTo(cx - 2, handY + 2); x.stroke();
        drawSphere(x, handX, handY + 1, 3.5, '#f0d8c0', '#ffeedd', '#d0b8a0');
      } else {
        const slG = x.createLinearGradient(cx - 22, 28, cx - 12, 48);
        slG.addColorStop(0, '#eeeef6'); slG.addColorStop(1, '#d5d5dd');
        x.fillStyle = slG;
        // Left arm: holds book / stable
        x.beginPath(); x.moveTo(cx - 14, 28 + lean); x.lineTo(cx - 24, 46 + lean);
        x.lineTo(cx - 14, 48 + lean); x.fill();
        // Right arm: sweeps staff
        const rHandX = cx + 20 + Math.sin(sweepAngle) * 8;
        const rHandY = 40 + lean + Math.cos(sweepAngle) * 6;
        x.beginPath(); x.moveTo(cx + 14, 28 + lean); x.lineTo(rHandX, rHandY);
        x.lineTo(cx + 14, rHandY + 2); x.fill();
        x.strokeStyle = '#ccaa44'; x.lineWidth = 1.5;
        x.beginPath(); x.moveTo(cx - 24, 46 + lean); x.lineTo(cx - 14, 48 + lean); x.stroke();
        x.beginPath(); x.moveTo(rHandX, rHandY); x.lineTo(cx + 14, rHandY + 2); x.stroke();
        drawSphere(x, cx - 20, 47 + lean, 3.5, '#f0d8c0', '#ffeedd', '#d0b8a0');
        drawSphere(x, rHandX + 2, rHandY + 1, 3.5, '#f0d8c0', '#ffeedd', '#d0b8a0');
      }

      // Holy staff with sweep and glow burst
      if (side) {
        const staffAngle = -0.8 + atkPhase * 1.6;
        const sx = cx + 6;
        x.save();
        x.translate(sx, 30 + lean);
        x.rotate(staffAngle);
        x.fillStyle = '#ccaa44'; x.fillRect(-1.75, -26, 3.5, 46);
        x.fillStyle = '#ffd700';
        x.fillRect(-5.75, -26, 10, 3); x.fillRect(-1.75, -30, 3.5, 12);
        drawSphere(x, 0, -30, 4, '#ffd700', '#ffee88', '#cc8800');
        // Glow burst at frames 2-3
        if (f >= 2) {
          const glowR = f === 2 ? 12 : 8;
          const glowA = f === 2 ? 0.5 : 0.2;
          x.fillStyle = `rgba(255,220,100,${glowA})`;
          x.beginPath(); x.arc(0, -30, glowR, 0, Math.PI * 2); x.fill();
          x.strokeStyle = `rgba(255,200,50,${glowA})`; x.lineWidth = 2;
          x.beginPath(); x.ellipse(0, -30, glowR + 3, glowR * 0.7, 0, 0, Math.PI * 2); x.stroke();
        } else {
          x.fillStyle = 'rgba(255,220,100,0.15)';
          x.beginPath(); x.arc(0, -30, 8, 0, Math.PI * 2); x.fill();
        }
        x.restore();
      } else if (dir === 'down' || dir === 'down_right') {
        const staffAngle = -0.6 + atkPhase * 1.2;
        x.save();
        x.translate(cx - 22, 30 + lean);
        x.rotate(staffAngle - 0.3);
        x.fillStyle = '#ccaa44'; x.fillRect(-1.75, -26, 3.5, 46);
        x.fillStyle = '#ffd700';
        x.fillRect(-5.75, -26, 10, 3); x.fillRect(-1.75, -30, 3.5, 12);
        drawSphere(x, 0, -30, 4, '#ffd700', '#ffee88', '#cc8800');
        if (f >= 2) {
          const glowR = f === 2 ? 14 : 9;
          const glowA = f === 2 ? 0.55 : 0.2;
          x.fillStyle = `rgba(255,220,100,${glowA})`;
          x.beginPath(); x.arc(0, -30, glowR, 0, Math.PI * 2); x.fill();
          x.strokeStyle = `rgba(255,200,50,${glowA})`; x.lineWidth = 2;
          x.beginPath(); x.ellipse(0, -30, glowR + 3, glowR * 0.7, 0, 0, Math.PI * 2); x.stroke();
        } else {
          x.fillStyle = 'rgba(255,220,100,0.18)';
          x.beginPath(); x.arc(0, -30, 8, 0, Math.PI * 2); x.fill();
        }
        x.restore();
        // Holy book in right hand
        x.fillStyle = '#8b4513';
        x.beginPath(); x.roundRect(cx + 15, 42 + lean, 10, 11, 1); x.fill();
        x.fillStyle = '#ffd700'; x.fillRect(cx + 16, 43 + lean, 8, 2);
        x.fillStyle = '#f5f5dc'; x.fillRect(cx + 16, 46 + lean, 8, 6);
        x.fillStyle = '#dd3333'; x.fillRect(cx + 19.5, 47 + lean, 1.5, 4); x.fillRect(cx + 18, 48.5 + lean, 4, 1.5);
      } else {
        // UP / UP_RIGHT: staff behind with glow
        x.fillStyle = '#ccaa44'; x.fillRect(cx + 8, 4 + lean, 3.5, 46);
        x.fillStyle = '#ffd700';
        x.fillRect(cx + 4, 4 + lean, 10, 3); x.fillRect(cx + 8, 0 + lean, 3.5, 12);
        drawSphere(x, cx + 9.75, 0 + lean, 4, '#ffd700', '#ffee88', '#cc8800');
        if (f >= 2) {
          x.fillStyle = `rgba(255,220,100,${f === 2 ? 0.35 : 0.15})`;
          x.beginPath(); x.arc(cx + 9.75, 0 + lean, f === 2 ? 10 : 6, 0, Math.PI * 2); x.fill();
        }
      }

      // Healing cross particles (brighter during attack)
      const pAlpha = 0.4 + atkPhase * 0.4;
      x.fillStyle = `rgba(100,255,100,${pAlpha})`;
      for (let i = 0; i < 6; i++) {
        const pa = atkPhase * Math.PI * 2 + i * Math.PI * 2 / 6;
        const px = cx + Math.cos(pa) * 20, py = 40 + lean + Math.sin(pa) * 16;
        x.fillRect(px - 2.5, py - 0.5, 5, 1);
        x.fillRect(px - 0.5, py - 2.5, 1, 5);
      }

      // Head
      drawSphere(x, cx, 18 + lean, 10, '#f0d8c0', '#ffeedd', '#d0b8a0');

      // Hair
      const hairG = x.createLinearGradient(cx - 10, 8, cx + 10, 30);
      hairG.addColorStop(0, '#eebb66'); hairG.addColorStop(0.5, '#ddbb66'); hairG.addColorStop(1, '#bb9944');
      x.fillStyle = hairG;
      x.beginPath(); x.arc(cx, 14 + lean, 10.5, Math.PI, 0); x.fill();

      if (dir === 'down' || dir === 'down_right') {
        x.fillStyle = hairG;
        x.fillRect(cx - 10.5, 14 + lean, 4, 16); x.fillRect(cx + 6.5, 14 + lean, 4, 16);
        // Circlet
        x.fillStyle = '#ffd700'; x.fillRect(cx - 9, 10 + lean, 18, 3);
        drawGem(x, cx, 11.5 + lean, 3, '#44ff88');
        // Eyes
        if (dir === 'down_right') {
          // 3/4 front-right: right eye full, left eye smaller
          x.fillStyle = '#ffffff';
          x.fillRect(cx + 1, 16.5 + lean, 4.5, 3.5); x.fillRect(cx - 6, 16.5 + lean, 3.5, 3);
          x.fillStyle = '#44aa88';
          x.fillRect(cx + 2, 17 + lean, 3, 3); x.fillRect(cx - 5.5, 17 + lean, 2.5, 2.5);
          x.fillStyle = '#223344';
          x.fillRect(cx + 3, 17.5 + lean, 1.5, 2); x.fillRect(cx - 4.5, 17.5 + lean, 1.2, 1.8);
        } else {
          x.fillStyle = '#ffffff';
          x.fillRect(cx - 6.5, 16.5 + lean, 4.5, 3.5); x.fillRect(cx + 2, 16.5 + lean, 4.5, 3.5);
          x.fillStyle = '#44aa88';
          x.fillRect(cx - 5.5, 17 + lean, 3, 3); x.fillRect(cx + 3, 17 + lean, 3, 3);
          x.fillStyle = '#223344';
          x.fillRect(cx - 4.5, 17.5 + lean, 1.5, 2); x.fillRect(cx + 4, 17.5 + lean, 1.5, 2);
        }
      } else if (dir === 'right') {
        x.fillStyle = hairG; x.fillRect(cx + 6.5, 14 + lean, 4, 14);
        x.fillStyle = '#ffd700'; x.fillRect(cx - 5, 10 + lean, 14, 3);
        drawGem(x, cx + 3, 11.5 + lean, 2.5, '#44ff88');
        x.fillStyle = '#ffffff'; x.fillRect(cx + 2, 16.5 + lean, 4.5, 3.5);
        x.fillStyle = '#44aa88'; x.fillRect(cx + 3, 17 + lean, 3, 3);
        x.fillStyle = '#223344'; x.fillRect(cx + 4, 17.5 + lean, 1.5, 2);
      } else {
        // UP / UP_RIGHT: back of hair
        x.fillStyle = hairG; x.fillRect(cx - 10, 14 + lean, 20, 20);
        x.fillStyle = '#ffd700'; x.fillRect(cx - 9, 10 + lean, 18, 3);
        if (dir === 'up_right') {
          // 3/4 back-right: slight ear visible
          x.fillStyle = '#f0d8c0';
          x.beginPath(); x.ellipse(cx + 9, 17 + lean, 2, 3, 0, 0, Math.PI * 2); x.fill();
        }
      }

      atk[dir].push(c);
    }
  }

  setDirCache8('player_HEALER', {down: dirs.down, down_right: dirs.down_right, right: dirs.right, up_right: dirs.up_right, up: dirs.up, atk_down: atk.down, atk_down_right: atk.down_right, atk_right: atk.right, atk_up_right: atk.up_right, atk_up: atk.up});
}

// ============================================================
//  PLAYER ARCHER (Elven ranger - 64x84)
// ============================================================
function genPlayerArcher() {
  const dirs = {down: [], down_right: [], up: [], up_right: [], right: []};
  for (const dir of ['down', 'down_right', 'right', 'up_right', 'up']) {
    for (let f = 0; f < 4; f++) {
      const c = makeCanvas(64, 84);
      const x = c.getContext('2d');
      const cx = 32, bob = Math.sin(f * Math.PI / 2) * 1.5;
      const as = Math.sin(f * Math.PI / 2) * 2.5;
      const lp = Math.sin(f * Math.PI / 2) * 3;
      const side = dir === 'right';

      draw3DShadow(x, cx, 78, 15, 5);

      // Nature aura
      x.fillStyle = `rgba(100,220,60,${0.04 + Math.sin(f * Math.PI / 2) * 0.02})`;
      x.beginPath(); x.ellipse(cx, 46, 24, 32, 0, 0, Math.PI * 2); x.fill();

      // Short ranger cloak (more visible from back)
      if (dir === 'up' || dir === 'up_right') {
        x.fillStyle = '#2a5a18'; x.globalAlpha = 0.7;
        x.beginPath();
        x.moveTo(cx - 14, 26 + bob); x.lineTo(cx - 20, 56 + bob);
        x.lineTo(cx + 20, 56 + bob); x.lineTo(cx + 14, 26 + bob);
        x.fill();
        x.globalAlpha = 1;
      } else if (dir === 'down' || dir === 'down_right') {
        x.fillStyle = '#2a5a18'; x.globalAlpha = 0.65;
        x.beginPath();
        x.moveTo(cx - 10, 26 + bob); x.lineTo(cx - 18, 52 + bob);
        x.lineTo(cx - 8, 54 + bob); x.lineTo(cx - 8, 28 + bob);
        x.fill();
        x.globalAlpha = 1;
      } else {
        x.fillStyle = '#2a5a18'; x.globalAlpha = 0.6;
        x.beginPath();
        x.moveTo(cx - 4, 26 + bob); x.lineTo(cx - 10, 50 + bob);
        x.lineTo(cx - 2, 52 + bob); x.lineTo(cx - 2, 28 + bob);
        x.fill();
        x.globalAlpha = 1;
      }

      // Leather boots
      if (side) {
        const bootG = x.createLinearGradient(cx - 5, 58, cx + 5, 70);
        bootG.addColorStop(0, '#5a4020'); bootG.addColorStop(1, '#3a2810');
        x.fillStyle = bootG;
        x.fillRect(cx - 4, 58 + bob, 8, 14 + lp * 0.2);
        x.strokeStyle = '#8a6a3a'; x.lineWidth = 1;
        x.beginPath(); x.moveTo(cx - 4, 62 + bob); x.lineTo(cx + 4, 62 + bob); x.stroke();
        x.beginPath(); x.moveTo(cx - 4, 66 + bob); x.lineTo(cx + 4, 66 + bob); x.stroke();
        drawRivet(x, cx, 62 + bob, 0.6);
      } else {
        const bootG = x.createLinearGradient(cx - 8, 58, cx + 8, 70);
        bootG.addColorStop(0, '#5a4020'); bootG.addColorStop(1, '#3a2810');
        x.fillStyle = bootG;
        x.fillRect(cx - 8, 58 + bob, 6, 14 + lp * 0.3);
        x.fillRect(cx + 2, 58 + bob, 6, 14 - lp * 0.3);
        x.strokeStyle = '#8a6a3a'; x.lineWidth = 1;
        x.beginPath(); x.moveTo(cx - 8, 62 + bob); x.lineTo(cx - 2, 62 + bob); x.stroke();
        x.beginPath(); x.moveTo(cx + 2, 62 + bob); x.lineTo(cx + 8, 62 + bob); x.stroke();
        x.beginPath(); x.moveTo(cx - 8, 66 + bob); x.lineTo(cx - 2, 66 + bob); x.stroke();
        x.beginPath(); x.moveTo(cx + 2, 66 + bob); x.lineTo(cx + 8, 66 + bob); x.stroke();
        drawRivet(x, cx - 5, 62 + bob, 0.6); drawRivet(x, cx + 5, 62 + bob, 0.6);
      }

      // Tunic (forest green)
      const bodyW = side ? 20 : 26, bodyX = side ? cx - 10 : cx - 13;
      const tg = x.createLinearGradient(bodyX, 26, bodyX + bodyW, 58);
      tg.addColorStop(0, '#4a8a30'); tg.addColorStop(0.35, '#3d7a25');
      tg.addColorStop(0.7, '#2a5a18'); tg.addColorStop(1, '#1e4a12');
      x.fillStyle = tg;
      x.beginPath();
      x.moveTo(bodyX + 1, 26 + bob); x.lineTo(bodyX - 1, 58 + bob);
      x.lineTo(bodyX + bodyW + 1, 58 + bob); x.lineTo(bodyX + bodyW - 1, 26 + bob);
      x.fill();
      // Tunic fold
      x.fillStyle = 'rgba(0,0,0,0.08)';
      x.beginPath(); x.moveTo(cx + 2, 30 + bob);
      x.lineTo(cx - 2, 58 + bob); x.lineTo(cx + 6, 58 + bob); x.fill();
      // Lacing (front only)
      if (dir === 'down' || dir === 'down_right') {
        x.strokeStyle = '#2a3a12'; x.lineWidth = 0.8;
        for (let i = 0; i < 4; i++) {
          const ly = 30 + i * 5 + bob;
          x.beginPath(); x.moveTo(cx - 2, ly); x.lineTo(cx + 2, ly + 2); x.stroke();
          x.beginPath(); x.moveTo(cx + 2, ly); x.lineTo(cx - 2, ly + 2); x.stroke();
        }
      }
      // Belt
      x.fillStyle = '#6a4a2a'; x.fillRect(bodyX - 1, 48 + bob, bodyW + 2, 3.5);
      drawRivet(x, cx, 49.5 + bob, 1.5);

      // Quiver (on back, more visible from back)
      if (dir === 'up' || dir === 'up_right') {
        x.fillStyle = '#5a3a1a';
        x.save(); x.translate(cx + 2, 22 + bob); x.rotate(0.05);
        x.beginPath(); x.roundRect(-4, 0, 8, 28, 2); x.fill();
        x.fillStyle = '#dddddd';
        for (let i = 0; i < 5; i++) x.fillRect(-3 + i * 1.5, -3 - i * 0.4, 1.5, 4);
        x.fillStyle = '#aaaacc';
        for (let i = 0; i < 5; i++) {
          x.beginPath(); x.moveTo(-2.5 + i * 1.5, -4 - i * 0.4);
          x.lineTo(-2 + i * 1.5, -6 - i * 0.4); x.lineTo(-1.5 + i * 1.5, -4 - i * 0.4); x.fill();
        }
        x.restore();
      } else {
        x.fillStyle = '#5a3a1a';
        x.save(); x.translate(cx + 14, 22 + bob); x.rotate(0.15);
        x.beginPath(); x.roundRect(-3.5, 0, 7, 26, 2); x.fill();
        x.fillStyle = '#dddddd';
        for (let i = 0; i < 4; i++) x.fillRect(-2 + i * 1.5, -3 - i * 0.5, 1.5, 4);
        x.fillStyle = '#aaaacc';
        for (let i = 0; i < 4; i++) {
          x.beginPath(); x.moveTo(-1.5 + i * 1.5, -4 - i * 0.5);
          x.lineTo(-1 + i * 1.5, -6 - i * 0.5); x.lineTo(-0.5 + i * 1.5, -4 - i * 0.5); x.fill();
        }
        x.restore();
      }

      // Sleeves & hands
      if (side) {
        const slG = x.createLinearGradient(cx - 8, 28, cx, 42);
        slG.addColorStop(0, '#4a8a30'); slG.addColorStop(1, '#3a6a20');
        x.fillStyle = slG;
        x.beginPath();
        x.moveTo(cx - 2, 28 + bob + as); x.lineTo(cx - 8, 40 + bob + as);
        x.lineTo(cx - 2, 42 + bob + as); x.fill();
        x.fillStyle = '#6a4a2a'; x.fillRect(cx - 8, 38 + bob + as, 7, 3);
        drawRivet(x, cx - 4.5, 39.5 + bob + as, 0.5);
        drawSphere(x, cx - 4, 42 + bob + as, 3, '#f0d8c0', '#ffeedd', '#d0b8a0');
      } else {
        const slG = x.createLinearGradient(cx - 18, 28, cx - 12, 42);
        slG.addColorStop(0, '#4a8a30'); slG.addColorStop(1, '#3a6a20');
        x.fillStyle = slG;
        x.beginPath();
        x.moveTo(cx - 12, 28 + bob + as); x.lineTo(cx - 18, 40 + bob + as);
        x.lineTo(cx - 12, 42 + bob + as); x.fill();
        x.beginPath();
        x.moveTo(cx + 12, 28 + bob - as); x.lineTo(cx + 18, 40 + bob - as);
        x.lineTo(cx + 12, 42 + bob - as); x.fill();
        x.fillStyle = '#6a4a2a';
        x.fillRect(cx - 18, 38 + bob + as, 7, 3); x.fillRect(cx + 12, 38 + bob - as, 7, 3);
        drawRivet(x, cx - 14.5, 39.5 + bob + as, 0.5); drawRivet(x, cx + 15.5, 39.5 + bob - as, 0.5);
        drawSphere(x, cx - 16, 42 + bob + as, 3, '#f0d8c0', '#ffeedd', '#d0b8a0');
        drawSphere(x, cx + 16, 42 + bob - as, 3, '#f0d8c0', '#ffeedd', '#d0b8a0');
      }

      // Bow & arrow
      if (side) {
        // Bow in front hand
        x.strokeStyle = '#6a4020'; x.lineWidth = 2.5;
        x.beginPath();
        x.arc(cx + 6, 34 + bob + as, 14, -Math.PI * 0.65, Math.PI * 0.65);
        x.stroke();
        x.fillStyle = '#5a3a1a'; x.fillRect(cx + 4, 32 + bob + as, 4, 5);
        x.strokeStyle = '#ccccaa'; x.lineWidth = 0.8;
        const bT = 34 + bob + as + Math.sin(-Math.PI * 0.65) * 14;
        const bB = 34 + bob + as + Math.sin(Math.PI * 0.65) * 14;
        x.beginPath();
        x.moveTo(cx + 6 + Math.cos(-Math.PI * 0.65) * 14, bT);
        x.lineTo(cx + 6 + Math.cos(Math.PI * 0.65) * 14, bB);
        x.stroke();
      } else if (dir === 'down' || dir === 'down_right') {
        // Bow held in left hand
        x.strokeStyle = '#6a4020'; x.lineWidth = 2.5;
        x.beginPath();
        x.arc(cx - 22, 34 + bob + as, 16, -Math.PI * 0.65, Math.PI * 0.65);
        x.stroke();
        x.fillStyle = '#5a3a1a'; x.fillRect(cx - 24, 32 + bob + as, 4, 5);
        x.strokeStyle = '#ccccaa'; x.lineWidth = 0.8;
        const bTop = 34 + bob + as + Math.sin(-Math.PI * 0.65) * 16;
        const bBot = 34 + bob + as + Math.sin(Math.PI * 0.65) * 16;
        x.beginPath();
        x.moveTo(cx - 22 + Math.cos(-Math.PI * 0.65) * 16, bTop);
        x.lineTo(cx - 22 + Math.cos(Math.PI * 0.65) * 16, bBot);
        x.stroke();
        // Arrow nocked
        x.strokeStyle = '#8a7050'; x.lineWidth = 1.5;
        x.beginPath(); x.moveTo(cx - 22, 34 + bob + as); x.lineTo(cx - 4, 34 + bob + as); x.stroke();
        x.fillStyle = '#aaaacc';
        x.beginPath();
        x.moveTo(cx - 22, 34 + bob + as); x.lineTo(cx - 26, 32 + bob + as); x.lineTo(cx - 26, 36 + bob + as); x.fill();
      } else {
        // UP / UP_RIGHT: bow slung on back (visible as curved line)
        x.strokeStyle = '#6a4020'; x.lineWidth = 2;
        x.beginPath();
        x.arc(cx - 8, 36 + bob, 12, -Math.PI * 0.5, Math.PI * 0.5);
        x.stroke();
        x.strokeStyle = '#ccccaa'; x.lineWidth = 0.6;
        x.beginPath();
        x.moveTo(cx - 8 + Math.cos(-Math.PI * 0.5) * 12, 36 + bob + Math.sin(-Math.PI * 0.5) * 12);
        x.lineTo(cx - 8 + Math.cos(Math.PI * 0.5) * 12, 36 + bob + Math.sin(Math.PI * 0.5) * 12);
        x.stroke();
      }

      // Head
      drawSphere(x, cx, 18 + bob, 9.5, '#f0d8c0', '#ffeedd', '#d0b8a0');

      // Pointed ears (all dirs)
      if (dir === 'right') {
        const earG = x.createLinearGradient(cx + 8, 16, cx + 18, 12);
        earG.addColorStop(0, '#f0d8c0'); earG.addColorStop(1, '#e0c0a0');
        x.fillStyle = earG;
        x.beginPath(); x.moveTo(cx + 9, 16 + bob); x.lineTo(cx + 18, 12 + bob); x.lineTo(cx + 9, 20 + bob); x.fill();
        x.fillStyle = '#e8b8a0';
        x.beginPath(); x.moveTo(cx + 9, 17 + bob); x.lineTo(cx + 14, 13 + bob); x.lineTo(cx + 9, 19 + bob); x.fill();
      } else {
        const earG = x.createLinearGradient(cx - 8, 16, cx - 16, 12);
        earG.addColorStop(0, '#f0d8c0'); earG.addColorStop(1, '#e0c0a0');
        x.fillStyle = earG;
        x.beginPath(); x.moveTo(cx - 9, 16 + bob); x.lineTo(cx - 18, 12 + bob); x.lineTo(cx - 9, 20 + bob); x.fill();
        x.beginPath(); x.moveTo(cx + 9, 16 + bob); x.lineTo(cx + 18, 12 + bob); x.lineTo(cx + 9, 20 + bob); x.fill();
        x.fillStyle = '#e8b8a0';
        x.beginPath(); x.moveTo(cx - 9, 17 + bob); x.lineTo(cx - 14, 13 + bob); x.lineTo(cx - 9, 19 + bob); x.fill();
        x.beginPath(); x.moveTo(cx + 9, 17 + bob); x.lineTo(cx + 14, 13 + bob); x.lineTo(cx + 9, 19 + bob); x.fill();
      }

      // Hair & headband
      const hairG = x.createLinearGradient(cx - 10, 8, cx + 10, 16);
      hairG.addColorStop(0, '#7a9a4a'); hairG.addColorStop(1, '#5a7a2a');
      x.fillStyle = hairG;
      x.beginPath(); x.arc(cx, 14 + bob, 10, Math.PI, 0); x.fill();

      if (dir === 'down' || dir === 'down_right') {
        // Windswept strands
        x.fillStyle = '#5a7a2a';
        x.beginPath();
        x.moveTo(cx + 8, 12 + bob);
        x.bezierCurveTo(cx + 14, 10 + bob, cx + 18, 9 + bob, cx + 16, 14 + bob);
        x.lineTo(cx + 8, 16 + bob);
        x.fill();
        x.fillStyle = 'rgba(150,200,100,0.3)';
        x.beginPath(); x.arc(cx - 3, 10 + bob, 5, Math.PI, 0); x.fill();
        // Headband
        x.fillStyle = '#3a6a18'; x.fillRect(cx - 9, 12 + bob, 18, 2.5);
        // Feather
        x.strokeStyle = '#88cc44'; x.lineWidth = 1.5;
        x.beginPath(); x.moveTo(cx + 7, 12 + bob);
        x.bezierCurveTo(cx + 10, 8 + bob, cx + 12, 4 + bob, cx + 11, 2 + bob);
        x.stroke();
        x.fillStyle = '#88cc44';
        x.beginPath(); x.moveTo(cx + 11, 2 + bob); x.lineTo(cx + 9, 5 + bob); x.lineTo(cx + 13, 6 + bob); x.fill();
        x.beginPath(); x.moveTo(cx + 11.5, 4 + bob); x.lineTo(cx + 9.5, 7 + bob); x.lineTo(cx + 13, 8 + bob); x.fill();
        // Eyes
        if (dir === 'down_right') {
          // 3/4 front-right: right eye full, left eye smaller
          x.fillStyle = '#ffffff';
          x.fillRect(cx + 1, 16.5 + bob, 4, 3); x.fillRect(cx - 5.5, 16.5 + bob, 3, 2.5);
          x.fillStyle = '#44aa22';
          x.fillRect(cx + 2, 17 + bob, 2.5, 2.5); x.fillRect(cx - 5, 17 + bob, 2, 2);
          x.fillStyle = '#225511';
          x.fillRect(cx + 2.5, 17.5 + bob, 1.2, 1.5); x.fillRect(cx - 4.5, 17.5 + bob, 1, 1.2);
          x.fillStyle = '#ffffff';
          x.fillRect(cx + 1.5, 16.5 + bob, 0.8, 0.8); x.fillRect(cx - 5, 16.5 + bob, 0.6, 0.6);
          // Sharp eye corners
          x.strokeStyle = '#2a5a18'; x.lineWidth = 0.7;
          x.beginPath(); x.moveTo(cx + 5.5, 17 + bob); x.lineTo(cx + 7, 15.5 + bob); x.stroke();
        } else {
          x.fillStyle = '#ffffff';
          x.fillRect(cx - 6, 16.5 + bob, 4, 3); x.fillRect(cx + 2, 16.5 + bob, 4, 3);
          x.fillStyle = '#44aa22';
          x.fillRect(cx - 5, 17 + bob, 2.5, 2.5); x.fillRect(cx + 3, 17 + bob, 2.5, 2.5);
          x.fillStyle = '#225511';
          x.fillRect(cx - 4.5, 17.5 + bob, 1.2, 1.5); x.fillRect(cx + 3.5, 17.5 + bob, 1.2, 1.5);
          x.fillStyle = '#ffffff';
          x.fillRect(cx - 5, 16.5 + bob, 0.8, 0.8); x.fillRect(cx + 3, 16.5 + bob, 0.8, 0.8);
          // Sharp eye corners
          x.strokeStyle = '#2a5a18'; x.lineWidth = 0.7;
          x.beginPath(); x.moveTo(cx - 6.5, 17 + bob); x.lineTo(cx - 8, 15.5 + bob); x.stroke();
          x.beginPath(); x.moveTo(cx + 6.5, 17 + bob); x.lineTo(cx + 8, 15.5 + bob); x.stroke();
        }
        // Eyebrows
        x.strokeStyle = '#5a7a2a'; x.lineWidth = 0.8;
        x.beginPath(); x.moveTo(cx - 6, 15.5 + bob); x.quadraticCurveTo(cx - 4, 14 + bob, cx - 2, 15 + bob); x.stroke();
        x.beginPath(); x.moveTo(cx + 6, 15.5 + bob); x.quadraticCurveTo(cx + 4, 14 + bob, cx + 2, 15 + bob); x.stroke();
        // Nose & smile
        x.fillStyle = '#e0c0a0'; x.fillRect(cx - 0.5, 19.5 + bob, 1.5, 2);
        x.strokeStyle = '#d0b8a0'; x.lineWidth = 0.7; x.lineCap = 'round';
        x.beginPath(); x.arc(cx, 22.5 + bob, 2, 0.3, Math.PI - 0.3); x.stroke();
      } else if (dir === 'right') {
        // Side hair
        x.fillStyle = '#5a7a2a';
        x.beginPath();
        x.moveTo(cx + 6, 12 + bob);
        x.bezierCurveTo(cx + 12, 10 + bob, cx + 14, 11 + bob, cx + 12, 16 + bob);
        x.lineTo(cx + 6, 16 + bob);
        x.fill();
        // Headband
        x.fillStyle = '#3a6a18'; x.fillRect(cx - 5, 12 + bob, 14, 2.5);
        // Feather
        x.strokeStyle = '#88cc44'; x.lineWidth = 1.5;
        x.beginPath(); x.moveTo(cx + 5, 12 + bob);
        x.bezierCurveTo(cx + 8, 8 + bob, cx + 10, 4 + bob, cx + 9, 2 + bob);
        x.stroke();
        x.fillStyle = '#88cc44';
        x.beginPath(); x.moveTo(cx + 9, 2 + bob); x.lineTo(cx + 7, 5 + bob); x.lineTo(cx + 11, 6 + bob); x.fill();
        // One eye
        x.fillStyle = '#ffffff'; x.fillRect(cx + 2, 16.5 + bob, 4, 3);
        x.fillStyle = '#44aa22'; x.fillRect(cx + 3, 17 + bob, 2.5, 2.5);
        x.fillStyle = '#225511'; x.fillRect(cx + 3.5, 17.5 + bob, 1.2, 1.5);
        x.fillStyle = '#ffffff'; x.fillRect(cx + 3, 16.5 + bob, 0.8, 0.8);
        x.strokeStyle = '#2a5a18'; x.lineWidth = 0.7;
        x.beginPath(); x.moveTo(cx + 6.5, 17 + bob); x.lineTo(cx + 8, 15.5 + bob); x.stroke();
        x.strokeStyle = '#5a7a2a'; x.lineWidth = 0.8;
        x.beginPath(); x.moveTo(cx + 6, 15.5 + bob); x.quadraticCurveTo(cx + 4, 14 + bob, cx + 2, 15 + bob); x.stroke();
        // Nose
        x.fillStyle = '#e0c0a0'; x.fillRect(cx + 7, 19.5 + bob, 2, 2);
      } else {
        // UP / UP_RIGHT: back of hair
        x.fillStyle = hairG;
        x.fillRect(cx - 10, 14 + bob, 20, 10);
        x.fillStyle = 'rgba(150,200,100,0.2)';
        x.beginPath(); x.arc(cx, 10 + bob, 5, Math.PI, 0); x.fill();
        // Headband from behind
        x.fillStyle = '#3a6a18'; x.fillRect(cx - 9, 12 + bob, 18, 2.5);
        // Feather sticking up
        x.strokeStyle = '#88cc44'; x.lineWidth = 1.5;
        x.beginPath(); x.moveTo(cx + 7, 12 + bob);
        x.bezierCurveTo(cx + 10, 8 + bob, cx + 12, 4 + bob, cx + 11, 2 + bob);
        x.stroke();
        if (dir === 'up_right') {
          // 3/4 back-right: slight ear tip visible
          x.fillStyle = '#f0d8c0';
          x.beginPath(); x.moveTo(cx + 9, 16 + bob); x.lineTo(cx + 14, 13 + bob); x.lineTo(cx + 9, 19 + bob); x.fill();
        }
      }

      // Floating leaves
      x.fillStyle = `rgba(100,200,60,${0.35 + Math.sin(f * Math.PI / 2) * 0.15})`;
      for (let i = 0; i < 4; i++) {
        const la = f * Math.PI / 2 + i * Math.PI * 2 / 4;
        const lx = cx + Math.cos(la) * 22, ly = 42 + bob + Math.sin(la) * 16;
        x.save(); x.translate(lx, ly); x.rotate(la);
        x.beginPath(); x.ellipse(0, 0, 2.5, 1, 0, 0, Math.PI * 2); x.fill();
        x.restore();
      }

      dirs[dir].push(c);
    }
  }
  // Attack frames - bow draw and arrow release
  const atk = {down: [], down_right: [], up: [], up_right: [], right: []};
  for (const dir of ['down', 'down_right', 'right', 'up_right', 'up']) {
    for (let f = 0; f < 4; f++) {
      const c = makeCanvas(64, 84);
      const x = c.getContext('2d');
      const cx = 32;
      const atkPhase = f / 3;
      const side = dir === 'right';
      const lean = Math.sin(atkPhase * Math.PI) * 1;

      draw3DShadow(x, cx, 78, 15, 5);

      // Nature aura
      x.fillStyle = `rgba(100,220,60,${0.04 + atkPhase * 0.04})`;
      x.beginPath(); x.ellipse(cx, 46, 24, 32, 0, 0, Math.PI * 2); x.fill();

      // Short ranger cloak
      if (dir === 'up' || dir === 'up_right') {
        x.fillStyle = '#2a5a18'; x.globalAlpha = 0.7;
        x.beginPath(); x.moveTo(cx - 14, 26 + lean); x.lineTo(cx - 20, 56 + lean);
        x.lineTo(cx + 20, 56 + lean); x.lineTo(cx + 14, 26 + lean); x.fill();
        x.globalAlpha = 1;
      } else if (dir === 'down' || dir === 'down_right') {
        x.fillStyle = '#2a5a18'; x.globalAlpha = 0.65;
        x.beginPath(); x.moveTo(cx - 10, 26 + lean); x.lineTo(cx - 18, 52 + lean);
        x.lineTo(cx - 8, 54 + lean); x.lineTo(cx - 8, 28 + lean); x.fill();
        x.globalAlpha = 1;
      } else {
        x.fillStyle = '#2a5a18'; x.globalAlpha = 0.6;
        x.beginPath(); x.moveTo(cx - 4, 26 + lean); x.lineTo(cx - 10, 50 + lean);
        x.lineTo(cx - 2, 52 + lean); x.lineTo(cx - 2, 28 + lean); x.fill();
        x.globalAlpha = 1;
      }

      // Leather boots (stable archer stance)
      if (side) {
        const bootG = x.createLinearGradient(cx - 5, 58, cx + 5, 70);
        bootG.addColorStop(0, '#5a4020'); bootG.addColorStop(1, '#3a2810');
        x.fillStyle = bootG;
        x.fillRect(cx - 4, 58 + lean, 8, 14);
        x.strokeStyle = '#8a6a3a'; x.lineWidth = 1;
        x.beginPath(); x.moveTo(cx - 4, 62 + lean); x.lineTo(cx + 4, 62 + lean); x.stroke();
      } else {
        const bootG = x.createLinearGradient(cx - 8, 58, cx + 8, 70);
        bootG.addColorStop(0, '#5a4020'); bootG.addColorStop(1, '#3a2810');
        x.fillStyle = bootG;
        const stW = atkPhase * 1.5;
        x.fillRect(cx - 8 - stW, 58 + lean, 6, 14);
        x.fillRect(cx + 2 + stW, 58 + lean, 6, 14);
        x.strokeStyle = '#8a6a3a'; x.lineWidth = 1;
        x.beginPath(); x.moveTo(cx - 8 - stW, 62 + lean); x.lineTo(cx - 2 - stW, 62 + lean); x.stroke();
        x.beginPath(); x.moveTo(cx + 2 + stW, 62 + lean); x.lineTo(cx + 8 + stW, 62 + lean); x.stroke();
      }

      // Tunic (forest green)
      const bodyW = side ? 20 : 26, bodyX = side ? cx - 10 : cx - 13;
      const tg = x.createLinearGradient(bodyX, 26, bodyX + bodyW, 58);
      tg.addColorStop(0, '#4a8a30'); tg.addColorStop(0.35, '#3d7a25');
      tg.addColorStop(0.7, '#2a5a18'); tg.addColorStop(1, '#1e4a12');
      x.fillStyle = tg;
      x.beginPath(); x.moveTo(bodyX + 1, 26 + lean); x.lineTo(bodyX - 1, 58 + lean);
      x.lineTo(bodyX + bodyW + 1, 58 + lean); x.lineTo(bodyX + bodyW - 1, 26 + lean); x.fill();
      // Tunic fold
      x.fillStyle = 'rgba(0,0,0,0.08)';
      x.beginPath(); x.moveTo(cx + 2, 30 + lean); x.lineTo(cx - 2, 58 + lean); x.lineTo(cx + 6, 58 + lean); x.fill();
      // Belt
      x.fillStyle = '#6a4a2a'; x.fillRect(bodyX - 1, 48 + lean, bodyW + 2, 3.5);
      drawRivet(x, cx, 49.5 + lean, 1.5);

      // Quiver on back
      if (dir === 'up' || dir === 'up_right') {
        x.fillStyle = '#5a3a1a';
        x.save(); x.translate(cx + 2, 22 + lean); x.rotate(0.05);
        x.beginPath(); x.roundRect(-4, 0, 8, 28, 2); x.fill();
        x.fillStyle = '#dddddd';
        for (let i = 0; i < 5; i++) x.fillRect(-3 + i * 1.5, -3 - i * 0.4, 1.5, 4);
        x.restore();
      } else {
        x.fillStyle = '#5a3a1a';
        x.save(); x.translate(cx + 14, 22 + lean); x.rotate(0.15);
        x.beginPath(); x.roundRect(-3.5, 0, 7, 26, 2); x.fill();
        x.fillStyle = '#dddddd';
        for (let i = 0; i < 4; i++) x.fillRect(-2 + i * 1.5, -3 - i * 0.5, 1.5, 4);
        x.restore();
      }

      // Arms with bow draw animation
      // Phase: 0=bow held, 0.33=drawing back, 0.67=release, 1=bow lowering
      const drawBack = f === 0 ? 0 : f === 1 ? 6 : f === 2 ? 0 : -2;
      if (side) {
        // Front arm holds bow, back arm draws string
        const slG = x.createLinearGradient(cx - 8, 28, cx, 42);
        slG.addColorStop(0, '#4a8a30'); slG.addColorStop(1, '#3a6a20');
        x.fillStyle = slG;
        // Bow arm (front, extended)
        x.beginPath(); x.moveTo(cx - 2, 28 + lean); x.lineTo(cx - 8, 40 + lean);
        x.lineTo(cx - 2, 42 + lean); x.fill();
        x.fillStyle = '#6a4a2a'; x.fillRect(cx - 8, 38 + lean, 7, 3);
        drawSphere(x, cx - 4, 42 + lean, 3, '#f0d8c0', '#ffeedd', '#d0b8a0');

        // Bow
        x.strokeStyle = '#6a4020'; x.lineWidth = 2.5;
        x.beginPath(); x.arc(cx + 6, 34 + lean, 14, -Math.PI * 0.65, Math.PI * 0.65); x.stroke();
        x.fillStyle = '#5a3a1a'; x.fillRect(cx + 4, 32 + lean, 4, 5);
        // Bowstring with draw
        x.strokeStyle = '#ccccaa'; x.lineWidth = 0.8;
        const bowCX = cx + 6;
        const bTop = 34 + lean + Math.sin(-Math.PI * 0.65) * 14;
        const bBot = 34 + lean + Math.sin(Math.PI * 0.65) * 14;
        const bTopX = bowCX + Math.cos(-Math.PI * 0.65) * 14;
        const bBotX = bowCX + Math.cos(Math.PI * 0.65) * 14;
        const stringPullX = bowCX - drawBack;
        x.beginPath(); x.moveTo(bTopX, bTop);
        x.lineTo(stringPullX, 34 + lean); x.lineTo(bBotX, bBot); x.stroke();
        // Arrow
        if (f <= 1) {
          x.strokeStyle = '#8a7050'; x.lineWidth = 1.5;
          x.beginPath(); x.moveTo(stringPullX, 34 + lean); x.lineTo(bowCX + 16, 34 + lean); x.stroke();
          x.fillStyle = '#aaaacc';
          x.beginPath(); x.moveTo(bowCX + 16, 34 + lean); x.lineTo(bowCX + 18, 32 + lean); x.lineTo(bowCX + 18, 36 + lean); x.fill();
        }
        // Flying arrow at release
        if (f === 2) {
          x.strokeStyle = '#8a7050'; x.lineWidth = 1.5;
          x.beginPath(); x.moveTo(bowCX + 20, 34 + lean); x.lineTo(bowCX + 35, 34 + lean); x.stroke();
          x.fillStyle = '#aaaacc';
          x.beginPath(); x.moveTo(bowCX + 35, 34 + lean); x.lineTo(bowCX + 38, 32 + lean); x.lineTo(bowCX + 38, 36 + lean); x.fill();
          // Motion blur
          x.strokeStyle = 'rgba(200,200,200,0.3)'; x.lineWidth = 1;
          x.beginPath(); x.moveTo(bowCX + 16, 34 + lean); x.lineTo(bowCX + 20, 34 + lean); x.stroke();
          // String vibration
          x.strokeStyle = 'rgba(200,200,170,0.6)'; x.lineWidth = 0.6;
          x.beginPath(); x.moveTo(bTopX, bTop);
          x.quadraticCurveTo(bowCX + 2, 34 + lean, bBotX, bBot); x.stroke();
          x.beginPath(); x.moveTo(bTopX, bTop);
          x.quadraticCurveTo(bowCX - 2, 34 + lean, bBotX, bBot); x.stroke();
        }
      } else if (dir === 'down' || dir === 'down_right') {
        const slG = x.createLinearGradient(cx - 18, 28, cx - 12, 42);
        slG.addColorStop(0, '#4a8a30'); slG.addColorStop(1, '#3a6a20');
        x.fillStyle = slG;
        // Left arm holds bow
        x.beginPath(); x.moveTo(cx - 12, 28 + lean); x.lineTo(cx - 18, 40 + lean);
        x.lineTo(cx - 12, 42 + lean); x.fill();
        // Right arm draws string
        x.beginPath(); x.moveTo(cx + 12, 28 + lean); x.lineTo(cx + 18 - drawBack * 0.3, 40 + lean);
        x.lineTo(cx + 12, 42 + lean); x.fill();
        x.fillStyle = '#6a4a2a';
        x.fillRect(cx - 18, 38 + lean, 7, 3); x.fillRect(cx + 12 - drawBack * 0.3, 38 + lean, 7, 3);
        drawSphere(x, cx - 16, 42 + lean, 3, '#f0d8c0', '#ffeedd', '#d0b8a0');
        drawSphere(x, cx + 16 - drawBack * 0.3, 42 + lean, 3, '#f0d8c0', '#ffeedd', '#d0b8a0');

        // Bow in left hand
        x.strokeStyle = '#6a4020'; x.lineWidth = 2.5;
        x.beginPath(); x.arc(cx - 22, 34 + lean, 16, -Math.PI * 0.65, Math.PI * 0.65); x.stroke();
        x.fillStyle = '#5a3a1a'; x.fillRect(cx - 24, 32 + lean, 4, 5);
        // String with draw
        x.strokeStyle = '#ccccaa'; x.lineWidth = 0.8;
        const bwCX = cx - 22;
        const btY = 34 + lean + Math.sin(-Math.PI * 0.65) * 16;
        const bbY = 34 + lean + Math.sin(Math.PI * 0.65) * 16;
        const btX = bwCX + Math.cos(-Math.PI * 0.65) * 16;
        const bbX = bwCX + Math.cos(Math.PI * 0.65) * 16;
        const sPullX = bwCX + drawBack;
        x.beginPath(); x.moveTo(btX, btY); x.lineTo(sPullX, 34 + lean); x.lineTo(bbX, bbY); x.stroke();
        // Arrow
        if (f <= 1) {
          x.strokeStyle = '#8a7050'; x.lineWidth = 1.5;
          x.beginPath(); x.moveTo(sPullX, 34 + lean); x.lineTo(bwCX - 18, 34 + lean); x.stroke();
          x.fillStyle = '#aaaacc';
          x.beginPath(); x.moveTo(bwCX - 18, 34 + lean); x.lineTo(bwCX - 20, 32 + lean); x.lineTo(bwCX - 20, 36 + lean); x.fill();
        }
        if (f === 2) {
          // Flying arrow
          x.strokeStyle = '#8a7050'; x.lineWidth = 1.5;
          x.beginPath(); x.moveTo(bwCX - 22, 34 + lean); x.lineTo(bwCX - 36, 34 + lean); x.stroke();
          x.fillStyle = '#aaaacc';
          x.beginPath(); x.moveTo(bwCX - 36, 34 + lean); x.lineTo(bwCX - 39, 32 + lean); x.lineTo(bwCX - 39, 36 + lean); x.fill();
          // String vibration
          x.strokeStyle = 'rgba(200,200,170,0.6)'; x.lineWidth = 0.6;
          x.beginPath(); x.moveTo(btX, btY); x.quadraticCurveTo(bwCX + 2, 34 + lean, bbX, bbY); x.stroke();
          x.beginPath(); x.moveTo(btX, btY); x.quadraticCurveTo(bwCX - 2, 34 + lean, bbX, bbY); x.stroke();
        }
      } else {
        // UP / UP_RIGHT: bow on back, arms pulling
        const slG = x.createLinearGradient(cx - 18, 28, cx - 12, 42);
        slG.addColorStop(0, '#4a8a30'); slG.addColorStop(1, '#3a6a20');
        x.fillStyle = slG;
        x.beginPath(); x.moveTo(cx - 12, 28 + lean); x.lineTo(cx - 18, 40 + lean);
        x.lineTo(cx - 12, 42 + lean); x.fill();
        x.beginPath(); x.moveTo(cx + 12, 28 + lean); x.lineTo(cx + 18, 40 + lean);
        x.lineTo(cx + 12, 42 + lean); x.fill();
        x.fillStyle = '#6a4a2a';
        x.fillRect(cx - 18, 38 + lean, 7, 3); x.fillRect(cx + 12, 38 + lean, 7, 3);
        drawSphere(x, cx - 16, 42 + lean, 3, '#f0d8c0', '#ffeedd', '#d0b8a0');
        drawSphere(x, cx + 16, 42 + lean, 3, '#f0d8c0', '#ffeedd', '#d0b8a0');
        // Bow slung on back
        x.strokeStyle = '#6a4020'; x.lineWidth = 2;
        x.beginPath(); x.arc(cx - 8, 36 + lean, 12, -Math.PI * 0.5, Math.PI * 0.5); x.stroke();
        x.strokeStyle = '#ccccaa'; x.lineWidth = 0.6;
        x.beginPath();
        x.moveTo(cx - 8, 36 + lean - 12); x.lineTo(cx - 8, 36 + lean + 12); x.stroke();
        // Arrow flying away (frame 2)
        if (f === 2) {
          x.strokeStyle = '#8a7050'; x.lineWidth = 1.5;
          x.beginPath(); x.moveTo(cx, 10 + lean); x.lineTo(cx, -8 + lean); x.stroke();
          x.fillStyle = '#aaaacc';
          x.beginPath(); x.moveTo(cx, -8 + lean); x.lineTo(cx - 2, -10 + lean); x.lineTo(cx + 2, -10 + lean); x.fill();
        }
      }

      // Head
      drawSphere(x, cx, 18 + lean, 9.5, '#f0d8c0', '#ffeedd', '#d0b8a0');

      // Pointed ears
      if (dir === 'right') {
        const earG = x.createLinearGradient(cx + 8, 16, cx + 18, 12);
        earG.addColorStop(0, '#f0d8c0'); earG.addColorStop(1, '#e0c0a0');
        x.fillStyle = earG;
        x.beginPath(); x.moveTo(cx + 9, 16 + lean); x.lineTo(cx + 18, 12 + lean); x.lineTo(cx + 9, 20 + lean); x.fill();
      } else {
        const earG = x.createLinearGradient(cx - 8, 16, cx - 16, 12);
        earG.addColorStop(0, '#f0d8c0'); earG.addColorStop(1, '#e0c0a0');
        x.fillStyle = earG;
        x.beginPath(); x.moveTo(cx - 9, 16 + lean); x.lineTo(cx - 18, 12 + lean); x.lineTo(cx - 9, 20 + lean); x.fill();
        x.beginPath(); x.moveTo(cx + 9, 16 + lean); x.lineTo(cx + 18, 12 + lean); x.lineTo(cx + 9, 20 + lean); x.fill();
      }

      // Hair & headband
      const hairG = x.createLinearGradient(cx - 10, 8, cx + 10, 16);
      hairG.addColorStop(0, '#7a9a4a'); hairG.addColorStop(1, '#5a7a2a');
      x.fillStyle = hairG;
      x.beginPath(); x.arc(cx, 14 + lean, 10, Math.PI, 0); x.fill();

      if (dir === 'down' || dir === 'down_right') {
        x.fillStyle = '#5a7a2a';
        x.beginPath(); x.moveTo(cx + 8, 12 + lean);
        x.bezierCurveTo(cx + 14, 10 + lean, cx + 18, 9 + lean, cx + 16, 14 + lean);
        x.lineTo(cx + 8, 16 + lean); x.fill();
        x.fillStyle = '#3a6a18'; x.fillRect(cx - 9, 12 + lean, 18, 2.5);
        // Feather
        x.strokeStyle = '#88cc44'; x.lineWidth = 1.5;
        x.beginPath(); x.moveTo(cx + 7, 12 + lean);
        x.bezierCurveTo(cx + 10, 8 + lean, cx + 12, 4 + lean, cx + 11, 2 + lean); x.stroke();
        x.fillStyle = '#88cc44';
        x.beginPath(); x.moveTo(cx + 11, 2 + lean); x.lineTo(cx + 9, 5 + lean); x.lineTo(cx + 13, 6 + lean); x.fill();
        // Eyes (focused)
        if (dir === 'down_right') {
          // 3/4 front-right: right eye full, left eye smaller
          x.fillStyle = '#ffffff';
          x.fillRect(cx + 1, 16.5 + lean, 4, 3); x.fillRect(cx - 5.5, 16.5 + lean, 3, 2.5);
          x.fillStyle = '#44aa22';
          x.fillRect(cx + 2, 17 + lean, 2.5, 2.5); x.fillRect(cx - 5, 17 + lean, 2, 2);
          x.fillStyle = '#225511';
          x.fillRect(cx + 2.5, 17.5 + lean, 1.2, 1.5); x.fillRect(cx - 4.5, 17.5 + lean, 1, 1.2);
        } else {
          x.fillStyle = '#ffffff';
          x.fillRect(cx - 6, 16.5 + lean, 4, 3); x.fillRect(cx + 2, 16.5 + lean, 4, 3);
          x.fillStyle = '#44aa22';
          x.fillRect(cx - 5, 17 + lean, 2.5, 2.5); x.fillRect(cx + 3, 17 + lean, 2.5, 2.5);
          x.fillStyle = '#225511';
          x.fillRect(cx - 4.5, 17.5 + lean, 1.2, 1.5); x.fillRect(cx + 3.5, 17.5 + lean, 1.2, 1.5);
        }
      } else if (dir === 'right') {
        x.fillStyle = '#5a7a2a';
        x.beginPath(); x.moveTo(cx + 6, 12 + lean);
        x.bezierCurveTo(cx + 12, 10 + lean, cx + 14, 11 + lean, cx + 12, 16 + lean);
        x.lineTo(cx + 6, 16 + lean); x.fill();
        x.fillStyle = '#3a6a18'; x.fillRect(cx - 5, 12 + lean, 14, 2.5);
        x.strokeStyle = '#88cc44'; x.lineWidth = 1.5;
        x.beginPath(); x.moveTo(cx + 5, 12 + lean);
        x.bezierCurveTo(cx + 8, 8 + lean, cx + 10, 4 + lean, cx + 9, 2 + lean); x.stroke();
        x.fillStyle = '#ffffff'; x.fillRect(cx + 2, 16.5 + lean, 4, 3);
        x.fillStyle = '#44aa22'; x.fillRect(cx + 3, 17 + lean, 2.5, 2.5);
        x.fillStyle = '#225511'; x.fillRect(cx + 3.5, 17.5 + lean, 1.2, 1.5);
      } else {
        // UP / UP_RIGHT: back of hair
        x.fillStyle = hairG; x.fillRect(cx - 10, 14 + lean, 20, 10);
        x.fillStyle = '#3a6a18'; x.fillRect(cx - 9, 12 + lean, 18, 2.5);
        x.strokeStyle = '#88cc44'; x.lineWidth = 1.5;
        x.beginPath(); x.moveTo(cx + 7, 12 + lean);
        x.bezierCurveTo(cx + 10, 8 + lean, cx + 12, 4 + lean, cx + 11, 2 + lean); x.stroke();
        if (dir === 'up_right') {
          // 3/4 back-right: slight ear tip visible
          x.fillStyle = '#f0d8c0';
          x.beginPath(); x.moveTo(cx + 9, 16 + lean); x.lineTo(cx + 14, 13 + lean); x.lineTo(cx + 9, 19 + lean); x.fill();
        }
      }

      // Floating leaves (faster during attack)
      x.fillStyle = `rgba(100,200,60,${0.35 + atkPhase * 0.25})`;
      for (let i = 0; i < 5; i++) {
        const la = atkPhase * Math.PI * 3 + i * Math.PI * 2 / 5;
        const lx = cx + Math.cos(la) * 22, ly = 42 + lean + Math.sin(la) * 16;
        x.save(); x.translate(lx, ly); x.rotate(la);
        x.beginPath(); x.ellipse(0, 0, 2.5, 1, 0, 0, Math.PI * 2); x.fill();
        x.restore();
      }

      atk[dir].push(c);
    }
  }

  setDirCache8('player_ARCHER', {down: dirs.down, down_right: dirs.down_right, right: dirs.right, up_right: dirs.up_right, up: dirs.up, atk_down: atk.down, atk_down_right: atk.down_right, atk_right: atk.right, atk_up_right: atk.up_right, atk_up: atk.up});
}

// ============================================================
//  TREE SPRITES (Detailed with organic shapes)
// ============================================================
function genTree(key, trunkC, leafC, leafD, leafL, h) {
  const tw = 64, th = h || 96;
  const c = makeCanvas(tw, th);
  const x = c.getContext('2d');
  const tcx = tw / 2;

  // Ground shadow
  draw3DShadow(x, tcx + 4, th - 2, 14, 5);

  // Visible roots at base
  x.fillStyle = colorShift(trunkC || '#5a3a1a', -10);
  x.beginPath();
  x.moveTo(tcx - 6, th * 0.92); x.quadraticCurveTo(tcx - 14, th * 0.95, tcx - 12, th - 1);
  x.lineTo(tcx - 4, th * 0.92); x.fill();
  x.beginPath();
  x.moveTo(tcx + 6, th * 0.92); x.quadraticCurveTo(tcx + 14, th * 0.94, tcx + 11, th - 1);
  x.lineTo(tcx + 4, th * 0.92); x.fill();

  // Trunk - detailed 3D cylinder with bark
  const tg = x.createLinearGradient(tcx - 5, 0, tcx + 5, 0);
  tg.addColorStop(0, colorShift(trunkC || '#5a3a1a', -25));
  tg.addColorStop(0.2, colorShift(trunkC || '#5a3a1a', 15));
  tg.addColorStop(0.5, trunkC || '#5a3a1a');
  tg.addColorStop(0.8, colorShift(trunkC || '#5a3a1a', 5));
  tg.addColorStop(1, colorShift(trunkC || '#5a3a1a', -35));
  x.fillStyle = tg;
  // Trunk tapers upward
  x.beginPath();
  x.moveTo(tcx - 6, th * 0.92);
  x.lineTo(tcx - 4, th * 0.48);
  x.lineTo(tcx + 4, th * 0.48);
  x.lineTo(tcx + 6, th * 0.92);
  x.fill();

  // Bark texture
  const barkC = colorShift(trunkC || '#5a3a1a', -20);
  x.strokeStyle = barkC; x.lineWidth = 0.6; x.globalAlpha = 0.5;
  for (let i = 0; i < 6; i++) {
    const by = th * 0.5 + i * th * 0.07;
    x.beginPath();
    x.moveTo(tcx - 4, by);
    x.bezierCurveTo(tcx - 2, by + 2, tcx + 2, by - 1, tcx + 4, by + 1);
    x.stroke();
  }
  // Knot
  x.fillStyle = colorShift(trunkC || '#5a3a1a', -30);
  x.beginPath(); x.ellipse(tcx + 1, th * 0.65, 2.5, 3, 0.3, 0, Math.PI * 2); x.fill();
  x.fillStyle = colorShift(trunkC || '#5a3a1a', -40);
  x.beginPath(); x.ellipse(tcx + 1, th * 0.65, 1.5, 2, 0.3, 0, Math.PI * 2); x.fill();
  x.globalAlpha = 1;

  // Small branches visible between canopy and trunk
  x.strokeStyle = colorShift(trunkC || '#5a3a1a', -5); x.lineWidth = 1.5;
  x.beginPath(); x.moveTo(tcx - 3, th * 0.5); x.lineTo(tcx - 10, th * 0.42); x.stroke();
  x.beginPath(); x.moveTo(tcx + 3, th * 0.52); x.lineTo(tcx + 12, th * 0.44); x.stroke();
  x.beginPath(); x.moveTo(tcx - 2, th * 0.55); x.lineTo(tcx - 8, th * 0.5); x.stroke();

  // Leaf canopy - multiple organic clusters
  const ly = th * 0.34;
  // Back shadow cluster (darkest)
  drawOrganicBlob(x, tcx + 2, ly + 8, 20, leafD, leafC, colorShift(leafD, -30), 5);
  // Side clusters
  drawOrganicBlob(x, tcx - 10, ly + 4, 14, leafC, leafL, leafD, 4);
  drawOrganicBlob(x, tcx + 12, ly + 2, 13, leafC, leafL, leafD, 3);
  // Main central cluster
  drawOrganicBlob(x, tcx, ly, 18, leafC, leafL, leafD, 6);
  // Top clusters
  drawOrganicBlob(x, tcx - 4, ly - 6, 12, leafL, colorShift(leafL, 15), leafC, 4);
  drawOrganicBlob(x, tcx + 6, ly - 4, 11, leafL, colorShift(leafL, 10), leafC, 5);
  // Highlight cluster (light filtering through)
  drawOrganicBlob(x, tcx - 6, ly - 10, 8, leafL, colorShift(leafL, 20), leafC, 3);

  // Individual leaf cluster shadows for 3D depth
  x.fillStyle = 'rgba(0,0,0,0.08)';
  x.beginPath(); x.ellipse(tcx + 4, ly + 4, 8, 4, 0.2, 0, Math.PI * 2); x.fill();
  x.beginPath(); x.ellipse(tcx - 6, ly + 6, 6, 3, -0.3, 0, Math.PI * 2); x.fill();

  // Top highlight
  x.fillStyle = 'rgba(255,255,255,0.12)';
  x.beginPath(); x.ellipse(tcx - 5, ly - 12, 8, 5, -0.2, 0, Math.PI * 2); x.fill();
  // Rim light
  addRimLight(x, tcx, ly, 18, leafL, 0.15);

  // Light dapples through canopy
  x.fillStyle = 'rgba(255,255,200,0.06)';
  for (let i = 0; i < 4; i++) {
    const dx = tcx + (Math.sin(i * 2.3) * 10), dy = ly + (Math.cos(i * 1.7) * 8);
    x.beginPath(); x.arc(dx, dy, 2 + Math.sin(i) * 1, 0, Math.PI * 2); x.fill();
  }

  EnvCache[key] = c;
}

// ============================================================
//  BUILDING SPRITES (3D isometric with detail)
// ============================================================
function genBuilding(key, wallC, roofC, w, h, opts = {}) {
  const c = makeCanvas(w, h);
  const x = c.getContext('2d');

  // Wall with 3D gradient
  const wg = x.createLinearGradient(4, h * 0.4, w - 4, h * 0.95);
  wg.addColorStop(0, colorShift(wallC, 20));
  wg.addColorStop(0.5, wallC);
  wg.addColorStop(1, colorShift(wallC, -30));
  x.fillStyle = wg;
  x.fillRect(4, h * 0.38, w - 8, h * 0.57);

  // Brick/stone texture
  x.strokeStyle = colorShift(wallC, -15); x.lineWidth = 0.5; x.globalAlpha = 0.35;
  for (let row = 0; row < 6; row++) {
    const by = h * 0.4 + row * h * 0.09;
    x.beginPath(); x.moveTo(4, by); x.lineTo(w - 4, by); x.stroke();
    const offset = row % 2 ? 8 : 0;
    for (let col = offset; col < w - 4; col += 16) {
      x.beginPath(); x.moveTo(col, by); x.lineTo(col, by + h * 0.09); x.stroke();
    }
  }
  x.globalAlpha = 1;

  // Weathering / stains
  x.fillStyle = 'rgba(0,0,0,0.04)';
  x.fillRect(w * 0.7, h * 0.5, w * 0.15, h * 0.3);
  x.fillRect(4, h * 0.8, w * 0.3, h * 0.1);

  // Wall top shadow
  x.fillStyle = 'rgba(0,0,0,0.18)';
  x.fillRect(4, h * 0.38, w - 8, 4);

  // Roof with 3D depth
  const rg = x.createLinearGradient(0, h * 0.12, w, h * 0.4);
  rg.addColorStop(0, colorShift(roofC, 25));
  rg.addColorStop(0.5, roofC);
  rg.addColorStop(1, colorShift(roofC, -25));
  x.fillStyle = rg;
  x.beginPath();
  x.moveTo(w / 2, h * 0.1);
  x.lineTo(-4, h * 0.4);
  x.lineTo(w + 4, h * 0.4);
  x.fill();
  // Roof highlight
  x.fillStyle = 'rgba(255,255,255,0.12)';
  x.beginPath();
  x.moveTo(w / 2, h * 0.1);
  x.lineTo(-4, h * 0.4);
  x.lineTo(w / 2, h * 0.4);
  x.fill();
  // Roof tiles
  x.strokeStyle = colorShift(roofC, -20); x.lineWidth = 0.5; x.globalAlpha = 0.35;
  for (let i = 1; i <= 4; i++) {
    const ry = h * 0.1 + (h * 0.3 / 5) * i;
    x.beginPath(); x.moveTo(w / 2 - i * 10, ry); x.lineTo(w / 2 + i * 10, ry); x.stroke();
  }
  x.globalAlpha = 1;

  // Door - recessed with planks
  const doorY = h * 0.65;
  x.fillStyle = '#2a1a10';
  x.fillRect(w / 2 - 8, doorY, 16, h * 0.3);
  x.fillStyle = '#3a2a18';
  x.fillRect(w / 2 - 7, doorY + 1, 14, h * 0.28);
  // Door planks
  x.strokeStyle = '#2a1a10'; x.lineWidth = 0.8;
  x.beginPath(); x.moveTo(w / 2, doorY + 1); x.lineTo(w / 2, doorY + h * 0.29); x.stroke();
  x.beginPath(); x.moveTo(w / 2 - 3.5, doorY + 1); x.lineTo(w / 2 - 3.5, doorY + h * 0.29); x.stroke();
  x.beginPath(); x.moveTo(w / 2 + 3.5, doorY + 1); x.lineTo(w / 2 + 3.5, doorY + h * 0.29); x.stroke();
  // Door handle
  x.fillStyle = '#ffd700';
  x.beginPath(); x.arc(w / 2 + 5, h * 0.8, 1.8, 0, Math.PI * 2); x.fill();
  addSpecular(x, w / 2 + 4.5, h * 0.795, 0.6, 0.4, 0.5);
  // Door arch
  x.strokeStyle = '#5a4030'; x.lineWidth = 2;
  x.beginPath(); x.arc(w / 2, doorY, 8, Math.PI, 0); x.stroke();

  // Windows - lit from inside with glow
  const winGlow = x.createRadialGradient(0, 0, 0, 0, 0, 7);
  winGlow.addColorStop(0, '#ffee88');
  winGlow.addColorStop(0.6, '#ccaa44');
  winGlow.addColorStop(1, '#886622');

  [[w * 0.2, h * 0.5], [w * 0.72, h * 0.5]].forEach(([wx, wy]) => {
    x.save(); x.translate(wx, wy);
    // Window glow aura
    x.fillStyle = 'rgba(255,220,100,0.08)';
    x.beginPath(); x.arc(0, 3, 10, 0, Math.PI * 2); x.fill();
    // Window pane
    x.fillStyle = winGlow;
    x.fillRect(-6, -4, 12, 12);
    // Frame
    x.strokeStyle = '#5a4030'; x.lineWidth = 1.8;
    x.strokeRect(-6, -4, 12, 12);
    // Cross bars
    x.lineWidth = 1;
    x.beginPath(); x.moveTo(0, -4); x.lineTo(0, 8); x.stroke();
    x.beginPath(); x.moveTo(-6, 2); x.lineTo(6, 2); x.stroke();
    // Window sill
    x.fillStyle = colorShift(wallC, -10);
    x.fillRect(-7, 8, 14, 2);
    x.restore();
  });

  // Chimney
  if (opts.chimney) {
    x.fillStyle = colorShift(wallC, -10);
    x.fillRect(w * 0.65, h * 0.06, 10, h * 0.24);
    x.fillStyle = colorShift(wallC, 5);
    x.fillRect(w * 0.64, h * 0.04, 12, 4);
    // Smoke wisps
    x.strokeStyle = 'rgba(180,180,180,0.15)'; x.lineWidth = 2; x.lineCap = 'round';
    x.beginPath(); x.moveTo(w * 0.7, h * 0.04);
    x.bezierCurveTo(w * 0.72, h * 0.01, w * 0.68, -h * 0.02, w * 0.71, -h * 0.04);
    x.stroke();
  }

  // Sign
  if (opts.sign) {
    x.fillStyle = '#5a4a2a';
    x.beginPath(); x.roundRect(w / 2 - 14, h * 0.44, 28, 10, 2); x.fill();
    // Sign border
    x.strokeStyle = '#8a7a4a'; x.lineWidth = 0.8;
    x.strokeRect(w / 2 - 13, h * 0.445, 26, 9);
    x.fillStyle = '#ffd700';
    x.font = 'bold 6px sans-serif'; x.textAlign = 'center';
    x.fillText(opts.sign, w / 2, h * 0.505);
    x.textAlign = 'left';
  }

  // Ivy on walls (optional weathering)
  x.fillStyle = 'rgba(40,100,30,0.15)';
  x.beginPath(); x.moveTo(4, h * 0.7); x.lineTo(4, h * 0.5);
  x.quadraticCurveTo(12, h * 0.55, 10, h * 0.7); x.fill();

  EnvCache[key] = c;
}

// ============================================================
//  TERRAIN TILES (Rich detail with lighting)
// ============================================================
function genTerrainTiles() {
  const ts = 32;

  function makeTile(key, baseR, baseG, baseB, detail) {
    const tc = makeCanvas(ts, ts);
    const tx = tc.getContext('2d');

    // Base with subtle 3D gradient
    const bg = tx.createLinearGradient(0, 0, ts, ts);
    bg.addColorStop(0, rgbStr(baseR + 14, baseG + 14, baseB + 12));
    bg.addColorStop(0.5, rgbStr(baseR, baseG, baseB));
    bg.addColorStop(1, rgbStr(baseR - 10, baseG - 10, baseB - 8));
    tx.fillStyle = bg;
    tx.fillRect(0, 0, ts, ts);

    // Noise detail
    for (let i = 0; i < 10; i++) {
      const px = (i * 7 + 3) % ts, py = (i * 11 + 5) % ts;
      const v = ((i * 17 + 7) % 21) - 10;
      tx.fillStyle = rgbStr(baseR + v, baseG + v, baseB + v);
      tx.fillRect(px, py, 3 + (i % 3), 3 + ((i + 1) % 3));
    }

    if (detail) detail(tx, ts);
    TileCache[key] = tc;
  }

  // Grass - detailed with blades
  makeTile('grass', 45, 90, 30, (tx, s) => {
    // Grass blade strokes
    tx.strokeStyle = '#3a7a28'; tx.lineWidth = 1;
    for (let i = 0; i < 7; i++) {
      const bx = (i * 5 + 2) % 28 + 2;
      const by = 24 + (i * 3) % 8;
      const lean = ((i % 3) - 1) * 2;
      tx.beginPath(); tx.moveTo(bx, by);
      tx.quadraticCurveTo(bx + lean, by - 4, bx + lean * 0.5, by - 7 - (i % 4));
      tx.stroke();
    }
    // Lighter grass variation
    tx.strokeStyle = '#4a9a38'; tx.lineWidth = 0.8;
    for (let i = 0; i < 3; i++) {
      const bx = 8 + i * 10, by = 28;
      tx.beginPath(); tx.moveTo(bx, by); tx.lineTo(bx + 1, by - 5); tx.stroke();
    }
    // Top-left highlight
    tx.fillStyle = 'rgba(255,255,255,0.06)';
    tx.fillRect(0, 0, 6, 6);
    // Tiny flower dot
    tx.fillStyle = 'rgba(255,255,150,0.12)';
    tx.beginPath(); tx.arc(20, 10, 1, 0, Math.PI * 2); tx.fill();
  });

  // Dark ground
  makeTile('dark', 42, 42, 40, (tx) => {
    tx.fillStyle = 'rgba(0,0,0,0.1)'; tx.fillRect(8, 8, 16, 16);
    // Cracks
    tx.strokeStyle = 'rgba(0,0,0,0.12)'; tx.lineWidth = 0.5;
    tx.beginPath(); tx.moveTo(5, 15); tx.lineTo(20, 18); tx.stroke();
    tx.beginPath(); tx.moveTo(12, 4); tx.lineTo(16, 28); tx.stroke();
  });

  // Cave
  makeTile('cave', 26, 37, 53, (tx, s) => {
    tx.fillStyle = 'rgba(80,140,200,0.1)';
    tx.fillRect(4, 4, 12, 12);
    // Crystal glints
    tx.fillStyle = 'rgba(150,200,255,0.08)';
    tx.beginPath(); tx.arc(22, 8, 2, 0, Math.PI * 2); tx.fill();
    tx.beginPath(); tx.arc(10, 22, 1.5, 0, Math.PI * 2); tx.fill();
    // Moss
    tx.fillStyle = 'rgba(40,80,30,0.08)';
    tx.fillRect(0, 28, 10, 4);
  });

  // Ruins
  makeTile('ruins', 58, 52, 40, (tx) => {
    tx.strokeStyle = 'rgba(80,70,50,0.25)'; tx.lineWidth = 1;
    tx.strokeRect(3, 3, 13, 13);
    tx.strokeRect(18, 16, 11, 13);
    // Crack through stone
    tx.strokeStyle = 'rgba(60,50,30,0.15)'; tx.lineWidth = 0.5;
    tx.beginPath(); tx.moveTo(8, 2); tx.lineTo(12, 16); tx.lineTo(24, 30); tx.stroke();
    // Moss on ruins
    tx.fillStyle = 'rgba(50,90,30,0.08)';
    tx.fillRect(3, 14, 5, 3);
  });

  // Volcanic
  makeTile('volcanic', 42, 26, 18, (tx) => {
    tx.fillStyle = 'rgba(255,60,0,0.08)';
    tx.fillRect(6, 6, 18, 18);
    // Lava crack glow
    tx.strokeStyle = 'rgba(255,120,0,0.1)'; tx.lineWidth = 1;
    tx.beginPath(); tx.moveTo(4, 20); tx.lineTo(14, 12); tx.lineTo(28, 16); tx.stroke();
    // Ember
    tx.fillStyle = 'rgba(255,180,50,0.08)';
    tx.beginPath(); tx.arc(24, 6, 2, 0, Math.PI * 2); tx.fill();
  });

  // Shadow
  makeTile('shadow', 24, 16, 42, (tx) => {
    tx.fillStyle = 'rgba(100,60,160,0.08)';
    tx.fillRect(0, 0, 32, 32);
    // Shadow tendrils
    tx.strokeStyle = 'rgba(80,40,140,0.06)'; tx.lineWidth = 1.5;
    tx.beginPath(); tx.bezierCurveTo(4, 16, 16, 8, 28, 20); tx.stroke();
  });

  // Abyss
  makeTile('abyss', 18, 8, 8, (tx) => {
    tx.fillStyle = 'rgba(150,20,20,0.06)';
    tx.fillRect(2, 2, 28, 28);
    // Red glow cracks
    tx.strokeStyle = 'rgba(200,30,30,0.08)'; tx.lineWidth = 0.8;
    tx.beginPath(); tx.moveTo(8, 4); tx.lineTo(16, 16); tx.lineTo(24, 10); tx.stroke();
    tx.beginPath(); tx.moveTo(4, 24); tx.lineTo(20, 28); tx.stroke();
  });

  // Stone (village) - mortar visible
  makeTile('stone', 74, 69, 64, (tx, s) => {
    // Stone blocks with mortar gaps
    tx.strokeStyle = 'rgba(50,45,40,0.3)'; tx.lineWidth = 1.2;
    tx.strokeRect(2, 2, 13, 13);
    tx.strokeRect(17, 2, 13, 11);
    tx.strokeRect(4, 17, 11, 13);
    tx.strokeRect(17, 15, 13, 15);
    // Stone highlights
    tx.fillStyle = 'rgba(255,255,255,0.08)';
    tx.fillRect(3, 3, 12, 5);
    tx.fillRect(18, 3, 12, 4);
    // Mortar color
    tx.fillStyle = 'rgba(100,90,80,0.06)';
    tx.fillRect(15, 0, 2, 32);
    tx.fillRect(0, 15, 32, 2);
    // Worn spots
    tx.fillStyle = 'rgba(0,0,0,0.04)';
    tx.beginPath(); tx.arc(8, 8, 3, 0, Math.PI * 2); tx.fill();
  });

  // Ice
  makeTile('ice', 200, 224, 240, (tx, s) => {
    tx.fillStyle = 'rgba(200,230,255,0.2)';
    tx.fillRect(4, 8, 10, 8);
    // Ice surface reflections
    tx.fillStyle = 'rgba(255,255,255,0.15)';
    tx.beginPath(); tx.ellipse(16, 14, 8, 3, -0.2, 0, Math.PI * 2); tx.fill();
    // Cracks
    tx.strokeStyle = 'rgba(255,255,255,0.35)'; tx.lineWidth = 0.5;
    tx.beginPath(); tx.moveTo(5, 10); tx.lineTo(16, 18); tx.lineTo(28, 22); tx.stroke();
    tx.beginPath(); tx.moveTo(18, 4); tx.lineTo(12, 16); tx.lineTo(10, 28); tx.stroke();
    // Frost sparkle
    tx.fillStyle = 'rgba(255,255,255,0.2)';
    tx.beginPath(); tx.arc(24, 6, 1, 0, Math.PI * 2); tx.fill();
  });

  // Garden
  makeTile('garden', 42, 90, 40, (tx, s) => {
    const colors = ['#ff88aa', '#ffaa55', '#aa88ff', '#88ffaa', '#ffff88'];
    for (let i = 0; i < 4; i++) {
      tx.fillStyle = colors[(i * 3 + 1) % 5];
      tx.globalAlpha = 0.4;
      tx.beginPath(); tx.arc((i * 8 + 3) % 28 + 2, (i * 11 + 5) % 28 + 2, 2, 0, Math.PI * 2); tx.fill();
    }
    tx.globalAlpha = 1;
    // Grass blades
    tx.strokeStyle = '#3a8a28'; tx.lineWidth = 0.8;
    for (let i = 0; i < 4; i++) {
      const bx = 5 + i * 7, by = 28;
      tx.beginPath(); tx.moveTo(bx, by); tx.lineTo(bx + (((i * 7) % 5) - 2), by - 6); tx.stroke();
    }
    // Petal detail
    tx.fillStyle = 'rgba(255,200,220,0.1)';
    tx.beginPath(); tx.arc(16, 16, 1, 0, Math.PI * 2); tx.fill();
  });

  // Wasteland
  makeTile('wasteland', 26, 10, 10, (tx) => {
    tx.fillStyle = 'rgba(200,50,20,0.07)'; tx.fillRect(0, 0, 32, 32);
    // Scorched cracks
    tx.strokeStyle = 'rgba(100,30,10,0.1)'; tx.lineWidth = 0.8;
    tx.beginPath(); tx.moveTo(6, 4); tx.lineTo(16, 18); tx.stroke();
    tx.beginPath(); tx.moveTo(20, 6); tx.lineTo(26, 26); tx.stroke();
    // Ember dot
    tx.fillStyle = 'rgba(255,100,30,0.06)';
    tx.beginPath(); tx.arc(12, 24, 2, 0, Math.PI * 2); tx.fill();
  });

  // Water
  makeTile('water', 30, 60, 130, (tx, s) => {
    // Water reflections
    tx.fillStyle = 'rgba(100,180,255,0.14)';
    tx.fillRect(3, 7, 22, 5);
    tx.fillStyle = 'rgba(255,255,255,0.1)';
    tx.beginPath(); tx.ellipse(16, 14, 9, 3, -0.2, 0, Math.PI * 2); tx.fill();
    // Ripple lines
    tx.strokeStyle = 'rgba(150,200,255,0.08)'; tx.lineWidth = 0.5;
    tx.beginPath(); tx.ellipse(10, 22, 6, 2, 0, 0, Math.PI * 2); tx.stroke();
    tx.beginPath(); tx.ellipse(22, 10, 5, 1.5, 0.3, 0, Math.PI * 2); tx.stroke();
    // Sparkle
    tx.fillStyle = 'rgba(255,255,255,0.12)';
    tx.beginPath(); tx.arc(8, 12, 0.8, 0, Math.PI * 2); tx.fill();
  });
}

// ============================================================
//  MASTER GENERATOR
// ============================================================
function generateAllSprites() {
  console.time('SpriteGen');

  genTerrainTiles();

  // Slimes
  genSlime('slime_green', '#44cc44', '#88ff88', '#228822', 56);
  genSlime('slime_blue', '#4488ff', '#88bbff', '#224488', 56);

  // Wolf
  genWolf('wolf_gray', '#888888', '#aaaaaa', '#555555');

  // Goblin
  genHumanoid('goblin_scout', {
    skinC: '#7a9944', skinD: '#5a7730', skinL: '#8aaa55',
    hairC: '#3a5520',
    armorC: '#6a5a3a', armorD: '#4a3a20', armorL: '#8a7a5a',
    weaponType: 'spear', weaponC: '#999999', height: 52, width: 40,
    eyeC: '#ffff00', hatType: 'none'
  });

  // Skeleton
  genSkeleton('skeleton_warrior');

  // Dark Mage
  genHumanoid('dark_mage', {
    skinC: '#a088aa', skinD: '#806088', skinL: '#c0a8cc',
    armorC: '#3a2255', armorD: '#221144', armorL: '#5a3a77',
    capeC: '#2a1144', weaponType: 'staff', weaponC: '#aa44ff',
    hatType: 'wizard', hatC: '#2a1155', eyeC: '#ff44ff',
    auraC: 'rgba(100,0,180,0.08)', height: 64, width: 48
  });

  // Crystal Golem
  genGolem('crystal_golem', '#4488aa', '#88ccee', '#225566', '#88ddff');

  // Vampire Lord
  genHumanoid('vampire_lord', {
    skinC: '#e0d0d0', skinD: '#b0a0a0', skinL: '#f0e8e8',
    hairC: '#1a1a2a',
    armorC: '#550022', armorD: '#330011', armorL: '#880044',
    capeC: '#440022', weaponType: 'none', eyeC: '#ff0000',
    hatType: 'none', height: 64, width: 48,
    auraC: 'rgba(150,0,30,0.06)', glow: '#ff0000'
  });

  // Ancient Guardian
  genGolem('ancient_guardian', '#aa8844', '#ccaa66', '#886633', '#ffaa22');

  // Fire Dragon
  genDragon('fire_dragon', '#cc3300', '#ff6644', '#881100', '#aa220088');

  // Shadow Assassin
  genHumanoid('shadow_assassin', {
    skinC: '#3a3a4a', skinD: '#2a2a3a', skinL: '#4a4a5a',
    hairC: '#111111',
    armorC: '#222233', armorD: '#111122', armorL: '#333344',
    capeC: '#111122', weaponType: 'dagger', weaponC: '#8888aa',
    hatType: 'hood', hatC: '#1a1a2a', eyeC: '#ff4444',
    auraC: 'rgba(30,0,60,0.1)', height: 60, width: 44
  });

  // Abyss Demon
  genDemon('abyss_demon');

  // Zone monsters
  genSlime('ice_elemental', '#88ddff', '#bbeeff', '#4488aa', 56);
  genWolf('frost_wolf', '#aaccee', '#ccddff', '#6688aa');
  genSlime('garden_sprite', '#66ff88', '#99ffbb', '#33aa55', 48);
  genGolem('thorn_golem', '#558844', '#77aa66', '#336622', '#88ff44');
  genHumanoid('doom_knight', {
    skinC: '#4a3040', skinD: '#3a2030', skinL: '#5a4050',
    armorC: '#660033', armorD: '#440022', armorL: '#880044',
    capeC: '#330011', weaponType: 'sword', weaponC: '#ff2244',
    hatType: 'helm', hatC: '#550022', eyeC: '#ff0000',
    auraC: 'rgba(150,0,50,0.1)', glow: '#ff2244', height: 68, width: 50
  });

  // World Bosses
  genGolem('world_boss_treant', '#336622', '#55aa44', '#1a4411', '#88ff44');
  genSkeleton('world_boss_lich');
  genDragon('world_boss_crystal_dragon', '#4488cc', '#88eeff', '#225588', '#44aaff88');

  // Player classes (detailed 64x84)
  genPlayerWarrior();
  genPlayerMage();
  genPlayerRogue();
  genPlayerHealer();
  genPlayerArcher();

  // NPCs
  genHumanoid('npc_elder', {
    skinC: '#d0b088', skinD: '#b09068', skinL: '#e8d0a8',
    armorC: '#8a7a5a', armorD: '#6a5a3a', armorL: '#aa9a7a',
    weaponType: 'staff', weaponC: '#aa8844', hatType: 'none',
    hairC: '#aaaaaa', height: 64, width: 48
  });
  genHumanoid('npc_shopkeeper', {
    skinC: '#d4a07a', skinD: '#b08050', skinL: '#e8c8a0',
    armorC: '#886644', armorD: '#664422', armorL: '#aa8866',
    weaponType: 'none', hatType: 'none', hairC: '#443322',
    height: 64, width: 48
  });
  genHumanoid('npc_blacksmith', {
    skinC: '#c09070', skinD: '#a07050', skinL: '#d8a888',
    armorC: '#aa4422', armorD: '#882211', armorL: '#cc6644',
    weaponType: 'none', hatType: 'none', hairC: '#222222',
    height: 66, width: 50
  });
  genHumanoid('npc_healer', {
    skinC: '#f0d8c0', skinD: '#d0b8a0', skinL: '#fff0e0',
    armorC: '#eeeeff', armorD: '#ccccdd', armorL: '#ffffff',
    weaponType: 'staff', weaponC: '#ffd700', hatType: 'crown',
    hairC: '#ddbb66', eyeC: '#4488ff', height: 64, width: 48
  });

  // Trees (detailed with depth)
  genTree('tree_oak', '#5a3a1a', '#2d6a1e', '#1a4a10', '#4a8a3a', 96);
  genTree('tree_pine', '#4a3018', '#1a5a2a', '#0a3a18', '#3a7a3a', 100);
  genTree('tree_dead', '#4a3828', '#3a2818', '#2a1808', '#4a3828', 76);
  genTree('tree_crystal', '#3a4a5a', '#4488cc', '#2266aa', '#66aaee', 80);

  // Rocks (3D with texture)
  function genRock(key, baseC, size) {
    const c = makeCanvas(size, size);
    const ctx = c.getContext('2d');
    const rcx = size / 2, rcy = size * 0.6;
    draw3DShadow(ctx, rcx + 2, rcy + size * 0.2, size * 0.38, size * 0.1);
    const rg = ctx.createRadialGradient(rcx - 2, rcy - 3, 1, rcx, rcy, size * 0.38);
    rg.addColorStop(0, colorShift(baseC, 28));
    rg.addColorStop(0.6, baseC);
    rg.addColorStop(1, colorShift(baseC, -35));
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.moveTo(rcx - size * 0.35, rcy + 2);
    ctx.quadraticCurveTo(rcx - size * 0.32, rcy - size * 0.32, rcx - size * 0.05, rcy - size * 0.38);
    ctx.quadraticCurveTo(rcx + size * 0.15, rcy - size * 0.35, rcx + size * 0.35, rcy - size * 0.1);
    ctx.quadraticCurveTo(rcx + size * 0.3, rcy + size * 0.12, rcx + size * 0.1, rcy + size * 0.15);
    ctx.quadraticCurveTo(rcx - size * 0.15, rcy + size * 0.18, rcx - size * 0.35, rcy + 2);
    ctx.fill();
    // Cracks
    ctx.strokeStyle = colorShift(baseC, -20); ctx.lineWidth = 0.5; ctx.globalAlpha = 0.4;
    ctx.beginPath(); ctx.moveTo(rcx - 2, rcy - size * 0.2); ctx.lineTo(rcx + 1, rcy + size * 0.05); ctx.stroke();
    ctx.globalAlpha = 1;
    // Moss
    ctx.fillStyle = 'rgba(60,100,40,0.12)';
    ctx.beginPath(); ctx.ellipse(rcx - size * 0.1, rcy + size * 0.05, size * 0.1, size * 0.06, 0, 0, Math.PI * 2); ctx.fill();
    addSpecular(ctx, rcx - 3, rcy - size * 0.22, size * 0.08, 0.5, 0.28);
    EnvCache[key] = c;
  }
  genRock('rock_gray', '#6a6a6a', 24);
  genRock('rock_brown', '#6a5a4a', 28);
  genRock('rock_dark', '#3a3a3a', 22);
  genRock('rock_ice', '#8ab0cc', 20);
  genRock('rock_lava', '#5a3020', 26);

  // Bushes (leafy with flowers)
  function genBush(key, leafC, size) {
    const c = makeCanvas(size, size);
    const ctx = c.getContext('2d');
    const bcx = size / 2, bcy = size * 0.6;
    draw3DShadow(ctx, bcx, bcy + size * 0.15, size * 0.32, size * 0.08);
    const layers = [
      { ox: -4, oy: 3, r: size * 0.26 },
      { ox: 4, oy: 1, r: size * 0.24 },
      { ox: 0, oy: -2, r: size * 0.22 },
      { ox: -2, oy: -5, r: size * 0.16 }
    ];
    for (const l of layers) {
      drawOrganicBlob(ctx, bcx + l.ox, bcy + l.oy, l.r, leafC, colorShift(leafC, 18), colorShift(leafC, -28), 4);
    }
    // Small flower dots on bush_flower
    if (key === 'bush_flower') {
      ctx.fillStyle = '#ff88cc';
      ctx.beginPath(); ctx.arc(bcx - 3, bcy - 4, 1.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffaa88';
      ctx.beginPath(); ctx.arc(bcx + 5, bcy - 1, 1.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#cc88ff';
      ctx.beginPath(); ctx.arc(bcx - 1, bcy + 2, 1, 0, Math.PI * 2); ctx.fill();
    }
    // Leaf highlight
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.beginPath(); ctx.ellipse(bcx - 3, bcy - 6, size * 0.1, size * 0.06, -0.3, 0, Math.PI * 2); ctx.fill();
    EnvCache[key] = c;
  }
  genBush('bush_green', '#2a6a1e', 28);
  genBush('bush_flower', '#5a3a6a', 24);
  genBush('bush_autumn', '#8a6a2a', 26);
  genBush('bush_snow', '#8aaabb', 22);

  // Buildings (3D with detail)
  genBuilding('building_house', '#8a7a5a', '#884422', 80, 88, { chimney: true });
  genBuilding('building_shop', '#7a8a6a', '#446644', 88, 84, { sign: 'SHOP' });
  genBuilding('building_inn', '#8a7060', '#664433', 96, 92, { chimney: true, sign: 'INN' });
  genBuilding('building_blacksmith', '#6a5a4a', '#553322', 76, 80, { chimney: true, sign: 'FORGE' });
  genBuilding('building_townhall', '#8a8a7a', '#555544', 120, 100, { sign: 'TOWN HALL' });

  console.timeEnd('SpriteGen');
  console.log('Sprites:', Object.keys(SpriteCache).length, 'entities,', Object.keys(EnvCache).length, 'env,', Object.keys(TileCache).length, 'tiles');
}

// ============================================================
//  RuneWord Chronicle - 3D-Style Procedural Sprite Engine
//  Advanced Canvas2D rendering with lighting, shading, materials
// ============================================================
const SpriteCache = {};
const EnvCache = {};
const TileCache = {};

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

// ============================================================
//  3D RENDERING HELPERS
// ============================================================
function draw3DShadow(ctx, cx, cy, rx, ry) {
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rx);
  g.addColorStop(0, 'rgba(0,0,0,0.35)');
  g.addColorStop(0.6, 'rgba(0,0,0,0.15)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry || rx * 0.35, 0, 0, Math.PI * 2); ctx.fill();
}

function drawSphere(ctx, cx, cy, r, baseC, lightC, darkC) {
  // Main body
  const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.05, cx, cy, r);
  g.addColorStop(0, lightC); g.addColorStop(0.5, baseC); g.addColorStop(1, darkC);
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  // Specular
  addSpecular(ctx, cx - r * 0.25, cy - r * 0.3, r * 0.25, r * 0.18);
}

function drawCylinder(ctx, x, y, w, h, baseC, lightC, darkC) {
  const g = ctx.createLinearGradient(x, y, x + w, y);
  g.addColorStop(0, darkC); g.addColorStop(0.3, lightC); g.addColorStop(0.6, baseC); g.addColorStop(1, darkC);
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
}

function drawMetalPlate(ctx, x, y, w, h, baseC, lightC, darkC) {
  // Base
  const g = ctx.createLinearGradient(x, y, x + w * 0.3, y + h);
  g.addColorStop(0, lightC || '#bbb'); g.addColorStop(0.4, baseC || '#888'); g.addColorStop(1, darkC || '#555');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 2); ctx.fill();
  // Top bevel
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fillRect(x + 1, y + 1, w - 2, 2);
  // Bottom shadow
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.fillRect(x + 1, y + h - 2, w - 2, 1);
}

function addSpecular(ctx, cx, cy, rx, ry, alpha) {
  ctx.fillStyle = `rgba(255,255,255,${alpha || 0.45})`;
  ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry || rx * 0.6, -0.4, 0, Math.PI * 2); ctx.fill();
}

function addRimLight(ctx, cx, cy, r, color, alpha) {
  ctx.strokeStyle = color || 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = alpha || 0.3;
  ctx.beginPath(); ctx.arc(cx, cy, r, -Math.PI * 0.7, Math.PI * 0.1); ctx.stroke();
  ctx.globalAlpha = 1;
}

function addAO(ctx, cx, cy, rx, ry) {
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry || 3, 0, 0, Math.PI * 2); ctx.fill();
}

function colorShift(hex, amt) {
  let r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  r = Math.max(0, Math.min(255, r + amt)); g = Math.max(0, Math.min(255, g + amt)); b = Math.max(0, Math.min(255, b + amt));
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

// ============================================================
//  SLIME SPRITES (3D translucent jelly with subsurface scattering)
// ============================================================
function genSlime(key, mainC, lightC, darkC, size) {
  const frames = [];
  for (let f = 0; f < 4; f++) {
    const s = size || 56;
    const c = makeCanvas(s, s);
    const x = c.getContext('2d');
    const cx = s / 2, cy = s / 2 + 3;
    const squish = 1 + Math.sin(f * Math.PI / 2) * 0.15;
    const rw = s * 0.4 * squish, rh = s * 0.34 / squish;
    const baseY = cy + (1 - 1 / squish) * s * 0.1;

    // Ground shadow with gradient
    draw3DShadow(x, cx, s * 0.88, rw * 0.75, 5);

    // Subsurface scattering glow
    x.fillStyle = lightC; x.globalAlpha = 0.12;
    x.beginPath(); x.ellipse(cx, baseY + 2, rw * 0.9, rh * 0.8, 0, 0, Math.PI * 2); x.fill();
    x.globalAlpha = 1;

    // Body outline (ambient occlusion ring)
    x.fillStyle = darkC;
    x.beginPath(); x.ellipse(cx, baseY + 1, rw + 2, rh + 2, 0, 0, Math.PI * 2); x.fill();

    // Main body - 3D sphere gradient
    const bg = x.createRadialGradient(cx - s * 0.1, baseY - s * 0.12, s * 0.02, cx + s * 0.02, baseY + s * 0.02, rw * 1.05);
    bg.addColorStop(0, lightC); bg.addColorStop(0.35, mainC); bg.addColorStop(0.7, darkC); bg.addColorStop(1, colorShift(darkC, -30));
    x.fillStyle = bg;
    x.beginPath(); x.ellipse(cx, baseY, rw, rh, 0, 0, Math.PI * 2); x.fill();

    // Internal light (subsurface)
    const ig = x.createRadialGradient(cx + s * 0.02, baseY + rh * 0.15, 0, cx, baseY, rw * 0.7);
    ig.addColorStop(0, 'rgba(255,255,255,0.12)'); ig.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = ig;
    x.beginPath(); x.ellipse(cx, baseY + rh * 0.1, rw * 0.6, rh * 0.5, 0, 0, Math.PI * 2); x.fill();

    // Specular highlight (large)
    x.fillStyle = 'rgba(255,255,255,0.45)';
    x.beginPath(); x.ellipse(cx - s * 0.1, baseY - rh * 0.45, rw * 0.28, rh * 0.15, -0.5, 0, Math.PI * 2); x.fill();
    // Specular (small sharp)
    x.fillStyle = 'rgba(255,255,255,0.65)';
    x.beginPath(); x.ellipse(cx - s * 0.13, baseY - rh * 0.52, rw * 0.08, rh * 0.05, -0.3, 0, Math.PI * 2); x.fill();

    // Rim light
    x.strokeStyle = lightC; x.lineWidth = 1.5; x.globalAlpha = 0.35;
    x.beginPath(); x.arc(cx, baseY, rw * 0.85, -Math.PI * 0.8, -Math.PI * 0.1); x.stroke();
    x.globalAlpha = 1;

    // Eyes - 3D spheres
    const eyeY = baseY - rh * 0.15;
    [-5, 5].forEach(ox => {
      // Eye white (sphere)
      const eg = x.createRadialGradient(cx + ox - 1, eyeY - 1, 0.5, cx + ox, eyeY, 5);
      eg.addColorStop(0, '#fff'); eg.addColorStop(0.8, '#e8e8e8'); eg.addColorStop(1, '#ccc');
      x.fillStyle = eg;
      x.beginPath(); x.ellipse(cx + ox, eyeY, 5, 6, 0, 0, Math.PI * 2); x.fill();
      // Iris
      x.fillStyle = '#222';
      x.beginPath(); x.arc(cx + ox + 1, eyeY + 1, 3, 0, Math.PI * 2); x.fill();
      // Pupil highlight
      x.fillStyle = '#fff';
      x.beginPath(); x.arc(cx + ox - 0.5, eyeY - 1, 1.5, 0, Math.PI * 2); x.fill();
    });

    // Mouth
    x.strokeStyle = darkC; x.lineWidth = 1.5; x.lineCap = 'round';
    x.beginPath(); x.arc(cx + 1, baseY + rh * 0.2, 4, 0.3, Math.PI - 0.3); x.stroke();

    // Cheek blush
    x.fillStyle = 'rgba(255,150,150,0.2)';
    x.beginPath(); x.ellipse(cx - 10, baseY + 2, 4, 2.5, 0, 0, Math.PI * 2); x.fill();
    x.beginPath(); x.ellipse(cx + 12, baseY + 2, 4, 2.5, 0, 0, Math.PI * 2); x.fill();

    // Bounce particles
    if (f === 0 || f === 2) {
      x.fillStyle = lightC; x.globalAlpha = 0.3;
      x.beginPath(); x.arc(cx - rw * 0.6, baseY + rh * 0.8, 2, 0, Math.PI * 2); x.fill();
      x.beginPath(); x.arc(cx + rw * 0.7, baseY + rh * 0.7, 1.5, 0, Math.PI * 2); x.fill();
      x.globalAlpha = 1;
    }

    frames.push(c);
  }
  SpriteCache[key] = frames;
}

// ============================================================
//  WOLF SPRITE (3D muscular beast with fur detail)
// ============================================================
function genWolf(key, bodyC, lightC, darkC) {
  const frames = [];
  for (let f = 0; f < 4; f++) {
    const c = makeCanvas(68, 52);
    const x = c.getContext('2d');
    const cx = 34, legOff = Math.sin(f * Math.PI / 2) * 4;

    draw3DShadow(x, cx, 47, 22, 5);

    // Tail with fur
    x.strokeStyle = bodyC; x.lineWidth = 5; x.lineCap = 'round';
    x.beginPath(); x.moveTo(10, 24);
    x.quadraticCurveTo(4, 14 + Math.sin(f * Math.PI / 2) * 4, 7, 9); x.stroke();
    x.strokeStyle = lightC; x.lineWidth = 2.5;
    x.beginPath(); x.moveTo(10, 24);
    x.quadraticCurveTo(5, 15, 8, 10); x.stroke();

    // Back legs with 3D cylinder shading
    [14, 20].forEach((lx, i) => {
      const lo = i === 0 ? -legOff : legOff;
      drawCylinder(x, lx, 30 + lo, 6, 14 - lo * 0.3, bodyC, lightC, darkC);
      // Paw
      x.fillStyle = darkC;
      x.beginPath(); x.ellipse(lx + 3, 43 + lo * 0.2, 5, 3, 0, 0, Math.PI * 2); x.fill();
    });
    // Front legs
    [40, 46].forEach((lx, i) => {
      const lo = i === 0 ? legOff : -legOff;
      drawCylinder(x, lx, 30 + lo, 6, 14 - lo * 0.3, bodyC, lightC, darkC);
      x.fillStyle = darkC;
      x.beginPath(); x.ellipse(lx + 3, 43 + lo * 0.2, 5, 3, 0, 0, Math.PI * 2); x.fill();
    });

    // Body - 3D ellipsoid
    const bg = x.createRadialGradient(cx - 5, 20, 3, cx, 26, 22);
    bg.addColorStop(0, lightC); bg.addColorStop(0.5, bodyC); bg.addColorStop(1, darkC);
    x.fillStyle = bg;
    x.beginPath(); x.ellipse(cx, 26, 22, 11, 0, 0, Math.PI * 2); x.fill();

    // Fur tufts on back
    x.strokeStyle = lightC; x.lineWidth = 1; x.globalAlpha = 0.4;
    for (let i = 0; i < 6; i++) {
      const fx = 18 + i * 5, fy = 18 + Math.sin(i * 1.2) * 2;
      x.beginPath(); x.moveTo(fx, fy + 3); x.lineTo(fx + 1, fy); x.stroke();
    }
    x.globalAlpha = 1;

    // Body rim light
    addRimLight(x, cx, 26, 21, lightC, 0.2);

    // Head - 3D sphere
    drawSphere(x, 50, 19, 11, bodyC, lightC, darkC);

    // Snout
    const sg = x.createRadialGradient(57, 21, 1, 57, 22, 6);
    sg.addColorStop(0, lightC); sg.addColorStop(1, darkC);
    x.fillStyle = sg;
    x.beginPath(); x.ellipse(57, 22, 6, 4.5, 0.2, 0, Math.PI * 2); x.fill();
    // Nose
    x.fillStyle = '#1a1a1a';
    x.beginPath(); x.ellipse(61, 21, 2.5, 2, 0, 0, Math.PI * 2); x.fill();
    addSpecular(x, 60, 20, 1, 0.8, 0.5);

    // Ears
    x.fillStyle = bodyC;
    x.beginPath(); x.moveTo(44, 12); x.lineTo(40, 3); x.lineTo(46, 10); x.fill();
    x.beginPath(); x.moveTo(52, 11); x.lineTo(50, 2); x.lineTo(55, 9); x.fill();
    x.fillStyle = '#cc8888';
    x.beginPath(); x.moveTo(44, 11); x.lineTo(41, 5); x.lineTo(46, 10); x.fill();
    x.beginPath(); x.moveTo(52, 10); x.lineTo(51, 4); x.lineTo(54, 9); x.fill();

    // Eyes - glowing
    x.fillStyle = '#ff8'; x.shadowColor = '#ff8'; x.shadowBlur = 4;
    x.beginPath(); x.ellipse(47, 17, 3, 3.5, 0, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#111'; x.shadowBlur = 0;
    x.beginPath(); x.ellipse(47.5, 17, 1.5, 3, 0, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#fff';
    x.beginPath(); x.arc(46.5, 15.5, 1, 0, Math.PI * 2); x.fill();

    // Teeth hint
    x.fillStyle = '#fff'; x.globalAlpha = 0.6;
    x.beginPath(); x.moveTo(55, 25); x.lineTo(54, 27); x.lineTo(56, 27); x.fill();
    x.beginPath(); x.moveTo(58, 25); x.lineTo(57, 27); x.lineTo(59, 27); x.fill();
    x.globalAlpha = 1;

    frames.push(c);
  }
  SpriteCache[key] = frames;
}

// ============================================================
//  HUMANOID SPRITE (3D shaded with armor/cloth materials)
// ============================================================
function genHumanoid(key, opts) {
  const frames = [];
  const {
    skinC = '#d4a07a', skinD = '#b08050', skinL = '#e8c8a0',
    hairC = '#553322', armorC = '#888', armorD = '#555', armorL = '#aaa',
    capeC = null, weaponType = 'none', weaponC = '#aaa',
    eyeC = '#333', height = 64, width = 48,
    hatType = 'none', hatC = '#444',
    special = null, auraC = null, glow = null
  } = opts;

  for (let f = 0; f < 4; f++) {
    const c = makeCanvas(width, height);
    const x = c.getContext('2d');
    const cx = width / 2, bob = Math.sin(f * Math.PI / 2) * 1.5;
    const legPhase = Math.sin(f * Math.PI / 2) * 2.5;
    const armSwing = Math.sin(f * Math.PI / 2) * 3;

    draw3DShadow(x, cx, height - 4, 13, 4);

    // Aura
    if (auraC) {
      x.fillStyle = auraC;
      x.beginPath(); x.ellipse(cx, height * 0.5, width * 0.48, height * 0.46, 0, 0, Math.PI * 2); x.fill();
    }

    // Cape
    if (capeC) {
      const cg = x.createLinearGradient(cx - 10, height * 0.35, cx + 10, height * 0.8);
      cg.addColorStop(0, capeC); cg.addColorStop(1, colorShift(capeC, -40));
      x.fillStyle = cg;
      x.beginPath();
      x.moveTo(cx - 8, height * 0.36 + bob);
      x.quadraticCurveTo(cx - 12, height * 0.6, cx - 10 + Math.sin(f) * 2, height * 0.82);
      x.lineTo(cx + 10 - Math.sin(f) * 2, height * 0.82);
      x.quadraticCurveTo(cx + 12, height * 0.6, cx + 8, height * 0.36 + bob);
      x.fill();
      // Cape fold shadow
      x.fillStyle = 'rgba(0,0,0,0.15)';
      x.beginPath();
      x.moveTo(cx + 3, height * 0.38 + bob); x.lineTo(cx + 8, height * 0.82);
      x.lineTo(cx + 2, height * 0.82); x.fill();
    }

    // Legs with 3D shading
    drawCylinder(x, cx - 6, height * 0.63 + bob, 5, 12 + legPhase * 0.5, armorC, armorL, armorD);
    drawCylinder(x, cx + 1, height * 0.63 + bob, 5, 12 - legPhase * 0.5, armorC, armorL, armorD);
    // Boots
    x.fillStyle = '#3a2820';
    x.beginPath(); x.roundRect(cx - 7, height * 0.82 + bob + legPhase * 0.3, 7, 5, 2); x.fill();
    x.beginPath(); x.roundRect(cx, height * 0.82 + bob - legPhase * 0.3, 7, 5, 2); x.fill();

    // Body/Armor - 3D metal plate
    drawMetalPlate(x, cx - 10, height * 0.34 + bob, 20, height * 0.32, armorC, armorL, armorD);
    // Armor center line
    x.strokeStyle = armorD; x.lineWidth = 0.8;
    x.beginPath(); x.moveTo(cx, height * 0.36 + bob); x.lineTo(cx, height * 0.64 + bob); x.stroke();
    // Belt
    x.fillStyle = '#5a4030';
    x.fillRect(cx - 10, height * 0.6 + bob, 20, 3);
    x.fillStyle = '#ffd700';
    x.fillRect(cx - 2, height * 0.6 + bob, 4, 3);

    // Arms
    drawCylinder(x, cx - 14, height * 0.37 + bob + armSwing, 5, 15, armorC, armorL, armorD);
    drawCylinder(x, cx + 9, height * 0.37 + bob - armSwing, 5, 15, armorC, armorL, armorD);
    // Hands
    drawSphere(x, cx - 11.5, height * 0.57 + bob + armSwing, 3, skinC, skinL, skinD);
    drawSphere(x, cx + 11.5, height * 0.57 + bob - armSwing, 3, skinC, skinL, skinD);

    // Weapon
    if (weaponType === 'sword') {
      x.fillStyle = '#ddd';
      x.fillRect(cx + 12, height * 0.28 + bob - armSwing, 2.5, 24);
      x.fillStyle = 'rgba(255,255,255,0.3)';
      x.fillRect(cx + 12, height * 0.28 + bob - armSwing, 1, 24);
      x.fillStyle = '#ffd700';
      x.fillRect(cx + 9.5, height * 0.5 + bob - armSwing, 8, 3);
    } else if (weaponType === 'staff') {
      x.fillStyle = '#6a4a2a';
      x.fillRect(cx + 12, height * 0.15 + bob, 2.5, 34);
      drawSphere(x, cx + 13.25, height * 0.12 + bob, 6, weaponC, colorShift(weaponC, 40), colorShift(weaponC, -40));
      // Orb glow
      x.fillStyle = weaponC; x.globalAlpha = 0.15;
      x.beginPath(); x.arc(cx + 13.25, height * 0.12 + bob, 10, 0, Math.PI * 2); x.fill();
      x.globalAlpha = 1;
    } else if (weaponType === 'dagger') {
      x.fillStyle = '#ccc';
      x.fillRect(cx - 15, height * 0.44 + bob + armSwing, 2, 12);
      x.fillRect(cx + 13, height * 0.44 + bob - armSwing, 2, 12);
    } else if (weaponType === 'spear') {
      x.fillStyle = '#6a4a2a';
      x.fillRect(cx + 12, height * 0.08 + bob, 2.5, 40);
      x.fillStyle = '#ccc';
      x.beginPath(); x.moveTo(cx + 13.25, height * 0.03 + bob);
      x.lineTo(cx + 10, height * 0.12 + bob); x.lineTo(cx + 16.5, height * 0.12 + bob); x.fill();
    }

    // Head - 3D sphere
    drawSphere(x, cx, height * 0.25 + bob, 9, skinC, skinL, skinD);

    // Hair/Hat
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
      x.fillStyle = '#222';
      x.fillRect(cx - 6, height * 0.24 + bob, 12, 2);
    } else if (hatType === 'crown') {
      x.fillStyle = '#ffd700';
      x.fillRect(cx - 8, height * 0.13 + bob, 16, 7);
      for (let i = -2; i <= 2; i++) {
        x.fillRect(cx + i * 3.5 - 1, height * 0.1 + bob, 2.5, 5);
      }
      x.fillStyle = '#ff2244';
      x.beginPath(); x.arc(cx, height * 0.14 + bob, 2, 0, Math.PI * 2); x.fill();
    }

    // Eyes
    x.fillStyle = '#fff';
    x.fillRect(cx - 5.5, height * 0.23 + bob, 4, 3.5);
    x.fillRect(cx + 1.5, height * 0.23 + bob, 4, 3.5);
    x.fillStyle = eyeC;
    x.fillRect(cx - 4.5, height * 0.235 + bob, 2.5, 3);
    x.fillRect(cx + 2.5, height * 0.235 + bob, 2.5, 3);

    // Mouth
    x.fillStyle = skinD;
    x.fillRect(cx - 2, height * 0.3 + bob, 4, 1.2);

    // Glow effect
    if (glow) {
      x.shadowColor = glow; x.shadowBlur = 10;
      x.fillStyle = glow; x.globalAlpha = 0.08;
      x.beginPath(); x.ellipse(cx, height * 0.5, width * 0.4, height * 0.4, 0, 0, Math.PI * 2); x.fill();
      x.globalAlpha = 1; x.shadowBlur = 0;
    }

    // Special undead eyes
    if (special === 'undead') {
      x.globalAlpha = 0.4; x.fillStyle = '#88ff88';
      x.beginPath(); x.arc(cx - 3, height * 0.24 + bob, 3.5, 0, Math.PI * 2); x.fill();
      x.beginPath(); x.arc(cx + 3, height * 0.24 + bob, 3.5, 0, Math.PI * 2); x.fill();
      x.globalAlpha = 1;
    }

    frames.push(c);
  }
  SpriteCache[key] = frames;
}

// ============================================================
//  SKELETON SPRITE (3D bone structure with glowing eyes)
// ============================================================
function genSkeleton(key) {
  const frames = [];
  const bone = '#f0e8d8', bonD = '#c8b898', bonL = '#fff8f0';
  for (let f = 0; f < 4; f++) {
    const c = makeCanvas(48, 64);
    const x = c.getContext('2d');
    const cx = 24, bob = Math.sin(f * Math.PI / 2) * 1.2;

    draw3DShadow(x, cx, 58, 12, 4);

    // Legs (bone-like with 3D)
    const lp = Math.sin(f * Math.PI / 2) * 2.5;
    x.strokeStyle = bone; x.lineWidth = 4; x.lineCap = 'round';
    x.beginPath(); x.moveTo(cx - 5, 42 + bob); x.lineTo(cx - 6, 54 + lp); x.stroke();
    x.beginPath(); x.moveTo(cx + 5, 42 + bob); x.lineTo(cx + 6, 54 - lp); x.stroke();
    // Bone joint spheres
    drawSphere(x, cx - 5, 42 + bob, 3, bone, bonL, bonD);
    drawSphere(x, cx + 5, 42 + bob, 3, bone, bonL, bonD);
    // Feet bones
    x.fillStyle = bonD;
    x.fillRect(cx - 9, 53 + lp, 7, 2); x.fillRect(cx + 3, 53 - lp, 7, 2);

    // Ribcage - 3D
    drawSphere(x, cx, 34 + bob, 10, bone, bonL, bonD);
    // Rib lines (3D curved)
    x.strokeStyle = bonD; x.lineWidth = 1.2;
    for (let i = -2; i <= 2; i++) {
      x.beginPath();
      x.moveTo(cx - 7, 31 + i * 3.5 + bob);
      x.quadraticCurveTo(cx, 30 + i * 3.5 + bob, cx + 7, 31 + i * 3.5 + bob);
      x.stroke();
    }
    // Spine
    x.strokeStyle = bone; x.lineWidth = 3;
    x.beginPath(); x.moveTo(cx, 24 + bob); x.lineTo(cx, 46 + bob); x.stroke();
    // Spine segments
    x.strokeStyle = bonD; x.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      const sy = 26 + i * 4 + bob;
      x.beginPath(); x.moveTo(cx - 2, sy); x.lineTo(cx + 2, sy); x.stroke();
    }

    // Arms with joint spheres
    const as = Math.sin(f * Math.PI / 2) * 3;
    x.strokeStyle = bone; x.lineWidth = 3;
    x.beginPath(); x.moveTo(cx - 10, 28 + bob); x.lineTo(cx - 16, 42 + bob + as); x.stroke();
    x.beginPath(); x.moveTo(cx + 10, 28 + bob); x.lineTo(cx + 16, 42 + bob - as); x.stroke();
    drawSphere(x, cx - 10, 28 + bob, 2.5, bone, bonL, bonD);
    drawSphere(x, cx + 10, 28 + bob, 2.5, bone, bonL, bonD);

    // Sword (rusty)
    const swG = x.createLinearGradient(cx + 17, 24, cx + 19, 24);
    swG.addColorStop(0, '#999'); swG.addColorStop(0.5, '#bbb'); swG.addColorStop(1, '#777');
    x.fillStyle = swG;
    x.fillRect(cx + 17, 22 + bob - as, 2.5, 20);
    x.fillStyle = '#8a6a3a';
    x.fillRect(cx + 14, 40 + bob - as, 8, 3);

    // Skull - 3D sphere
    drawSphere(x, cx, 17 + bob, 10, bone, bonL, bonD);
    // Jaw
    x.fillStyle = bone;
    x.beginPath();
    x.moveTo(cx - 7, 22 + bob); x.lineTo(cx - 5, 27 + bob);
    x.lineTo(cx + 5, 27 + bob); x.lineTo(cx + 7, 22 + bob); x.fill();

    // Eye sockets
    x.fillStyle = '#1a0808';
    x.beginPath(); x.ellipse(cx - 4, 15 + bob, 3, 3.5, 0, 0, Math.PI * 2); x.fill();
    x.beginPath(); x.ellipse(cx + 4, 15 + bob, 3, 3.5, 0, 0, Math.PI * 2); x.fill();
    // Glowing eyes
    x.fillStyle = '#ff4444'; x.shadowColor = '#ff2222'; x.shadowBlur = 6;
    x.globalAlpha = 0.7 + Math.sin(f * Math.PI / 2) * 0.3;
    x.beginPath(); x.arc(cx - 4, 15 + bob, 2, 0, Math.PI * 2); x.fill();
    x.beginPath(); x.arc(cx + 4, 15 + bob, 2, 0, Math.PI * 2); x.fill();
    x.globalAlpha = 1; x.shadowBlur = 0;

    // Nose hole
    x.fillStyle = '#2a1a1a';
    x.beginPath(); x.moveTo(cx, 19 + bob); x.lineTo(cx - 2, 21.5 + bob); x.lineTo(cx + 2, 21.5 + bob); x.fill();

    // Teeth
    x.fillStyle = bonL;
    for (let i = -3; i <= 3; i++) {
      x.fillRect(cx + i * 1.5 - 0.5, 24 + bob, 1.2, 2.5);
    }

    frames.push(c);
  }
  SpriteCache[key] = frames;
}

// ============================================================
//  GOLEM SPRITE (3D crystal/stone with rune glow)
// ============================================================
function genGolem(key, mainC, lightC, darkC, glowC) {
  const frames = [];
  for (let f = 0; f < 4; f++) {
    const c = makeCanvas(64, 72);
    const x = c.getContext('2d');
    const cx = 32, bob = Math.sin(f * Math.PI / 2) * 1.2;

    draw3DShadow(x, cx, 66, 18, 5);

    // Legs (thick stone pillars)
    drawCylinder(x, cx - 14, 48 + bob, 10, 16, mainC, lightC, darkC);
    drawCylinder(x, cx + 4, 48 + bob, 10, 16, mainC, lightC, darkC);
    // AO at leg-body junction
    addAO(x, cx - 9, 48 + bob, 6, 2);
    addAO(x, cx + 9, 48 + bob, 6, 2);

    // Body - massive stone torso
    const bg = x.createLinearGradient(cx - 18, 22, cx + 18, 52);
    bg.addColorStop(0, lightC); bg.addColorStop(0.3, mainC); bg.addColorStop(0.7, mainC); bg.addColorStop(1, darkC);
    x.fillStyle = bg;
    x.beginPath();
    x.moveTo(cx - 16, 50 + bob); x.lineTo(cx - 20, 28 + bob);
    x.lineTo(cx - 10, 20 + bob); x.lineTo(cx + 10, 20 + bob);
    x.lineTo(cx + 20, 28 + bob); x.lineTo(cx + 16, 50 + bob);
    x.fill();
    // Surface cracks
    x.strokeStyle = darkC; x.lineWidth = 0.8; x.globalAlpha = 0.4;
    x.beginPath(); x.moveTo(cx - 8, 25 + bob); x.lineTo(cx - 12, 40 + bob); x.stroke();
    x.beginPath(); x.moveTo(cx + 6, 24 + bob); x.lineTo(cx + 10, 38 + bob); x.stroke();
    x.globalAlpha = 1;

    // Crystal/rune glow
    if (glowC) {
      x.globalAlpha = 0.5 + Math.sin(f * Math.PI / 2) * 0.3;
      x.strokeStyle = glowC; x.lineWidth = 2;
      x.shadowColor = glowC; x.shadowBlur = 8;
      x.beginPath(); x.moveTo(cx - 6, 28 + bob); x.lineTo(cx, 38 + bob); x.lineTo(cx + 6, 28 + bob); x.stroke();
      x.beginPath(); x.moveTo(cx - 10, 40 + bob); x.lineTo(cx + 10, 40 + bob); x.stroke();
      x.shadowBlur = 0; x.globalAlpha = 1;
    }

    // Arms (massive stone)
    const as = Math.sin(f * Math.PI / 2) * 2.5;
    drawCylinder(x, cx - 28, 26 + bob + as, 10, 20, mainC, lightC, darkC);
    drawCylinder(x, cx + 18, 26 + bob - as, 10, 20, mainC, lightC, darkC);
    // Fists - 3D spheres
    drawSphere(x, cx - 23, 48 + bob + as, 7, mainC, lightC, darkC);
    drawSphere(x, cx + 23, 48 + bob - as, 7, mainC, lightC, darkC);

    // Head - angular stone block
    const hg = x.createRadialGradient(cx - 2, 14 + bob, 1, cx, 16 + bob, 10);
    hg.addColorStop(0, lightC); hg.addColorStop(1, mainC);
    x.fillStyle = hg;
    x.beginPath();
    x.moveTo(cx - 9, 10 + bob); x.lineTo(cx + 9, 10 + bob);
    x.lineTo(cx + 8, 24 + bob); x.lineTo(cx - 8, 24 + bob);
    x.fill();

    // Eyes
    x.fillStyle = glowC || '#ff4400';
    x.shadowColor = glowC || '#ff4400'; x.shadowBlur = 6;
    x.globalAlpha = 0.9;
    x.fillRect(cx - 6, 14 + bob, 4, 4);
    x.fillRect(cx + 2, 14 + bob, 4, 4);
    x.globalAlpha = 1; x.shadowBlur = 0;

    // Highlight
    x.fillStyle = 'rgba(255,255,255,0.12)';
    x.fillRect(cx - 16, 24 + bob, 8, 14);

    frames.push(c);
  }
  SpriteCache[key] = frames;
}

// ============================================================
//  DRAGON SPRITE (3D winged boss with scales and fire)
// ============================================================
function genDragon(key, mainC, lightC, darkC, wingC) {
  const frames = [];
  for (let f = 0; f < 4; f++) {
    const c = makeCanvas(110, 96);
    const x = c.getContext('2d');
    const cx = 55, cy = 52, bob = Math.sin(f * Math.PI / 2) * 2.5;
    const wingFlap = Math.sin(f * Math.PI / 2) * 15;

    draw3DShadow(x, cx, 88, 32, 7);

    // Wings (behind body) with membrane detail
    x.fillStyle = wingC || darkC;
    // Left wing
    x.beginPath();
    x.moveTo(cx - 12, cy - 14 + bob);
    x.quadraticCurveTo(cx - 45, cy - 38 + wingFlap, cx - 48, cy - 18 + wingFlap);
    x.quadraticCurveTo(cx - 38, cy - 5, cx - 12, cy + bob);
    x.fill();
    // Right wing
    x.beginPath();
    x.moveTo(cx + 12, cy - 14 + bob);
    x.quadraticCurveTo(cx + 45, cy - 38 + wingFlap, cx + 48, cy - 18 + wingFlap);
    x.quadraticCurveTo(cx + 38, cy - 5, cx + 12, cy + bob);
    x.fill();
    // Wing membrane veins
    x.strokeStyle = darkC; x.lineWidth = 1.2;
    for (let i = 0; i < 4; i++) {
      const t = (i + 1) / 5;
      x.beginPath(); x.moveTo(cx - 12, cy - 10 + bob);
      x.lineTo(cx - 18 - i * 9, cy - 28 + wingFlap * t); x.stroke();
      x.beginPath(); x.moveTo(cx + 12, cy - 10 + bob);
      x.lineTo(cx + 18 + i * 9, cy - 28 + wingFlap * t); x.stroke();
    }
    // Wing highlight
    x.fillStyle = 'rgba(255,255,255,0.06)';
    x.beginPath();
    x.moveTo(cx - 12, cy - 14 + bob);
    x.quadraticCurveTo(cx - 30, cy - 30 + wingFlap, cx - 35, cy - 15 + wingFlap);
    x.quadraticCurveTo(cx - 25, cy - 8, cx - 12, cy + bob);
    x.fill();

    // Tail
    x.strokeStyle = mainC; x.lineWidth = 7; x.lineCap = 'round';
    x.beginPath();
    x.moveTo(cx - 10, cy + 14 + bob);
    x.quadraticCurveTo(cx - 32, cy + 20 + bob, cx - 40, cy + 8 + Math.sin(f * Math.PI / 2) * 4);
    x.stroke();
    // Tail spikes
    x.fillStyle = darkC;
    x.beginPath(); x.moveTo(cx - 38, cy + 7 + bob);
    x.lineTo(cx - 45, cy + 3 + bob); x.lineTo(cx - 36, cy + 10 + bob); x.fill();

    // Legs with claws
    drawCylinder(x, cx - 12, cy + 12 + bob, 8, 20, mainC, lightC, darkC);
    drawCylinder(x, cx + 4, cy + 12 + bob, 8, 20, mainC, lightC, darkC);
    // Claws
    x.fillStyle = '#333';
    [-8, 0, 8].forEach(ox => {
      x.beginPath(); x.moveTo(cx - 8 + ox * 0.3, cy + 32 + bob);
      x.lineTo(cx - 9 + ox * 0.3, cy + 36 + bob); x.lineTo(cx - 7 + ox * 0.3, cy + 36 + bob); x.fill();
      x.beginPath(); x.moveTo(cx + 8 + ox * 0.3, cy + 32 + bob);
      x.lineTo(cx + 7 + ox * 0.3, cy + 36 + bob); x.lineTo(cx + 9 + ox * 0.3, cy + 36 + bob); x.fill();
    });

    // Body - 3D ellipsoid with scale texture
    const bg = x.createRadialGradient(cx - 5, cy - 5 + bob, 4, cx, cy + bob, 22);
    bg.addColorStop(0, lightC); bg.addColorStop(0.5, mainC); bg.addColorStop(1, darkC);
    x.fillStyle = bg;
    x.beginPath(); x.ellipse(cx, cy + bob, 20, 17, 0, 0, Math.PI * 2); x.fill();

    // Belly (lighter)
    x.fillStyle = lightC; x.globalAlpha = 0.25;
    x.beginPath(); x.ellipse(cx + 2, cy + 4 + bob, 10, 10, 0, 0, Math.PI * 2); x.fill();
    x.globalAlpha = 1;

    // Scale pattern
    x.strokeStyle = darkC; x.lineWidth = 0.6; x.globalAlpha = 0.35;
    for (let sy = -10; sy < 12; sy += 4) {
      for (let sx = -14; sx < 14; sx += 5) {
        x.beginPath(); x.arc(cx + sx, cy + sy + bob, 2.5, 0, Math.PI); x.stroke();
      }
    }
    x.globalAlpha = 1;

    // Body rim light
    addRimLight(x, cx, cy + bob, 19, lightC, 0.25);

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

    // Head - 3D
    drawSphere(x, cx + 20, cy - 34 + bob, 12, mainC, lightC, darkC);

    // Horns
    x.fillStyle = '#444';
    x.beginPath(); x.moveTo(cx + 13, cy - 42 + bob); x.lineTo(cx + 8, cy - 52 + bob);
    x.lineTo(cx + 15, cy - 40 + bob); x.fill();
    x.beginPath(); x.moveTo(cx + 24, cy - 42 + bob); x.lineTo(cx + 30, cy - 52 + bob);
    x.lineTo(cx + 22, cy - 40 + bob); x.fill();
    // Horn highlights
    x.fillStyle = 'rgba(255,255,255,0.15)';
    x.beginPath(); x.moveTo(cx + 13, cy - 42 + bob); x.lineTo(cx + 9, cy - 50 + bob);
    x.lineTo(cx + 14, cy - 41 + bob); x.fill();

    // Snout
    x.fillStyle = darkC;
    x.beginPath(); x.ellipse(cx + 29, cy - 32 + bob, 7, 5, 0.3, 0, Math.PI * 2); x.fill();
    // Nostril fire
    x.fillStyle = '#ff4400'; x.shadowColor = '#ff4400'; x.shadowBlur = 6;
    x.globalAlpha = 0.5 + Math.sin(f * Math.PI) * 0.3;
    x.beginPath(); x.arc(cx + 34, cy - 32 + bob, 3, 0, Math.PI * 2); x.fill();
    x.globalAlpha = 1; x.shadowBlur = 0;

    // Eye
    x.fillStyle = '#ff8800'; x.shadowColor = '#ff8800'; x.shadowBlur = 5;
    x.beginPath(); x.ellipse(cx + 18, cy - 36 + bob, 4, 3, 0, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#111'; x.shadowBlur = 0;
    x.beginPath(); x.ellipse(cx + 19, cy - 36 + bob, 2, 2.5, 0, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#ff4400'; x.globalAlpha = 0.5;
    x.beginPath(); x.arc(cx + 17, cy - 37 + bob, 1.5, 0, Math.PI * 2); x.fill();
    x.globalAlpha = 1;

    frames.push(c);
  }
  SpriteCache[key] = frames;
}

// ============================================================
//  DEMON SPRITE (3D boss demon with dark aura)
// ============================================================
function genDemon(key) {
  const frames = [];
  for (let f = 0; f < 4; f++) {
    const c = makeCanvas(88, 92);
    const x = c.getContext('2d');
    const cx = 44, cy = 50, bob = Math.sin(f * Math.PI / 2) * 1.8;

    draw3DShadow(x, cx, 84, 24, 6);

    // Dark aura
    const ag = x.createRadialGradient(cx, cy, 10, cx, cy, 38);
    ag.addColorStop(0, 'rgba(136,0,0,0.15)'); ag.addColorStop(1, 'rgba(136,0,0,0)');
    x.fillStyle = ag;
    x.beginPath(); x.arc(cx, cy, 38, 0, Math.PI * 2); x.fill();

    // Wings
    const wf = Math.sin(f * Math.PI / 2) * 10;
    x.fillStyle = '#440000';
    x.beginPath(); x.moveTo(cx - 10, cy - 16 + bob);
    x.quadraticCurveTo(cx - 35, cy - 32 + wf, cx - 38, cy - 8 + wf);
    x.quadraticCurveTo(cx - 25, cy + 8, cx - 10, cy + bob); x.fill();
    x.beginPath(); x.moveTo(cx + 10, cy - 16 + bob);
    x.quadraticCurveTo(cx + 35, cy - 32 + wf, cx + 38, cy - 8 + wf);
    x.quadraticCurveTo(cx + 25, cy + 8, cx + 10, cy + bob); x.fill();

    // Legs
    drawCylinder(x, cx - 12, cy + 14 + bob, 9, 20, '#771111', '#993333', '#440000');
    drawCylinder(x, cx + 3, cy + 14 + bob, 9, 20, '#771111', '#993333', '#440000');
    // Hooves
    x.fillStyle = '#222';
    x.beginPath(); x.roundRect(cx - 13, cy + 33 + bob, 11, 5, 2); x.fill();
    x.beginPath(); x.roundRect(cx + 2, cy + 33 + bob, 11, 5, 2); x.fill();

    // Body - 3D muscular
    const bg = x.createRadialGradient(cx - 3, cy - 8 + bob, 4, cx, cy + bob, 20);
    bg.addColorStop(0, '#cc2222'); bg.addColorStop(0.5, '#881111'); bg.addColorStop(1, '#440000');
    x.fillStyle = bg;
    x.beginPath(); x.ellipse(cx, cy + bob, 18, 20, 0, 0, Math.PI * 2); x.fill();

    // Rune markings (glowing)
    x.strokeStyle = '#ff4400'; x.lineWidth = 1.5;
    x.shadowColor = '#ff4400'; x.shadowBlur = 6;
    x.globalAlpha = 0.5 + Math.sin(f * Math.PI / 2) * 0.3;
    x.beginPath();
    x.moveTo(cx - 8, cy - 8 + bob); x.lineTo(cx, cy + 6 + bob); x.lineTo(cx + 8, cy - 8 + bob);
    x.moveTo(cx - 10, cy + bob); x.lineTo(cx + 10, cy + bob);
    x.stroke();
    x.globalAlpha = 1; x.shadowBlur = 0;

    // Rim light
    addRimLight(x, cx, cy + bob, 18, '#ff4400', 0.2);

    // Arms
    drawCylinder(x, cx - 26, cy - 10 + bob, 9, 22, '#881111', '#aa3333', '#550000');
    drawCylinder(x, cx + 17, cy - 10 + bob, 9, 22, '#881111', '#aa3333', '#550000');
    // Claws
    x.fillStyle = '#222';
    for (let i = -1; i <= 1; i++) {
      x.beginPath(); x.moveTo(cx - 22 + i * 3, cy + 12 + bob);
      x.lineTo(cx - 23 + i * 3, cy + 18 + bob); x.lineTo(cx - 21 + i * 3, cy + 18 + bob); x.fill();
    }

    // Head - 3D
    drawSphere(x, cx, cy - 24 + bob, 13, '#991111', '#bb3333', '#550000');

    // Horns - curved
    x.fillStyle = '#333';
    x.beginPath(); x.moveTo(cx - 10, cy - 32 + bob);
    x.quadraticCurveTo(cx - 18, cy - 48 + bob, cx - 14, cy - 50 + bob);
    x.lineTo(cx - 7, cy - 30 + bob); x.fill();
    x.beginPath(); x.moveTo(cx + 10, cy - 32 + bob);
    x.quadraticCurveTo(cx + 18, cy - 48 + bob, cx + 14, cy - 50 + bob);
    x.lineTo(cx + 7, cy - 30 + bob); x.fill();
    // Horn highlights
    x.fillStyle = 'rgba(255,255,255,0.1)';
    x.beginPath(); x.moveTo(cx - 10, cy - 32 + bob);
    x.quadraticCurveTo(cx - 16, cy - 46 + bob, cx - 13, cy - 48 + bob);
    x.lineTo(cx - 8, cy - 31 + bob); x.fill();

    // Eyes - glowing
    x.fillStyle = '#ff0'; x.shadowColor = '#ff0'; x.shadowBlur = 8;
    x.globalAlpha = 0.9;
    x.beginPath(); x.ellipse(cx - 5, cy - 25 + bob, 4, 2.5, 0, 0, Math.PI * 2); x.fill();
    x.beginPath(); x.ellipse(cx + 5, cy - 25 + bob, 4, 2.5, 0, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#f00';
    x.beginPath(); x.ellipse(cx - 5, cy - 25 + bob, 2, 2, 0, 0, Math.PI * 2); x.fill();
    x.beginPath(); x.ellipse(cx + 5, cy - 25 + bob, 2, 2, 0, 0, Math.PI * 2); x.fill();
    x.globalAlpha = 1; x.shadowBlur = 0;

    frames.push(c);
  }
  SpriteCache[key] = frames;
}

// ============================================================
//  PLAYER WARRIOR (Full plate knight with sword & shield)
// ============================================================
function genPlayerWarrior() {
  const frames = [];
  for (let f = 0; f < 4; f++) {
    const c = makeCanvas(52, 68);
    const x = c.getContext('2d');
    const cx = 26, bob = Math.sin(f * Math.PI / 2) * 1.5;
    const lp = Math.sin(f * Math.PI / 2) * 2.5, as = Math.sin(f * Math.PI / 2) * 3;

    draw3DShadow(x, cx, 63, 14, 4);

    // Cape
    const cg = x.createLinearGradient(cx - 10, 22, cx + 10, 50);
    cg.addColorStop(0, '#8b2020'); cg.addColorStop(1, '#4a1010');
    x.fillStyle = cg;
    x.beginPath();
    x.moveTo(cx - 9, 22 + bob); x.quadraticCurveTo(cx - 12, 38, cx - 10 + Math.sin(f) * 2, 50);
    x.lineTo(cx + 10 - Math.sin(f) * 2, 50); x.quadraticCurveTo(cx + 12, 38, cx + 9, 22 + bob);
    x.fill();

    // Legs (plate)
    drawMetalPlate(x, cx - 7, 40 + bob, 6, 14 + lp * 0.4, '#778899', '#99aabb', '#556677');
    drawMetalPlate(x, cx + 1, 40 + bob, 6, 14 - lp * 0.4, '#778899', '#99aabb', '#556677');
    // Boots
    drawMetalPlate(x, cx - 8, 52 + bob + lp * 0.3, 8, 6, '#5a6a7a', '#7a8a9a', '#3a4a5a');
    drawMetalPlate(x, cx, 52 + bob - lp * 0.3, 8, 6, '#5a6a7a', '#7a8a9a', '#3a4a5a');

    // Body - plate armor
    drawMetalPlate(x, cx - 11, 21 + bob, 22, 20, '#8899aa', '#aabbcc', '#556677');
    // Chest cross emblem
    x.fillStyle = '#ffd700';
    x.fillRect(cx - 1.5, 26 + bob, 3, 8); x.fillRect(cx - 4, 28 + bob, 8, 3);
    // Belt
    x.fillStyle = '#6a5030'; x.fillRect(cx - 11, 38 + bob, 22, 3);
    x.fillStyle = '#ffd700'; x.fillRect(cx - 2.5, 38 + bob, 5, 3);

    // Shoulder pads - 3D spheres
    drawSphere(x, cx - 13, 23 + bob, 5.5, '#8899aa', '#bbccdd', '#556677');
    drawSphere(x, cx + 13, 23 + bob, 5.5, '#8899aa', '#bbccdd', '#556677');
    // Spikes
    x.fillStyle = '#ccddee';
    x.beginPath(); x.moveTo(cx - 16, 22 + bob); x.lineTo(cx - 19, 17 + bob); x.lineTo(cx - 14, 21 + bob); x.fill();
    x.beginPath(); x.moveTo(cx + 16, 22 + bob); x.lineTo(cx + 19, 17 + bob); x.lineTo(cx + 14, 21 + bob); x.fill();

    // Arms
    drawCylinder(x, cx - 17, 24 + bob + as, 5, 16, '#778899', '#99aabb', '#556677');
    drawCylinder(x, cx + 12, 24 + bob - as, 5, 16, '#778899', '#99aabb', '#556677');
    // Gauntlets
    drawSphere(x, cx - 14.5, 41 + bob + as, 3.5, '#8899aa', '#bbccdd', '#556677');
    drawSphere(x, cx + 14.5, 41 + bob - as, 3.5, '#8899aa', '#bbccdd', '#556677');

    // Sword
    x.fillStyle = '#ddd'; x.fillRect(cx + 15.5, 16 + bob - as, 2.5, 26);
    x.fillStyle = 'rgba(255,255,255,0.35)'; x.fillRect(cx + 15.5, 16 + bob - as, 1, 26);
    x.fillStyle = '#ffd700'; x.fillRect(cx + 12.5, 40 + bob - as, 8.5, 3);
    x.fillStyle = '#6a4a2a'; x.fillRect(cx + 15.5, 43 + bob - as, 2.5, 4);

    // Shield
    x.fillStyle = '#667788';
    x.beginPath();
    x.moveTo(cx - 20, 26 + bob + as); x.lineTo(cx - 12, 24 + bob + as);
    x.lineTo(cx - 12, 38 + bob + as); x.lineTo(cx - 16, 42 + bob + as);
    x.lineTo(cx - 20, 38 + bob + as); x.fill();
    x.fillStyle = 'rgba(255,255,255,0.12)';
    x.beginPath();
    x.moveTo(cx - 20, 26 + bob + as); x.lineTo(cx - 16, 25 + bob + as);
    x.lineTo(cx - 16, 36 + bob + as); x.lineTo(cx - 20, 35 + bob + as); x.fill();
    x.fillStyle = '#ffd700';
    x.beginPath(); x.arc(cx - 16, 32 + bob + as, 3, 0, Math.PI * 2); x.fill();

    // Head
    drawSphere(x, cx, 15 + bob, 8.5, '#e8c8a0', '#f5ddc0', '#c0a080');

    // Helmet
    drawMetalPlate(x, cx - 9.5, 6 + bob, 19, 12, '#8899aa', '#bbccdd', '#556677');
    // Crest
    x.fillStyle = '#bb3333'; x.fillRect(cx - 1.5, 2 + bob, 3, 7);
    // Visor slit
    x.fillStyle = '#333'; x.fillRect(cx - 5.5, 14 + bob, 11, 2.5);
    // Eyes through visor
    x.fillStyle = '#4488ff'; x.shadowColor = '#4488ff'; x.shadowBlur = 3;
    x.fillRect(cx - 4, 14.3 + bob, 2.5, 1.8); x.fillRect(cx + 1.5, 14.3 + bob, 2.5, 1.8);
    x.shadowBlur = 0;

    frames.push(c);
  }
  SpriteCache['player_WARRIOR'] = frames;
}

// ============================================================
//  PLAYER MAGE (Arcane wizard with glowing staff)
// ============================================================
function genPlayerMage() {
  const frames = [];
  for (let f = 0; f < 4; f++) {
    const c = makeCanvas(52, 68);
    const x = c.getContext('2d');
    const cx = 26, bob = Math.sin(f * Math.PI / 2) * 1.5;
    const as = Math.sin(f * Math.PI / 2) * 3;

    draw3DShadow(x, cx, 63, 14, 4);

    // Magic aura
    x.fillStyle = `rgba(80,120,255,${0.04 + Math.sin(f * Math.PI / 2) * 0.02})`;
    x.beginPath(); x.ellipse(cx, 36, 22, 28, 0, 0, Math.PI * 2); x.fill();

    // Robe (flowing)
    const rg = x.createLinearGradient(cx - 14, 22, cx + 14, 58);
    rg.addColorStop(0, '#2a4ab0'); rg.addColorStop(0.5, '#1a3388'); rg.addColorStop(1, '#0f2060');
    x.fillStyle = rg;
    x.beginPath();
    x.moveTo(cx - 12, 22 + bob); x.lineTo(cx - 15, 56);
    x.lineTo(cx + 15, 56); x.lineTo(cx + 12, 22 + bob);
    x.fill();
    // Robe fold
    x.fillStyle = 'rgba(0,0,0,0.15)';
    x.beginPath(); x.moveTo(cx + 1, 30 + bob);
    x.lineTo(cx - 3, 56); x.lineTo(cx + 5, 56); x.fill();
    // Star pattern
    x.fillStyle = 'rgba(200,220,255,0.12)';
    [{sx: cx - 7, sy: 34}, {sx: cx + 6, sy: 40}, {sx: cx - 3, sy: 48}, {sx: cx + 8, sy: 32}].forEach(sp => {
      x.beginPath(); x.arc(sp.sx, sp.sy + bob, 1.5, 0, Math.PI * 2); x.fill();
    });
    // Gold trim
    x.strokeStyle = '#ccaa44'; x.lineWidth = 1.5;
    x.beginPath(); x.moveTo(cx - 15, 56); x.lineTo(cx + 15, 56); x.stroke();
    x.lineWidth = 1;
    x.beginPath(); x.moveTo(cx, 22 + bob); x.lineTo(cx, 56); x.stroke();
    // Sash
    x.fillStyle = '#ccaa44'; x.fillRect(cx - 12, 38 + bob, 24, 3);
    x.fillStyle = '#44aaff';
    x.beginPath(); x.arc(cx, 39.5 + bob, 2.5, 0, Math.PI * 2); x.fill();
    addSpecular(x, cx - 0.5, 39 + bob, 1, 0.8, 0.5);

    // Sleeves
    x.fillStyle = '#1a3388';
    x.fillRect(cx - 17, 24 + bob + as, 6, 15);
    x.fillRect(cx + 11, 24 + bob - as, 6, 15);
    x.fillStyle = '#ccaa44';
    x.fillRect(cx - 17, 38 + bob + as, 6, 2);
    x.fillRect(cx + 11, 38 + bob - as, 6, 2);
    // Hands
    drawSphere(x, cx - 14, 41 + bob + as, 3, '#e8c8a0', '#f5ddc0', '#c0a080');
    drawSphere(x, cx + 14, 41 + bob - as, 3, '#e8c8a0', '#f5ddc0', '#c0a080');

    // Staff
    x.fillStyle = '#5a3a18'; x.fillRect(cx + 15, 6 + bob, 3, 42);
    // Staff orb
    drawSphere(x, cx + 16.5, 5 + bob, 6.5, '#4488ff', '#aaccff', '#1144aa');
    // Orb glow
    x.fillStyle = `rgba(100,150,255,${0.15 + Math.sin(f * Math.PI / 2) * 0.1})`;
    x.beginPath(); x.arc(cx + 16.5, 5 + bob, 10, 0, Math.PI * 2); x.fill();

    // Head
    drawSphere(x, cx, 15 + bob, 8.5, '#e8c8a0', '#f5ddc0', '#c0a080');

    // Wizard hat
    const hg = x.createLinearGradient(cx, -1 + bob, cx, 12 + bob);
    hg.addColorStop(0, '#2a4ab0'); hg.addColorStop(1, '#112266');
    x.fillStyle = hg;
    x.beginPath(); x.moveTo(cx + 2, -2 + bob);
    x.lineTo(cx - 14, 11 + bob); x.lineTo(cx + 14, 11 + bob); x.fill();
    x.fillStyle = '#0f2060'; x.fillRect(cx - 15, 10 + bob, 30, 5);
    x.fillStyle = '#ccaa44'; x.fillRect(cx - 14, 10 + bob, 28, 3);
    x.fillStyle = '#ffd700';
    x.beginPath(); x.arc(cx + 1, 3 + bob, 2, 0, Math.PI * 2); x.fill();

    // Beard
    x.fillStyle = '#ddd';
    x.beginPath();
    x.moveTo(cx - 4, 20 + bob);
    x.quadraticCurveTo(cx - 6, 30 + bob, cx - 3, 33 + bob);
    x.lineTo(cx + 3, 33 + bob);
    x.quadraticCurveTo(cx + 6, 30 + bob, cx + 4, 20 + bob);
    x.fill();

    // Eyes (glowing)
    x.fillStyle = '#4488ff'; x.shadowColor = '#4488ff'; x.shadowBlur = 4;
    x.fillRect(cx - 5, 13.5 + bob, 3, 2.5);
    x.fillRect(cx + 2, 13.5 + bob, 3, 2.5);
    x.shadowBlur = 0;

    // Magic particles
    x.fillStyle = `rgba(100,180,255,${0.4 + Math.sin(f * Math.PI / 2) * 0.2})`;
    for (let i = 0; i < 3; i++) {
      const pa = f * Math.PI / 2 + i * Math.PI * 2 / 3;
      x.beginPath(); x.arc(cx - 14 + Math.cos(pa) * 4, 40 + bob + as + Math.sin(pa) * 3, 1.5, 0, Math.PI * 2); x.fill();
    }

    frames.push(c);
  }
  SpriteCache['player_MAGE'] = frames;
}

// ============================================================
//  PLAYER ROGUE (Shadow assassin with dual daggers)
// ============================================================
function genPlayerRogue() {
  const frames = [];
  for (let f = 0; f < 4; f++) {
    const c = makeCanvas(50, 66);
    const x = c.getContext('2d');
    const cx = 25, bob = Math.sin(f * Math.PI / 2) * 1.5;
    const lp = Math.sin(f * Math.PI / 2) * 3, as = Math.sin(f * Math.PI / 2) * 3.5;

    draw3DShadow(x, cx, 61, 13, 4);

    // Short cloak
    x.fillStyle = '#2a2a35';
    x.beginPath();
    x.moveTo(cx - 8, 20 + bob);
    x.quadraticCurveTo(cx - 12, 34, cx - 9 + Math.sin(f) * 2, 44);
    x.lineTo(cx + 9 - Math.sin(f) * 2, 44);
    x.quadraticCurveTo(cx + 12, 34, cx + 8, 20 + bob);
    x.fill();

    // Legs (leather)
    drawCylinder(x, cx - 6, 38 + bob, 5, 14 + lp * 0.4, '#4a3a2a', '#5a4a3a', '#3a2a1a');
    drawCylinder(x, cx + 1, 38 + bob, 5, 14 - lp * 0.4, '#4a3a2a', '#5a4a3a', '#3a2a1a');
    // Boots
    x.fillStyle = '#2a1a10';
    x.beginPath(); x.roundRect(cx - 7, 50 + bob + lp * 0.3, 7, 5, 2); x.fill();
    x.beginPath(); x.roundRect(cx, 50 + bob - lp * 0.3, 7, 5, 2); x.fill();

    // Body - leather armor
    drawMetalPlate(x, cx - 10, 20 + bob, 20, 19, '#4a3a2a', '#5a4a3a', '#3a2a1a');
    // Buckles
    x.fillStyle = '#aaa';
    x.fillRect(cx - 2, 22 + bob, 4, 1.5);
    x.fillRect(cx - 2, 26 + bob, 4, 1.5);
    x.fillRect(cx - 2, 30 + bob, 4, 1.5);
    // Belt with pouches
    x.fillStyle = '#3a2a1a'; x.fillRect(cx - 10, 36 + bob, 20, 3);
    x.fillStyle = '#ffd700'; x.fillRect(cx - 1.5, 36 + bob, 3, 3);
    x.fillStyle = '#4a3a28';
    x.fillRect(cx - 10, 33 + bob, 5, 5);
    x.fillRect(cx + 5, 33 + bob, 5, 5);

    // Arms
    drawCylinder(x, cx - 14, 22 + bob + as, 5, 15, '#4a3a2a', '#5a4a3a', '#3a2a1a');
    drawCylinder(x, cx + 9, 22 + bob - as, 5, 15, '#4a3a2a', '#5a4a3a', '#3a2a1a');
    // Hands
    drawSphere(x, cx - 11.5, 38 + bob + as, 3, '#d4a07a', '#e8c8a0', '#b08050');
    drawSphere(x, cx + 11.5, 38 + bob - as, 3, '#d4a07a', '#e8c8a0', '#b08050');

    // Daggers
    x.save();
    x.translate(cx - 14, 33 + bob + as); x.rotate(-0.3);
    x.fillStyle = '#ccc'; x.fillRect(-1, -10, 2.5, 12);
    x.fillStyle = 'rgba(255,255,255,0.3)'; x.fillRect(-1, -10, 1, 12);
    x.fillStyle = '#8a6a3a'; x.fillRect(-2, 2, 5, 3);
    x.restore();
    x.save();
    x.translate(cx + 14, 33 + bob - as); x.rotate(0.3);
    x.fillStyle = '#ccc'; x.fillRect(-1, -10, 2.5, 12);
    x.fillStyle = 'rgba(255,255,255,0.3)'; x.fillRect(-1, -10, 1, 12);
    x.fillStyle = '#8a6a3a'; x.fillRect(-2, 2, 5, 3);
    x.restore();

    // Head
    drawSphere(x, cx, 14 + bob, 8, '#e0c098', '#f0d8b8', '#b89070');

    // Hood
    x.fillStyle = '#2a2a35';
    x.beginPath(); x.arc(cx, 12.5 + bob, 9.5, Math.PI + 0.3, -0.3); x.fill();
    // Mask
    x.fillStyle = '#1a1a25';
    x.beginPath();
    x.moveTo(cx - 6.5, 16 + bob); x.lineTo(cx + 6.5, 16 + bob);
    x.lineTo(cx + 5.5, 21 + bob); x.lineTo(cx - 5.5, 21 + bob); x.fill();

    // Eyes (green glow)
    x.fillStyle = '#33cc33'; x.shadowColor = '#33cc33'; x.shadowBlur = 4;
    x.beginPath(); x.ellipse(cx - 3.5, 14 + bob, 2.5, 2, 0, 0, Math.PI * 2); x.fill();
    x.beginPath(); x.ellipse(cx + 3.5, 14 + bob, 2.5, 2, 0, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#111'; x.shadowBlur = 0;
    x.beginPath(); x.arc(cx - 3.5, 14.2 + bob, 1, 0, Math.PI * 2); x.fill();
    x.beginPath(); x.arc(cx + 3.5, 14.2 + bob, 1, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#fff';
    x.beginPath(); x.arc(cx - 4, 13.5 + bob, 0.6, 0, Math.PI * 2); x.fill();
    x.beginPath(); x.arc(cx + 3, 13.5 + bob, 0.6, 0, Math.PI * 2); x.fill();

    frames.push(c);
  }
  SpriteCache['player_ROGUE'] = frames;
}

// ============================================================
//  PLAYER HEALER (Holy priest with heal effects)
// ============================================================
function genPlayerHealer() {
  const frames = [];
  for (let f = 0; f < 4; f++) {
    const c = makeCanvas(52, 68);
    const x = c.getContext('2d');
    const cx = 26, bob = Math.sin(f * Math.PI / 2) * 1.5;
    const as = Math.sin(f * Math.PI / 2) * 2.5;

    draw3DShadow(x, cx, 63, 14, 4);

    // Healing aura
    x.fillStyle = `rgba(255,220,100,${0.04 + Math.sin(f * Math.PI / 2) * 0.02})`;
    x.beginPath(); x.ellipse(cx, 36, 22, 28, 0, 0, Math.PI * 2); x.fill();

    // Robe (white/gold)
    const rg = x.createLinearGradient(cx - 14, 20, cx + 14, 56);
    rg.addColorStop(0, '#f5f5fa'); rg.addColorStop(0.5, '#e0e0e8'); rg.addColorStop(1, '#c8c8d0');
    x.fillStyle = rg;
    x.beginPath();
    x.moveTo(cx - 12, 20 + bob); x.lineTo(cx - 15, 56);
    x.lineTo(cx + 15, 56); x.lineTo(cx + 12, 20 + bob);
    x.fill();
    // Fold shadow
    x.fillStyle = 'rgba(0,0,0,0.08)';
    x.beginPath(); x.moveTo(cx + 2, 28 + bob);
    x.lineTo(cx - 2, 56); x.lineTo(cx + 6, 56); x.fill();
    // Gold trim
    x.strokeStyle = '#ccaa44'; x.lineWidth = 1.8;
    x.beginPath(); x.moveTo(cx - 15, 56); x.lineTo(cx + 15, 56); x.stroke();
    x.lineWidth = 1.2;
    x.beginPath(); x.moveTo(cx, 20 + bob); x.lineTo(cx, 56); x.stroke();
    // Cross emblem
    x.fillStyle = '#dd3333';
    x.fillRect(cx - 2, 24 + bob, 4, 12);
    x.fillRect(cx - 5, 28 + bob, 10, 4);
    // Belt
    x.fillStyle = '#ccaa44'; x.fillRect(cx - 12, 38 + bob, 24, 2.5);
    x.fillStyle = '#ffd700';
    x.beginPath(); x.arc(cx, 39.25 + bob, 2.5, 0, Math.PI * 2); x.fill();

    // Sleeves (wide priestly)
    const slG = x.createLinearGradient(cx - 18, 22, cx - 10, 40);
    slG.addColorStop(0, '#e8e8f0'); slG.addColorStop(1, '#d0d0d8');
    x.fillStyle = slG;
    x.beginPath();
    x.moveTo(cx - 12, 22 + bob + as); x.lineTo(cx - 19, 38 + bob + as);
    x.lineTo(cx - 12, 40 + bob + as); x.fill();
    x.beginPath();
    x.moveTo(cx + 12, 22 + bob - as); x.lineTo(cx + 19, 38 + bob - as);
    x.lineTo(cx + 12, 40 + bob - as); x.fill();
    // Cuffs
    x.strokeStyle = '#ccaa44'; x.lineWidth = 1.2;
    x.beginPath(); x.moveTo(cx - 19, 38 + bob + as); x.lineTo(cx - 12, 40 + bob + as); x.stroke();
    x.beginPath(); x.moveTo(cx + 19, 38 + bob - as); x.lineTo(cx + 12, 40 + bob - as); x.stroke();
    // Hands
    drawSphere(x, cx - 15.5, 39 + bob + as, 3, '#f0d8c0', '#ffeedd', '#d0b8a0');
    drawSphere(x, cx + 15.5, 39 + bob - as, 3, '#f0d8c0', '#ffeedd', '#d0b8a0');

    // Holy staff
    x.fillStyle = '#ccaa44'; x.fillRect(cx - 17, 4 + bob, 3, 38);
    // Staff cross top
    x.fillStyle = '#ffd700';
    x.fillRect(cx - 19.5, 4 + bob, 8, 2.5);
    x.fillRect(cx - 17, 1 + bob, 3, 10);
    drawSphere(x, cx - 15.5, 1 + bob, 3.5, '#ffd700', '#ffee88', '#cc8800');
    // Staff glow
    x.fillStyle = `rgba(255,220,100,${0.2 + Math.sin(f * Math.PI / 2) * 0.1})`;
    x.beginPath(); x.arc(cx - 15.5, 1 + bob, 6, 0, Math.PI * 2); x.fill();

    // Holy book
    x.fillStyle = '#8b4513'; x.fillRect(cx + 11, 34 + bob - as, 8, 9);
    x.fillStyle = '#ffd700'; x.fillRect(cx + 12, 35 + bob - as, 6, 1.5);
    x.fillStyle = '#f5f5dc'; x.fillRect(cx + 12, 37 + bob - as, 6, 5);
    x.fillStyle = '#dd3333';
    x.fillRect(cx + 14.5, 38 + bob - as, 1, 3);
    x.fillRect(cx + 13.5, 39 + bob - as, 3, 1);

    // Heal particles (+ symbols)
    x.fillStyle = `rgba(100,255,100,${0.35 + Math.sin(f * Math.PI / 2) * 0.2})`;
    for (let i = 0; i < 4; i++) {
      const pa = f * Math.PI / 2 + i * Math.PI / 2;
      const px = cx + Math.cos(pa) * 16, py = 32 + bob + Math.sin(pa) * 12;
      x.fillRect(px - 2, py - 0.5, 4, 1); x.fillRect(px - 0.5, py - 2, 1, 4);
    }

    // Head
    drawSphere(x, cx, 14.5 + bob, 8.5, '#f0d8c0', '#ffeedd', '#d0b8a0');

    // Hair (golden)
    x.fillStyle = '#ddbb66';
    x.beginPath(); x.arc(cx, 12 + bob, 9, Math.PI, 0); x.fill();
    x.fillRect(cx - 9, 12 + bob, 3.5, 12);
    x.fillRect(cx + 5.5, 12 + bob, 3.5, 12);
    x.fillStyle = 'rgba(255,230,150,0.3)';
    x.beginPath(); x.arc(cx - 2, 9 + bob, 5, Math.PI, 0); x.fill();

    // Circlet
    x.fillStyle = '#ffd700'; x.fillRect(cx - 8, 9 + bob, 16, 2.5);
    x.fillStyle = '#44ff88';
    x.beginPath(); x.arc(cx, 10.25 + bob, 2.5, 0, Math.PI * 2); x.fill();
    addSpecular(x, cx - 0.5, 9.5 + bob, 1, 0.8, 0.5);

    // Eyes
    x.fillStyle = '#fff';
    x.fillRect(cx - 5.5, 13.5 + bob, 4, 3);
    x.fillRect(cx + 1.5, 13.5 + bob, 4, 3);
    x.fillStyle = '#44aa88';
    x.fillRect(cx - 4.5, 14 + bob, 2.5, 2.5);
    x.fillRect(cx + 2.5, 14 + bob, 2.5, 2.5);

    // Smile
    x.strokeStyle = '#d0b8a0'; x.lineWidth = 0.8; x.lineCap = 'round';
    x.beginPath(); x.arc(cx, 18 + bob, 2.5, 0.2, Math.PI - 0.2); x.stroke();

    frames.push(c);
  }
  SpriteCache['player_HEALER'] = frames;
}

// ============================================================
//  PLAYER ARCHER (Elven ranger with bow & quiver)
// ============================================================
function genPlayerArcher() {
  const frames = [];
  for (let f = 0; f < 4; f++) {
    const c = makeCanvas(52, 68);
    const x = c.getContext('2d');
    const cx = 26, bob = Math.sin(f * Math.PI / 2) * 1.5;
    const as = Math.sin(f * Math.PI / 2) * 2.5;

    draw3DShadow(x, cx, 63, 14, 4);

    // Nature aura (faint green glow)
    x.fillStyle = `rgba(100,220,60,${0.03 + Math.sin(f * Math.PI / 2) * 0.015})`;
    x.beginPath(); x.ellipse(cx, 36, 20, 26, 0, 0, Math.PI * 2); x.fill();

    // Legs (leather boots)
    const lg = x.createLinearGradient(cx - 6, 48, cx + 6, 58);
    lg.addColorStop(0, '#5a4020'); lg.addColorStop(1, '#3a2810');
    x.fillStyle = lg;
    x.fillRect(cx - 7, 50 + bob, 5, 10); x.fillRect(cx + 2, 50 + bob, 5, 10);
    // Boot straps
    x.strokeStyle = '#8a6a3a'; x.lineWidth = 0.8;
    x.beginPath(); x.moveTo(cx - 7, 54 + bob); x.lineTo(cx - 2, 54 + bob); x.stroke();
    x.beginPath(); x.moveTo(cx + 2, 54 + bob); x.lineTo(cx + 7, 54 + bob); x.stroke();

    // Tunic (forest green ranger outfit)
    const tg = x.createLinearGradient(cx - 11, 22, cx + 11, 52);
    tg.addColorStop(0, '#4a8a30'); tg.addColorStop(0.4, '#3a7a22'); tg.addColorStop(1, '#2a5a18');
    x.fillStyle = tg;
    x.beginPath();
    x.moveTo(cx - 10, 22 + bob); x.lineTo(cx - 12, 50 + bob);
    x.lineTo(cx + 12, 50 + bob); x.lineTo(cx + 10, 22 + bob);
    x.fill();
    // Fold shadow
    x.fillStyle = 'rgba(0,0,0,0.1)';
    x.beginPath(); x.moveTo(cx + 1, 26 + bob);
    x.lineTo(cx - 2, 50 + bob); x.lineTo(cx + 5, 50 + bob); x.fill();

    // Belt with quiver holder
    x.fillStyle = '#6a4a2a'; x.fillRect(cx - 10, 38 + bob, 20, 3);
    x.fillStyle = '#8a6a3a';
    x.beginPath(); x.arc(cx, 39.5 + bob, 2, 0, Math.PI * 2); x.fill();

    // Quiver (on back, visible on right side)
    x.fillStyle = '#5a3a1a';
    x.save(); x.translate(cx + 12, 18 + bob); x.rotate(0.15);
    x.fillRect(-3, 0, 6, 22);
    // Arrow feathers in quiver
    x.fillStyle = '#dddddd';
    for (let i = 0; i < 3; i++) {
      x.fillRect(-2 + i * 2, -3 - i, 1.5, 4);
    }
    x.restore();

    // Cloak (short ranger cape)
    x.fillStyle = '#2a5a18'; x.globalAlpha = 0.7;
    x.beginPath();
    x.moveTo(cx - 8, 20 + bob); x.lineTo(cx - 14, 44 + bob);
    x.lineTo(cx - 6, 46 + bob); x.lineTo(cx - 6, 22 + bob);
    x.fill();
    x.globalAlpha = 1;

    // Sleeves (fitted leather)
    const slG = x.createLinearGradient(cx - 16, 22, cx - 10, 36);
    slG.addColorStop(0, '#4a8a30'); slG.addColorStop(1, '#3a6a20');
    x.fillStyle = slG;
    x.beginPath();
    x.moveTo(cx - 10, 22 + bob + as); x.lineTo(cx - 16, 34 + bob + as);
    x.lineTo(cx - 10, 36 + bob + as); x.fill();
    x.beginPath();
    x.moveTo(cx + 10, 22 + bob - as); x.lineTo(cx + 16, 34 + bob - as);
    x.lineTo(cx + 10, 36 + bob - as); x.fill();
    // Leather bracers
    x.fillStyle = '#6a4a2a';
    x.fillRect(cx - 16, 32 + bob + as, 6, 3);
    x.fillRect(cx + 10, 32 + bob - as, 6, 3);

    // Hands
    drawSphere(x, cx - 14, 35 + bob + as, 2.5, '#f0d8c0', '#ffeedd', '#d0b8a0');
    drawSphere(x, cx + 14, 35 + bob - as, 2.5, '#f0d8c0', '#ffeedd', '#d0b8a0');

    // Bow (held in left hand)
    x.strokeStyle = '#6a4020'; x.lineWidth = 2;
    x.beginPath();
    x.arc(cx - 18, 28 + bob + as, 14, -Math.PI * 0.65, Math.PI * 0.65);
    x.stroke();
    // Bowstring
    x.strokeStyle = '#ccccaa'; x.lineWidth = 0.8;
    x.beginPath();
    x.moveTo(cx - 18 + Math.cos(-Math.PI * 0.65) * 14, 28 + bob + as + Math.sin(-Math.PI * 0.65) * 14);
    x.lineTo(cx - 18 + Math.cos(Math.PI * 0.65) * 14, 28 + bob + as + Math.sin(Math.PI * 0.65) * 14);
    x.stroke();

    // Arrow (nocked on bow, draw animation)
    const drawPhase = Math.sin(f * Math.PI / 2) * 0.3;
    x.strokeStyle = '#8a7050'; x.lineWidth = 1.5;
    x.beginPath();
    x.moveTo(cx - 18, 28 + bob + as);
    x.lineTo(cx - 2 - drawPhase * 8, 28 + bob + as);
    x.stroke();
    // Arrowhead
    x.fillStyle = '#aaaacc';
    x.beginPath();
    x.moveTo(cx - 18, 28 + bob + as);
    x.lineTo(cx - 22, 26 + bob + as);
    x.lineTo(cx - 22, 30 + bob + as);
    x.fill();

    // Head
    drawSphere(x, cx, 14.5 + bob, 8, '#f0d8c0', '#ffeedd', '#d0b8a0');

    // Pointed ears (elven)
    x.fillStyle = '#f0d8c0';
    x.beginPath(); x.moveTo(cx - 8, 13 + bob); x.lineTo(cx - 14, 10 + bob); x.lineTo(cx - 8, 16 + bob); x.fill();
    x.beginPath(); x.moveTo(cx + 8, 13 + bob); x.lineTo(cx + 14, 10 + bob); x.lineTo(cx + 8, 16 + bob); x.fill();

    // Hair (green-brown, windswept)
    x.fillStyle = '#6a8a3a';
    x.beginPath(); x.arc(cx, 12 + bob, 8.5, Math.PI, 0); x.fill();
    // Windswept strands
    x.fillStyle = '#5a7a2a';
    x.beginPath(); x.moveTo(cx + 7, 10 + bob); x.lineTo(cx + 14, 8 + bob);
    x.lineTo(cx + 7, 14 + bob); x.fill();
    x.fillStyle = 'rgba(120,180,80,0.3)';
    x.beginPath(); x.arc(cx - 2, 9 + bob, 5, Math.PI, 0); x.fill();

    // Headband
    x.fillStyle = '#3a6a18'; x.fillRect(cx - 8, 10 + bob, 16, 2);
    // Feather in headband
    x.strokeStyle = '#88cc44'; x.lineWidth = 1.2;
    x.beginPath(); x.moveTo(cx + 6, 10 + bob); x.lineTo(cx + 10, 4 + bob); x.stroke();
    x.fillStyle = '#88cc44';
    x.beginPath();
    x.moveTo(cx + 10, 4 + bob); x.lineTo(cx + 8, 7 + bob);
    x.lineTo(cx + 12, 7 + bob); x.fill();

    // Eyes (sharp, green)
    x.fillStyle = '#fff';
    x.fillRect(cx - 5, 13.5 + bob, 3.5, 2.5);
    x.fillRect(cx + 1.5, 13.5 + bob, 3.5, 2.5);
    x.fillStyle = '#44aa22';
    x.fillRect(cx - 4, 14 + bob, 2, 2);
    x.fillRect(cx + 2.5, 14 + bob, 2, 2);
    // Sharp eye corners
    x.strokeStyle = '#2a5a18'; x.lineWidth = 0.6;
    x.beginPath(); x.moveTo(cx - 5.5, 14 + bob); x.lineTo(cx - 6.5, 13 + bob); x.stroke();
    x.beginPath(); x.moveTo(cx + 5.5, 14 + bob); x.lineTo(cx + 6.5, 13 + bob); x.stroke();

    // Nature particles (floating leaves)
    x.fillStyle = `rgba(100,200,60,${0.3 + Math.sin(f * Math.PI / 2) * 0.15})`;
    for (let i = 0; i < 3; i++) {
      const la = f * Math.PI / 2 + i * Math.PI * 2 / 3;
      const lx = cx + Math.cos(la) * 18, ly = 34 + bob + Math.sin(la) * 14;
      x.save(); x.translate(lx, ly); x.rotate(la);
      x.beginPath(); x.ellipse(0, 0, 2, 1, 0, 0, Math.PI * 2); x.fill();
      x.restore();
    }

    frames.push(c);
  }
  SpriteCache['player_ARCHER'] = frames;
}

// ============================================================
//  TREE SPRITES (3D with depth and shadows)
// ============================================================
function genTree(key, trunkC, leafC, leafD, leafL, h) {
  const tw = 52, th = h || 72;
  const c = makeCanvas(tw, th);
  const x = c.getContext('2d');
  const tcx = tw / 2;

  // Trunk shadow on ground
  draw3DShadow(x, tcx + 3, th - 2, 10, 4);

  // Trunk - 3D cylinder
  const tg = x.createLinearGradient(tcx - 4, 0, tcx + 4, 0);
  tg.addColorStop(0, colorShift(trunkC || '#5a3a1a', -20));
  tg.addColorStop(0.3, colorShift(trunkC || '#5a3a1a', 15));
  tg.addColorStop(0.7, trunkC || '#5a3a1a');
  tg.addColorStop(1, colorShift(trunkC || '#5a3a1a', -30));
  x.fillStyle = tg;
  x.fillRect(tcx - 4, th * 0.5, 8, th * 0.45);
  // Bark texture
  x.strokeStyle = colorShift(trunkC || '#5a3a1a', -20); x.lineWidth = 0.5; x.globalAlpha = 0.4;
  for (let i = 0; i < 4; i++) {
    const by = th * 0.52 + i * th * 0.1;
    x.beginPath(); x.moveTo(tcx - 3, by); x.lineTo(tcx + 3, by + 3); x.stroke();
  }
  x.globalAlpha = 1;

  // Leaves - layered 3D spheres
  const ly = th * 0.38;
  const layers = [
    { y: ly + 6, r: 18, c: leafD, a: 1 },
    { y: ly + 2, r: 16, c: leafC, a: 1 },
    { y: ly - 2, r: 13, c: leafL, a: 0.9 },
    { y: ly - 6, r: 10, c: leafC, a: 0.85 },
  ];
  for (const l of layers) {
    const lg = x.createRadialGradient(tcx - 3, l.y - 3, 1, tcx, l.y, l.r);
    lg.addColorStop(0, l.c); lg.addColorStop(0.7, colorShift(l.c, -15)); lg.addColorStop(1, colorShift(l.c, -30));
    x.fillStyle = lg; x.globalAlpha = l.a;
    x.beginPath(); x.arc(tcx, l.y, l.r, 0, Math.PI * 2); x.fill();
  }
  x.globalAlpha = 1;
  // Leaf highlight
  x.fillStyle = 'rgba(255,255,255,0.12)';
  x.beginPath(); x.arc(tcx - 5, ly - 8, 7, 0, Math.PI * 2); x.fill();
  // Leaf rim
  addRimLight(x, tcx, ly, 16, leafL, 0.15);

  EnvCache[key] = c;
}

// ============================================================
//  BUILDING SPRITES (3D isometric with doors and windows)
// ============================================================
function genBuilding(key, wallC, roofC, w, h, opts = {}) {
  const c = makeCanvas(w, h);
  const x = c.getContext('2d');

  // Wall with 3D gradient
  const wg = x.createLinearGradient(4, h * 0.4, w - 4, h * 0.95);
  wg.addColorStop(0, colorShift(wallC, 20)); wg.addColorStop(0.5, wallC); wg.addColorStop(1, colorShift(wallC, -30));
  x.fillStyle = wg;
  x.fillRect(4, h * 0.38, w - 8, h * 0.57);

  // Brick/stone texture
  x.strokeStyle = colorShift(wallC, -15); x.lineWidth = 0.5; x.globalAlpha = 0.3;
  for (let row = 0; row < 6; row++) {
    const by = h * 0.4 + row * h * 0.09;
    x.beginPath(); x.moveTo(4, by); x.lineTo(w - 4, by); x.stroke();
    const offset = row % 2 ? 8 : 0;
    for (let col = offset; col < w - 4; col += 16) {
      x.beginPath(); x.moveTo(col, by); x.lineTo(col, by + h * 0.09); x.stroke();
    }
  }
  x.globalAlpha = 1;

  // Wall top shadow
  x.fillStyle = 'rgba(0,0,0,0.15)';
  x.fillRect(4, h * 0.38, w - 8, 4);

  // Roof with 3D depth
  const rg = x.createLinearGradient(0, h * 0.12, w, h * 0.4);
  rg.addColorStop(0, colorShift(roofC, 25)); rg.addColorStop(0.5, roofC); rg.addColorStop(1, colorShift(roofC, -25));
  x.fillStyle = rg;
  x.beginPath();
  x.moveTo(w / 2, h * 0.1);
  x.lineTo(-4, h * 0.4);
  x.lineTo(w + 4, h * 0.4);
  x.fill();
  // Roof highlight
  x.fillStyle = 'rgba(255,255,255,0.1)';
  x.beginPath();
  x.moveTo(w / 2, h * 0.1);
  x.lineTo(-4, h * 0.4);
  x.lineTo(w / 2, h * 0.4);
  x.fill();
  // Roof tiles pattern
  x.strokeStyle = colorShift(roofC, -20); x.lineWidth = 0.5; x.globalAlpha = 0.3;
  for (let i = 1; i <= 3; i++) {
    const ry = h * 0.1 + (h * 0.3 / 4) * i;
    x.beginPath(); x.moveTo(w / 2 - i * 12, ry); x.lineTo(w / 2 + i * 12, ry); x.stroke();
  }
  x.globalAlpha = 1;

  // Door - 3D recessed
  const doorY = h * 0.65;
  x.fillStyle = '#2a1a10';
  x.fillRect(w / 2 - 7, doorY, 14, h * 0.3);
  x.fillStyle = '#3a2a18';
  x.fillRect(w / 2 - 6, doorY + 1, 12, h * 0.28);
  // Door planks
  x.strokeStyle = '#2a1a10'; x.lineWidth = 0.8;
  x.beginPath(); x.moveTo(w / 2, doorY + 1); x.lineTo(w / 2, doorY + h * 0.29); x.stroke();
  // Door handle
  x.fillStyle = '#ffd700';
  x.beginPath(); x.arc(w / 2 + 4, h * 0.8, 1.5, 0, Math.PI * 2); x.fill();

  // Windows - lit from inside
  const winGlow = x.createRadialGradient(0, 0, 0, 0, 0, 6);
  winGlow.addColorStop(0, '#ffee88'); winGlow.addColorStop(0.7, '#ccaa44'); winGlow.addColorStop(1, '#886622');

  [[w * 0.2, h * 0.5], [w * 0.68, h * 0.5]].forEach(([wx, wy]) => {
    x.save(); x.translate(wx, wy);
    x.fillStyle = winGlow;
    x.fillRect(-5, -4, 10, 10);
    // Frame
    x.strokeStyle = '#5a4030'; x.lineWidth = 1.5;
    x.strokeRect(-5, -4, 10, 10);
    // Cross bars
    x.beginPath(); x.moveTo(0, -4); x.lineTo(0, 6); x.stroke();
    x.beginPath(); x.moveTo(-5, 1); x.lineTo(5, 1); x.stroke();
    x.restore();
  });

  // Chimney (optional)
  if (opts.chimney) {
    x.fillStyle = colorShift(wallC, -10);
    x.fillRect(w * 0.65, h * 0.08, 8, h * 0.22);
    x.fillStyle = colorShift(wallC, 5);
    x.fillRect(w * 0.64, h * 0.06, 10, 4);
  }

  // Sign (for shops)
  if (opts.sign) {
    x.fillStyle = '#5a4a2a';
    x.fillRect(w / 2 - 12, h * 0.44, 24, 8);
    x.fillStyle = '#ffd700';
    x.font = 'bold 6px sans-serif'; x.textAlign = 'center';
    x.fillText(opts.sign, w / 2, h * 0.505);
    x.textAlign = 'left';
  }

  EnvCache[key] = c;
}

// ============================================================
//  TERRAIN TILES (3D depth with lighting)
// ============================================================
function genTerrainTiles() {
  const ts = 32;

  function makeTile(key, baseR, baseG, baseB, detail) {
    const tc = makeCanvas(ts, ts);
    const tx = tc.getContext('2d');

    // Base with subtle 3D gradient (light from top-left)
    const bg = tx.createLinearGradient(0, 0, ts, ts);
    bg.addColorStop(0, `rgb(${baseR + 12},${baseG + 12},${baseB + 10})`);
    bg.addColorStop(0.5, `rgb(${baseR},${baseG},${baseB})`);
    bg.addColorStop(1, `rgb(${Math.max(0, baseR - 8)},${Math.max(0, baseG - 8)},${Math.max(0, baseB - 6)})`);
    tx.fillStyle = bg;
    tx.fillRect(0, 0, ts, ts);

    // Noise detail
    for (let i = 0; i < 8; i++) {
      const px = Math.random() * ts, py = Math.random() * ts;
      const v = Math.floor(Math.random() * 20 - 10);
      tx.fillStyle = `rgb(${Math.max(0, Math.min(255, baseR + v))},${Math.max(0, Math.min(255, baseG + v))},${Math.max(0, Math.min(255, baseB + v))})`;
      tx.fillRect(px, py, 3 + Math.random() * 2, 3 + Math.random() * 2);
    }

    if (detail) detail(tx, ts);
    TileCache[key] = tc;
  }

  // Grass
  makeTile('grass', 45, 90, 30, (tx, s) => {
    tx.strokeStyle = '#3a7a28'; tx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      const bx = 3 + Math.random() * 26, by = 26 + Math.random() * 6;
      tx.beginPath(); tx.moveTo(bx, by); tx.lineTo(bx + (Math.random() - 0.5) * 5, by - 5 - Math.random() * 5); tx.stroke();
    }
    // Tiny highlight dots
    tx.fillStyle = 'rgba(255,255,255,0.08)';
    tx.fillRect(2, 2, 4, 4);
  });

  // Dark ground
  makeTile('dark', 42, 42, 40, (tx) => {
    tx.fillStyle = 'rgba(0,0,0,0.1)'; tx.fillRect(10, 10, 12, 12);
  });

  // Cave
  makeTile('cave', 26, 37, 53, (tx, s) => {
    tx.fillStyle = 'rgba(80,140,200,0.08)';
    tx.fillRect(Math.random() * 16, Math.random() * 16, 10, 10);
  });

  // Ruins
  makeTile('ruins', 58, 52, 40, (tx) => {
    tx.strokeStyle = 'rgba(80,70,50,0.2)'; tx.lineWidth = 1;
    tx.strokeRect(4, 4, 12, 12);
  });

  // Volcanic
  makeTile('volcanic', 42, 26, 18, (tx) => {
    tx.fillStyle = 'rgba(255,60,0,0.06)';
    tx.fillRect(8, 8, 16, 16);
  });

  // Shadow
  makeTile('shadow', 24, 16, 42, (tx) => {
    tx.fillStyle = 'rgba(100,60,160,0.06)';
    tx.fillRect(0, 0, 32, 32);
  });

  // Abyss
  makeTile('abyss', 18, 8, 8, (tx) => {
    tx.fillStyle = 'rgba(150,20,20,0.05)';
    tx.fillRect(4, 4, 24, 24);
  });

  // Stone (village)
  makeTile('stone', 74, 69, 64, (tx, s) => {
    tx.strokeStyle = 'rgba(50,45,40,0.25)'; tx.lineWidth = 1;
    tx.strokeRect(2, 2, 13, 13);
    tx.strokeRect(17, 2, 13, 11);
    tx.strokeRect(4, 17, 11, 13);
    tx.strokeRect(17, 15, 13, 15);
    tx.fillStyle = 'rgba(255,255,255,0.06)';
    tx.fillRect(3, 3, 12, 6);
    tx.fillRect(18, 3, 12, 5);
  });

  // Ice
  makeTile('ice', 200, 224, 240, (tx, s) => {
    tx.fillStyle = 'rgba(200,230,255,0.2)';
    tx.fillRect(Math.random() * 16, Math.random() * 16, 8, 6);
    tx.strokeStyle = 'rgba(255,255,255,0.3)'; tx.lineWidth = 0.5;
    tx.beginPath(); tx.moveTo(5, 10); tx.lineTo(28, 22); tx.stroke();
    tx.beginPath(); tx.moveTo(18, 4); tx.lineTo(10, 28); tx.stroke();
  });

  // Garden
  makeTile('garden', 42, 90, 40, (tx, s) => {
    const colors = ['#ff88aa', '#ffaa55', '#aa88ff', '#88ffaa'];
    for (let i = 0; i < 3; i++) {
      tx.fillStyle = colors[Math.floor(Math.random() * 4)];
      tx.beginPath(); tx.arc(4 + Math.random() * 24, 4 + Math.random() * 24, 1.8, 0, Math.PI * 2); tx.fill();
    }
    tx.strokeStyle = '#3a8a28'; tx.lineWidth = 0.8;
    for (let i = 0; i < 3; i++) {
      const bx = 5 + Math.random() * 22, by = 28;
      tx.beginPath(); tx.moveTo(bx, by); tx.lineTo(bx + (Math.random() - 0.5) * 3, by - 6); tx.stroke();
    }
  });

  // Wasteland
  makeTile('wasteland', 26, 10, 10, (tx) => {
    tx.fillStyle = 'rgba(200,50,20,0.06)'; tx.fillRect(0, 0, 32, 32);
  });

  // Water
  makeTile('water', 30, 60, 130, (tx, s) => {
    // Water reflections
    tx.fillStyle = 'rgba(100,180,255,0.12)';
    tx.fillRect(4, 8, 20, 4);
    tx.fillStyle = 'rgba(255,255,255,0.08)';
    tx.beginPath(); tx.ellipse(16, 14, 8, 3, -0.2, 0, Math.PI * 2); tx.fill();
  });
}

// ============================================================
//  MASTER GENERATOR
// ============================================================
function generateAllSprites() {
  console.time('SpriteGen');

  genTerrainTiles();

  // Slimes (3D jelly)
  genSlime('slime_green', '#44cc44', '#88ff88', '#228822', 56);
  genSlime('slime_blue', '#4488ff', '#88bbff', '#224488', 56);

  // Wolf (3D muscular)
  genWolf('wolf_gray', '#888888', '#aaaaaa', '#555555');

  // Goblin
  genHumanoid('goblin_scout', {
    skinC: '#7a9944', skinD: '#5a7730', skinL: '#8aaa55',
    hairC: '#3a5520',
    armorC: '#6a5a3a', armorD: '#4a3a20', armorL: '#8a7a5a',
    weaponType: 'spear', weaponC: '#999', height: 52, width: 40,
    eyeC: '#ff0', hatType: 'none'
  });

  // Skeleton (3D bone)
  genSkeleton('skeleton_warrior');

  // Dark Mage
  genHumanoid('dark_mage', {
    skinC: '#a088aa', skinD: '#806088', skinL: '#c0a8cc',
    armorC: '#3a2255', armorD: '#221144', armorL: '#5a3a77',
    capeC: '#2a1144', weaponType: 'staff', weaponC: '#aa44ff',
    hatType: 'wizard', hatC: '#2a1155', eyeC: '#ff44ff',
    auraC: 'rgba(100,0,180,0.08)', height: 64, width: 48
  });

  // Crystal Golem (3D crystal)
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

  // Fire Dragon (3D boss)
  genDragon('fire_dragon', '#cc3300', '#ff6644', '#881100', '#aa220088');

  // Shadow Assassin
  genHumanoid('shadow_assassin', {
    skinC: '#3a3a4a', skinD: '#2a2a3a', skinL: '#4a4a5a',
    hairC: '#111',
    armorC: '#222233', armorD: '#111122', armorL: '#333344',
    capeC: '#111122', weaponType: 'dagger', weaponC: '#8888aa',
    hatType: 'hood', hatC: '#1a1a2a', eyeC: '#ff4444',
    auraC: 'rgba(30,0,60,0.1)', height: 60, width: 44
  });

  // Abyss Demon (3D boss)
  genDemon('abyss_demon');

  // Zone monsters
  genSlime('ice_elemental', '#88ddff', '#bbeeFF', '#4488aa', 56);
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

  // World Bosses (3D grand)
  genGolem('world_boss_treant', '#336622', '#55aa44', '#1a4411', '#88ff44');
  genSkeleton('world_boss_lich');
  genDragon('world_boss_crystal_dragon', '#4488cc', '#88eeff', '#225588', '#44aaff88');

  // Player classes (3D detailed)
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
    weaponType: 'none', hatType: 'none', hairC: '#222',
    height: 66, width: 50
  });
  genHumanoid('npc_healer', {
    skinC: '#f0d8c0', skinD: '#d0b8a0', skinL: '#fff0e0',
    armorC: '#eeeeff', armorD: '#ccccdd', armorL: '#ffffff',
    weaponType: 'staff', weaponC: '#ffd700', hatType: 'crown',
    hairC: '#ddbb66', eyeC: '#4488ff', height: 64, width: 48
  });

  // Trees (3D with depth)
  genTree('tree_oak', '#5a3a1a', '#2d6a1e', '#1a4a10', '#4a8a3a', 72);
  genTree('tree_pine', '#4a3018', '#1a5a2a', '#0a3a18', '#3a7a3a', 80);
  genTree('tree_dead', '#4a3828', '#3a2818', '#2a1808', '#4a3828', 60);
  genTree('tree_crystal', '#3a4a5a', '#4488cc', '#2266aa', '#66aaee', 64);

  // Rocks (3D with shading)
  function genRock(key, baseC, size) {
    const c = makeCanvas(size, size);
    const x = c.getContext('2d');
    const cx = size / 2, cy = size * 0.6;
    draw3DShadow(x, cx + 2, cy + size * 0.2, size * 0.35, size * 0.1);
    const rg = x.createRadialGradient(cx - 2, cy - 3, 1, cx, cy, size * 0.35);
    rg.addColorStop(0, colorShift(baseC, 25)); rg.addColorStop(0.6, baseC);
    rg.addColorStop(1, colorShift(baseC, -30));
    x.fillStyle = rg;
    x.beginPath();
    x.moveTo(cx - size * 0.35, cy + 2); x.quadraticCurveTo(cx - size * 0.3, cy - size * 0.3, cx, cy - size * 0.35);
    x.quadraticCurveTo(cx + size * 0.3, cy - size * 0.3, cx + size * 0.35, cy + 2);
    x.quadraticCurveTo(cx + size * 0.2, cy + size * 0.15, cx, cy + size * 0.1);
    x.quadraticCurveTo(cx - size * 0.2, cy + size * 0.15, cx - size * 0.35, cy + 2);
    x.fill();
    addSpecular(x, cx - 3, cy - size * 0.2, size * 0.08, 0.5, 0.3);
    EnvCache[key] = c;
  }
  genRock('rock_gray', '#6a6a6a', 24);
  genRock('rock_brown', '#6a5a4a', 28);
  genRock('rock_dark', '#3a3a3a', 22);
  genRock('rock_ice', '#8ab0cc', 20);
  genRock('rock_lava', '#5a3020', 26);

  // Bushes (3D leafy)
  function genBush(key, leafC, size) {
    const c = makeCanvas(size, size);
    const x = c.getContext('2d');
    const cx = size / 2, cy = size * 0.6;
    draw3DShadow(x, cx, cy + size * 0.15, size * 0.3, size * 0.08);
    const layers = [
      { ox: -3, oy: 2, r: size * 0.25 },
      { ox: 3, oy: 1, r: size * 0.22 },
      { ox: 0, oy: -2, r: size * 0.2 }
    ];
    for (const l of layers) {
      const bg = x.createRadialGradient(cx + l.ox - 2, cy + l.oy - 2, 1, cx + l.ox, cy + l.oy, l.r);
      bg.addColorStop(0, colorShift(leafC, 15)); bg.addColorStop(0.7, leafC); bg.addColorStop(1, colorShift(leafC, -25));
      x.fillStyle = bg;
      x.beginPath(); x.arc(cx + l.ox, cy + l.oy, l.r, 0, Math.PI * 2); x.fill();
    }
    EnvCache[key] = c;
  }
  genBush('bush_green', '#2a6a1e', 28);
  genBush('bush_flower', '#5a3a6a', 24);
  genBush('bush_autumn', '#8a6a2a', 26);
  genBush('bush_snow', '#8aaabb', 22);

  // Buildings (3D isometric with doors)
  genBuilding('building_house', '#8a7a5a', '#884422', 80, 88, { chimney: true });
  genBuilding('building_shop', '#7a8a6a', '#446644', 88, 84, { sign: 'SHOP' });
  genBuilding('building_inn', '#8a7060', '#664433', 96, 92, { chimney: true, sign: 'INN' });
  genBuilding('building_blacksmith', '#6a5a4a', '#553322', 76, 80, { chimney: true, sign: 'FORGE' });
  genBuilding('building_townhall', '#8a8a7a', '#555544', 120, 100, { sign: 'TOWN HALL' });

  console.timeEnd('SpriteGen');
  console.log('Sprites:', Object.keys(SpriteCache).length, 'entities,', Object.keys(EnvCache).length, 'env,', Object.keys(TileCache).length, 'tiles');
}

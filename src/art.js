import { TILE, T, SOLID_TILES, clamp } from './config.js';

const OUTLINE = '#382432';

export function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

// Soft glows are used all over the game. Building a radial gradient for every
// glow, every frame, is expensive on software renderers, so keep one small
// tinted sprite per colour and scale it where needed.
const glowSprites = new Map();

function glowSprite(color) {
  if (typeof document === 'undefined') return null;
  let sprite = glowSprites.get(color);
  if (!sprite) {
    sprite = document.createElement('canvas');
    sprite.width = 64;
    sprite.height = 64;
    const g = sprite.getContext('2d');
    const gradient = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gradient;
    g.fillRect(0, 0, 64, 64);
    glowSprites.set(color, sprite);
  }
  return sprite;
}

function glowCircle(ctx, x, y, r, color, alpha = 0.3) {
  const sprite = glowSprite(color);
  if (!sprite) {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    return;
  }
  ctx.globalAlpha = alpha;
  ctx.drawImage(sprite, x - r, y - r, r * 2, r * 2);
  ctx.globalAlpha = 1;
}

function starPath(ctx, cx, cy, outer, inner, points = 5, rotation = -Math.PI / 2) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = rotation + (i * Math.PI) / points;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function heartPath(ctx, cx, cy, size) {
  ctx.beginPath();
  ctx.moveTo(cx, cy + size * 0.72);
  ctx.bezierCurveTo(cx - size * 1.15, cy - size * 0.15, cx - size * 0.55, cy - size * 0.95, cx, cy - size * 0.35);
  ctx.bezierCurveTo(cx + size * 0.55, cy - size * 0.95, cx + size * 1.15, cy - size * 0.15, cx, cy + size * 0.72);
  ctx.closePath();
}

function cloudShape(ctx, x, y, scale, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, 44 * scale, 18 * scale, 0, 0, Math.PI * 2);
  ctx.ellipse(x - 26 * scale, y + 4 * scale, 24 * scale, 15 * scale, 0, 0, Math.PI * 2);
  ctx.ellipse(x + 28 * scale, y + 4 * scale, 26 * scale, 16 * scale, 0, 0, Math.PI * 2);
  ctx.ellipse(x + 4 * scale, y - 12 * scale, 25 * scale, 19 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
}

function repeatLayer(viewW, spacing, offset, draw) {
  const first = -(((offset % spacing) + spacing) % spacing) - spacing;
  for (let x = first; x < viewW + spacing; x += spacing) draw(x);
}

export function drawBackground(ctx, theme, camX, camY, viewW, viewH, time) {
  const t = theme;
  const sky = ctx.createLinearGradient(0, 0, 0, viewH);
  sky.addColorStop(0, t.skyTop);
  sky.addColorStop(0.55, t.skyMid);
  sky.addColorStop(1, t.skyBottom);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, viewW, viewH);

  const horizon = viewH * (t.id === 'cave' ? 0.78 : 0.76);
  if (t.id === 'plains') drawPlains(ctx, t, camX, camY, viewW, viewH, time, horizon);
  else if (t.id === 'cave') drawCave(ctx, t, camX, camY, viewW, viewH, time, horizon);
  else if (t.id === 'forest') drawForest(ctx, t, camX, camY, viewW, viewH, time, horizon);
  else if (t.id === 'mountain') drawMountain(ctx, t, camX, camY, viewW, viewH, time, horizon);
  else drawCastle(ctx, t, camX, camY, viewW, viewH, time, horizon);

  if (t.dark) {
    const vignette = ctx.createRadialGradient(viewW * 0.5, viewH * 0.52, viewW * 0.2, viewW * 0.5, viewH * 0.52, viewW * 0.78);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(5,2,14,0.42)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, viewW, viewH);
  }
}

function drawPlains(ctx, t, camX, camY, viewW, viewH, time, horizon) {
  const sunX = viewW * 0.78, sunY = viewH * 0.17 - camY * 0.02;
  glowCircle(ctx, sunX, sunY, 110, '#fff6b0', 0.5);
  ctx.fillStyle = t.glow;
  ctx.beginPath();
  ctx.arc(sunX, sunY, 38, 0, Math.PI * 2);
  ctx.fill();

  repeatLayer(viewW, 330, camX * 0.12 + time * 7, (x) => {
    cloudShape(ctx, x + 80, viewH * 0.16 + 20, 0.9, 'rgba(255,255,255,0.72)');
    cloudShape(ctx, x + 210, viewH * 0.25 + 8, 0.62, 'rgba(255,255,255,0.5)');
  });

  ctx.fillStyle = t.far1;
  ctx.beginPath();
  ctx.moveTo(0, horizon + 40);
  repeatLayer(viewW, 260, camX * 0.1, (x) => {
    ctx.ellipse(x, horizon + 54, 150, 90, 0, Math.PI, Math.PI * 2);
    ctx.ellipse(x + 130, horizon + 62, 120, 65, 0, Math.PI, Math.PI * 2);
  });
  ctx.rect(0, horizon + 40, viewW, viewH);
  ctx.fill();

  ctx.fillStyle = t.far2;
  ctx.beginPath();
  ctx.moveTo(0, horizon + 100);
  repeatLayer(viewW, 210, camX * 0.22, (x) => {
    ctx.ellipse(x, horizon + 120, 150, 92, 0, Math.PI, Math.PI * 2);
  });
  ctx.rect(0, horizon + 100, viewW, viewH);
  ctx.fill();

  // Distant mushroom trees and a tiny windmill.
  repeatLayer(viewW, 420, camX * 0.35, (x) => {
    const y = horizon + 34;
    ctx.fillStyle = 'rgba(50,112,60,0.45)';
    ctx.fillRect(x + 72, y - 44, 7, 44);
    ctx.beginPath();
    ctx.ellipse(x + 75, y - 48, 26, 13, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(x + 238, y - 30, 6, 30);
    ctx.beginPath();
    ctx.arc(x + 241, y - 36, 16, 0, Math.PI); ctx.fill();
  });

  ctx.fillStyle = t.far3;
  ctx.beginPath();
  ctx.moveTo(0, horizon + 170);
  repeatLayer(viewW, 170, camX * 0.42, (x) => {
    ctx.ellipse(x, horizon + 190, 130, 70, 0, Math.PI, Math.PI * 2);
  });
  ctx.rect(0, horizon + 170, viewW, viewH);
  ctx.fill();

  // Grass horizon highlight.
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(0, horizon + 170, viewW, 5);
}

function drawCave(ctx, t, camX, camY, viewW, viewH, time, horizon) {
  glowCircle(ctx, viewW * 0.5, viewH * 0.4, viewW * 0.45, '#4456b8', 0.32);
  // Hanging stalactites.
  repeatLayer(viewW, 145, camX * 0.16, (x) => {
    const h = 70 + Math.sin(x * 0.014) * 36;
    ctx.fillStyle = t.far1;
    ctx.beginPath();
    ctx.moveTo(x - 38, -20);
    ctx.lineTo(x, h);
    ctx.lineTo(x + 38, -20);
    ctx.closePath();
    ctx.fill();
  });
  repeatLayer(viewW, 230, camX * 0.35 + 70, (x) => {
    const h = 36 + Math.cos(x * 0.02) * 18;
    ctx.fillStyle = t.far2;
    ctx.beginPath();
    ctx.moveTo(x - 25, viewH * 0.12);
    ctx.lineTo(x, viewH * 0.12 + h);
    ctx.lineTo(x + 25, viewH * 0.12);
    ctx.closePath();
    ctx.fill();
  });

  // Far crystal spires.
  repeatLayer(viewW, 260, camX * 0.22, (x) => {
    const base = horizon + 80;
    ctx.fillStyle = t.far2;
    ctx.beginPath();
    ctx.moveTo(x - 48, base); ctx.lineTo(x - 18, base - 150); ctx.lineTo(x + 10, base);
    ctx.lineTo(x + 40, base - 90); ctx.lineTo(x + 65, base);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(118,232,255,0.18)';
    ctx.beginPath();
    ctx.moveTo(x - 18, base - 150); ctx.lineTo(x - 2, base - 40); ctx.lineTo(x + 10, base); ctx.closePath();
    ctx.fill();
  });

  ctx.fillStyle = t.far3;
  ctx.beginPath();
  ctx.moveTo(0, horizon + 80);
  repeatLayer(viewW, 320, camX * 0.4, (x) => {
    ctx.ellipse(x, horizon + 120, 220, 110, 0, Math.PI, Math.PI * 2);
  });
  ctx.rect(0, horizon + 80, viewW, viewH);
  ctx.fill();

  // Glowing underground pool.
  ctx.fillStyle = 'rgba(86,224,230,0.16)';
  ctx.beginPath();
  ctx.ellipse(viewW * 0.5, viewH * 0.93, viewW * 0.55, 54, 0, 0, Math.PI * 2);
  ctx.fill();
  repeatLayer(viewW, 210, camX * 0.5 + time * 8, (x) => {
    glowCircle(ctx, x, viewH * 0.9, 60, '#6ff3ff', 0.16);
  });
}

function drawForest(ctx, t, camX, camY, viewW, viewH, time, horizon) {
  // Light shafts.
  ctx.save();
  ctx.globalAlpha = 0.09;
  ctx.fillStyle = '#d9ffb0';
  for (let i = 0; i < 4; i++) {
    const x = ((i * 310 - camX * 0.18) % (viewW + 400) + viewW + 400) % (viewW + 400) - 200;
    ctx.beginPath();
    ctx.moveTo(x, -30);
    ctx.lineTo(x + 90, -30);
    ctx.lineTo(x + 230, viewH);
    ctx.lineTo(x + 70, viewH);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  repeatLayer(viewW, 300, camX * 0.16, (x) => {
    const trunkW = 74 + Math.sin(x) * 16;
    ctx.fillStyle = t.far1;
    roundRect(ctx, x, -20, trunkW, viewH * 0.9, 26); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    roundRect(ctx, x + trunkW * 0.65, -20, trunkW * 0.35, viewH * 0.9, 20); ctx.fill();
    ctx.fillStyle = t.far2;
    ctx.beginPath();
    ctx.ellipse(x + trunkW / 2, viewH * 0.05, 160, 86, 0, 0, Math.PI * 2);
    ctx.ellipse(x + trunkW / 2 - 80, viewH * 0.11, 100, 55, 0, 0, Math.PI * 2);
    ctx.ellipse(x + trunkW / 2 + 90, viewH * 0.1, 110, 62, 0, 0, Math.PI * 2);
    ctx.fill();
  });

  // Mid trunks and hanging vines.
  repeatLayer(viewW, 210, camX * 0.34 + 50, (x) => {
    ctx.fillStyle = 'rgba(20,70,58,0.75)';
    roundRect(ctx, x, -20, 42, viewH * 0.8, 18); ctx.fill();
    ctx.strokeStyle = 'rgba(120,190,130,0.22)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x + 10, viewH * 0.1);
    ctx.bezierCurveTo(x + 30, viewH * 0.25, x - 24, viewH * 0.4, x + 18, viewH * 0.58);
    ctx.stroke();
  });

  ctx.fillStyle = t.far3;
  ctx.beginPath();
  ctx.moveTo(0, horizon + 55);
  repeatLayer(viewW, 250, camX * 0.52, (x) => {
    ctx.ellipse(x, horizon + 95, 190, 90, 0, Math.PI, Math.PI * 2);
  });
  ctx.rect(0, horizon + 55, viewW, viewH);
  ctx.fill();

  // Firefly glow.
  for (let i = 0; i < 14; i++) {
    const x = ((i * 173 - camX * 0.4 + time * 9) % (viewW + 100) + viewW + 100) % (viewW + 100) - 50;
    const y = 100 + ((i * 97) % Math.max(120, horizon - 90)) + Math.sin(time * 1.5 + i) * 16;
    glowCircle(ctx, x, y, 15, '#d8ff9c', 0.65);
  }
  // Fog band.
  const fog = ctx.createLinearGradient(0, horizon - 30, 0, horizon + 130);
  fog.addColorStop(0, 'rgba(142,220,190,0)');
  fog.addColorStop(0.5, 'rgba(142,220,190,0.1)');
  fog.addColorStop(1, 'rgba(142,220,190,0)');
  ctx.fillStyle = fog;
  ctx.fillRect(0, horizon - 30, viewW, 160);
}

function drawMountain(ctx, t, camX, camY, viewW, viewH, time, horizon) {
  // Stars and a glowing moon.
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 30; i++) {
    const x = ((i * 137 - camX * 0.03) % viewW + viewW) % viewW;
    const y = 20 + ((i * 71) % Math.max(60, horizon * 0.55));
    ctx.globalAlpha = 0.35 + 0.4 * Math.sin(time * 1.6 + i * 2.2);
    ctx.fillRect(x, y, 2, 2);
  }
  ctx.globalAlpha = 1;
  const moonX = viewW * 0.18, moonY = viewH * 0.16;
  glowCircle(ctx, moonX, moonY, 100, '#fff0c9', 0.5);
  ctx.fillStyle = t.glow;
  ctx.beginPath(); ctx.arc(moonX, moonY, 34, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(210,180,150,0.22)';
  ctx.beginPath(); ctx.arc(moonX - 8, moonY + 6, 8, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(moonX + 10, moonY - 8, 5, 0, Math.PI * 2); ctx.fill();

  repeatLayer(viewW, 420, camX * 0.08 + time * 4, (x) => {
    cloudShape(ctx, x + 90, viewH * 0.34, 0.8, 'rgba(255,236,235,0.32)');
  });

  // Distant snowy peaks.
  repeatLayer(viewW, 380, camX * 0.13, (x) => {
    ctx.fillStyle = t.far1;
    ctx.beginPath();
    ctx.moveTo(x - 230, horizon + 40);
    ctx.lineTo(x - 30, horizon - 220);
    ctx.lineTo(x + 60, horizon - 90);
    ctx.lineTo(x + 150, horizon - 170);
    ctx.lineTo(x + 340, horizon + 40);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.beginPath();
    ctx.moveTo(x - 66, horizon - 165);
    ctx.lineTo(x - 30, horizon - 220);
    ctx.lineTo(x + 6, horizon - 168);
    ctx.lineTo(x - 16, horizon - 182);
    ctx.lineTo(x - 34, horizon - 158);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + 104, horizon - 135);
    ctx.lineTo(x + 150, horizon - 170);
    ctx.lineTo(x + 196, horizon - 126);
    ctx.lineTo(x + 160, horizon - 145);
    ctx.closePath();
    ctx.fill();
  });

  repeatLayer(viewW, 290, camX * 0.29, (x) => {
    ctx.fillStyle = t.far2;
    ctx.beginPath();
    ctx.moveTo(x - 170, horizon + 110);
    ctx.lineTo(x + 10, horizon - 120);
    ctx.lineTo(x + 190, horizon + 110);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.beginPath();
    ctx.moveTo(x - 18, horizon - 75);
    ctx.lineTo(x + 10, horizon - 120);
    ctx.lineTo(x + 42, horizon - 72);
    ctx.closePath();
    ctx.fill();
  });

  ctx.fillStyle = t.far3;
  ctx.beginPath();
  ctx.moveTo(0, horizon + 130);
  repeatLayer(viewW, 220, camX * 0.48, (x) => {
    ctx.ellipse(x, horizon + 170, 190, 90, 0, Math.PI, Math.PI * 2);
  });
  ctx.rect(0, horizon + 130, viewW, viewH);
  ctx.fill();

  // Pine silhouettes.
  repeatLayer(viewW, 120, camX * 0.62, (x) => {
    const base = horizon + 170;
    ctx.fillStyle = 'rgba(28,47,76,0.72)';
    ctx.beginPath();
    ctx.moveTo(x - 26, base);
    ctx.lineTo(x, base - 92 - Math.sin(x) * 22);
    ctx.lineTo(x + 26, base);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(x - 3, base - 20, 6, 26);
  });
}

function drawCastle(ctx, t, camX, camY, viewW, viewH, time, horizon) {
  // Storm glow and occasional lightning.
  const flash = Math.max(0, Math.sin(time * 0.43) ** 12);
  if (flash > 0.05) {
    ctx.fillStyle = `rgba(210,220,255,${flash * 0.18})`;
    ctx.fillRect(0, 0, viewW, viewH * 0.7);
  }
  const glow = ctx.createRadialGradient(viewW * 0.5, viewH * 0.66, 20, viewW * 0.5, viewH * 0.66, viewW * 0.6);
  glow.addColorStop(0, 'rgba(255,93,68,0.25)');
  glow.addColorStop(1, 'rgba(255,93,68,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, viewW, viewH);

  const moonX = viewW * 0.82, moonY = viewH * 0.16;
  glowCircle(ctx, moonX, moonY, 90, '#ffb88b', 0.35);
  ctx.fillStyle = '#f2c6a0';
  ctx.beginPath(); ctx.arc(moonX, moonY, 30, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(80,33,52,0.35)';
  ctx.beginPath(); ctx.ellipse(moonX - 8, moonY - 4, 22, 8, -0.3, 0, Math.PI * 2); ctx.fill();

  repeatLayer(viewW, 360, camX * 0.1 + time * 5, (x) => {
    cloudShape(ctx, x + 100, viewH * 0.17, 1.2, 'rgba(40,12,46,0.72)');
    cloudShape(ctx, x + 260, viewH * 0.28, 0.8, 'rgba(52,16,54,0.55)');
  });

  // Distant castle silhouette.
  repeatLayer(viewW, 540, camX * 0.17, (x) => {
    ctx.fillStyle = t.far1;
    ctx.fillRect(x + 40, horizon - 220, 300, 330);
    ctx.fillRect(x + 70, horizon - 290, 54, 100);
    ctx.fillRect(x + 218, horizon - 330, 70, 140);
    ctx.beginPath();
    ctx.moveTo(x + 60, horizon - 290); ctx.lineTo(x + 97, horizon - 350); ctx.lineTo(x + 134, horizon - 290); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + 206, horizon - 330); ctx.lineTo(x + 253, horizon - 400); ctx.lineTo(x + 300, horizon - 330); ctx.fill();
    ctx.fillStyle = 'rgba(255,172,90,0.5)';
    for (let i = 0; i < 7; i++) {
      const wx = x + 60 + (i % 4) * 62;
      const wy = horizon - 190 + Math.floor(i / 4) * 78;
      if (Math.sin(time * 2 + i * 3.1) > -0.65) ctx.fillRect(wx, wy, 13, 20);
    }
  });

  repeatLayer(viewW, 190, camX * 0.32, (x) => {
    ctx.fillStyle = t.far2;
    ctx.fillRect(x, horizon - 120, 48, 260);
    ctx.beginPath();
    ctx.moveTo(x - 12, horizon - 120); ctx.lineTo(x + 24, horizon - 185); ctx.lineTo(x + 60, horizon - 120); ctx.fill();
    ctx.fillStyle = 'rgba(255,150,80,0.55)';
    ctx.fillRect(x + 16, horizon - 70, 10, 18);
  });

  ctx.fillStyle = t.far3;
  ctx.beginPath();
  ctx.moveTo(0, horizon + 54);
  repeatLayer(viewW, 260, camX * 0.48, (x) => {
    ctx.ellipse(x, horizon + 120, 220, 120, 0, Math.PI, Math.PI * 2);
  });
  ctx.rect(0, horizon + 54, viewW, viewH);
  ctx.fill();

  // Lava glow at the bottom.
  const lava = ctx.createLinearGradient(0, viewH * 0.88, 0, viewH);
  lava.addColorStop(0, 'rgba(255,95,50,0)');
  lava.addColorStop(1, 'rgba(255,95,50,0.3)');
  ctx.fillStyle = lava;
  ctx.fillRect(0, viewH * 0.88, viewW, viewH * 0.12);
}

export function drawWorldDecor(ctx, level, camX, viewW, time, front = false) {
  const theme = level.themeData;
  for (const d of level.decor) {
    if (d.front !== front) continue;
    if (d.x < camX - 260 || d.x > camX + viewW + 260) continue;
    drawDecorItem(ctx, d, theme, time);
  }
}

function drawDecorItem(ctx, d, theme, time) {
  const { x, y, size } = d;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size, size);
  const v = d.variant;
  switch (d.type) {
    case 'tree': {
      ctx.fillStyle = '#6b4628';
      roundRect(ctx, -8, -96, 16, 98, 7); ctx.fill();
      ctx.fillStyle = theme.far3;
      ctx.beginPath();
      ctx.arc(-26, -108, 38, 0, Math.PI * 2);
      ctx.arc(24, -115, 42, 0, Math.PI * 2);
      ctx.arc(0, -138, 36, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.16)';
      ctx.beginPath(); ctx.arc(-20, -128, 18, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'bigTree':
    case 'vineTree': {
      ctx.fillStyle = '#433126';
      roundRect(ctx, -18, -170, 36, 172, 12); ctx.fill();
      ctx.fillStyle = 'rgba(20,20,15,0.2)';
      roundRect(ctx, 7, -170, 12, 172, 8); ctx.fill();
      ctx.fillStyle = theme.far3;
      ctx.beginPath();
      ctx.arc(-34, -190, 58, 0, Math.PI * 2);
      ctx.arc(40, -198, 64, 0, Math.PI * 2);
      ctx.arc(0, -232, 58, 0, Math.PI * 2);
      ctx.fill();
      if (d.type === 'vineTree') {
        ctx.strokeStyle = 'rgba(130,214,140,0.55)';
        ctx.lineWidth = 4;
        for (let i = 0; i < 3; i++) {
          const sway = Math.sin(time * 0.8 + i + v) * 8;
          ctx.beginPath();
          ctx.moveTo(-24 + i * 22, -180);
          ctx.bezierCurveTo(-30 + sway, -130, -8 + sway, -95, -20 + sway, -52 + i * 12);
          ctx.stroke();
        }
      }
      break;
    }
    case 'pine': {
      ctx.fillStyle = '#4f3a2b';
      ctx.fillRect(-5, -72, 10, 74);
      for (let i = 0; i < 3; i++) {
        const w = 46 - i * 10;
        const yy = -40 - i * 34;
        ctx.fillStyle = i === 0 ? '#35695b' : '#3f7a66';
        ctx.beginPath();
        ctx.moveTo(-w, yy); ctx.lineTo(0, yy - 54); ctx.lineTo(w, yy); ctx.closePath(); ctx.fill();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.beginPath(); ctx.moveTo(-18, -88); ctx.lineTo(0, -113); ctx.lineTo(16, -88); ctx.closePath(); ctx.fill();
      break;
    }
    case 'bush': {
      ctx.fillStyle = theme.far3;
      ctx.beginPath();
      ctx.arc(-16, -18, 20, 0, Math.PI * 2);
      ctx.arc(6, -25, 24, 0, Math.PI * 2);
      ctx.arc(26, -16, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = theme.accent2;
      ctx.beginPath(); ctx.arc(-12, -26, 3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(21, -13, 3, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'grass': {
      ctx.strokeStyle = theme.grassLight;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      for (let i = 0; i < 5; i++) {
        const sway = Math.sin(time * 2 + i + v) * 3;
        ctx.beginPath();
        ctx.moveTo(-12 + i * 6, 0);
        ctx.quadraticCurveTo(-16 + i * 7 + sway, -12, -10 + i * 6 + sway, -24 - i % 3 * 5);
        ctx.stroke();
      }
      break;
    }
    case 'flower': {
      ctx.strokeStyle = '#3f8d4c';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(4, -14, 0, -28); ctx.stroke();
      ctx.fillStyle = [theme.accent, theme.accent2, '#ffffff'][v % 3];
      for (let i = 0; i < 5; i++) {
        const a = (i * Math.PI * 2) / 5;
        ctx.beginPath(); ctx.ellipse(Math.cos(a) * 7, -30 + Math.sin(a) * 7, 5, 5, 0, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = '#ffd75e';
      ctx.beginPath(); ctx.arc(0, -30, 4, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'mushroom': {
      ctx.fillStyle = '#f4e1bd';
      roundRect(ctx, -6, -34, 12, 35, 5); ctx.fill();
      ctx.fillStyle = '#e55757';
      ctx.beginPath(); ctx.ellipse(0, -38, 26, 18, 0, Math.PI, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff4e0';
      for (let i = 0; i < 4; i++) {
        ctx.beginPath(); ctx.arc(-14 + i * 10, -45 + (i % 2) * 4, 3.5, 0, Math.PI * 2); ctx.fill();
      }
      break;
    }
    case 'mushroomGlow': {
      ctx.fillStyle = 'rgba(143,255,221,0.9)';
      roundRect(ctx, -5, -30, 10, 31, 4); ctx.fill();
      glowCircle(ctx, 0, -34, 42, '#6ff3d6', 0.35);
      ctx.fillStyle = '#5fe3c4';
      ctx.beginPath(); ctx.ellipse(0, -34, 22, 15, 0, Math.PI, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#d8fff3';
      for (let i = 0; i < 3; i++) ctx.fillRect(-12 + i * 10, -40, 3, 3);
      break;
    }
    case 'crystalDecor': {
      glowCircle(ctx, 0, -30, 62, theme.accent, 0.22);
      ctx.fillStyle = theme.accent;
      ctx.beginPath(); ctx.moveTo(-22, 0); ctx.lineTo(-8, -68); ctx.lineTo(6, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath(); ctx.moveTo(-8, -68); ctx.lineTo(-2, -20); ctx.lineTo(6, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = theme.accent2;
      ctx.beginPath(); ctx.moveTo(2, 0); ctx.lineTo(16, -42); ctx.lineTo(30, 0); ctx.closePath(); ctx.fill();
      break;
    }
    case 'stalagmite': {
      ctx.fillStyle = theme.far2;
      ctx.beginPath(); ctx.moveTo(-30, 0); ctx.lineTo(-10, -80); ctx.lineTo(14, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.beginPath(); ctx.moveTo(-10, -80); ctx.lineTo(0, -20); ctx.lineTo(14, 0); ctx.closePath(); ctx.fill();
      break;
    }
    case 'rock': {
      ctx.fillStyle = theme.stone;
      ctx.beginPath();
      ctx.ellipse(0, -12, 28, 18, 0, Math.PI, Math.PI * 2);
      ctx.lineTo(26, 0); ctx.lineTo(-24, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      ctx.beginPath(); ctx.ellipse(-7, -18, 10, 5, -0.2, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'fern': {
      ctx.strokeStyle = theme.grass;
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(i * 13, -24, i * 26, -40 - Math.abs(i) * -5);
        ctx.stroke();
      }
      break;
    }
    case 'flag': {
      ctx.strokeStyle = '#5b4b4b';
      ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -74); ctx.stroke();
      const wave = Math.sin(time * 2 + v) * 5;
      ctx.fillStyle = theme.accent2;
      ctx.beginPath();
      ctx.moveTo(2, -70); ctx.quadraticCurveTo(30, -62 + wave, 44, -52); ctx.lineTo(2, -40); ctx.closePath(); ctx.fill();
      break;
    }
    case 'pillar': {
      ctx.fillStyle = theme.stone;
      roundRect(ctx, -20, -150, 40, 150, 6); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.fillRect(-13, -146, 7, 146);
      ctx.fillStyle = theme.platformTop;
      roundRect(ctx, -28, -158, 56, 14, 5); ctx.fill();
      break;
    }
    case 'torch': {
      ctx.fillStyle = '#4a3b3c';
      ctx.fillRect(-4, -82, 8, 84);
      glowCircle(ctx, 0, -88, 56, '#ffad5c', 0.4);
      ctx.fillStyle = '#ff9a3d';
      ctx.beginPath();
      ctx.ellipse(0, -94 + Math.sin(time * 8 + v) * 3, 9, 17, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffe07a';
      ctx.beginPath();
      ctx.ellipse(0, -91 + Math.sin(time * 7 + v) * 2, 4, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'banner': {
      ctx.fillStyle = '#b23c55';
      ctx.beginPath();
      ctx.moveTo(-24, -120); ctx.lineTo(24, -120); ctx.lineTo(24, -46);
      ctx.lineTo(0, -58); ctx.lineTo(-24, -46); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffd76a';
      starPath(ctx, 0, -86, 11, 5); ctx.fill();
      break;
    }
    case 'chain': {
      ctx.strokeStyle = 'rgba(190,180,200,0.5)';
      ctx.lineWidth = 3;
      for (let i = 0; i < 9; i++) {
        ctx.beginPath();
        ctx.ellipse(0, -i * 12, i % 2 ? 5 : 2, 7, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      break;
    }
    case 'statue': {
      ctx.fillStyle = '#6b5a6d';
      roundRect(ctx, -18, -12, 36, 12, 4); ctx.fill();
      ctx.fillStyle = '#8d7a8f';
      roundRect(ctx, -10, -52, 20, 42, 8); ctx.fill();
      ctx.beginPath(); ctx.ellipse(0, -58, 24, 14, 0, Math.PI, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#2f2433';
      ctx.beginPath(); ctx.arc(-7, -56, 3, 0, Math.PI * 2); ctx.arc(7, -56, 3, 0, Math.PI * 2); ctx.fill();
      break;
    }
    default:
      break;
  }
  ctx.restore();
}

export function drawTile(ctx, level, col, row, time, bump = 0) {
  const t = level.tileAt(col, row);
  if (t === T.EMPTY) return;
  const theme = level.themeData;
  const x = col * TILE;
  const y = row * TILE - bump;
  const above = level.tileAt(col, row - 1);
  const left = level.tileAt(col - 1, row);
  const right = level.tileAt(col + 1, row);

  switch (t) {
    case T.GROUND: {
      ctx.fillStyle = theme.ground;
      ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = theme.groundDark;
      ctx.fillRect(x + 8, y + 18, 6, 4);
      ctx.fillRect(x + 30, y + 32, 9, 5);
      ctx.fillRect(x + 19, y + 10 + ((col + row) % 3) * 3, 4, 3);
      if (!SOLID_TILES.has(above) || above === T.EMPTY) {
        ctx.fillStyle = theme.groundDark;
        ctx.fillRect(x, y, TILE, 10);
        ctx.fillStyle = theme.grass;
        roundRect(ctx, x - 1, y - 3, TILE + 2, 16, 6); ctx.fill();
        ctx.fillStyle = theme.grassLight;
        ctx.fillRect(x, y - 3, TILE, 5);
        // grass blades
        ctx.fillStyle = theme.grass;
        for (let i = 0; i < 3; i++) {
          const gx = x + 7 + i * 15 + ((col * 7 + i * 3) % 5);
          ctx.beginPath();
          ctx.moveTo(gx, y + 2);
          ctx.lineTo(gx + 3, y - 7);
          ctx.lineTo(gx + 6, y + 2);
          ctx.fill();
        }
      } else if (theme.id === 'cave' || theme.id === 'castle') {
        ctx.strokeStyle = 'rgba(255,255,255,0.04)';
        ctx.strokeRect(x + 1, y + 1, TILE - 2, TILE - 2);
      }
      break;
    }
    case T.BRICK: {
      ctx.fillStyle = theme.brick;
      roundRect(ctx, x + 1, y + 1, TILE - 2, TILE - 2, 5); ctx.fill();
      ctx.fillStyle = theme.brickDark;
      ctx.fillRect(x + 5, y + 5, TILE - 10, 2);
      ctx.fillRect(x + 5, y + TILE - 7, TILE - 10, 2);
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(x + 5, y + 7, TILE - 10, 3);
      ctx.fillStyle = theme.brickDark;
      for (let i = 0; i < 2; i++) {
        ctx.fillRect(x + 7 + i * 18, y + 22, 12, 3);
        ctx.fillRect(x + 14 + i * 18, y + 34, 10, 3);
      }
      if (theme.id === 'forest') {
        ctx.fillStyle = 'rgba(86,170,88,0.5)';
        ctx.beginPath(); ctx.arc(x + 9, y + 8, 7, 0, Math.PI); ctx.fill();
      }
      break;
    }
    case T.QUESTION: {
      const pulse = 0.5 + 0.5 * Math.sin(time * 4 + col);
      ctx.fillStyle = theme.brickDark;
      roundRect(ctx, x + 1, y + 1, TILE - 2, TILE - 2, 6); ctx.fill();
      ctx.fillStyle = `rgb(${235 + pulse * 15}, ${178 + pulse * 30}, 58)`;
      roundRect(ctx, x + 4, y + 3, TILE - 8, TILE - 8, 5); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillRect(x + 8, y + 7, TILE - 16, 3);
      ctx.fillStyle = '#8b4c18';
      for (const [dx, dy] of [[8, 8], [TILE - 11, 8], [8, TILE - 11], [TILE - 11, TILE - 11]]) {
        ctx.beginPath(); ctx.arc(x + dx, y + dy, 2, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = '#fff6d8';
      ctx.font = 'bold 27px "Trebuchet MS", sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('?', x + TILE / 2, y + TILE / 2 + 1);
      break;
    }
    case T.USED: {
      ctx.fillStyle = theme.brickDark;
      roundRect(ctx, x + 2, y + 2, TILE - 4, TILE - 4, 5); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      roundRect(ctx, x + 7, y + 7, TILE - 14, TILE - 14, 4); ctx.fill();
      break;
    }
    case T.PIPE: {
      const isTop = above !== T.PIPE;
      const isLeft = left !== T.PIPE;
      const isRight = right !== T.PIPE;
      ctx.fillStyle = theme.pipeDark;
      ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = theme.pipe;
      const bodyX = isLeft ? x + 4 : x;
      const bodyW = TILE - (isLeft ? 4 : 0) - (isRight ? 4 : 0);
      ctx.fillRect(bodyX, y, bodyW, TILE);
      ctx.fillStyle = theme.pipeLight;
      ctx.fillRect(bodyX + 6, y, 7, TILE);
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(x + TILE - (isRight ? 14 : 0), y, 7, TILE);
      if (isTop) {
        const rimX = isLeft ? x - 4 : x;
        const rimW = (isLeft ? TILE + 8 : TILE) + (isRight ? 0 : 0);
        ctx.fillStyle = theme.pipeDark;
        roundRect(ctx, rimX, y - 2, isLeft ? 2 * TILE + 8 : TILE, 22, 7); ctx.fill();
        ctx.fillStyle = theme.pipe;
        roundRect(ctx, rimX + 3, y, isLeft ? 2 * TILE + 2 : TILE - 6, 17, 6); ctx.fill();
        ctx.fillStyle = theme.pipeLight;
        ctx.fillRect(rimX + 8, y + 3, 9, 5);
        if (level.pipes.some((p) => p.secret && Math.abs(p.x - x) < 2 && Math.abs(p.y - y) < 2)) {
          ctx.globalAlpha = 0.5 + 0.3 * Math.sin(time * 3);
          ctx.fillStyle = '#fff3a2';
          ctx.beginPath(); ctx.arc(x + TILE, y + 8, 4, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = 1;
        }
      }
      break;
    }
    case T.PLATFORM: {
      ctx.fillStyle = theme.platform;
      roundRect(ctx, x, y + 5, TILE, TILE - 9, 5); ctx.fill();
      ctx.fillStyle = theme.platformTop;
      roundRect(ctx, x, y + 2, TILE, 13, 6); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.fillRect(x + 4, y + 4, TILE - 8, 3);
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.fillRect(x + 6, y + 20, 7, 8);
      ctx.fillRect(x + TILE - 17, y + 28, 10, 7);
      if (theme.id === 'mountain') {
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.fillRect(x, y + 2, TILE, 4);
      }
      break;
    }
    case T.SPIKE: {
      ctx.fillStyle = theme.hazard;
      for (let i = 0; i < 3; i++) {
        const sx = x + 4 + i * 15;
        ctx.beginPath();
        ctx.moveTo(sx, y + TILE);
        ctx.lineTo(sx + 8, y + 9);
        ctx.lineTo(sx + 16, y + TILE);
        ctx.closePath();
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      for (let i = 0; i < 3; i++) {
        const sx = x + 6 + i * 15;
        ctx.beginPath(); ctx.moveTo(sx + 2, y + TILE); ctx.lineTo(sx + 8, y + 16); ctx.lineTo(sx + 9, y + TILE); ctx.closePath(); ctx.fill();
      }
      break;
    }
    case T.LAVA: {
      const wave = Math.sin(time * 4 + col * 0.9) * 4;
      ctx.fillStyle = '#7a1d2f';
      ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = '#ff7a35';
      ctx.beginPath();
      ctx.moveTo(x, y + 10 + wave);
      ctx.quadraticCurveTo(x + TILE / 2, y + 2 - wave, x + TILE, y + 10 + wave);
      ctx.lineTo(x + TILE, y + TILE);
      ctx.lineTo(x, y + TILE);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255,225,120,0.6)';
      ctx.fillRect(x + 6, y + 16 + wave, TILE - 12, 3);
      break;
    }
    case T.CASTLE: {
      ctx.fillStyle = theme.ground;
      ctx.fillRect(x, y, TILE, TILE);
      ctx.strokeStyle = theme.groundDark;
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, y + 1, TILE - 2, TILE - 2);
      ctx.beginPath();
      ctx.moveTo(x, y + TILE / 2); ctx.lineTo(x + TILE, y + TILE / 2);
      ctx.moveTo(x + TILE / 2, y); ctx.lineTo(x + TILE / 2, y + TILE / 2);
      ctx.moveTo(x + TILE / 4, y + TILE / 2); ctx.lineTo(x + TILE / 4, y + TILE);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.fillRect(x + 3, y + 3, TILE - 6, 4);
      if (!SOLID_TILES.has(above) || above === T.EMPTY) {
        ctx.fillStyle = theme.grass;
        ctx.fillRect(x, y, TILE, 9);
        ctx.fillStyle = theme.grassLight;
        ctx.fillRect(x, y, TILE, 3);
      }
      break;
    }
    case T.CRYSTAL: {
      ctx.fillStyle = 'rgba(112,233,255,0.3)';
      roundRect(ctx, x, y, TILE, TILE, 8); ctx.fill();
      ctx.strokeStyle = 'rgba(190,250,255,0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + 8, y + TILE - 4); ctx.lineTo(x + 18, y + 8); ctx.lineTo(x + 28, y + TILE - 4);
      ctx.moveTo(x + 18, y + 8); ctx.lineTo(x + 18, y + TILE - 4);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath(); ctx.moveTo(x + 18, y + 8); ctx.lineTo(x + 28, y + TILE - 4); ctx.lineTo(x + 18, y + TILE - 4); ctx.closePath(); ctx.fill();
      break;
    }
    case T.BOUNCE: {
      const squish = Math.sin(time * 5 + col) * 2;
      ctx.fillStyle = '#f0ddba';
      ctx.fillRect(x + 18, y + 24, 12, 24);
      ctx.fillStyle = '#ef5f72';
      ctx.beginPath();
      ctx.ellipse(x + TILE / 2, y + 26 + squish, 25, 17 - squish, 0, Math.PI, Math.PI * 2);
      ctx.lineTo(x + TILE / 2 + 25, y + 29);
      ctx.lineTo(x + TILE / 2 - 25, y + 29);
      ctx.fill();
      ctx.fillStyle = '#ffe6a0';
      for (let i = 0; i < 3; i++) ctx.beginPath(), ctx.arc(x + 12 + i * 12, y + 19, 3, 0, Math.PI * 2), ctx.fill();
      break;
    }
    case T.CLOUD: {
      ctx.fillStyle = 'rgba(238,249,255,0.95)';
      ctx.beginPath();
      ctx.arc(x + 12, y + 26, 15, 0, Math.PI * 2);
      ctx.arc(x + 28, y + 18, 19, 0, Math.PI * 2);
      ctx.arc(x + 42, y + 28, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(160,200,235,0.35)';
      ctx.fillRect(x, y + 34, TILE, 7);
      break;
    }
    default:
      break;
  }
}

export function drawCoin(ctx, x, y, time, phase = 0) {
  const spin = Math.abs(Math.cos(time * 4 + phase));
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(255,211,80,0.22)';
  ctx.beginPath(); ctx.arc(0, 0, 17, 0, Math.PI * 2); ctx.fill();
  const w = 3 + spin * 11;
  ctx.fillStyle = '#8d5a10';
  ctx.beginPath(); ctx.ellipse(0, 0, w + 2, 14, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffd54a';
  ctx.beginPath(); ctx.ellipse(0, 0, w, 12, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff0a6';
  ctx.beginPath(); ctx.ellipse(-w * 0.24, -3, Math.max(1.2, w * 0.3), 5, -0.3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#c78a1d';
  ctx.font = 'bold 11px "Trebuchet MS", sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if (spin > 0.45) ctx.fillText('★', 0, 1);
  ctx.restore();
}

export function drawStarShard(ctx, x, y, time, phase = 0) {
  const bob = Math.sin(time * 3 + phase) * 6;
  ctx.save();
  ctx.translate(x, y + bob);
  ctx.rotate(Math.sin(time * 1.4 + phase) * 0.14);
  glowCircle(ctx, 0, 0, 40, '#ffe36b', 0.55);
  ctx.fillStyle = '#ffcf2f';
  ctx.strokeStyle = '#a8650a';
  ctx.lineWidth = 3;
  starPath(ctx, 0, 0, 19, 8, 5, -Math.PI / 2);
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#fff8cf';
  starPath(ctx, -3, -4, 8, 3.5, 5, -Math.PI / 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.beginPath(); ctx.arc(12, -13, 2, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

export function drawHeartItem(ctx, x, y, time) {
  const bob = Math.sin(time * 4) * 3;
  ctx.save();
  ctx.translate(x, y + bob);
  glowCircle(ctx, 0, 0, 28, '#ff7d92', 0.4);
  ctx.fillStyle = '#ff5d79';
  ctx.strokeStyle = '#8f2435';
  ctx.lineWidth = 3;
  heartPath(ctx, 0, 0, 14);
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.beginPath(); ctx.ellipse(-5, -5, 3.5, 2.5, -0.5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

export function drawStarPower(ctx, x, y, time) {
  ctx.save();
  ctx.translate(x, y + Math.sin(time * 6) * 2);
  ctx.rotate(time * 2);
  glowCircle(ctx, 0, 0, 34, '#fff3a1', 0.65);
  ctx.fillStyle = '#ffe75c';
  ctx.strokeStyle = '#a87a14';
  ctx.lineWidth = 3;
  starPath(ctx, 0, 0, 17, 7, 5, -Math.PI / 2);
  ctx.fill(); ctx.stroke();
  ctx.restore();
}

export function drawHero(ctx, p, time, theme) {
  const x = p.x + p.w / 2;
  const y = p.y + p.h;
  const run = p.onGround && Math.abs(p.vx) > 25;
  const speed = Math.min(1, Math.abs(p.vx) / 360);
  const cycle = p.runCycle;
  const bob = run ? Math.abs(Math.sin(cycle)) * 2.1 * speed : Math.sin(time * 2.8) * 0.8;
  const blink = (time + p.blinkOffset) % 4.2 > 4.05;
  const starPower = p.starPower > 0;

  // Ground shadow.
  ctx.save();
  ctx.globalAlpha = 0.2;
  ctx.fillStyle = '#0e1720';
  ctx.beginPath();
  ctx.ellipse(x, y - 1, 19, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(x, y - bob);
  ctx.scale(p.facing || 1, 1);
  const squash = p.squash || 0;
  ctx.scale(1 + squash * 0.24, 1 - squash * 0.2);
  if (p.invuln > 0 && Math.floor(time * 18) % 2 === 0) ctx.globalAlpha = 0.45;
  if (p.hurtTimer > 0) ctx.rotate(-0.18);
  if (starPower) {
    ctx.shadowColor = `hsl(${(time * 320) % 360} 100% 65%)`;
    ctx.shadowBlur = 18;
  }

  const jump = !p.onGround;
  const rising = jump && p.vy < 0;
  const legSwing = run ? Math.sin(cycle) * 8 * speed : 0;
  const armSwing = run ? Math.sin(cycle + Math.PI) * 7 * speed : Math.sin(time * 2.5) * 1.4;
  const legFront = jump ? (rising ? 5 : 2) : legSwing;
  const legBack = jump ? (rising ? -5 : -1) : -legSwing;
  const armFront = jump ? (rising ? -7 : 5) : -armSwing;
  const armBack = jump ? (rising ? -4 : 3) : armSwing;

  // Backpack.
  ctx.fillStyle = '#8f5a35';
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2.4;
  roundRect(ctx, -20, -32, 12, 22, 5); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#e0a55d';
  roundRect(ctx, -18, -27, 8, 5, 2); ctx.fill();

  // Scarf trailing behind.
  ctx.strokeStyle = '#ff5d79';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  const scarfWave = Math.sin(time * 9) * 4 + (run ? 5 : 0);
  ctx.beginPath();
  ctx.moveTo(-8, -35);
  ctx.quadraticCurveTo(-21, -34 + scarfWave, -31 - (run ? 7 : 0), -28 + scarfWave * 0.5);
  ctx.stroke();
  ctx.strokeStyle = '#ff8ea2';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Legs.
  drawLimb(ctx, -5, -12, -7 + legBack, 0, '#2f4f8f', '#2a2b42');
  drawLimb(ctx, 5, -12, 7 + legFront, 0, '#35599e', '#2a2b42');

  // Body overalls.
  ctx.fillStyle = '#3f6bc4';
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2.6;
  roundRect(ctx, -11, -31, 22, 22, 7); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ffd75e';
  roundRect(ctx, -8, -35, 16, 9, 4); ctx.fill();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-7, -31); ctx.lineTo(-5, -25); ctx.moveTo(7, -31); ctx.lineTo(5, -25); ctx.stroke();
  ctx.fillStyle = '#ffd75e';
  ctx.beginPath(); ctx.arc(-5, -25, 1.6, 0, Math.PI * 2); ctx.arc(5, -25, 1.6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#2e4f93';
  roundRect(ctx, -7, -20, 14, 8, 3); ctx.fill();

  // Arms.
  drawArm(ctx, -10, -28, -13 + armBack * 0.5, -17 + armBack, '#ffcf57', '#f0a93f');
  drawArm(ctx, 10, -28, 13 + armFront * 0.5, -17 + armFront, '#ffcf57', '#f0a93f');

  // Head.
  ctx.fillStyle = '#ffd9ad';
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.arc(1, -43, 12.5, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();
  // Ear.
  ctx.beginPath(); ctx.arc(-9, -41, 3.2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // Hair tuft.
  ctx.fillStyle = '#7b4a2c';
  ctx.beginPath();
  ctx.moveTo(-5, -53);
  ctx.quadraticCurveTo(-1, -59, 5, -54);
  ctx.quadraticCurveTo(1, -54, -2, -50);
  ctx.fill();

  // Eyes.
  const eyeY = -44;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.ellipse(1.5, eyeY, 3.4, 4.2, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(8.2, eyeY, 2.9, 4, 0, 0, Math.PI * 2); ctx.fill();
  if (!blink) {
    ctx.fillStyle = '#2b2230';
    ctx.beginPath(); ctx.arc(2.6, eyeY + 0.4, 1.9, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(9, eyeY + 0.4, 1.7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(3.2, eyeY - 0.6, 0.6, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(9.5, eyeY - 0.6, 0.5, 0, Math.PI * 2); ctx.fill();
  } else {
    ctx.strokeStyle = '#2b2230'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(-1, eyeY); ctx.lineTo(4, eyeY); ctx.moveTo(6, eyeY); ctx.lineTo(11, eyeY); ctx.stroke();
  }
  // Cheek + mouth.
  ctx.fillStyle = 'rgba(255,120,130,0.35)';
  ctx.beginPath(); ctx.arc(7, -39, 2.6, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#703c33'; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.arc(6, -38.5, 2, 0.2, Math.PI - 0.2); ctx.stroke();

  // Cap.
  ctx.fillStyle = '#e94f5f';
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(1, -47, 13, Math.PI, Math.PI * 2);
  ctx.lineTo(14, -47);
  ctx.lineTo(14, -44);
  ctx.lineTo(-12, -44);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(11, -45, 10, 4, -0.12, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#fff3d6';
  ctx.beginPath(); ctx.arc(1, -52, 4.2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#e94f5f';
  ctx.beginPath(); ctx.arc(1, -52, 2.4, 0, Math.PI * 2); ctx.fill();

  if (starPower) {
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 0.9;
    const hue = (time * 340) % 360;
    ctx.strokeStyle = `hsl(${hue} 100% 75%)`;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(1, -35, 27, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
}

function drawLimb(ctx, x1, y1, x2, y2, color, boot) {
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2 - 6); ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = 4.5;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2 - 6); ctx.stroke();
  ctx.fillStyle = boot;
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2;
  roundRect(ctx, x2 - 5, y2 - 8, 10, 8, 3); ctx.fill(); ctx.stroke();
}

function drawArm(ctx, x1, y1, x2, y2, color, shade) {
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 6.5;
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.strokeStyle = shade;
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.fillStyle = color;
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 1.8;
  ctx.beginPath(); ctx.arc(x2, y2, 3.4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
}

function eye(ctx, x, y, r = 2) {
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(x, y, r + 1.4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#2b2230';
  ctx.beginPath(); ctx.arc(x + 0.5, y, r, 0, Math.PI * 2); ctx.fill();
}

export function drawEnemy(ctx, e, time) {
  const cx = e.x + e.w / 2;
  const feet = e.y + e.h;
  ctx.save();
  ctx.translate(cx, feet);
  if (e.flash > 0 && Math.floor(time * 24) % 2 === 0) ctx.globalAlpha = 0.6;
  switch (e.type) {
    case 'fungus': {
      const squash = 1 + Math.sin(e.animTime * 7) * 0.05;
      ctx.scale(e.dir || 1, 1);
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.beginPath(); ctx.ellipse(0, 0, 19, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#efd8b0';
      roundRect(ctx, -11, -25 * squash, 22, 25, 8); ctx.fill();
      ctx.strokeStyle = OUTLINE; ctx.lineWidth = 2.5; roundRect(ctx, -11, -25 * squash, 22, 25, 8); ctx.stroke();
      ctx.fillStyle = '#e45151';
      ctx.beginPath();
      ctx.ellipse(0, -28, 25, 16, 0, Math.PI, Math.PI * 2);
      ctx.lineTo(25, -21);
      ctx.lineTo(-25, -21);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff1d8';
      for (const [dx, dy, r] of [[-14, -30, 4], [2, -38, 3.5], [14, -28, 3], [-2, -24, 2.4]]) {
        ctx.beginPath(); ctx.arc(dx, dy, r, 0, Math.PI * 2); ctx.fill();
      }
      eye(ctx, 2, -15, 2.4); eye(ctx, 9, -15, 2);
      ctx.strokeStyle = '#7a3a34'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(6, -10, 2.4, 0.1, Math.PI - 0.1); ctx.stroke();
      ctx.fillStyle = '#8a4a2c';
      ctx.beginPath(); ctx.ellipse(-8, -2, 5, 3, 0, 0, Math.PI * 2); ctx.ellipse(8, -2, 5, 3, 0, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'turtle': {
      ctx.scale(e.dir || 1, 1);
      const roll = e.rolling ? (e.rollSpin || 0) : 0;
      ctx.save();
      ctx.rotate(roll);
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.beginPath(); ctx.ellipse(0, 0, 22, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#5fce88';
      ctx.strokeStyle = OUTLINE; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.ellipse(0, -17, 23, 17, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#2fa865';
      ctx.beginPath(); ctx.ellipse(0, -17, 16, 11, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#baffd0';
      ctx.beginPath(); ctx.arc(-6, -21, 3.4, 0, Math.PI * 2); ctx.arc(6, -14, 3, 0, Math.PI * 2); ctx.fill();
      if (!e.rolling) {
        ctx.fillStyle = '#8be8a8';
        roundRect(ctx, 17, -19, 12, 11, 5); ctx.fill(); ctx.stroke();
        eye(ctx, 24, -15, 1.8);
        ctx.fillStyle = '#68d68a';
        roundRect(ctx, -17, -4, 8, 7, 3); ctx.fill(); ctx.stroke();
        roundRect(ctx, 6, -4, 8, 7, 3); ctx.fill(); ctx.stroke();
      }
      ctx.restore();
      if (e.rolling) {
        ctx.strokeStyle = 'rgba(190,255,220,0.55)';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, -17, 28, 0, Math.PI * 2); ctx.stroke();
      }
      break;
    }
    case 'bat': {
      const flap = Math.sin(time * 12 + e.phase) * 0.5;
      ctx.fillStyle = '#8d5cd6';
      ctx.strokeStyle = OUTLINE; ctx.lineWidth = 2.4;
      ctx.save();
      ctx.rotate(flap * 0.25);
      ctx.beginPath();
      ctx.moveTo(-6, -16);
      ctx.quadraticCurveTo(-30, -32, -34, -10);
      ctx.quadraticCurveTo(-21, -14, -15, -4);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(6, -16);
      ctx.quadraticCurveTo(30, -32, 34, -10);
      ctx.quadraticCurveTo(21, -14, 15, -4);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
      ctx.fillStyle = '#b68cf0';
      ctx.beginPath(); ctx.ellipse(0, -14, 12, 14, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-9, -24); ctx.lineTo(-6, -33); ctx.lineTo(-1, -25); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(9, -24); ctx.lineTo(6, -33); ctx.lineTo(1, -25); ctx.closePath(); ctx.fill(); ctx.stroke();
      eye(ctx, -4, -15, 2); eye(ctx, 4, -15, 2);
      ctx.fillStyle = '#fff2b0'; ctx.beginPath(); ctx.moveTo(-2, -9); ctx.lineTo(0, -6); ctx.lineTo(2, -9); ctx.closePath(); ctx.fill();
      break;
    }
    case 'spiky': {
      ctx.scale(e.dir || 1, 1);
      ctx.fillStyle = '#7b3fa8';
      ctx.strokeStyle = OUTLINE; ctx.lineWidth = 2.4;
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 + Math.PI / 10;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a - 0.18) * 12, -16 + Math.sin(a - 0.18) * 12);
        ctx.lineTo(Math.cos(a) * 23, -16 + Math.sin(a) * 23);
        ctx.lineTo(Math.cos(a + 0.18) * 12, -16 + Math.sin(a + 0.18) * 12);
        ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      ctx.fillStyle = '#b36ae0';
      ctx.beginPath(); ctx.arc(0, -16, 15, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      eye(ctx, 3, -18, 2.3); eye(ctx, 10, -17, 2);
      ctx.strokeStyle = '#4b2165'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(7, -11, 3, 0.1, Math.PI - 0.1); ctx.stroke();
      break;
    }
    case 'bee': {
      const hover = Math.sin(time * 6 + e.phase) * 4;
      ctx.translate(0, hover);
      const flap = Math.sin(time * 35) * 0.5;
      ctx.fillStyle = 'rgba(230,255,255,0.7)';
      ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1.6;
      ctx.save(); ctx.rotate(-0.4 + flap * 0.5);
      ctx.beginPath(); ctx.ellipse(-7, -30, 13, 6, 0.2, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.restore();
      ctx.save(); ctx.rotate(0.4 - flap * 0.5);
      ctx.beginPath(); ctx.ellipse(7, -30, 13, 6, -0.2, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.restore();
      ctx.fillStyle = '#ffd84d';
      ctx.strokeStyle = OUTLINE; ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.ellipse(0, -16, 16, 12, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#4a3a2a';
      ctx.fillRect(-7, -26, 5, 20);
      ctx.fillRect(2, -27, 5, 21);
      ctx.fillStyle = '#4a3a2a';
      ctx.beginPath(); ctx.moveTo(14, -16); ctx.lineTo(23, -13); ctx.lineTo(14, -10); ctx.closePath(); ctx.fill();
      eye(ctx, 9, -18, 2);
      break;
    }
    case 'ghost': {
      const float = Math.sin(time * 2.5 + e.phase) * 5;
      ctx.translate(0, float);
      ctx.globalAlpha = 0.86;
      ctx.fillStyle = '#dfe8ff';
      ctx.strokeStyle = 'rgba(120,140,200,0.7)'; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, -30, 17, Math.PI, 0);
      ctx.lineTo(17, -6);
      for (let i = 0; i < 4; i++) {
        const wx = 17 - i * 8.5;
        ctx.quadraticCurveTo(wx - 4, -12 + (i % 2) * 4, wx - 8.5, -6);
      }
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#7e5bd6';
      ctx.beginPath(); ctx.arc(-6, -32, 3, 0, Math.PI * 2); ctx.arc(6, -32, 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(-6.8, -33, 1.1, 0, Math.PI * 2); ctx.arc(5.2, -33, 1.1, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#8b6cbc'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(0, -25, 3, 0.2, Math.PI - 0.2); ctx.stroke();
      break;
    }
    default:
      break;
  }
  ctx.restore();
}

export function drawBoss(ctx, b, time) {
  const cx = b.x + b.w / 2;
  const feet = b.y + b.h;
  ctx.save();
  ctx.translate(cx, feet);
  if (b.invuln > 0 && Math.floor(time * 20) % 2 === 0) ctx.globalAlpha = 0.55;
  const facing = b.dir || 1;
  ctx.scale(facing, 1);
  const type = b.type;
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 3.5;
  ctx.lineJoin = 'round';
  if (type === 'mushroomKing') {
    const squash = b.state === 'jump' ? 0.94 : 1;
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath(); ctx.ellipse(0, 0, 48, 10, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f0d8ae';
    roundRect(ctx, -34, -72 * squash, 68, 74, 22); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#e04747';
    ctx.beginPath();
    ctx.ellipse(0, -92, 68, 46, 0, Math.PI, Math.PI * 2);
    ctx.lineTo(68, -76); ctx.lineTo(-68, -76); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff0d4';
    for (const [dx, dy, r] of [[-44, -98, 9], [-12, -120, 7], [30, -104, 8], [48, -82, 5], [8, -84, 5], [-36, -74, 5]]) {
      ctx.beginPath(); ctx.arc(dx, dy, r, 0, Math.PI * 2); ctx.fill();
    }
    // Crown.
    ctx.fillStyle = '#ffd24a';
    ctx.beginPath();
    ctx.moveTo(-28, -126); ctx.lineTo(-22, -154); ctx.lineTo(-8, -136); ctx.lineTo(0, -160); ctx.lineTo(11, -136); ctx.lineTo(26, -154); ctx.lineTo(30, -124);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    // Face.
    eye(ctx, -16, -60, 5); eye(ctx, 16, -60, 5);
    ctx.strokeStyle = '#6b3030'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, -46, 14, 0.15, Math.PI - 0.15); ctx.stroke();
    ctx.fillStyle = '#6b3030';
    ctx.beginPath(); ctx.moveTo(-7, -43); ctx.lineTo(0, -35); ctx.lineTo(7, -43); ctx.closePath(); ctx.fill();
    // Arms.
    ctx.strokeStyle = '#e6c99e'; ctx.lineWidth = 12; ctx.lineCap = 'round';
    const armY = b.state === 'jump' ? -70 : -58;
    ctx.beginPath(); ctx.moveTo(-32, -55); ctx.lineTo(-58, armY); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(32, -55); ctx.lineTo(58, armY); ctx.stroke();
  } else if (type === 'crystalGolem') {
    glowCircle(ctx, 0, -70, 90, '#6eefff', 0.24);
    ctx.fillStyle = '#4f8fc4';
    roundRect(ctx, -38, -88, 76, 90, 16); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#80d7ef';
    ctx.beginPath(); ctx.moveTo(-38, -58); ctx.lineTo(-52, -90); ctx.lineTo(-26, -80); ctx.lineTo(-18, -112); ctx.lineTo(0, -88); ctx.lineTo(20, -114); ctx.lineTo(28, -82); ctx.lineTo(52, -94); ctx.lineTo(38, -58); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(190,250,255,0.5)';
    ctx.beginPath(); ctx.moveTo(-18, -112); ctx.lineTo(-8, -76); ctx.lineTo(0, -88); ctx.closePath(); ctx.fill();
    eye(ctx, -16, -50, 5); eye(ctx, 16, -50, 5);
    ctx.fillStyle = '#8ff2ff';
    ctx.fillRect(-12, -32, 24, 5);
    ctx.strokeStyle = '#3b6d9c'; ctx.lineWidth = 14; ctx.lineCap = 'round';
    const armLift = b.state === 'slam' ? -55 : -20;
    ctx.beginPath(); ctx.moveTo(-36, -64); ctx.lineTo(-62, -32 + armLift); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(36, -64); ctx.lineTo(62, -32 + armLift); ctx.stroke();
    ctx.fillStyle = '#b9f6ff';
    ctx.beginPath(); ctx.arc(-62, -32 + armLift, 12, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(62, -32 + armLift, 12, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#2f5877';
    roundRect(ctx, -30, -12, 20, 14, 5); ctx.fill();
    roundRect(ctx, 10, -12, 20, 14, 5); ctx.fill();
  } else if (type === 'shadowOwl') {
    glowCircle(ctx, 0, -70, 100, '#a476ff', 0.22);
    const flap = Math.sin(time * 7) * 0.25;
    ctx.save(); ctx.rotate(flap);
    ctx.fillStyle = '#4c3274';
    ctx.beginPath();
    ctx.moveTo(-20, -80); ctx.quadraticCurveTo(-80, -115, -72, -46); ctx.quadraticCurveTo(-46, -72, -22, -42); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.restore();
    ctx.save(); ctx.rotate(-flap);
    ctx.beginPath();
    ctx.moveTo(20, -80); ctx.quadraticCurveTo(80, -115, 72, -46); ctx.quadraticCurveTo(46, -72, 22, -42); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.restore();
    ctx.fillStyle = '#5e3c8f';
    ctx.beginPath(); ctx.ellipse(0, -62, 40, 50, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#8b6bc0';
    ctx.beginPath(); ctx.ellipse(0, -48, 30, 30, 0, 0, Math.PI * 2); ctx.fill();
    // Ear tufts.
    ctx.fillStyle = '#4c3274';
    ctx.beginPath(); ctx.moveTo(-30, -102); ctx.lineTo(-38, -130); ctx.lineTo(-14, -108); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(30, -102); ctx.lineTo(38, -130); ctx.lineTo(14, -108); ctx.closePath(); ctx.fill(); ctx.stroke();
    // Face disc + eyes.
    ctx.fillStyle = '#d6c6ef';
    ctx.beginPath(); ctx.arc(-16, -72, 16, 0, Math.PI * 2); ctx.arc(16, -72, 16, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffdc5e';
    ctx.beginPath(); ctx.arc(-16, -72, 8, 0, Math.PI * 2); ctx.arc(16, -72, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2b1a3e';
    ctx.beginPath(); ctx.arc(-16, -72, 3.5, 0, Math.PI * 2); ctx.arc(16, -72, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffc94a';
    ctx.beginPath(); ctx.moveTo(-5, -58); ctx.lineTo(0, -46); ctx.lineTo(5, -58); ctx.closePath(); ctx.fill();
    // Talons.
    ctx.strokeStyle = '#e4c48c'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(-12, -14); ctx.lineTo(-16, 0); ctx.moveTo(12, -14); ctx.lineTo(16, 0); ctx.stroke();
  } else if (type === 'titanTurtle') {
    const rolling = b.state === 'roll';
    ctx.rotate(rolling ? (b.rollSpin || 0) : 0);
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath(); ctx.ellipse(0, 0, 60, 12, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#6cc78e';
    ctx.beginPath(); ctx.ellipse(0, -54, 62, 54, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#3e9367';
    ctx.beginPath(); ctx.ellipse(0, -54, 48, 41, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#b9ffd0';
    for (const [dx, dy, r] of [[-24, -62, 7], [8, -76, 6], [28, -54, 5], [-6, -40, 5], [-38, -42, 4], [20, -34, 4]]) {
      ctx.beginPath(); ctx.arc(dx, dy, r, 0, Math.PI * 2); ctx.fill();
    }
    // Spiky rim.
    ctx.fillStyle = '#c8b27a';
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a - 0.1) * 56, -54 + Math.sin(a - 0.1) * 49);
      ctx.lineTo(Math.cos(a) * 70, -54 + Math.sin(a) * 61);
      ctx.lineTo(Math.cos(a + 0.1) * 56, -54 + Math.sin(a + 0.1) * 49);
      ctx.closePath(); ctx.fill();
    }
    if (!rolling) {
      ctx.fillStyle = '#a9e6bb';
      roundRect(ctx, 42, -60, 28, 28, 12); ctx.fill(); ctx.stroke();
      eye(ctx, 58, -52, 3);
      ctx.strokeStyle = '#3c724f'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(54, -44, 5, 0.1, Math.PI - 0.1); ctx.stroke();
      ctx.fillStyle = '#8bdc9f';
      roundRect(ctx, -56, -16, 22, 16, 7); ctx.fill(); ctx.stroke();
      roundRect(ctx, 26, -16, 22, 16, 7); ctx.fill(); ctx.stroke();
    }
  } else if (type === 'crowKing') {
    glowCircle(ctx, 0, -70, 100, '#ff6c8c', 0.18);
    // Cape.
    ctx.fillStyle = '#2a1738';
    ctx.beginPath();
    ctx.moveTo(-38, -80); ctx.quadraticCurveTo(-86, -40, -60, 0); ctx.lineTo(0, -8); ctx.lineTo(60, 0); ctx.quadraticCurveTo(86, -40, 38, -80); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#3b2049';
    ctx.beginPath(); ctx.ellipse(0, -62, 38, 46, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // Wings.
    ctx.fillStyle = '#201328';
    ctx.beginPath();
    ctx.moveTo(-30, -76); ctx.lineTo(-84, -48); ctx.lineTo(-70, -18); ctx.lineTo(-28, -42); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(30, -76); ctx.lineTo(84, -48); ctx.lineTo(70, -18); ctx.lineTo(28, -42); ctx.closePath(); ctx.fill(); ctx.stroke();
    // Head.
    ctx.fillStyle = '#2b1933';
    ctx.beginPath(); ctx.arc(0, -96, 28, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffce4a';
    ctx.beginPath(); ctx.moveTo(22, -98); ctx.lineTo(46, -90); ctx.lineTo(22, -82); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ff5d72';
    ctx.beginPath(); ctx.arc(8, -102, 6, 0, Math.PI * 2); ctx.arc(18, -102, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(9, -102, 2, 0, Math.PI * 2); ctx.arc(18, -102, 1.6, 0, Math.PI * 2); ctx.fill();
    // Crown.
    ctx.fillStyle = '#ffcc3d';
    ctx.beginPath();
    ctx.moveTo(-24, -118); ctx.lineTo(-18, -146); ctx.lineTo(-5, -128); ctx.lineTo(4, -152); ctx.lineTo(14, -128); ctx.lineTo(27, -146); ctx.lineTo(28, -116);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ff5d72';
    ctx.beginPath(); ctx.arc(4, -134, 3.5, 0, Math.PI * 2); ctx.fill();
    // Claws.
    ctx.strokeStyle = '#e9c58b'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(-18, -18); ctx.lineTo(-22, 0); ctx.moveTo(18, -18); ctx.lineTo(22, 0); ctx.stroke();
  }
  ctx.restore();
}

export function drawProjectile(ctx, p, time) {
  ctx.save();
  ctx.translate(p.x + p.w / 2, p.y + p.h / 2);
  if (p.kind === 'crystal') {
    ctx.rotate(time * 5);
    ctx.fillStyle = '#8ef7ff';
    ctx.strokeStyle = '#2b7e99'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(10, 0); ctx.lineTo(0, 12); ctx.lineTo(-10, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
  } else if (p.kind === 'feather') {
    ctx.rotate(Math.sin(time * 6) * 0.4);
    ctx.fillStyle = '#b18ae0';
    ctx.beginPath(); ctx.ellipse(0, 0, 13, 5, -0.5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#5d3b88'; ctx.lineWidth = 1.5; ctx.stroke();
  } else if (p.kind === 'spike') {
    ctx.fillStyle = '#ffb45c';
    ctx.strokeStyle = '#8b3e28'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, -20); ctx.lineTo(9, 8); ctx.lineTo(0, 16); ctx.lineTo(-9, 8); ctx.closePath(); ctx.fill(); ctx.stroke();
  } else {
    glowCircle(ctx, 0, 0, 26, p.kind === 'shadow' ? '#ff6c8c' : '#a8ecff', 0.7);
    ctx.fillStyle = p.kind === 'shadow' ? '#55203c' : '#4a87d8';
    ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = p.kind === 'shadow' ? '#ffb0c0' : '#d8fbff'; ctx.lineWidth = 2; ctx.stroke();
  }
  ctx.restore();
}

export function drawGoal(ctx, goal, time, open = true) {
  const x = goal.x;
  const base = goal.feetRow * TILE;
  const h = TILE * 3.4;
  ctx.save();
  ctx.translate(x, base);
  if (!open) {
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = '#4a3b46';
    roundRect(ctx, -30, -h, 60, h, 16); ctx.fill();
    ctx.strokeStyle = '#7d6b79'; ctx.lineWidth = 4;
    ctx.stroke();
    ctx.fillStyle = '#2b2230';
    ctx.beginPath(); ctx.arc(-11, -h / 2 - 8, 9, 0, Math.PI * 2); ctx.arc(11, -h / 2 - 8, 9, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    return;
  }
  glowCircle(ctx, 0, -h / 2, 90, '#9ef7ff', 0.25 + Math.sin(time * 3) * 0.06);
  const rings = 3;
  for (let i = 0; i < rings; i++) {
    const phase = time * 1.4 + i * 1.6;
    const r = 24 + i * 12 + Math.sin(phase) * 3;
    ctx.strokeStyle = `hsla(${(time * 80 + i * 40) % 360} 100% 75% / ${0.5 - i * 0.1})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(0, -h / 2, r, r * 0.9, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(117,244,255,0.18)';
  ctx.beginPath(); ctx.ellipse(0, -h / 2, 34, 54, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#d8fbff'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.ellipse(0, -h / 2, 26, 44, 0, 0, Math.PI * 2); ctx.stroke();
  starPath(ctx, 0, -h / 2, 13, 6, 5, time * 2);
  ctx.fillStyle = '#ffe86b'; ctx.fill();
  // Spinning sparkles.
  for (let i = 0; i < 5; i++) {
    const a = time * 2 + (i / 5) * Math.PI * 2;
    const sx = Math.cos(a) * 38;
    const sy = -h / 2 + Math.sin(a) * 58;
    ctx.fillStyle = `rgba(255,255,255,${0.4 + 0.4 * Math.sin(a * 2)})`;
    ctx.beginPath(); ctx.arc(sx, sy, 2.5, 0, Math.PI * 2); ctx.fill();
  }
  // Flag pole base.
  ctx.fillStyle = '#6b4a3b';
  roundRect(ctx, -5, -18, 10, 18, 3); ctx.fill();
  ctx.restore();
}

export function drawCheckpoint(ctx, cp, time) {
  const x = cp.x;
  const base = cp.feetRow * TILE;
  ctx.save();
  ctx.translate(x, base);
  const h = 82;
  ctx.fillStyle = '#5b4435';
  ctx.fillRect(-3, -h, 6, h);
  if (cp.active) {
    glowCircle(ctx, 0, -h + 16, 36, '#ffe56b', 0.4);
    const wave = Math.sin(time * 4) * 3;
    ctx.fillStyle = '#ffd94d';
    ctx.beginPath();
    ctx.moveTo(3, -h + 2); ctx.quadraticCurveTo(30, -h + 6 + wave, 42, -h + 14); ctx.lineTo(3, -h + 27); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff6c3';
    starPath(ctx, 9, -h + 14, 5, 2.3); ctx.fill();
  } else {
    ctx.fillStyle = '#7b6a5b';
    ctx.beginPath();
    ctx.moveTo(3, -h + 2); ctx.lineTo(32, -h + 10); ctx.lineTo(3, -h + 22); ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = cp.active ? '#8be36f' : '#5a7d58';
  ctx.beginPath(); ctx.ellipse(0, -5, 14, 6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

export function drawStarGate(ctx, gate, time, stars, required) {
  const x = gate.x;
  const base = gate.feetRow * TILE;
  const h = 140;
  const open = stars >= required;
  ctx.save();
  ctx.translate(x, base);
  if (open) {
    glowCircle(ctx, 0, -h / 2, 100, '#ffe05c', 0.35);
    const ring = ctx.createLinearGradient(-40, -h, 40, 0);
    ring.addColorStop(0, '#ffef8a');
    ring.addColorStop(0.5, '#ff9de0');
    ring.addColorStop(1, '#8ef7ff');
    ctx.strokeStyle = ring;
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.ellipse(0, -h / 2, 44, 66, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,246,181,0.16)';
    ctx.beginPath(); ctx.ellipse(0, -h / 2, 39, 61, 0, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < 8; i++) {
      const a = time * 2 + (i / 8) * Math.PI * 2;
      ctx.fillStyle = `rgba(255,255,255,${0.35 + 0.4 * Math.sin(a * 2)})`;
      ctx.beginPath(); ctx.arc(Math.cos(a) * 49, -h / 2 + Math.sin(a) * 70, 3, 0, Math.PI * 2); ctx.fill();
    }
  } else {
    ctx.fillStyle = '#5a4a58';
    roundRect(ctx, -48, -h, 16, h, 6); ctx.fill();
    roundRect(ctx, 32, -h, 16, h, 6); ctx.fill();
    ctx.beginPath(); ctx.arc(0, -h, 49, Math.PI, 0); ctx.strokeStyle = '#5a4a58'; ctx.lineWidth = 16; ctx.stroke();
    ctx.fillStyle = 'rgba(25,18,30,0.55)';
    ctx.beginPath(); ctx.ellipse(0, -h / 2 + 12, 34, 52, 0, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < required; i++) {
      const sx = -26 + i * 26;
      ctx.fillStyle = i < stars ? '#ffdd55' : '#3a2f3c';
      starPath(ctx, sx, -76, 9, 4); ctx.fill();
      ctx.strokeStyle = i < stars ? '#9a6a12' : '#5f4d61'; ctx.lineWidth = 1.5; ctx.stroke();
    }
    ctx.fillStyle = '#d8c7da';
    ctx.font = 'bold 11px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${stars}/${required}`, 0, -46);
  }
  ctx.restore();
}

export function drawReturnPortal(ctx, portal, time) {
  const x = portal.x;
  const base = portal.feetRow * TILE;
  ctx.save();
  ctx.translate(x, base);
  glowCircle(ctx, 0, -60, 70, '#8df7ff', 0.45);
  ctx.strokeStyle = '#d8fbff'; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.ellipse(0, -60, 28, 44, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = 'rgba(141,247,255,0.65)'; ctx.lineWidth = 2;
  for (let i = 0; i < 3; i++) {
    const a = time * 1.4 + i * 2;
    ctx.beginPath();
    ctx.ellipse(0, -60, 20 + i * 6, 34 + i * 5, 0, a, a + Math.PI * 1.2);
    ctx.stroke();
  }
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 12px "Trebuchet MS", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('VOLTAR', 0, -112);
  ctx.restore();
}

export function drawParticle(ctx, p) {
  ctx.save();
  ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
  if (p.type === 'confetti') {
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot || 0);
    ctx.fillStyle = p.color;
    ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
  } else if (p.type === 'star') {
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot || 0);
    ctx.fillStyle = p.color;
    starPath(ctx, 0, 0, p.size, p.size * 0.45);
    ctx.fill();
  } else if (p.type === 'spark') {
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
  } else if (p.type === 'ring') {
    ctx.strokeStyle = p.color;
    ctx.lineWidth = Math.max(1, p.size * 0.18);
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.stroke();
  } else if (p.type === 'text') {
    ctx.fillStyle = p.color;
    ctx.font = `bold ${p.size}px "Trebuchet MS", sans-serif`;
    ctx.textAlign = 'center';
    ctx.strokeStyle = 'rgba(40,25,35,0.8)';
    ctx.lineWidth = 3;
    ctx.strokeText(p.text, p.x, p.y);
    ctx.fillText(p.text, p.x, p.y);
  } else {
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot || 0);
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.ellipse(0, 0, p.size, p.size * 0.6, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

export function drawCloudPlatform(ctx, x, y, w, time) {
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  for (let i = 0; i < w; i += 38) {
    ctx.beginPath();
    ctx.arc(x + i + 20, y + Math.sin(time * 1.2 + i) * 2, 24, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(150,190,230,0.4)';
  ctx.fillRect(x, y + 16, w, 8);
  ctx.restore();
}

export function drawBossWarning(ctx, x, y, time) {
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha = 0.65 + 0.25 * Math.sin(time * 4);
  ctx.strokeStyle = '#ff5d72';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#ff5d72';
  ctx.font = 'bold 18px "Trebuchet MS", sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('!', 0, 1);
  ctx.restore();
}

export { starPath, heartPath, glowCircle };

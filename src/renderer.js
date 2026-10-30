import { TILE, T, clamp } from './config.js';
import {
  drawBackground, drawWorldDecor, drawTile, drawCoin, drawStarShard, drawHeartItem,
  drawStarPower, drawHero, drawEnemy, drawBoss, drawProjectile, drawGoal, drawCheckpoint,
  drawStarGate, drawReturnPortal, drawParticle, drawBossWarning, glowCircle,
} from './art.js';

export function installRenderer(Game) {
  Game.prototype.render = function render() {
    const ctx = this.ctx;
    const dpr = this.dpr || 1;
    const scale = this.scale || 1;
    const viewW = this.viewW;
    const viewH = this.viewH;
    const time = this.time;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0d1220';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);

    if (!this.level) return;
    const theme = this.level.themeData;
    const camX = this.camera.x;
    const camY = this.camera.y;
    drawBackground(ctx, theme, camX, camY, viewW, viewH, time);

    const shake = this.shake || 0;
    const shakeX = shake > 0 ? Math.sin(time * 73) * shake * 0.55 : 0;
    const shakeY = shake > 0 ? Math.cos(time * 61) * shake * 0.4 : 0;
    const ox = -camX + shakeX;
    const oy = -camY + shakeY;

    ctx.save();
    ctx.translate(ox, oy);

    drawWorldDecor(ctx, this.level, camX, viewW, time, false);
    this.drawTiles(ctx, camX, camY, viewW, viewH, time);
    this.drawLevelFurniture(ctx, time);
    this.drawPickups(ctx, time);
    this.drawActors(ctx, time);
    drawWorldDecor(ctx, this.level, camX, viewW, time, true);
    this.drawAmbient(ctx, time);
    this.drawParticles(ctx, time);

    ctx.restore();

    this.drawAtmosphere(ctx, theme, viewW, viewH, time);
    this.drawScreenFx(ctx, viewW, viewH);
  };

  Game.prototype.drawTiles = function drawTiles(ctx, camX, camY, viewW, viewH, time) {
    const level = this.level;
    const c0 = Math.max(0, Math.floor(camX / TILE) - 1);
    const c1 = Math.min(level.width - 1, Math.floor((camX + viewW) / TILE) + 1);
    const r0 = Math.max(0, Math.floor(camY / TILE) - 1);
    const r1 = Math.min(level.height - 1, Math.floor((camY + viewH) / TILE) + 1);
    for (let row = r0; row <= r1; row++) {
      for (let col = c0; col <= c1; col++) {
        if (level.tileAt(col, row) === T.EMPTY) continue;
        const bumpLeft = this.bumps?.get(`${col},${row}`) || 0;
        const bump = bumpLeft > 0 ? Math.sin(Math.min(1, bumpLeft / 0.26) * Math.PI) * 9 : 0;
        drawTile(ctx, level, col, row, time, bump);
      }
    }
  };

  // A generous viewport test: visible entities skip all of their path work.
  Game.prototype.inView = function inView(x, y, marginX = 120, marginY = 160) {
    return x > this.camera.x - marginX
      && x < this.camera.x + this.viewW + marginX
      && y > this.camera.y - marginY
      && y < this.camera.y + this.viewH + marginY;
  };

  Game.prototype.drawLevelFurniture = function drawLevelFurniture(ctx, time) {
    const level = this.level;
    if (level.bossTrigger != null && this.boss && !this.boss.active && !this.boss.defeated) {
      const x = Math.max(this.camera.x + this.viewW * 0.82, level.bossTrigger + 36);
      drawBossWarning(ctx, x, this.player.y + 22, time);
    }
    if (level.gate && this.inView(level.gate.x, level.gate.y, 220, 220)) {
      drawStarGate(ctx, level.gate, time, this.levelStars, level.gate.required);
    }
    for (const cp of this.checkpointEntities) {
      if (this.inView(cp.x, cp.y, 180, 220)) drawCheckpoint(ctx, cp, time);
    }
    if (level.returnPortal && this.inView(level.returnPortal.x, level.returnPortal.y, 220, 220)) {
      drawReturnPortal(ctx, level.returnPortal, time);
    }
    if (level.goal && this.inView(level.goal.x, level.goal.y, 260, 260)) {
      drawGoal(ctx, level.goal, time, this.goalOpen);
    }
  };

  Game.prototype.drawPickups = function drawPickups(ctx, time) {
    for (const coin of this.coinEntities) {
      if (!coin.collected && this.inView(coin.x, coin.y, 40, 80)) {
        drawCoin(ctx, coin.x, coin.y, time, coin.phase);
      }
    }
    for (const star of this.starEntities) {
      if (!star.collected && this.inView(star.x, star.y, 80, 100)) {
        drawStarShard(ctx, star.x, star.y, time, star.phase);
      }
    }
    for (const item of this.itemEntities) {
      if (item.dead) continue;
      const ix = item.x + item.w / 2;
      const iy = item.y + item.h / 2;
      if (!this.inView(ix, iy, 60, 100)) continue;
      if (item.type === 'heart') drawHeartItem(ctx, ix, iy, time);
      else drawStarPower(ctx, ix, iy, time);
    }
  };

  Game.prototype.drawActors = function drawActors(ctx, time) {
    const theme = this.level.themeData;
    for (const e of this.enemies) {
      if (e.alive && this.inView(e.x + e.w / 2, e.y + e.h / 2, 120, 160)) drawEnemy(ctx, e, time);
    }
    if (this.boss && !this.boss.dead) drawBoss(ctx, this.boss, time);
    for (const proj of this.projectiles) {
      if (this.inView(proj.x, proj.y, 80, 80)) drawProjectile(ctx, proj, time);
    }
    if (this.player) drawHero(ctx, this.player, time, theme);
  };

  Game.prototype.drawParticles = function drawParticles(ctx, time) {
    for (const p of this.particles) {
      drawParticle(ctx, p);
      if (p.type === 'ring') {
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.life / p.maxLife) * 0.7;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, p.size, p.size * 0.42, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      } else if (p.type === 'text') {
        ctx.save();
        ctx.globalAlpha = clamp(p.life / p.maxLife, 0, 1);
        ctx.font = `900 ${p.size || 16}px "Trebuchet MS", "Segoe UI", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = 4;
        ctx.strokeStyle = 'rgba(38,24,40,0.8)';
        ctx.strokeText(p.text, p.x, p.y);
        ctx.fillStyle = p.color;
        ctx.fillText(p.text, p.x, p.y);
        ctx.restore();
      }
    }
  };

  Game.prototype.drawAmbient = function drawAmbient(ctx, time) {
    const kind = this.level.themeData.ambient;
    if (kind === 'clouds') return;
    for (const a of this.ambient) {
      const twinkle = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(time * 2 + a.phase));
      const colors = {
        spores: '#8ef7ff',
        fireflies: '#eaff9a',
        snow: '#ffffff',
        embers: '#ff9b5c',
      };
      const color = a.color || colors[kind] || '#ffffff';
      const size = a.size;
      if (kind === 'embers') {
        ctx.globalAlpha = twinkle * 0.85;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(a.x, a.y, size, 0, Math.PI * 2);
        ctx.fill();
      } else {
        glowCircle(ctx, a.x, a.y, size * 6, color, twinkle * 0.34);
        ctx.globalAlpha = twinkle;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(a.x, a.y, size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  };

  Game.prototype.drawAtmosphere = function drawAtmosphere(ctx, theme, viewW, viewH, time) {
    if (theme.id === 'mountain') {
      const haze = ctx.createLinearGradient(0, 0, 0, viewH);
      haze.addColorStop(0, 'rgba(255,230,205,0.08)');
      haze.addColorStop(0.7, 'rgba(255,220,190,0.02)');
      haze.addColorStop(1, 'rgba(255,255,255,0.08)');
      ctx.fillStyle = haze;
      ctx.fillRect(0, 0, viewW, viewH);
    } else if (theme.dark) {
      const beam = ctx.createRadialGradient(
        viewW * 0.5, viewH * 0.58, viewW * 0.08,
        viewW * 0.5, viewH * 0.6, viewW * 0.72,
      );
      beam.addColorStop(0, 'rgba(255,250,220,0.04)');
      beam.addColorStop(1, 'rgba(0,0,0,0.16)');
      ctx.fillStyle = beam;
      ctx.fillRect(0, 0, viewW, viewH);
    }
  };

  Game.prototype.drawScreenFx = function drawScreenFx(ctx, viewW, viewH) {
    if (this.hitFlash > 0) {
      ctx.fillStyle = `rgba(255,64,88,${Math.min(0.32, this.hitFlash * 0.9)})`;
      ctx.fillRect(0, 0, viewW, viewH);
    }
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255,250,230,${Math.min(0.75, this.flash * 1.2)})`;
      ctx.fillRect(0, 0, viewW, viewH);
    }
    const vignette = ctx.createRadialGradient(
      viewW / 2, viewH / 2, Math.min(viewW, viewH) * 0.35,
      viewW / 2, viewH / 2, Math.max(viewW, viewH) * 0.72,
    );
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(7,4,14,0.28)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, viewW, viewH);
  };
}

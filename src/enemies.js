import { TILE, T, clamp, approach } from './config.js';
import { moveX, moveY, solidBelow } from './physics.js';

const GRAVITY = 2300;
const MAX_FALL = 1100;

const ENEMY_DEFS = {
  fungus: { w: 38, h: 34, speed: 52, flying: false, noStomp: false },
  turtle: { w: 44, h: 36, speed: 44, flying: false, noStomp: false },
  spiky: { w: 38, h: 34, speed: 66, flying: false, noStomp: true },
  bat: { w: 42, h: 30, speed: 65, flying: true, noStomp: false },
  bee: { w: 36, h: 32, speed: 60, flying: true, noStomp: false },
  ghost: { w: 38, h: 44, speed: 36, flying: true, noStomp: true },
};

export function installEnemies(Game) {
  Game.prototype.makeEnemy = function makeEnemy(spawn) {
    const def = ENEMY_DEFS[spawn.type] || ENEMY_DEFS.fungus;
    const w = def.w;
    const h = def.h;
    const flying = def.flying;
    const feet = spawn.feetRow * TILE;
    const x = spawn.x - w / 2;
    const y = flying ? feet - h : feet - h;
    const dir = this.rng() < 0.5 ? -1 : 1;
    return {
      type: spawn.type, x, y, w, h, vx: dir * (spawn.speed || def.speed), vy: 0,
      dir, speed: spawn.speed || def.speed, flying, noStomp: Boolean(def.noStomp || spawn.noStomp),
      onGround: !flying, alive: true, animTime: this.rng() * 5, phase: this.rng() * 9,
      baseY: y, startX: x, startY: y, dead: false, flash: 0, minion: Boolean(spawn.minion),
      state: 'walk', timer: 1.4 + this.rng() * 1.6, dashTimer: 1.2 + this.rng() * 1.8,
      dashDir: dir, rolling: false, rollTimer: 0, rollCooldown: 1.2 + this.rng(), rollSpin: 0,
      swoopTimer: 1.2 + this.rng() * 1.8, swoopY: 0,
    };
  };

  Game.prototype.updateEnemies = function updateEnemies(dt) {
    const p = this.player;
    const playerCX = p.x + p.w / 2;
    const playerCY = p.y + p.h / 2;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      e.animTime += dt;
      e.flash = Math.max(0, e.flash - dt * 5);
      const ecx = e.x + e.w / 2;
      if (!e.flying) {
        e.vy = Math.min(e.vy + GRAVITY * dt, MAX_FALL);
        if (e.type === 'turtle') {
          e.rollCooldown = Math.max(0, e.rollCooldown - dt);
          if (e.rolling) {
            e.rollTimer -= dt;
            e.rollSpin += Math.sign(e.vx || 1) * dt * 13;
            e.vx = e.dir * 265;
            if (e.rollTimer <= 0) {
              e.rolling = false;
              e.rollCooldown = 2.8;
              e.vx = e.dir * 44;
            }
          } else if (e.rollCooldown <= 0 && Math.abs(playerCX - ecx) < 250 && Math.abs(playerCY - (e.y + e.h / 2)) < 130) {
            e.rolling = true;
            e.rollTimer = 1.7;
            e.dir = playerCX < ecx ? -1 : 1;
            e.vx = e.dir * 265;
            this.shockwave(ecx, e.y + e.h, '#9bffcf');
          } else {
            e.vx = e.dir * e.speed;
          }
        } else {
          e.vx = e.dir * e.speed;
        }
        const hitWall = moveX(e, e.vx * dt, this.level);
        if (hitWall) {
          e.dir *= -1;
          if (e.type === 'turtle' && e.rolling) {
            e.rolling = false;
            e.rollCooldown = 2.8;
          }
        }
        if (!e.rolling) {
          const probeX = e.dir > 0 ? e.x + e.w + 3 : e.x - 11;
          if (e.onGround && !solidBelow(this.level, probeX, e.y + e.h, 8)) {
            e.dir *= -1;
          }
        }
        const landed = moveY(e, e.vy * dt, this.level);
        e.onGround = landed.landed;
        if (landed.landed) e.vy = 0;
        if (e.y > this.level.pixelHeight + 100) e.alive = false;
      } else {
        if (e.type === 'bat') {
          e.swoopTimer -= dt;
          const near = Math.abs(playerCX - ecx) < 260 && Math.abs(playerCY - (e.y + e.h / 2)) < 260;
          if (near && e.swoopTimer <= 0) {
            e.swoopTimer = 2.5;
            e.state = 'swoop';
            e.timer = 1.1;
          }
          if (e.state === 'swoop') {
            e.timer -= dt;
            e.y = approach(e.y, playerCY - e.h / 2, 220 * dt);
            e.x += (playerCX < ecx ? -1 : 1) * 74 * dt;
            e.vx = (playerCX < ecx ? -1 : 1) * 50;
            if (e.timer <= 0) e.state = 'fly';
          } else {
            e.x += e.vx * dt;
            if (e.x < e.startX - 100 || e.x > e.startX + 100) e.vx *= -1;
            e.y = e.baseY + Math.sin(e.animTime * 2.2 + e.phase) * 22;
          }
        } else if (e.type === 'bee') {
          e.dashTimer -= dt;
          if (e.state === 'dash') {
            e.timer -= dt;
            e.x += e.dashDir * 235 * dt;
            e.y += (playerCY - 160 - e.y) * 1.4 * dt;
            if (e.timer <= 0) {
              e.state = 'hover';
              e.dashTimer = 2.2 + this.rng() * 1.4;
            }
          } else {
            e.x = e.startX + Math.sin(e.animTime * 1.2 + e.phase) * 60;
            e.y = e.baseY + Math.sin(e.animTime * 3.4 + e.phase) * 16;
            if (e.dashTimer <= 0 && Math.abs(playerCX - ecx) < 330) {
              e.state = 'dash';
              e.timer = 0.55;
              e.dashDir = playerCX < ecx ? -1 : 1;
            }
          }
        } else if (e.type === 'ghost') {
          const dx = playerCX - ecx;
          const dy = playerCY - (e.y + e.h / 2);
          const dist = Math.hypot(dx, dy) || 1;
          e.x += (dx / dist) * e.speed * dt;
          e.y += (dy / dist) * e.speed * 0.7 * dt + Math.sin(e.animTime * 2 + e.phase) * 8 * dt;
          e.x = clamp(e.x, 10, this.level.pixelWidth - e.w - 10);
          e.y = clamp(e.y, 20, this.level.pixelHeight - e.h - 20);
        }
      }
      e.dir = e.dir || 1;
    }
    this.enemies = this.enemies.filter((e) => e.alive);
  };

  Game.prototype.stompEnemy = function stompEnemy(e) {
    const p = this.player;
    const ecx = e.x + e.w / 2;
    this.combo = Math.min(8, this.combo + 1);
    const points = 100 * Math.pow(2, Math.max(0, this.combo - 1));
    this.addScore(points);
    this.stats.enemies++;
    this.floatingText(`+${points}`, ecx, e.y - 6, '#fff2a6', 16);
    this.burst(ecx, e.y + e.h / 2, {
      count: 14, colors: ['#ffffff', '#ffe672', '#ffb0c0', '#9bffcf'], speed: 210,
      size: 3.8, life: 0.65, type: 'star', gravity: 500,
    });
    this.shockwave(ecx, e.y + e.h, '#ffe672');
    this.audio.sfx('stomp');
    this.shake = Math.max(this.shake, 4);
    e.alive = false;
    p.vy = (this.input.jumpHeld ? -780 : -610) * (p.starPower > 0 ? 1.05 : 1);
    p.onGround = false;
    p.squash = 0.8;
    this.emitHud();
  };

  Game.prototype.killEnemy = function killEnemy(e, byStar = false) {
    if (!e.alive) return;
    e.alive = false;
    const ecx = e.x + e.w / 2;
    this.stats.enemies++;
    this.addScore(byStar ? 200 : 100);
    this.burst(ecx, e.y + e.h / 2, {
      count: 15, colors: byStar ? ['#ffe672', '#ff8ac4', '#8df7ff', '#ffffff'] : ['#ffffff', '#ffd8a8', '#9bffcf'],
      speed: 220, size: 4, life: 0.65, type: 'star', gravity: 450,
    });
    this.audio.sfx(byStar ? 'star' : 'stomp');
  };
}

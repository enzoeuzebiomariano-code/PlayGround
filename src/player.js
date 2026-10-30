import { TILE, T, HAZARD_TILES, clamp, approach } from './config.js';
import { moveX, moveY } from './physics.js';

const PLAYER_SPEED = 275;
const RUN_SPEED = 410;
const JUMP_SPEED = 890;
const GRAVITY = 2380;
const MAX_FALL = 1200;

export function installPlayer(Game) {
  Game.prototype.update = function update(dt) {
    dt = Math.min(dt, 0.05);
    this.time += dt;
    if (this.state === 'title') {
      this.updateTitle(dt);
      return;
    }
    if (this.state === 'playing') {
      this.updatePlaying(dt);
      return;
    }
    if (this.state === 'clear') {
      this.updateParticles(dt);
      this.updateAmbient(dt);
      this.updateCamera(dt);
      this.shake = Math.max(0, this.shake - dt * 30);
      this.clearTimer -= dt;
      if (this.clearTimer <= 0 && this.pendingClear) {
        const data = this.pendingClear;
        this.pendingClear = null;
        this.callbacks.onLevelClear?.(data);
      }
      return;
    }
    if (this.state === 'victory') {
      this.updateParticles(dt);
      this.updateAmbient(dt);
      this.victoryTimer -= dt;
      if (this.rng() < dt * 11) {
        this.burst(this.camera.x + this.rng() * this.viewW, this.camera.y + this.rng() * this.viewH * 0.7, {
          count: 5, colors: ['#ffe672', '#ff8ac4', '#8df7ff', '#9bffcf'], speed: 160,
          size: 4, life: 2, type: 'confetti', gravity: 300, spin: true,
        });
      }
      if (this.victoryTimer <= 0 && this.pendingVictory) {
        const data = this.pendingVictory;
        this.pendingVictory = null;
        this.callbacks.onVictory?.(data);
      }
      return;
    }
  };

  Game.prototype.updateTitle = function updateTitle(dt) {
    const p = this.player;
    if (!p) return;
    p.animTime += dt;
    p.squash = approach(p.squash, 0, dt * 5);
    p.onGround = true;
    p.vx = 0;
    if (this.rng() < dt * 2.2) {
      this.burst(p.x + p.w / 2 + (this.rng() - 0.5) * 30, p.y + p.h, {
        count: 1, colors: ['#e6d6b8', '#d9c7a6'], speed: 20, size: 2.2,
        life: 0.8, type: 'spark', gravity: 40,
      });
    }
    this.updateParticles(dt);
    this.updateAmbient(dt);
    this.updateCamera(dt);
  };

  Game.prototype.updatePlaying = function updatePlaying(dt) {
    this.warpCooldown = Math.max(0, this.warpCooldown - dt);
    this.gateCooldown = Math.max(0, this.gateCooldown - dt);
    this.pitCooldown = Math.max(0, this.pitCooldown - dt);
    this.hitFlash = Math.max(0, this.hitFlash - dt * 2.5);
    this.flash = Math.max(0, this.flash - dt * 1.6);
    this.updateBumps(dt);
    this.updatePlayer(dt);
    if (this.state !== 'playing') return;
    this.updateEnemies(dt);
    this.updateBoss(dt);
    this.updateProjectiles(dt);
    this.updateItems(dt);
    this.updateInteractions(dt);
    this.updateParticles(dt);
    this.updateAmbient(dt);
    this.updateCamera(dt);
    if (this.player.onGround) this.combo = 0;
  };

  Game.prototype.updateBumps = function updateBumps(dt) {
    if (!this.bumps) return;
    for (const [key, value] of this.bumps) {
      const next = value - dt;
      if (next <= 0) this.bumps.delete(key);
      else this.bumps.set(key, next);
    }
  };

  Game.prototype.updatePlayer = function updatePlayer(dt) {
    const p = this.player;
    if (!p) return;
    p.prevY = p.y;
    p.animTime += dt;
    p.invuln = Math.max(0, p.invuln - dt);
    p.hurtTimer = Math.max(0, p.hurtTimer - dt);
    p.squash = approach(p.squash, 0, dt * 5.2);
    if (p.starPower > 0) {
      p.starPower = Math.max(0, p.starPower - dt);
      p.starTrail = (p.starTrail || 0) - dt;
      if (p.starTrail <= 0) {
        p.starTrail = 0.06;
        const hue = (this.time * 320) % 360;
        this.burst(p.x + p.w / 2 + (this.rng() - 0.5) * 22, p.y + p.h * 0.6, {
          count: 2, colors: [`hsl(${hue} 100% 70%)`, '#fff3a1'], speed: 35, size: 3.4, life: 0.45, type: 'star', gravity: 20,
        });
      }
    }

    const axis = this.input.axis;
    const running = this.input.run;
    const maxSpeed = (running ? RUN_SPEED : PLAYER_SPEED) * (p.starPower > 0 ? 1.12 : 1);
    const accel = p.onGround ? (running ? 3300 : 2600) : 2050;
    if (Math.abs(axis) > 0.08) {
      const target = clamp(axis, -1, 1) * maxSpeed;
      p.vx = approach(p.vx, target, accel * dt);
      if (axis > 0.12) p.facing = 1;
      else if (axis < -0.12) p.facing = -1;
      if (p.onGround && Math.abs(p.vx) > 120 && Math.floor(p.animTime * 14) % 3 === 0 && this.rng() < 0.16) {
        this.burst(p.x + p.w / 2 - p.facing * 12, p.y + p.h - 2, {
          count: 1, colors: ['#e8d7b8', '#cbb68e'], speed: 22, size: 2.4, life: 0.35, type: 'spark', gravity: 30,
        });
      }
    } else {
      p.vx = approach(p.vx, 0, (p.onGround ? 2900 : 650) * dt);
    }

    if (this.input.consumeJump()) p.jumpBuffer = 0.14;
    p.jumpBuffer = Math.max(0, p.jumpBuffer - dt);
    if (p.onGround) p.coyote = 0.11;
    else p.coyote = Math.max(0, p.coyote - dt);

    if (p.jumpBuffer > 0 && p.coyote > 0) {
      p.vy = -JUMP_SPEED;
      p.onGround = false;
      p.coyote = 0;
      p.jumpBuffer = 0;
      p.squash = -0.22;
      this.audio.sfx('jump');
      this.burst(p.x + p.w / 2, p.y + p.h, {
        count: 5, colors: ['#f2e2c4', '#d7c29b', '#ffffff'], speed: 60, size: 3.4, life: 0.4, type: 'spark', gravity: 80,
      });
    }

    if (!this.input.jumpHeld && p.vy < -230) p.vy += GRAVITY * 1.35 * dt;
    p.vy = Math.min(p.vy + GRAVITY * dt, MAX_FALL);
    if (p.starPower > 0) p.vy = Math.min(p.vy, MAX_FALL * 0.92);

    const wasGround = p.onGround;
    const fallSpeed = p.vy;
    let bounceTile = false;
    let landed = false;
    const movedX = moveX(p, p.vx * dt, this.level);
    if (movedX) p.vx = 0;
    const movedY = moveY(p, p.vy * dt, this.level, {
      onCeiling: (tile, col, row) => {
        if (tile === T.QUESTION || tile === T.BRICK) this.bumpBlock(col, row);
      },
      onLand: (tile) => {
        if (tile === T.BOUNCE) bounceTile = true;
      },
    });
    if (movedY.landed) {
      landed = true;
      p.onGround = true;
      if (!wasGround) {
        p.squash = 0.95;
        this.audio.sfx('land');
        this.burst(p.x + p.w / 2, p.y + p.h, {
          count: 7, colors: ['#efe0c4', '#d8c5a2', '#ffffff'], speed: 80, size: 3.6, life: 0.45, type: 'spark', gravity: 120,
        });
        if (fallSpeed > 700) this.shake = Math.max(this.shake, 3);
      }
      if (bounceTile) {
        p.vy = -1280;
        p.onGround = false;
        p.squash = 0.8;
        this.audio.sfx('bounce');
        this.shockwave(p.x + p.w / 2, p.y + p.h, '#ff8ac4');
        this.burst(p.x + p.w / 2, p.y + p.h, {
          count: 12, colors: ['#ff8ac4', '#ffe672', '#ffffff'], speed: 180, size: 3.5, life: 0.6, type: 'star', gravity: 500,
        });
      }
    } else if (!movedY.landed) {
      p.onGround = false;
    }

    p.x = clamp(p.x, 2, this.level.pixelWidth - p.w - 2);
    if (landed && bounceTile) p.onGround = false;

    p.runCycle += Math.abs(p.vx) * dt * 0.062;
    if (p.onGround && Math.abs(p.vx) > 20) p.animTime += dt * 0.2;

    this.checkHazards();
    if (this.state !== 'playing') return;
    this.checkPipeEntry();
  };

  Game.prototype.checkHazards = function checkHazards() {
    const p = this.player;
    if (!p) return;
    if (p.y > this.level.pixelHeight + 50) {
      this.loseLifeAndRespawn('pit');
      return;
    }
    const hx = p.x + 5;
    const hy = p.y + 5;
    const hw = p.w - 10;
    const hh = p.h - 8;
    const c0 = Math.floor(hx / TILE);
    const c1 = Math.floor((hx + hw) / TILE);
    const r0 = Math.floor(hy / TILE);
    const r1 = Math.floor((hy + hh) / TILE);
    let spike = null;
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const tile = this.level.tileAt(c, r);
        if (tile === T.LAVA) {
          this.loseLifeAndRespawn('lava');
          return;
        }
        if (tile === T.SPIKE) spike = { c, r };
      }
    }
    if (spike) {
      this.hurt(1, spike.c * TILE + TILE / 2);
      if (this.state === 'playing') {
        p.vy = -520;
        p.onGround = false;
        this.burst(p.x + p.w / 2, p.y + p.h - 6, {
          count: 8, colors: ['#ff6b4a', '#ffd23f', '#ffffff'], speed: 120, size: 2.6, life: 0.5, type: 'spark', gravity: 300,
        });
      }
    }
  };

  Game.prototype.checkPipeEntry = function checkPipeEntry() {
    if (!this.input.down || !this.player.onGround || this.warpCooldown > 0 || this.inBonus) return;
    const p = this.player;
    const feet = p.y + p.h;
    const center = p.x + p.w / 2;
    for (const pipe of this.level.pipes || []) {
      if (!pipe.secret) continue;
      if (Math.abs(feet - pipe.y) < 9 && center > pipe.x + 12 && center < pipe.x + pipe.w - 12) {
        this.enterBonus('pipe');
        return;
      }
    }
  };

  Game.prototype.bumpBlock = function bumpBlock(col, row) {
    const tile = this.level.tileAt(col, row);
    const key = `${col},${row}`;
    if (tile === T.QUESTION) {
      if (!this.bumps) this.bumps = new Map();
      this.bumps.set(key, 0.26);
      const item = this.level.blockContents.get(key) || 'coin';
      this.level.tiles[row * this.level.width + col] = T.USED;
      const cx = col * TILE + TILE / 2;
      const cy = row * TILE;
      if (item === 'coin') {
        this.addCoins(1, cx, cy - 8);
        this.audio.sfx('coin');
        this.burst(cx, cy - 10, { count: 10, colors: ['#ffe672', '#fff3b0'], speed: 150, size: 3, life: 0.5, type: 'spark', gravity: 450 });
      } else {
        this.spawnItem(item, cx, cy);
        this.audio.sfx('powerup');
      }
      this.burst(cx, cy + 4, { count: 7, colors: ['#ffffff', '#ffe672', '#e0b375'], speed: 90, size: 3, life: 0.35, type: 'spark', gravity: 200 });
    } else if (tile === T.BRICK) {
      if (!this.bumps) this.bumps = new Map();
      this.bumps.set(key, 0.2);
      this.audio.sfx('land');
      this.burst(col * TILE + TILE / 2, row * TILE + TILE, {
        count: 5, colors: ['#d99b5c', '#b06c3c', '#f0c28a'], speed: 80, size: 3.2, life: 0.35, type: 'spark', gravity: 400,
      });
    }
  };

  Game.prototype.spawnItem = function spawnItem(type, x, y) {
    const w = 28;
    const h = 28;
    this.itemEntities.push({
      type, x: x - w / 2, y: y - h - 2, w, h,
      vx: type === 'star' ? 92 : 58, vy: -430,
      dir: type === 'star' ? 1 : -1,
      onGround: false, age: 0, phase: this.rng() * 8,
    });
  };
}

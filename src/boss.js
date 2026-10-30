import { TILE, clamp, approach } from './config.js';
import { BOSS_INFO } from './levels.js';
import { moveX, moveY } from './physics.js';

const GRAVITY = 2300;
const MAX_FALL = 1150;

const BOSS_SIZES = {
  mushroomKing: { w: 104, h: 124 },
  crystalGolem: { w: 104, h: 118 },
  shadowOwl: { w: 116, h: 108 },
  titanTurtle: { w: 130, h: 116 },
  crowKing: { w: 110, h: 124 },
};

export function installBoss(Game) {
  Game.prototype.makeBoss = function makeBoss(info) {
    const size = BOSS_SIZES[info.type] || BOSS_SIZES.mushroomKing;
    const meta = BOSS_INFO[info.type] || { hp: 3, title: '' };
    const feet = info.feetRow * TILE;
    let y = feet - size.h;
    if (info.type === 'shadowOwl') y = feet - size.h - 12;
    if (info.type === 'crowKing') y = feet - size.h - 72;
    return {
      type: info.type,
      name: info.name || meta.name,
      title: meta.title,
      x: info.x - size.w / 2,
      y,
      w: size.w,
      h: size.h,
      vx: 0,
      vy: 0,
      dir: -1,
      hp: meta.hp,
      maxHp: meta.hp,
      active: false,
      defeated: false,
      dead: false,
      state: 'idle',
      timer: 1.2,
      shootTimer: 1.8,
      minionTimer: 3,
      attackCount: 0,
      invuln: 0,
      anim: 0,
      phase: 1,
      onGround: !['shadowOwl', 'crowKing'].includes(info.type),
      baseY: y,
      groundTop: feet,
      stompable: true,
      rollSpin: 0,
      flash: 0,
      swoopTargetX: 0,
      swoopTargetY: 0,
      deathTimer: 0,
      bob: this.rng() * 8,
      smokeTimer: 0,
    };
  };

  Game.prototype.bossBarData = function bossBarData(b) {
    return { name: b.name, title: b.title, hp: Math.max(0, b.hp), maxHp: b.maxHp, active: true };
  };

  Game.prototype.updateBoss = function updateBoss(dt) {
    const b = this.boss;
    const p = this.player;
    if (!b) return;
    b.anim += dt;
    b.invuln = Math.max(0, b.invuln - dt);
    b.flash = Math.max(0, b.flash - dt * 5);
    b.phase = b.hp <= Math.ceil(b.maxHp / 2) ? 2 : 1;

    if (!b.active) {
      if (p.x + p.w / 2 > this.level.bossTrigger) {
        b.active = true;
        this.goalOpen = false;
        this.emitBossBar(this.bossBarData(b));
        this.audio.startMusic('boss');
        this.toast(`${b.name} apareceu! Pule na cabeça dele!`, 'warn');
        this.shake = 10;
        this.flash = 0.35;
        this.burst(b.x + b.w / 2, b.y + b.h / 2, {
          count: 24, colors: ['#ff6b8a', '#ffd23f', '#ffffff'], speed: 240, size: 4, life: 0.9, type: 'spark', gravity: 300,
        });
      }
      return;
    }

    if (b.defeated) {
      b.deathTimer -= dt;
      b.y += Math.sin(this.time * 24) * 0.6;
      this.shake = Math.max(this.shake, 5);
      if (this.rng() < dt * 22) {
        const ex = b.x + this.rng() * b.w;
        const ey = b.y + this.rng() * b.h;
        this.burst(ex, ey, {
          count: 6, colors: ['#ffd23f', '#ff8a4a', '#ffffff', '#ff6b8a'], speed: 180,
          size: 4.5, life: 0.7, type: 'star', gravity: 350,
        });
      }
      if (b.deathTimer <= 0) {
        this.emitBossBar(null);
        this.boss = null;
      }
      return;
    }

    b.dir = p.x + p.w / 2 < b.x + b.w / 2 ? -1 : 1;
    if (b.type === 'mushroomKing') this.updateMushroomKing(b, dt);
    else if (b.type === 'crystalGolem') this.updateCrystalGolem(b, dt);
    else if (b.type === 'shadowOwl') this.updateShadowOwl(b, dt);
    else if (b.type === 'titanTurtle') this.updateTitanTurtle(b, dt);
    else if (b.type === 'crowKing') this.updateCrowKing(b, dt);
  };

  Game.prototype.bossGroundPhysics = function bossGroundPhysics(b, dt) {
    b.vy = Math.min(b.vy + GRAVITY * dt, MAX_FALL);
    const wasGround = b.onGround;
    const hitWall = moveX(b, b.vx * dt, this.level);
    const result = moveY(b, b.vy * dt, this.level);
    if (result.landed) {
      b.onGround = true;
      if (!wasGround) {
        this.shake = Math.max(this.shake, 7);
        this.shockwave(b.x + b.w / 2, b.y + b.h, '#ffd88a');
        this.burst(b.x + b.w / 2, b.y + b.h, {
          count: 14, colors: ['#f2e2c4', '#d7c29b', '#ffffff'], speed: 160, size: 4, life: 0.6, type: 'spark', gravity: 400,
        });
      }
    } else {
      b.onGround = false;
    }
    b.x = clamp(b.x, 2 * TILE, this.level.pixelWidth - b.w - 2 * TILE);
    return { hitWall, justLanded: result.landed && !wasGround };
  };

  Game.prototype.updateMushroomKing = function updateMushroomKing(b, dt) {
    b.timer -= dt;
    b.minionTimer -= dt;
    if (b.onGround && b.timer <= 0) {
      b.state = 'jump';
      b.vy = -820;
      b.vx = b.dir * (170 + b.phase * 35);
      b.timer = 1.2;
      this.audio.sfx('jump');
    }
    const { justLanded } = this.bossGroundPhysics(b, dt);
    if (justLanded) {
      b.state = 'idle';
      this.toast('Boa! Continue pulando na cabeça!', 'star');
      if (b.minionTimer <= 0 && this.enemies.filter((e) => e.alive && e.minion).length < 2) {
        b.minionTimer = 5;
        const row = this.level.surfaceAt(Math.floor(b.x / TILE)) || 13;
        for (const offset of [-100, 110]) {
          const x = clamp(b.x + b.w / 2 + offset, 3 * TILE, this.level.pixelWidth - 3 * TILE);
          this.enemies.push(this.makeEnemy({ type: 'fungus', x, feetRow: row, minion: true, speed: 58 }));
        }
        this.toast('O rei chamou ajudantes!', 'warn');
      }
    }
  };

  Game.prototype.updateCrystalGolem = function updateCrystalGolem(b, dt) {
    b.timer -= dt;
    b.shootTimer -= dt;
    if (b.state === 'walk' || b.state === 'idle') {
      b.vx = b.dir * 46;
      if (b.timer <= 0) {
        b.state = 'telegraph';
        b.timer = 0.8;
        b.vx = 0;
        this.audio.sfx('bossDoor');
      }
    } else if (b.state === 'telegraph') {
      b.vx = approach(b.vx, 0, 900 * dt);
      if (b.timer <= 0) {
        b.state = 'slam';
        b.timer = 0.35;
        const targets = [this.player.x + this.player.w / 2, this.player.x + this.player.w / 2 + b.dir * 76];
        for (const tx of targets) {
          this.spawnGroundSpike(tx);
        }
        this.shake = 13;
        this.audio.sfx('bossHit');
      }
    } else if (b.state === 'slam') {
      b.vx = 0;
      if (b.timer <= 0) {
        b.state = 'walk';
        b.timer = 1.7;
      }
    }
    if (b.shootTimer <= 0) {
      b.shootTimer = b.phase === 2 ? 1.7 : 2.5;
      const dx = this.player.x + this.player.w / 2 - (b.x + b.w / 2);
      const dy = this.player.y + this.player.h / 2 - (b.y + b.h * 0.35);
      const len = Math.hypot(dx, dy) || 1;
      this.spawnProjectile({
        kind: 'crystal', x: b.x + b.w / 2 - 10, y: b.y + b.h * 0.3,
        w: 20, h: 20, vx: (dx / len) * 210, vy: (dy / len) * 210, gravity: 0, life: 3.1,
      });
    }
    this.bossGroundPhysics(b, dt);
    if (b.state === 'walk' && b.timer <= 0) b.timer = 0.1;
  };

  Game.prototype.updateShadowOwl = function updateShadowOwl(b, dt) {
    const p = this.player;
    const pcx = p.x + p.w / 2;
    b.timer -= dt;
    b.shootTimer -= dt;
    if (b.state === 'swoop') {
      b.x = approach(b.x, b.swoopTargetX, 360 * dt);
      b.y = approach(b.y, b.swoopTargetY, 380 * dt);
      if (b.timer <= 0) {
        b.state = 'rise';
        b.timer = 1.15;
      }
    } else if (b.state === 'rise') {
      b.y = approach(b.y, b.baseY, 190 * dt);
      if (b.timer <= 0) {
        b.state = 'hover';
        b.timer = b.phase === 2 ? 1.25 : 1.8;
      }
    } else {
      const targetX = clamp(pcx - b.w / 2 + Math.sin(b.anim * 1.1) * 70, TILE, this.level.pixelWidth - b.w - TILE);
      b.x = approach(b.x, targetX, 105 * dt);
      b.y = approach(b.y, b.baseY + Math.sin(b.anim * 2.1) * 24, 90 * dt);
      if (b.timer <= 0) {
        b.state = 'swoop';
        b.timer = 0.95;
        b.swoopTargetX = clamp(pcx - b.w / 2, TILE, this.level.pixelWidth - b.w - TILE);
        b.swoopTargetY = clamp(p.y - 28, 80, b.groundTop - b.h - 5);
        this.audio.sfx('bossDoor');
      }
    }
    if (b.shootTimer <= 0) {
      b.shootTimer = b.phase === 2 ? 1.05 : 1.55;
      this.spawnProjectile({
        kind: 'feather', x: b.x + b.w / 2 - 10, y: b.y + b.h * 0.7,
        w: 20, h: 14, vx: clamp((pcx - (b.x + b.w / 2)) * 0.5, -140, 140), vy: 70,
        gravity: 120, life: 4,
      });
    }
    b.x = clamp(b.x, TILE, this.level.pixelWidth - b.w - TILE);
    b.y = clamp(b.y, 60, b.groundTop - b.h - 5);
    b.stompable = true;
  };

  Game.prototype.updateTitanTurtle = function updateTitanTurtle(b, dt) {
    b.timer -= dt;
    if (b.state === 'walk') {
      b.vx = b.dir * (55 + b.phase * 12);
      b.stompable = true;
      if (b.timer <= 0) {
        b.state = 'roll';
        b.timer = 2.1;
        b.vx = b.dir * 300;
        b.stompable = false;
        b.rollSpin = 0;
        this.audio.sfx('bossDoor');
        this.shake = 8;
        this.toast('Cuidado com o casco! Pule quando ela cansar.', 'warn');
      }
    } else if (b.state === 'roll') {
      b.rollSpin += Math.sign(b.vx || 1) * dt * 12;
      b.vx = b.dir * 300;
      b.stompable = false;
      if (b.timer <= 0) {
        b.state = 'tired';
        b.timer = 1.5;
        b.vx = 0;
        b.stompable = true;
        this.burst(b.x + b.w / 2, b.y + b.h, {
          count: 14, colors: ['#ffffff', '#b9ffd0', '#ffe672'], speed: 170, size: 4, life: 0.6, type: 'star', gravity: 300,
        });
      }
    } else if (b.state === 'tired') {
      b.vx = approach(b.vx, 0, 900 * dt);
      b.stompable = true;
      if (b.timer <= 0) {
        b.state = 'walk';
        b.timer = 1.8;
      }
    }
    const { hitWall } = this.bossGroundPhysics(b, dt);
    if (hitWall && b.state === 'roll') {
      b.state = 'tired';
      b.timer = 1.5;
      b.vx = 0;
      b.stompable = true;
      this.shake = Math.max(this.shake, 8);
    }
  };

  Game.prototype.updateCrowKing = function updateCrowKing(b, dt) {
    const p = this.player;
    const pcx = p.x + p.w / 2;
    b.timer -= dt;
    b.shootTimer -= dt;
    b.minionTimer -= dt;
    if (b.state === 'dive') {
      b.x = approach(b.x, b.swoopTargetX, 420 * dt);
      b.y = approach(b.y, b.swoopTargetY, 420 * dt);
      if (b.timer <= 0) {
        b.state = 'rise';
        b.timer = 1.1;
        this.shake = Math.max(this.shake, 8);
      }
    } else if (b.state === 'rise') {
      b.y = approach(b.y, b.baseY, 230 * dt);
      if (b.timer <= 0) {
        b.state = 'hover';
        b.timer = b.phase === 2 ? 1.1 : 1.6;
      }
    } else {
      const targetX = clamp(pcx - b.w / 2 + Math.sin(b.anim * 0.9) * 90, 2 * TILE, this.level.pixelWidth - b.w - 2 * TILE);
      b.x = approach(b.x, targetX, 95 * dt);
      b.y = approach(b.y, b.baseY + Math.sin(b.anim * 1.7) * 16, 90 * dt);
      if (b.timer <= 0) {
        b.attackCount++;
        if (b.attackCount % 3 === 0) {
          b.state = 'dive';
          b.timer = 0.85;
          b.swoopTargetX = clamp(pcx - b.w / 2, 2 * TILE, this.level.pixelWidth - b.w - 2 * TILE);
          b.swoopTargetY = clamp(b.groundTop - b.h + 4, 70, b.groundTop - b.h);
          this.burst(b.x + b.w / 2, b.y + b.h / 2, {
            count: 16, colors: ['#2b1933', '#6d3a73', '#ffb0c0'], speed: 160, size: 5, life: 0.7, type: 'spark', gravity: 0,
          });
          this.audio.sfx('bossDoor');
        } else {
          this.burst(b.x + b.w / 2, b.y + b.h / 2, {
            count: 14, colors: ['#2b1933', '#6d3a73', '#ffb0c0'], speed: 140, size: 5, life: 0.6, type: 'spark', gravity: 0,
          });
          b.x = clamp(pcx + (pcx < b.x + b.w / 2 ? 190 : -190) - b.w / 2, 2 * TILE, this.level.pixelWidth - b.w - 2 * TILE);
          b.y = b.baseY;
          b.timer = b.phase === 2 ? 1.2 : 1.8;
          this.shootShadowOrbs(b, b.phase === 2 ? 5 : 3);
          this.audio.sfx('pipe');
        }
      }
    }
    if (b.shootTimer <= 0) {
      b.shootTimer = b.phase === 2 ? 1.4 : 2.2;
      this.shootShadowOrbs(b, 1);
    }
    if (b.minionTimer <= 0) {
      b.minionTimer = 6;
      if (this.enemies.filter((e) => e.alive && e.type === 'bat').length < 2) {
        this.enemies.push(this.makeEnemy({ type: 'bat', x: b.x + b.w / 2 - 80, feetRow: 8 }));
        this.enemies.push(this.makeEnemy({ type: 'bat', x: b.x + b.w / 2 + 80, feetRow: 8 }));
        this.toast('Morcegos sombrios!', 'warn');
      }
    }
    b.x = clamp(b.x, 2 * TILE, this.level.pixelWidth - b.w - 2 * TILE);
    b.y = clamp(b.y, 60, b.groundTop - b.h + 4);
    b.stompable = true;
  };

  Game.prototype.shootShadowOrbs = function shootShadowOrbs(b, count) {
    const p = this.player;
    const sx = b.x + b.w / 2;
    const sy = b.y + b.h * 0.5;
    const angle = Math.atan2(p.y + p.h / 2 - sy, p.x + p.w / 2 - sx);
    for (let i = 0; i < count; i++) {
      const spread = count === 1 ? 0 : (i - (count - 1) / 2) * 0.19;
      const a = angle + spread;
      this.spawnProjectile({
        kind: 'shadow', x: sx - 9, y: sy - 9, w: 18, h: 18,
        vx: Math.cos(a) * 215, vy: Math.sin(a) * 215, gravity: 0, life: 3.4,
      });
    }
    this.audio.sfx('star');
  };

  Game.prototype.hitBoss = function hitBoss(b) {
    if (!b || !b.active || b.defeated || b.invuln > 0) return false;
    b.hp -= 1;
    b.invuln = 1.25;
    b.flash = 1;
    this.addScore(1000);
    this.shake = Math.max(this.shake, 13);
    this.flash = 0.32;
    this.audio.sfx('bossHit');
    this.floatingText('+1000', b.x + b.w / 2, b.y - 8, '#ffe672', 20);
    this.burst(b.x + b.w / 2, b.y + b.h * 0.3, {
      count: 26, colors: ['#ffe672', '#ffffff', '#ff8ac4', '#8df7ff'], speed: 260,
      size: 4.4, life: 0.8, type: 'star', gravity: 420,
    });
    this.emitBossBar(this.bossBarData(b));
    if (b.hp <= 0) {
      b.defeated = true;
      b.deathTimer = 2.2;
      b.hp = 0;
      this.goalOpen = true;
      this.addScore(3000);
      this.audio.sfx('explode');
      this.audio.sfx('victory');
      this.heal(1);
      this.toast('Chefe derrotado! O portal se abriu!', 'star');
      this.emitBossBar({ ...this.bossBarData(b), defeated: true });
      this.burst(b.x + b.w / 2, b.y + b.h / 2, {
        count: 40, colors: ['#ffe672', '#ff8ac4', '#8df7ff', '#9bffcf', '#ffffff'],
        speed: 300, size: 5, life: 1.4, type: 'confetti', gravity: 380, spin: true,
      });
    }
    return true;
  };
}

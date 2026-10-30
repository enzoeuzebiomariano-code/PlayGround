import { TILE, T, SOLID_TILES, clamp, approach, rectsOverlap } from './config.js';
import { surfaceRowAt } from './physics.js';
import { createBonusRoom } from './levels.js';

const ITEM_GRAVITY = 1900;

export function installInteractions(Game) {
  Game.prototype.spawnProjectile = function spawnProjectile(spec) {
    this.projectiles.push({
      x: spec.x, y: spec.y, w: spec.w || 18, h: spec.h || 18,
      vx: spec.vx || 0, vy: spec.vy || 0, gravity: spec.gravity || 0,
      life: spec.life || 3, kind: spec.kind || 'orb',
      phase: this.rng() * 8, age: 0,
    });
  };

  Game.prototype.spawnGroundSpike = function spawnGroundSpike(x) {
    const col = clamp(Math.floor(x / TILE), 0, this.level.width - 1);
    const row = surfaceRowAt(this.level, col * TILE + TILE / 2);
    const px = col * TILE + TILE / 2;
    const py = row * TILE;
    this.shockwave(px, py, '#8ef7ff');
    this.spawnProjectile({
      kind: 'spike', x: px - 10, y: py + 2, w: 20, h: 34,
      vx: 0, vy: -720, gravity: 1100, life: 1.35,
    });
    this.burst(px, py, {
      count: 8, colors: ['#8ef7ff', '#ffffff', '#b58cff'], speed: 120,
      size: 3, life: 0.45, type: 'spark', gravity: 250,
    });
  };

  Game.prototype.updateProjectiles = function updateProjectiles(dt) {
    const p = this.player;
    for (const proj of this.projectiles) {
      proj.age += dt;
      proj.life -= dt;
      proj.vy += proj.gravity * dt;
      proj.x += proj.vx * dt;
      proj.y += proj.vy * dt;
      if (proj.life <= 0) continue;
      if (proj.x < -120 || proj.x > this.level.pixelWidth + 120 || proj.y > this.level.pixelHeight + 150) {
        proj.life = 0;
        continue;
      }
      if (proj.kind === 'crystal' || proj.kind === 'shadow') {
        const midX = proj.x + proj.w / 2;
        const midY = proj.y + proj.h / 2;
        if (SOLID_TILES.has(this.level.tileAtPixel(midX, midY))) {
          proj.life = 0;
          this.burst(midX, midY, {
            count: 8, colors: proj.kind === 'shadow' ? ['#55203c', '#ffb0c0'] : ['#8ef7ff', '#ffffff'],
            speed: 100, size: 2.5, life: 0.35, type: 'spark', gravity: 100,
          });
          continue;
        }
      }
      if (this.state !== 'playing' || p.invuln > 0) continue;
      if (rectsOverlap(p, proj)) {
        proj.life = 0;
        if (p.starPower > 0) {
          this.burst(proj.x + proj.w / 2, proj.y + proj.h / 2, {
            count: 10, colors: ['#ffe672', '#ff8ac4', '#8df7ff'], speed: 140, size: 3, life: 0.5, type: 'star', gravity: 200,
          });
        } else {
          this.hurt(1, proj.x + proj.w / 2);
        }
      }
    }
    this.projectiles = this.projectiles.filter((proj) => proj.life > 0);
  };

  Game.prototype.updateItems = function updateItems(dt) {
    const p = this.player;
    for (const item of this.itemEntities) {
      item.age += dt;
      item.phase += dt;
      item.vy = Math.min(item.vy + ITEM_GRAVITY * dt, 900);
      const hitWall = (() => {
        item.x += item.vx * dt;
        const solid = SOLID_TILES.has(this.level.tileAtPixel(item.x + (item.vx > 0 ? item.w + 2 : -2), item.y + item.h / 2));
        if (solid) {
          item.vx *= -1;
          item.dir *= -1;
          item.x += item.vx * dt * 2;
        }
        return solid;
      })();
      const prevBottom = item.y + item.h;
      item.y += item.vy * dt;
      const bottom = item.y + item.h;
      const footTile = this.level.tileAtPixel(item.x + item.w / 2, bottom + 2);
      if (SOLID_TILES.has(footTile) && item.vy > 0) {
        item.y = Math.floor((bottom + 2) / TILE) * TILE - item.h;
        item.vy = item.type === 'star' ? -640 : 0;
      }
      if (item.type === 'star' && item.vy === 0) item.vy = -520;
      if (item.x < 4) { item.x = 4; item.vx = Math.abs(item.vx); item.dir = 1; }
      if (item.x > this.level.pixelWidth - item.w - 4) {
        item.x = this.level.pixelWidth - item.w - 4;
        item.vx = -Math.abs(item.vx);
        item.dir = -1;
      }
      if (item.y > this.level.pixelHeight + 80 || item.age > 24) item.dead = true;
      if (!item.dead && rectsOverlap(p, item)) {
        item.dead = true;
        if (item.type === 'heart') {
          const healed = this.heal(1);
          this.audio.sfx('powerup');
          this.floatingText(healed ? '+♥' : '+250', item.x + item.w / 2, item.y, healed ? '#ff8aa2' : '#ffe672', 18);
          this.burst(item.x + item.w / 2, item.y + item.h / 2, {
            count: 14, colors: ['#ff8aa2', '#ffffff', '#ffe672'], speed: 170, size: 3.4, life: 0.6, type: 'star', gravity: 300,
          });
          this.emitHud();
        } else {
          p.starPower = 9;
          p.invuln = Math.max(p.invuln, 0.5);
          this.audio.sfx('powerup');
          this.toast('Poder estelar! Você está invencível por alguns segundos!', 'star');
          this.floatingText('PODER!', item.x + item.w / 2, item.y, '#ffe672', 18);
          this.burst(item.x + item.w / 2, item.y + item.h / 2, {
            count: 24, colors: ['#ffe672', '#ff8ac4', '#8df7ff', '#ffffff'], speed: 220, size: 4, life: 0.9, type: 'star', gravity: 300,
          });
        }
      }
      if (hitWall) item.phase += 0.1;
    }
    this.itemEntities = this.itemEntities.filter((item) => !item.dead);
  };

  Game.prototype.updateInteractions = function updateInteractions(dt) {
    const p = this.player;
    for (const coin of this.coinEntities) {
      if (coin.collected) continue;
      if (rectsOverlap(p, { x: coin.x - 14, y: coin.y - 14, w: 28, h: 28 })) {
        coin.collected = true;
        this.addCoins(1, coin.x, coin.y - 8);
        this.audio.sfx('coin');
      }
    }
    for (const star of this.starEntities) {
      if (star.collected) continue;
      if (rectsOverlap(p, { x: star.x - 22, y: star.y - 22, w: 44, h: 44 })) {
        star.collected = true;
        this.audio.sfx('star');
        if (star.isTrophy) {
          this.addScore(2500);
          this.floatingText('+2500', star.x, star.y - 12, '#ffe672', 20);
          this.burst(star.x, star.y, {
            count: 36, colors: ['#ffe672', '#ff8ac4', '#8df7ff', '#ffffff'], speed: 260, size: 5, life: 1.2, type: 'star', gravity: 260,
          });
        } else {
          this.levelStars += 1;
          this.stats.stars += 1;
          this.addScore(500);
          this.floatingText('+500', star.x, star.y - 12, '#ffe672', 18);
          this.burst(star.x, star.y, {
            count: 28, colors: ['#ffe672', '#fff6c3', '#8df7ff'], speed: 220, size: 4.5, life: 1, type: 'star', gravity: 280,
          });
          if (this.levelStars >= 3) {
            this.toast('Todas as estrelas! O portal estelar foi aberto!', 'star');
            this.audio.sfx('gate');
            if (this.level.gate) this.burst(this.level.gate.x, this.level.gate.feetRow * TILE - 70, {
              count: 30, colors: ['#ffe672', '#ff8ac4', '#8df7ff'], speed: 180, size: 4, life: 1, type: 'star', gravity: 100,
            });
          } else {
            this.toast(`Estrela ${this.levelStars}/3!`, 'star');
          }
          this.emitHud();
        }
      }
    }
    for (const cp of this.checkpointEntities) {
      if (cp.active) continue;
      if (rectsOverlap(p, { x: cp.x - 22, y: cp.feetRow * TILE - 92, w: 44, h: 96 })) {
        this.activateCheckpoint(cp);
      }
    }

    if (!this.inBonus) {
      const gate = this.level.gate;
      if (gate) {
        const box = { x: gate.x - 46, y: gate.feetRow * TILE - 140, w: 92, h: 145 };
        if (rectsOverlap(p, box)) {
          if (this.levelStars >= gate.required) {
            if (this.gateUsed) {
              if (this.gateCooldown <= 0) {
                this.toast('Você já pegou o tesouro do cofre estelar!', 'info');
                this.gateCooldown = 2.5;
              }
            } else if (this.gateCooldown <= 0) {
              this.enterBonus('vault');
              return;
            }
          } else if (this.gateCooldown <= 0) {
            this.toast(`Colete as ${gate.required} estrelas para abrir o portal estelar!`, 'warn');
            this.gateCooldown = 2.5;
          }
        }
      }
      if (this.level.goal) {
        const goal = this.level.goal;
        const box = { x: goal.x - 44, y: goal.feetRow * TILE - 168, w: 88, h: 172 };
        if (rectsOverlap(p, box)) {
          if (this.goalOpen) {
            this.completeLevel();
            return;
          } else if (this.gateCooldown <= 0) {
            this.toast('Derrote o chefe para abrir o portal!', 'warn');
            this.gateCooldown = 2.5;
          }
        }
      }
    } else if (this.level.returnPortal) {
      const portal = this.level.returnPortal;
      if (rectsOverlap(p, { x: portal.x - 34, y: portal.feetRow * TILE - 122, w: 68, h: 126 })) {
        this.returnFromBonus();
        return;
      }
    }

    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (!rectsOverlap(p, e)) continue;
      if (p.starPower > 0) {
        this.killEnemy(e, true);
        continue;
      }
      const canStomp = !e.noStomp && !(e.type === 'turtle' && e.rolling);
      const falling = p.vy > 40;
      const fromAbove = p.prevY + p.h <= e.y + e.h * 0.6;
      if (canStomp && falling && fromAbove) {
        this.stompEnemy(e);
      } else {
        this.hurt(1, e.x + e.w / 2);
      }
    }

    const b = this.boss;
    if (b && b.active && !b.defeated) {
      if (rectsOverlap(p, b)) {
        const falling = p.vy > 40;
        const fromAbove = p.prevY + p.h <= b.y + b.h * 0.38;
        if (b.stompable && falling && fromAbove) {
          if (this.hitBoss(b)) {
            p.vy = -740;
            p.onGround = false;
            p.squash = 0.8;
          }
        } else if (p.starPower <= 0) {
          this.hurt(1, b.x + b.w / 2);
        }
      }
    }
  };

  Game.prototype.enterBonus = function enterBonus(kind) {
    if (this.inBonus || this.warpCooldown > 0) return;
    const p = this.player;
    this.mainSave = {
      level: this.level,
      enemies: this.enemies,
      coinEntities: this.coinEntities,
      starEntities: this.starEntities,
      checkpointEntities: this.checkpointEntities,
      itemEntities: this.itemEntities,
      projectiles: this.projectiles,
      boss: this.boss,
      goalOpen: this.goalOpen,
      gateUsed: kind === 'vault' ? true : this.gateUsed,
      respawnPoint: this.respawnPoint,
      levelStars: this.levelStars,
      playerPos: { x: p.x, y: p.y },
      camera: { x: this.camera.x, y: this.camera.y },
    };
    this.level = createBonusRoom(this.level.theme, kind);
    this.enemies = [];
    this.projectiles = [];
    this.itemEntities = [];
    this.particles = [];
    this.bumps = new Map();
    this.coinEntities = this.level.coinSpawns.map((coin) => ({
      x: coin.x, y: coin.y, phase: this.rng() * 9, collected: false, isTrophy: false,
    }));
    this.starEntities = this.level.starSpawns.map((star) => ({
      x: star.x, y: star.y, phase: this.rng() * 9, collected: false, isTrophy: true,
    }));
    this.checkpointEntities = [];
    this.boss = null;
    this.goalOpen = false;
    this.gateUsed = true;
    this.inBonus = true;
    this.setPlayerSpawn(this.level.spawnFeet);
    this.player.invuln = 2;
    this.snapCamera();
    this.spawnAmbient();
    this.warpCooldown = 1.2;
    this.audio.sfx(kind === 'vault' ? 'gate' : 'pipe');
    this.flash = 0.7;
    this.burst(this.player.x + this.player.w / 2, this.player.y + this.player.h / 2, {
      count: 28, colors: ['#ffffff', '#8df7ff', '#ffe672', '#ff8ac4'], speed: 220,
      size: 4, life: 0.9, type: 'star', gravity: 80,
    });
    this.toast(kind === 'vault' ? 'Cofre Estelar! Pegue o tesouro e volte pelo portal.' : 'Passagem secreta! Explore e volte pelo portal.', 'star');
    this.emitHud();
  };

  Game.prototype.returnFromBonus = function returnFromBonus() {
    if (!this.mainSave) return;
    const save = this.mainSave;
    this.level = save.level;
    this.enemies = save.enemies;
    this.coinEntities = save.coinEntities;
    this.starEntities = save.starEntities;
    this.checkpointEntities = save.checkpointEntities;
    this.itemEntities = save.itemEntities;
    this.projectiles = save.projectiles;
    this.boss = save.boss;
    this.goalOpen = save.goalOpen;
    this.gateUsed = save.gateUsed;
    this.levelStars = save.levelStars;
    this.respawnPoint = save.respawnPoint;
    this.inBonus = false;
    this.mainSave = null;
    this.particles = [];
    this.player.x = save.playerPos.x;
    this.player.y = save.playerPos.y;
    this.player.vx = 0;
    this.player.vy = 0;
    this.player.invuln = 2;
    this.player.starPower = 0;
    this.camera.x = save.camera.x;
    this.camera.y = save.camera.y;
    this.snapCamera();
    this.warpCooldown = 1.2;
    this.gateCooldown = 1.5;
    this.audio.sfx('pipe');
    this.flash = 0.55;
    this.burst(this.player.x + this.player.w / 2, this.player.y + this.player.h / 2, {
      count: 22, colors: ['#ffffff', '#8df7ff', '#ffe672'], speed: 180, size: 3.5,
      life: 0.8, type: 'star', gravity: 60,
    });
    this.toast('De volta à aventura!', 'info');
    this.emitHud();
  };
}

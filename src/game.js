import {
  TILE, T, SOLID_TILES, HAZARD_TILES, GAME_HEIGHT, MIN_VIEW_WIDTH, MAX_VIEW_WIDTH,
  clamp, approach, rectsOverlap, mulberry32,
} from './config.js';
import { Level, LEVELS, WORLDS, BOSS_INFO, createBonusRoom } from './levels.js';
import {
  drawBackground, drawWorldDecor, drawTile, drawCoin, drawStarShard, drawHeartItem,
  drawStarPower, drawHero, drawEnemy, drawBoss, drawProjectile, drawGoal, drawCheckpoint,
  drawStarGate, drawReturnPortal, drawParticle, glowCircle,
} from './art.js';
import { installPlayer } from './player.js';
import { installEnemies } from './enemies.js';
import { installBoss } from './boss.js';
import { installInteractions } from './interactions.js';
import { installRenderer } from './renderer.js';

const PLAYER_SPEED = 275;
const RUN_SPEED = 410;
const JUMP_SPEED = 890;
const GRAVITY = 2380;
const MAX_FALL = 1200;

export const PLAYER_SIZE = { w: 32, h: 46 };

export class Game {
  constructor({ canvas, audio, input, callbacks = {} }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.audio = audio;
    this.input = input;
    this.callbacks = callbacks;
    this.state = 'title';
    this.time = 0;
    this.dpr = 1;
    this.cssW = 960;
    this.cssH = 540;
    this.viewW = 960;
    this.viewH = 540;
    this.scale = 1;
    this.camera = { x: 0, y: 0 };
    this.shake = 0;
    this.flash = 0;
    this.rng = mulberry32(20261030);
    this.ambient = [];
    this.score = 0;
    this.coins = 0;
    this.nextHeartScore = 50;
    this.hearts = 3;
    this.maxHearts = 5;
    this.levelStars = 0;
    this.levelIndex = 0;
    this.worldIndex = 0;
    this.stats = { coins: 0, enemies: 0, stars: 0, deaths: 0 };
    this.inBonus = false;
    this.mainSave = null;
    this.warpCooldown = 0;
    this.gateCooldown = 0;
    this.pitCooldown = 0;
    this.respawnPoint = null;
    this.level = null;
    this.player = null;
    this.enemies = [];
    this.coinEntities = [];
    this.starEntities = [];
    this.itemEntities = [];
    this.projectiles = [];
    this.particles = [];
    this.bumps = new Map();
    this.checkpointEntities = [];
    this.boss = null;
    this.goalOpen = true;
    this.gateUsed = false;
    this.pendingClear = null;
    this.clearTimer = 0;
    this.pendingVictory = null;
    this.victoryTimer = 0;
    this.combo = 0;
    this.hitFlash = 0;
    this.loadLevel(0, { preview: true });
  }

  // ---------------------------------------------------------------- lifecycle
  loadLevel(index, { preview = false } = {}) {
    this.levelIndex = clamp(index, 0, LEVELS.length - 1);
    this.worldIndex = Math.floor(this.levelIndex / 3);
    this.level = new Level(LEVELS[this.levelIndex]);
    this.inBonus = false;
    this.mainSave = null;
    this.hearts = 3;
    this.levelStars = 0;
    this.gateUsed = false;
    this.goalOpen = !this.level.isBoss;
    this.combo = 0;
    this.warpCooldown = 0.7;
    this.gateCooldown = 0;
    this.pitCooldown = 0;
    this.shake = 0;
    this.flash = 0;
    this.particles = [];
    this.projectiles = [];
    this.bumps = new Map();
    this.itemEntities = [];
    this.enemies = this.level.enemySpawns.map((spawn) => this.makeEnemy(spawn));
    this.coinEntities = this.level.coinSpawns.map((coin) => ({
      x: coin.x, y: coin.y, phase: this.rng() * 9, collected: false, isTrophy: false,
    }));
    this.starEntities = this.level.starSpawns.map((star) => ({
      x: star.x, y: star.y, phase: this.rng() * 9, collected: false, isTrophy: false,
    }));
    this.checkpointEntities = this.level.checkpointSpawns.map((cp) => ({
      x: cp.x, feetRow: cp.feetRow, active: false, phase: this.rng() * 8,
    }));
    this.boss = this.level.boss ? this.makeBoss(this.level.boss) : null;
    this.setPlayerSpawn(this.level.spawnFeet);
    this.spawnAmbient();
    this.snapshot = {
      score: this.score,
      coins: this.coins,
      nextHeartScore: this.nextHeartScore,
    };
    this.player.invuln = 0.6;
    this.snapCamera();
    this.state = preview ? 'title' : 'playing';
    this.clearTimer = 0;
    this.emitHud();
    this.emitBossBar(null);
    if (preview) {
      this.player.x = 6.4 * TILE;
      this.player.facing = 1;
      this.snapCamera();
    } else {
      this.onBanner({
        world: this.worldIndex,
        worldName: WORLDS[this.worldIndex].name,
        stage: this.level.stage,
        name: this.level.name,
        isBoss: this.level.isBoss,
      });
      this.audio.startMusic(this.level.isBoss ? 'boss' : WORLDS[this.worldIndex].song);
      this.toast(this.level.isBoss ? 'Derrote o chefe para abrir o portal!' : `Colete as 3 estrelas de ${this.level.name}!`, 'star');
    }
  }

  setPlayerSpawn(spawn) {
    this.player = {
      x: spawn.x - PLAYER_SIZE.w / 2,
      y: spawn.row * TILE - PLAYER_SIZE.h,
      w: PLAYER_SIZE.w,
      h: PLAYER_SIZE.h,
      vx: 0,
      vy: 0,
      facing: 1,
      onGround: true,
      coyote: 0,
      jumpBuffer: 0,
      runCycle: 0,
      animTime: 0,
      squash: 0,
      invuln: 0,
      hurtTimer: 0,
      starPower: 0,
      blinkOffset: this.rng() * 3,
      prevY: spawn.row * TILE - PLAYER_SIZE.h,
    };
    this.respawnPoint = { x: spawn.x, feetRow: spawn.row };
  }

  startGame() {
    this.score = 0;
    this.coins = 0;
    this.nextHeartScore = 50;
    this.stats = { coins: 0, enemies: 0, stars: 0, deaths: 0 };
    this.audio.unlock();
    this.loadLevel(0);
  }

  nextLevel() {
    if (this.state !== 'clear' && this.state !== 'playing') return;
    const next = this.levelIndex + 1;
    if (next >= LEVELS.length) return;
    this.loadLevel(next);
  }

  retryLevel() {
    if (this.inBonus) {
      this.inBonus = false;
      this.mainSave = null;
    }
    this.stats.deaths++;
    this.score = this.snapshot?.score ?? 0;
    this.coins = this.snapshot?.coins ?? 0;
    this.nextHeartScore = this.snapshot?.nextHeartScore ?? 50;
    this.loadLevel(this.levelIndex);
  }

  quitToTitle() {
    this.state = 'title';
    this.audio.pauseMusic();
    this.onPause(false);
    this.onBossBar(null);
    this.score = 0;
    this.coins = 0;
    this.levelStars = 0;
    this.loadLevel(0, { preview: true });
    this.onTitle?.(true);
  }

  togglePause() {
    if (this.state === 'playing') {
      this.state = 'paused';
      this.input.releaseAll();
      this.audio.pauseMusic();
      this.onPause(true);
    } else if (this.state === 'paused') {
      this.state = 'playing';
      this.audio.resumeMusic();
      this.onPause(false);
    }
  }

  autoPause() {
    if (this.state === 'playing') this.togglePause();
  }

  // ---------------------------------------------------------------- camera
  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.cssW = Math.max(1, rect.width);
    this.cssH = Math.max(1, rect.height);
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(this.cssW * this.dpr);
    this.canvas.height = Math.round(this.cssH * this.dpr);
    const aspect = this.cssW / this.cssH;
    this.viewW = clamp(aspect * GAME_HEIGHT, MIN_VIEW_WIDTH, MAX_VIEW_WIDTH);
    this.viewH = this.viewW / aspect;
    this.scale = this.cssW / this.viewW;
  }

  snapCamera() {
    if (!this.level || !this.player) return;
    const target = this.cameraTarget();
    this.camera.x = target.x;
    this.camera.y = target.y;
  }

  cameraTarget() {
    const p = this.player;
    const maxX = Math.max(0, this.level.pixelWidth - this.viewW);
    const maxY = this.level.pixelHeight - this.viewH;
    const minY = Math.min(0, maxY);
    const x = clamp(p.x + p.w / 2 + p.facing * 54 - this.viewW / 2, 0, maxX);
    const y = clamp(p.y + p.h / 2 - this.viewH * 0.57, minY, maxY);
    return { x, y };
  }

  updateCamera(dt) {
    if (!this.level) return;
    const target = this.cameraTarget();
    const sx = 1 - Math.exp(-8 * dt);
    const sy = 1 - Math.exp(-7 * dt);
    this.camera.x += (target.x - this.camera.x) * sx;
    this.camera.y += (target.y - this.camera.y) * sy;
    this.shake = Math.max(0, this.shake - dt * 34);
  }

  // ---------------------------------------------------------------- state helpers
  addScore(value) {
    this.score = Math.max(0, this.score + value);
  }

  addCoins(count = 1, x = 0, y = 0) {
    this.coins += count;
    this.stats.coins += count;
    this.addScore(50 * count);
    if (this.coins >= this.nextHeartScore) {
      this.nextHeartScore += 50;
      if (this.hearts < this.maxHearts) {
        this.hearts++;
        this.toast('Coração extra! +♥', 'heart');
      } else {
        this.addScore(250);
      }
    }
    this.emitHud();
    if (x || y) this.floatingText('+50', x, y, '#ffe672');
    this.burst(x, y, { count: 6, colors: ['#ffe672', '#fff3b0', '#ffd23f'], speed: 130, size: 3, life: 0.45, type: 'spark' });
  }

  heal(amount = 1) {
    if (this.hearts < this.maxHearts) {
      this.hearts += amount;
      this.emitHud();
      return true;
    }
    this.addScore(250);
    return false;
  }

  hurt(amount = 1, sourceX = null) {
    if (this.state !== 'playing' || this.player.invuln > 0 || this.player.starPower > 0) return;
    this.hearts -= amount;
    this.player.invuln = 1.7;
    this.player.hurtTimer = 0.4;
    this.player.vy = -420;
    this.player.onGround = false;
    if (sourceX != null) this.player.vx = this.player.x + this.player.w / 2 < sourceX ? -280 : 280;
    this.shake = Math.max(this.shake, 11);
    this.hitFlash = 0.28;
    this.audio.sfx('hurt');
    this.combo = 0;
    this.emitHud();
    if (this.hearts <= 0) this.triggerGameOver();
  }

  loseLifeAndRespawn(cause = 'pit') {
    if (this.state !== 'playing' || this.pitCooldown > 0) return;
    this.pitCooldown = 1.2;
    this.hearts -= 1;
    this.audio.sfx(cause === 'lava' ? 'hurt' : 'gameover');
    this.hitFlash = 0.5;
    this.shake = 14;
    this.emitHud();
    if (this.hearts <= 0) {
      this.triggerGameOver();
      return;
    }
    this.respawnPlayer();
    this.toast(cause === 'lava' ? 'Ai, lava quente! Cuidado!' : 'Cuidado com os buracos!', 'warn');
  }

  respawnPlayer() {
    if (!this.respawnPoint) return;
    const p = this.player;
    p.x = this.respawnPoint.x - p.w / 2;
    p.y = this.respawnPoint.feetRow * TILE - p.h;
    p.vx = 0;
    p.vy = 0;
    p.onGround = false;
    p.invuln = 2.4;
    p.hurtTimer = 0;
    p.starPower = 0;
    this.snapCamera();
    this.burst(p.x + p.w / 2, p.y + p.h / 2, { count: 18, colors: ['#ffffff', '#9ef7ff', '#ffe672'], speed: 160, size: 3, life: 0.7, type: 'spark' });
  }

  activateCheckpoint(cp) {
    if (cp.active) return;
    this.checkpointEntities.forEach((other) => { other.active = false; });
    cp.active = true;
    this.respawnPoint = { x: cp.x, feetRow: cp.feetRow };
    this.audio.sfx('checkpoint');
    this.toast('Checkpoint salvo!', 'heart');
    this.burst(cp.x, cp.feetRow * TILE - 50, { count: 20, colors: ['#ffe672', '#fff6c3', '#8df7ff'], speed: 170, size: 3.5, life: 0.9, type: 'star', gravity: 300 });
  }

  triggerGameOver() {
    if (this.state === 'gameover') return;
    this.state = 'gameover';
    this.audio.pauseMusic();
    this.audio.sfx('gameover');
    this.emitBossBar(null);
    this.onGameOver?.({
      score: this.score,
      coins: this.coins,
      stars: this.levelStars,
      levelName: this.level.name,
      world: this.worldIndex,
      stage: this.level.stage,
    });
  }

  completeLevel() {
    if (this.state !== 'playing') return;
    const bonus = 1000 + this.hearts * 200 + this.levelStars * 250;
    this.addScore(bonus);
    this.state = 'clear';
    this.player.vx = 0;
    this.player.vy = 0;
    this.player.invuln = 99;
    this.audio.pauseMusic();
    this.audio.sfx('clear');
    this.shake = 5;
    const px = this.player.x + this.player.w / 2;
    const py = this.player.y + this.player.h / 2;
    this.burst(px, py - 30, { count: 50, colors: ['#ffe672', '#ff8ac4', '#8df7ff', '#9bffcf', '#ffffff'], speed: 320, size: 5, life: 1.7, type: 'confetti', gravity: 420, spin: true });
    this.emitHud();
    const isFinal = this.levelIndex === LEVELS.length - 1;
    const data = {
      levelName: this.level.name,
      world: this.worldIndex,
      worldName: WORLDS[this.worldIndex].name,
      stage: this.level.stage,
      score: this.score,
      coins: this.coins,
      stars: this.levelStars,
      hearts: this.hearts,
      bonus,
      isBoss: this.level.isBoss,
      isFinal,
      nextWorld: !isFinal && Math.floor((this.levelIndex + 1) / 3) !== this.worldIndex,
    };
    if (isFinal) {
      this.finishGame(data);
    } else {
      this.pendingClear = data;
      this.clearTimer = 1.05;
    }
  }

  finishGame(data) {
    this.state = 'victory';
    this.audio.pauseMusic();
    this.audio.sfx('victory');
    this.emitBossBar(null);
    this.pendingVictory = {
      ...data,
      score: this.score,
      coins: this.coins,
      stats: { ...this.stats },
    };
    this.victoryTimer = 1.2;
  }

  // ---------------------------------------------------------------- ambient & particles
  spawnAmbient() {
    this.ambient = [];
    if (!this.level) return;
    const theme = this.level.themeData;
    const count = window.innerWidth < 700 ? 20 : 32;
    for (let i = 0; i < count; i++) {
      this.ambient.push({
        x: this.camera.x + this.rng() * this.viewW,
        y: this.camera.y + this.rng() * this.viewH,
        vx: (this.rng() - 0.5) * 18,
        vy: 6 + this.rng() * 12,
        size: 1.5 + this.rng() * 2.4,
        phase: this.rng() * 9,
        kind: theme.ambient,
      });
    }
  }

  updateAmbient(dt) {
    if (!this.level) return;
    const left = this.camera.x - 80;
    const right = this.camera.x + this.viewW + 80;
    const top = this.camera.y - 80;
    const bottom = this.camera.y + this.viewH + 80;
    for (const a of this.ambient) {
      a.phase += dt;
      if (a.kind === 'snow') {
        a.x += (a.vx + Math.sin(a.phase * 1.3) * 12) * dt;
        a.y += (28 + a.size * 4) * dt;
      } else if (a.kind === 'embers') {
        a.x += (a.vx + Math.sin(a.phase * 2) * 10) * dt;
        a.y -= (18 + a.size * 3) * dt;
      } else if (a.kind === 'fireflies') {
        a.x += (a.vx * 1.5 + Math.sin(a.phase * 0.9) * 9) * dt;
        a.y += (Math.cos(a.phase * 1.1) * 10 - 2) * dt;
      } else if (a.kind === 'spores') {
        a.x += Math.sin(a.phase * 0.7) * 8 * dt;
        a.y -= 8 * dt;
      } else {
        a.x += (a.vx + 14) * dt;
        a.y += Math.sin(a.phase * 1.4) * 7 * dt;
      }
      if (a.x < left) a.x = right;
      if (a.x > right) a.x = left;
      if (a.y < top) a.y = bottom;
      if (a.y > bottom) a.y = top;
    }
  }

  spillAmbient() {
    if (!this.level) return;
    const theme = this.level.themeData;
    const kind = theme.ambient;
    const colors = {
      clouds: ['#ffffff', '#d7f7ff'],
      spores: ['#8ef7ff', '#b58cff'],
      fireflies: ['#eaff9a', '#baffb0'],
      snow: ['#ffffff', '#dbeaff'],
      embers: ['#ff9b5c', '#ff5d72'],
    }[kind] || ['#ffffff'];
    this.ambient = [];
    const count = window.innerWidth < 700 ? 16 : 26;
    for (let i = 0; i < count; i++) {
      this.ambient.push({
        x: this.camera.x + this.rng() * this.viewW,
        y: this.camera.y + this.rng() * this.viewH,
        vx: (this.rng() - 0.5) * 18,
        vy: 6 + this.rng() * 12,
        size: 1.5 + this.rng() * 2.5,
        phase: this.rng() * 9,
        kind,
        color: colors[i % colors.length],
      });
    }
  }

  burst(x, y, {
    count = 8, colors = ['#ffffff'], speed = 120, size = 3, life = 0.6,
    type = 'spark', gravity = 500, spin = false, spread = Math.PI * 2, angle = -Math.PI / 2,
  } = {}) {
    for (let i = 0; i < count; i++) {
      const a = angle + (this.rng() - 0.5) * spread;
      const v = speed * (0.35 + this.rng() * 0.9);
      this.particles.push({
        type,
        x, y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - (type === 'confetti' ? 80 : 0),
        size: size * (0.6 + this.rng() * 0.8),
        color: colors[Math.floor(this.rng() * colors.length)],
        life: life * (0.7 + this.rng() * 0.6),
        maxLife: life,
        gravity,
        rot: this.rng() * Math.PI,
        spin: spin ? (this.rng() - 0.5) * 12 : (this.rng() - 0.5) * 3,
        phase: this.rng() * 9,
      });
    }
  }

  floatingText(text, x, y, color = '#ffffff', size = 17) {
    this.particles.push({
      type: 'text', text, x, y, vx: (this.rng() - 0.5) * 20, vy: -72,
      size, color, life: 0.9, maxLife: 0.9, gravity: -10, rot: 0, spin: 0,
    });
  }

  shockwave(x, y, color = '#ffe672') {
    this.particles.push({
      type: 'ring', x, y, vx: 0, vy: 0, size: 12, color, life: 0.4, maxLife: 0.4, gravity: 0, rot: 0, spin: 0,
    });
  }

  updateParticles(dt) {
    for (const p of this.particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.gravity * dt;
      p.rot += p.spin * dt;
      if (p.type === 'ring') p.size += 120 * dt;
      if (p.type === 'text') p.vy *= 0.985;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
  }

  // ---------------------------------------------------------------- UI bridge
  emitHud() {
    if (!this.level) return;
    const world = WORLDS[this.worldIndex];
    this.onHud?.({
      hearts: Math.max(0, this.hearts),
      maxHearts: this.maxHearts,
      coins: this.coins,
      score: this.score,
      stars: this.levelStars,
      world: this.worldIndex + 1,
      worldName: world.name,
      stage: this.level.stage,
      stageName: this.inBonus ? (this.level.bonusKind === 'vault' ? 'Cofre Estelar' : 'Sala Secreta') : this.level.name,
      isBoss: Boolean(this.level.isBoss || this.boss),
      inBonus: this.inBonus,
    });
  }

  emitBossBar(data) {
    this.onBossBar?.(data);
  }

  toast(message, kind = 'info') {
    this.onToast?.(message, kind);
  }

  onBanner(info) { this.callbacks.onBanner?.(info); }
  onHud(info) { this.callbacks.onHud?.(info); }
  onToast(message, kind) { this.callbacks.onToast?.(message, kind); }
  onPause(visible) { this.callbacks.onPause?.(visible); }
  onGameOver(data) { this.callbacks.onGameOver?.(data); }
  onTitle(visible) { this.callbacks.onTitle?.(visible); }
  onBossBar(data) { this.callbacks.onBossBar?.(data); }
}

// The gameplay, enemy and rendering code lives in focused modules that extend the class.
installPlayer(Game);
installEnemies(Game);
installBoss(Game);
installInteractions(Game);
installRenderer(Game);

export const gameConstants = { PLAYER_SPEED, RUN_SPEED, JUMP_SPEED, GRAVITY, MAX_FALL };

import { Game } from './game.js';
import { AudioEngine } from './audio.js';
import { Input } from './input.js';
import { formatScore } from './config.js';

const $ = (id) => document.getElementById(id);

const els = {
  canvas: $('game-canvas'),
  hud: $('hud'),
  hearts: $('hearts'),
  world: $('world-label'),
  stage: $('stage-label'),
  stageName: $('stage-name'),
  coins: $('coin-count'),
  stars: $('star-count'),
  score: $('score-value'),
  sound: $('btn-sound'),
  pause: $('btn-pause'),
  bossBar: $('boss-bar'),
  bossName: $('boss-name'),
  bossTitle: $('boss-title'),
  bossFill: $('boss-fill'),
  banner: $('banner'),
  bannerKicker: $('banner-kicker'),
  bannerTitle: $('banner-title'),
  bannerSub: $('banner-sub'),
  toast: $('toast'),
  toastIcon: $('toast-icon'),
  toastText: $('toast-text'),
  title: $('title-screen'),
  highScore: $('high-score'),
  play: $('btn-play'),
  tilt: $('btn-tilt'),
  tiltPause: $('btn-tilt-pause'),
  pauseScreen: $('pause-screen'),
  resume: $('btn-resume'),
  restart: $('btn-restart'),
  menu: $('btn-menu'),
  clearScreen: $('clear-screen'),
  clearLevel: $('clear-level'),
  clearStars: $('clear-stars'),
  clearCoins: $('clear-coins'),
  clearBonus: $('clear-bonus'),
  clearScore: $('clear-score'),
  clearNote: $('clear-note'),
  next: $('btn-next'),
  gameoverScreen: $('gameover-screen'),
  gameoverLevel: $('gameover-level'),
  gameoverScore: $('gameover-score'),
  gameoverCoins: $('gameover-coins'),
  retry: $('btn-retry'),
  gameoverMenu: $('btn-gameover-menu'),
  victoryScreen: $('victory-screen'),
  victoryScore: $('victory-score'),
  victoryCoins: $('victory-coins'),
  victoryStars: $('victory-stars'),
  victoryEnemies: $('victory-enemies'),
  victoryRecord: $('victory-record'),
  victoryRestart: $('btn-victory-restart'),
  victoryMenu: $('btn-victory-menu'),
};

const STORAGE_MUTE = 'mundo-dos-cogumelos:muted';
const STORAGE_RECORD = 'mundo-dos-cogumelos:record';

function readStorage(key, fallback) {
  try {
    const value = window.localStorage.getItem(key);
    return value == null ? fallback : value;
  } catch {
    return fallback;
  }
}

function writeStorage(key, value) {
  try { window.localStorage.setItem(key, String(value)); } catch { /* private mode */ }
}

let muted = readStorage(STORAGE_MUTE, '0') === '1';
let highScore = Math.max(0, Number(readStorage(STORAGE_RECORD, 0)) || 0);
let heartCount = -1;
let bannerTimer = 0;
let toastTimer = 0;
let toastHideTimer = 0;
let tiltLabel = 'Inclinação';

const audio = new AudioEngine();
audio.setMuted(muted);
document.body.classList.toggle('muted', muted);

let game = null;

const input = new Input({
  onFirstGesture: () => {
    audio.unlock();
    if (game && game.state === 'title') audio.startMusic('title');
  },
  onPause: () => {
    if (game && (game.state === 'playing' || game.state === 'paused')) game.togglePause();
  },
  onMute: () => toggleMute(),
  onTiltStatus: (message) => {
    showToast(message, 'info');
    updateTiltButtons();
  },
});

game = new Game({
  canvas: els.canvas,
  audio,
  input,
  callbacks: {
    onBanner,
    onHud,
    onToast: showToast,
    onPause,
    onGameOver,
    onLevelClear,
    onVictory,
    onBossBar,
    onTitle,
  },
});

// -------------------------------------------------------------------- UI helpers
function updateHighScore(value) {
  if (value > highScore) {
    highScore = value;
    writeStorage(STORAGE_RECORD, highScore);
  }
  els.highScore.textContent = `Recorde: ${formatScore(highScore)}`;
}

function setPlayingUi(active) {
  document.body.classList.toggle('is-playing', Boolean(active));
}

function hideDialog(el) {
  el.classList.add('hidden');
}

function hideAllDialogs() {
  [els.pauseScreen, els.clearScreen, els.gameoverScreen, els.victoryScreen].forEach(hideDialog);
}

function onTitle(visible) {
  els.title.classList.toggle('hidden', !visible);
  els.hud.classList.toggle('hidden', visible);
  setPlayingUi(!visible);
  if (visible) {
    hideAllDialogs();
    hideBanner();
    hideToast();
    els.bossBar.classList.add('hidden');
    updateHighScore(game ? game.score : 0);
    audio.startMusic('title');
  }
}

function onHud(info) {
  els.world.textContent = `Mundo ${info.world}`;
  els.stage.textContent = `Fase ${info.stage}`;
  els.stageName.textContent = info.stageName;
  els.coins.textContent = String(info.coins);
  els.stars.textContent = info.isBoss ? '★ —' : `★ ${info.stars}/3`;
  els.score.textContent = formatScore(info.score);

  if (heartCount !== info.maxHearts) {
    heartCount = info.maxHearts;
    els.hearts.innerHTML = '';
    for (let i = 0; i < info.maxHearts; i++) {
      const heart = document.createElement('span');
      heart.className = 'heart';
      heart.textContent = '♥';
      els.hearts.appendChild(heart);
    }
  }
  const hearts = els.hearts.children;
  for (let i = 0; i < hearts.length; i++) {
    const filled = i < info.hearts;
    const node = hearts[i];
    if (node.classList.contains('empty') && filled) {
      node.classList.remove('empty');
      node.classList.remove('beat');
      void node.offsetWidth;
      node.classList.add('beat');
    } else if (!node.classList.contains('empty') && !filled) {
      node.classList.add('empty');
    }
  }
}

function onBanner(info) {
  window.clearTimeout(bannerTimer);
  els.bannerKicker.textContent = `Mundo ${info.world + 1} · ${info.worldName}`;
  els.bannerTitle.textContent = info.name;
  els.bannerSub.textContent = info.isBoss ? `Fase ${info.stage} · Chefe` : `Fase ${info.stage}`;
  els.banner.classList.remove('hidden', 'fade');
  void els.banner.offsetWidth;
  bannerTimer = window.setTimeout(() => {
    els.banner.classList.add('fade');
    bannerTimer = window.setTimeout(() => {
      els.banner.classList.add('hidden');
      els.banner.classList.remove('fade');
    }, 460);
  }, 2200);
}

function hideBanner() {
  window.clearTimeout(bannerTimer);
  els.banner.classList.add('hidden');
  els.banner.classList.remove('fade');
}

function showToast(message, kind = 'info') {
  window.clearTimeout(toastTimer);
  window.clearTimeout(toastHideTimer);
  const icons = { star: '★', heart: '♥', warn: '!', info: '✦' };
  els.toastIcon.textContent = icons[kind] || '✦';
  els.toastText.textContent = message;
  els.toast.className = `toast ${kind}`;
  void els.toast.offsetWidth;
  toastTimer = window.setTimeout(() => {
    els.toast.classList.add('toast-out');
    toastHideTimer = window.setTimeout(() => {
      els.toast.classList.add('hidden');
      els.toast.classList.remove('toast-out');
    }, 320);
  }, 2500);
}

function hideToast() {
  window.clearTimeout(toastTimer);
  window.clearTimeout(toastHideTimer);
  els.toast.classList.add('hidden');
  els.toast.classList.remove('toast-out');
}

function onPause(visible) {
  els.pauseScreen.classList.toggle('hidden', !visible);
  if (visible) {
    setPlayingUi(false);
    updateTiltButtons();
  } else if (game && (game.state === 'playing' || game.state === 'clear')) {
    setPlayingUi(true);
  }
}

function onBossBar(data) {
  if (!data) {
    els.bossBar.classList.add('hidden');
    els.bossBar.classList.remove('defeated');
    return;
  }
  els.bossName.textContent = data.name || 'Chefe';
  els.bossTitle.textContent = data.title || '';
  const ratio = data.maxHp > 0 ? Math.max(0, Math.min(1, data.hp / data.maxHp)) : 0;
  els.bossFill.style.width = `${ratio * 100}%`;
  els.bossBar.classList.remove('hidden');
  els.bossBar.classList.toggle('defeated', Boolean(data.defeated));
}

function onGameOver(data) {
  updateHighScore(data.score);
  els.gameoverLevel.textContent = `${data.levelName} · Mundo ${data.world + 1}, Fase ${data.stage}`;
  els.gameoverScore.textContent = formatScore(data.score);
  els.gameoverCoins.textContent = String(data.coins);
  hideAllDialogs();
  els.gameoverScreen.classList.remove('hidden');
  setPlayingUi(false);
  hideBanner();
}

function onLevelClear(data) {
  updateHighScore(data.score);
  els.clearLevel.textContent = `${data.worldName} · ${data.levelName}`;
  els.clearStars.textContent = `★ ${data.stars}`;
  els.clearCoins.textContent = String(data.coins);
  els.clearBonus.textContent = `+${data.bonus}`;
  els.clearScore.textContent = formatScore(data.score);
  if (data.nextWorld) els.clearNote.textContent = 'Um novo mundo se abre no horizonte!';
  else if (data.isBoss) els.clearNote.textContent = 'Chefe derrotado! O caminho está livre.';
  else els.clearNote.textContent = 'As estrelas brilham um pouco mais forte.';
  hideAllDialogs();
  els.clearScreen.classList.remove('hidden');
  setPlayingUi(false);
  hideBanner();
}

function onVictory(data) {
  updateHighScore(data.score);
  const previous = Number(readStorage(STORAGE_RECORD, 0)) || 0;
  els.victoryScore.textContent = formatScore(data.score);
  els.victoryCoins.textContent = String(data.coins);
  els.victoryStars.textContent = String(data.stats?.stars ?? 0);
  els.victoryEnemies.textContent = String(data.stats?.enemies ?? 0);
  els.victoryRecord.textContent = data.score >= previous
    ? 'Novo recorde do reino! Todas as estrelas voltaram para casa.'
    : `Recorde do reino: ${formatScore(highScore)}`;
  hideAllDialogs();
  els.victoryScreen.classList.remove('hidden');
  setPlayingUi(false);
  hideBanner();
}

function updateTiltButtons() {
  const active = input.tiltEnabled;
  const label = active ? 'Inclinação ligada' : tiltLabel;
  if (els.tilt) els.tilt.textContent = label;
  if (els.tiltPause) els.tiltPause.textContent = label;
  [els.tilt, els.tiltPause].forEach((button) => {
    if (button) button.classList.toggle('btn-secondary', active);
  });
}

function toggleMute() {
  muted = !muted;
  audio.setMuted(muted);
  document.body.classList.toggle('muted', muted);
  writeStorage(STORAGE_MUTE, muted ? '1' : '0');
  showToast(muted ? 'Som desligado.' : 'Som ligado!', 'info');
}

function goToTitle() {
  hideBanner();
  hideToast();
  hideAllDialogs();
  game.quitToTitle();
  setPlayingUi(false);
}

function startAdventure() {
  audio.unlock();
  audio.sfx('select');
  els.title.classList.add('hidden');
  hideAllDialogs();
  hideBanner();
  game.startGame();
  els.hud.classList.remove('hidden');
  setPlayingUi(true);
  updateHighScore(game.score);
}

// -------------------------------------------------------------------- buttons
els.play.addEventListener('click', startAdventure);

els.sound.addEventListener('click', toggleMute);

els.pause.addEventListener('click', () => {
  if (game.state === 'playing' || game.state === 'paused') game.togglePause();
});

els.resume.addEventListener('click', () => {
  if (game.state === 'paused') game.togglePause();
});

els.restart.addEventListener('click', () => {
  hideAllDialogs();
  game.retryLevel();
  setPlayingUi(true);
});

els.menu.addEventListener('click', goToTitle);
els.gameoverMenu.addEventListener('click', goToTitle);

els.retry.addEventListener('click', () => {
  hideAllDialogs();
  game.retryLevel();
  setPlayingUi(true);
});

els.next.addEventListener('click', () => {
  hideAllDialogs();
  game.nextLevel();
  setPlayingUi(game.state === 'playing');
});

els.victoryRestart.addEventListener('click', startAdventure);
els.victoryMenu.addEventListener('click', goToTitle);

for (const button of [els.tilt, els.tiltPause]) {
  button?.addEventListener('click', async () => {
    audio.unlock();
    await input.enableTilt();
    updateTiltButtons();
  });
}

// Any tap should unlock WebAudio, even before the player finds Play.
window.addEventListener('pointerdown', () => input.gesture(), { once: true });

// A small debug handle used by the development smoke tests.
window.__mundo = { game, input, audio };

// -------------------------------------------------------------------- viewport
function resize() {
  game.resize();
}

if ('ResizeObserver' in window) {
  const observer = new ResizeObserver(resize);
  observer.observe(els.canvas);
} else {
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 120));
}
window.addEventListener('resize', resize);
game.resize();
updateHighScore(0);
updateTiltButtons();

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    input.releaseAll();
    game.autoPause();
  }
});

// -------------------------------------------------------------------- main loop
const STEP = 1 / 60;
let last = performance.now();
let accumulator = 0;

function frame(now) {
  const elapsed = Math.min(0.1, Math.max(0, (now - last) / 1000));
  last = now;
  accumulator += elapsed;

  input.pollGamepad();
  if (input.consumePause() && (game.state === 'playing' || game.state === 'paused')) {
    game.togglePause();
  }

  let steps = 0;
  while (accumulator >= STEP && steps < 6) {
    game.update(STEP);
    accumulator -= STEP;
    steps++;
    if (game.state === 'paused' || game.state === 'gameover' || game.state === 'victory') {
      accumulator = 0;
      break;
    }
  }

  game.render();
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);

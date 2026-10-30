// Shared constants and theme palettes for Mundo dos Cogumelos.
export const TILE = 48;
export const LEVEL_ROWS = 20;
export const GROUND_ROW = 13;
export const GAME_HEIGHT = 540;
export const MIN_VIEW_WIDTH = 360;
export const MAX_VIEW_WIDTH = 1180;

export const T = {
  EMPTY: 0,
  GROUND: 1,
  BRICK: 2,
  QUESTION: 3,
  USED: 4,
  PIPE: 5,
  PLATFORM: 6,
  SPIKE: 7,
  LAVA: 8,
  CASTLE: 9,
  CRYSTAL: 10,
  BOUNCE: 11,
  CLOUD: 12,
};

export const SOLID_TILES = new Set([
  T.GROUND, T.BRICK, T.QUESTION, T.USED, T.PIPE, T.PLATFORM,
  T.CASTLE, T.CRYSTAL, T.BOUNCE, T.CLOUD,
]);
export const HAZARD_TILES = new Set([T.SPIKE, T.LAVA]);

export const THEMES = {
  plains: {
    id: 'plains',
    name: 'Planícies Verdes',
    song: 'plains',
    skyTop: '#4fbdf0',
    skyMid: '#9fe7ff',
    skyBottom: '#e7fbff',
    glow: '#fff3a8',
    far1: '#b8e5a5',
    far2: '#86cf82',
    far3: '#57b45f',
    ground: '#8a5a32',
    groundDark: '#6b4224',
    grass: '#5acb55',
    grassLight: '#8ee36d',
    stone: '#c9a06a',
    platform: '#b97b45',
    platformTop: '#e0b375',
    brick: '#c97a3f',
    brickDark: '#8f4d27',
    pipe: '#3fbf67',
    pipeLight: '#8df5a1',
    pipeDark: '#1f7d48',
    accent: '#ffd84d',
    accent2: '#ff8ac4',
    ambient: 'clouds',
    dark: false,
    hazard: '#f25f5c',
  },
  cave: {
    id: 'cave',
    name: 'Cavernas de Cristal',
    song: 'cave',
    skyTop: '#160f2f',
    skyMid: '#281a4e',
    skyBottom: '#3d2a66',
    glow: '#86e8ff',
    far1: '#241744',
    far2: '#31205b',
    far3: '#412d72',
    ground: '#3b2a5c',
    groundDark: '#241739',
    grass: '#7b5fc4',
    grassLight: '#a88ce9',
    stone: '#5b448f',
    platform: '#493170',
    platformTop: '#8a6ad0',
    brick: '#4b386f',
    brickDark: '#2a1c44',
    pipe: '#3aa9a3',
    pipeLight: '#82f3e8',
    pipeDark: '#1e6a6b',
    accent: '#7ff5ff',
    accent2: '#d68bff',
    ambient: 'spores',
    dark: true,
    hazard: '#ff9b52',
  },
  forest: {
    id: 'forest',
    name: 'Floresta Misteriosa',
    song: 'forest',
    skyTop: '#123c4a',
    skyMid: '#1e5f5f',
    skyBottom: '#5fb28a',
    glow: '#d8ffb0',
    far1: '#1b4a44',
    far2: '#255e50',
    far3: '#2f7460',
    ground: '#4c3a2c',
    groundDark: '#31251d',
    grass: '#4caf68',
    grassLight: '#86dc8a',
    stone: '#7a6a52',
    platform: '#6a4d33',
    platformTop: '#9e7d51',
    brick: '#6d5136',
    brickDark: '#43301f',
    pipe: '#4ab878',
    pipeLight: '#a2f2b4',
    pipeDark: '#246544',
    accent: '#ffd95e',
    accent2: '#9bffcf',
    ambient: 'fireflies',
    dark: true,
    hazard: '#d94949',
  },
  mountain: {
    id: 'mountain',
    name: 'Montanhas Celestes',
    song: 'mountain',
    skyTop: '#2f4f9e',
    skyMid: '#7f8fe0',
    skyBottom: '#ffc6a3',
    glow: '#fff1c9',
    far1: '#d9e6ff',
    far2: '#a7bce8',
    far3: '#7d93c9',
    ground: '#6a7290',
    groundDark: '#464e6b',
    grass: '#dfeaff',
    grassLight: '#ffffff',
    stone: '#8892ad',
    platform: '#7783a5',
    platformTop: '#c8d5ef',
    brick: '#8b7890',
    brickDark: '#5f506b',
    pipe: '#61a8bf',
    pipeLight: '#b5f0ff',
    pipeDark: '#38697e',
    accent: '#ffe07a',
    accent2: '#ff9fc6',
    ambient: 'snow',
    dark: false,
    hazard: '#ff7a67',
  },
  castle: {
    id: 'castle',
    name: 'Castelo do Rei Corvo',
    song: 'castle',
    skyTop: '#170c27',
    skyMid: '#2b1438',
    skyBottom: '#5a2138',
    glow: '#ff9b6a',
    far1: '#251028',
    far2: '#341533',
    far3: '#4b1d3e',
    ground: '#4a414f',
    groundDark: '#2b2532',
    grass: '#6c5d70',
    grassLight: '#8d7c8f',
    stone: '#5c5266',
    platform: '#4e4358',
    platformTop: '#8a7898',
    brick: '#5b4a5f',
    brickDark: '#362a3a',
    pipe: '#8a5560',
    pipeLight: '#d29aa6',
    pipeDark: '#4b2b34',
    accent: '#ffb347',
    accent2: '#ff5e7a',
    ambient: 'embers',
    dark: true,
    hazard: '#ff6b4a',
  },
};

export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export const lerp = (a, b, t) => a + (b - a) * t;
export const approach = (value, target, delta) => {
  if (value < target) return Math.min(value + delta, target);
  if (value > target) return Math.max(value - delta, target);
  return target;
};

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const rectsOverlap = (a, b) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

export const cx = (e) => e.x + e.w / 2;
export const cy = (e) => e.y + e.h / 2;

export function formatScore(n) {
  return String(Math.max(0, Math.floor(n))).padStart(6, '0');
}

import {
  TILE, LEVEL_ROWS, GROUND_ROW, T, SOLID_TILES, THEMES, mulberry32, clamp,
} from './config.js';

export class LevelBuilder {
  constructor({ width, theme, seed = 7, world = 0, stage = 0, name = '' }) {
    this.width = width;
    this.height = LEVEL_ROWS;
    this.theme = theme;
    this.world = world;
    this.stage = stage;
    this.name = name;
    this.seed = seed + width * 17 + world * 101 + stage * 31;
    this.tiles = new Uint8Array(width * LEVEL_ROWS);
    this.blockContents = new Map();
    this.enemySpawns = [];
    this.coinSpawns = [];
    this.starSpawns = [];
    this.checkpointSpawns = [];
    this.pipes = [];
    this.decor = [];
    this.gate = null;
    this.goal = null;
    this.returnPortal = null;
    this.boss = null;
    this.spawnFeet = { x: 2.5 * TILE, row: GROUND_ROW };
    this.bossTrigger = null;
  }

  idx(col, row) {
    return row * this.width + col;
  }

  inside(col, row) {
    return col >= 0 && col < this.width && row >= 0 && row < this.height;
  }

  get(col, row) {
    if (!this.inside(col, row)) return col < 0 || col >= this.width ? T.GROUND : T.EMPTY;
    return this.tiles[this.idx(col, row)];
  }

  set(col, row, type) {
    if (!this.inside(col, row)) return;
    this.tiles[this.idx(col, row)] = type;
  }

  groundAll(top = GROUND_ROW) {
    for (let c = 0; c < this.width; c++) {
      for (let r = top; r < this.height; r++) this.set(c, r, T.GROUND);
    }
    return this;
  }

  raise(col, width, top) {
    for (let c = col; c < col + width; c++) {
      for (let r = top; r < this.height; r++) this.set(c, r, T.GROUND);
    }
    return this;
  }

  pit(col, width, lava = false) {
    for (let c = col; c < col + width; c++) {
      for (let r = GROUND_ROW; r < this.height; r++) this.set(c, r, T.EMPTY);
      if (lava) {
        this.set(c, this.height - 2, T.LAVA);
        this.set(c, this.height - 1, T.LAVA);
      }
    }
    return this;
  }

  platform(col, row, width, type = T.PLATFORM) {
    for (let c = col; c < col + width; c++) this.set(c, row, type);
    return this;
  }

  bricks(col, row, width) {
    for (let c = col; c < col + width; c++) this.set(c, row, T.BRICK);
    return this;
  }

  question(col, row, item = 'coin') {
    this.set(col, row, T.QUESTION);
    this.blockContents.set(`${col},${row}`, item);
    return this;
  }

  hidden(item, col, row) {
    this.set(col, row, T.QUESTION);
    this.blockContents.set(`${col},${row}`, item);
    return this;
  }

  pipe(col, topRow, height, { secret = false } = {}) {
    for (let c = col; c < col + 2; c++) {
      for (let r = topRow; r < topRow + height; r++) this.set(c, r, T.PIPE);
    }
    this.pipes.push({
      x: col * TILE,
      y: topRow * TILE,
      w: 2 * TILE,
      h: height * TILE,
      topRow,
      secret,
      glow: secret,
    });
    return this;
  }

  spikes(col, row, width = 1) {
    for (let c = col; c < col + width; c++) this.set(c, row, T.SPIKE);
    return this;
  }

  lava(col, row, width = 1) {
    for (let c = col; c < col + width; c++) this.set(c, row, T.LAVA);
    return this;
  }

  bounce(col, row) {
    this.set(col, row, T.BOUNCE);
    return this;
  }

  crystal(col, row, width = 1) {
    for (let c = col; c < col + width; c++) this.set(c, row, T.CRYSTAL);
    return this;
  }

  coin(col, row) {
    this.coinSpawns.push({ x: (col + 0.5) * TILE, y: (row + 0.5) * TILE });
    return this;
  }

  coinLine(col, row, width) {
    for (let c = 0; c < width; c++) this.coin(col + c, row);
    return this;
  }

  coinArc(col, row, width, peak = 2) {
    for (let i = 0; i < width; i++) {
      const t = width <= 1 ? 0.5 : i / (width - 1);
      const lift = Math.round(Math.sin(Math.PI * t) * peak);
      this.coin(col + i, row - lift);
    }
    return this;
  }

  coinRing(col, row, radius = 2) {
    const points = [
      [-radius, 0], [-radius + 1, -1], [0, -radius], [1, -radius + 1],
      [radius, 0], [radius - 1, 1], [0, radius], [-1, radius - 1],
    ];
    for (const [dx, dy] of points) this.coin(col + dx, row + dy);
    return this;
  }

  star(col, row) {
    this.starSpawns.push({ x: (col + 0.5) * TILE, y: (row + 0.5) * TILE, collected: false });
    return this;
  }

  enemy(type, col, row, opts = {}) {
    this.enemySpawns.push({ type, x: (col + 0.5) * TILE, feetRow: row, ...opts });
    return this;
  }

  checkpoint(col, row) {
    this.checkpointSpawns.push({ x: (col + 0.5) * TILE, feetRow: row });
    return this;
  }

  goalAt(col, row) {
    this.goal = { x: (col + 0.5) * TILE, feetRow: row };
    return this;
  }

  starGate(col, row, required = 3) {
    this.gate = { x: (col + 0.5) * TILE, feetRow: row, required };
    return this;
  }

  returnAt(col, row) {
    this.returnPortal = { x: (col + 0.5) * TILE, feetRow: row };
    return this;
  }

  spawnAt(col, row) {
    this.spawnFeet = { x: (col + 0.5) * TILE, row };
    return this;
  }

  bossAt(type, name, col, row, triggerCol) {
    this.boss = { type, name, x: (col + 0.5) * TILE, feetRow: row };
    this.bossTrigger = triggerCol * TILE;
    return this;
  }

  surfaceAt(col) {
    for (let row = 0; row < this.height; row++) {
      const tile = this.get(col, row);
      if (tile === T.GROUND || tile === T.CASTLE) return row;
    }
    return null;
  }

  generateDecor() {
    const rng = mulberry32(this.seed);
    const theme = this.theme;
    const types = {
      plains: ['tree', 'bush', 'flower', 'mushroom', 'grass', 'tree', 'bush'],
      cave: ['crystalDecor', 'mushroomGlow', 'stalagmite', 'rock', 'crystalDecor', 'mushroomGlow'],
      forest: ['bigTree', 'fern', 'mushroomGlow', 'bush', 'vineTree', 'flower'],
      mountain: ['pine', 'rock', 'flower', 'pine', 'bush', 'flag'],
      castle: ['pillar', 'torch', 'banner', 'chain', 'statue', 'torch'],
    }[theme] || ['bush'];
    let col = 2;
    while (col < this.width - 2) {
      col += 2 + Math.floor(rng() * 5);
      const surface = this.surfaceAt(col);
      if (surface == null) continue;
      let occupied = false;
      for (let r = surface - 3; r <= surface; r++) {
        if (this.get(col, r) !== T.EMPTY && r < surface) occupied = true;
      }
      if (occupied) continue;
      const type = types[Math.floor(rng() * types.length)];
      this.decor.push({
        type,
        x: col * TILE + TILE / 2,
        y: surface * TILE,
        size: 0.75 + rng() * 0.7,
        variant: Math.floor(rng() * 999),
        front: rng() < 0.12,
      });
    }
  }

  finish() {
    this.generateDecor();
  }
}

export class Level {
  constructor(def) {
    const builder = new LevelBuilder(def);
    def.build(builder);
    builder.finish();
    this.def = def;
    this.name = def.name;
    this.theme = def.theme;
    this.world = def.world;
    this.stage = def.stage;
    this.width = builder.width;
    this.height = builder.height;
    this.pixelWidth = this.width * TILE;
    this.pixelHeight = this.height * TILE;
    this.tiles = builder.tiles;
    this.blockContents = builder.blockContents;
    this.enemySpawns = builder.enemySpawns;
    this.coinSpawns = builder.coinSpawns;
    this.starSpawns = builder.starSpawns;
    this.checkpointSpawns = builder.checkpointSpawns;
    this.pipes = builder.pipes;
    this.decor = builder.decor;
    this.spawnFeet = builder.spawnFeet;
    this.gate = builder.gate;
    this.goal = builder.goal;
    this.returnPortal = builder.returnPortal;
    this.boss = builder.boss;
    this.bossTrigger = builder.bossTrigger;
    this.isBoss = Boolean(def.bossType);
    this.bossType = def.bossType || null;
    this.bossName = def.bossName || null;
    this.bonusKind = null;
    this.themeData = THEMES[this.theme];
  }

  tileAt(col, row) {
    if (col < 0 || col >= this.width) return T.GROUND;
    if (row < 0 || row >= this.height) return T.EMPTY;
    return this.tiles[row * this.width + col];
  }

  solidAt(col, row) {
    return SOLID_TILES.has(this.tileAt(col, row));
  }

  tileAtPixel(x, y) {
    return this.tileAt(Math.floor(x / TILE), Math.floor(y / TILE));
  }

  surfaceAt(col) {
    for (let row = 0; row < this.height; row++) {
      const tile = this.tileAt(col, row);
      if (tile === T.GROUND || tile === T.CASTLE) return row;
    }
    return null;
  }

  clampColumn(col) {
    return clamp(col, 0, this.width - 1);
  }
}

const stage = (world, stageNumber, name, theme, width, build, extra = {}) => ({
  world, stage: stageNumber, name, theme, width, build, seed: world * 47 + stageNumber * 13 + 5, ...extra,
});

// ---------------------------------------------------------------- world 1
const level1_1 = stage(0, 1, 'Colinas de Cogumelo', 'plains', 152, (B) => {
  B.groundAll(13);
  B.raise(48, 8, 12);
  B.raise(118, 8, 11);
  B.pit(36, 3);
  B.pit(68, 4);
  B.pit(104, 3);
  B.pit(128, 3);
  B.platform(13, 10, 4);
  B.platform(29, 9, 3);
  B.platform(43, 10, 4);
  B.platform(56, 8, 3);
  B.platform(75, 10, 4);
  B.platform(89, 9, 3);
  B.platform(110, 10, 4);
  B.platform(134, 8, 3);
  B.bricks(17, 10, 2);
  B.question(19, 10, 'heart');
  B.question(11, 10, 'coin');
  B.question(91, 6, 'star');
  B.hidden('coin', 44, 10);
  B.question(113, 8, 'coin');
  B.pipe(24, 11, 2);
  B.pipe(52, 10, 2, { secret: true });
  B.coinLine(5, 12, 5);
  B.coinArc(35, 11, 5, 2);
  B.coinLine(40, 12, 3);
  B.coinArc(67, 11, 6, 2);
  B.coinLine(78, 12, 4);
  B.coinArc(103, 11, 5, 2);
  B.coinArc(127, 11, 5, 2);
  B.coinLine(139, 12, 5);
  B.coinRing(31, 7, 2);
  B.star(16, 8);
  B.star(57, 6);
  B.star(121, 9);
  B.starGate(124, 11);
  B.checkpoint(80, 13);
  B.goalAt(147, 13);
  B.spawnAt(2, 13);
  B.enemy('fungus', 21, 13);
  B.enemy('fungus', 32, 13);
  B.enemy('bee', 41, 10);
  B.enemy('turtle', 63, 13);
  B.enemy('fungus', 73, 13);
  B.enemy('spiky', 86, 13);
  B.enemy('bee', 97, 9);
  B.enemy('turtle', 108, 13);
  B.enemy('fungus', 116, 13);
  B.enemy('spiky', 137, 13);
  B.enemy('fungus', 143, 13);
  B.enemy('fungus', 149, 13, { speed: 58 });
});

const level1_2 = stage(0, 2, 'Vale dos Ecos', 'plains', 174, (B) => {
  B.groundAll(13);
  B.raise(20, 8, 12);
  B.raise(70, 10, 11);
  B.raise(132, 9, 12);
  B.pit(36, 4);
  B.pit(54, 5);
  B.pit(88, 5);
  B.pit(112, 4);
  B.pit(150, 4);
  B.platform(9, 10, 4);
  B.platform(16, 8, 3);
  B.platform(31, 10, 3);
  B.platform(42, 10, 3);
  B.platform(48, 8, 3);
  B.platform(58, 10, 3);
  B.platform(64, 8, 3);
  B.platform(78, 10, 4);
  B.platform(84, 8, 3);
  B.platform(96, 10, 4);
  B.platform(104, 8, 3);
  B.platform(118, 10, 4);
  B.platform(126, 8, 3);
  B.platform(140, 10, 4);
  B.platform(156, 9, 3);
  B.bricks(23, 10, 3);
  B.question(26, 10, 'heart');
  B.question(45, 8, 'coin');
  B.question(82, 6, 'star');
  B.question(120, 8, 'coin');
  B.hidden('coin', 142, 10);
  B.pipe(27, 10, 2, { secret: true });
  B.pipe(122, 11, 2);
  B.coinLine(4, 12, 4);
  B.coinArc(35, 11, 5, 2);
  B.coinArc(53, 10, 7, 3);
  B.coinLine(59, 12, 3);
  B.coinArc(87, 10, 7, 3);
  B.coinLine(98, 12, 4);
  B.coinArc(111, 11, 6, 2);
  B.coinArc(149, 10, 6, 2);
  B.coinLine(159, 12, 5);
  B.coinRing(107, 7, 2);
  B.bounce(108, 12);
  B.star(17, 6);
  B.star(50, 6);
  B.star(137, 10);
  B.starGate(144, 13);
  B.checkpoint(76, 11);
  B.checkpoint(128, 13);
  B.goalAt(169, 13);
  B.spawnAt(2, 13);
  B.enemy('fungus', 12, 13);
  B.enemy('bee', 22, 9);
  B.enemy('turtle', 33, 13);
  B.enemy('fungus', 41, 13);
  B.enemy('bee', 48, 6);
  B.enemy('spiky', 62, 13);
  B.enemy('turtle', 74, 11);
  B.enemy('fungus', 80, 13);
  B.enemy('bee', 92, 9);
  B.enemy('spiky', 99, 13);
  B.enemy('turtle', 106, 13);
  B.enemy('fungus', 116, 13);
  B.enemy('bee', 130, 9);
  B.enemy('spiky', 138, 12);
  B.enemy('turtle', 146, 13);
  B.enemy('fungus', 161, 13);
  B.enemy('bee', 165, 9);
});

const boss1 = stage(0, 3, 'Castelo do Rei Cogumelo', 'plains', 34, (B) => {
  B.groundAll(13);
  B.question(7, 8, 'heart');
  B.platform(6, 9, 4);
  B.platform(14, 8, 5);
  B.platform(23, 9, 4);
  B.bricks(11, 10, 2);
  B.coinRing(15, 6, 2);
  B.checkpoint(4, 13);
  B.spawnAt(3, 13);
  B.goalAt(30, 13);
  B.bossAt('mushroomKing', 'Rei Cogumelo', 23, 13, 13);
  B.enemy('fungus', 15, 13, { minion: true });
  B.enemy('fungus', 18, 13, { minion: true });
}, { bossType: 'mushroomKing', bossName: 'Rei Cogumelo' });

// ---------------------------------------------------------------- world 2
const level2_1 = stage(1, 1, 'Gruta dos Cristais', 'cave', 160, (B) => {
  B.groundAll(13);
  B.raise(42, 9, 12);
  B.raise(94, 8, 12);
  B.pit(28, 4, true);
  B.pit(60, 5, true);
  B.pit(118, 4, true);
  B.pit(140, 4, true);
  B.platform(8, 10, 4);
  B.platform(17, 9, 3);
  B.platform(34, 10, 4);
  B.platform(50, 9, 4);
  B.platform(56, 7, 3);
  B.platform(68, 10, 4);
  B.platform(76, 8, 3);
  B.platform(86, 10, 4);
  B.platform(103, 9, 4);
  B.platform(111, 7, 3);
  B.platform(126, 10, 4);
  B.platform(134, 8, 3);
  B.platform(147, 10, 4);
  B.spikes(22, 12, 3);
  B.spikes(82, 12, 2);
  B.spikes(108, 12, 3);
  B.question(13, 9, 'heart');
  B.question(46, 8, 'coin');
  B.bricks(47, 10, 2);
  B.crystal(71, 12, 2);
  B.crystal(130, 12, 2);
  B.pipe(44, 10, 2, { secret: true });
  B.coinLine(4, 12, 5);
  B.coinArc(27, 10, 6, 3);
  B.coinLine(37, 12, 4);
  B.coinArc(59, 9, 7, 3);
  B.coinArc(117, 10, 6, 3);
  B.coinArc(139, 10, 6, 3);
  B.coinLine(150, 12, 5);
  B.coinRing(78, 6, 2);
  B.star(18, 7);
  B.star(57, 5);
  B.star(112, 5);
  B.starGate(100, 12);
  B.checkpoint(74, 13);
  B.goalAt(155, 13);
  B.spawnAt(2, 13);
  B.enemy('bat', 20, 9);
  B.enemy('fungus', 25, 13, { tint: 'cave' });
  B.enemy('spiky', 49, 12);
  B.enemy('bat', 55, 7);
  B.enemy('ghost', 65, 10);
  B.enemy('fungus', 72, 13, { tint: 'cave' });
  B.enemy('bat', 90, 8);
  B.enemy('spiky', 98, 12);
  B.enemy('ghost', 108, 9);
  B.enemy('bat', 124, 9);
  B.enemy('fungus', 131, 13, { tint: 'cave' });
  B.enemy('spiky', 145, 13);
  B.enemy('bat', 152, 8);
});

const level2_2 = stage(1, 2, 'Poços de Luz', 'cave', 172, (B) => {
  B.groundAll(13);
  B.raise(26, 10, 12);
  B.raise(84, 8, 11);
  B.raise(124, 10, 12);
  B.pit(34, 5, true);
  B.pit(64, 6, true);
  B.pit(106, 5, true);
  B.pit(148, 5, true);
  B.platform(8, 10, 3);
  B.platform(14, 8, 4);
  B.platform(27, 9, 4);
  B.platform(40, 10, 4);
  B.platform(47, 8, 3);
  B.platform(53, 6, 3);
  B.platform(58, 9, 3);
  B.platform(70, 8, 4);
  B.platform(76, 10, 3);
  B.platform(91, 9, 4);
  B.platform(99, 7, 3);
  B.platform(112, 10, 4);
  B.platform(119, 8, 3);
  B.platform(132, 10, 4);
  B.platform(140, 8, 4);
  B.platform(156, 9, 3);
  B.spikes(18, 12, 2);
  B.spikes(88, 10, 2);
  B.spikes(136, 12, 3);
  B.crystal(80, 12, 2);
  B.crystal(143, 12, 2);
  B.bricks(30, 10, 3);
  B.question(31, 10, 'heart');
  B.question(96, 7, 'star');
  B.question(137, 8, 'coin');
  B.pipe(87, 10, 1, { secret: true });
  B.coinLine(4, 12, 5);
  B.coinArc(33, 10, 7, 3);
  B.coinArc(63, 9, 8, 3);
  B.coinLine(73, 12, 3);
  B.coinArc(105, 10, 7, 3);
  B.coinArc(147, 9, 7, 3);
  B.coinLine(158, 12, 5);
  B.coinRing(100, 5, 2);
  B.star(15, 6);
  B.star(54, 4);
  B.star(120, 6);
  B.starGate(127, 12);
  B.checkpoint(78, 13);
  B.checkpoint(130, 12);
  B.goalAt(167, 13);
  B.spawnAt(2, 13);
  B.enemy('bat', 12, 8);
  B.enemy('ghost', 24, 9);
  B.enemy('spiky', 30, 12);
  B.enemy('bat', 45, 7);
  B.enemy('fungus', 56, 13, { tint: 'cave' });
  B.enemy('ghost', 69, 9);
  B.enemy('bat', 78, 7);
  B.enemy('spiky', 92, 9);
  B.enemy('bat', 101, 6);
  B.enemy('ghost', 111, 9);
  B.enemy('fungus', 122, 13, { tint: 'cave' });
  B.enemy('spiky', 134, 10);
  B.enemy('bat', 143, 7);
  B.enemy('ghost', 155, 9);
  B.enemy('fungus', 162, 13, { tint: 'cave' });
});

const boss2 = stage(1, 3, 'Coração de Cristal', 'cave', 34, (B) => {
  B.groundAll(13);
  B.platform(7, 9, 4);
  B.platform(14, 8, 5);
  B.platform(23, 9, 4);
  B.crystal(11, 12, 2);
  B.crystal(25, 12, 2);
  B.question(8, 7, 'heart');
  B.coinRing(16, 6, 2);
  B.checkpoint(4, 13);
  B.spawnAt(3, 13);
  B.goalAt(30, 13);
  B.bossAt('crystalGolem', 'Golem de Cristal', 23, 13, 13);
}, { bossType: 'crystalGolem', bossName: 'Golem de Cristal' });

// ---------------------------------------------------------------- world 3
const level3_1 = stage(2, 1, 'Bosque das Luzes', 'forest', 164, (B) => {
  B.groundAll(13);
  B.raise(34, 8, 12);
  B.raise(96, 9, 12);
  B.pit(24, 4);
  B.pit(58, 5);
  B.pit(78, 4);
  B.pit(118, 5);
  B.pit(142, 4);
  B.platform(9, 10, 4);
  B.platform(16, 8, 3);
  B.platform(30, 9, 4);
  B.platform(40, 10, 3);
  B.platform(46, 8, 4);
  B.platform(52, 10, 3);
  B.platform(64, 9, 4);
  B.platform(71, 7, 3);
  B.platform(84, 10, 4);
  B.platform(90, 8, 3);
  B.platform(100, 9, 4);
  B.platform(108, 7, 3);
  B.platform(124, 10, 4);
  B.platform(131, 8, 3);
  B.platform(148, 9, 4);
  B.bounce(74, 12);
  B.bounce(136, 12);
  B.spikes(18, 12, 2);
  B.spikes(88, 12, 2);
  B.spikes(128, 12, 2);
  B.bricks(37, 10, 3);
  B.question(38, 10, 'heart');
  B.question(68, 6, 'star');
  B.hidden('coin', 102, 9);
  B.pipe(43, 10, 1, { secret: true });
  B.coinLine(4, 12, 5);
  B.coinArc(23, 10, 6, 3);
  B.coinArc(57, 10, 7, 3);
  B.coinArc(77, 10, 6, 3);
  B.coinArc(117, 10, 7, 3);
  B.coinArc(141, 10, 6, 3);
  B.coinLine(154, 12, 5);
  B.coinRing(110, 5, 2);
  B.star(17, 6);
  B.star(72, 5);
  B.star(109, 5);
  B.starGate(153, 13);
  B.checkpoint(82, 13);
  B.goalAt(159, 13);
  B.spawnAt(2, 13);
  B.enemy('fungus', 13, 13);
  B.enemy('bee', 21, 9);
  B.enemy('turtle', 31, 13);
  B.enemy('ghost', 45, 9);
  B.enemy('bee', 55, 8);
  B.enemy('fungus', 64, 13);
  B.enemy('spiky', 69, 13);
  B.enemy('bee', 85, 7);
  B.enemy('ghost', 93, 9);
  B.enemy('turtle', 103, 12);
  B.enemy('bee', 115, 9);
  B.enemy('spiky', 125, 10);
  B.enemy('fungus', 133, 13);
  B.enemy('ghost', 145, 9);
  B.enemy('bee', 156, 8);
});

const level3_2 = stage(2, 2, 'Clareira Sombria', 'forest', 176, (B) => {
  B.groundAll(13);
  B.raise(22, 9, 12);
  B.raise(74, 10, 11);
  B.raise(136, 9, 12);
  B.pit(33, 4);
  B.pit(52, 6);
  B.pit(90, 5);
  B.pit(112, 5);
  B.pit(152, 5);
  B.platform(8, 10, 3);
  B.platform(15, 8, 4);
  B.platform(24, 9, 4);
  B.platform(38, 10, 4);
  B.platform(44, 8, 3);
  B.platform(58, 10, 3);
  B.platform(64, 8, 4);
  B.platform(70, 10, 3);
  B.platform(81, 8, 4);
  B.platform(88, 10, 3);
  B.platform(98, 8, 4);
  B.platform(106, 10, 3);
  B.platform(119, 8, 4);
  B.platform(126, 10, 3);
  B.platform(140, 9, 4);
  B.platform(147, 7, 3);
  B.platform(160, 9, 3);
  B.bounce(49, 12);
  B.bounce(105, 12);
  B.bounce(147, 6);
  B.spikes(18, 12, 2);
  B.spikes(68, 12, 2);
  B.spikes(100, 12, 2);
  B.spikes(130, 12, 3);
  B.spikes(161, 12, 2);
  B.bricks(27, 10, 3);
  B.question(28, 10, 'heart');
  B.question(83, 6, 'star');
  B.question(121, 6, 'coin');
  B.pipe(77, 9, 2, { secret: true });
  B.coinLine(4, 12, 5);
  B.coinArc(32, 10, 6, 3);
  B.coinArc(51, 10, 8, 3);
  B.coinArc(89, 10, 7, 3);
  B.coinArc(111, 10, 7, 3);
  B.coinArc(151, 10, 7, 3);
  B.coinRing(114, 6, 2);
  B.star(16, 6);
  B.star(72, 8);
  B.star(148, 5);
  B.starGate(142, 12);
  B.checkpoint(66, 13);
  B.checkpoint(133, 13);
  B.goalAt(171, 13);
  B.spawnAt(2, 13);
  B.enemy('bee', 12, 8);
  B.enemy('fungus', 20, 13);
  B.enemy('ghost', 29, 9);
  B.enemy('spiky', 38, 13);
  B.enemy('bee', 47, 7);
  B.enemy('turtle', 60, 13);
  B.enemy('ghost', 72, 9);
  B.enemy('spiky', 85, 13);
  B.enemy('bee', 93, 8);
  B.enemy('ghost', 103, 9);
  B.enemy('spiky', 118, 13);
  B.enemy('turtle', 124, 13);
  B.enemy('bee', 134, 8);
  B.enemy('ghost', 144, 9);
  B.enemy('spiky', 158, 13);
  B.enemy('fungus', 166, 13);
});

const boss3 = stage(2, 3, 'Ninho da Coruja', 'forest', 34, (B) => {
  B.groundAll(13);
  B.platform(7, 9, 4);
  B.platform(14, 7, 5);
  B.platform(23, 9, 4);
  B.bounce(18, 12);
  B.question(8, 7, 'heart');
  B.coinRing(16, 5, 2);
  B.checkpoint(4, 13);
  B.spawnAt(3, 13);
  B.goalAt(30, 13);
  B.bossAt('shadowOwl', 'Coruja Sombria', 23, 8, 13);
}, { bossType: 'shadowOwl', bossName: 'Coruja Sombria' });

// ---------------------------------------------------------------- world 4
const level4_1 = stage(3, 1, 'Trilha do Vento', 'mountain', 166, (B) => {
  B.groundAll(13);
  B.raise(30, 8, 12);
  B.raise(92, 9, 11);
  B.pit(22, 4);
  B.pit(42, 5);
  B.pit(62, 6);
  B.pit(82, 4);
  B.pit(108, 5);
  B.pit(132, 5);
  B.pit(152, 4);
  B.platform(8, 10, 3);
  B.platform(15, 9, 3);
  B.platform(26, 9, 3);
  B.platform(37, 10, 4);
  B.platform(48, 10, 3);
  B.platform(55, 8, 4);
  B.platform(68, 10, 3);
  B.platform(75, 9, 4);
  B.platform(88, 10, 3);
  B.platform(97, 9, 4);
  B.platform(104, 7, 3);
  B.platform(114, 10, 4);
  B.platform(121, 8, 3);
  B.platform(128, 10, 3);
  B.platform(138, 9, 4);
  B.platform(145, 7, 3);
  B.platform(158, 9, 4);
  B.spikes(18, 12, 2);
  B.spikes(56, 7, 2);
  B.spikes(116, 12, 2);
  B.bounce(101, 12);
  B.question(33, 10, 'heart');
  B.question(73, 7, 'coin');
  B.hidden('coin', 99, 8);
  B.pipe(94, 10, 1, { secret: true });
  B.coinLine(4, 12, 4);
  B.coinArc(21, 10, 6, 3);
  B.coinArc(41, 10, 7, 3);
  B.coinArc(61, 9, 8, 3);
  B.coinArc(81, 10, 6, 3);
  B.coinArc(107, 9, 7, 3);
  B.coinArc(131, 9, 7, 3);
  B.coinArc(151, 10, 6, 3);
  B.coinRing(106, 5, 2);
  B.star(16, 7);
  B.star(57, 6);
  B.star(122, 6);
  B.starGate(160, 13);
  B.checkpoint(77, 13);
  B.goalAt(163, 13);
  B.spawnAt(2, 13);
  B.enemy('spiky', 14, 13);
  B.enemy('bee', 25, 8);
  B.enemy('turtle', 33, 12);
  B.enemy('spiky', 49, 10);
  B.enemy('bee', 58, 6);
  B.enemy('turtle', 70, 13);
  B.enemy('ghost', 80, 9);
  B.enemy('spiky', 90, 10);
  B.enemy('bee', 105, 6);
  B.enemy('turtle', 118, 13);
  B.enemy('spiky', 129, 13);
  B.enemy('bee', 141, 7);
  B.enemy('ghost', 150, 9);
  B.enemy('spiky', 157, 13);
});

const level4_2 = stage(3, 2, 'Picos Celestes', 'mountain', 178, (B) => {
  B.groundAll(13);
  B.raise(26, 8, 12);
  B.raise(80, 10, 11);
  B.raise(140, 9, 12);
  B.pit(18, 5);
  B.pit(38, 6);
  B.pit(58, 5);
  B.pit(68, 5);
  B.pit(98, 6);
  B.pit(118, 6);
  B.pit(156, 5);
  B.platform(7, 10, 3);
  B.platform(13, 8, 3);
  B.platform(22, 9, 3);
  B.platform(32, 10, 4);
  B.platform(44, 10, 3);
  B.platform(50, 8, 4);
  B.platform(63, 10, 3);
  B.platform(72, 9, 4);
  B.platform(86, 8, 4);
  B.platform(93, 10, 3);
  B.platform(104, 9, 4);
  B.platform(112, 7, 3);
  B.platform(123, 10, 4);
  B.platform(130, 8, 4);
  B.platform(144, 9, 4);
  B.platform(151, 7, 3);
  B.platform(162, 9, 4);
  B.bounce(47, 12);
  B.bounce(115, 12);
  B.bounce(149, 6);
  B.spikes(52, 7, 2);
  B.spikes(88, 7, 2);
  B.spikes(133, 7, 2);
  B.question(84, 6, 'heart');
  B.question(110, 8, 'star');
  B.bricks(29, 10, 3);
  B.hidden('coin', 146, 8);
  B.pipe(83, 9, 2, { secret: true });
  B.coinLine(3, 12, 4);
  B.coinArc(17, 10, 7, 3);
  B.coinArc(37, 9, 8, 3);
  B.coinArc(57, 9, 7, 3);
  B.coinArc(67, 9, 7, 3);
  B.coinArc(97, 9, 8, 3);
  B.coinArc(117, 9, 8, 3);
  B.coinArc(155, 9, 7, 3);
  B.coinRing(114, 6, 2);
  B.star(14, 6);
  B.star(51, 6);
  B.star(131, 6);
  B.starGate(142, 12);
  B.checkpoint(65, 13);
  B.checkpoint(127, 13);
  B.goalAt(173, 13);
  B.spawnAt(2, 13);
  B.enemy('bee', 11, 7);
  B.enemy('spiky', 24, 13);
  B.enemy('turtle', 27, 12);
  B.enemy('spiky', 35, 13);
  B.enemy('bee', 49, 6);
  B.enemy('ghost', 61, 9);
  B.enemy('spiky', 74, 13);
  B.enemy('bee', 96, 7);
  B.enemy('turtle', 107, 13);
  B.enemy('spiky', 125, 10);
  B.enemy('bee', 129, 6);
  B.enemy('ghost', 138, 9);
  B.enemy('spiky', 147, 13);
  B.enemy('turtle', 162, 13);
  B.enemy('bee', 166, 7);
});

const boss4 = stage(3, 3, 'Pico da Tartaruga', 'mountain', 34, (B) => {
  B.groundAll(13);
  B.platform(7, 9, 4);
  B.platform(14, 7, 5);
  B.platform(23, 9, 4);
  B.bounce(18, 12);
  B.question(8, 7, 'heart');
  B.coinRing(16, 5, 2);
  B.checkpoint(4, 13);
  B.spawnAt(3, 13);
  B.goalAt(30, 13);
  B.bossAt('titanTurtle', 'Tartaruga Titã', 23, 13, 13);
}, { bossType: 'titanTurtle', bossName: 'Tartaruga Titã' });

// ---------------------------------------------------------------- world 5
const level5_1 = stage(4, 1, 'Portões de Ferro', 'castle', 168, (B) => {
  B.groundAll(13);
  B.raise(36, 8, 12);
  B.raise(96, 9, 11);
  B.pit(24, 4, true);
  B.pit(54, 5, true);
  B.pit(78, 5, true);
  B.pit(120, 5, true);
  B.pit(146, 4, true);
  B.platform(8, 10, 3);
  B.platform(14, 9, 3);
  B.platform(30, 10, 4);
  B.platform(44, 10, 3);
  B.platform(49, 8, 4);
  B.platform(60, 10, 4);
  B.platform(67, 8, 3);
  B.platform(73, 10, 3);
  B.platform(86, 9, 4);
  B.platform(104, 10, 4);
  B.platform(111, 8, 3);
  B.platform(128, 10, 4);
  B.platform(135, 8, 3);
  B.platform(152, 9, 4);
  B.spikes(18, 12, 2);
  B.spikes(65, 7, 2);
  B.spikes(114, 12, 2);
  B.spikes(157, 12, 2);
  B.question(33, 10, 'heart');
  B.question(90, 7, 'star');
  B.bricks(91, 9, 3);
  B.hidden('coin', 130, 10);
  B.pipe(98, 10, 1, { secret: true });
  B.coinLine(4, 12, 4);
  B.coinArc(23, 10, 6, 3);
  B.coinArc(53, 9, 8, 3);
  B.coinArc(77, 9, 7, 3);
  B.coinArc(119, 9, 8, 3);
  B.coinArc(145, 9, 7, 3);
  B.coinLine(160, 12, 4);
  B.coinRing(113, 6, 2);
  B.star(15, 7);
  B.star(50, 6);
  B.star(136, 6);
  B.starGate(162, 13);
  B.checkpoint(85, 13);
  B.goalAt(165, 13);
  B.spawnAt(2, 13);
  B.enemy('spiky', 13, 13);
  B.enemy('ghost', 22, 9);
  B.enemy('bat', 35, 8);
  B.enemy('turtle', 42, 13);
  B.enemy('spiky', 60, 10);
  B.enemy('ghost', 70, 9);
  B.enemy('bat', 84, 8);
  B.enemy('spiky', 94, 13);
  B.enemy('ghost', 108, 9);
  B.enemy('bat', 117, 7);
  B.enemy('spiky', 126, 13);
  B.enemy('turtle', 133, 13);
  B.enemy('ghost', 143, 9);
  B.enemy('bat', 154, 8);
  B.enemy('spiky', 161, 13);
});

const level5_2 = stage(4, 2, 'Salão das Sombras', 'castle', 180, (B) => {
  B.groundAll(13);
  B.raise(26, 9, 12);
  B.raise(86, 10, 11);
  B.raise(142, 9, 12);
  B.pit(20, 5, true);
  B.pit(40, 6, true);
  B.pit(60, 5, true);
  B.pit(74, 6, true);
  B.pit(104, 6, true);
  B.pit(126, 6, true);
  B.pit(158, 5, true);
  B.platform(7, 10, 3);
  B.platform(13, 8, 3);
  B.platform(28, 9, 4);
  B.platform(36, 10, 3);
  B.platform(47, 10, 4);
  B.platform(53, 8, 3);
  B.platform(66, 10, 3);
  B.platform(70, 8, 3);
  B.platform(80, 10, 3);
  B.platform(92, 8, 4);
  B.platform(99, 10, 3);
  B.platform(110, 9, 4);
  B.platform(118, 7, 3);
  B.platform(132, 10, 4);
  B.platform(139, 8, 3);
  B.platform(150, 10, 3);
  B.platform(155, 8, 3);
  B.platform(166, 9, 4);
  B.bounce(45, 12);
  B.bounce(121, 12);
  B.spikes(32, 11, 2);
  B.spikes(90, 7, 2);
  B.spikes(135, 11, 2);
  B.spikes(164, 12, 2);
  B.question(89, 6, 'heart');
  B.question(116, 6, 'star');
  B.bricks(29, 10, 3);
  B.hidden('coin', 140, 8);
  B.pipe(88, 10, 1, { secret: true });
  B.coinLine(3, 12, 4);
  B.coinArc(19, 10, 7, 3);
  B.coinArc(39, 9, 8, 3);
  B.coinArc(59, 9, 7, 3);
  B.coinArc(73, 9, 8, 3);
  B.coinArc(103, 9, 8, 3);
  B.coinArc(125, 9, 8, 3);
  B.coinArc(157, 9, 7, 3);
  B.coinRing(120, 5, 2);
  B.star(14, 6);
  B.star(54, 6);
  B.star(140, 6);
  B.starGate(145, 12);
  B.checkpoint(67, 13);
  B.checkpoint(134, 13);
  B.goalAt(175, 13);
  B.spawnAt(2, 13);
  B.enemy('bat', 11, 8);
  B.enemy('ghost', 24, 9);
  B.enemy('spiky', 30, 12);
  B.enemy('bat', 44, 7);
  B.enemy('spiky', 51, 13);
  B.enemy('ghost', 63, 9);
  B.enemy('bat', 76, 7);
  B.enemy('spiky', 84, 13);
  B.enemy('ghost', 101, 9);
  B.enemy('bat', 109, 6);
  B.enemy('spiky', 115, 13);
  B.enemy('ghost', 124, 9);
  B.enemy('bat', 138, 7);
  B.enemy('spiky', 148, 13);
  B.enemy('ghost', 154, 9);
  B.enemy('bat', 168, 8);
  B.enemy('spiky', 172, 13);
});

const boss5 = stage(4, 3, 'Trono do Rei Corvo', 'castle', 36, (B) => {
  B.groundAll(13);
  B.platform(6, 9, 4);
  B.platform(13, 7, 5);
  B.platform(21, 9, 4);
  B.platform(26, 7, 3);
  B.bricks(10, 10, 2);
  B.question(7, 7, 'heart');
  B.question(17, 7, 'star');
  B.bounce(14, 6);
  B.coinRing(17, 5, 2);
  B.checkpoint(4, 13);
  B.spawnAt(3, 13);
  B.goalAt(32, 13);
  B.bossAt('crowKing', 'Rei Corvo', 25, 13, 14);
}, { bossType: 'crowKing', bossName: 'Rei Corvo' });

export const LEVELS = [
  level1_1, level1_2, boss1,
  level2_1, level2_2, boss2,
  level3_1, level3_2, boss3,
  level4_1, level4_2, boss4,
  level5_1, level5_2, boss5,
];

export const WORLDS = [
  { name: 'Planícies Verdes', theme: 'plains', song: 'plains', levels: [0, 1, 2], story: 'O reino começa a brilhar de novo!' },
  { name: 'Cavernas de Cristal', theme: 'cave', song: 'cave', levels: [3, 4, 5], story: 'As estrelas iluminam até o fundo da terra.' },
  { name: 'Floresta Misteriosa', theme: 'forest', song: 'forest', levels: [6, 7, 8], story: 'Os amigos do bosque voltaram a sorrir.' },
  { name: 'Montanhas Celestes', theme: 'mountain', song: 'mountain', levels: [9, 10, 11], story: 'O vento sopra forte, mas a coragem é maior.' },
  { name: 'Castelo do Rei Corvo', theme: 'castle', song: 'castle', levels: [12, 13, 14], story: 'O último portal guarda o coração do reino.' },
];

export const BOSS_INFO = {
  mushroomKing: { name: 'Rei Cogumelo', hp: 3, title: 'O jardineiro rabugento' },
  crystalGolem: { name: 'Golem de Cristal', hp: 3, title: 'O guardião da gruta' },
  shadowOwl: { name: 'Coruja Sombria', hp: 3, title: 'A dona da noite' },
  titanTurtle: { name: 'Tartaruga Titã', hp: 3, title: 'O rolo compressor' },
  crowKing: { name: 'Rei Corvo', hp: 4, title: 'O ladrão das estrelas' },
};

export function levelIndexFor(world, stageNumber) {
  return WORLDS[world]?.levels[stageNumber - 1] ?? 0;
}

export function createBonusRoom(theme, kind = 'pipe') {
  const isVault = kind === 'vault';
  const width = isVault ? 34 : 36;
  const def = {
    world: 0, stage: 0, name: isVault ? 'Cofre Estelar' : 'Sala Secreta',
    theme, width, seed: isVault ? 991 : 733,
    build: (B) => {
      B.groundAll(15);
      for (let r = 0; r < 15; r++) {
        B.set(0, r, T.CASTLE);
        B.set(1, r, T.CASTLE);
        B.set(width - 1, r, T.CASTLE);
        B.set(width - 2, r, T.CASTLE);
      }
      B.set(0, 15, T.CASTLE);
      B.set(1, 15, T.CASTLE);
      B.set(width - 1, 15, T.CASTLE);
      B.set(width - 2, 15, T.CASTLE);
      B.platform(6, 11, 4);
      B.platform(12, 9, 4);
      B.platform(18, 11, 4);
      B.platform(24, 9, 4);
      B.coinLine(5, 13, 5);
      B.coinLine(9, 10, 3);
      B.coinLine(15, 8, 3);
      B.coinLine(20, 10, 3);
      B.coinLine(25, 8, 3);
      B.coinLine(28, 13, 4);
      if (isVault) {
        B.star(16, 5);
        B.coinRing(16, 6, 2);
        B.question(20, 6, 'heart');
      } else {
        B.coinRing(16, 7, 2);
        B.question(13, 7, 'heart');
      }
      B.returnAt(width - 4, 15);
      B.spawnAt(3, 15);
    },
  };
  const level = new Level(def);
  level.bonusKind = kind;
  level.themeData = THEMES[theme];
  return level;
}

export function validateLevels() {
  const issues = [];
  for (let i = 0; i < LEVELS.length; i++) {
    const level = new Level(LEVELS[i]);
    const report = validateLevel(level, i);
    issues.push(...report);
  }
  return issues;
}

function validateLevel(level, index) {
  const issues = [];
  const label = `L${index + 1} ${level.name}`;
  const solidAtPixel = (x, y) => level.solidAt(Math.floor(x / TILE), Math.floor(y / TILE));
  const spawnY = level.spawnFeet.row * TILE;
  if (!solidAtPixel(level.spawnFeet.x, spawnY + 4)) issues.push(`${label}: spawn has no floor`);
  if (level.goal && !solidAtPixel(level.goal.x, level.goal.feetRow * TILE + 4)) issues.push(`${label}: goal has no floor`);
  if (level.gate && !solidAtPixel(level.gate.x, level.gate.feetRow * TILE + 4)) issues.push(`${label}: star gate has no floor`);
  for (const star of level.starSpawns) {
    if (level.solidAt(Math.floor(star.x / TILE), Math.floor(star.y / TILE))) issues.push(`${label}: star inside a block at ${star.x},${star.y}`);
  }
  for (const spawn of level.enemySpawns) {
    const feet = spawn.feetRow * TILE;
    if (!level.solidAt(Math.floor(spawn.x / TILE), Math.floor(feet / TILE))) {
      // Flying enemies may hover over a pit; only grounded types need a floor.
      if (!['bat', 'ghost', 'bee'].includes(spawn.type)) issues.push(`${label}: enemy ${spawn.type} has no floor at ${spawn.x}`);
    }
  }
  if (!level.isBoss && level.starSpawns.length !== 3) issues.push(`${label}: expected 3 stars, found ${level.starSpawns.length}`);
  return issues;
}

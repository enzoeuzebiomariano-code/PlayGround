import { TILE, SOLID_TILES, T } from './config.js';

export function rectHitsSolid(level, x, y, w, h) {
  const c0 = Math.floor(x / TILE);
  const c1 = Math.floor((x + w - 0.001) / TILE);
  const r0 = Math.floor(y / TILE);
  const r1 = Math.floor((y + h - 0.001) / TILE);
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      if (SOLID_TILES.has(level.tileAt(c, r))) return true;
    }
  }
  return false;
}

export function solidBelow(level, x, y, w) {
  const row = Math.floor((y + 3) / TILE);
  const c0 = Math.floor((x + 4) / TILE);
  const c1 = Math.floor((x + w - 4) / TILE);
  for (let c = c0; c <= c1; c++) {
    if (SOLID_TILES.has(level.tileAt(c, row))) return true;
  }
  return false;
}

export function moveX(entity, amount, level) {
  if (!amount) return false;
  entity.x += amount;
  if (!rectHitsSolid(level, entity.x, entity.y + 2, entity.w, entity.h - 4)) return false;
  const c0 = Math.floor((entity.x + 2) / TILE);
  const c1 = Math.floor((entity.x + entity.w - 2) / TILE);
  const r0 = Math.floor((entity.y + 3) / TILE);
  const r1 = Math.floor((entity.y + entity.h - 3) / TILE);
  let edge = amount > 0 ? Infinity : -Infinity;
  let hit = false;
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      if (!SOLID_TILES.has(level.tileAt(c, r))) continue;
      const colX = c * TILE;
      if (amount > 0 && colX + TILE > entity.x && colX < entity.x + entity.w) {
        edge = Math.min(edge, colX - entity.w - 0.01);
        hit = true;
      } else if (amount < 0 && colX < entity.x + entity.w && colX + TILE > entity.x) {
        edge = Math.max(edge, colX + TILE + 0.01);
        hit = true;
      }
    }
  }
  if (hit && Number.isFinite(edge)) {
    entity.x = amount > 0 ? Math.min(entity.x, edge) : Math.max(entity.x, edge);
  }
  return hit;
}

export function moveY(entity, amount, level, { onCeiling, onLand } = {}) {
  if (!amount) return { landed: false, ceiling: false };
  entity.y += amount;
  const c0 = Math.floor((entity.x + 3) / TILE);
  const c1 = Math.floor((entity.x + entity.w - 3) / TILE);
  const r0 = Math.floor((entity.y + 2) / TILE);
  const r1 = Math.floor((entity.y + entity.h - 2) / TILE);
  let edge = null;
  let hit = false;
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const tile = level.tileAt(c, r);
      if (!SOLID_TILES.has(tile)) continue;
      const rowY = r * TILE;
      if (amount > 0 && rowY < entity.y + entity.h && rowY + TILE > entity.y) {
        edge = edge == null ? rowY : Math.min(edge, rowY);
        hit = true;
        if (onLand) onLand(tile, c, r);
      } else if (amount < 0 && rowY + TILE > entity.y && rowY < entity.y + entity.h) {
        edge = edge == null ? rowY : Math.max(edge, rowY);
        hit = true;
        if (onCeiling) onCeiling(tile, c, r);
      }
    }
  }
  if (hit && edge != null) {
    if (amount > 0) entity.y = edge - entity.h - 0.01;
    else entity.y = edge + TILE + 0.01;
    entity.vy = 0;
    return { landed: amount > 0, ceiling: amount < 0 };
  }
  return { landed: false, ceiling: false };
}

export function surfaceRowAt(level, x) {
  const col = Math.floor(x / TILE);
  for (let row = 0; row < level.height; row++) {
    const tile = level.tileAt(col, row);
    if (tile === T.GROUND || tile === T.CASTLE || tile === T.PLATFORM || tile === T.CRYSTAL || tile === T.CLOUD) {
      return row;
    }
  }
  return level.height - 1;
}

export function tileCenter(col, row) {
  return { x: col * TILE + TILE / 2, y: row * TILE + TILE / 2 };
}

import { makeCanvas, rect, hline, vline, px, shade, mix, rng, speckle, type Ctx } from './pixel';
import type { Theme } from './themes';

export const T = 16;

/** Cell legend: '#' wall, '.' floor, 'r' rug, ',' alternate floor, '=' path, ' ' void. */
export function isFloor(ch: string | undefined): boolean {
  return ch === '.' || ch === 'r' || ch === ',' || ch === '=';
}

function cellAt(rows: string[], x: number, y: number): string | undefined {
  if (y < 0 || y >= rows.length) return undefined;
  return rows[y][x];
}

function floorTile(g: Ctx, x: number, y: number, tx: number, ty: number, t: Theme, r: () => number): void {
  const a = t.floor;
  const b = t.floor2;
  switch (t.floorStyle) {
    case 'tile': {
      rect(g, x, y, T, T, (tx + ty) % 2 ? a : b);
      hline(g, x, y, T, shade(a, 0.08));
      vline(g, x, y, T, shade(a, 0.05));
      hline(g, x, y + T - 1, T, shade(a, -0.3));
      vline(g, x + T - 1, y, T, shade(a, -0.25));
      if (r() < 0.25) px(g, x + 3 + Math.floor(r() * 10), y + 3 + Math.floor(r() * 10), shade(a, 0.15));
      break;
    }
    case 'wood': {
      for (let i = 0; i < 4; i++) {
        const plank = (ty * 4 + i) % 3;
        const col = plank === 0 ? a : plank === 1 ? b : mix(a, b, 0.5);
        rect(g, x, y + i * 4, T, 4, col);
        hline(g, x, y + i * 4 + 3, T, shade(col, -0.22));
        const seam = ((ty * 4 + i) * 7 + tx * 5) % 16;
        vline(g, x + seam, y + i * 4, 3, shade(col, -0.3));
        if (r() < 0.5) px(g, x + Math.floor(r() * 16), y + i * 4 + 1, shade(col, -0.12));
      }
      break;
    }
    case 'carpet': {
      rect(g, x, y, T, T, a);
      speckle(g, x, y, T, T, [b, shade(a, 0.06), shade(a, -0.08)], 0.22, r);
      break;
    }
    case 'turf': {
      const col = Math.floor(ty / 2) % 2 ? a : b;
      rect(g, x, y, T, T, col);
      speckle(g, x, y, T, T, [shade(col, 0.1), shade(col, -0.12)], 0.18, r);
      break;
    }
    case 'stone': {
      rect(g, x, y, T, T, shade(a, -0.35));
      const off = ty % 2 ? 4 : 0;
      for (let row = 0; row < 2; row++) {
        for (let col = -1; col < 2; col++) {
          const sx = x + col * 8 + (row ? off + 4 : off);
          const c = r() < 0.5 ? a : b;
          rect(g, Math.max(x, sx + 1), y + row * 8 + 1, Math.min(7, x + T - sx - 1), 6, c);
          hline(g, Math.max(x, sx + 1), y + row * 8 + 1, Math.min(6, x + T - sx - 2), shade(c, 0.12));
        }
      }
      break;
    }
    case 'grass': {
      rect(g, x, y, T, T, a);
      speckle(g, x, y, T, T, [b, shade(a, 0.14), shade(a, -0.15)], 0.3, r);
      if (r() < 0.12) {
        const fx = x + 2 + Math.floor(r() * 12);
        const fy = y + 2 + Math.floor(r() * 12);
        px(g, fx, fy, ['#ffe08a', '#ff9ec7', '#ffffff', '#b5a8ff'][Math.floor(r() * 4)]);
      }
      break;
    }
    case 'concrete': {
      rect(g, x, y, T, T, a);
      speckle(g, x, y, T, T, [b, shade(a, 0.1), shade(a, -0.12)], 0.12, r);
      if (r() < 0.06) {
        let cx = x + 4 + Math.floor(r() * 8);
        for (let i = 0; i < 6; i++) px(g, (cx += r() < 0.5 ? 1 : 0), y + 4 + i, shade(a, -0.3));
      }
      break;
    }
    case 'checker': {
      for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) rect(g, x + i * 8, y + j * 8, 8, 8, (i + j + tx + ty) % 2 ? a : b);
      break;
    }
    case 'boards': {
      for (let i = 0; i < 4; i++) {
        const col = (tx * 4 + i) % 2 ? a : b;
        rect(g, x + i * 4, y, 4, T, col);
        vline(g, x + i * 4 + 3, y, T, shade(col, -0.35));
      }
      if ((tx + ty * 3) % 5 === 0) hline(g, x, y + 8, T, shade(a, -0.4));
      break;
    }
  }
}

function rugTile(g: Ctx, rows: string[], x: number, y: number, tx: number, ty: number, t: Theme): void {
  const base = t.rug ?? shade(t.accent, -0.35);
  rect(g, x, y, T, T, base);
  const edge = shade(base, -0.35);
  const pattern = shade(base, 0.18);
  const n = (dx: number, dy: number) => cellAt(rows, tx + dx, ty + dy) === 'r';
  if (!n(0, -1)) { hline(g, x, y, T, edge); hline(g, x, y + 2, T, pattern); }
  if (!n(0, 1)) { hline(g, x, y + T - 1, T, edge); hline(g, x, y + T - 3, T, pattern); }
  if (!n(-1, 0)) { vline(g, x, y, T, edge); vline(g, x + 2, y, T, pattern); }
  if (!n(1, 0)) { vline(g, x + T - 1, y, T, edge); vline(g, x + T - 3, y, T, pattern); }
  if ((tx + ty) % 2 === 0) {
    px(g, x + 7, y + 6, pattern);
    px(g, x + 8, y + 7, pattern);
    px(g, x + 7, y + 8, pattern);
    px(g, x + 6, y + 7, pattern);
  }
}

function wallFace(g: Ctx, x: number, y: number, tx: number, t: Theme, r: () => number): void {
  const w = t.wall;
  rect(g, x, y, T, T, w);
  switch (t.wallStyle) {
    case 'panel':
      vline(g, x, y, T, shade(w, -0.25));
      vline(g, x + 1, y, T, shade(w, 0.08));
      hline(g, x, y + 5, T, shade(w, -0.18));
      px(g, x + 3, y + 2, shade(w, 0.25));
      px(g, x + 12, y + 2, shade(w, 0.25));
      break;
    case 'wallpaper':
      for (let i = 0; i < T; i += 4) vline(g, x + i + (tx % 2), y, T - 3, shade(w, 0.06));
      if (tx % 2 === 0) px(g, x + 6, y + 5, shade(w, -0.1));
      break;
    case 'acoustic':
      for (let i = 0; i < 4; i++)
        for (let j = 0; j < 3; j++) {
          const c = (i + j + tx) % 2 ? shade(w, 0.08) : shade(w, -0.08);
          rect(g, x + i * 4, y + j * 4, 4, 4, c);
          px(g, x + i * 4, y + j * 4, shade(c, 0.15));
        }
      break;
    case 'brick':
      for (let j = 0; j < 4; j++) {
        hline(g, x, y + j * 4 + 3, T, shade(w, -0.3));
        const off = j % 2 ? 4 : 0;
        for (let i = off; i < T; i += 8) vline(g, x + i, y + j * 4, 3, shade(w, -0.3));
      }
      speckle(g, x, y, T, T - 3, [shade(w, 0.08)], 0.1, r);
      break;
    case 'wood':
      for (let i = 0; i < T; i += 4) {
        rect(g, x + i, y, 4, T, i % 8 ? w : shade(w, 0.05));
        vline(g, x + i + 3, y, T, shade(w, -0.25));
      }
      break;
    case 'hedge':
      rect(g, x, y, T, T, w);
      speckle(g, x, y, T, T, [shade(w, 0.18), shade(w, -0.2), shade(w, 0.32)], 0.4, r);
      return;
    case 'plaster':
    case 'glass':
    default:
      speckle(g, x, y, T, T - 3, [shade(w, 0.04), shade(w, -0.04)], 0.08, r);
  }
  // baseboard
  rect(g, x, y + T - 3, T, 3, shade(t.trim, -0.35));
  hline(g, x, y + T - 3, T, shade(t.trim, -0.1));
}

function wallTop(g: Ctx, x: number, y: number, t: Theme, faceBelow: boolean, floorLeft: boolean, floorRight: boolean, r: () => number): void {
  rect(g, x, y, T, T, t.wallTop);
  if (t.wallStyle === 'hedge') {
    speckle(g, x, y, T, T, [shade(t.wallTop, 0.15), shade(t.wallTop, -0.15)], 0.35, r);
  }
  if (faceBelow) {
    hline(g, x, y + T - 2, T, shade(t.wallTop, 0.25));
    hline(g, x, y + T - 1, T, shade(t.trim, -0.2));
  }
  if (floorLeft) vline(g, x, y, T, shade(t.wallTop, 0.2));
  if (floorRight) vline(g, x + T - 1, y, T, shade(t.wallTop, 0.2));
}

/** Paint a room's static floor and walls into one canvas. */
export function drawBackground(rows: string[], t: Theme, seed: number): HTMLCanvasElement {
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const { c, g } = makeCanvas(w * T, h * T);
  const r = rng(seed);
  rect(g, 0, 0, w * T, h * T, '#05060a');
  for (let ty = 0; ty < h; ty++) {
    for (let tx = 0; tx < w; tx++) {
      const ch = rows[ty][tx] ?? ' ';
      const x = tx * T;
      const y = ty * T;
      if (ch === 'r') rugTile(g, rows, x, y, tx, ty, t);
      else if (ch === ',') {
        floorTile(g, x, y, tx, ty, { ...t, floor: t.floor2, floor2: t.floor }, r);
      } else if (ch === '=') {
        rect(g, x, y, T, T, '#9c9283');
        for (let i = 0; i < 3; i++) {
          const sx = x + 1 + Math.floor(r() * 9);
          const sy = y + 1 + Math.floor(r() * 9);
          rect(g, sx, sy, 5, 4, '#b5ab9b');
          hline(g, sx, sy, 5, '#c9c0b1');
        }
      } else if (ch === '.') floorTile(g, x, y, tx, ty, t, r);
      else if (ch === '#') {
        const below = cellAt(rows, tx, ty + 1);
        if (isFloor(below)) wallFace(g, x, y, tx, t, r);
        else wallTop(g, x, y, t, cellAt(rows, tx, ty + 1) === '#' && isFloor(cellAt(rows, tx, ty + 2)), isFloor(cellAt(rows, tx - 1, ty)), isFloor(cellAt(rows, tx + 1, ty)), r);
      }
    }
  }
  // Contact shadows under wall faces and beside side walls.
  for (let ty = 0; ty < h; ty++) {
    for (let tx = 0; tx < w; tx++) {
      const ch = rows[ty][tx];
      if (!isFloor(ch)) continue;
      const x = tx * T;
      const y = ty * T;
      g.fillStyle = 'rgba(5,6,20,0.28)';
      if (cellAt(rows, tx, ty - 1) === '#') g.fillRect(x, y, T, 4);
      if (cellAt(rows, tx - 1, ty) === '#') g.fillRect(x, y, 3, T);
      if (cellAt(rows, tx + 1, ty) === '#') g.fillRect(x + T - 2, y, 2, T);
    }
  }
  return c;
}

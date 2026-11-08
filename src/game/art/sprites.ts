import { box, block, circle, hline, vline, px, rect, shade, mix, rng, speckle, dither, type Ctx } from './pixel';
import { drawText } from './font';
import type { Theme } from './themes';

export interface SpriteDef {
  w: number;
  h: number;
  frames?: number;
  /** true when the sprite's look depends on the room theme */
  themed?: boolean;
  draw: (g: Ctx, frame: number, t: Theme) => void;
}

const WOOD = '#8a5a3c';
const WOOD_L = '#b07a4f';
const WOOD_D = '#5c3b24';
const METAL = '#5d6675';
const METAL_L = '#9aa4b2';
const METAL_D = '#363c47';
const SCREEN = '#0b1424';
const PAPER = '#f4efe2';
const CORK = '#b8875a';
const BOOKS = ['#c0392b', '#2e86de', '#27ae60', '#f39c12', '#8e44ad', '#16a085', '#d35400', '#e8e1cf', '#34495e', '#e84393'];

function screen(g: Ctx, x: number, y: number, w: number, h: number, accent: string, frame = 0, seed = 1): void {
  rect(g, x, y, w, h, SCREEN);
  const r = rng(seed + frame * 31);
  rect(g, x, y, w, 2, mix(SCREEN, accent, 0.55));
  for (let i = 0; i < Math.floor((h - 3) / 2); i++) {
    const len = Math.floor(r() * (w - 3)) + 2;
    hline(g, x + 1, y + 3 + i * 2, len, mix(SCREEN, accent, 0.35 + r() * 0.5));
  }
  px(g, x + w - 2, y + h - 2, frame % 2 ? accent : shade(accent, -0.4));
}

function monitor(g: Ctx, x: number, y: number, w: number, h: number, accent: string, frame: number, seed: number): void {
  box(g, x, y, w, h, '#2a2f3a');
  screen(g, x + 1, y + 1, w - 2, h - 3, accent, frame, seed);
  rect(g, x + Math.floor(w / 2) - 1, y + h, 3, 2, '#2a2f3a');
}

function legs(g: Ctx, x: number, y: number, w: number, h: number, color: string): void {
  rect(g, x + 1, y, 2, h, color);
  rect(g, x + w - 3, y, 2, h, color);
}

export const SPRITES: Record<string, SpriteDef> = {
  desk: {
    w: 32,
    h: 20,
    draw: (g) => {
      block(g, 0, 4, 32, 14, 6, WOOD_L, WOOD);
      legs(g, 0, 17, 32, 3, WOOD_D);
      rect(g, 13, 12, 6, 1, WOOD_D);
      rect(g, 4, 5, 7, 4, PAPER);
      rect(g, 24, 4, 3, 4, '#d9d9d9');
    },
  },
  deskPc: {
    w: 32,
    h: 28,
    frames: 2,
    themed: true,
    draw: (g, f, t) => {
      block(g, 0, 12, 32, 14, 6, WOOD_L, WOOD);
      legs(g, 0, 25, 32, 3, WOOD_D);
      monitor(g, 9, 0, 15, 11, t.accent, f, 3);
      rect(g, 4, 14, 8, 2, '#d0d4da');
      rect(g, 25, 13, 3, 3, '#e74c3c');
    },
  },
  commandDesk: {
    w: 80,
    h: 34,
    frames: 2,
    themed: true,
    draw: (g, f, t) => {
      block(g, 0, 14, 80, 18, 7, '#3a4660', '#232c40');
      hline(g, 2, 22, 76, t.accent);
      for (let i = 0; i < 6; i++) px(g, 8 + i * 12, 26, i % 2 === f % 2 ? t.accent : '#f5b041');
      monitor(g, 4, 2, 22, 13, t.accent, f, 11);
      monitor(g, 29, 0, 22, 14, t.accent, f + 1, 12);
      monitor(g, 54, 2, 22, 13, t.accent, f, 13);
      legs(g, 0, 31, 80, 3, '#141a28');
    },
  },
  wallScreen: {
    w: 100,
    h: 46,
    frames: 2,
    themed: true,
    draw: (g, f, t) => {
      box(g, 0, 0, 100, 44, '#2b3448');
      rect(g, 3, 3, 94, 36, SCREEN);
      rect(g, 3, 3, 94, 6, mix(SCREEN, t.accent, 0.45));
      drawText(g, 'HQ', 6, 4, '#e8fbff');
      for (let i = 0; i < 8; i++) {
        const hgt = 4 + ((i * 7 + f * 3) % 14);
        rect(g, 8 + i * 5, 36 - hgt, 3, hgt, i % 3 === 0 ? '#f5b041' : t.accent);
      }
      let y = 28;
      for (let i = 0; i < 30; i++) {
        y = Math.max(13, Math.min(34, y + ((i * 13 + f * 5) % 7) - 3));
        px(g, 52 + i, y, '#7dffb3');
      }
      for (let i = 0; i < 4; i++) {
        rect(g, 52, 13 + i * 5, 2, 2, i === f % 4 ? '#ff6b6b' : t.accent);
        hline(g, 56, 14 + i * 5, 20 + ((i * 9) % 18), mix(SCREEN, '#ffffff', 0.5));
      }
      rect(g, 46, 40, 8, 4, '#1b2232');
    },
  },
  bulletin: {
    w: 44,
    h: 30,
    draw: (g) => {
      box(g, 0, 0, 44, 30, WOOD);
      rect(g, 3, 3, 38, 24, CORK);
      speckle(g, 3, 3, 38, 24, [shade(CORK, -0.15), shade(CORK, 0.12)], 0.25, rng(5));
      const notes = ['#ffe066', '#ff8fab', '#8fd3ff', '#a8e6a1', '#ffe066', '#ffb36b'];
      notes.forEach((c, i) => {
        const x = 5 + (i % 3) * 12 + (i > 2 ? 3 : 0);
        const y = 5 + Math.floor(i / 3) * 11;
        rect(g, x, y, 9, 8, c);
        hline(g, x + 1, y + 3, 6, shade(c, -0.3));
        hline(g, x + 1, y + 5, 5, shade(c, -0.3));
        px(g, x + 4, y, '#e74c3c');
      });
    },
  },
  whiteboard: {
    w: 46,
    h: 30,
    draw: (g) => {
      box(g, 0, 0, 46, 27, '#b8c0cc');
      rect(g, 2, 2, 42, 22, '#fbfdff');
      hline(g, 5, 6, 18, '#2e86de');
      hline(g, 5, 9, 26, '#2e86de');
      hline(g, 5, 12, 14, '#e74c3c');
      for (let i = 0; i < 3; i++) {
        rect(g, 5, 15 + i * 3, 2, 2, '#27ae60');
        hline(g, 9, 16 + i * 3, 12 + i * 4, '#555');
      }
      rect(g, 32, 6, 9, 9, '#ffe066');
      rect(g, 6, 27, 34, 2, '#8a929e');
      rect(g, 10, 26, 4, 1, '#e74c3c');
      rect(g, 16, 26, 4, 1, '#2e86de');
    },
  },
  calendar: {
    w: 24,
    h: 28,
    draw: (g) => {
      box(g, 0, 0, 24, 28, PAPER, { outline: '#5b5248' });
      rect(g, 1, 1, 22, 6, '#e74c3c');
      px(g, 6, 0, '#333');
      px(g, 17, 0, '#333');
      for (let i = 0; i < 5; i++) for (let j = 0; j < 4; j++) rect(g, 3 + i * 4, 9 + j * 4, 3, 3, (i + j) % 7 === 3 ? '#ffd166' : '#d9d2c3');
      rect(g, 10, 12, 5, 5, '#e74c3c');
      rect(g, 11, 13, 3, 3, PAPER);
    },
  },
  cabinet: {
    w: 16,
    h: 30,
    draw: (g) => {
      block(g, 0, 0, 16, 30, 3, METAL_L, METAL);
      for (let i = 0; i < 3; i++) {
        hline(g, 1, 4 + i * 8, 14, METAL_D);
        rect(g, 6, 7 + i * 8, 4, 1, '#d6dbe2');
        rect(g, 3, 5 + i * 8, 3, 2, PAPER);
      }
    },
  },
  bookshelf: {
    w: 32,
    h: 46,
    draw: (g) => {
      box(g, 0, 0, 32, 46, WOOD_D);
      const r = rng(9);
      for (let s = 0; s < 4; s++) {
        const sy = 3 + s * 10;
        rect(g, 2, sy, 28, 9, '#2a1a10');
        let x = 3;
        while (x < 28) {
          const bw = 2 + Math.floor(r() * 2);
          const bh = 6 + Math.floor(r() * 3);
          const c = BOOKS[Math.floor(r() * BOOKS.length)];
          if (x + bw > 29) break;
          rect(g, x, sy + 9 - bh, bw, bh, c);
          vline(g, x, sy + 9 - bh, bh, shade(c, 0.2));
          if (r() < 0.3) hline(g, x, sy + 10 - bh + 2, bw, shade(c, 0.4));
          x += bw + (r() < 0.15 ? 2 : 0);
        }
        hline(g, 1, sy + 9, 30, WOOD_L);
      }
    },
  },
  plant: {
    w: 16,
    h: 26,
    draw: (g) => {
      block(g, 3, 17, 10, 9, 3, '#d9825b', '#b5603c');
      const leaves = ['#2f8f46', '#3fae5a', '#1f6e35'];
      circle(g, 8, 9, 5, leaves[2]);
      circle(g, 5, 11, 4, leaves[0]);
      circle(g, 11, 11, 4, leaves[0]);
      circle(g, 8, 6, 3, leaves[1]);
      px(g, 6, 5, '#7fe39a');
      px(g, 10, 9, '#7fe39a');
      vline(g, 8, 13, 4, '#1f5e2f');
    },
  },
  couch: {
    w: 50,
    h: 28,
    themed: true,
    draw: (g, _f, t) => {
      const c = t.rug ?? t.accent;
      block(g, 0, 0, 50, 14, 4, shade(c, 0.1), c);
      block(g, 0, 10, 50, 16, 6, shade(c, 0.18), shade(c, -0.1));
      block(g, 0, 6, 8, 20, 3, shade(c, 0.12), shade(c, -0.15));
      block(g, 42, 6, 8, 20, 3, shade(c, 0.12), shade(c, -0.15));
      vline(g, 25, 11, 6, shade(c, -0.3));
      rect(g, 12, 4, 9, 7, '#ffe8c2');
      rect(g, 3, 25, 3, 3, WOOD_D);
      rect(g, 44, 25, 3, 3, WOOD_D);
    },
  },
  armchair: {
    w: 22,
    h: 24,
    themed: true,
    draw: (g, _f, t) => {
      const c = shade(t.accent, -0.2);
      block(g, 2, 0, 18, 12, 3, shade(c, 0.1), c);
      block(g, 0, 8, 22, 14, 5, shade(c, 0.18), shade(c, -0.12));
      rect(g, 2, 22, 2, 2, WOOD_D);
      rect(g, 18, 22, 2, 2, WOOD_D);
    },
  },
  floorLamp: {
    w: 12,
    h: 36,
    draw: (g) => {
      rect(g, 3, 33, 6, 3, '#3a2a20');
      vline(g, 6, 9, 24, '#3a2a20');
      rect(g, 1, 1, 10, 9, '#f7d79b');
      hline(g, 1, 1, 10, '#fff1cf');
      hline(g, 0, 9, 12, '#c79a55');
    },
  },
  fireplace: {
    w: 46,
    h: 46,
    frames: 3,
    draw: (g, f) => {
      box(g, 0, 0, 46, 46, '#7d6a5c');
      for (let j = 0; j < 11; j++) {
        hline(g, 1, 1 + j * 4 + 3, 44, '#5e4f45');
        for (let i = (j % 2) * 5; i < 46; i += 10) vline(g, i, 1 + j * 4, 3, '#5e4f45');
      }
      rect(g, 0, 0, 46, 5, '#4a3b31');
      hline(g, 0, 5, 46, '#a08a78');
      rect(g, 8, 16, 30, 28, '#140b08');
      rect(g, 12, 38, 22, 4, '#5c3b24');
      rect(g, 15, 36, 16, 3, '#7a4b2f');
      const flames = [
        [3, 10, 6, 14, 4, 9],
        [5, 12, 4, 11, 6, 13],
        [4, 8, 7, 12, 5, 10],
      ][f];
      const xs = [13, 17, 21, 25, 29, 32];
      xs.forEach((x, i) => {
        const h = flames[i % 6];
        rect(g, x, 38 - h, 3, h, '#ff7b1c');
        rect(g, x, 38 - Math.floor(h * 0.6), 3, Math.floor(h * 0.6), '#ffb43a');
        rect(g, x + 1, 38 - Math.floor(h * 0.3), 1, Math.floor(h * 0.3), '#fff0a0');
      });
    },
  },
  aquarium: {
    w: 46,
    h: 36,
    frames: 4,
    draw: (g, f) => {
      block(g, 0, 24, 46, 12, 3, WOOD_L, WOOD);
      box(g, 1, 0, 44, 25, '#2a3a4a');
      rect(g, 3, 2, 40, 21, '#2f8fbf');
      rect(g, 3, 2, 40, 3, '#5fc3e8');
      rect(g, 3, 19, 40, 4, '#d8c38f');
      for (let i = 0; i < 4; i++) {
        vline(g, 7 + i * 10, 11, 9, '#2e9d5a');
        vline(g, 8 + i * 10, 13, 7, '#43c06f');
      }
      const fish = [
        ['#ff8c42', 6 + f * 8, 9],
        ['#ffd23f', 34 - f * 6, 14],
        ['#ff5d8f', 18 + ((f * 5) % 20), 7],
      ] as const;
      fish.forEach(([c, x, y]) => {
        const fx = 4 + (((x as number) % 34) + 34) % 34;
        rect(g, fx, y as number, 4, 2, c as string);
        px(g, fx - 1, (y as number) + (f % 2), c as string);
        px(g, fx + 3, y as number, '#111');
      });
      px(g, 12 + f, 6 - (f % 2), '#d9f4ff');
      px(g, 30, 4 + (f % 3), '#d9f4ff');
    },
  },
  piano: {
    w: 42,
    h: 32,
    draw: (g) => {
      block(g, 0, 0, 42, 30, 4, '#2c2420', '#1d1715');
      rect(g, 3, 14, 36, 6, '#f4f1ea');
      for (let i = 0; i < 12; i++) vline(g, 3 + i * 3, 14, 6, '#c9c2b5');
      for (let i = 0; i < 12; i++) if (i % 7 !== 2 && i % 7 !== 6) rect(g, 5 + i * 3, 14, 2, 3, '#111');
      rect(g, 14, 6, 14, 6, PAPER);
      hline(g, 16, 8, 10, '#777');
      hline(g, 16, 10, 8, '#777');
      rect(g, 4, 30, 3, 2, '#120d0b');
      rect(g, 35, 30, 3, 2, '#120d0b');
    },
  },
  guitar: {
    w: 14,
    h: 30,
    draw: (g) => {
      rect(g, 6, 1, 2, 14, '#5c3b24');
      rect(g, 5, 0, 4, 3, '#2a1a10');
      circle(g, 7, 19, 5, '#c0392b');
      circle(g, 7, 20, 4, '#e67e22');
      circle(g, 7, 21, 2, '#2a1a10');
      vline(g, 7, 3, 21, '#ddd');
      rect(g, 2, 27, 10, 2, '#333');
      vline(g, 3, 24, 4, '#333');
      vline(g, 11, 24, 4, '#333');
    },
  },
  mic: {
    w: 12,
    h: 32,
    draw: (g) => {
      rect(g, 2, 30, 8, 2, '#222');
      vline(g, 6, 10, 20, '#333');
      rect(g, 4, 2, 5, 9, '#444');
      dither(g, 5, 3, 3, 4, '#aaa', '#777');
      circle(g, 9, 6, 2, 'rgba(30,30,30,0.6)' as string);
    },
  },
  mixer: {
    w: 54,
    h: 26,
    frames: 2,
    draw: (g, f) => {
      block(g, 0, 4, 54, 20, 12, '#3b3f4a', '#262a33');
      for (let i = 0; i < 12; i++) {
        vline(g, 4 + i * 4, 6, 9, '#151820');
        rect(g, 3 + i * 4, 8 + ((i * 3 + f * 2) % 5), 3, 2, '#d0d4da');
        px(g, 4 + i * 4, 5, i % 4 === f ? '#ff5d5d' : '#5dff9b');
      }
      rect(g, 20, 0, 14, 5, SCREEN);
      hline(g, 21, 2, 6 + f * 3, '#5dff9b');
      legs(g, 0, 23, 54, 3, '#151820');
    },
  },
  camera: {
    w: 18,
    h: 32,
    draw: (g) => {
      vline(g, 9, 12, 16, '#333');
      g.fillStyle = '#333';
      for (let i = 0; i < 8; i++) {
        px(g, 9 - i, 20 + i, '#333');
        px(g, 9 + i, 20 + i, '#333');
      }
      box(g, 3, 2, 12, 10, '#2a2a2e');
      circle(g, 15, 7, 3, '#555');
      circle(g, 15, 7, 1, '#7fc8ff');
      px(g, 5, 4, '#ff3b3b');
    },
  },
  ringlight: {
    w: 18,
    h: 34,
    draw: (g) => {
      vline(g, 9, 16, 16, '#444');
      rect(g, 5, 32, 9, 2, '#333');
      g.strokeStyle = '#fffbe8';
      for (let a = 0; a < 64; a++) {
        const ang = (a / 64) * Math.PI * 2;
        px(g, 9 + Math.round(Math.cos(ang) * 7), 8 + Math.round(Math.sin(ang) * 7), '#fffbe8');
        px(g, 9 + Math.round(Math.cos(ang) * 6), 8 + Math.round(Math.sin(ang) * 6), '#ffeeb0');
      }
    },
  },
  boxes: {
    w: 28,
    h: 28,
    draw: (g) => {
      const c = '#c9995f';
      block(g, 0, 12, 16, 16, 4, shade(c, 0.15), c);
      block(g, 13, 14, 15, 14, 4, shade(c, 0.1), shade(c, -0.05));
      block(g, 4, 0, 15, 14, 4, shade(c, 0.2), shade(c, 0.05));
      vline(g, 8, 13, 15, '#e8d6a9');
      vline(g, 11, 1, 13, '#e8d6a9');
      rect(g, 17, 19, 7, 4, PAPER);
    },
  },
  vinylWall: {
    w: 46,
    h: 32,
    draw: (g) => {
      box(g, 0, 0, 46, 32, '#2a1a12');
      const labels = ['#f2c14e', '#e74c3c', '#3498db', '#2ecc71', '#9b59b6', '#ecf0f1'];
      for (let i = 0; i < 6; i++) {
        const cx = 8 + (i % 3) * 15;
        const cy = 9 + Math.floor(i / 3) * 14;
        if (i === 1 || i === 5) {
          rect(g, cx - 6, cy - 6, 13, 13, labels[(i + 2) % 6]);
          rect(g, cx - 3, cy - 3, 7, 7, shade(labels[(i + 2) % 6], -0.3));
        } else {
          circle(g, cx, cy, 6, '#111');
          circle(g, cx, cy, 2, labels[i]);
          px(g, cx, cy, '#111');
          px(g, cx - 3, cy - 3, '#444');
        }
      }
    },
  },
  crate: {
    w: 22,
    h: 16,
    draw: (g) => {
      block(g, 0, 2, 22, 14, 3, WOOD_L, WOOD);
      for (let i = 0; i < 8; i++) rect(g, 2 + i * 2, 0, 1, 6, BOOKS[i % BOOKS.length]);
      hline(g, 1, 10, 20, WOOD_D);
    },
  },
  rack: {
    w: 20,
    h: 44,
    frames: 2,
    themed: true,
    draw: (g, f, t) => {
      box(g, 0, 0, 20, 44, '#1b1e26');
      for (let i = 0; i < 9; i++) {
        rect(g, 2, 3 + i * 4, 16, 3, '#272b36');
        px(g, 4, 4 + i * 4, (i + f) % 3 === 0 ? '#3dff8a' : '#1f6b3d');
        px(g, 6, 4 + i * 4, (i * 2 + f) % 4 === 0 ? '#ffb02e' : '#5a4310');
        hline(g, 9, 4 + i * 4, 7, mix('#272b36', t.accent, 0.4));
      }
    },
  },
  terminal: {
    w: 24,
    h: 32,
    frames: 2,
    themed: true,
    draw: (g, f, t) => {
      block(g, 2, 14, 20, 18, 4, '#47505f', '#2c323d');
      box(g, 0, 0, 24, 15, '#353c49');
      screen(g, 2, 2, 20, 10, t.accent, f, 21);
      rect(g, 5, 18, 14, 3, '#1c2028');
      for (let i = 0; i < 5; i++) px(g, 6 + i * 3, 19, '#9aa4b2');
    },
  },
  phonebooth: {
    w: 24,
    h: 44,
    themed: true,
    draw: (g, _f, t) => {
      box(g, 0, 0, 24, 44, shade(t.trim, -0.2));
      rect(g, 3, 6, 18, 34, '#a8d8e8');
      dither(g, 3, 6, 18, 34, '#a8d8e8', '#bfe6f2');
      rect(g, 3, 1, 18, 4, '#f4efe2');
      drawText(g, 'CALL', 1, -1, '#f4efe2');
      rect(g, 9, 16, 7, 10, '#2a2f3a');
      rect(g, 10, 17, 2, 6, '#555');
    },
  },
  mailwall: {
    w: 46,
    h: 32,
    draw: (g) => {
      box(g, 0, 0, 46, 32, WOOD);
      for (let i = 0; i < 6; i++)
        for (let j = 0; j < 4; j++) {
          rect(g, 2 + i * 7, 2 + j * 7, 6, 6, WOOD_D);
          if ((i * 3 + j * 5) % 4 === 0) rect(g, 3 + i * 7, 4 + j * 7, 4, 3, PAPER);
          if ((i + j * 2) % 7 === 0) rect(g, 3 + i * 7, 4 + j * 7, 4, 3, '#ffd166');
        }
    },
  },
  bigscreen: {
    w: 104,
    h: 50,
    frames: 2,
    draw: (g, f) => {
      box(g, 0, 0, 104, 48, '#14213d');
      rect(g, 3, 3, 98, 38, '#2f7d32');
      for (let i = 0; i < 10; i++) vline(g, 8 + i * 10, 3, 38, '#e9f5e1');
      rect(g, 3, 3, 98, 4, '#0b2545');
      drawText(g, 'WAR ROOM', 6, 3, '#69be28');
      const os = [
        [22, 18],
        [22, 28],
        [30, 23],
      ];
      os.forEach(([x, y]) => {
        circle(g, x, y, 2, '#0b2545');
        px(g, x, y, '#2f7d32');
      });
      const xs = [
        [60, 16],
        [62, 27],
        [70, 22],
      ];
      xs.forEach(([x, y]) => {
        for (let k = -2; k <= 2; k++) {
          px(g, x + k, y + k, '#ffffff');
          px(g, x + k, y - k, '#ffffff');
        }
      });
      for (let i = 0; i < 18; i++) px(g, 32 + i * 2, 23 - Math.round(Math.sin(i / 3) * 4), '#69be28');
      rect(g, 80, 30, 18, 8, '#0b2545');
      drawText(g, f ? 'SEA' : 'SEA', 81, 31, f ? '#69be28' : '#a5acaf');
      rect(g, 48, 42, 8, 6, '#0a0f1c');
    },
  },
  tactics: {
    w: 46,
    h: 30,
    draw: (g) => {
      box(g, 0, 0, 46, 30, '#5c3b24');
      rect(g, 3, 3, 40, 22, '#1f3b2c');
      const chalk = '#e8f0e8';
      [
        [10, 10],
        [10, 18],
        [16, 14],
      ].forEach(([x, y]) => {
        circle(g, x, y, 2, chalk);
        px(g, x, y, '#1f3b2c');
      });
      [
        [32, 9],
        [34, 18],
      ].forEach(([x, y]) => {
        for (let k = -2; k <= 2; k++) {
          px(g, x + k, y + k, chalk);
          px(g, x + k, y - k, chalk);
        }
      });
      for (let i = 0; i < 12; i++) px(g, 17 + i, 14 - Math.floor(i / 2), '#ffd166');
      px(g, 29, 8, '#ffd166');
      px(g, 28, 7, '#ffd166');
      rect(g, 6, 26, 34, 2, '#7a5a3c');
    },
  },
  lockers: {
    w: 36,
    h: 38,
    draw: (g) => {
      for (let i = 0; i < 3; i++) {
        block(g, i * 12, 0, 12, 38, 2, '#1c3d6e', '#0b2545');
        for (let v = 0; v < 3; v++) hline(g, i * 12 + 3, 5 + v * 2, 6, '#06162b');
        rect(g, i * 12 + 8, 18, 2, 4, '#a5acaf');
        rect(g, i * 12 + 3, 26, 6, 5, '#69be28');
      }
    },
  },
  trophies: {
    w: 36,
    h: 36,
    draw: (g) => {
      box(g, 0, 0, 36, 36, WOOD_D);
      rect(g, 2, 2, 32, 32, '#2a1a10');
      hline(g, 2, 17, 32, WOOD_L);
      hline(g, 2, 33, 32, WOOD_L);
      const gold = '#f2c14e';
      rect(g, 6, 7, 6, 5, gold);
      rect(g, 8, 12, 2, 3, gold);
      rect(g, 6, 15, 6, 2, shade(gold, -0.2));
      rect(g, 22, 9, 8, 8, '#0b2545');
      rect(g, 22, 11, 3, 4, '#a5acaf');
      rect(g, 28, 13, 3, 2, '#69be28');
      circle(g, 10, 28, 3, '#7a4a2a');
      hline(g, 8, 28, 5, '#f4efe2');
      rect(g, 20, 24, 10, 8, PAPER);
      hline(g, 21, 26, 8, '#888');
    },
  },
  arcade: {
    w: 22,
    h: 42,
    frames: 2,
    draw: (g, f) => {
      block(g, 0, 0, 22, 42, 2, '#0b2545', '#14213d');
      rect(g, 2, 2, 18, 6, '#69be28');
      drawText(g, 'PLAY', 0, 1, '#0b2545');
      rect(g, 3, 10, 16, 12, SCREEN);
      for (let i = 0; i < 4; i++) px(g, 6 + i * 3, 14 + ((i + f) % 3) * 2, '#69be28');
      px(g, 10, 18, '#ffffff');
      rect(g, 2, 24, 18, 5, '#1c3d6e');
      vline(g, 7, 22, 3, '#888');
      px(g, 7, 22, '#e74c3c');
      px(g, 13, 26, '#ffd166');
      px(g, 16, 26, '#69be28');
    },
  },
  pedestal: {
    w: 18,
    h: 28,
    frames: 2,
    draw: (g, f) => {
      block(g, 3, 12, 12, 16, 3, '#d8dde3', '#aeb5bf');
      circle(g, 9, 7, 5, '#0b2545');
      circle(g, 9, 7, 3, f ? '#69be28' : '#4a8f1c');
      px(g, 8, 6, '#e9ffd9');
    },
  },
  windowCity: {
    w: 50,
    h: 32,
    frames: 2,
    draw: (g, f) => {
      box(g, 0, 0, 50, 32, '#7f8b99');
      rect(g, 2, 2, 46, 28, '#18243d');
      rect(g, 2, 2, 46, 10, '#22314f');
      const sky = [
        [4, 8, 14],
        [12, 6, 10],
        [30, 7, 18],
        [38, 9, 12],
        [44, 4, 9],
      ];
      sky.forEach(([x, w, h]) => {
        rect(g, x, 30 - h, w, h, '#0e1626');
        for (let i = 0; i < Math.floor(h / 3); i++) if ((x + i) % 3) px(g, x + 2, 30 - h + 2 + i * 3, '#f5d76e');
      });
      vline(g, 22, 8, 22, '#0e1626');
      vline(g, 23, 8, 22, '#0e1626');
      rect(g, 19, 9, 8, 2, '#0e1626');
      rect(g, 20, 8, 6, 1, '#1b2a44');
      px(g, 22, 6, '#ff5d5d');
      for (let i = 0; i < 12; i++) {
        const x = 3 + ((i * 7 + f * 3) % 44);
        const y = 3 + ((i * 11 + f * 5) % 24);
        vline(g, x, y, 2, 'rgba(180,200,255,0.55)' as string);
      }
      vline(g, 25, 2, 28, '#7f8b99');
      hline(g, 2, 15, 46, '#7f8b99');
    },
  },
  windowDay: { w: 42, h: 30, draw: (g) => windowSky(g, 'day') },
  windowDusk: { w: 42, h: 30, draw: (g) => windowSky(g, 'dusk') },
  windowNight: { w: 42, h: 30, draw: (g) => windowSky(g, 'night') },
  door: {
    w: 20,
    h: 30,
    themed: true,
    draw: (g, _f, t) => {
      rect(g, 0, 0, 20, 30, shade(t.trim, -0.45));
      block(g, 2, 2, 16, 28, 1, shade(WOOD, 0.1), WOOD);
      rect(g, 4, 5, 12, 8, shade(WOOD, -0.15));
      rect(g, 4, 16, 12, 10, shade(WOOD, -0.15));
      px(g, 15, 17, '#f2c14e');
    },
  },
  doorPrivate: {
    w: 22,
    h: 32,
    draw: (g) => {
      rect(g, 0, 0, 22, 32, '#5f7d64');
      block(g, 2, 2, 16, 30, 1, '#e8efe6', '#cfdccc');
      rect(g, 4, 6, 12, 10, '#bfd0bc');
      px(g, 15, 19, '#8fb996');
      box(g, 18, 12, 4, 7, '#2a3a2c');
      px(g, 19, 14, '#7dff9b');
      px(g, 20, 16, '#7dff9b');
    },
  },
  stairsUp: {
    w: 34,
    h: 30,
    draw: (g) => {
      for (let i = 0; i < 6; i++) {
        const c = mix('#4a3326', '#c9a27a', i / 6);
        rect(g, 1, 25 - i * 5, 32, 5, c);
        hline(g, 1, 25 - i * 5, 32, shade(c, 0.2));
      }
      vline(g, 0, 0, 30, '#2a1a10');
      vline(g, 33, 0, 30, '#2a1a10');
    },
  },
  stairsDown: {
    w: 34,
    h: 30,
    draw: (g) => {
      for (let i = 0; i < 6; i++) {
        const c = mix('#c9a27a', '#2a1a10', i / 6);
        rect(g, 1, i * 5, 32, 5, c);
        hline(g, 1, i * 5, 32, shade(c, 0.15));
      }
      vline(g, 0, 0, 30, '#2a1a10');
      vline(g, 33, 0, 30, '#2a1a10');
    },
  },
  dreamboard: {
    w: 56,
    h: 34,
    draw: (g) => {
      box(g, 0, 0, 56, 34, WOOD_L);
      rect(g, 3, 3, 50, 28, CORK);
      speckle(g, 3, 3, 50, 28, [shade(CORK, -0.12), shade(CORK, 0.1)], 0.22, rng(7));
      for (let i = 0; i < 25; i++) px(g, 4 + i * 2, 6 + Math.round(Math.sin(i / 3)), '#f4efe2');
      const cards = ['#ffd6e0', '#cdeaff', '#fff1b8', '#d7f5d0', '#e5d4ff', '#ffe0c2'];
      cards.forEach((c, i) => {
        const x = 6 + (i % 4) * 12 + (i > 3 ? 6 : 0);
        const y = 9 + Math.floor(i / 4) * 11;
        rect(g, x, y, 9, 8, c);
        hline(g, x + 1, y + 3, 6, shade(c, -0.3));
        px(g, x + 4, y, '#e74c3c');
      });
      rect(g, 44, 18, 8, 9, '#ffffff');
      rect(g, 45, 19, 6, 5, '#7fb2ff');
      px(g, 48, 20, '#ffd166');
    },
  },
  journalDesk: {
    w: 34,
    h: 26,
    draw: (g) => {
      block(g, 0, 8, 34, 16, 6, WOOD_L, WOOD);
      legs(g, 0, 23, 34, 3, WOOD_D);
      rect(g, 6, 7, 18, 6, '#fbf7ec');
      vline(g, 15, 7, 6, '#c9bfa8');
      hline(g, 8, 9, 5, '#9a9080');
      hline(g, 17, 9, 5, '#9a9080');
      rect(g, 27, 4, 3, 6, '#f4efe2');
      px(g, 28, 2, '#ffb43a');
      px(g, 28, 3, '#ff7b1c');
    },
  },
  retro: {
    w: 28,
    h: 26,
    frames: 2,
    draw: (g, f) => {
      block(g, 0, 14, 28, 12, 4, WOOD_L, WOOD);
      box(g, 4, 0, 20, 15, '#3a3a3a');
      rect(g, 6, 2, 16, 10, f ? '#2b4f7a' : '#264870');
      px(g, 10, 5, '#ffd166');
      px(g, 14, 7, '#ff5d8f');
      px(g, 17, 4, '#7dff9b');
      rect(g, 8, 18, 10, 3, '#d0d0d0');
      rect(g, 19, 18, 5, 3, '#555');
      px(g, 20, 19, '#e74c3c');
    },
  },
  recordPlayer: {
    w: 22,
    h: 20,
    frames: 2,
    draw: (g, f) => {
      block(g, 1, 8, 20, 12, 3, WOOD_L, WOOD);
      box(g, 0, 2, 22, 8, '#3a2a20');
      circle(g, 9, 5, 3, '#111');
      px(g, 9 + (f ? 1 : -1), 5, '#c0392b');
      vline(g, 17, 2, 4, '#ccc');
      hline(g, 13, 5, 4, '#ccc');
    },
  },
  workbench: {
    w: 46,
    h: 28,
    frames: 2,
    draw: (g, f) => {
      block(g, 0, 10, 46, 16, 6, '#9c7a54', '#7a5a3c');
      legs(g, 0, 25, 46, 3, '#4a3424');
      box(g, 6, 3, 10, 8, '#5d6675');
      vline(g, 11, 0, 3, '#aaa');
      px(g, 11, 0, f ? '#ff5d5d' : '#7dff9b');
      rect(g, 20, 6, 8, 5, '#2e86de');
      px(g, 22, 8, '#fff');
      rect(g, 31, 7, 9, 3, '#e8c170');
      vline(g, 40, 2, 9, '#444');
      rect(g, 38, 1, 6, 3, '#f7d79b');
    },
  },
  bench: {
    w: 36,
    h: 18,
    draw: (g) => {
      for (let i = 0; i < 3; i++) block(g, 0, i * 4, 36, 4, 1, WOOD_L, WOOD);
      rect(g, 3, 12, 3, 6, '#2b2b2b');
      rect(g, 30, 12, 3, 6, '#2b2b2b');
    },
  },
  flowers: {
    w: 18,
    h: 14,
    draw: (g) => {
      circle(g, 9, 9, 6, '#2f6e35');
      circle(g, 6, 8, 4, '#3f8f45');
      const r = rng(4);
      for (let i = 0; i < 7; i++) px(g, 3 + Math.floor(r() * 12), 4 + Math.floor(r() * 8), ['#ff9ec7', '#ffe08a', '#ffffff', '#b5a8ff'][i % 4]);
    },
  },
  lampPost: {
    w: 12,
    h: 42,
    draw: (g) => {
      rect(g, 3, 39, 6, 3, '#222');
      vline(g, 5, 10, 30, '#2b2b2b');
      vline(g, 6, 10, 30, '#444');
      box(g, 1, 2, 10, 9, '#2b2b2b');
      rect(g, 3, 4, 6, 5, '#ffe08a');
      rect(g, 4, 0, 4, 2, '#2b2b2b');
    },
  },
  fountain: {
    w: 46,
    h: 34,
    frames: 2,
    draw: (g, f) => {
      block(g, 0, 14, 46, 20, 6, '#b8b0a2', '#968e80');
      rect(g, 3, 15, 40, 5, '#3f9fd1');
      dither(g, 3, 15, 40, 5, '#3f9fd1', f ? '#69bde8' : '#58b0de');
      rect(g, 20, 2, 6, 14, '#a39b8d');
      rect(g, 16, 0, 14, 3, '#b8b0a2');
      for (let i = 0; i < 5; i++) px(g, 18 + i * 2, 4 + ((i + f) % 3), '#cdeeff');
    },
  },
  kiosk: {
    w: 28,
    h: 36,
    themed: true,
    draw: (g, _f, t) => {
      vline(g, 13, 20, 16, '#333');
      vline(g, 14, 20, 16, '#555');
      box(g, 0, 0, 28, 22, '#2b3448');
      rect(g, 2, 2, 24, 4, t.accent);
      for (let i = 0; i < 5; i++) {
        rect(g, 3, 8 + i * 3, 2, 2, ['#5b8def', '#e05d5d', '#6aa84f', '#f2c14e', '#ff4d6d'][i]);
        hline(g, 7, 9 + i * 3, 10 + ((i * 5) % 8), '#d8dee8');
      }
    },
  },
  clock: {
    w: 14,
    h: 14,
    draw: (g) => {
      circle(g, 7, 7, 6, '#3a2a20');
      circle(g, 7, 7, 5, '#f4efe2');
      vline(g, 7, 3, 4, '#222');
      hline(g, 7, 7, 3, '#222');
    },
  },
  frameArt: {
    w: 18,
    h: 16,
    draw: (g) => {
      box(g, 0, 0, 18, 16, '#c9a24c');
      rect(g, 2, 2, 14, 12, '#8fd3ff');
      rect(g, 2, 9, 14, 5, '#5fae5a');
      circle(g, 12, 6, 2, '#ffe066');
      for (let i = 0; i < 6; i++) px(g, 3 + i, 9 - Math.floor(i / 2), '#3f7d3a');
    },
  },
  frameArt2: {
    w: 16,
    h: 18,
    draw: (g) => {
      box(g, 0, 0, 16, 18, '#2a2a2a');
      rect(g, 2, 2, 12, 14, '#f4efe2');
      circle(g, 6, 7, 3, '#ff8fab');
      rect(g, 8, 9, 5, 5, '#5b8def');
      hline(g, 3, 14, 10, '#f2c14e');
    },
  },
  table: {
    w: 36,
    h: 20,
    draw: (g) => {
      block(g, 0, 0, 36, 14, 8, WOOD_L, WOOD);
      legs(g, 0, 13, 36, 7, WOOD_D);
      rect(g, 6, 2, 8, 5, PAPER);
      rect(g, 22, 3, 4, 4, '#e74c3c');
    },
  },
  chair: {
    w: 12,
    h: 16,
    themed: true,
    draw: (g, _f, t) => {
      block(g, 1, 0, 10, 8, 2, shade(t.trim, 0.2), t.trim);
      block(g, 0, 7, 12, 6, 3, shade(t.trim, 0.25), shade(t.trim, -0.1));
      rect(g, 1, 13, 2, 3, '#333');
      rect(g, 9, 13, 2, 3, '#333');
    },
  },
  catalog: {
    w: 28,
    h: 26,
    draw: (g) => {
      block(g, 0, 0, 28, 26, 3, WOOD_L, WOOD);
      for (let i = 0; i < 4; i++)
        for (let j = 0; j < 3; j++) {
          rect(g, 2 + i * 6, 5 + j * 6, 5, 5, shade(WOOD, -0.1));
          px(g, 4 + i * 6, 7 + j * 6, '#f2c14e');
        }
    },
  },
  globe: {
    w: 16,
    h: 24,
    draw: (g) => {
      rect(g, 4, 21, 8, 3, WOOD_D);
      vline(g, 8, 15, 6, WOOD_D);
      circle(g, 8, 8, 6, '#3f8fd1');
      rect(g, 4, 5, 4, 3, '#4caf50');
      rect(g, 9, 9, 3, 4, '#4caf50');
      g.fillStyle = '#c9a24c';
      for (let a = 0; a < 20; a++) px(g, 8 + Math.round(Math.cos((a / 20) * Math.PI) * 7), 8 - Math.round(Math.sin((a / 20) * Math.PI) * 7), '#c9a24c');
    },
  },
  readingTable: {
    w: 42,
    h: 24,
    draw: (g) => {
      block(g, 0, 6, 42, 14, 7, WOOD_L, WOOD);
      legs(g, 0, 19, 42, 5, WOOD_D);
      rect(g, 6, 6, 10, 5, '#2e86de');
      rect(g, 8, 5, 10, 5, '#fbf7ec');
      vline(g, 33, 0, 7, '#3a2a20');
      rect(g, 30, 0, 7, 3, '#5a9e6f');
      rect(g, 22, 8, 6, 3, '#c0392b');
    },
  },
  sideTable: {
    w: 16,
    h: 16,
    draw: (g) => {
      block(g, 0, 4, 16, 10, 4, WOOD_L, WOOD);
      legs(g, 0, 13, 16, 3, WOOD_D);
      rect(g, 5, 0, 5, 5, '#f4efe2');
      rect(g, 6, 1, 3, 2, '#7a4b2f');
    },
  },
  beanbag: {
    w: 22,
    h: 16,
    themed: true,
    draw: (g, _f, t) => {
      circle(g, 11, 9, 7, shade(t.accent, -0.25));
      circle(g, 10, 8, 5, shade(t.accent, -0.1));
      px(g, 8, 6, shade(t.accent, 0.3));
    },
  },
  stringLights: {
    w: 80,
    h: 10,
    frames: 2,
    draw: (g, f) => {
      for (let i = 0; i < 80; i++) px(g, i, 2 + Math.round(Math.sin(i / 6) * 2), '#3a2a20');
      for (let i = 0; i < 10; i++) {
        const x = 4 + i * 8;
        const y = 4 + Math.round(Math.sin(x / 6) * 2);
        const on = (i + f) % 3 !== 0;
        rect(g, x, y, 2, 3, on ? ['#ffe08a', '#ffb86b', '#ff9ec7', '#9effd9'][i % 4] : '#8a7a5a');
      }
    },
  },
  planner: {
    w: 34,
    h: 26,
    draw: (g) => {
      block(g, 0, 8, 34, 16, 6, '#e8d9c4', '#c9b79c');
      legs(g, 0, 23, 34, 3, '#8a7a62');
      rect(g, 5, 6, 14, 7, '#8fb996');
      rect(g, 6, 7, 12, 5, '#fbf7ec');
      for (let i = 0; i < 3; i++) hline(g, 7, 8 + i * 2, 8, '#9a9080');
      rect(g, 24, 4, 5, 8, '#ffffff');
      rect(g, 25, 5, 3, 3, '#b5d9b9');
    },
  },
  routines: {
    w: 36,
    h: 28,
    draw: (g) => {
      box(g, 0, 0, 36, 28, '#c9d8c6');
      rect(g, 2, 2, 32, 24, '#fbfdf9');
      for (let i = 0; i < 4; i++) {
        rect(g, 5, 5 + i * 5, 3, 3, i < 2 ? '#8fb996' : '#d9d9d9');
        hline(g, 10, 6 + i * 5, 16 - i * 2, '#7a8a78');
      }
    },
  },
  serverDesk: {
    w: 40,
    h: 26,
    frames: 2,
    themed: true,
    draw: (g, f, t) => {
      block(g, 0, 10, 40, 14, 6, '#3b414d', '#262a33');
      legs(g, 0, 23, 40, 3, '#151820');
      monitor(g, 2, 0, 16, 10, t.accent, f, 31);
      monitor(g, 21, 0, 16, 10, '#b18cff', f + 1, 32);
    },
  },
  coffee: {
    w: 30,
    h: 26,
    draw: (g) => {
      block(g, 0, 10, 30, 16, 5, '#d8d2c6', '#b8b0a2');
      box(g, 4, 0, 12, 12, '#2b2b2b');
      rect(g, 7, 7, 6, 3, '#555');
      rect(g, 20, 6, 5, 5, '#f4efe2');
      rect(g, 21, 7, 3, 2, '#6f4329');
    },
  },
  buildingSign: {
    w: 16,
    h: 16,
    draw: (g) => rect(g, 0, 0, 16, 16, '#000'),
  },
};

function windowSky(g: Ctx, mode: 'day' | 'dusk' | 'night'): void {
  box(g, 0, 0, 42, 30, '#c9b79c');
  const top = mode === 'day' ? '#7fc8ff' : mode === 'dusk' ? '#ff9e6b' : '#0e1a3a';
  const bottom = mode === 'day' ? '#cdeeff' : mode === 'dusk' ? '#ffd27a' : '#1d2f5c';
  for (let y = 0; y < 26; y++) hline(g, 2, 2 + y, 38, mix(top, bottom, y / 26));
  if (mode === 'night') {
    const r = rng(12);
    for (let i = 0; i < 14; i++) px(g, 3 + Math.floor(r() * 36), 3 + Math.floor(r() * 18), r() < 0.3 ? '#ffffff' : '#bcd0ff');
    circle(g, 31, 9, 3, '#f4f1d0');
    circle(g, 32, 8, 2, '#0e1a3a');
  } else if (mode === 'day') {
    circle(g, 31, 9, 3, '#fff7c2');
    rect(g, 6, 8, 10, 3, '#ffffff');
    rect(g, 8, 6, 6, 2, '#ffffff');
  } else {
    circle(g, 21, 22, 5, '#ffe9a8');
  }
  rect(g, 2, 24, 38, 4, mode === 'night' ? '#14223f' : '#5f8f58');
  vline(g, 21, 2, 26, '#c9b79c');
  hline(g, 2, 14, 38, '#c9b79c');
}

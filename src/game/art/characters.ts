import { makeCanvas, rect, px, shade, circle, hline, vline, type Ctx } from './pixel';

export type HairStyle = 'short' | 'long' | 'cap' | 'bun' | 'curly' | 'beanie' | 'swoop' | 'bald';
export type Accessory = 'glasses' | 'headset' | 'scarf' | 'goggles' | 'whistle' | 'badge' | 'none';

export interface Look {
  skin: string;
  hair: string;
  hairStyle: HairStyle;
  top: string;
  bottom: string;
  shoes: string;
  accessory?: Accessory;
  beard?: boolean;
  capColor?: string;
  robot?: boolean;
}

export const CHAR_W = 16;
export const CHAR_H = 24;
/** Directions in sheet row order */
export const DIRS = ['down', 'left', 'right', 'up'] as const;
export type Dir = (typeof DIRS)[number];

const OUT = '#1a1420';

function head(g: Ctx, x: number, y: number, dir: Dir, L: Look): void {
  const skin = L.skin;
  const hair = L.hair;
  // outline + face
  rect(g, x + 3, y + 1, 10, 10, OUT);
  rect(g, x + 4, y + 2, 8, 8, skin);
  hline(g, x + 4, y + 9, 8, shade(skin, -0.15));
  // ears
  if (dir === 'down' || dir === 'up') {
    px(g, x + 3, y + 6, skin);
    px(g, x + 12, y + 6, skin);
  }
  // hair
  const h = hair;
  const hd = shade(hair, -0.25);
  const style = L.hairStyle;
  if (style !== 'bald') {
    rect(g, x + 4, y + 2, 8, 2, h);
    hline(g, x + 4, y + 2, 8, shade(hair, 0.18));
    if (dir === 'up') rect(g, x + 4, y + 2, 8, 7, h);
    if (dir === 'left') rect(g, x + 9, y + 2, 3, 6, h);
    if (dir === 'right') rect(g, x + 4, y + 2, 3, 6, h);
    if (dir === 'down') {
      px(g, x + 4, y + 4, h);
      px(g, x + 11, y + 4, h);
    }
    if (style === 'long') {
      if (dir !== 'up') {
        rect(g, x + 3, y + 3, 1, 7, h);
        rect(g, x + 12, y + 3, 1, 7, h);
      } else rect(g, x + 4, y + 9, 8, 2, hd);
    }
    if (style === 'swoop' && dir !== 'up') {
      rect(g, dir === 'right' ? x + 7 : x + 5, y + 3, 4, 1, h);
    }
    if (style === 'curly') {
      for (let i = 0; i < 4; i++) px(g, x + 4 + i * 2, y + 1, h);
      px(g, x + 3, y + 3, h);
      px(g, x + 12, y + 3, h);
    }
    if (style === 'bun') {
      rect(g, x + 6, y - 1, 4, 3, h);
      px(g, x + 7, y - 1, shade(hair, 0.2));
    }
  }
  if (style === 'cap' || style === 'beanie') {
    const cap = L.capColor ?? '#0b2545';
    rect(g, x + 3, y + 1, 10, 3, OUT);
    rect(g, x + 4, y + 1, 8, 3, cap);
    hline(g, x + 4, y + 1, 8, shade(cap, 0.2));
    if (style === 'cap') {
      if (dir === 'down') rect(g, x + 4, y + 4, 8, 1, shade(cap, -0.25));
      if (dir === 'left') rect(g, x + 1, y + 3, 4, 2, shade(cap, -0.2));
      if (dir === 'right') rect(g, x + 11, y + 3, 4, 2, shade(cap, -0.2));
    } else {
      px(g, x + 7, y, cap);
      px(g, x + 8, y, cap);
    }
  }
  // face features
  const eye = '#20182a';
  if (dir === 'down') {
    px(g, x + 6, y + 6, eye);
    px(g, x + 9, y + 6, eye);
    px(g, x + 6, y + 5, shade(skin, 0.25));
    px(g, x + 9, y + 5, shade(skin, 0.25));
    hline(g, x + 7, y + 8, 2, shade(skin, -0.35));
    px(g, x + 5, y + 7, shade(skin, -0.08));
    px(g, x + 10, y + 7, shade(skin, -0.08));
  } else if (dir === 'left') {
    px(g, x + 5, y + 6, eye);
    px(g, x + 4, y + 8, shade(skin, -0.3));
  } else if (dir === 'right') {
    px(g, x + 10, y + 6, eye);
    px(g, x + 11, y + 8, shade(skin, -0.3));
  }
  if (L.beard && dir !== 'up') {
    const b = shade(hair, -0.1);
    if (dir === 'down') {
      rect(g, x + 5, y + 8, 6, 2, b);
      hline(g, x + 7, y + 8, 2, shade(skin, -0.35));
    } else rect(g, dir === 'left' ? x + 4 : x + 8, y + 8, 4, 2, b);
  }
  // accessories on head
  const acc = L.accessory ?? 'none';
  if (acc === 'glasses' && dir !== 'up') {
    if (dir === 'down') {
      rect(g, x + 5, y + 5, 3, 3, '#2a2a2a');
      rect(g, x + 8, y + 5, 3, 3, '#2a2a2a');
      px(g, x + 6, y + 6, '#cfe8ff');
      px(g, x + 9, y + 6, '#cfe8ff');
    } else rect(g, dir === 'left' ? x + 4 : x + 9, y + 5, 3, 3, '#2a2a2a');
  }
  if (acc === 'goggles') {
    rect(g, x + 4, y + 3, 8, 2, '#5d6675');
    if (dir === 'down') {
      px(g, x + 6, y + 3, '#7cf2ff');
      px(g, x + 9, y + 3, '#7cf2ff');
    }
  }
  if (acc === 'headset') {
    rect(g, x + 3, y + 2, 10, 1, '#333');
    if (dir !== 'right') rect(g, x + 2, y + 5, 2, 3, '#333');
    if (dir !== 'left') rect(g, x + 12, y + 5, 2, 3, '#333');
    if (dir === 'down') hline(g, x + 3, y + 8, 3, '#333');
  }
}

function body(g: Ctx, x: number, y: number, dir: Dir, frame: number, L: Look): void {
  const top = L.top;
  const bottom = L.bottom;
  const shoes = L.shoes;
  const swing = frame === 0 ? 0 : frame === 1 ? 1 : -1;
  // legs
  const legY = y + 17;
  if (dir === 'down' || dir === 'up') {
    const lLift = frame === 1 ? 1 : 0;
    const rLift = frame === 2 ? 1 : 0;
    rect(g, x + 4, legY, 4, 5 - lLift, OUT);
    rect(g, x + 8, legY, 4, 5 - rLift, OUT);
    rect(g, x + 5, legY, 2, 4 - lLift, bottom);
    rect(g, x + 9, legY, 2, 4 - rLift, bottom);
    rect(g, x + 5, legY + 4 - lLift, 2, 1, shoes);
    rect(g, x + 9, legY + 4 - rLift, 2, 1, shoes);
  } else {
    const fwd = dir === 'left' ? -1 : 1;
    const a = swing * fwd;
    rect(g, x + 5 + a, legY, 4, 5, OUT);
    rect(g, x + 7 - a, legY, 4, 5, OUT);
    rect(g, x + 6 + a, legY, 2, 4, shade(bottom, -0.15));
    rect(g, x + 8 - a, legY, 2, 4, bottom);
    rect(g, x + 6 + a + (fwd < 0 ? -1 : 0), legY + 4, 3, 1, shoes);
    rect(g, x + 8 - a + (fwd < 0 ? -1 : 0), legY + 4, 3, 1, shoes);
  }
  // torso
  rect(g, x + 3, y + 10, 10, 8, OUT);
  rect(g, x + 4, y + 11, 8, 6, top);
  hline(g, x + 4, y + 11, 8, shade(top, 0.15));
  hline(g, x + 4, y + 16, 8, shade(top, -0.2));
  rect(g, x + 4, y + 16, 8, 1, shade(bottom, -0.1));
  // arms
  const armA = dir === 'down' || dir === 'up' ? swing : 0;
  if (dir !== 'right') {
    rect(g, x + 2, y + 11 - armA, 2, 5, OUT);
    rect(g, x + 2, y + 11 - armA, 1, 4, shade(top, -0.1));
    px(g, x + 2, y + 15 - armA, L.skin);
  }
  if (dir !== 'left') {
    rect(g, x + 12, y + 11 + armA, 2, 5, OUT);
    rect(g, x + 13, y + 11 + armA, 1, 4, shade(top, -0.1));
    px(g, x + 13, y + 15 + armA, L.skin);
  }
  if (dir === 'left' || dir === 'right') {
    const ax = dir === 'left' ? x + 7 + swing : x + 7 - swing;
    rect(g, ax, y + 12, 2, 4, shade(top, -0.2));
    px(g, ax, y + 15, L.skin);
  }
  const acc = L.accessory ?? 'none';
  if (acc === 'scarf') {
    rect(g, x + 4, y + 10, 8, 2, '#e05d5d');
    if (dir === 'down') rect(g, x + 9, y + 12, 2, 3, '#e05d5d');
  }
  if (acc === 'whistle' && dir === 'down') {
    vline(g, x + 7, y + 11, 3, '#ddd');
    px(g, x + 7, y + 14, '#a5acaf');
  }
  if (acc === 'badge' && dir === 'down') {
    rect(g, x + 9, y + 12, 2, 2, '#ffd166');
  }
}

function robot(g: Ctx, x: number, y: number, dir: Dir, frame: number, L: Look): void {
  const b = L.top;
  const bob = frame === 0 ? 0 : 1;
  // hover shadow handled by game; body floats
  rect(g, x + 2, y + 4 + bob, 12, 12, OUT);
  rect(g, x + 3, y + 5 + bob, 10, 10, b);
  hline(g, x + 3, y + 5 + bob, 10, shade(b, 0.25));
  rect(g, x + 4, y + 7 + bob, 8, 5, '#0b1424');
  if (dir !== 'up') {
    const ex = dir === 'left' ? -1 : dir === 'right' ? 1 : 0;
    px(g, x + 6 + ex, y + 9 + bob, '#7cf2ff');
    px(g, x + 9 + ex, y + 9 + bob, '#7cf2ff');
  }
  vline(g, x + 8, y + 1 + bob, 3, '#888');
  px(g, x + 8, y + bob, frame === 2 ? '#ff5d5d' : '#7dff9b');
  rect(g, x + 5, y + 16 + bob, 6, 3, OUT);
  rect(g, x + 6, y + 16 + bob, 4, 2, shade(b, -0.2));
  rect(g, x + 6, y + 20, 4, 1, 'rgba(124,242,255,0.5)');
}

/** A 48x96 sheet: rows down/left/right/up, columns stand/step/step. */
export function characterSheet(L: Look): HTMLCanvasElement {
  const { c, g } = makeCanvas(CHAR_W * 3, CHAR_H * 4);
  DIRS.forEach((dir, row) => {
    for (let f = 0; f < 3; f++) {
      const x = f * CHAR_W;
      const y = row * CHAR_H;
      if (L.robot) {
        robot(g, x, y, dir, f, L);
        continue;
      }
      if (dir === 'up') {
        body(g, x, y, dir, f, L);
        head(g, x, y, dir, L);
      } else {
        body(g, x, y, dir, f, L);
        head(g, x, y, dir, L);
      }
    }
  });
  return c;
}

/** 48x48 dialogue portrait in the same style. */
export function portrait(L: Look): HTMLCanvasElement {
  const { c, g } = makeCanvas(48, 48);
  rect(g, 0, 0, 48, 48, shade(L.top, -0.55));
  for (let y = 0; y < 48; y += 2) hline(g, 0, y, 48, shade(L.top, -0.5));
  if (L.robot) {
    rect(g, 10, 10, 28, 26, OUT);
    rect(g, 11, 11, 26, 24, L.top);
    rect(g, 14, 16, 20, 12, '#0b1424');
    rect(g, 18, 20, 3, 3, '#7cf2ff');
    rect(g, 27, 20, 3, 3, '#7cf2ff');
    vline(g, 24, 4, 7, '#888');
    circle(g, 24, 4, 2, '#7dff9b');
    rect(g, 14, 38, 20, 10, shade(L.top, -0.2));
    return c;
  }
  // shoulders
  rect(g, 6, 36, 36, 12, OUT);
  rect(g, 7, 37, 34, 11, L.top);
  hline(g, 7, 37, 34, shade(L.top, 0.2));
  rect(g, 20, 34, 8, 4, L.skin);
  // head
  rect(g, 12, 8, 24, 27, OUT);
  rect(g, 13, 9, 22, 25, L.skin);
  rect(g, 13, 30, 22, 4, shade(L.skin, -0.12));
  const style = L.hairStyle;
  if (style !== 'bald') {
    rect(g, 12, 6, 24, 8, OUT);
    rect(g, 13, 7, 22, 6, L.hair);
    hline(g, 14, 7, 18, shade(L.hair, 0.2));
    rect(g, 13, 12, 3, 6, L.hair);
    rect(g, 32, 12, 3, 6, L.hair);
    if (style === 'long') {
      rect(g, 10, 12, 4, 22, L.hair);
      rect(g, 34, 12, 4, 22, L.hair);
    }
    if (style === 'curly') for (let i = 0; i < 6; i++) circle(g, 14 + i * 4, 7, 2, L.hair);
    if (style === 'bun') circle(g, 24, 4, 4, L.hair);
    if (style === 'swoop') rect(g, 18, 12, 12, 3, L.hair);
  }
  if (style === 'cap' || style === 'beanie') {
    const cap = L.capColor ?? '#0b2545';
    rect(g, 11, 4, 26, 10, OUT);
    rect(g, 12, 5, 24, 8, cap);
    if (style === 'cap') rect(g, 12, 12, 24, 3, shade(cap, -0.3));
  }
  // eyes, brows, mouth
  rect(g, 18, 19, 3, 4, '#20182a');
  rect(g, 27, 19, 3, 4, '#20182a');
  px(g, 18, 19, '#ffffff');
  px(g, 27, 19, '#ffffff');
  hline(g, 17, 17, 4, shade(L.hair, -0.1));
  hline(g, 27, 17, 4, shade(L.hair, -0.1));
  hline(g, 21, 28, 6, shade(L.skin, -0.4));
  px(g, 20, 27, shade(L.skin, -0.4));
  px(g, 27, 27, shade(L.skin, -0.4));
  rect(g, 15, 24, 3, 2, shade(L.skin, -0.06));
  rect(g, 30, 24, 3, 2, shade(L.skin, -0.06));
  if (L.beard) {
    rect(g, 15, 27, 18, 7, shade(L.hair, -0.05));
    hline(g, 21, 28, 6, shade(L.skin, -0.4));
  }
  const acc = L.accessory ?? 'none';
  if (acc === 'glasses') {
    rect(g, 16, 18, 7, 6, '#2a2a2a');
    rect(g, 25, 18, 7, 6, '#2a2a2a');
    rect(g, 17, 19, 5, 4, '#cfe8ff');
    rect(g, 26, 19, 5, 4, '#cfe8ff');
    rect(g, 18, 20, 2, 2, '#20182a');
    rect(g, 27, 20, 2, 2, '#20182a');
  }
  if (acc === 'headset') {
    rect(g, 11, 10, 26, 2, '#333');
    rect(g, 9, 18, 4, 8, '#333');
    rect(g, 13, 28, 8, 2, '#333');
  }
  if (acc === 'goggles') {
    rect(g, 13, 10, 22, 4, '#5d6675');
    rect(g, 16, 10, 5, 4, '#7cf2ff');
    rect(g, 27, 10, 5, 4, '#7cf2ff');
  }
  if (acc === 'scarf') rect(g, 10, 36, 28, 4, '#e05d5d');
  if (acc === 'whistle') {
    vline(g, 24, 38, 6, '#ddd');
    rect(g, 23, 44, 3, 2, '#a5acaf');
  }
  return c;
}

/** Player look. */
export const PLAYER_LOOK: Look = {
  skin: '#e2b48c',
  hair: '#4a3020',
  hairStyle: 'swoop',
  top: '#2e86de',
  bottom: '#2c3e50',
  shoes: '#f4efe2',
  beard: true,
};

import type Phaser from 'phaser';
import { characterSheet, portrait, CHAR_W, CHAR_H, type Look } from './art/characters';
import { drawText, fitText, textWidth } from './art/font';
import { box, block, glow, hline, makeCanvas, rect, shade, vline, px, circle } from './art/pixel';
import { SPRITES } from './art/sprites';
import { THEMES } from './art/themes';
import type { RoomTheme } from '@/lib/shared/types';

function addSheet(scene: Phaser.Scene, key: string, canvas: HTMLCanvasElement, fw: number, fh: number): void {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.addCanvas(key, canvas);
  if (!tex) return;
  const cols = Math.floor(canvas.width / fw);
  const rows = Math.floor(canvas.height / fh);
  let i = 0;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) tex.add(i++, 0, c * fw, r * fh, fw, fh);
}

/** Texture key for a sprite, drawing it on first use (themed sprites get one texture per theme). */
export function ensureSprite(scene: Phaser.Scene, name: string, themeKey: string): { key: string; frames: number; w: number; h: number } {
  const def = SPRITES[name] ?? SPRITES.desk;
  const key = def.themed ? `${name}@${themeKey}` : name;
  const frames = def.frames ?? 1;
  if (!scene.textures.exists(key)) {
    const theme = THEMES[themeKey] ?? THEMES.generic;
    const { c, g } = makeCanvas(def.w * frames, def.h);
    for (let f = 0; f < frames; f++) {
      g.save();
      g.translate(f * def.w, 0);
      def.draw(g, f, theme);
      g.restore();
    }
    addSheet(scene, key, c, def.w, def.h);
  }
  return { key, frames, w: def.w, h: def.h };
}

export function ensureAnim(scene: Phaser.Scene, key: string, frames: number, fps: number): string {
  const animKey = `${key}~${fps}`;
  if (!scene.anims.exists(animKey)) {
    scene.anims.create({ key: animKey, frames: scene.anims.generateFrameNumbers(key, { start: 0, end: frames - 1 }), frameRate: fps, repeat: -1 });
  }
  return animKey;
}

/** Character sheet + walk animations. */
export function ensureCharacter(scene: Phaser.Scene, key: string, look: Look): string {
  if (!scene.textures.exists(key)) addSheet(scene, key, characterSheet(look), CHAR_W, CHAR_H);
  const dirs = ['down', 'left', 'right', 'up'];
  dirs.forEach((d, row) => {
    const walk = `${key}-walk-${d}`;
    if (!scene.anims.exists(walk)) {
      scene.anims.create({ key: walk, frames: [1, 0, 2, 0].map((f) => ({ key, frame: row * 3 + f })), frameRate: 8, repeat: -1 });
    }
  });
  return key;
}

const portraitCache = new Map<string, string>();
/** Data URL portrait for React dialogue panels. */
export function portraitUrl(id: string, look: Look): string {
  const hit = portraitCache.get(id);
  if (hit) return hit;
  const url = portrait(look).toDataURL();
  portraitCache.set(id, url);
  return url;
}

export function ensureGlow(scene: Phaser.Scene, color: string): string {
  const key = `glow:${color}`;
  if (!scene.textures.exists(key)) scene.textures.addCanvas(key, glow(128, color));
  return key;
}

export function ensureBasics(scene: Phaser.Scene): void {
  if (!scene.textures.exists('shadow')) {
    const { c, g } = makeCanvas(14, 5);
    g.fillStyle = 'rgba(0,0,0,0.32)';
    g.beginPath();
    g.ellipse(7, 2.5, 7, 2.5, 0, 0, Math.PI * 2);
    g.fill();
    scene.textures.addCanvas('shadow', c);
  }
  if (!scene.textures.exists('pointer')) {
    const { c, g } = makeCanvas(9, 7);
    const pts = ['111111111', '011111110', '001111100', '000111000', '000010000'];
    pts.forEach((row, y) => [...row].forEach((ch, x) => ch === '1' && px(g, x, y + 1, '#ffe066')));
    hline(g, 0, 0, 9, '#7a5a00');
    scene.textures.addCanvas('pointer', c);
  }
  if (!scene.textures.exists('bang')) {
    const { c, g } = makeCanvas(9, 11);
    box(g, 0, 0, 9, 11, '#ffffff', { outline: '#1a1420' });
    rect(g, 4, 2, 1, 5, '#e74c3c');
    rect(g, 4, 8, 1, 1, '#e74c3c');
    scene.textures.addCanvas('bang', c);
  }
  if (!scene.textures.exists('vignette')) {
    const { c, g } = makeCanvas(256, 256);
    const grad = g.createRadialGradient(128, 128, 60, 128, 128, 180);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.55)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 256);
    scene.textures.addCanvas('vignette', c);
  }
  if (!scene.textures.exists('mote')) {
    const { c, g } = makeCanvas(2, 2);
    rect(g, 0, 0, 2, 2, '#ffffff');
    scene.textures.addCanvas('mote', c);
  }
}

/** Small sign plate with pixel text. */
export function ensureSign(scene: Phaser.Scene, text: string, color = '#f4efe2', bg = 'rgba(10,12,24,0.78)'): string {
  const key = `sign:${text}:${color}`;
  if (scene.textures.exists(key)) return key;
  const w = textWidth(text) + 6;
  const { c, g } = makeCanvas(w, 11);
  g.fillStyle = bg;
  g.fillRect(0, 0, w, 11);
  hline(g, 0, 10, w, 'rgba(0,0,0,0.5)');
  drawText(g, text, 3, 2, color);
  scene.textures.addCanvas(key, c);
  return key;
}

const BUILDING_COLORS: Record<string, { wall: string; roof: string; trim: string; glow: string }> = {
  warroom: { wall: '#0b2545', roof: '#06162b', trim: '#69be28', glow: '#b8f28c' },
  locked: { wall: '#4a4f5a', roof: '#2e323a', trim: '#7a808c', glow: '#3a3f48' },
};

/** Lane building facade for the Work District, 80x64, with the lane name on its sign. */
export function ensureBuilding(scene: Phaser.Scene, laneId: string, name: string, theme: RoomTheme | 'warroom' | 'locked', locked: boolean): string {
  const key = `bld:${laneId}:${name}:${theme}:${locked ? 1 : 0}`;
  if (scene.textures.exists(key)) return key;
  const t = THEMES[theme] ?? THEMES.generic;
  const pal = BUILDING_COLORS[theme] ?? { wall: shade(t.trim, -0.15), roof: shade(t.trim, -0.5), trim: t.accent, glow: t.light };
  const W = 80;
  const H = 64;
  const { c, g } = makeCanvas(W, H);
  // roof
  rect(g, 2, 2, W - 4, 10, pal.roof);
  hline(g, 2, 2, W - 4, shade(pal.roof, 0.25));
  for (let x = 4; x < W - 4; x += 6) vline(g, x, 3, 8, shade(pal.roof, -0.2));
  // facade
  block(g, 4, 10, W - 8, H - 10, 3, shade(pal.wall, 0.15), pal.wall);
  // windows
  const lit = !locked;
  for (const wx of [10, 54]) {
    box(g, wx, 18, 16, 14, '#2a2f3a');
    rect(g, wx + 2, 20, 12, 10, lit ? pal.glow : '#1d2230');
    if (lit) {
      hline(g, wx + 2, 20, 12, shade(pal.glow, 0.4));
      vline(g, wx + 7, 20, 10, '#2a2f3a');
    }
  }
  // sign plate: the short form of the lane name ("Publishing / X" -> "Publishing"), whole words only
  box(g, 4, 36, W - 8, 11, '#1a1d26', { outline: shade(pal.trim, -0.3) });
  const maxW = W - 12;
  const short = name.split(/\s+[/|]\s+/)[0].replace(/\s*\([^)]*\)\s*/g, ' ').trim() || name;
  let label = '';
  for (const word of short.split(/\s+/)) {
    const next = label ? `${label} ${word}` : word;
    if (textWidth(next) > maxW) break;
    label = next;
  }
  if (!label) label = fitText(short, maxW);
  drawText(g, label, Math.floor((W - textWidth(label)) / 2), 38, locked ? '#9aa1ad' : '#f4efe2');
  // door
  block(g, W / 2 - 9, 46, 18, 18, 2, shade(pal.trim, 0.1), shade(pal.trim, -0.25));
  rect(g, W / 2 - 6, 49, 12, 15, locked ? '#2a2d34' : '#14181f');
  if (lit) rect(g, W / 2 - 6, 49, 12, 3, shade(pal.glow, -0.1));
  px(g, W / 2 + 3, 57, '#f2c14e');
  if (theme === 'warroom') {
    circle(g, W / 2, 6, 3, '#69be28');
    rect(g, W / 2 - 3, 5, 7, 2, '#f4efe2');
  }
  if (locked) {
    box(g, W / 2 - 3, 52, 7, 6, '#c9a24c');
    rect(g, W / 2 - 1, 49, 3, 3, '#c9a24c');
  }
  // lamps by the door
  rect(g, W / 2 - 13, 48, 3, 4, lit ? '#ffe08a' : '#555');
  rect(g, W / 2 + 10, 48, 3, 4, lit ? '#ffe08a' : '#555');
  scene.textures.addCanvas(key, c);
  return key;
}

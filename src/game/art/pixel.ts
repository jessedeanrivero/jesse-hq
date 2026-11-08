// Tiny pixel-art toolkit: every texture in Jesse HQ is drawn with these at load time.

export type Ctx = CanvasRenderingContext2D;

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex(r: number, g: number, b: number): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** amt > 0 lightens toward white, amt < 0 darkens toward a cool shadow (not pure black). */
export function shade(hex: string, amt: number): string {
  const [r, g, b] = hexToRgb(hex);
  if (amt >= 0) return rgbToHex(r + (255 - r) * amt, g + (255 - g) * amt, b + (255 - b) * amt);
  const k = -amt;
  return rgbToHex(r * (1 - k) + 18 * k, g * (1 - k) + 14 * k, b * (1 - k) + 34 * k);
}

export function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  return rgbToHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
}

export function toNum(hex: string): number {
  return parseInt(hex.replace('#', ''), 16);
}

export function makeCanvas(w: number, h: number): { c: HTMLCanvasElement; g: Ctx } {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  const g = c.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  return { c, g };
}

export function rect(g: Ctx, x: number, y: number, w: number, h: number, color: string): void {
  if (w <= 0 || h <= 0) return;
  g.fillStyle = color;
  g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

export function px(g: Ctx, x: number, y: number, color: string): void {
  g.fillStyle = color;
  g.fillRect(Math.round(x), Math.round(y), 1, 1);
}

export function hline(g: Ctx, x: number, y: number, w: number, color: string): void {
  rect(g, x, y, w, 1, color);
}

export function vline(g: Ctx, x: number, y: number, h: number, color: string): void {
  rect(g, x, y, 1, h, color);
}

/** Outlined, shaded block: the basic unit of furniture. */
export function box(g: Ctx, x: number, y: number, w: number, h: number, base: string, opts: { outline?: string | false; top?: number; side?: number } = {}): void {
  const outline = opts.outline === false ? null : opts.outline ?? shade(base, -0.62);
  rect(g, x, y, w, h, outline ?? base);
  const ix = outline ? x + 1 : x;
  const iy = outline ? y + 1 : y;
  const iw = outline ? w - 2 : w;
  const ih = outline ? h - 2 : h;
  rect(g, ix, iy, iw, ih, base);
  hline(g, ix, iy, iw, shade(base, opts.top ?? 0.22));
  rect(g, ix, iy + ih - Math.max(1, Math.floor(ih / 6)), iw, Math.max(1, Math.floor(ih / 6)), shade(base, -(opts.side ?? 0.22)));
}

/** A box seen slightly from above: top surface plus front face. */
export function block(g: Ctx, x: number, y: number, w: number, h: number, topH: number, top: string, front: string): void {
  const outline = shade(front, -0.6);
  rect(g, x, y, w, h, outline);
  rect(g, x + 1, y + 1, w - 2, topH - 1, top);
  hline(g, x + 1, y + 1, w - 2, shade(top, 0.25));
  rect(g, x + 1, y + topH, w - 2, h - topH - 1, front);
  hline(g, x + 1, y + topH, w - 2, shade(front, -0.25));
  hline(g, x + 1, y + h - 2, w - 2, shade(front, -0.18));
}

export function circle(g: Ctx, cx: number, cy: number, r: number, color: string): void {
  g.fillStyle = color;
  for (let y = -r; y <= r; y++) {
    const half = Math.floor(Math.sqrt(r * r - y * y + r * 0.6));
    g.fillRect(Math.round(cx - half), Math.round(cy + y), half * 2 + 1, 1);
  }
}

export function dither(g: Ctx, x: number, y: number, w: number, h: number, a: string, b: string): void {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) px(g, x + i, y + j, (i + j) % 2 ? a : b);
}

/** Deterministic random for repeatable art. */
export function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function speckle(g: Ctx, x: number, y: number, w: number, h: number, colors: string[], density: number, r: () => number): void {
  const n = Math.floor(w * h * density);
  for (let i = 0; i < n; i++) px(g, x + Math.floor(r() * w), y + Math.floor(r() * h), colors[Math.floor(r() * colors.length)]);
}

/** Soft radial glow texture (for lamps, screens, fire). */
export function glow(size: number, color: string, strength = 0.9): HTMLCanvasElement {
  const { c, g } = makeCanvas(size, size);
  const [r, gg, b] = hexToRgb(color);
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, `rgba(${r},${gg},${b},${strength})`);
  grad.addColorStop(0.35, `rgba(${r},${gg},${b},${strength * 0.45})`);
  grad.addColorStop(1, `rgba(${r},${gg},${b},0)`);
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return c;
}

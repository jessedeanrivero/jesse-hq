// One palette per environment. All rooms share the same 16px scale and shading rules.

export type FloorStyle = 'tile' | 'wood' | 'carpet' | 'turf' | 'stone' | 'grass' | 'concrete' | 'checker' | 'boards';
export type WallStyle = 'panel' | 'plaster' | 'wallpaper' | 'acoustic' | 'brick' | 'wood' | 'hedge' | 'glass';

export interface Theme {
  floor: string;
  floor2: string;
  floorStyle: FloorStyle;
  wall: string;
  wallTop: string;
  wallStyle: WallStyle;
  trim: string;
  accent: string;
  light: string;
  /** Room-wide tint (0xRRGGBB) and alpha for mood lighting */
  ambient: [number, number];
  rug?: string;
}

export const THEMES: Record<string, Theme> = {
  command: { floor: '#1a2335', floor2: '#202b42', floorStyle: 'tile', wall: '#26324c', wallTop: '#121827', wallStyle: 'panel', trim: '#3fd0ff', accent: '#38e1ff', light: '#5fe3ff', ambient: [0x0a1030, 0.18], rug: '#173a4f' },
  plaza: { floor: '#8a8277', floor2: '#7a7369', floorStyle: 'stone', wall: '#3b4a5e', wallTop: '#22303f', wallStyle: 'brick', trim: '#e8c170', accent: '#ffd27a', light: '#ffd27a', ambient: [0x18203a, 0.12] },
  devoffice: { floor: '#3a4b5e', floor2: '#34445a', floorStyle: 'carpet', wall: '#c9d3dd', wallTop: '#7f8fa3', wallStyle: 'plaster', trim: '#5b8def', accent: '#7fb2ff', light: '#cfe2ff', ambient: [0x101a30, 0.08] },
  writersroom: { floor: '#8a5a3c', floor2: '#7c5035', floorStyle: 'wood', wall: '#e8d9c4', wallTop: '#a88c6a', wallStyle: 'wallpaper', trim: '#b5651d', accent: '#f2a65a', light: '#ffd9a0', ambient: [0x2a1a10, 0.1], rug: '#7a2e3a' },
  studio: { floor: '#2e2a35', floor2: '#28242f', floorStyle: 'carpet', wall: '#3a3347', wallTop: '#221e2b', wallStyle: 'acoustic', trim: '#e05d5d', accent: '#ff7a7a', light: '#ffb38a', ambient: [0x140a1c, 0.18], rug: '#4b2a3a' },
  workshop: { floor: '#b98b5e', floor2: '#ad8054', floorStyle: 'wood', wall: '#f0e6d2', wallTop: '#b9a582', wallStyle: 'plaster', trim: '#6aa84f', accent: '#9ccc65', light: '#fff1c9', ambient: [0x20180a, 0.05], rug: '#4f7a3a' },
  label: { floor: '#2b2b2b', floor2: '#d9d4c7', floorStyle: 'checker', wall: '#7a2e3a', wallTop: '#4a1a24', wallStyle: 'wallpaper', trim: '#f2c14e', accent: '#ffd56b', light: '#ffe3a3', ambient: [0x1a0a10, 0.1] },
  archive: { floor: '#7f8487', floor2: '#777c7f', floorStyle: 'concrete', wall: '#9aa1a6', wallTop: '#5f666b', wallStyle: 'panel', trim: '#d98e04', accent: '#f5b041', light: '#fff0c2', ambient: [0x101418, 0.12] },
  broadcast: { floor: '#2a1f3d', floor2: '#251b37', floorStyle: 'carpet', wall: '#1f1830', wallTop: '#120d1f', wallStyle: 'acoustic', trim: '#ff4d6d', accent: '#ff7a93', light: '#ffd0dc', ambient: [0x120820, 0.2], rug: '#3d2a5c' },
  office: { floor: '#a39b8b', floor2: '#9a9282', floorStyle: 'carpet', wall: '#e3ddd1', wallTop: '#a59d8e', wallStyle: 'plaster', trim: '#4a6fa5', accent: '#7c9cc9', light: '#fff6dd', ambient: [0x1a1810, 0.05] },
  backstage: { floor: '#1d1d1f', floor2: '#232326', floorStyle: 'boards', wall: '#141416', wallTop: '#0a0a0b', wallStyle: 'brick', trim: '#f5d76e', accent: '#ffe08a', light: '#ffe8a8', ambient: [0x0a0a10, 0.28] },
  generic: { floor: '#5a6270', floor2: '#535a67', floorStyle: 'carpet', wall: '#d5d9df', wallTop: '#8c939e', wallStyle: 'plaster', trim: '#6c8ebf', accent: '#9ab6e0', light: '#eef4ff', ambient: [0x10141c, 0.08] },
  warroom: { floor: '#2f7d32', floor2: '#2a7030', floorStyle: 'turf', wall: '#0b2545', wallTop: '#06162b', wallStyle: 'panel', trim: '#69be28', accent: '#a5acaf', light: '#b8f28c', ambient: [0x041226, 0.16] },
  comms: { floor: '#16302f', floor2: '#1a3735', floorStyle: 'tile', wall: '#1e3b3a', wallTop: '#0f2221', wallStyle: 'panel', trim: '#2ee6a6', accent: '#6dffc9', light: '#9effd9', ambient: [0x041a18, 0.16] },
  library: { floor: '#4a2f1f', floor2: '#43291b', floorStyle: 'wood', wall: '#5b3a29', wallTop: '#3a2419', wallStyle: 'wood', trim: '#d4a24c', accent: '#ffcf70', light: '#ffd58a', ambient: [0x1a0e06, 0.22], rug: '#5c1f2a' },
  lab: { floor: '#14161c', floor2: '#181b22', floorStyle: 'tile', wall: '#1d212b', wallTop: '#0e1016', wallStyle: 'panel', trim: '#7cf2ff', accent: '#b18cff', light: '#8ff7ff', ambient: [0x060818, 0.24] },
  hall: { floor: '#6b4a33', floor2: '#62432e', floorStyle: 'wood', wall: '#d8c3a5', wallTop: '#9c8566', wallStyle: 'wallpaper', trim: '#8c5a7a', accent: '#c48bb5', light: '#ffe2b8', ambient: [0x1a1008, 0.1], rug: '#5a3d5c' },
  lounge: { floor: '#7a4b2f', floor2: '#6f4329', floorStyle: 'wood', wall: '#3d2a3f', wallTop: '#24182a', wallStyle: 'wallpaper', trim: '#ffb86b', accent: '#ffcf8a', light: '#ffb86b', ambient: [0x1c0c18, 0.2], rug: '#8c3b4f' },
  garden: { floor: '#3f7d3a', floor2: '#4a8c44', floorStyle: 'grass', wall: '#2f5e2c', wallTop: '#1e3f1c', wallStyle: 'hedge', trim: '#ffd27a', accent: '#ffe9a8', light: '#ffe08a', ambient: [0x08102a, 0.2] },
  personal: { floor: '#c7a07a', floor2: '#bd966f', floorStyle: 'wood', wall: '#dfe8dc', wallTop: '#9fb39c', wallStyle: 'plaster', trim: '#8fb996', accent: '#b5d9b9', light: '#fff4dc', ambient: [0x10180c, 0.04], rug: '#d9b8a0' },
};

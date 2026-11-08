// Room definitions. Static rooms are hand-laid; the Work District and lane rooms are generated
// from the lane registry so the world follows the operating system when lanes change.
import type { Ctx } from './art/pixel';
import { rect, vline, hline } from './art/pixel';
import type { Dir } from './art/characters';
import type { RoomTheme } from '@/lib/shared/types';

export type ExitDir = 'up' | 'down' | 'left' | 'right' | 'any';

export type Action =
  | { type: 'panel'; panel: string; props?: Record<string, unknown> }
  | { type: 'link'; url: string; label?: string }
  | { type: 'travel'; to: string; spawn?: string }
  | { type: 'npc'; npcId: string }
  | { type: 'music' }
  | { type: 'locked'; message: string };

export interface Interact {
  verb: string;
  label: string;
  action: Action;
  secondary?: { label: string; action: Action };
}

export interface ObjDef {
  id: string;
  sprite: string;
  /** Pixel position of the sprite's bottom-center */
  x: number;
  y: number;
  /** Mounted on the wall face: no collision, drawn behind actors */
  wall?: boolean;
  /** Collision box size at the sprite's base (defaults from sprite size) */
  solid?: boolean | { w: number; h: number };
  interact?: Interact;
  glow?: { color: string; radius: number; alpha?: number; flicker?: boolean; dy?: number };
  fps?: number;
  flipX?: boolean;
  /** Dynamic texture key generated at build time (e.g. a lane building) */
  generated?: { kind: 'building'; laneId: string; name: string; theme: RoomTheme | 'warroom' | 'locked'; locked?: boolean };
}

export interface ExitDef {
  x: number;
  y: number;
  w: number;
  h: number;
  dir: ExitDir;
  to: string;
  spawn: string;
  label: string;
  locked?: string;
}

export interface NpcPlace {
  id: string;
  x: number;
  y: number;
  dir?: Dir;
  wander?: { x: number; y: number; w: number; h: number };
}

export interface SignDef {
  x: number;
  y: number;
  text: string;
  color?: string;
  bg?: string;
}

export interface RoomDef {
  id: string;
  name: string;
  theme: string;
  rows: string[];
  spawns: Record<string, { x: number; y: number; dir?: Dir }>;
  exits: ExitDef[];
  objects: ObjDef[];
  npcs: NpcPlace[];
  signs: SignDef[];
  ambience: 'hum' | 'lounge' | 'garden' | 'library' | 'lab' | 'crowd' | 'plaza' | 'quiet' | 'studio';
  floor: 'ground' | 'upper';
  /** Allowed on phone when the laptop rule is on */
  phoneOk: boolean;
  /** Extra paint on the background canvas (yard lines, etc.) */
  decorate?: (g: Ctx, w: number, h: number) => void;
  blurb: string;
}

export interface LaneLite {
  id: string;
  name: string;
  theme: RoomTheme;
  closed: boolean;
  personal: boolean;
  openCount?: number;
}

export interface WorldContext {
  lanes: LaneLite[] | null;
  phoneMode: boolean;
  phoneLanes: string[];
  hour: number;
}

const T = 16;
export const tx = (n: number) => n * T + T / 2;
export const ty = (n: number) => n * T + T;

type Gap = { side: 'bottom' | 'left' | 'right'; at: number; len?: number };
type Fill = { ch: string; x: number; y: number; w: number; h: number };

function grid(w: number, h: number, gaps: Gap[] = [], fills: Fill[] = []): string[] {
  const g: string[][] = Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => (y < 2 || y === h - 1 || x === 0 || x === w - 1 ? '#' : '.')));
  for (const f of fills) for (let y = f.y; y < f.y + f.h; y++) for (let x = f.x; x < f.x + f.w; x++) if (g[y]?.[x] === '.') g[y][x] = f.ch;
  for (const gap of gaps) {
    const len = gap.len ?? 1;
    for (let i = 0; i < len; i++) {
      if (gap.side === 'bottom') g[h - 1][gap.at + i] = '.';
      if (gap.side === 'left') g[gap.at + i][0] = '.';
      if (gap.side === 'right') g[gap.at + i][w - 1] = '.';
    }
  }
  return g.map((r) => r.join(''));
}

const panel = (p: string, props?: Record<string, unknown>): Action => ({ type: 'panel', panel: p, props });

export function windowFor(hour: number): string {
  if (hour >= 7 && hour < 17) return 'windowDay';
  if (hour >= 17 && hour < 20) return 'windowDusk';
  return 'windowNight';
}

// ── Command Center ────────────────────────────────────────────────────────────
function commandCenter(): RoomDef {
  const w = 24;
  const h = 16;
  return {
    id: 'command',
    name: 'Command Center',
    theme: 'command',
    floor: 'ground',
    phoneOk: false,
    ambience: 'hum',
    blurb: 'Headquarters. Today, the latest checkout, open loops, deadlines and decisions, all from your own records.',
    rows: grid(w, h, [
      { side: 'left', at: 8, len: 2 },
      { side: 'right', at: 8, len: 2 },
      { side: 'bottom', at: 3, len: 2 },
    ], [{ ch: 'r', x: 7, y: 4, w: 10, h: 7 }]),
    spawns: {
      default: { x: tx(12), y: ty(12), dir: 'up' },
      fromWork: { x: tx(3) + 8, y: ty(3), dir: 'down' },
      fromComms: { x: tx(22), y: ty(8) + 8, dir: 'left' },
      fromLibrary: { x: tx(1), y: ty(8) + 8, dir: 'right' },
      fromLab: { x: tx(4), y: ty(13), dir: 'up' },
      fromHall: { x: tx(19), y: ty(12), dir: 'left' },
    },
    exits: [
      { x: 2 * T + 8, y: 2 * T, w: 32, h: 12, dir: 'up', to: 'work', spawn: 'fromCommand', label: 'Work District' },
      { x: (w - 1) * T, y: 8 * T, w: T, h: 2 * T, dir: 'right', to: 'comms', spawn: 'fromCommand', label: 'Communications Hub' },
      { x: 0, y: 8 * T, w: T, h: 2 * T, dir: 'left', to: 'library', spawn: 'fromCommand', label: 'Library' },
      { x: 3 * T, y: (h - 1) * T, w: 2 * T, h: T, dir: 'down', to: 'lab', spawn: 'fromCommand', label: 'AI & Automation Lab' },
      { x: 19 * T, y: 13 * T, w: 2 * T, h: 2 * T, dir: 'any', to: 'hall', spawn: 'fromCommand', label: 'Upstairs' },
    ],
    objects: [
      { id: 'door-work', sprite: 'door', x: tx(3) + 8, y: ty(1), wall: true },
      {
        id: 'wall-monitor',
        sprite: 'wallScreen',
        x: tx(12) - 8,
        y: ty(1) + 2,
        wall: true,
        fps: 1.5,
        glow: { color: '#5fe3ff', radius: 90, alpha: 0.35, flicker: true, dy: -20 },
        interact: { verb: 'Read', label: 'Wall monitor: everything at a glance', action: panel('wall') },
      },
      {
        id: 'bulletin',
        sprite: 'bulletin',
        x: tx(6) + 4,
        y: ty(1) + 1,
        wall: true,
        interact: { verb: 'Read', label: 'Open loops board', action: panel('loops'), secondary: { label: 'Waiting on others', action: panel('loops', { tab: 'waiting' }) } },
      },
      {
        id: 'whiteboard',
        sprite: 'whiteboard',
        x: tx(18),
        y: ty(1) + 1,
        wall: true,
        interact: { verb: 'Read', label: 'Priorities whiteboard', action: panel('priorities') },
      },
      { id: 'calendar', sprite: 'calendar', x: tx(21), y: ty(1) + 1, wall: true, interact: { verb: 'Check', label: 'Calendar', action: panel('calendar') } },
      {
        id: 'command-desk',
        sprite: 'commandDesk',
        x: tx(12) - 8,
        y: ty(7),
        fps: 2,
        solid: { w: 76, h: 14 },
        glow: { color: '#5fe3ff', radius: 70, alpha: 0.28, dy: -24 },
        interact: {
          verb: 'Use',
          label: 'Command desk: daily briefing',
          action: panel('briefing'),
          secondary: { label: 'Latest checkout', action: panel('checkout') },
        },
      },
      { id: 'cabinet-1', sprite: 'cabinet', x: tx(1) + 2, y: ty(4), solid: true, interact: { verb: 'Open', label: 'Filing cabinet: source documents', action: panel('sources') } },
      { id: 'cabinet-2', sprite: 'cabinet', x: tx(2) + 2, y: ty(4), solid: true },
      { id: 'term-deadlines', sprite: 'terminal', x: tx(8), y: ty(13), fps: 1, solid: { w: 20, h: 10 }, interact: { verb: 'Check', label: 'Deadlines terminal', action: panel('deadlines') } },
      { id: 'term-decisions', sprite: 'terminal', x: tx(11), y: ty(13), fps: 1, solid: { w: 20, h: 10 }, interact: { verb: 'Check', label: 'Decisions awaiting you', action: panel('decisions') } },
      { id: 'term-lanes', sprite: 'terminal', x: tx(14), y: ty(13), fps: 1, solid: { w: 20, h: 10 }, interact: { verb: 'Check', label: 'Lane activity', action: panel('lanes') } },
      { id: 'term-os', sprite: 'deskPc', x: tx(4), y: ty(10), fps: 1, solid: { w: 30, h: 10 }, interact: { verb: 'Read', label: 'Operating system context', action: panel('os') } },
      { id: 'stairs', sprite: 'stairsUp', x: tx(19) + 8, y: ty(14) },
      { id: 'plant-1', sprite: 'plant', x: tx(22), y: ty(4), solid: true },
      { id: 'plant-2', sprite: 'plant', x: tx(1) + 4, y: ty(14), solid: true },
      { id: 'plant-3', sprite: 'plant', x: tx(22), y: ty(14), solid: true },
      { id: 'clock', sprite: 'clock', x: tx(9) - 4, y: ty(1) - 2, wall: true },
    ],
    npcs: [{ id: 'chief', x: tx(16), y: ty(8), dir: 'left', wander: { x: 15 * T, y: 7 * T, w: 4 * T, h: 3 * T } }],
    signs: [
      { x: tx(3) + 8, y: 2, text: 'WORK DISTRICT' },
      { x: tx(23) - 6, y: ty(7) - 8, text: 'COMMS' },
      { x: tx(0) + 10, y: ty(7) - 8, text: 'LIBRARY' },
      { x: tx(3) + 8, y: ty(14) + 4, text: 'LAB' },
      { x: tx(19) + 8, y: ty(12) - 4, text: 'UPSTAIRS' },
    ],
  };
}

// ── Work District ─────────────────────────────────────────────────────────────
const BUILDING_W = 5;

function workDistrict(ctx: WorldContext): RoomDef {
  const lanes = (ctx.lanes ?? []).filter((l) => !l.personal);
  const slots = Math.max(3, lanes.length) + 1;
  const w = Math.max(26, 2 + slots * (BUILDING_W + 1) + 1);
  const h = 15;
  const rows = grid(w, h, [{ side: 'bottom', at: Math.floor(w / 2) - 1, len: 2 }]).map((r, y) =>
    y >= 2 && y <= 4 ? r.replace(/\./g, '#').replace(/^#/, '#') : r
  );
  // Building facades occupy rows 0-4; ground starts at row 5.
  const objects: ObjDef[] = [];
  const exits: ExitDef[] = [];
  const signs: SignDef[] = [];
  const spawns: RoomDef['spawns'] = {
    default: { x: tx(Math.floor(w / 2)), y: ty(12), dir: 'up' },
    fromCommand: { x: tx(Math.floor(w / 2)), y: ty(12), dir: 'up' },
  };
  const entries: (LaneLite | 'warroom' | null)[] = [];
  if (lanes.length) entries.push(...lanes);
  else entries.push(null, null, null);
  entries.splice(Math.min(entries.length, 1), 0, 'warroom');
  entries.forEach((entry, i) => {
    const left = 2 + i * (BUILDING_W + 1);
    const cx = left * T + (BUILDING_W * T) / 2;
    const doorY = 5 * T;
    if (entry === 'warroom') {
      objects.push({ id: 'bld-warroom', sprite: 'gen:bld:warroom', x: cx, y: ty(4), wall: true, generated: { kind: 'building', laneId: 'warroom', name: 'HAWKS WAR ROOM', theme: 'warroom' } });
      exits.push({ x: cx - 12, y: doorY, w: 24, h: 10, dir: 'up', to: 'warroom', spawn: 'fromWork', label: 'Hawks War Room' });
      spawns.fromWarroom = { x: cx, y: ty(6), dir: 'down' };
      return;
    }
    if (!entry) {
      objects.push({
        id: `bld-locked-${i}`,
        sprite: `gen:bld:locked-${i}`,
        x: cx,
        y: ty(4),
        wall: true,
        generated: { kind: 'building', laneId: `locked-${i}`, name: 'SIGN IN', theme: 'locked', locked: true },
        interact: { verb: 'Read', label: 'Lane buildings appear once your Drive is connected', action: panel('setup') },
      });
      return;
    }
    const phoneLocked = ctx.phoneMode && !ctx.phoneLanes.includes(entry.id);
    objects.push({
      id: `bld-${entry.id}`,
      sprite: `gen:bld:${entry.id}`,
      x: cx,
      y: ty(4),
      wall: true,
      generated: { kind: 'building', laneId: entry.id, name: entry.name.toUpperCase(), theme: entry.theme, locked: phoneLocked || entry.closed },
      interact: phoneLocked
        ? { verb: 'Read', label: `${entry.name}: laptop only (your laptop rule)`, action: { type: 'locked', message: 'Work stays on the laptop. Turn off phone mode in Settings to open this lane here.' } }
        : undefined,
    });
    if (!phoneLocked) {
      exits.push({ x: cx - 12, y: doorY, w: 24, h: 10, dir: 'up', to: `lane:${entry.id}`, spawn: 'fromWork', label: entry.name });
      spawns[`fromLane:${entry.id}`] = { x: cx, y: ty(6), dir: 'down' };
    }
  });
  // Plaza dressing
  const mid = Math.floor(w / 2);
  objects.push({ id: 'fountain', sprite: 'fountain', x: tx(mid) - 8, y: ty(9), fps: 2, solid: { w: 44, h: 16 } });
  objects.push({
    id: 'kiosk',
    sprite: 'kiosk',
    x: tx(mid - 4),
    y: ty(11),
    solid: { w: 10, h: 6 },
    interact: { verb: 'Read', label: 'Lane directory', action: panel('lanes') },
  });
  for (let x = 3; x < w - 2; x += 7) objects.push({ id: `lamp-${x}`, sprite: 'lampPost', x: tx(x), y: ty(7), solid: { w: 6, h: 4 }, glow: { color: '#ffd27a', radius: 50, alpha: 0.35, dy: -34 } });
  objects.push({ id: 'flowers-a', sprite: 'flowers', x: tx(mid + 4), y: ty(12), solid: true });
  objects.push({ id: 'flowers-b', sprite: 'flowers', x: tx(mid - 7), y: ty(13), solid: true });
  objects.push({ id: 'bench-a', sprite: 'bench', x: tx(mid + 6), y: ty(10), solid: true });
  signs.push({ x: tx(mid) - 8, y: ty(13) + 4, text: 'COMMAND CENTER' });
  return {
    id: 'work',
    name: 'Work District',
    theme: 'plaza',
    floor: 'ground',
    phoneOk: true,
    ambience: 'plaza',
    blurb: 'One building per active lane, read from the current operating-system file, plus the Hawks War Room.',
    rows,
    spawns,
    exits: [...exits, { x: (mid - 1) * T, y: (h - 1) * T, w: 2 * T, h: T, dir: 'down', to: 'command', spawn: 'fromWork', label: 'Command Center' }],
    objects,
    npcs: [{ id: 'coordinator', x: tx(mid - 3), y: ty(11), dir: 'down', wander: { x: (mid - 6) * T, y: 9 * T, w: 5 * T, h: 3 * T } }],
    signs,
  };
}

// ── Lane rooms ────────────────────────────────────────────────────────────────
const CENTERPIECE: Record<RoomTheme, { sprite: string; extra: { sprite: string; dx: number; dy: number; solid?: boolean }[] }> = {
  devoffice: { sprite: 'serverDesk', extra: [{ sprite: 'rack', dx: 5, dy: -1 }, { sprite: 'deskPc', dx: -4, dy: 2 }, { sprite: 'plant', dx: 6, dy: 3 }] },
  writersroom: { sprite: 'piano', extra: [{ sprite: 'guitar', dx: 3, dy: 0 }, { sprite: 'floorLamp', dx: -3, dy: 0 }, { sprite: 'armchair', dx: 5, dy: 3 }] },
  studio: { sprite: 'mixer', extra: [{ sprite: 'mic', dx: 4, dy: 3 }, { sprite: 'guitar', dx: -4, dy: 3 }, { sprite: 'floorLamp', dx: 6, dy: 0 }] },
  workshop: { sprite: 'table', extra: [{ sprite: 'chair', dx: -2, dy: 1 }, { sprite: 'chair', dx: 2, dy: 1 }, { sprite: 'plant', dx: 6, dy: 2 }, { sprite: 'coffee', dx: -5, dy: 3 }] },
  label: { sprite: 'crate', extra: [{ sprite: 'crate', dx: 2, dy: 0 }, { sprite: 'recordPlayer', dx: -3, dy: 0 }, { sprite: 'armchair', dx: 5, dy: 3 }] },
  archive: { sprite: 'boxes', extra: [{ sprite: 'boxes', dx: 3, dy: 1 }, { sprite: 'boxes', dx: -4, dy: 2 }, { sprite: 'cabinet', dx: 6, dy: 0 }] },
  broadcast: { sprite: 'camera', extra: [{ sprite: 'ringlight', dx: 2, dy: 0 }, { sprite: 'mic', dx: -2, dy: 2 }, { sprite: 'beanbag', dx: 0, dy: 3 }] },
  office: { sprite: 'desk', extra: [{ sprite: 'chair', dx: 0, dy: 1 }, { sprite: 'clock', dx: 4, dy: -3 }, { sprite: 'plant', dx: 6, dy: 2 }] },
  backstage: { sprite: 'mic', extra: [{ sprite: 'guitar', dx: 2, dy: 0 }, { sprite: 'boxes', dx: -4, dy: 1 }, { sprite: 'floorLamp', dx: 5, dy: 0 }] },
  generic: { sprite: 'desk', extra: [{ sprite: 'plant', dx: 5, dy: 1 }, { sprite: 'chair', dx: 0, dy: 1 }] },
};

export function laneRoom(lane: LaneLite): RoomDef {
  const w = 18;
  const h = 13;
  const theme = lane.theme;
  const cp = CENTERPIECE[theme] ?? CENTERPIECE.generic;
  const cx = 9;
  const cy = 7;
  const objects: ObjDef[] = [
    { id: 'board-overview', sprite: 'whiteboard', x: tx(4), y: ty(1) + 1, wall: true, interact: { verb: 'Read', label: 'Objectives and status', action: panel('lane', { laneId: lane.id, tab: 'overview' }) } },
    { id: 'board-loops', sprite: 'bulletin', x: tx(9), y: ty(1) + 1, wall: true, interact: { verb: 'Read', label: 'Open loops in this lane', action: panel('lane', { laneId: lane.id, tab: 'loops' }) } },
    { id: 'board-dates', sprite: 'calendar', x: tx(13), y: ty(1) + 1, wall: true, interact: { verb: 'Check', label: 'Milestones and dates', action: panel('lane', { laneId: lane.id, tab: 'dates' }) } },
    { id: 'shelf-docs', sprite: 'bookshelf', x: tx(1) + 10, y: ty(5), solid: { w: 30, h: 10 }, interact: { verb: 'Browse', label: 'Documents and sources', action: panel('lane', { laneId: lane.id, tab: 'docs' }) } },
    { id: 'desk-tools', sprite: 'deskPc', x: tx(15), y: ty(5), fps: 1, solid: { w: 30, h: 10 }, interact: { verb: 'Use', label: 'Tools and websites', action: panel('lane', { laneId: lane.id, tab: 'links' }) } },
    { id: 'tray-waiting', sprite: 'desk', x: tx(15), y: ty(10), solid: { w: 30, h: 10 }, interact: { verb: 'Check', label: 'Waiting-on tray and people', action: panel('lane', { laneId: lane.id, tab: 'waiting' }) } },
    {
      id: 'centerpiece',
      sprite: cp.sprite,
      x: tx(cx),
      y: ty(cy),
      fps: 2,
      solid: true,
      interact: {
        verb: 'Start',
        label: 'Draft an update or hand off context',
        action: panel('handoff', { laneId: lane.id }),
        secondary: { label: 'Recent progress', action: panel('lane', { laneId: lane.id, tab: 'progress' }) },
      },
    },
    ...cp.extra.map((e, i) => ({ id: `deco-${i}`, sprite: e.sprite, x: tx(cx + e.dx), y: ty(cy + e.dy), solid: true }) as ObjDef),
    { id: 'plant-corner', sprite: 'plant', x: tx(1) + 6, y: ty(11), solid: true },
  ];
  return {
    id: `lane:${lane.id}`,
    name: lane.name,
    theme,
    floor: 'ground',
    phoneOk: true,
    ambience: theme === 'studio' || theme === 'writersroom' ? 'studio' : 'quiet',
    blurb: `${lane.name}: objectives, open loops, dates, people and tools for this lane.`,
    rows: grid(w, h, [{ side: 'bottom', at: 8, len: 2 }], [{ ch: 'r', x: 6, y: 5, w: 7, h: 5 }]),
    spawns: { default: { x: tx(9) - 8, y: ty(10), dir: 'up' }, fromWork: { x: tx(9) - 8, y: ty(10), dir: 'up' } },
    exits: [{ x: 8 * T, y: (h - 1) * T, w: 2 * T, h: T, dir: 'down', to: 'work', spawn: `fromLane:${lane.id}`, label: 'Work District' }],
    objects,
    npcs: [],
    signs: [{ x: tx(9) - 8, y: ty(11) + 4, text: 'EXIT' }],
  };
}

// ── Hawks War Room ────────────────────────────────────────────────────────────
function warRoom(): RoomDef {
  const w = 20;
  const h = 14;
  return {
    id: 'warroom',
    name: 'Hawks War Room',
    theme: 'warroom',
    floor: 'ground',
    phoneOk: true,
    ambience: 'crowd',
    blurb: 'Football operations: the live site, game sheets, the picks leaderboard, content planning and the dev tools behind hawkswarroom.com.',
    rows: grid(w, h, [{ side: 'bottom', at: 9, len: 2 }]),
    decorate: (g, W) => {
      // yard lines and hash marks on the turf
      for (let x = 2 * T; x < W - T; x += 3 * T) vline(g, x, 2 * T, (h - 3) * T, 'rgba(240,255,235,0.55)');
      for (let x = 2 * T; x < W - T; x += T) {
        hline(g, x + 6, 6 * T, 4, 'rgba(240,255,235,0.45)');
        hline(g, x + 6, 9 * T, 4, 'rgba(240,255,235,0.45)');
      }
      rect(g, 8 * T, 7 * T, 4 * T, 2 * T, 'rgba(105,190,40,0.25)');
    },
    spawns: { default: { x: tx(10) - 8, y: ty(11), dir: 'up' }, fromWork: { x: tx(10) - 8, y: ty(11), dir: 'up' } },
    exits: [{ x: 9 * T, y: (h - 1) * T, w: 2 * T, h: T, dir: 'down', to: 'work', spawn: 'fromWarroom', label: 'Work District' }],
    objects: [
      {
        id: 'bigscreen',
        sprite: 'bigscreen',
        x: tx(10) - 8,
        y: ty(1) + 3,
        wall: true,
        fps: 1,
        glow: { color: '#b8f28c', radius: 90, alpha: 0.3, flicker: true, dy: -22 },
        interact: { verb: 'Watch', label: 'Big screen: hawkswarroom.com', action: panel('warroom', { tab: 'site' }), secondary: { label: 'Open the site in a new tab', action: { type: 'link', url: 'https://www.hawkswarroom.com' } } },
      },
      { id: 'tactics', sprite: 'tactics', x: tx(3) + 6, y: ty(1) + 1, wall: true, interact: { verb: 'Study', label: 'Tactics board: content planning', action: panel('warroom', { tab: 'planning' }) } },
      { id: 'window', sprite: 'windowCity', x: tx(16), y: ty(1) - 1, wall: true, fps: 2 },
      { id: 'lockers', sprite: 'lockers', x: tx(1) + 12, y: ty(6), solid: { w: 34, h: 10 } },
      { id: 'trophies', sprite: 'trophies', x: tx(18) - 2, y: ty(5), solid: { w: 34, h: 10 }, interact: { verb: 'Browse', label: 'Trophy shelf: game sheets and recaps', action: panel('warroom', { tab: 'games' }) } },
      { id: 'arcade', sprite: 'arcade', x: tx(3), y: ty(11), fps: 2, solid: { w: 20, h: 10 }, interact: { verb: 'Play', label: 'Call the Plays', action: { type: 'link', url: 'https://www.hawkswarroom.com/calltheplays' } } },
      { id: 'pedestal', sprite: 'pedestal', x: tx(16), y: ty(11), fps: 1.5, solid: { w: 12, h: 8 }, glow: { color: '#69be28', radius: 36, alpha: 0.4, dy: -20 }, interact: { verb: 'Look', label: 'War Room Pocket prototype', action: { type: 'link', url: 'https://www.hawkswarroom.com/prototype' } } },
      { id: 'dev-desk', sprite: 'deskPc', x: tx(6), y: ty(8), fps: 1, solid: { w: 30, h: 10 }, interact: { verb: 'Use', label: 'Dev desk: repo and deploys', action: panel('warroom', { tab: 'dev' }) } },
      { id: 'stats', sprite: 'terminal', x: tx(14), y: ty(8), fps: 1, solid: { w: 20, h: 10 }, interact: { verb: 'Check', label: 'Stats terminal: picks leaderboard', action: panel('warroom', { tab: 'leaderboard' }) } },
    ],
    npcs: [{ id: 'scout', x: tx(10), y: ty(6), dir: 'down', wander: { x: 7 * T, y: 5 * T, w: 6 * T, h: 3 * T } }],
    signs: [{ x: tx(10) - 8, y: ty(12) + 4, text: 'EXIT' }],
  };
}

// ── Communications Hub ────────────────────────────────────────────────────────
function comms(): RoomDef {
  const w = 18;
  const h = 12;
  return {
    id: 'comms',
    name: 'Communications Hub',
    theme: 'comms',
    floor: 'ground',
    phoneOk: false,
    ambience: 'hum',
    blurb: 'Email, Slack, meetings and follow-ups. Terminals open the real tools; nothing is ever sent from here without you.',
    rows: grid(w, h, [{ side: 'left', at: 6, len: 2 }], [{ ch: 'r', x: 4, y: 7, w: 9, h: 3 }]),
    spawns: { default: { x: tx(2), y: ty(6) + 8, dir: 'right' }, fromCommand: { x: tx(1) + 4, y: ty(6) + 8, dir: 'right' } },
    exits: [{ x: 0, y: 6 * T, w: T, h: 2 * T, dir: 'left', to: 'command', spawn: 'fromComms', label: 'Command Center' }],
    objects: [
      { id: 'mailwall', sprite: 'mailwall', x: tx(4), y: ty(1) + 1, wall: true, interact: { verb: 'Check', label: 'Follow-up wall: who you are waiting on', action: panel('comms', { tab: 'followups' }) } },
      { id: 'window', sprite: 'windowDay', x: tx(12), y: ty(1) - 1, wall: true },
      { id: 'clock', sprite: 'clock', x: tx(8), y: ty(1) - 4, wall: true },
      { id: 'term-gmail', sprite: 'terminal', x: tx(4), y: ty(5), fps: 1, solid: { w: 20, h: 10 }, glow: { color: '#ff6b6b', radius: 30, alpha: 0.25, dy: -22 }, interact: { verb: 'Use', label: 'Gmail terminal', action: panel('comms', { tab: 'inbox' }), secondary: { label: 'Open Gmail', action: { type: 'link', url: 'https://mail.google.com/mail/u/0/#inbox' } } } },
      { id: 'term-slack', sprite: 'terminal', x: tx(7), y: ty(5), fps: 1, solid: { w: 20, h: 10 }, glow: { color: '#b18cff', radius: 30, alpha: 0.25, dy: -22 }, interact: { verb: 'Use', label: 'Slack terminal', action: panel('comms', { tab: 'slack' }), secondary: { label: 'Open Slack', action: { type: 'link', url: 'https://app.slack.com/client' } } } },
      { id: 'term-calendar', sprite: 'terminal', x: tx(10), y: ty(5), fps: 1, solid: { w: 20, h: 10 }, glow: { color: '#5fe3ff', radius: 30, alpha: 0.25, dy: -22 }, interact: { verb: 'Use', label: 'Calendar terminal: meetings', action: panel('calendar'), secondary: { label: 'Open Google Calendar', action: { type: 'link', url: 'https://calendar.google.com' } } } },
      { id: 'term-drive', sprite: 'terminal', x: tx(13), y: ty(5), fps: 1, solid: { w: 20, h: 10 }, glow: { color: '#ffd166', radius: 30, alpha: 0.25, dy: -22 }, interact: { verb: 'Use', label: 'Drive terminal', action: panel('search'), secondary: { label: 'Open Google Drive', action: { type: 'link', url: 'https://drive.google.com' } } } },
      { id: 'booth', sprite: 'phonebooth', x: tx(16), y: ty(9), solid: { w: 22, h: 10 }, interact: { verb: 'Use', label: 'Phone booth: write an email or message', action: panel('compose') } },
      { id: 'coffee', sprite: 'coffee', x: tx(2), y: ty(10), solid: true },
      { id: 'plant', sprite: 'plant', x: tx(16), y: ty(4), solid: true },
    ],
    npcs: [{ id: 'comms', x: tx(9), y: ty(8), dir: 'down', wander: { x: 5 * T, y: 7 * T, w: 7 * T, h: 2 * T } }],
    signs: [
      { x: tx(4), y: ty(5) + 4, text: 'GMAIL' },
      { x: tx(7), y: ty(5) + 4, text: 'SLACK' },
      { x: tx(10), y: ty(5) + 4, text: 'CAL' },
      { x: tx(13), y: ty(5) + 4, text: 'DRIVE' },
    ],
  };
}

// ── Library ───────────────────────────────────────────────────────────────────
function library(): RoomDef {
  const w = 18;
  const h = 13;
  return {
    id: 'library',
    name: 'Library',
    theme: 'library',
    floor: 'ground',
    phoneOk: false,
    ambience: 'library',
    blurb: 'History: every checkout, weekly and monthly rollup, and Drive search, each with its original link.',
    rows: grid(w, h, [{ side: 'right', at: 6, len: 2 }], [{ ch: 'r', x: 4, y: 6, w: 8, h: 5 }]),
    spawns: { default: { x: tx(15), y: ty(6) + 8, dir: 'left' }, fromCommand: { x: tx(16) - 4, y: ty(6) + 8, dir: 'left' } },
    exits: [{ x: (w - 1) * T, y: 6 * T, w: T, h: 2 * T, dir: 'right', to: 'command', spawn: 'fromLibrary', label: 'Command Center' }],
    objects: [
      ...[2, 4, 6, 8, 10, 12, 14].map((x, i) => ({
        id: `shelf-${i}`,
        sprite: 'bookshelf',
        x: tx(x) + 8,
        y: ty(3) + 2,
        solid: { w: 30, h: 10 },
        interact:
          i === 1
            ? { verb: 'Browse', label: 'Daily checkouts', action: panel('archive', { kind: 'daily' }) }
            : i === 3
              ? { verb: 'Browse', label: 'Weekly rollups', action: panel('archive', { kind: 'weekly' }) }
              : i === 5
                ? { verb: 'Browse', label: 'Monthly wraps', action: panel('archive', { kind: 'monthly' }) }
                : undefined,
      })) as ObjDef[],
      { id: 'catalog', sprite: 'catalog', x: tx(3), y: ty(9), solid: { w: 26, h: 10 }, interact: { verb: 'Search', label: 'Card catalog: search your Drive', action: panel('search') } },
      { id: 'reading', sprite: 'readingTable', x: tx(8), y: ty(9), solid: { w: 40, h: 10 }, interact: { verb: 'Read', label: 'Reading table: past loops and OS files', action: panel('archive', { kind: 'loops' }) } },
      { id: 'globe', sprite: 'globe', x: tx(12), y: ty(9), solid: true },
      { id: 'armchair', sprite: 'armchair', x: tx(14), y: ty(11), solid: true },
      { id: 'lamp', sprite: 'floorLamp', x: tx(15) + 6, y: ty(10), solid: true, glow: { color: '#ffd58a', radius: 56, alpha: 0.45, dy: -30 } },
    ],
    npcs: [{ id: 'archivist', x: tx(10), y: ty(6), dir: 'down', wander: { x: 5 * T, y: 5 * T, w: 7 * T, h: 2 * T } }],
    signs: [],
  };
}

// ── AI & Automation Lab ───────────────────────────────────────────────────────
function lab(): RoomDef {
  const w = 18;
  const h = 12;
  return {
    id: 'lab',
    name: 'AI & Automation Lab',
    theme: 'lab',
    floor: 'ground',
    phoneOk: false,
    ambience: 'lab',
    blurb: 'Your workflows and what they actually wrote to Drive. It reports outputs it can see; it never claims a run happened.',
    rows: grid(w, h),
    spawns: { default: { x: tx(4), y: ty(3), dir: 'down' }, fromCommand: { x: tx(4), y: ty(3), dir: 'down' } },
    exits: [{ x: 3 * T, y: 2 * T, w: 2 * T, h: 12, dir: 'up', to: 'command', spawn: 'fromLab', label: 'Command Center' }],
    objects: [
      { id: 'door', sprite: 'door', x: tx(4) - 8 + 8, y: ty(1), wall: true },
      ...[8, 10, 12, 14, 16].map((x, i) => ({ id: `rack-${i}`, sprite: 'rack', x: tx(x), y: ty(3), fps: 2 + i * 0.3, solid: { w: 18, h: 10 }, glow: { color: '#7cf2ff', radius: 26, alpha: 0.2, dy: -20 } }) as ObjDef),
      { id: 'checkout-station', sprite: 'terminal', x: tx(5), y: ty(7), fps: 1, solid: { w: 20, h: 10 }, glow: { color: '#7cf2ff', radius: 34, alpha: 0.3, dy: -22 }, interact: { verb: 'Use', label: 'Daily checkout station', action: panel('automations', { focus: 'daily' }) } },
      { id: 'outputs', sprite: 'serverDesk', x: tx(10), y: ty(7), fps: 1, solid: { w: 40, h: 10 }, interact: { verb: 'Check', label: 'Workflow outputs monitor', action: panel('automations') } },
      { id: 'loops-monitor', sprite: 'terminal', x: tx(15), y: ty(7), fps: 1, solid: { w: 20, h: 10 }, glow: { color: '#b18cff', radius: 34, alpha: 0.3, dy: -22 }, interact: { verb: 'Check', label: 'Loops spine monitor', action: panel('automations', { focus: 'loops' }) } },
      { id: 'bench', sprite: 'workbench', x: tx(4), y: ty(10), fps: 1, solid: { w: 44, h: 10 } },
    ],
    npcs: [{ id: 'blip', x: tx(12), y: ty(10), dir: 'left', wander: { x: 8 * T, y: 9 * T, w: 7 * T, h: 1 * T } }],
    signs: [{ x: tx(4), y: 2, text: 'COMMAND' }],
  };
}

// ── Upstairs hall ─────────────────────────────────────────────────────────────
function hall(ctx: WorldContext): RoomDef {
  const w = 18;
  const h = 9;
  return {
    id: 'hall',
    name: 'Upstairs Hall',
    theme: 'hall',
    floor: 'upper',
    phoneOk: true,
    ambience: 'quiet',
    blurb: 'The quiet floor: the Dream Lounge and your Personal Space.',
    rows: grid(w, h, [], [{ ch: 'r', x: 2, y: 4, w: 14, h: 2 }]),
    spawns: {
      default: { x: tx(9), y: ty(5), dir: 'up' },
      fromCommand: { x: tx(3), y: ty(5), dir: 'right' },
      fromLounge: { x: tx(8), y: ty(3), dir: 'down' },
      fromPersonal: { x: tx(14), y: ty(4), dir: 'down' },
    },
    exits: [
      { x: 1 * T, y: 6 * T, w: 3 * T, h: 2 * T, dir: 'any', to: 'command', spawn: 'fromHall', label: 'Downstairs', locked: ctx.phoneMode ? 'Downstairs is work. Your laptop rule keeps it laptop-only.' : undefined },
      { x: 7 * T, y: 2 * T, w: 2 * T, h: 12, dir: 'up', to: 'lounge', spawn: 'fromHall', label: 'Dream Lounge' },
    ],
    objects: [
      { id: 'stairs', sprite: 'stairsDown', x: tx(2) + 8, y: ty(7) },
      { id: 'door-lounge', sprite: 'door', x: tx(8), y: ty(1), wall: true },
      {
        id: 'door-personal',
        sprite: 'doorPrivate',
        x: tx(14),
        y: ty(1) + 1,
        wall: true,
        interact: { verb: 'Enter', label: 'Personal Space (private)', action: panel('confirm-personal') },
      },
      { id: 'frame-1', sprite: 'frameArt', x: tx(4), y: ty(1) - 4, wall: true },
      { id: 'frame-2', sprite: 'frameArt2', x: tx(11), y: ty(1) - 4, wall: true },
      { id: 'plant-1', sprite: 'plant', x: tx(16), y: ty(7), solid: true },
      { id: 'lamp', sprite: 'floorLamp', x: tx(11), y: ty(7), solid: true, glow: { color: '#ffe2b8', radius: 50, alpha: 0.4, dy: -30 } },
    ],
    npcs: [],
    signs: [
      { x: tx(8), y: 2, text: 'DREAM LOUNGE' },
      { x: tx(2) + 8, y: ty(5) + 2, text: 'DOWN' },
    ],
  };
}

// ── Dream Lounge ──────────────────────────────────────────────────────────────
function lounge(ctx: WorldContext): RoomDef {
  const w = 22;
  const h = 15;
  const win = windowFor(ctx.hour);
  return {
    id: 'lounge',
    name: 'Dream Lounge',
    theme: 'lounge',
    floor: 'upper',
    phoneOk: true,
    ambience: 'lounge',
    blurb: 'A room without pressure. Old ideas, new dreams, music and a fire. Nothing here is a task unless you decide it is.',
    rows: grid(w, h, [{ side: 'bottom', at: 10, len: 2 }, { side: 'right', at: 9, len: 2 }], [{ ch: 'r', x: 6, y: 7, w: 10, h: 5 }]),
    spawns: { default: { x: tx(11) - 8, y: ty(12), dir: 'up' }, fromHall: { x: tx(11) - 8, y: ty(13), dir: 'up' }, fromGarden: { x: tx(20), y: ty(9) + 8, dir: 'left' } },
    exits: [
      { x: 10 * T, y: (h - 1) * T, w: 2 * T, h: T, dir: 'down', to: 'hall', spawn: 'fromLounge', label: 'Upstairs Hall' },
      { x: (w - 1) * T, y: 9 * T, w: T, h: 2 * T, dir: 'right', to: 'garden', spawn: 'fromLounge', label: 'Balcony garden' },
    ],
    objects: [
      { id: 'lights', sprite: 'stringLights', x: tx(5), y: ty(0) + 4, wall: true, fps: 1 },
      { id: 'lights-2', sprite: 'stringLights', x: tx(16), y: ty(0) + 4, wall: true, fps: 1 },
      { id: 'dreamboard', sprite: 'dreamboard', x: tx(4), y: ty(1) + 2, wall: true, interact: { verb: 'Look', label: 'Dream Board', action: panel('dreamboard'), secondary: { label: 'Surprise me', action: panel('surprise') } } },
      { id: 'window-1', sprite: win, x: tx(8), y: ty(1) - 1, wall: true },
      { id: 'fireplace', sprite: 'fireplace', x: tx(11) + 3, y: ty(2) + 4, wall: true, fps: 6, glow: { color: '#ff9a3c', radius: 110, alpha: 0.5, flicker: true, dy: -14 } },
      { id: 'window-2', sprite: win, x: tx(15), y: ty(1) - 1, wall: true },
      { id: 'shelf', sprite: 'bookshelf', x: tx(19), y: ty(3) + 2, solid: { w: 30, h: 10 }, interact: { verb: 'Browse', label: 'Idea shelf: everything you have parked', action: panel('dreamboard', { view: 'list' }) } },
      { id: 'couch', sprite: 'couch', x: tx(11) - 8, y: ty(11) + 4, solid: { w: 48, h: 12 } },
      { id: 'armchair', sprite: 'armchair', x: tx(16), y: ty(9), solid: true },
      { id: 'side', sprite: 'sideTable', x: tx(7), y: ty(10), solid: true },
      { id: 'beanbag', sprite: 'beanbag', x: tx(5), y: ty(12), solid: true },
      { id: 'aquarium', sprite: 'aquarium', x: tx(2) + 6, y: ty(7), fps: 3, solid: { w: 44, h: 12 }, glow: { color: '#5fc3e8', radius: 50, alpha: 0.3, dy: -18 } },
      { id: 'journal', sprite: 'journalDesk', x: tx(3), y: ty(12), solid: { w: 32, h: 10 }, glow: { color: '#ffb43a', radius: 30, alpha: 0.5, dy: -20 }, interact: { verb: 'Write', label: 'Dream Journal', action: panel('journal') } },
      { id: 'retro', sprite: 'retro', x: tx(15), y: ty(13), fps: 1, solid: { w: 26, h: 10 }, interact: { verb: 'Play', label: 'Retro console: a random idea cartridge', action: panel('surprise') } },
      { id: 'record', sprite: 'recordPlayer', x: tx(18), y: ty(13), fps: 2, solid: true, interact: { verb: 'Play', label: 'Record player: lounge music on/off', action: { type: 'music' } } },
      { id: 'bench', sprite: 'workbench', x: tx(18) + 4, y: ty(6), fps: 1, solid: { w: 44, h: 10 } },
      { id: 'lamp-1', sprite: 'floorLamp', x: tx(1) + 8, y: ty(10), solid: true, glow: { color: '#ffb86b', radius: 60, alpha: 0.5, dy: -30 } },
      { id: 'lamp-2', sprite: 'floorLamp', x: tx(20), y: ty(12), solid: true, glow: { color: '#ffb86b', radius: 60, alpha: 0.5, dy: -30 } },
      { id: 'plant-1', sprite: 'plant', x: tx(13) + 8, y: ty(4), solid: true },
      { id: 'plant-2', sprite: 'plant', x: tx(6) + 4, y: ty(4), solid: true },
    ],
    npcs: [{ id: 'inventor', x: tx(17), y: ty(7), dir: 'down', wander: { x: 15 * T, y: 6 * T, w: 4 * T, h: 2 * T } }],
    signs: [{ x: tx(20), y: ty(8) - 2, text: 'GARDEN' }],
  };
}

// ── Balcony garden ────────────────────────────────────────────────────────────
function garden(ctx: WorldContext): RoomDef {
  const w = 20;
  const h = 13;
  const night = ctx.hour < 7 || ctx.hour >= 19;
  return {
    id: 'garden',
    name: 'Balcony Garden',
    theme: 'garden',
    floor: 'upper',
    phoneOk: true,
    ambience: 'garden',
    blurb: 'Fresh air. Sit on the bench for a quiet minute.',
    rows: grid(w, h, [{ side: 'left', at: 6, len: 2 }], [{ ch: '=', x: 1, y: 6, w: 8, h: 2 }, { ch: '=', x: 8, y: 4, w: 2, h: 7 }, { ch: ',', x: 12, y: 3, w: 6, h: 3 }]),
    decorate: night
      ? (g, W) => {
          for (let i = 0; i < 40; i++) rect(g, (i * 97) % W, (i * 37) % 28, 1, 1, i % 3 ? '#cfe0ff' : '#ffffff');
        }
      : undefined,
    spawns: { default: { x: tx(2), y: ty(6) + 8, dir: 'right' }, fromLounge: { x: tx(1) + 4, y: ty(6) + 8, dir: 'right' } },
    exits: [{ x: 0, y: 6 * T, w: T, h: 2 * T, dir: 'left', to: 'lounge', spawn: 'fromGarden', label: 'Dream Lounge' }],
    objects: [
      { id: 'lights', sprite: 'stringLights', x: tx(5), y: ty(1) + 2, wall: true, fps: 1, glow: { color: '#ffe08a', radius: 70, alpha: night ? 0.4 : 0.15, dy: -2 } },
      { id: 'lights-2', sprite: 'stringLights', x: tx(14), y: ty(1) + 2, wall: true, fps: 1, glow: { color: '#ffe08a', radius: 70, alpha: night ? 0.4 : 0.15, dy: -2 } },
      { id: 'bench', sprite: 'bench', x: tx(14) + 8, y: ty(8), solid: true, interact: { verb: 'Sit', label: 'Bench: a quiet minute', action: panel('quiet') } },
      { id: 'fountain', sprite: 'fountain', x: tx(14) + 8, y: ty(5), fps: 2, solid: { w: 44, h: 14 } },
      { id: 'lamp-1', sprite: 'lampPost', x: tx(11), y: ty(9), solid: { w: 6, h: 4 }, glow: { color: '#ffe08a', radius: 60, alpha: night ? 0.5 : 0.2, dy: -34 } },
      { id: 'lamp-2', sprite: 'lampPost', x: tx(4), y: ty(11), solid: { w: 6, h: 4 }, glow: { color: '#ffe08a', radius: 60, alpha: night ? 0.5 : 0.2, dy: -34 } },
      ...[
        [3, 4],
        [6, 9],
        [12, 11],
        [17, 10],
        [17, 4],
        [2, 10],
        [15, 11],
      ].map(([x, y], i) => ({ id: `flowers-${i}`, sprite: 'flowers', x: tx(x), y: ty(y), solid: true }) as ObjDef),
      { id: 'plant-a', sprite: 'plant', x: tx(18), y: ty(7), solid: true },
    ],
    npcs: [],
    signs: [],
  };
}

// ── Personal Space ────────────────────────────────────────────────────────────
function personal(ctx: WorldContext): RoomDef {
  const w = 16;
  const h = 12;
  return {
    id: 'personal',
    name: 'Personal Space',
    theme: 'personal',
    floor: 'upper',
    phoneOk: true,
    ambience: 'quiet',
    blurb: 'Private. Planning, reflection and routines from your own files, each section covered until you reveal it.',
    rows: grid(w, h, [{ side: 'bottom', at: 7, len: 2 }], [{ ch: 'r', x: 5, y: 6, w: 6, h: 4 }]),
    spawns: { default: { x: tx(8) - 8, y: ty(9), dir: 'up' }, fromHall: { x: tx(8) - 8, y: ty(10), dir: 'up' } },
    exits: [{ x: 7 * T, y: (h - 1) * T, w: 2 * T, h: T, dir: 'down', to: 'hall', spawn: 'fromPersonal', label: 'Upstairs Hall' }],
    objects: [
      { id: 'window', sprite: windowFor(ctx.hour), x: tx(8) - 8, y: ty(1) - 1, wall: true },
      { id: 'routines', sprite: 'routines', x: tx(3), y: ty(1) + 1, wall: true, interact: { verb: 'Read', label: 'Routines board: Move, Fuel, Recover', action: panel('personal', { tab: 'routines' }) } },
      { id: 'frame', sprite: 'frameArt', x: tx(12), y: ty(1) - 4, wall: true },
      { id: 'frame-2', sprite: 'frameArt2', x: tx(14), y: ty(1) - 2, wall: true },
      { id: 'planner', sprite: 'planner', x: tx(3), y: ty(6), solid: { w: 32, h: 10 }, interact: { verb: 'Open', label: 'Planner: personal loops and family', action: panel('personal', { tab: 'planning' }) } },
      { id: 'chair', sprite: 'armchair', x: tx(13), y: ty(6), solid: true, interact: { verb: 'Sit', label: 'Reflection chair: north star and direction', action: panel('personal', { tab: 'reflection' }) } },
      { id: 'side', sprite: 'sideTable', x: tx(14) + 6, y: ty(8), solid: true },
      { id: 'plant-1', sprite: 'plant', x: tx(1) + 6, y: ty(10), solid: true },
      { id: 'plant-2', sprite: 'plant', x: tx(14), y: ty(10), solid: true },
      { id: 'lamp', sprite: 'floorLamp', x: tx(10), y: ty(4), solid: true, glow: { color: '#fff4dc', radius: 56, alpha: 0.4, dy: -30 } },
    ],
    npcs: [],
    signs: [],
  };
}

export const STATIC_ROOM_IDS = ['command', 'work', 'warroom', 'comms', 'library', 'lab', 'hall', 'lounge', 'garden', 'personal'];

export function buildRoom(id: string, ctx: WorldContext): RoomDef | null {
  switch (id) {
    case 'command':
      return commandCenter();
    case 'work':
      return workDistrict(ctx);
    case 'warroom':
      return warRoom();
    case 'comms':
      return comms();
    case 'library':
      return library();
    case 'lab':
      return lab();
    case 'hall':
      return hall(ctx);
    case 'lounge':
      return lounge(ctx);
    case 'garden':
      return garden(ctx);
    case 'personal':
      return personal(ctx);
  }
  if (id.startsWith('lane:')) {
    const lane = ctx.lanes?.find((l) => `lane:${l.id}` === id);
    return lane ? laneRoom(lane) : null;
  }
  return null;
}

export interface RoomListing {
  id: string;
  name: string;
  floor: 'ground' | 'upper';
  phoneOk: boolean;
  group: 'Ground floor' | 'Work District' | 'Upstairs';
  blurb: string;
  aliases: string[];
}

/** Every reachable place, for the map, voice commands and LB/RB cycling. */
export function listRooms(ctx: WorldContext): RoomListing[] {
  const base: RoomListing[] = [
    { id: 'command', name: 'Command Center', floor: 'ground', phoneOk: false, group: 'Ground floor', blurb: 'Today, checkout, loops, deadlines', aliases: ['hq', 'home', 'headquarters', 'command'] },
    { id: 'comms', name: 'Communications Hub', floor: 'ground', phoneOk: false, group: 'Ground floor', blurb: 'Gmail, Slack, Calendar, Drive', aliases: ['comms', 'communications', 'email', 'mail room', 'inbox room'] },
    { id: 'library', name: 'Library', floor: 'ground', phoneOk: false, group: 'Ground floor', blurb: 'Archive and search', aliases: ['library', 'archive', 'archives'] },
    { id: 'lab', name: 'AI & Automation Lab', floor: 'ground', phoneOk: false, group: 'Ground floor', blurb: 'Workflows and outputs', aliases: ['lab', 'automation lab', 'ai lab', 'automations'] },
    { id: 'work', name: 'Work District', floor: 'ground', phoneOk: true, group: 'Work District', blurb: 'Lane buildings', aliases: ['work district', 'district', 'plaza', 'lanes'] },
    { id: 'warroom', name: 'Hawks War Room', floor: 'ground', phoneOk: true, group: 'Work District', blurb: 'hawkswarroom.com', aliases: ['war room', 'hawks', 'hawks war room', 'football', 'seahawks'] },
  ];
  for (const l of ctx.lanes ?? []) {
    if (l.personal) continue;
    const words = l.name.toLowerCase();
    base.push({
      id: `lane:${l.id}`,
      name: l.name,
      floor: 'ground',
      phoneOk: ctx.phoneLanes.includes(l.id),
      group: 'Work District',
      blurb: l.closed ? 'Lane closed' : `${l.openCount ?? 0} open`,
      aliases: [l.id, l.id.replace(/-/g, ' '), words, `${words} office`, `${words} room`, `${words} building`, `${l.id.replace(/-/g, ' ')} office`],
    });
  }
  base.push(
    { id: 'hall', name: 'Upstairs Hall', floor: 'upper', phoneOk: true, group: 'Upstairs', blurb: 'Lounge and personal doors', aliases: ['upstairs', 'hall', 'hallway'] },
    { id: 'lounge', name: 'Dream Lounge', floor: 'upper', phoneOk: true, group: 'Upstairs', blurb: 'Ideas, music, no pressure', aliases: ['lounge', 'dream lounge', 'dream room', 'relaxation room'] },
    { id: 'garden', name: 'Balcony Garden', floor: 'upper', phoneOk: true, group: 'Upstairs', blurb: 'A quiet minute', aliases: ['garden', 'balcony', 'outside'] },
    { id: 'personal', name: 'Personal Space', floor: 'upper', phoneOk: true, group: 'Upstairs', blurb: 'Private, deliberate entry', aliases: ['personal', 'personal space', 'my room', 'private room'] }
  );
  return base;
}

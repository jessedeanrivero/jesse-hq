// Browser Gamepad API wrapper tuned for Xbox controllers (standard mapping).
// Handles connection and reconnection, radial dead zones and menu-style repeat.

export type PadButton = 'A' | 'B' | 'X' | 'Y' | 'LB' | 'RB' | 'LT' | 'RT' | 'VIEW' | 'MENU' | 'LS' | 'RS' | 'UP' | 'DOWN' | 'LEFT' | 'RIGHT' | 'HOME';

export const STANDARD_MAP: PadButton[] = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'VIEW', 'MENU', 'LS', 'RS', 'UP', 'DOWN', 'LEFT', 'RIGHT', 'HOME'];

export const DEADZONE = 0.22;
export const REPEAT_DELAY = 350;
export const REPEAT_RATE = 90;

/** Radial dead zone with rescale so small drift is ignored and full tilt still reaches 1. */
export function applyDeadzone(x: number, y: number, dz = DEADZONE): { x: number; y: number } {
  const mag = Math.hypot(x, y);
  if (mag < dz) return { x: 0, y: 0 };
  const scaled = Math.min(1, (mag - dz) / (1 - dz));
  return { x: (x / mag) * scaled, y: (y / mag) * scaled };
}

/** Repeat schedule for a held direction: fires on press, after the delay, then at the rate. */
export class Repeater {
  private next = new Map<string, number>();
  tick(id: string, held: boolean, now: number): boolean {
    if (!held) {
      this.next.delete(id);
      return false;
    }
    const n = this.next.get(id);
    if (n === undefined) {
      this.next.set(id, now + REPEAT_DELAY);
      return true;
    }
    if (now >= n) {
      this.next.set(id, now + REPEAT_RATE);
      return true;
    }
    return false;
  }
  reset(): void {
    this.next.clear();
  }
}

export type PadEvent = { button: PadButton; phase: 'down' | 'up' } | { button: 'NAV_UP' | 'NAV_DOWN' | 'NAV_LEFT' | 'NAV_RIGHT'; phase: 'repeat' };

export class GamepadManager {
  index: number | null = null;
  id = '';
  private prev: boolean[] = [];
  private rep = new Repeater();
  private stickHeld = { up: false, down: false, left: false, right: false };
  onConnection?: (connected: boolean, id: string) => void;
  onEvent?: (e: PadEvent) => void;

  constructor() {
    if (typeof window === 'undefined') return;
    window.addEventListener('gamepadconnected', (e) => this.attach((e as GamepadEvent).gamepad));
    window.addEventListener('gamepaddisconnected', (e) => {
      if ((e as GamepadEvent).gamepad.index === this.index) this.detach();
    });
  }

  private attach(gp: Gamepad): void {
    if (this.index !== null && this.index !== gp.index) return;
    const fresh = this.index === null;
    this.index = gp.index;
    this.id = gp.id;
    this.prev = gp.buttons.map(() => false);
    if (fresh) this.onConnection?.(true, gp.id);
  }

  private detach(): void {
    this.index = null;
    this.prev = [];
    this.rep.reset();
    this.onConnection?.(false, this.id);
  }

  /** Call once per animation frame. */
  poll(now: number): Gamepad | null {
    const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? Array.from(navigator.getGamepads()) : [];
    let gp: Gamepad | null = this.index !== null ? pads[this.index] ?? null : null;
    if (!gp || !gp.connected) {
      if (this.index !== null) this.detach();
      const found = pads.find((p) => p && p.connected && p.buttons.some((b) => b.pressed || b.value > 0.5));
      if (found) this.attach(found);
      gp = found ?? null;
      if (!gp) return null;
    }
    const buttons = gp.buttons;
    for (let i = 0; i < Math.min(buttons.length, STANDARD_MAP.length); i++) {
      const b = buttons[i];
      const pressed = b.pressed || b.value > 0.55;
      const was = this.prev[i] ?? false;
      const name = STANDARD_MAP[i];
      if (pressed && !was) this.onEvent?.({ button: name, phase: 'down' });
      if (!pressed && was) this.onEvent?.({ button: name, phase: 'up' });
      this.prev[i] = pressed;
    }
    // D-pad and left stick also produce repeating navigation events (used by menus).
    const ls = applyDeadzone(gp.axes[0] ?? 0, gp.axes[1] ?? 0);
    const hy = (v: number, held: boolean) => (held ? v > 0.4 : v > 0.6);
    this.stickHeld = {
      up: hy(-ls.y, this.stickHeld.up),
      down: hy(ls.y, this.stickHeld.down),
      left: hy(-ls.x, this.stickHeld.left),
      right: hy(ls.x, this.stickHeld.right),
    };
    const dp = (i: number) => !!(buttons[i]?.pressed);
    const navs: ['NAV_UP' | 'NAV_DOWN' | 'NAV_LEFT' | 'NAV_RIGHT', boolean][] = [
      ['NAV_UP', dp(12) || this.stickHeld.up],
      ['NAV_DOWN', dp(13) || this.stickHeld.down],
      ['NAV_LEFT', dp(14) || this.stickHeld.left],
      ['NAV_RIGHT', dp(15) || this.stickHeld.right],
    ];
    for (const [nav, held] of navs) if (this.rep.tick(nav, held, now)) this.onEvent?.({ button: nav, phase: 'repeat' });
    return gp;
  }

  static leftStick(gp: Gamepad): { x: number; y: number } {
    const s = applyDeadzone(gp.axes[0] ?? 0, gp.axes[1] ?? 0);
    let x = s.x;
    let y = s.y;
    if (gp.buttons[14]?.pressed) x = -1;
    if (gp.buttons[15]?.pressed) x = 1;
    if (gp.buttons[12]?.pressed) y = -1;
    if (gp.buttons[13]?.pressed) y = 1;
    return { x, y };
  }

  static rightStick(gp: Gamepad): { x: number; y: number } {
    return applyDeadzone(gp.axes[2] ?? 0, gp.axes[3] ?? 0);
  }
}

'use client';

import { bus, inputState } from '@/game/bus';
import { GamepadManager, type PadButton, type PadEvent } from './gamepad';
import { focus, isTextField } from './focus';

export type Logical = 'A' | 'B' | 'X' | 'Y' | 'LB' | 'RB' | 'VIEW' | 'MENU';

export interface RouterHooks {
  hasPanel: () => boolean;
  closeTop: () => void;
  toggleMenu: () => void;
  openUnique: (type: string) => void;
  cycleRoom: (delta: number) => void;
  voiceStart: () => void;
  voiceStop: () => void;
  onDevice: (d: 'keyboard' | 'gamepad' | 'touch') => void;
  onController: (connected: boolean, id: string) => void;
  unlockAudio: () => void;
  sfx: (name: 'move' | 'select' | 'close') => void;
}

const MOVE_KEYS: Record<string, [number, number]> = {
  w: [0, -1],
  arrowup: [0, -1],
  s: [0, 1],
  arrowdown: [0, 1],
  a: [-1, 0],
  arrowleft: [-1, 0],
  d: [1, 0],
  arrowright: [1, 0],
};

/**
 * One router for keyboard, mouse, touch and gamepad. It decides whether each press belongs to
 * the world, the open panel, or a focused text field, so nothing ever double-fires.
 */
export class InputRouter {
  private keys = new Set<string>();
  private gp = new GamepadManager();
  private raf = 0;
  private touch = { x: 0, y: 0, active: false };
  private device: 'keyboard' | 'gamepad' | 'touch' = 'keyboard';
  private voiceHeld = false;

  constructor(private hooks: RouterHooks) {
    this.gp.onConnection = (c, id) => hooks.onController(c, id);
    this.gp.onEvent = (e) => this.onPad(e);
  }

  start(): void {
    window.addEventListener('keydown', this.onKeyDown, { capture: true });
    window.addEventListener('keyup', this.onKeyUp, { capture: true });
    window.addEventListener('blur', this.onBlur);
    window.addEventListener('pointerdown', this.onPointer, { capture: true });
    document.addEventListener('mouseover', this.onHover);
    this.raf = requestAnimationFrame(this.loop);
  }

  stop(): void {
    window.removeEventListener('keydown', this.onKeyDown, { capture: true });
    window.removeEventListener('keyup', this.onKeyUp, { capture: true });
    window.removeEventListener('blur', this.onBlur);
    window.removeEventListener('pointerdown', this.onPointer, { capture: true });
    document.removeEventListener('mouseover', this.onHover);
    cancelAnimationFrame(this.raf);
  }

  setTouch(x: number, y: number, active: boolean): void {
    this.touch = { x, y, active };
    if (active) this.setDevice('touch');
  }

  /** Programmatic presses from on-screen touch buttons. */
  press(btn: Logical): void {
    this.hooks.unlockAudio();
    this.act(btn);
  }

  mode(): 'game' | 'ui' | 'text' {
    if (isTextField(document.activeElement)) return 'text';
    if (this.hooks.hasPanel()) return 'ui';
    return 'game';
  }

  private setDevice(d: 'keyboard' | 'gamepad' | 'touch'): void {
    if (this.device === d) return;
    this.device = d;
    inputState.device = d;
    this.hooks.onDevice(d);
  }

  private loop = (now: number): void => {
    const pad = this.gp.poll(now);
    const mode = this.mode();
    inputState.mode = mode;
    let mx = 0;
    let my = 0;
    let run = false;
    if (mode === 'game') {
      for (const k of this.keys) {
        const v = MOVE_KEYS[k];
        if (v) {
          mx += v[0];
          my += v[1];
        }
      }
      mx = Math.max(-1, Math.min(1, mx));
      my = Math.max(-1, Math.min(1, my));
      run = this.keys.has('shift');
      if (pad) {
        const s = GamepadManager.leftStick(pad);
        if (s.x !== 0 || s.y !== 0) {
          mx = s.x;
          my = s.y;
          this.setDevice('gamepad');
        }
        run = run || (pad.buttons[7]?.value ?? 0) > 0.35;
      }
      if (this.touch.active) {
        mx = this.touch.x;
        my = this.touch.y;
        run = Math.hypot(mx, my) > 0.95;
      }
    }
    inputState.moveX = mx;
    inputState.moveY = my;
    inputState.run = run;
    if (mode === 'ui' && pad) {
      const r = GamepadManager.rightStick(pad);
      if (r.y !== 0) focus.scroll(r.y * 16);
    }
    if (mode !== 'ui' && focus.current && !document.querySelector('[data-panel-root]')) focus.clear();
    this.raf = requestAnimationFrame(this.loop);
  };

  private onPad(e: PadEvent): void {
    this.setDevice('gamepad');
    this.hooks.unlockAudio();
    if (e.phase === 'repeat') {
      const mode = this.mode();
      if (mode !== 'ui') return;
      const dir = e.button.slice(4).toLowerCase() as 'up' | 'down' | 'left' | 'right';
      if ((dir === 'left' || dir === 'right') && focus.adjust(dir === 'left' ? -1 : 1)) return;
      if (focus.move(dir)) this.hooks.sfx('move');
      return;
    }
    const b = e.button as PadButton;
    if (e.phase === 'down') {
      if (b === 'LT') {
        this.voiceHeld = true;
        this.hooks.voiceStart();
        return;
      }
      if (['A', 'B', 'X', 'Y', 'LB', 'RB', 'VIEW', 'MENU'].includes(b)) this.act(b as Logical);
    } else if (b === 'LT' && this.voiceHeld) {
      this.voiceHeld = false;
      this.hooks.voiceStop();
    }
  }

  private act(btn: Logical): void {
    const mode = this.mode();
    if (btn === 'MENU') {
      if (mode === 'text') (document.activeElement as HTMLElement | null)?.blur();
      this.hooks.toggleMenu();
      return;
    }
    if (mode === 'text') {
      if (btn === 'B') {
        (document.activeElement as HTMLElement | null)?.blur();
        this.hooks.sfx('close');
      }
      return;
    }
    if (btn === 'VIEW') return this.hooks.openUnique('map');
    if (btn === 'Y') return this.hooks.openUnique('search');
    if (mode === 'game') {
      if (btn === 'A') bus.emit('input:action', 'confirm');
      else if (btn === 'X') bus.emit('input:action', 'secondary');
      else if (btn === 'LB') this.hooks.cycleRoom(-1);
      else if (btn === 'RB') this.hooks.cycleRoom(1);
      return;
    }
    // ui
    if (btn === 'A') {
      focus.activate();
      this.hooks.sfx('select');
    } else if (btn === 'B') {
      this.hooks.closeTop();
      this.hooks.sfx('close');
    } else if (btn === 'X') focus.secondary();
    else if (btn === 'LB') focus.tab(-1);
    else if (btn === 'RB') focus.tab(1);
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    const k = e.key.toLowerCase();
    this.setDevice('keyboard');
    this.hooks.unlockAudio();
    const mode = this.mode();
    if (mode === 'text') {
      if (k === 'escape') {
        e.preventDefault();
        (document.activeElement as HTMLElement | null)?.blur();
      }
      return;
    }
    if (e.metaKey || e.ctrlKey || e.altKey) {
      if ((e.metaKey || e.ctrlKey) && k === 'k') {
        e.preventDefault();
        this.act('Y');
      }
      return;
    }
    if (mode === 'game') {
      if (MOVE_KEYS[k] || k === 'shift') {
        this.keys.add(k);
        if (k.startsWith('arrow')) e.preventDefault();
        return;
      }
      if (e.repeat) return;
      const map: Record<string, Logical> = { e: 'A', ' ': 'A', enter: 'A', f: 'X', '/': 'Y', m: 'VIEW', escape: 'MENU', tab: 'MENU', '[': 'LB', ']': 'RB' };
      if (k === 'v') {
        e.preventDefault();
        this.voiceHeld = true;
        this.hooks.voiceStart();
        return;
      }
      const btn = map[k];
      if (btn) {
        e.preventDefault();
        this.act(btn);
      }
      return;
    }
    // ui mode
    const nav: Record<string, 'up' | 'down' | 'left' | 'right'> = { arrowup: 'up', arrowdown: 'down', arrowleft: 'left', arrowright: 'right' };
    if (nav[k]) {
      e.preventDefault();
      if ((k === 'arrowleft' || k === 'arrowright') && focus.adjust(k === 'arrowleft' ? -1 : 1)) return;
      if (focus.move(nav[k])) this.hooks.sfx('move');
      return;
    }
    if (e.repeat) return;
    if (k === 'enter' || k === ' ') {
      const ae = document.activeElement as HTMLElement | null;
      const domFocused = ae && ae !== document.body && (ae.tagName === 'BUTTON' || ae.tagName === 'A' || ae.tagName === 'INPUT');
      if (domFocused) return;
      e.preventDefault();
      this.act('A');
      return;
    }
    if (k === 'escape' || k === 'backspace') {
      e.preventDefault();
      this.act('B');
      return;
    }
    if (k === 'pageup' || k === 'pagedown') {
      e.preventDefault();
      focus.scroll(k === 'pageup' ? -320 : 320);
      return;
    }
    const map: Record<string, Logical> = { f: 'X', '/': 'Y', m: 'VIEW', '[': 'LB', ']': 'RB' };
    const btn = map[k];
    if (btn) {
      e.preventDefault();
      this.act(btn);
    }
    if (k === 'v') {
      this.voiceHeld = true;
      this.hooks.voiceStart();
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    const k = e.key.toLowerCase();
    this.keys.delete(k);
    if (k === 'v' && this.voiceHeld) {
      this.voiceHeld = false;
      this.hooks.voiceStop();
    }
  };

  private onBlur = (): void => {
    this.keys.clear();
  };

  private onPointer = (e: PointerEvent): void => {
    this.hooks.unlockAudio();
    this.setDevice(e.pointerType === 'touch' ? 'touch' : 'keyboard');
  };

  private onHover = (e: MouseEvent): void => {
    if (this.device === 'gamepad') return;
    const el = (e.target as HTMLElement | null)?.closest?.('[data-nav]') as HTMLElement | null;
    if (el && el.closest('[data-panel-root]')) focus.set(el, false);
  };
}

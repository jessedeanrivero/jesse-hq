'use client';

import type { InputRouter, Logical } from './router';

// The one running input router, so on-screen touch controls press buttons through it.
let current: InputRouter | null = null;

export function setActiveRouter(r: InputRouter | null): void {
  current = r;
}

export function pressButton(b: Logical): void {
  current?.press(b);
}

export function setTouchStick(x: number, y: number, active: boolean): void {
  current?.setTouch(x, y, active);
}

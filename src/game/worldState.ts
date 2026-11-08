import type { WorldContext } from './world';

// Shared world context, written by the React app (lanes, phone mode) and read when rooms are built.
let ctx: WorldContext = { lanes: null, phoneMode: false, phoneLanes: [], hour: new Date().getHours() };
let badges: Record<string, boolean> = {};

export function getWorld(): WorldContext {
  return { ...ctx, hour: new Date().getHours() };
}

export function setWorld(patch: Partial<WorldContext>): void {
  ctx = { ...ctx, ...patch };
}

export function getBadges(): Record<string, boolean> {
  return badges;
}

export function setBadges(next: Record<string, boolean>): void {
  badges = next;
}

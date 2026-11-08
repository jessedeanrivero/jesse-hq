'use client';

import { bus } from '@/game/bus';
import { closeAllPanels, getState, notify, openPanel } from './store';
import { getWorld } from '@/game/worldState';
import { buildRoom } from '@/game/world';

/** Leave any panels and walk through the door to another room. */
export function travelTo(roomId: string, spawn?: string): void {
  const s = getState();
  const room = buildRoom(roomId, getWorld());
  if (!room) {
    notify('That room is not available yet.', 'warn');
    return;
  }
  if (s.phoneActive && !room.phoneOk && !(roomId.startsWith('lane:') && s.settings.phoneLanes.includes(roomId.slice(5)))) {
    notify(`${room.name} is laptop-only while phone mode is on. Change it in Settings.`, 'warn');
    return;
  }
  closeAllPanels();
  bus.emit('ui:travel', { to: roomId, spawn });
}

export function openLane(laneId: string, tab = 'overview'): void {
  openPanel('lane', { laneId, tab });
}

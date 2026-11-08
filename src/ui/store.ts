'use client';

import { useSyncExternalStore } from 'react';
import type { LaneLite } from '@/game/world';

export interface Settings {
  volume: number;
  muted: boolean;
  music: boolean;
  ambience: boolean;
  textScale: number;
  reduceMotion: boolean;
  /** 'auto' turns phone mode on for touch-first devices */
  phoneMode: 'auto' | 'on' | 'off';
  phoneLanes: string[];
  voiceCommands: boolean;
  localModel: { enabled: boolean; url: string; model: string };
  showHints: boolean;
}

export interface Session {
  configured: boolean;
  missing: { name: string; why: string }[];
  signedIn: boolean;
  email: string | null;
  firstName: string | null;
  scopes: { drive: boolean; driveFile: boolean; calendar: boolean; gmail: boolean } | null;
  gmailPreview: boolean;
  slackUrl: string | null;
  warroomUrl: string;
  tz: string;
}

export interface PanelSpec {
  type: string;
  props?: Record<string, unknown>;
  key: number;
}

export interface RoomInfo {
  id: string;
  name: string;
  blurb: string;
  theme: string;
  floor: string;
  phoneOk: boolean;
  things: string[];
  exits: string[];
}

export interface Notice {
  id: number;
  text: string;
  tone?: 'info' | 'warn' | 'ok';
}

export interface State {
  session: Session | null;
  sessionState: 'loading' | 'ready' | 'offline';
  room: RoomInfo | null;
  prompt: { verb: string; label: string; secondary?: string; kind: 'obj' | 'npc' } | null;
  panels: PanelSpec[];
  controller: { connected: boolean; name?: string };
  device: 'keyboard' | 'gamepad' | 'touch';
  notices: Notice[];
  settings: Settings;
  lanes: LaneLite[] | null;
  phoneActive: boolean;
  voice: { listening: boolean; transcript: string; error?: string };
  online: boolean;
}

const KEY = 'jhq:settings:v1';

export const DEFAULT_SETTINGS: Settings = {
  volume: 0.55,
  muted: false,
  music: true,
  ambience: true,
  textScale: 1,
  reduceMotion: false,
  phoneMode: 'auto',
  phoneLanes: ['songstage'],
  voiceCommands: false,
  localModel: { enabled: false, url: 'http://localhost:11434', model: 'llama3.2' },
  showHints: true,
};

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const base = { ...DEFAULT_SETTINGS, reduceMotion: reduce };
    return raw ? { ...base, ...JSON.parse(raw) } : base;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function isTouchFirst(): boolean {
  if (typeof window === 'undefined') return false;
  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  const fine = window.matchMedia?.('(any-pointer: fine)').matches ?? false;
  return coarse && !fine;
}

export function phoneModeActive(s: Settings): boolean {
  if (s.phoneMode === 'on') return true;
  if (s.phoneMode === 'off') return false;
  return isTouchFirst();
}

let state: State;
const listeners = new Set<() => void>();
let panelKey = 1;
let noticeId = 1;

function init(): State {
  const settings = typeof window !== 'undefined' ? loadSettings() : DEFAULT_SETTINGS;
  return {
    session: null,
    sessionState: 'loading',
    room: null,
    prompt: null,
    panels: [],
    controller: { connected: false },
    device: typeof window !== 'undefined' && isTouchFirst() ? 'touch' : 'keyboard',
    notices: [],
    settings,
    lanes: null,
    phoneActive: typeof window !== 'undefined' ? phoneModeActive(settings) : false,
    voice: { listening: false, transcript: '' },
    online: typeof navigator !== 'undefined' ? navigator.onLine : true,
  };
}

export function getState(): State {
  if (!state) state = init();
  return state;
}

export function setState(patch: Partial<State> | ((s: State) => Partial<State>)): void {
  const cur = getState();
  const next = typeof patch === 'function' ? patch(cur) : patch;
  state = { ...cur, ...next };
  listeners.forEach((l) => l());
}

export function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useStore<T>(selector: (s: State) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => selector(getState()),
    () => selector(getState())
  );
}

export function setSettings(patch: Partial<Settings>): void {
  const settings = { ...getState().settings, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // storage unavailable
  }
  setState({ settings, phoneActive: phoneModeActive(settings) });
}

export function openPanel(type: string, props?: Record<string, unknown>): void {
  setState((s) => ({ panels: [...s.panels, { type, props, key: panelKey++ }] }));
}

export function replacePanel(type: string, props?: Record<string, unknown>): void {
  setState((s) => ({ panels: [...s.panels.slice(0, -1), { type, props, key: panelKey++ }] }));
}

export function closePanel(): void {
  setState((s) => ({ panels: s.panels.slice(0, -1) }));
}

export function closeAllPanels(): void {
  setState({ panels: [] });
}

export function notify(text: string, tone: Notice['tone'] = 'info'): void {
  const id = noticeId++;
  setState((s) => ({ notices: [...s.notices.slice(-2), { id, text, tone }] }));
  window.setTimeout(() => setState((s) => ({ notices: s.notices.filter((n) => n.id !== id) })), 4200);
}

// Small persisted bits of play state (location, seen markers, surprise history). Never personal content.
export function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`jhq:${key}`);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function saveJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(`jhq:${key}`, JSON.stringify(value));
  } catch {
    // ignore
  }
}

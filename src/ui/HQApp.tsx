'use client';

import { useEffect, useRef } from 'react';
import type Phaser from 'phaser';
import { createGame } from '@/game/main';
import type { RoomData } from '@/game/RoomScene';
import { bus } from '@/game/bus';
import { audio } from '@/game/audio';
import { getWorld, setBadges, setWorld } from '@/game/worldState';
import { buildRoom, listRooms, type Action, type LaneLite } from '@/game/world';
import type { Dir } from '@/game/art/characters';
import { InputRouter } from './input/router';
import { setActiveRouter } from './input/active';
import { api, ApiFailure, invalidateApi } from './api';
import { closePanel, getState, loadJson, notify, openPanel, saveJson, setSettings, setState, subscribe, type RoomInfo, type Session } from './store';
import { PanelHost } from './panels/registry';
import { Hud } from './Hud';
import { TouchControls } from './Touch';
import { voiceStart, voiceStop } from './panels/voice';
import { openLink } from './components';
import { travelTo } from './nav';
import type { GmailResponse, LanesResponse, Overview } from './types';
import { todayIn } from '@/lib/shared/dates';

interface SavedPos {
  room: string;
  x: number;
  y: number;
  dir?: Dir;
}

const AUTH_NOTICES: Record<string, [string, 'info' | 'warn' | 'ok']> = {
  ok: ['Signed in. Pulling your records.', 'ok'],
  signed_out: ['Signed out. Your records are hidden until you sign in again.', 'info'],
  denied: ['Google sign-in was cancelled.', 'warn'],
  forbidden: ['That Google account isn’t on the allowed list for this headquarters.', 'warn'],
  state: ['Sign-in expired before it finished. Try again.', 'warn'],
  exchange: ['Google didn’t complete the sign-in. Try again in a minute.', 'warn'],
  not_configured: ['Google sign-in isn’t set up on this deployment yet. See Menu → Account.', 'warn'],
};

function startRoom(): RoomData {
  const phone = getState().phoneActive;
  const fallback: RoomData = { roomId: phone ? 'lounge' : 'command' };
  const saved = loadJson<SavedPos | null>('pos', null);
  if (!saved?.room || saved.room === 'personal') return fallback;
  if (saved.room.startsWith('lane:')) return { roomId: 'work' };
  const def = buildRoom(saved.room, getWorld());
  if (!def || (phone && !def.phoneOk)) return fallback;
  return { roomId: saved.room, pos: { x: saved.x, y: saved.y, dir: saved.dir } };
}

function applyDocumentSettings(): void {
  const s = getState().settings;
  const root = document.documentElement;
  root.style.setProperty('--text-scale', String(s.textScale));
  root.classList.toggle('reduce-motion', s.reduceMotion);
  audio.applySettings({ volume: s.volume, muted: s.muted, music: s.music, ambience: s.ambience });
}

async function refreshBadges(): Promise<void> {
  const s = getState();
  if (!s.session?.signedIn) {
    setBadges({ inventor: loadJson<string>('seen:inventor', '') !== todayIn(s.session?.tz ?? undefined) });
    bus.emit('ui:badges');
    return;
  }
  const today = todayIn(s.session.tz);
  const next: Record<string, boolean> = { inventor: loadJson<string>('seen:inventor', '') !== today };
  try {
    const ov = await api<Overview>('/api/hq/overview', { ttl: 120_000 });
    const now = Date.now();
    next.chief = !!ov.calendar?.today.some((e) => {
      if (e.allDay) return false;
      const t = new Date(e.start).getTime();
      return t > now && t - now <= 60 * 60 * 1000;
    });
    next.archivist = !!ov.checkout?.date && loadJson<string>('seen:checkout', '') !== ov.checkout.date;
    if (ov.checkout?.date) saveJson('latest:checkout', ov.checkout.date);
  } catch {
    // badges are decoration; ignore failures
  }
  if (s.session.gmailPreview && s.session.scopes?.gmail) {
    try {
      const g = await api<GmailResponse>('/api/hq/gmail', { ttl: 60_000 });
      next.comms = !g.disabled && g.unread > 0;
    } catch {
      // ignore
    }
  }
  setBadges(next);
  bus.emit('ui:badges');
}

async function loadSession(): Promise<Session | null> {
  try {
    const session = await api<Session>('/api/session', { force: true });
    setState({ session, sessionState: 'ready' });
    return session;
  } catch (e) {
    setState({ sessionState: e instanceof ApiFailure && e.body.code === 'offline' ? 'offline' : 'ready' });
    return null;
  }
}

async function loadLanes(): Promise<void> {
  try {
    const res = await api<LanesResponse>('/api/hq/lanes', { ttl: 300_000 });
    const lanes: LaneLite[] = res.lanes.map((l) => ({ id: l.id, name: l.name, theme: l.theme, closed: l.closed, personal: l.personal, openCount: l.openCount }));
    setState({ lanes });
    setWorld({ lanes });
    bus.emit('ui:world');
  } catch (e) {
    if (e instanceof ApiFailure && e.body.code !== 'not_signed_in') notify(`Lanes didn’t load: ${e.body.error}`, 'warn');
  }
}

function onInteract(p: { action: Action; label?: string }): void {
  const a = p.action;
  if (a.type === 'panel') openPanel(a.panel, a.props);
  else if (a.type === 'link') openLink(a.url, a.label ?? p.label);
  else if (a.type === 'npc') openPanel('npc', { npcId: a.npcId });
  else if (a.type === 'locked') notify(a.message, 'warn');
  else if (a.type === 'travel') travelTo(a.to, a.spawn);
}

function onNpc(npcId: string): void {
  openPanel('npc', { npcId });
  const s = getState();
  const today = todayIn(s.session?.tz ?? undefined);
  if (npcId === 'archivist') saveJson('seen:checkout', loadJson<string>('latest:checkout', ''));
  if (npcId === 'inventor') saveJson('seen:inventor', today);
  if (npcId === 'archivist' || npcId === 'inventor') void refreshBadges();
}

export default function HQApp() {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    applyDocumentSettings();
    setWorld({ phoneMode: getState().phoneActive, phoneLanes: getState().settings.phoneLanes, hour: new Date().getHours() });

    const first = !loadJson<SavedPos | null>('pos', null);
    const game: Phaser.Game = createGame(el, startRoom());

    const router = new InputRouter({
      hasPanel: () => getState().panels.length > 0,
      closeTop: () => closePanel(),
      toggleMenu: () => {
        const top = getState().panels.at(-1);
        if (top?.type === 'menu') closePanel();
        else openPanel('menu');
      },
      openUnique: (type) => {
        const top = getState().panels.at(-1);
        if (top?.type === type) closePanel();
        else openPanel(type);
      },
      cycleRoom: (delta) => {
        const s = getState();
        const rooms = listRooms(getWorld()).filter((r) => r.id !== 'personal' && (!s.phoneActive || r.phoneOk));
        if (!rooms.length) return;
        const idx = rooms.findIndex((r) => r.id === s.room?.id);
        const next = rooms[(idx + delta + rooms.length) % rooms.length];
        if (next && next.id !== s.room?.id) travelTo(next.id);
      },
      voiceStart,
      voiceStop,
      onDevice: (d) => setState({ device: d }),
      onController: (connected, id) => {
        setState({ controller: { connected, name: id } });
        notify(connected ? 'Controller connected' : 'Controller disconnected', connected ? 'ok' : 'info');
      },
      unlockAudio: () => audio.unlock(),
      sfx: (name) => audio.sfx(name),
    });
    router.start();
    setActiveRouter(router);

    // Test seam for the headless end-to-end run (?e2e=1). Exposes UI helpers only, never data.
    if (new URLSearchParams(window.location.search).has('e2e')) {
      (window as unknown as { __hq: unknown }).__hq = { openPanel, closePanel, travelTo, getState, setSettings };
    }

    let lastPosSave = 0;
    const offs = [
      bus.on<RoomInfo & { size?: unknown }>('game:room', (r) => {
        setState({ room: { id: r.id, name: r.name, blurb: r.blurb, theme: r.theme, floor: r.floor, phoneOk: r.phoneOk, things: r.things, exits: r.exits }, prompt: null });
      }),
      bus.on<{ verb: string; label: string; secondary?: string; kind: 'obj' | 'npc' } | null>('game:prompt', (p) => setState({ prompt: p ?? null })),
      bus.on<{ action: Action; label?: string }>('game:interact', onInteract),
      bus.on<{ npcId: string }>('game:npc', (p) => onNpc(p.npcId)),
      bus.on<{ text: string; tone?: 'info' | 'warn' | 'ok' }>('game:notice', (n) => notify(n.text, n.tone)),
      bus.on<SavedPos & { force?: boolean }>('game:position', (p) => {
        const now = Date.now();
        if (!p.force && now - lastPosSave < 1500) return;
        lastPosSave = now;
        saveJson('pos', { room: p.room, x: p.x, y: p.y, dir: p.dir });
      }),
      bus.on<boolean>('game:music', (on) => setSettings({ music: on })),
    ];

    // Settings and phone mode feed the audio engine and the world.
    let prev = getState();
    const unsub = subscribe(() => {
      // Update `prev` first: the side effects below can set state again, re-entering this listener.
      const s = getState();
      const was = prev;
      prev = s;
      if (s.settings !== was.settings) applyDocumentSettings();
      if (s.phoneActive !== was.phoneActive || s.settings.phoneLanes !== was.settings.phoneLanes) {
        setWorld({ phoneMode: s.phoneActive, phoneLanes: s.settings.phoneLanes });
        bus.emit('ui:world');
        if (s.phoneActive && s.room && !s.room.phoneOk && !(s.room.id.startsWith('lane:') && s.settings.phoneLanes.includes(s.room.id.slice(5)))) {
          notify('Phone mode is on, so you’ve moved to the Dream Lounge.');
          travelTo('lounge');
        }
      }
      if (s.panels.length !== was.panels.length && s.panels.length === 0) audio.sfx('close');
    });

    const onOnline = () => setState({ online: navigator.onLine });
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOnline);

    let hiddenAt = 0;
    const onVis = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now();
        return;
      }
      setWorld({ hour: new Date().getHours() });
      if (hiddenAt && Date.now() - hiddenAt > 10 * 60 * 1000 && getState().session?.signedIn) {
        invalidateApi('/api/hq/');
        notify('Welcome back. Records refreshed.');
        void refreshBadges();
      }
    };
    document.addEventListener('visibilitychange', onVis);

    // Auth notices from the sign-in redirect.
    const url = new URL(window.location.href);
    const auth = url.searchParams.get('auth');
    if (auth) {
      const n = AUTH_NOTICES[auth];
      if (n) notify(n[0], n[1]);
      url.searchParams.delete('auth');
      window.history.replaceState(null, '', url.pathname + (url.search ? url.search : '') + url.hash);
    }

    void (async () => {
      const session = await loadSession();
      if (!session) {
        notify('Can’t reach the server. The world works; records will load when you’re back online.', 'warn');
        return;
      }
      if (session.signedIn) {
        await loadLanes();
        void refreshBadges();
      } else {
        void refreshBadges();
        if (first) notify(session.configured ? 'Welcome to Jesse HQ. Sign in from the Menu to load your records.' : 'Welcome to Jesse HQ. Google sign-in isn’t set up yet, so rooms show no records.', 'info');
      }
    })();

    const badgeTimer = window.setInterval(() => void refreshBadges(), 5 * 60 * 1000);

    return () => {
      offs.forEach((off) => off());
      unsub();
      router.stop();
      setActiveRouter(null);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOnline);
      document.removeEventListener('visibilitychange', onVis);
      window.clearInterval(badgeTimer);
      game.destroy(true);
    };
  }, []);

  return (
    <div className="hq">
      <div ref={host} className="game-host" aria-label="Jesse HQ world" />
      <div className="vignette" aria-hidden />
      <Hud />
      <TouchControls />
      <PanelHost />
    </div>
  );
}

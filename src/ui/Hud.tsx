'use client';

import { useEffect, useState, type MouseEvent } from 'react';
import { Glyph } from './components';
import { getState, openPanel, setSettings, useStore } from './store';

function useClock(tz?: string): string {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 15_000);
    return () => window.clearInterval(t);
  }, []);
  try {
    return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: tz }).format(now);
  } catch {
    return now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
}

function blurAfter(fn: () => void) {
  return (e: MouseEvent<HTMLButtonElement>) => {
    fn();
    e.currentTarget.blur();
  };
}

export function Hud() {
  const room = useStore((s) => s.room);
  const prompt = useStore((s) => s.prompt);
  const session = useStore((s) => s.session);
  const sessionState = useStore((s) => s.sessionState);
  const controller = useStore((s) => s.controller.connected);
  const notices = useStore((s) => s.notices);
  const online = useStore((s) => s.online);
  const muted = useStore((s) => s.settings.muted);
  const hints = useStore((s) => s.settings.showHints);
  const panelOpen = useStore((s) => s.panels.length > 0);
  const device = useStore((s) => s.device);
  const phone = useStore((s) => s.phoneActive);
  const clock = useClock(session?.tz);

  const account = !session ? (
    <span className="chip muted">{sessionState === 'offline' ? 'Offline' : '…'}</span>
  ) : !session.configured ? (
    <button className="chip warn" onClick={blurAfter(() => openPanel('setup'))}>
      Setup needed
    </button>
  ) : session.signedIn ? (
    <span className="chip ok" title={session.email ?? ''}>
      ● {session.firstName ?? 'Signed in'}
    </span>
  ) : (
    <a className="chip" href="/api/auth/login?return=/">
      Sign in
    </a>
  );

  return (
    <>
      <header className="hud-top">
        <div className="hud-room">
          <span className="hud-floor">{room?.floor === 'upper' ? 'Upstairs' : 'Ground floor'}</span>
          <strong>{room?.name ?? 'Jesse HQ'}</strong>
        </div>
        <div className="hud-right">
          {!online && <span className="chip warn">Offline</span>}
          {phone && <span className="chip" title="Phone mode: laptop-only rooms are locked">📱</span>}
          {controller && <span className="chip" title="Controller connected">🎮</span>}
          <span className="hud-clock">{clock}</span>
          {account}
          <button className="hud-btn" aria-label={muted ? 'Unmute' : 'Mute'} onClick={blurAfter(() => setSettings({ muted: !getState().settings.muted }))}>
            {muted ? '🔇' : '🔊'}
          </button>
          <button className="hud-btn" aria-label="Map" onClick={blurAfter(() => openPanel('map'))}>
            🗺️
          </button>
          <button className="hud-btn" aria-label="Menu" onClick={blurAfter(() => openPanel('menu'))}>
            ≡
          </button>
        </div>
      </header>

      {!panelOpen && prompt && (
        <div className={`prompt prompt-${prompt.kind}`} role="status">
          <span>
            <Glyph b="A" /> {prompt.verb} <strong>{prompt.label}</strong>
          </span>
          {prompt.secondary && (
            <span className="prompt-secondary">
              <Glyph b="X" /> {prompt.secondary}
            </span>
          )}
        </div>
      )}

      {!panelOpen && hints && device !== 'touch' && (
        <div className="hints" aria-hidden>
          <span>
            <Glyph b="VIEW" /> Map
          </span>
          <span>
            <Glyph b="Y" /> Search
          </span>
          <span>
            <Glyph b="MENU" /> Menu
          </span>
          <span>
            <Glyph b="LB" />
            <Glyph b="RB" /> Rooms
          </span>
        </div>
      )}

      <div className="toasts" aria-live="polite">
        {notices.map((n) => (
          <div key={n.id} className={`toast toast-${n.tone ?? 'info'}`}>
            {n.text}
          </div>
        ))}
      </div>
    </>
  );
}

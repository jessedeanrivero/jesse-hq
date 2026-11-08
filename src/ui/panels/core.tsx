'use client';

import { useMemo, useState } from 'react';
import { Btn, Empty, Glyph, Panel, Row, Section, SetupCard, SignInCard } from '../components';
import { closeAllPanels, closePanel, getState, notify, openPanel, replacePanel, setSettings, useStore } from '../store';
import { travelTo } from '../nav';
import { listRooms } from '@/game/world';
import { getWorld } from '@/game/worldState';
import { NPCS } from '@/npc/npcs';
import { EXAMPLE_COMMANDS } from '@/lib/shared/voice-commands';
import { speechSupported } from '../voice';
import { invalidateApi } from '../api';

export function MenuPanel() {
  const session = useStore((s) => s.session);
  const room = useStore((s) => s.room);
  const items: { label: string; hint?: string; run: () => void; glyph?: 'VIEW' | 'Y' }[] = [
    { label: 'Resume', run: () => closePanel() },
    { label: 'Map and fast travel', glyph: 'VIEW', run: () => replacePanel('map') },
    { label: 'Search', glyph: 'Y', run: () => replacePanel('search') },
    { label: 'Daily briefing', run: () => replacePanel('briefing') },
    { label: 'Go to the Command Center', run: () => travelTo('command') },
    { label: 'Settings', run: () => replacePanel('settings') },
    { label: 'Controls and help', run: () => replacePanel('help') },
  ];
  return (
    <Panel title="Menu" icon="≡" size="sm" subtitle={room ? `You’re in the ${room.name}.` : undefined}>
      <ul className="plain menu-list">
        {items.map((it, i) => (
          <li key={it.label}>
            <button className="menu-item" data-nav {...(i === 0 ? { 'data-autofocus': '' } : {})} onClick={it.run}>
              <span>{it.label}</span>
              {it.glyph && <Glyph b={it.glyph} />}
            </button>
          </li>
        ))}
      </ul>
      {room && (
        <Section title="About this room">
          <p>{room.blurb}</p>
          {room.things.length > 0 && <p className="muted small">Here: {room.things.join(' · ')}</p>}
        </Section>
      )}
      <Section title="Account">
        {!session ? (
          <p className="muted">Checking…</p>
        ) : !session.configured ? (
          <Btn onClick={() => replacePanel('setup')}>Google setup needed</Btn>
        ) : session.signedIn ? (
          <Row>
            <span className="muted">Signed in as {session.email}</span>
            <Btn small href="/api/auth/logout" sameTab>
              Sign out
            </Btn>
          </Row>
        ) : (
          <Btn kind="primary" href="/api/auth/login?return=/" sameTab>
            Sign in with Google
          </Btn>
        )}
      </Section>
      <Row>
        <Btn small kind="ghost" href="/classic/index.html" sameTab>
          Classic HQ
        </Btn>
      </Row>
    </Panel>
  );
}

export function MapPanel() {
  const current = useStore((s) => s.room?.id);
  const phone = useStore((s) => s.phoneActive);
  useStore((s) => s.lanes);
  const rooms = listRooms(getWorld());
  const groups = useMemo(() => {
    const m = new Map<string, typeof rooms>();
    for (const r of rooms) m.set(r.group, [...(m.get(r.group) ?? []), r]);
    return [...m.entries()];
  }, [rooms]);
  const who = (id: string) => NPCS.filter((n) => n.roomId === id).map((n) => n.name);
  return (
    <Panel title="Map" icon="🗺️" subtitle={phone ? 'Phone mode: laptop-only rooms are locked. Change it in Settings.' : 'Pick a room to walk there.'} size="lg">
      {groups.map(([g, list]) => (
        <Section key={g} title={g}>
          <ul className="plain map-list">
            {list.map((r) => {
              const locked = phone && !r.phoneOk;
              const here = r.id === current;
              const npcs = who(r.id);
              return (
                <li key={r.id} className={`map-row ${here ? 'here' : ''} ${locked ? 'locked' : ''}`}>
                  <button
                    data-nav
                    {...(here ? { 'data-autofocus': '' } : {})}
                    className="map-go"
                    disabled={locked}
                    onClick={() => (r.id === 'personal' ? replacePanel('confirm-personal') : travelTo(r.id))}
                  >
                    <strong>{r.name}</strong>
                    <span className="muted">
                      {here ? 'You are here · ' : ''}
                      {r.blurb}
                      {npcs.length ? ` · ${npcs.join(', ')}` : ''}
                    </span>
                    {locked && <span className="lock">🔒 laptop</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </Section>
      ))}
    </Panel>
  );
}

function Toggle({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <label className="toggle">
      <input data-nav type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>
        {label}
        {hint && <span className="muted small"> {hint}</span>}
      </span>
    </label>
  );
}

export function SettingsPanel() {
  const s = useStore((st) => st.settings);
  const phoneActive = useStore((st) => st.phoneActive);
  const controller = useStore((st) => st.controller);
  const session = useStore((st) => st.session);
  const lanes = useStore((st) => st.lanes);
  const [tab, setTab] = useState('sound');
  const [test, setTest] = useState<string | null>(null);
  const testModel = async () => {
    setTest('Checking…');
    try {
      const r = await fetch(`${s.localModel.url.replace(/\/$/, '')}/api/tags`, { method: 'GET' });
      if (!r.ok) throw new Error(String(r.status));
      const j = (await r.json()) as { models?: { name: string }[] };
      const names = (j.models ?? []).map((m) => m.name);
      setTest(names.length ? `Connected. Models: ${names.slice(0, 6).join(', ')}` : 'Connected, but no models are installed.');
    } catch {
      setTest('Could not reach it. Is Ollama running, and does OLLAMA_ORIGINS allow this site?');
    }
  };
  return (
    <Panel
      title="Settings"
      icon="⚙️"
      tabs={[
        { id: 'sound', label: 'Sound' },
        { id: 'display', label: 'Display' },
        { id: 'phone', label: 'Phone mode' },
        { id: 'voice', label: 'Voice' },
        { id: 'controller', label: 'Controller' },
        { id: 'account', label: 'Account' },
      ]}
      tab={tab}
      onTab={setTab}
    >
      {tab === 'sound' && (
        <>
          <label className="field">
            <span>Volume {Math.round(s.volume * 100)}%</span>
            <input data-nav data-autofocus type="range" min={0} max={1} step={0.05} value={s.volume} onChange={(e) => setSettings({ volume: Number(e.target.value) })} />
          </label>
          <Toggle label="Mute everything" checked={s.muted} onChange={(v) => setSettings({ muted: v })} />
          <Toggle label="Lounge music" checked={s.music} onChange={(v) => setSettings({ music: v })} hint="Generated live, plays upstairs." />
          <Toggle label="Room ambience" checked={s.ambience} onChange={(v) => setSettings({ ambience: v })} />
        </>
      )}
      {tab === 'display' && (
        <>
          <label className="field">
            <span>Text size {Math.round(s.textScale * 100)}%</span>
            <input data-nav data-autofocus type="range" min={0.85} max={1.4} step={0.05} value={s.textScale} onChange={(e) => setSettings({ textScale: Number(e.target.value) })} />
          </label>
          <Toggle label="Reduce motion" checked={s.reduceMotion} onChange={(v) => setSettings({ reduceMotion: v })} />
          <Toggle label="Show control hints" checked={s.showHints} onChange={(v) => setSettings({ showHints: v })} />
        </>
      )}
      {tab === 'phone' && (
        <>
          <p>
            Phone mode is <strong>{phoneActive ? 'on' : 'off'}</strong> right now. When it’s on, laptop-only rooms are locked and you start in the Dream Lounge.
          </p>
          <div className="radio-row" role="radiogroup" aria-label="Phone mode">
            {(['auto', 'on', 'off'] as const).map((m) => (
              <label key={m} className="radio">
                <input data-nav type="radio" name="phoneMode" checked={s.phoneMode === m} onChange={() => setSettings({ phoneMode: m })} />
                <span>{m === 'auto' ? 'Automatic (on for phones)' : m === 'on' ? 'Always on' : 'Always off'}</span>
              </label>
            ))}
          </div>
          <Section title="Lanes allowed on the phone">
            {lanes?.length ? (
              lanes
                .filter((l) => !l.personal)
                .map((l) => (
                  <Toggle
                    key={l.id}
                    label={l.name}
                    checked={s.phoneLanes.includes(l.id)}
                    onChange={(v) => setSettings({ phoneLanes: v ? [...s.phoneLanes, l.id] : s.phoneLanes.filter((x) => x !== l.id) })}
                  />
                ))
            ) : (
              <Empty>Your lanes appear here after you sign in.</Empty>
            )}
          </Section>
        </>
      )}
      {tab === 'voice' && (
        <>
          <Section title="Dictation (always on)">
            <p>Every text box is a normal text field, so Superwhisper or macOS Dictation types straight into it. Focus a box (A, or click it), then use your usual dictation shortcut.</p>
          </Section>
          <Section title="Voice commands (optional)">
            <Toggle label="Hold V or LT to speak a command" checked={s.voiceCommands} onChange={(v) => setSettings({ voiceCommands: v })} />
            <p className="muted small">
              {speechSupported()
                ? 'Uses this browser’s built-in speech recognition. In Chrome, the audio is processed by Google’s speech service. The command list is fixed and runs on your device; nothing is sent anywhere else.'
                : 'This browser has no built-in speech recognition, so voice commands are unavailable here. Dictation still works.'}
            </p>
          </Section>
          <Section title="Local model (optional)">
            <Toggle
              label="Let coworkers use a model on this computer"
              checked={s.localModel.enabled}
              onChange={(v) => setSettings({ localModel: { ...s.localModel, enabled: v } })}
              hint="Ollama only. Off by default."
            />
            {s.localModel.enabled && (
              <>
                <label className="field">
                  <span>Ollama address</span>
                  <input data-nav value={s.localModel.url} onChange={(e) => setSettings({ localModel: { ...s.localModel, url: e.target.value } })} />
                </label>
                <label className="field">
                  <span>Model</span>
                  <input data-nav value={s.localModel.model} onChange={(e) => setSettings({ localModel: { ...s.localModel, model: e.target.value } })} />
                </label>
                <Row>
                  <Btn small onClick={() => void testModel()}>
                    Test connection
                  </Btn>
                  {test && <span className="muted small">{test}</span>}
                </Row>
              </>
            )}
          </Section>
        </>
      )}
      {tab === 'controller' && (
        <>
          <p>
            {controller.connected ? (
              <>
                <strong>Controller connected.</strong> <span className="muted">{controller.name}</span>
              </>
            ) : (
              'No controller detected. Connect it by Bluetooth or USB, then press any button so the browser can see it.'
            )}
          </p>
          <Row>
            <Btn onClick={() => replacePanel('help', { tab: 'controller' })}>Show the button map</Btn>
          </Row>
        </>
      )}
      {tab === 'account' && (
        <>
          {!session?.configured ? (
            <SetupCard setup={session?.missing.map((m) => `${m.name}: ${m.why}`)} />
          ) : session.signedIn ? (
            <>
              <p>
                Signed in as <strong>{session.email}</strong>.
              </p>
              <ul className="plain">
                <li>Drive (read): {session.scopes?.drive ? 'allowed' : 'not granted'}</li>
                <li>Dream Journal files: {session.scopes?.driveFile ? 'allowed' : 'not granted'}</li>
                <li>Calendar (read): {session.scopes?.calendar ? 'allowed' : 'not granted'}</li>
                <li>Gmail previews: {!session.gmailPreview ? 'turned off on this deployment' : session.scopes?.gmail ? 'allowed' : 'not granted'}</li>
              </ul>
              <Row>
                <Btn href="/api/auth/logout" sameTab>
                  Sign out
                </Btn>
                <Btn
                  onClick={() => {
                    invalidateApi();
                    notify('Cleared cached records. They reload next time you look.');
                  }}
                >
                  Refresh records
                </Btn>
              </Row>
            </>
          ) : (
            <SignInCard />
          )}
          <Section title="This device">
            <p className="muted small">Settings, your last position and Surprise history live in this browser only. No records are stored here.</p>
            <Btn
              small
              kind="danger"
              onClick={() => {
                try {
                  Object.keys(localStorage)
                    .filter((k) => k.startsWith('jhq:') && k !== 'jhq:settings:v1')
                    .forEach((k) => localStorage.removeItem(k));
                } catch {
                  // ignore
                }
                notify('Play data cleared on this device.');
              }}
            >
              Clear play data
            </Btn>
          </Section>
        </>
      )}
    </Panel>
  );
}

const PAD_ROWS: [string, string][] = [
  ['Left stick or D-pad', 'Walk; move between buttons in panels'],
  ['A', 'Interact, talk, select'],
  ['B', 'Back, close'],
  ['X', 'Secondary action (shown in the prompt)'],
  ['Y', 'Search'],
  ['LB / RB', 'Previous / next room (switch tabs in panels)'],
  ['RT (hold)', 'Run'],
  ['LT (hold)', 'Voice command (if turned on in Settings)'],
  ['View (⧉)', 'Map'],
  ['Menu (≡)', 'Menu'],
  ['Right stick', 'Scroll a panel'],
];

const KEY_ROWS: [string, string][] = [
  ['WASD or arrows', 'Walk; arrows move between buttons in panels'],
  ['E, Space or Enter', 'Interact, select'],
  ['Esc', 'Close a panel (opens the menu while walking)'],
  ['F', 'Secondary action'],
  ['/ or Ctrl/Cmd + K', 'Search'],
  ['[ and ]', 'Previous / next room, or tabs'],
  ['Shift (hold)', 'Run'],
  ['V (hold)', 'Voice command (if turned on)'],
  ['M', 'Map'],
  ['Tab', 'Menu'],
  ['Click', 'Walk to a spot, or use a thing'],
];

export function HelpPanel({ tab: t0 }: { tab?: string }) {
  const [tab, setTab] = useState(t0 ?? 'controller');
  return (
    <Panel
      title="Controls and help"
      icon="🎮"
      tabs={[
        { id: 'controller', label: 'Controller' },
        { id: 'keyboard', label: 'Keyboard' },
        { id: 'touch', label: 'Touch' },
        { id: 'voice', label: 'Dictation and voice' },
        { id: 'honest', label: 'What’s real' },
      ]}
      tab={tab}
      onTab={setTab}
    >
      {tab === 'controller' && (
        <>
          <table className="table">
            <tbody>
              {PAD_ROWS.map(([k, v]) => (
                <tr key={k}>
                  <th>{k}</th>
                  <td>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted small">Uses the browser’s standard gamepad mapping (Xbox layout). In a text box, B leaves the box; the on-screen keyboard and your dictation tool handle the typing.</p>
        </>
      )}
      {tab === 'keyboard' && (
        <table className="table">
          <tbody>
            {KEY_ROWS.map(([k, v]) => (
              <tr key={k}>
                <th>{k}</th>
                <td>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {tab === 'touch' && (
        <ul className="bullets">
          <li>Drag the pad in the bottom-left corner to walk, or tap a spot.</li>
          <li>Tap A to use whatever the prompt shows. Tap B to step back.</li>
          <li>Map and Menu sit at the top right.</li>
          <li>Panels are full screen on a phone; tap Close or swipe back to leave.</li>
        </ul>
      )}
      {tab === 'voice' && (
        <>
          <Section title="Dictation into any box">
            <ul className="bullets">
              <li>Focus a text box first: press A on it, or click it.</li>
              <li>Then use your Superwhisper hotkey, or the macOS Dictation shortcut you set in System Settings. The words land in the box like typing.</li>
              <li>Nothing about dictation runs inside this app, so it works the same as anywhere else on your Mac.</li>
              <li>Want a controller button for dictation? Tools like Steam’s controller configuration can map a button to a keyboard shortcut. That mapping is outside this app and not tested here.</li>
            </ul>
          </Section>
          <Section title="Voice commands (optional, off by default)">
            <p>Turn them on in Settings, then hold V or LT and say:</p>
            <ul className="bullets">
              {EXAMPLE_COMMANDS.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
            <p className="muted small">It shows what it heard and waits for you to confirm before doing anything.</p>
          </Section>
        </>
      )}
      {tab === 'honest' && (
        <ul className="bullets">
          <li>Every record shown comes live from your Drive, Calendar or Gmail, with a link to the original. Nothing is sample data.</li>
          <li>The coworkers are fictional characters. Their answers are your own records, arranged by simple rules.</li>
          <li>Surprise Me is rules, not AI.</li>
          <li>Nothing is ever sent from here. Email and Slack buttons open a draft you review and send yourself.</li>
          <li>The only thing this app ever writes is a Dream Journal file, and only after you confirm.</li>
          <li>The lab shows files your workflows left in Drive. It can’t see whether a scheduled task ran.</li>
        </ul>
      )}
    </Panel>
  );
}

export function SetupPanel() {
  const session = useStore((s) => s.session);
  if (!session) return null;
  return (
    <Panel title="Setup" icon="🔧" subtitle="How this headquarters connects to your records.">
      {!session.configured ? (
        <SetupCard setup={session.missing.map((m) => `${m.name}: ${m.why}`)} />
      ) : !session.signedIn ? (
        <SignInCard />
      ) : (
        <>
          <p>
            Connected as <strong>{session.email}</strong>.
          </p>
          <ul className="plain">
            <li>Drive (read): {session.scopes?.drive ? '✓' : 'not granted'}</li>
            <li>Calendar (read): {session.scopes?.calendar ? '✓' : 'not granted'}</li>
            <li>Gmail previews: {!session.gmailPreview ? 'off' : session.scopes?.gmail ? '✓' : 'not granted'}</li>
            <li>Dream Journal files: {session.scopes?.driveFile ? '✓' : 'not granted'}</li>
          </ul>
          <Row>
            <Btn onClick={() => replacePanel('settings')}>Open settings</Btn>
            <Btn
              onClick={() => {
                closeAllPanels();
                openPanel('briefing');
              }}
            >
              Daily briefing
            </Btn>
          </Row>
        </>
      )}
    </Panel>
  );
}

export function getRoomsForVoice() {
  return listRooms(getWorld()).map((r) => ({ id: r.id, label: r.name, aliases: r.aliases }));
}

export function currentRoomId(): string | undefined {
  return getState().room?.id;
}

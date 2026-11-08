'use client';

import { useMemo } from 'react';
import { Btn, Glyph, Panel, Row } from '../components';
import { closePanel, getState, openPanel, replacePanel, setSettings, setState, useStore } from '../store';
import { travelTo } from '../nav';
import { speechSupported, voice, VOICE_ERRORS } from '../voice';
import { EXAMPLE_COMMANDS, routeVoiceCommand, type PanelTarget, type VoiceCommand } from '@/lib/shared/voice-commands';
import { NPCS, npcById } from '@/npc/npcs';
import { audio } from '@/game/audio';
import { listRooms } from '@/game/world';
import { getWorld } from '@/game/worldState';

const PANEL_FOR: Record<PanelTarget, { type: string; props?: Record<string, unknown> }> = {
  loops: { type: 'loops' },
  checkout: { type: 'checkout' },
  calendar: { type: 'calendar' },
  inbox: { type: 'comms', props: { tab: 'inbox' } },
  map: { type: 'map' },
  search: { type: 'search' },
  settings: { type: 'settings' },
  dreamboard: { type: 'dreamboard' },
  journal: { type: 'journal' },
  surprise: { type: 'surprise' },
  briefing: { type: 'briefing' },
  menu: { type: 'menu' },
};

function targets() {
  return {
    rooms: listRooms(getWorld()).map((r) => ({ id: r.id, label: r.name, aliases: r.aliases })),
    npcs: NPCS.map((n) => ({ id: n.id, label: n.name, aliases: [n.role, n.role.replace(/^The /, ''), `${n.name} the ${n.role}`] })),
  };
}

/** Carry out a routed command. Used by voice and by typed questions to coworkers. */
export function runCommand(cmd: VoiceCommand): void {
  if (cmd.type === 'travel') {
    if (cmd.roomId === 'personal') {
      replacePanel('confirm-personal');
      return;
    }
    travelTo(cmd.roomId);
    return;
  }
  if (cmd.type === 'panel') {
    const p = PANEL_FOR[cmd.panel];
    replacePanel(p.type, { ...(p.props ?? {}), ...(cmd.query ? { q: cmd.query } : {}) });
    return;
  }
  if (cmd.type === 'compose') {
    replacePanel('compose', { to: cmd.to ?? '' });
    return;
  }
  if (cmd.type === 'talk') {
    const npc = npcById(cmd.npcId);
    if (!npc) return;
    if (getState().room?.id !== npc.roomId) {
      travelTo(npc.roomId);
      window.setTimeout(() => openPanel('npc', { npcId: npc.id }), 700);
    } else replacePanel('npc', { npcId: npc.id });
  }
}

/** Hold-to-talk start (V key or LT). Opens the voice panel; listens only if voice commands are on. */
export function voiceStart(): void {
  const s = getState();
  if (!s.panels.some((p) => p.type === 'voice')) openPanel('voice');
  if (!s.settings.voiceCommands || !speechSupported()) return;
  setState({ voice: { listening: true, transcript: '', error: undefined } });
  audio.sfx('blip');
  voice.start(
    (text) => setState((st) => ({ voice: { ...st.voice, transcript: text } })),
    (err) => setState((st) => ({ voice: { ...st.voice, listening: false, error: err && err !== 'aborted' ? err : undefined } }))
  );
}

export function voiceStop(): void {
  if (getState().voice.listening) voice.stop();
}

export function VoicePanel() {
  const enabled = useStore((s) => s.settings.voiceCommands);
  const v = useStore((s) => s.voice);
  const supported = speechSupported();
  const cmd = useMemo(() => (!v.listening && v.transcript ? routeVoiceCommand(v.transcript, targets()) : null), [v.listening, v.transcript]);
  if (!enabled) {
    return (
      <Panel title="Voice commands are off" icon="🎙️" size="sm">
        <p>Dictation works everywhere already: focus a text box and use your Superwhisper hotkey or macOS Dictation.</p>
        <p className="muted small">
          Voice commands are a separate, optional feature: hold V or LT and say something like “Open Hawks War Room”. They use this browser’s speech recognition (in Chrome, Google’s speech service hears the audio).
        </p>
        <Row>
          <Btn
            kind="primary"
            autoFocus
            disabled={!supported}
            onClick={() => {
              setSettings({ voiceCommands: true });
              closePanel();
            }}
          >
            {supported ? 'Turn on voice commands' : 'Not available in this browser'}
          </Btn>
          <Btn onClick={() => closePanel()}>Not now</Btn>
        </Row>
      </Panel>
    );
  }
  if (!supported) {
    return (
      <Panel title="Voice commands" icon="🎙️" size="sm">
        <p>{VOICE_ERRORS.not_supported}</p>
      </Panel>
    );
  }
  return (
    <Panel title={v.listening ? 'Listening…' : 'Voice command'} icon="🎙️" size="sm">
      <div className={`voice-meter ${v.listening ? 'on' : ''}`} aria-hidden>
        <span />
        <span />
        <span />
        <span />
      </div>
      <p className="transcript">{v.transcript ? `“${v.transcript}”` : v.listening ? 'Speak now. Let go of the button when you’re done.' : ''}</p>
      {v.error && VOICE_ERRORS[v.error] && <p className="card warn">{VOICE_ERRORS[v.error]}</p>}
      {!v.listening && v.transcript && (
        <>
          {cmd ? (
            <>
              <p>
                Do this: <strong>{cmd.label}</strong>?
              </p>
              <Row>
                <Btn kind="primary" autoFocus onClick={() => runCommand(cmd)}>
                  <Glyph b="A" /> Yes
                </Btn>
                <Btn onClick={() => closePanel()}>
                  <Glyph b="B" /> Cancel
                </Btn>
              </Row>
            </>
          ) : (
            <>
              <p>I didn’t recognize that. These work:</p>
              <ul className="bullets">
                {EXAMPLE_COMMANDS.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
              <Btn autoFocus onClick={() => closePanel()}>
                Close
              </Btn>
            </>
          )}
        </>
      )}
      {!v.listening && !v.transcript && !v.error && (
        <>
          <p className="muted">Hold V (keyboard) or LT (controller) and speak.</p>
          <ul className="bullets">
            {EXAMPLE_COMMANDS.slice(0, 5).map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  );
}

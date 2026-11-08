'use client';

import { useEffect, useMemo, useState } from 'react';
import { Btn, Empty, Panel, Row, Sources, StatusBadge, copyText, openLink } from '../components';
import { openPanel, useStore } from '../store';
import { travelTo } from '../nav';
import { bus } from '@/game/bus';
import { audio } from '@/game/audio';
import { portraitUrl } from '@/game/textures';
import { npcById, NPCS, topicForText } from '@/npc/npcs';
import { askLocalModel, greeting, respond, type Reply, type ReplyAction } from '@/npc/brain';
import { routeVoiceCommand } from '@/lib/shared/voice-commands';
import { getRoomsForVoice } from './core';
import { runCommand } from './voice';

function runAction(a: ReplyAction): void {
  if (a.copy) {
    void copyText(a.copy, `“${a.copy}” copied`).then(() => {
      if (a.openAfterCopy) openLink(a.openAfterCopy);
    });
    return;
  }
  if (a.travel) return travelTo(a.travel);
  if (a.panel) return openPanel(a.panel, a.props);
}

export function NpcPanel({ npcId }: { npcId: string }) {
  const npc = npcById(npcId);
  const localModel = useStore((s) => s.settings.localModel.enabled);
  useStore((s) => s.session);
  const [topic, setTopic] = useState<string | null>(null);
  const [reply, setReply] = useState<Reply | null>(null);
  const [busy, setBusy] = useState(false);
  const [ask, setAsk] = useState('');
  const [model, setModel] = useState<{ q: string; text: string } | null>(null);
  const portrait = useMemo(() => (npc ? portraitUrl(npc.id, npc.look) : ''), [npc]);
  useEffect(() => {
    return () => bus.emit('ui:npc-done', npcId);
  }, [npcId]);
  if (!npc) return null;

  const run = async (topicId: string, query?: string) => {
    setTopic(topicId);
    setBusy(true);
    setModel(null);
    audio.sfx('talk');
    const r = await respond(npc, topicId, query);
    setReply(r);
    setBusy(false);
  };

  const onAsk = async () => {
    const text = ask.trim();
    if (!text) return;
    (document.activeElement as HTMLElement | null)?.blur();
    const cmd = routeVoiceCommand(text, { rooms: getRoomsForVoice(), npcs: NPCS.map((n) => ({ id: n.id, label: n.name, aliases: [n.role, n.role.replace(/^The /, '')] })) });
    const t = topicForText(npc, text);
    if (t) {
      await run(t, text);
      setAsk('');
      return;
    }
    if (cmd) {
      runCommand(cmd);
      return;
    }
    setReply({ lines: [`I’m not sure what you mean. I can help with: ${npc.topics.map((x) => x.label.toLowerCase()).join('; ')}.`], fromRecords: false });
  };

  const onModel = async () => {
    const q = ask.trim() || npc.topics.find((x) => x.id === topic)?.label || '';
    if (!q) return;
    setBusy(true);
    try {
      setModel({ q, text: await askLocalModel(npc, q, reply) });
    } catch (e) {
      setModel({ q, text: (e as Error).message || 'The local model could not be reached.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel title={npc.name} icon="💬" subtitle={npc.role} size="lg" tone={npc.id === 'inventor' ? 'lounge' : npc.id === 'scout' ? 'warroom' : 'default'}>
      <div className="npc-head">
        {portrait && <img className="portrait" src={portrait} alt="" width={96} height={96} />}
        <div>
          <p className="npc-say">“{greeting(npc)}”</p>
          <p className="muted small">
            {npc.job} <br />
            Where I look: {npc.sources}
          </p>
        </div>
      </div>
      <div className="topics">
        {npc.topics.map((t, i) => (
          <button key={t.id} data-nav {...(i === 0 ? { 'data-autofocus': '' } : {})} className={`topic ${topic === t.id ? 'active' : ''}`} onClick={() => void run(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      <form
        className="ask-form"
        onSubmit={(e) => {
          e.preventDefault();
          void onAsk();
        }}
      >
        <input data-nav value={ask} onChange={(e) => setAsk(e.target.value)} placeholder={`Ask ${npc.name}… (type or dictate)`} aria-label={`Ask ${npc.name}`} enterKeyHint="send" />
        <button className="btn" data-nav type="submit">
          Ask
        </button>
        {localModel && (
          <button className="btn btn-ghost" data-nav type="button" onClick={() => void onModel()} title="Uses Ollama on this computer">
            Local model
          </button>
        )}
      </form>
      {busy && <p className="muted">…</p>}
      {reply && !busy && (
        <div className="reply" aria-live="polite">
          <div className={`reply-tag ${reply.fromRecords ? 'records' : 'help'}`}>{reply.fromRecords ? 'From your records' : `${npc.name} says`}</div>
          {reply.lines.map((l, i) => (
            <p key={i}>{l}</p>
          ))}
          {reply.items && reply.items.length > 0 ? (
            <ul className="plain reply-items">
              {reply.items.map((it, i) => {
                const inner = (
                  <>
                    {it.status && <StatusBadge status={it.status} />} <strong>{it.label}</strong>
                    {it.sub && <span className="muted"> · {it.sub}</span>}
                  </>
                );
                if (it.href)
                  return (
                    <li key={i}>
                      <a className="reply-item" data-nav href={it.href} target="_blank" rel="noopener noreferrer">
                        {inner} <span className="ext" aria-hidden>↗</span>
                      </a>
                    </li>
                  );
                if (it.panel)
                  return (
                    <li key={i}>
                      <button className="reply-item" data-nav onClick={() => openPanel(it.panel!.type, it.panel!.props)}>
                        {inner}
                      </button>
                    </li>
                  );
                return (
                  <li key={i} className="reply-item static">
                    {inner}
                  </li>
                );
              })}
            </ul>
          ) : reply.fromRecords && reply.items ? (
            <Empty>Nothing to show.</Empty>
          ) : null}
          {reply.actions && reply.actions.length > 0 && (
            <Row>
              {reply.actions.map((a) =>
                a.href ? (
                  <Btn key={a.label} href={a.href} sameTab={a.sameTab} kind="primary">
                    {a.label}
                  </Btn>
                ) : (
                  <Btn key={a.label} onClick={() => runAction(a)} kind="primary">
                    {a.label}
                  </Btn>
                )
              )}
            </Row>
          )}
          <Sources sources={reply.sources} />
        </div>
      )}
      {model && !busy && (
        <div className="reply model">
          <div className="reply-tag model">Local model on this computer · not checked against your records</div>
          <p className="muted small">You asked: {model.q}</p>
          <p>{model.text}</p>
        </div>
      )}
    </Panel>
  );
}

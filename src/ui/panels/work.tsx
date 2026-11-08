'use client';

import { useMemo, useState } from 'react';
import { useApi } from '../api';
import { Btn, Empty, Gate, LoopRow, Panel, Row, Section, Sources, copyText, openLink } from '../components';
import { openPanel, useStore } from '../store';
import { travelTo } from '../nav';
import type { LanesResponse } from '../types';
import { THEMES } from '@/lib/shared/lanes';
import { isOpen } from '@/lib/shared/loops';
import type { Lane } from '@/lib/shared/types';

export function useLanes() {
  return useApi<LanesResponse>('/api/hq/lanes', 120_000);
}

export function gmailComposeUrl(to: string, subject: string, body: string, email?: string | null): string {
  const p = new URLSearchParams({ view: 'cm', fs: '1', tf: '1' });
  if (to) p.set('to', to);
  if (subject) p.set('su', subject);
  if (body) p.set('body', body);
  if (email) p.set('authuser', email);
  return `https://mail.google.com/mail/?${p.toString()}`;
}

/** Plain-text context for a lane, built only from its records. */
export function laneContext(l: Lane): string {
  const owed = l.loops.filter((i) => i.status === 'owed').slice(0, 8);
  const waiting = l.loops.filter((i) => i.status === 'waiting').slice(0, 8);
  const lines = [`${l.name}: where things stand`, ''];
  if (l.description) lines.push(l.description, '');
  if (l.recent.length) lines.push('Recent progress:', ...l.recent.map((r) => `- ${r}`), '');
  if (owed.length) lines.push('My next moves:', ...owed.map((i) => `- ${i.title}${i.due ? ` (${i.dueLabel ?? i.due})` : ''}`), '');
  if (waiting.length) lines.push('Waiting on others:', ...waiting.map((i) => `- ${i.who ? `${i.who}: ` : ''}${i.title}`), '');
  if (l.decisions.length) lines.push('Recent decisions:', ...l.decisions.map((d) => `- ${d.title}. ${d.why}`), '');
  return lines.join('\n').trim();
}

export function LanePanel({ laneId, tab: initial }: { laneId: string; tab?: string }) {
  const { data, error, loading, reload } = useLanes();
  const [tab, setTab] = useState(initial ?? 'overview');
  const room = useStore((s) => s.room?.id);
  const lane = data?.lanes.find((l) => l.id === laneId);
  const open = useMemo(() => lane?.loops.filter(isOpen) ?? [], [lane]);
  const dated = useMemo(() => (lane?.loops ?? []).filter((i) => i.due && isOpen(i)).sort((a, b) => (a.due ?? '').localeCompare(b.due ?? '')), [lane]);
  const waiting = useMemo(() => (lane?.loops ?? []).filter((i) => i.status === 'waiting'), [lane]);
  return (
    <Panel
      title={lane?.name ?? 'Lane'}
      icon="🏢"
      subtitle={lane ? `${THEMES[lane.theme]?.label ?? 'Room'}${lane.closed ? ' · lane closed' : ''}${lane.note ? ` · ${lane.note}` : ''}` : undefined}
      tabs={[
        { id: 'overview', label: 'Objectives' },
        { id: 'loops', label: 'Open loops', count: open.length },
        { id: 'dates', label: 'Dates', count: dated.length },
        { id: 'waiting', label: 'Waiting on', count: waiting.length },
        { id: 'progress', label: 'Progress' },
        { id: 'docs', label: 'Docs' },
        { id: 'links', label: 'Tools' },
      ]}
      tab={tab}
      onTab={setTab}
      size="lg"
      footer={
        <Row>
          {lane && (
            <Btn kind="primary" onClick={() => openPanel('handoff', { laneId: lane.id })}>
              Draft an update
            </Btn>
          )}
          {lane && room !== `lane:${lane.id}` && <Btn onClick={() => travelTo(`lane:${lane.id}`, 'fromWork')}>Go to this lane’s room</Btn>}
          {data && <Sources sources={data.sources} />}
        </Row>
      }
    >
      <Gate loading={loading && !data} error={error} onRetry={reload} what="Reading the lane registry">
        {!lane ? (
          <Empty>This lane isn’t in the current operating-system file anymore.</Empty>
        ) : tab === 'overview' ? (
          <>
            {lane.description && (
              <Section title="Where it stands (OS file)">
                <p>{lane.description}</p>
              </Section>
            )}
            {lane.allocation && (
              <Section title="This month’s allocation">
                <p>{lane.allocation}</p>
              </Section>
            )}
            {lane.schedule.length > 0 && (
              <Section title="When it gets time">
                <ul className="bullets">{lane.schedule.map((s) => <li key={s}>{s}</li>)}</ul>
              </Section>
            )}
            <Section title="Counts">
              <p className="muted">
                {lane.openCount} open · {lane.waitingCount} waiting on others · {lane.counts.idea ?? 0} ideas · {lane.counts.parked ?? 0} parked
              </p>
            </Section>
            {!lane.description && !lane.allocation && <Empty>The OS file has no business notes for this lane yet.</Empty>}
          </>
        ) : tab === 'loops' ? (
          open.length ? <ul className="plain loops">{open.map((it) => <LoopRow key={it.id} item={it} />)}</ul> : <Empty>No open loops filed under this lane.</Empty>
        ) : tab === 'dates' ? (
          dated.length ? <ul className="plain loops">{dated.map((it) => <LoopRow key={it.id} item={it} />)}</ul> : <Empty>No dated items.</Empty>
        ) : tab === 'waiting' ? (
          <>
            {lane.people.length > 0 && (
              <p>
                {lane.people.map((p) => (
                  <span key={p} className="chip">
                    {p}
                  </span>
                ))}
              </p>
            )}
            {waiting.length ? <ul className="plain loops">{waiting.map((it) => <LoopRow key={it.id} item={it} />)}</ul> : <Empty>Nobody owes you anything in this lane.</Empty>}
          </>
        ) : tab === 'progress' ? (
          <>
            <Section title="Moved in the latest checkout">{lane.recent.length ? <ul className="bullets">{lane.recent.map((r) => <li key={r}>{r}</li>)}</ul> : <Empty>Nothing logged for this lane in the latest checkout.</Empty>}</Section>
            {lane.decisions.length > 0 && (
              <Section title="Related decisions">
                <ul className="plain decisions">
                  {lane.decisions.map((d) => (
                    <li key={d.title}>
                      <strong>{d.title}.</strong> {d.why}
                    </li>
                  ))}
                </ul>
              </Section>
            )}
          </>
        ) : tab === 'docs' ? (
          <>
            <Section title="Where this lane lives in your records">
              {lane.sections.length ? (
                <ul className="bullets">
                  {lane.sections.map((s) => (
                    <li key={s}>Loops spine section: {s}</li>
                  ))}
                </ul>
              ) : (
                <Empty>No loops section matched this lane.</Empty>
              )}
            </Section>
            <Row>
              <Btn onClick={() => openPanel('loops', { laneId: lane.id })}>Loops for this lane</Btn>
              <Btn onClick={() => openPanel('search', { q: lane.name })}>Search Drive for “{lane.name}”</Btn>
            </Row>
          </>
        ) : (
          <ul className="plain links">
            {lane.links.map((l) => (
              <li key={l.url}>
                <Btn href={l.url}>{l.label}</Btn> <span className="muted">{l.kind === 'found' ? 'mentioned in your notes' : l.kind === 'tool' ? 'tool' : 'search'}</span>
              </li>
            ))}
          </ul>
        )}
      </Gate>
    </Panel>
  );
}

const KINDS = [
  { id: 'email', label: 'Email update' },
  { id: 'slack', label: 'Slack message' },
  { id: 'task', label: 'Task (Linear)' },
  { id: 'notes', label: 'Meeting notes' },
  { id: 'claude', label: 'Context for Claude Code' },
];

export function HandoffPanel({ laneId }: { laneId?: string }) {
  const { data, error, loading, reload } = useLanes();
  const email = useStore((s) => s.session?.email);
  const slackUrl = useStore((s) => s.session?.slackUrl);
  const [kind, setKind] = useState('email');
  const [pick, setPick] = useState(laneId ?? '');
  const lane = data?.lanes.find((l) => l.id === (pick || laneId));
  const base = lane ? laneContext(lane) : '';
  const [text, setText] = useState<string | null>(null);
  const body = text ?? base;
  const subject = lane ? `${lane.name} update` : 'Update';
  return (
    <Panel
      title="Draft and hand off"
      icon="✉️"
      subtitle="Built from your records. Edit or dictate below, then open the real tool to finish. Nothing is sent from here."
      tabs={KINDS.map((k) => ({ id: k.id, label: k.label }))}
      tab={kind}
      onTab={setKind}
      size="lg"
    >
      <Gate loading={loading && !data} error={error} onRetry={reload}>
        {data && (
          <>
            {!laneId && (
              <label className="field">
                <span>Lane</span>
                <select data-nav value={pick} onChange={(e) => { setPick(e.target.value); setText(null); }}>
                  <option value="">Choose a lane…</option>
                  {data.lanes.filter((l) => !l.personal).map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="field">
              <span>{kind === 'claude' ? 'Context' : 'Draft'}</span>
              <textarea data-nav data-autofocus rows={12} value={body} onChange={(e) => setText(e.target.value)} />
            </label>
            <Row>
              {kind === 'email' && (
                <Btn kind="primary" onClick={() => openLink(gmailComposeUrl('', subject, body, email), 'Gmail compose')}>
                  Open in Gmail to review and send
                </Btn>
              )}
              {kind === 'slack' && (
                <Btn
                  kind="primary"
                  onClick={async () => {
                    await copyText(body, 'Message copied');
                    openLink(slackUrl ?? 'https://app.slack.com/client', 'Slack');
                  }}
                >
                  Copy and open Slack
                </Btn>
              )}
              {kind === 'task' && (
                <Btn
                  kind="primary"
                  onClick={() => openLink(`https://linear.new?${new URLSearchParams({ title: subject, description: body }).toString()}`, 'a new Linear issue')}
                >
                  Open a new Linear issue with this
                </Btn>
              )}
              {kind === 'notes' && (
                <Btn
                  kind="primary"
                  onClick={async () => {
                    await copyText(body, 'Notes copied');
                    openLink('https://docs.new', 'a new Google Doc');
                  }}
                >
                  Copy and open a new Google Doc
                </Btn>
              )}
              {kind === 'claude' && (
                <Btn
                  kind="primary"
                  onClick={async () => {
                    await copyText(body, 'Context copied');
                    openLink('https://claude.ai/new', 'Claude');
                  }}
                >
                  Copy and open Claude
                </Btn>
              )}
              <Btn onClick={() => copyText(body)}>Copy</Btn>
              {text !== null && <Btn onClick={() => setText(null)}>Reset to records</Btn>}
            </Row>
            <p className="muted small">Opening a compose window is not sending. You review and send in the real app.</p>
          </>
        )}
      </Gate>
    </Panel>
  );
}

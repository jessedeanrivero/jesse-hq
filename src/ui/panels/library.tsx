'use client';

import { useMemo, useState } from 'react';
import { api, ApiFailure, useApi } from '../api';
import { Btn, Empty, ErrorBox, Gate, Loading, Md, Panel, Row, Section, StatusBadge, SourceChip, fmtDay, openLink } from '../components';
import { getState, openPanel, useStore } from '../store';
import { travelTo } from '../nav';
import { NPCS } from '@/npc/npcs';
import { listRooms } from '@/game/world';
import { getWorld } from '@/game/worldState';
import type { LoopStatus, ParsedDoc, SourceRef } from '@/lib/shared/types';

interface ArchiveResponse {
  kind: string;
  files: { id: string; name: string; date?: string; url: string; modifiedTime?: string; freshness: string }[];
  folder: { name: string; url: string } | null;
}

const KINDS = [
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'loops', label: 'Loops' },
  { id: 'os', label: 'OS files' },
];

export function ArchivePanel({ kind: k0 }: { kind?: string }) {
  const [kind, setKind] = useState(k0 ?? 'daily');
  const { data, error, loading, reload } = useApi<ArchiveResponse>(`/api/hq/archive?kind=${kind}`, 300_000);
  return (
    <Panel
      title="The archive"
      icon="📚"
      subtitle="Every record, newest first. Retired (VOID or superseded) files are left out."
      tabs={KINDS}
      tab={kind}
      onTab={setKind}
      footer={data?.folder && <Btn href={data.folder.url}>Open “{data.folder.name}” in Drive</Btn>}
    >
      <Gate loading={loading && !data} error={error} onRetry={reload} what="Pulling the shelf">
        {data?.files.length ? (
          <ul className="plain files">
            {data.files.map((f) => (
              <li key={f.id} className="file-row" data-secondary-target>
                <button data-nav className="file-open" onClick={() => openPanel('doc', { id: f.id, name: f.name })}>
                  <strong>{f.date ? fmtDay(f.date) : f.name}</strong> <span className="muted">{f.name}</span>
                </button>
                <a className="btn btn-ghost btn-sm" data-nav data-secondary href={f.url} target="_blank" rel="noopener noreferrer">
                  Drive ↗
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>No files of this kind yet.</Empty>
        )}
      </Gate>
    </Panel>
  );
}

const HIDDEN_FM = new Set(['tags', 'instrumentation_note', 'carried_note', 'audit_note', 'convention', 'role', 'file']);

export function DocPanel({ id, name }: { id: string; name?: string }) {
  const { data, error, loading, reload } = useApi<{ doc: ParsedDoc | null; source: SourceRef; note?: string }>(`/api/hq/doc?id=${encodeURIComponent(id)}`, 600_000);
  const doc = data?.doc;
  return (
    <Panel title={doc?.title ?? name ?? 'Document'} icon="📄" size="lg" footer={data?.source && <SourceChip source={data.source} label="Open the original in Drive" />}>
      <Gate loading={loading && !data} error={error} onRetry={reload} what="Opening the file">
        {!doc ? (
          <Empty>{data?.note ?? 'This file opens in Drive.'}</Empty>
        ) : (
          <>
            {Object.keys(doc.frontmatter).length > 0 && (
              <dl className="fm">
                {Object.entries(doc.frontmatter)
                  .filter(([k]) => !HIDDEN_FM.has(k))
                  .slice(0, 8)
                  .map(([k, v]) => (
                    <div key={k}>
                      <dt>{k.replace(/_/g, ' ')}</dt>
                      <dd>{Array.isArray(v) ? v.join(', ') : v}</dd>
                    </div>
                  ))}
              </dl>
            )}
            {doc.intro && <Md text={doc.intro} />}
            {doc.sections.map((s) => (
              <Section key={s.heading + s.level} title={s.heading}>
                <Md text={s.body} />
              </Section>
            ))}
          </>
        )}
      </Gate>
    </Panel>
  );
}

interface SearchResponse {
  q: string;
  files: { id: string; name: string; url: string; modifiedTime?: string; mimeType: string }[];
  loops: { id: string; title: string; status: LoopStatus; laneId?: string; section: string; who?: string; due?: string }[];
  lanes: { id: string; name: string }[];
  people: string[];
  loopsSource: SourceRef | null;
}

export function SearchPanel({ q: q0 }: { q?: string }) {
  const [q, setQ] = useState(q0 ?? '');
  const [ran, setRan] = useState<string | null>(null);
  const [res, setRes] = useState<SearchResponse | null>(null);
  const [err, setErr] = useState<ApiFailure | null>(null);
  const [busy, setBusy] = useState(false);
  const signedIn = useStore((s) => s.session?.signedIn);
  const local = useMemo(() => {
    const term = (ran ?? '').toLowerCase();
    if (term.length < 2) return { rooms: [], npcs: [] };
    const rooms = listRooms(getWorld()).filter((r) => [r.name, ...r.aliases].some((a) => a.toLowerCase().includes(term)));
    const npcs = NPCS.filter((n) => `${n.name} ${n.role} ${n.job}`.toLowerCase().includes(term));
    return { rooms, npcs };
  }, [ran]);
  const run = async (term = q) => {
    const t = term.trim();
    if (t.length < 2) return;
    setRan(t);
    setErr(null);
    if (!getState().session?.signedIn) {
      setRes(null);
      return;
    }
    setBusy(true);
    try {
      setRes(await api<SearchResponse>(`/api/hq/search?q=${encodeURIComponent(t)}`, { ttl: 120_000 }));
    } catch (e) {
      setErr(e instanceof ApiFailure ? e : null);
    } finally {
      setBusy(false);
    }
  };
  useMemo(() => {
    if (q0) void run(q0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <Panel title="Search" icon="🔎" subtitle="Rooms, coworkers, lanes, loops, people and your Drive. Results link to the originals.">
      <form
        className="search-form"
        onSubmit={(e) => {
          e.preventDefault();
          (document.activeElement as HTMLElement | null)?.blur();
          void run();
        }}
      >
        <input data-nav data-autofocus type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type or dictate, then Enter" aria-label="Search" enterKeyHint="search" />
        <button className="btn btn-primary" data-nav type="submit">
          Search
        </button>
      </form>
      {busy && <Loading what="Searching" />}
      {err && <ErrorBox error={err} />}
      {ran && (
        <>
          {(local.rooms.length > 0 || local.npcs.length > 0) && (
            <Section title="In the headquarters">
              <Row>
                {local.rooms.map((r) => (
                  <Btn key={r.id} small onClick={() => travelTo(r.id)}>
                    Go: {r.name}
                  </Btn>
                ))}
                {local.npcs.map((n) => (
                  <Btn key={n.id} small onClick={() => travelTo(n.roomId)}>
                    {n.name}, {n.role}
                  </Btn>
                ))}
              </Row>
            </Section>
          )}
          {!signedIn && (
            <p className="muted">
              Sign in with Google to search your Drive and loops. <Btn small href="/api/auth/login?return=/" sameTab>Sign in</Btn>
            </p>
          )}
          {res && (
            <>
              {res.lanes.length > 0 && (
                <Section title="Lanes">
                  <Row>
                    {res.lanes.map((l) => (
                      <Btn key={l.id} small onClick={() => openPanel('lane', { laneId: l.id })}>
                        {l.name}
                      </Btn>
                    ))}
                  </Row>
                </Section>
              )}
              {res.people.length > 0 && (
                <Section title="People you’re waiting on">
                  <p>
                    {res.people.map((p) => (
                      <span key={p} className="chip">
                        {p}
                      </span>
                    ))}
                  </p>
                </Section>
              )}
              {res.loops.length > 0 && (
                <Section title={`Loops (${res.loops.length})`}>
                  <ul className="plain loops">
                    {res.loops.map((l) => (
                      <li key={l.id} className="loop">
                        <div className="loop-head">
                          <StatusBadge status={l.status} /> <strong>{l.title}</strong>
                        </div>
                        <div className="muted">
                          {l.section}
                          {l.who ? ` · waiting on ${l.who}` : ''}
                        </div>
                      </li>
                    ))}
                  </ul>
                  {res.loopsSource && <SourceChip source={res.loopsSource} />}
                </Section>
              )}
              <Section title={`Drive (${res.files.length})`}>
                {res.files.length ? (
                  <ul className="plain files">
                    {res.files.map((f) => {
                      const readable = f.mimeType.startsWith('text/') || f.mimeType === 'application/vnd.google-apps.document' || /\.(md|txt)$/i.test(f.name);
                      return (
                        <li key={f.id} className="file-row" data-secondary-target>
                          <button data-nav className="file-open" onClick={() => (readable ? openPanel('doc', { id: f.id, name: f.name }) : openLink(f.url, f.name))}>
                            <strong>{f.name}</strong> <span className="muted">{f.modifiedTime ? fmtDay(f.modifiedTime) : ''}</span>
                          </button>
                          <a className="btn btn-ghost btn-sm" data-nav data-secondary href={f.url} target="_blank" rel="noopener noreferrer">
                            Drive ↗
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <Empty>No Drive files matched.</Empty>
                )}
              </Section>
            </>
          )}
        </>
      )}
    </Panel>
  );
}

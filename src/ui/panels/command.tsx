'use client';

import { useMemo, useState } from 'react';
import { useApi } from '../api';
import { Btn, Empty, Gate, LoopRow, Md, Panel, Row, Section, Sources, StatusBadge, fmtDay, fmtTime } from '../components';
import { openPanel, useStore } from '../store';
import { openLane, travelTo } from '../nav';
import type { CalendarResponse, LoopsResponse, Overview } from '../types';
import { greetingFor, relativeDay } from '@/lib/shared/dates';
import { THEMES as LANE_THEMES } from '@/lib/shared/lanes';
import type { CalendarEvent, LoopStatus, PartError } from '@/lib/shared/types';

export function useOverview() {
  return useApi<Overview>('/api/hq/overview', 120_000);
}

function PartErrors({ errors }: { errors?: PartError[] }) {
  if (!errors?.length) return null;
  return (
    <div className="card warn">
      <strong>Some sources didn’t load:</strong>
      <ul className="plain">
        {errors.map((e) => (
          <li key={e.part}>
            {e.part}: <span className="muted">{e.message}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function EventRow({ e, tz }: { e: CalendarEvent; tz: string }) {
  return (
    <li className="event">
      <span className="when">{e.allDay ? 'All day' : fmtTime(e.start, tz)}</span>
      <span className="what">
        <strong>{e.title}</strong>
        <span className="muted"> · {e.calendar}</span>
        {e.location && <span className="muted"> · {e.location}</span>}
      </span>
      <span className="row">
        {e.meetUrl && (
          <Btn href={e.meetUrl} small>
            Join
          </Btn>
        )}
        {e.url && (
          <Btn href={e.url} small>
            Open
          </Btn>
        )}
      </span>
    </li>
  );
}

export function BriefingPanel() {
  const { data, error, loading, reload } = useOverview();
  const first = useStore((s) => s.session?.firstName);
  const hour = new Date().getHours();
  const tz = data?.tz;
  const c = data?.checkout;
  return (
    <Panel title="Daily briefing" icon="🛰️" subtitle={data ? `${greetingFor(hour)}${first ? `, ${first}` : ''}. ${fmtDay(data.today)}.` : 'Command desk'} size="lg">
      <Gate loading={loading && !data} error={error} onRetry={reload} what="Reading your records">
        {data && (
          <>
            <PartErrors errors={data.errors} />
            <div className="grid2">
              <Section title="Today on the calendar" right={<Btn small onClick={() => openPanel('calendar')}>Week</Btn>}>
                {data.calendar ? (
                  data.calendar.today.length ? (
                    <ul className="plain events">{data.calendar.today.map((e) => <EventRow key={e.id + e.start} e={e} tz={tz!} />)}</ul>
                  ) : (
                    <Empty>Nothing on the calendar for the rest of today.</Empty>
                  )
                ) : (
                  <Empty>Calendar unavailable.</Empty>
                )}
              </Section>
              <Section title="From your latest checkout" right={c ? <span className="muted">{c.date}</span> : undefined}>
                {c ? (
                  <>
                    {c.aim && (
                      <p className="aim">
                        <span className="label">Aim</span> {c.aim}
                      </p>
                    )}
                    {c.nudge && (
                      <p className="nudge">
                        <span className="label">Nudge</span> {c.nudge}
                      </p>
                    )}
                    {c.priorities.length > 0 && (
                      <ol className="priorities">
                        {c.priorities.map((p) => (
                          <li key={p}>{p}</li>
                        ))}
                      </ol>
                    )}
                  </>
                ) : (
                  <Empty>No daily checkout found yet.</Empty>
                )}
              </Section>
            </div>
            <div className="grid2">
              <Section title="Due in the next three weeks" right={<Btn small onClick={() => openPanel('deadlines')}>All</Btn>}>
                {data.deadlines.length ? (
                  <ul className="plain dl">
                    {data.deadlines.slice(0, 6).map((d) => (
                      <li key={d.title + d.date}>
                        <span className="due">{relativeDay(d.date, data.today)}</span> {d.title}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <Empty>No dated items in the loops for the next three weeks.</Empty>
                )}
              </Section>
              <Section title="Decisions waiting on you" right={<Btn small onClick={() => openPanel('decisions')}>All</Btn>}>
                {data.loops?.decide.length ? (
                  <ul className="plain loops">{data.loops.decide.slice(0, 5).map((it) => <LoopRow key={it.id} item={it} />)}</ul>
                ) : (
                  <Empty>Nothing tagged as a decision right now.</Empty>
                )}
              </Section>
            </div>
            <Row>
              <Btn kind="primary" onClick={() => openPanel('checkout')} autoFocus>
                Full checkout
              </Btn>
              <Btn onClick={() => openPanel('loops')}>Open loops</Btn>
              <Btn onClick={() => openPanel('lanes')}>Lanes</Btn>
              <Btn onClick={() => openPanel('search')}>Search</Btn>
            </Row>
            <Sources sources={data.sources} />
          </>
        )}
      </Gate>
    </Panel>
  );
}

export function WallPanel() {
  const { data, error, loading, reload } = useOverview();
  const tile = (title: string, body: React.ReactNode, onClick: () => void, accent?: string) => (
    <button className="tile" data-nav onClick={onClick} style={accent ? ({ '--tile-accent': accent } as React.CSSProperties) : undefined}>
      <span className="tile-title">{title}</span>
      <span className="tile-body">{body}</span>
    </button>
  );
  return (
    <Panel title="Wall monitor" icon="🖥️" subtitle="Everything at a glance. Select a tile for detail." size="lg">
      <Gate loading={loading && !data} error={error} onRetry={reload} what="Reading your records">
        {data && (
          <>
            <PartErrors errors={data.errors} />
            <div className="tiles">
              {tile(
                'Today',
                <>
                  <b>{fmtDay(data.today)}</b>
                  <span>{data.calendar ? `${data.calendar.today.length} on the calendar` : 'Calendar unavailable'}</span>
                  {data.calendar?.today[0] && <span className="muted">Next: {data.calendar.today.find((e) => !e.allDay)?.title ?? data.calendar.today[0].title}</span>}
                </>,
                () => openPanel('calendar'),
                '#5fe3ff'
              )}
              {tile(
                'Latest checkout',
                data.checkout ? (
                  <>
                    <b>{data.checkout.date}</b>
                    <span className={`fresh fresh-${data.checkout.source.freshness}`}>{data.checkout.source.freshness}</span>
                    {data.checkout.aim && <span className="muted clamp">{data.checkout.aim}</span>}
                  </>
                ) : (
                  <span>None found</span>
                ),
                () => openPanel('checkout'),
                '#ffd166'
              )}
              {tile(
                'Open loops',
                data.loops ? (
                  <span className="counts">
                    {(['owed', 'waiting', 'scheduled', 'decide'] as LoopStatus[]).map((s) => (
                      <span key={s}>
                        <b>{data.loops!.counts[s] ?? 0}</b> <StatusBadge status={s} />
                      </span>
                    ))}
                  </span>
                ) : (
                  <span>Unavailable</span>
                ),
                () => openPanel('loops'),
                '#7dffb3'
              )}
              {tile(
                'Due soon',
                data.deadlines.length ? (
                  <ul className="plain mini">
                    {data.deadlines.slice(0, 4).map((d) => (
                      <li key={d.title + d.date}>
                        <span className="due">{relativeDay(d.date, data.today)}</span> {d.title}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span>Nothing dated</span>
                ),
                () => openPanel('deadlines'),
                '#ff8fab'
              )}
              {tile(
                'Decisions',
                <>
                  <b>{data.loops?.decide.length ?? 0} waiting</b>
                  {data.loops?.decide.slice(0, 2).map((d) => (
                    <span key={d.id} className="muted clamp">
                      {d.title}
                    </span>
                  ))}
                </>,
                () => openPanel('decisions'),
                '#b18cff'
              )}
              {tile(
                'Lane activity',
                <ul className="plain mini bars">
                  {data.lanes
                    .filter((l) => !l.personal)
                    .slice(0, 6)
                    .map((l) => (
                      <li key={l.id}>
                        <span className="bar-label">{l.name}</span>
                        <span className="bar" style={{ width: `${Math.min(100, l.openCount * 6 + 4)}%` }} />
                        <span className="muted">{l.openCount}</span>
                      </li>
                    ))}
                </ul>,
                () => openPanel('lanes'),
                '#f5b041'
              )}
              {tile(
                'Operating system',
                data.os ? (
                  <>
                    <b>Updated {data.os.source.date}</b>
                    {data.os.changeSummary && <span className="muted clamp">{data.os.changeSummary}</span>}
                  </>
                ) : (
                  <span>Unavailable</span>
                ),
                () => openPanel('os'),
                '#9ab6e0'
              )}
              {tile(
                'Recently closed',
                data.loops?.recentlyClosed.length ? (
                  <ul className="plain mini">
                    {data.loops.recentlyClosed.slice(0, 2).map((r) => (
                      <li key={r.label}>
                        <b>{r.label}</b> <span className="muted clamp">{r.items.slice(0, 3).join('; ')}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span>—</span>
                ),
                () => openPanel('loops', { tab: 'closed' }),
                '#69be28'
              )}
            </div>
            <Sources sources={data.sources} />
          </>
        )}
      </Gate>
    </Panel>
  );
}

export function CheckoutPanel() {
  const { data, error, loading, reload } = useApi<{ checkout: Overview['checkout'] & { coach?: string; syncNotes?: string; instrumentation?: string } }>('/api/hq/checkout', 120_000);
  const [tab, setTab] = useState('summary');
  const c = data?.checkout;
  return (
    <Panel
      title="Latest checkout"
      icon="🗒️"
      subtitle={c ? `${c.title ?? c.date} · ${c.source.freshness}` : undefined}
      tabs={[
        { id: 'summary', label: 'Summary' },
        { id: 'moved', label: 'What moved' },
        { id: 'loops', label: 'Open loops', count: c?.openLoops.length },
        { id: 'coach', label: 'Signal & coach' },
      ]}
      tab={tab}
      onTab={setTab}
      size="lg"
      footer={c && <Sources sources={[c.source]} />}
    >
      <Gate loading={loading && !data} error={error} onRetry={reload} what="Reading the latest checkout">
        {!c ? (
          <Empty>No daily checkout found yet.</Empty>
        ) : tab === 'summary' ? (
          <>
            {c.aim && (
              <p className="aim">
                <span className="label">The aim</span> {c.aim}
              </p>
            )}
            {c.nudge && (
              <p className="nudge">
                <span className="label">Nudge</span> {c.nudge}
              </p>
            )}
            <Section title="Priorities for next session">
              {c.priorities.length ? <ol className="priorities">{c.priorities.map((p) => <li key={p}>{p}</li>)}</ol> : <Empty>—</Empty>}
            </Section>
            <Section title="Decisions made">
              {c.decisions.length ? (
                <ul className="plain decisions">
                  {c.decisions.map((d) => (
                    <li key={d.title}>
                      <strong>{d.title}.</strong> <span>{d.why}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty>—</Empty>
              )}
            </Section>
          </>
        ) : tab === 'moved' ? (
          c.moved.length ? (
            c.moved.map((g) => (
              <Section key={g.lane} title={g.lane}>
                <ul className="bullets">
                  {g.items.map((it) => (
                    <li key={it}>{it}</li>
                  ))}
                </ul>
              </Section>
            ))
          ) : (
            <Empty>—</Empty>
          )
        ) : tab === 'loops' ? (
          <ul className="plain loops">{c.openLoops.map((it) => <LoopRow key={it.id} item={it} />)}</ul>
        ) : (
          <>
            {c.signal && (
              <Section title="Signal">
                <p>{c.signal}</p>
              </Section>
            )}
            {c.coach && (
              <Section title="Coach">
                <Md text={c.coach} />
              </Section>
            )}
          </>
        )}
      </Gate>
    </Panel>
  );
}

const LOOP_TABS: { id: string; label: string; statuses: LoopStatus[] }[] = [
  { id: 'owed', label: 'Your move', statuses: ['owed'] },
  { id: 'waiting', label: 'Their move', statuses: ['waiting'] },
  { id: 'scheduled', label: 'On the calendar', statuses: ['scheduled'] },
  { id: 'decide', label: 'Decide', statuses: ['decide'] },
  { id: 'active', label: 'In motion', statuses: ['active', 'open', 'watch'] },
  { id: 'parked', label: 'Parked & ideas', statuses: ['parked', 'idea'] },
  { id: 'closed', label: 'Closed', statuses: ['done', 'decided'] },
];

export function LoopsPanel({ tab: initialTab, laneId: initialLane }: { tab?: string; laneId?: string }) {
  const { data, error, loading, reload } = useApi<LoopsResponse>('/api/hq/loops', 120_000);
  const [tab, setTab] = useState(initialTab ?? 'owed');
  const [lane, setLane] = useState(initialLane ?? '');
  const [personal, setPersonal] = useState(false);
  const laneName = useMemo(() => Object.fromEntries((data?.lanes ?? []).map((l) => [l.id, l.name])), [data]);
  const items = useMemo(() => (data?.loops?.items ?? []).filter((i) => (personal || !i.sensitive) && (!lane || i.laneId === lane)), [data, lane, personal]);
  const def = LOOP_TABS.find((t) => t.id === tab) ?? LOOP_TABS[0];
  const shown = items.filter((i) => def.statuses.includes(i.status));
  return (
    <Panel
      title="Open loops"
      icon="📌"
      subtitle={data?.loops ? `Loops spine ${data.loops.source.date ?? ''} · waiting items are other people’s turns, not your backlog` : undefined}
      tabs={LOOP_TABS.map((t) => ({ id: t.id, label: t.label, count: items.filter((i) => t.statuses.includes(i.status)).length }))}
      tab={tab}
      onTab={setTab}
      size="lg"
      footer={data?.loops && <Sources sources={[data.loops.source]} />}
    >
      <Gate loading={loading && !data} error={error} onRetry={reload} what="Reading the loops spine">
        {data?.loops ? (
          <>
            <div className="row wrap filters">
              <label className="field inline">
                <span>Lane</span>
                <select data-nav value={lane} onChange={(e) => setLane(e.target.value)}>
                  <option value="">All lanes</option>
                  {data.lanes.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="check">
                <input type="checkbox" data-nav checked={personal} onChange={(e) => setPersonal(e.target.checked)} /> Show personal and money items
              </label>
            </div>
            {tab === 'closed' && !lane && (
              <Section title="Recently closed">
                {data.loops.recentlyClosed.map((r) => (
                  <p key={r.label}>
                    <strong>{r.label}</strong> {r.items.join('; ')}
                  </p>
                ))}
              </Section>
            )}
            {shown.length ? (
              <ul className="plain loops">{shown.map((it) => <LoopRow key={it.id} item={it} laneName={it.laneId ? laneName[it.laneId] : it.section} />)}</ul>
            ) : (
              <Empty>Nothing here.</Empty>
            )}
            {tab === 'closed' && data.loops.killed.length > 0 && (
              <Section title="Killed (do not re-add)">
                <p className="muted">{data.loops.killed.join(' · ')}</p>
              </Section>
            )}
          </>
        ) : (
          <Empty>No loops file found.</Empty>
        )}
      </Gate>
    </Panel>
  );
}

export function PrioritiesPanel() {
  const { data, error, loading, reload } = useOverview();
  return (
    <Panel title="Priorities" icon="🧭" subtitle="From the latest checkout and the loops spine’s next-up list">
      <Gate loading={loading && !data} error={error} onRetry={reload}>
        {data && (
          <>
            {data.checkout?.nudge && (
              <p className="nudge">
                <span className="label">Nudge</span> {data.checkout.nudge}
              </p>
            )}
            <Section title={`Priorities for next session${data.checkout ? ` (${data.checkout.date})` : ''}`}>
              {data.checkout?.priorities.length ? <ol className="priorities">{data.checkout.priorities.map((p) => <li key={p}>{p}</li>)}</ol> : <Empty>—</Empty>}
            </Section>
            <Section title="Next up (loops spine)">
              {data.loops?.next.length ? <ul className="plain loops">{data.loops.next.map((it) => <LoopRow key={it.id} item={it} />)}</ul> : <Empty>—</Empty>}
            </Section>
            <Sources sources={data.sources} />
          </>
        )}
      </Gate>
    </Panel>
  );
}

export function CalendarPanel() {
  const { data, error, loading, reload } = useApi<CalendarResponse>('/api/hq/calendar?days=7', 120_000);
  const tz = data?.tz;
  const byDay = useMemo(() => {
    const m = new Map<string, CalendarEvent[]>();
    for (const e of data?.events ?? []) {
      const day = e.allDay ? e.start.slice(0, 10) : new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date(e.start));
      m.set(day, [...(m.get(day) ?? []), e]);
    }
    return [...m.entries()];
  }, [data, tz]);
  return (
    <Panel
      title="Calendar"
      icon="📅"
      subtitle={data ? `${data.calendars} calendars · next 7 days${data.skipped ? ` · ${data.skipped} could not be read` : ''}` : 'Next 7 days'}
      footer={
        <Row>
          <Btn href="https://calendar.google.com" kind="primary">
            Open Google Calendar
          </Btn>
        </Row>
      }
    >
      <Gate loading={loading && !data} error={error} onRetry={reload} what="Reading your calendars">
        {byDay.length ? (
          byDay.map(([day, events]) => (
            <Section key={day} title={fmtDay(day)}>
              <ul className="plain events">{events.map((e) => <EventRow key={e.id + e.start} e={e} tz={tz!} />)}</ul>
            </Section>
          ))
        ) : (
          <Empty>Nothing on your calendars for the next 7 days.</Empty>
        )}
      </Gate>
    </Panel>
  );
}

export function DeadlinesPanel() {
  const { data, error, loading, reload } = useOverview();
  return (
    <Panel title="Deadlines" icon="⏰" subtitle="Dated items from the latest checkout and the loops spine, next three weeks">
      <Gate loading={loading && !data} error={error} onRetry={reload}>
        {data && (data.deadlines.length ? (
          <ul className="plain loops">
            {data.deadlines.map((d) => (
              <li key={d.title + d.date} className="loop">
                <div className="loop-head">
                  <span className="due">{relativeDay(d.date, data.today)}</span>
                  <strong>{d.title}</strong>
                  {d.status && <StatusBadge status={d.status} />}
                </div>
                <div className="muted">{d.label} · from the {d.origin === 'checkout' ? 'latest checkout' : 'loops spine'}</div>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>No dated open items in the next three weeks.</Empty>
        ))}
        {data && <Sources sources={data.sources} />}
      </Gate>
    </Panel>
  );
}

export function DecisionsPanel() {
  const { data, error, loading, reload } = useOverview();
  return (
    <Panel title="Decisions" icon="⚖️" subtitle="Items tagged as decisions waiting on you, plus the latest decisions made">
      <Gate loading={loading && !data} error={error} onRetry={reload}>
        {data && (
          <>
            <Section title="Waiting on you">
              {data.loops?.decide.length ? <ul className="plain loops">{data.loops.decide.map((it) => <LoopRow key={it.id} item={it} />)}</ul> : <Empty>Nothing tagged as a decision.</Empty>}
            </Section>
            <Section title={`Decided in the latest checkout${data.checkout ? ` (${data.checkout.date})` : ''}`}>
              {data.checkout?.decisions.length ? (
                <ul className="plain decisions">
                  {data.checkout.decisions.map((d) => (
                    <li key={d.title}>
                      <strong>{d.title}.</strong> {d.why}
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty>—</Empty>
              )}
            </Section>
            <Sources sources={data.sources} />
          </>
        )}
      </Gate>
    </Panel>
  );
}

export function LanesPanel() {
  const { data, error, loading, reload } = useOverview();
  const phone = useStore((s) => s.phoneActive);
  const phoneLanes = useStore((s) => s.settings.phoneLanes);
  return (
    <Panel title="Lanes" icon="🏙️" subtitle="Read from the current operating-system file. The Work District rebuilds when this changes.">
      <Gate loading={loading && !data} error={error} onRetry={reload}>
        {data && (
          <>
            <ul className="plain lanes">
              {data.lanes
                .filter((l) => !l.personal)
                .map((l) => {
                  const locked = phone && !phoneLanes.includes(l.id);
                  return (
                    <li key={l.id} className={`lane-row${l.closed ? ' closed' : ''}`}>
                      <div>
                        <strong>{l.name}</strong> <span className="muted">· {LANE_THEMES[l.theme]?.label ?? 'Room'}</span>
                        {l.closed && <span className="status status-done">Closed</span>}
                        <div className="muted">
                          {l.openCount} open · {l.waitingCount} waiting on others{l.recent ? ` · ${l.recent} moved in the latest checkout` : ''}
                        </div>
                      </div>
                      <span className="row">
                        <Btn small onClick={() => openLane(l.id)}>
                          Board
                        </Btn>
                        <Btn small kind="primary" disabled={locked} onClick={() => travelTo(`lane:${l.id}`, 'fromWork')} title={locked ? 'Laptop only' : undefined}>
                          Go there
                        </Btn>
                      </span>
                    </li>
                  );
                })}
            </ul>
            {data.os?.allocation.length ? (
              <Section title="This month’s allocation">
                <ul className="plain">
                  {data.os.allocation.map((a) => (
                    <li key={a.name}>
                      <strong>
                        {a.name} = {a.value}
                      </strong>{' '}
                      <span className="muted">{a.text}</span>
                    </li>
                  ))}
                </ul>
              </Section>
            ) : null}
            <Sources sources={data.sources} />
          </>
        )}
      </Gate>
    </Panel>
  );
}

export function OsPanel() {
  const { data, error, loading, reload } = useApi<{ os: import('@/lib/shared/types').OsDoc | null }>('/api/hq/os', 300_000);
  const os = data?.os;
  const [open, setOpen] = useState<string | null>(null);
  return (
    <Panel title="Operating system" icon="⚙️" subtitle={os ? `Current file: ${os.source.name}` : undefined} size="lg" footer={os && <Sources sources={[os.source]} />}>
      <Gate loading={loading && !data} error={error} onRetry={reload} what="Reading the operating-system file">
        {!os ? (
          <Empty>No operating-system file found.</Empty>
        ) : (
          <>
            {os.changeSummary && (
              <Section title="What changed">
                <p>{os.changeSummary}</p>
              </Section>
            )}
            <Section title="Lanes">
              <p>
                {os.lanes.map((l) => (
                  <span key={l.id} className={`chip${l.closed ? ' closed' : ''}`} title={l.note}>
                    {l.id}
                  </span>
                ))}
              </p>
            </Section>
            {os.weekPlan && (
              <Section title={os.weekPlan.title}>
                <ul className="bullets">{os.weekPlan.days.map((d) => <li key={d}>{d}</li>)}</ul>
              </Section>
            )}
            <Section title="All sections">
              {os.sections.map((s) => (
                <div key={s.heading} className="collapsible">
                  <button data-nav className="collapse-head" aria-expanded={open === s.heading} onClick={() => setOpen(open === s.heading ? null : s.heading)}>
                    {s.level > 2 ? '· ' : ''}
                    {s.heading}
                  </button>
                  {open === s.heading && <Md text={s.body} />}
                </div>
              ))}
            </Section>
          </>
        )}
      </Gate>
    </Panel>
  );
}

export function SourcesPanel() {
  const { data, error, loading, reload } = useOverview();
  return (
    <Panel title="Filing cabinet" icon="🗄️" subtitle="The original files behind what you see here. Read-only.">
      <Gate loading={loading && !data} error={error} onRetry={reload}>
        {data && (
          <>
            <ul className="plain">
              {data.sources.map((s) => (
                <li key={s.url} className="src-row">
                  <span>
                    <strong>{s.kind === 'daily' ? 'Latest checkout' : s.kind === 'loops' ? 'Loops spine' : s.kind === 'os' ? 'Operating system' : s.kind}</strong>{' '}
                    <span className="muted">
                      {s.name} · {s.freshness}
                    </span>
                  </span>
                  <Btn small href={s.url}>
                    Open in Drive
                  </Btn>
                </li>
              ))}
            </ul>
            <Row>
              <Btn onClick={() => openPanel('archive', { kind: 'daily' })}>Older checkouts</Btn>
              <Btn onClick={() => openPanel('archive', { kind: 'weekly' })}>Weekly rollups</Btn>
              <Btn onClick={() => openPanel('search')}>Search Drive</Btn>
            </Row>
          </>
        )}
      </Gate>
    </Panel>
  );
}

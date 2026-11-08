'use client';

import { useEffect, useMemo, useState } from 'react';
import { useApi } from '../api';
import { Btn, Empty, Gate, LoopRow, Panel, Row, Section, copyText, fmtDay } from '../components';
import { useStore } from '../store';
import type { LoopsResponse } from '../types';
import { isOpen } from '@/lib/shared/loops';

export interface WarRoomData {
  site: string;
  headline?: string;
  pages: { label: string; url: string; kind: 'sheet' | 'recap' | 'page'; season?: number; week?: number }[];
  leaderboard?: {
    season: number;
    currentWeek?: number;
    throughWeek?: number;
    lastUpdated?: string;
    standings: { name: string; total: number; rank: number; average?: number }[];
    nextGame?: { week: number; opponent?: string; date?: string; status?: string };
  };
  fetchedAt: string;
  errors: string[];
}

const FOOTBALL = /hawks|war room|seahawks|football|nfl|game sheet|scouting|pocket/i;
const REPO = 'https://github.com/jessedeanrivero/jessedeanrivero/tree/main/seahawks';

export function useWarRoom() {
  return useApi<WarRoomData>('/api/hq/warroom', 600_000);
}

export function WarRoomPanel({ tab: t0 }: { tab?: string }) {
  const [tab, setTab] = useState(t0 ?? 'site');
  const wr = useWarRoom();
  const site = useStore((s) => s.session?.warroomUrl) ?? 'https://www.hawkswarroom.com';
  const signedIn = useStore((s) => s.session?.signedIn);
  const loops = useApi<LoopsResponse>(tab === 'planning' && signedIn ? '/api/hq/loops' : null, 120_000);
  const [frameState, setFrameState] = useState<'loading' | 'loaded' | 'slow'>('loading');
  useEffect(() => {
    if (tab !== 'site') return;
    setFrameState('loading');
    const t = window.setTimeout(() => setFrameState((s) => (s === 'loading' ? 'slow' : s)), 5000);
    return () => window.clearTimeout(t);
  }, [tab]);
  const planning = useMemo(() => (loops.data?.loops?.items ?? []).filter((i) => !i.sensitive && isOpen(i) && FOOTBALL.test(`${i.title} ${i.text} ${i.section}`)), [loops.data]);
  const sheets = (wr.data?.pages ?? []).filter((p) => p.kind !== 'page');
  const latestSheet = sheets.find((p) => p.kind === 'sheet');
  const latestRecap = sheets.find((p) => p.kind === 'recap');
  return (
    <Panel
      title="Hawks War Room"
      icon="🏈"
      tone="warroom"
      subtitle={wr.data?.headline ?? 'hawkswarroom.com'}
      tabs={[
        { id: 'site', label: 'Big screen' },
        { id: 'games', label: 'Game sheets' },
        { id: 'leaderboard', label: 'Leaderboard' },
        { id: 'planning', label: 'Planning' },
        { id: 'dev', label: 'Dev' },
      ]}
      tab={tab}
      onTab={setTab}
      size="lg"
      footer={
        <Row>
          <Btn href={site} kind="primary">
            Open hawkswarroom.com
          </Btn>
          {latestSheet && <Btn href={latestSheet.url}>{latestSheet.label}</Btn>}
        </Row>
      }
    >
      {tab === 'site' && (
        <div className="frame-wrap">
          <iframe
            src={site}
            title="Hawks War Room"
            className="site-frame"
            onLoad={() => setFrameState('loaded')}
            referrerPolicy="no-referrer"
            sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
          />
          {frameState !== 'loaded' && (
            <p className="muted small">
              {frameState === 'slow' ? 'If the site doesn’t show here, the site may block embedding. Open it in a new tab with the button below.' : 'Loading the site…'}
            </p>
          )}
        </div>
      )}
      {tab === 'games' && (
        <Gate loading={wr.loading && !wr.data} error={wr.error} onRetry={wr.reload} what="Reading the site">
          {wr.data && (
            <>
              {wr.data.errors.length > 0 && <p className="muted small">Couldn’t read: {wr.data.errors.join(', ')}.</p>}
              {latestRecap && (
                <p>
                  Latest recap: <Btn small href={latestRecap.url}>{latestRecap.label}</Btn>
                </p>
              )}
              {sheets.length ? (
                <ul className="plain links">
                  {sheets.map((p) => (
                    <li key={p.url}>
                      <Btn href={p.url}>{p.label}</Btn>
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty>No game pages found on the site.</Empty>
              )}
              <Row>
                {(wr.data.pages ?? [])
                  .filter((p) => p.kind === 'page')
                  .map((p) => (
                    <Btn key={p.url} href={p.url}>
                      {p.label}
                    </Btn>
                  ))}
              </Row>
              <p className="muted small">Read from the site’s sitemap and home page {fmtDay(wr.data.fetchedAt)}.</p>
            </>
          )}
        </Gate>
      )}
      {tab === 'leaderboard' && (
        <Gate loading={wr.loading && !wr.data} error={wr.error} onRetry={wr.reload}>
          {wr.data?.leaderboard ? (
            <>
              {wr.data.leaderboard.nextGame && (
                <p className="aim">
                  <span className="label">Next</span> Week {wr.data.leaderboard.nextGame.week}
                  {wr.data.leaderboard.nextGame.opponent ? ` vs ${wr.data.leaderboard.nextGame.opponent}` : ''}
                  {wr.data.leaderboard.nextGame.date ? ` · ${wr.data.leaderboard.nextGame.date}` : ''}
                </p>
              )}
              <table className="table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Name</th>
                    <th>Total</th>
                    <th>Avg</th>
                  </tr>
                </thead>
                <tbody>
                  {wr.data.leaderboard.standings.map((s) => (
                    <tr key={s.name}>
                      <td>{s.rank}</td>
                      <td>{s.name}</td>
                      <td>{s.total}</td>
                      <td>{s.average !== undefined ? s.average.toFixed(1) : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="muted small">
                From the site’s {wr.data.leaderboard.season} leaderboard file{wr.data.leaderboard.throughWeek ? `, through week ${wr.data.leaderboard.throughWeek}` : ''}
                {wr.data.leaderboard.lastUpdated ? ` · updated ${wr.data.leaderboard.lastUpdated}` : ''}.
              </p>
            </>
          ) : (
            <Empty>The site has no leaderboard file this season.</Empty>
          )}
        </Gate>
      )}
      {tab === 'planning' &&
        (!signedIn ? (
          <Empty>Planning notes come from your loops spine. Sign in with Google to see them.</Empty>
        ) : (
          <Gate loading={loops.loading && !loops.data} error={loops.error} onRetry={loops.reload}>
            {planning.length ? <ul className="plain loops">{planning.map((it) => <LoopRow key={it.id} item={it} />)}</ul> : <Empty>No loops mention the site right now.</Empty>}
          </Gate>
        ))}
      {tab === 'dev' && (
        <>
          <Section title="Where the code lives">
            <Row>
              <Btn href={REPO}>Source folder on GitHub</Btn>
              <Btn href="https://vercel.com/dashboard">Vercel dashboard</Btn>
            </Row>
          </Section>
          <Section title="Hand off a task">
            <p className="muted">Copies a short brief for your coding agent (Codex or Claude Code) and you take it from there.</p>
            <Row>
              <Btn
                onClick={() =>
                  copyText(
                    `Hawks War Room (hawkswarroom.com). Source: ${REPO}. Static pages under seahawks/, weekly sheets in g/, data in data/. Task: `,
                    'Brief copied'
                  )
                }
              >
                Copy a task brief
              </Btn>
            </Row>
          </Section>
        </>
      )}
    </Panel>
  );
}

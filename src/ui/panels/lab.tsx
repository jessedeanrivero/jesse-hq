'use client';

import { useApi } from '../api';
import { Btn, Empty, Gate, Panel, Row, Section, copyText, fmtDay, fmtTime, openLink } from '../components';

interface AutomationsResponse {
  today: string;
  outputs: {
    role: string;
    folder: { name: string; url: string };
    newest: { name: string; url?: string; modifiedTime?: string; ageDays?: number } | null;
    filesLast7Days: number;
  }[];
}

const ROLE_LABEL: Record<string, string> = {
  daily: 'Daily checkout',
  loops: 'Loops spine refresh',
  weekly: 'Weekly rollup',
  monthly: 'Monthly wrap',
  yearly: 'Yearly rollup',
  os: 'Operating-system updates',
  texts: 'Message export',
};

const HANDOFFS = [
  { label: 'Run the daily checkout', prompt: 'run my checkout' },
  { label: 'Weekly rollup', prompt: 'end week' },
  { label: 'Monthly wrap', prompt: 'monthly wrap' },
];

function ageText(d?: number): string {
  if (d === undefined) return '';
  if (d <= 0) return 'today';
  if (d === 1) return 'yesterday';
  return `${d} days ago`;
}

export function AutomationsPanel({ focus: f }: { focus?: string }) {
  const { data, error, loading, reload } = useApi<AutomationsResponse>('/api/hq/automations', 120_000);
  const outputs = (data?.outputs ?? []).slice().sort((a, b) => (a.role === f ? -1 : b.role === f ? 1 : 0));
  return (
    <Panel title="Workflow outputs" icon="🤖" subtitle="What your workflows actually wrote to Drive. This reports files it can see; it never claims a run happened." size="lg">
      <Gate loading={loading && !data} error={error} onRetry={reload} what="Checking your output folders">
        {outputs.length ? (
          <ul className="plain outputs">
            {outputs.map((o) => {
              const age = o.newest?.ageDays;
              const tone = age === undefined ? 'unknown' : age <= 1 ? 'fresh' : age <= 3 ? 'recent' : 'stale';
              return (
                <li key={o.folder.url} className={`output fresh-${tone}`}>
                  <div>
                    <strong>{ROLE_LABEL[o.role] ?? o.folder.name.replace(/^\d+\s*[—-]\s*/, '')}</strong> <span className="muted">· {o.folder.name}</span>
                    <div className="muted">
                      {o.newest ? (
                        <>
                          Last output seen: <b>{o.newest.name}</b> · {o.newest.modifiedTime ? `${fmtDay(o.newest.modifiedTime)} ${fmtTime(o.newest.modifiedTime)}` : ''} ({ageText(age)}) · {o.filesLast7Days} files written in the last 7 days
                        </>
                      ) : (
                        'No files found.'
                      )}
                    </div>
                  </div>
                  <span className="row">
                    {o.newest?.url && (
                      <Btn small href={o.newest.url}>
                        Open
                      </Btn>
                    )}
                    <Btn small href={o.folder.url}>
                      Folder
                    </Btn>
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <Empty>No output folders found.</Empty>
        )}
        <Section title="Start a workflow">
          <p className="muted">These run in Claude, not here. The button copies the trigger phrase and opens Claude; you start it there.</p>
          <Row>
            {HANDOFFS.map((h) => (
              <Btn
                key={h.label}
                onClick={async () => {
                  await copyText(h.prompt, `“${h.prompt}” copied`);
                  openLink('https://claude.ai/new', 'Claude');
                }}
              >
                {h.label}
              </Btn>
            ))}
          </Row>
        </Section>
        <Section title="What this lab can’t see">
          <ul className="bullets">
            <li>Scheduled-task logs and run history in Claude. Only the files those runs leave in Drive.</li>
            <li>Anything on your Macs that never reaches Drive.</li>
            <li>The contents of message exports. Only that an export happened.</li>
          </ul>
        </Section>
      </Gate>
    </Panel>
  );
}

'use client';

import { useMemo, useState } from 'react';
import { useApi } from '../api';
import { Btn, Empty, ErrorBox, Gate, LoopRow, Panel, Row, Section, copyText, fmtDay, fmtTime, openLink } from '../components';
import { openPanel, useStore } from '../store';
import type { GmailResponse, SlimLoop } from '../types';
import { useOverview } from './command';
import { gmailComposeUrl } from './work';

export function ComposePanel({ to: to0 = '', subject: su0 = '', body: b0 = '' }: { to?: string; subject?: string; body?: string }) {
  const email = useStore((s) => s.session?.email);
  const [to, setTo] = useState(to0);
  const [subject, setSubject] = useState(su0);
  const [body, setBody] = useState(b0);
  const url = gmailComposeUrl(to, subject, body, email);
  return (
    <Panel title="Write an email" icon="✉️" subtitle="Dictate or type. Gmail opens with this filled in; you review and press Send there.">
      <label className="field">
        <span>To</span>
        <input data-nav type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="name@example.com" autoComplete="off" />
      </label>
      <label className="field">
        <span>Subject</span>
        <input data-nav value={subject} onChange={(e) => setSubject(e.target.value)} />
      </label>
      <label className="field">
        <span>Message</span>
        <textarea data-nav data-autofocus rows={10} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Select this box and use your dictation shortcut, or type." />
      </label>
      <Row>
        <Btn
          kind="primary"
          onClick={async () => {
            if (body.length > 1800) await copyText(body, 'Long message also copied');
            openLink(url, 'Gmail compose');
          }}
        >
          Open in Gmail
        </Btn>
        <Btn href={`mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`}>Use mail app</Btn>
        <Btn onClick={() => copyText(`${subject ? `Subject: ${subject}\n\n` : ''}${body}`)}>Copy</Btn>
      </Row>
      <p className="muted small">Nothing is sent from Jesse HQ. Opening a compose window is not sending.</p>
    </Panel>
  );
}

export function CommsPanel({ tab: t0 }: { tab?: string }) {
  const [tab, setTab] = useState(t0 ?? 'inbox');
  const session = useStore((s) => s.session);
  const gmail = useApi<GmailResponse>(tab === 'inbox' ? '/api/hq/gmail' : null, 90_000);
  const { data: ov, error: ovErr, loading: ovLoading, reload } = useOverview();
  const [slack, setSlack] = useState('');
  const waitingByPerson = useMemo(() => {
    const m = new Map<string, SlimLoop[]>();
    for (const it of ov?.loops?.waiting ?? []) {
      const who = it.who ?? 'Someone';
      m.set(who, [...(m.get(who) ?? []), it]);
    }
    return [...m.entries()];
  }, [ov]);
  return (
    <Panel
      title="Communications"
      icon="📡"
      tabs={[
        { id: 'inbox', label: 'Inbox', count: gmail.data?.unread },
        { id: 'followups', label: 'Follow-ups', count: ov?.loops?.waiting.length },
        { id: 'slack', label: 'Slack' },
        { id: 'tools', label: 'Open apps' },
      ]}
      tab={tab}
      onTab={setTab}
      size="lg"
    >
      {tab === 'inbox' && (
        <>
          {gmail.error ? (
            <>
              <ErrorBox error={gmail.error} onRetry={gmail.reload} />
              <Row>
                <Btn href="https://mail.google.com/mail/u/0/#inbox" kind="primary">
                  Open Gmail
                </Btn>
              </Row>
            </>
          ) : gmail.loading && !gmail.data ? (
            <Gate loading error={null}>
              {null}
            </Gate>
          ) : gmail.data?.disabled ? (
            <Empty>Inbox previews are switched off for this deployment. Gmail still opens below.</Empty>
          ) : (
            <>
              <p className="muted">
                {gmail.data?.unread ?? 0} unread in the inbox · showing recent threads from other people (read-only: sender, subject and Gmail’s own snippet)
              </p>
              {gmail.data?.threads.length ? (
                <ul className="plain mail">
                  {gmail.data.threads.map((t) => (
                    <li key={t.id} className={t.unread ? 'mail-row unread' : 'mail-row'}>
                      <div className="mail-head">
                        <strong>{t.from}</strong>
                        <span className="muted">{t.date ? `${fmtDay(t.date)} ${fmtTime(t.date)}` : ''}</span>
                      </div>
                      <div className="mail-subject">{t.subject}</div>
                      <div className="muted clamp">{t.snippet}</div>
                      <Row>
                        <Btn small href={t.url}>
                          Open thread
                        </Btn>
                        <Btn small onClick={() => openPanel('compose', { to: t.fromEmail ?? '', subject: t.subject.startsWith('Re:') ? t.subject : `Re: ${t.subject}` })}>
                          Draft a reply
                        </Btn>
                      </Row>
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty>No recent threads from other people.</Empty>
              )}
              <Row>
                <Btn href="https://mail.google.com/mail/u/0/#inbox" kind="primary">
                  Open Gmail
                </Btn>
                <Btn onClick={() => openPanel('compose')}>Write a new email</Btn>
              </Row>
            </>
          )}
        </>
      )}
      {tab === 'followups' && (
        <Gate loading={ovLoading && !ov} error={ovErr} onRetry={reload}>
          {waitingByPerson.length ? (
            waitingByPerson.map(([who, items]) => (
              <Section key={who} title={who}>
                <ul className="plain loops">{items.map((it) => <LoopRow key={it.id} item={it} />)}</ul>
                <Row>
                  <Btn small onClick={() => openPanel('compose', { subject: `Following up: ${items[0].title}`, body: `Hi ${who.split(' ')[0]},\n\nChecking in on ${items[0].title.toLowerCase()}.\n\n` })}>
                    Draft a follow-up email
                  </Btn>
                  <Btn small onClick={() => copyText(`Checking in on ${items[0].title.toLowerCase()}.`, 'Follow-up copied')}>
                    Copy a nudge for text or Slack
                  </Btn>
                </Row>
              </Section>
            ))
          ) : (
            <Empty>Nobody is holding anything for you right now.</Empty>
          )}
        </Gate>
      )}
      {tab === 'slack' && (
        <>
          <label className="field">
            <span>Message</span>
            <textarea data-nav data-autofocus rows={8} value={slack} onChange={(e) => setSlack(e.target.value)} placeholder="Dictate or type, then copy it into Slack." />
          </label>
          <Row>
            <Btn
              kind="primary"
              onClick={async () => {
                if (slack) await copyText(slack, 'Message copied');
                openLink(session?.slackUrl ?? 'https://app.slack.com/client', 'Slack');
              }}
            >
              Copy and open Slack
            </Btn>
            <Btn href="slack://open">Open the Slack app</Btn>
          </Row>
          <p className="muted small">Slack has no free way to pre-fill a message by link, so the text goes to your clipboard and Slack opens. Paste and send there.</p>
        </>
      )}
      {tab === 'tools' && (
        <div className="tiles small">
          <Btn href="https://mail.google.com/mail/u/0/#inbox">Gmail</Btn>
          <Btn href={session?.slackUrl ?? 'https://app.slack.com/client'}>Slack</Btn>
          <Btn href="https://calendar.google.com">Google Calendar</Btn>
          <Btn href="https://drive.google.com">Google Drive</Btn>
          <Btn href="https://meet.google.com">Google Meet</Btn>
        </div>
      )}
    </Panel>
  );
}

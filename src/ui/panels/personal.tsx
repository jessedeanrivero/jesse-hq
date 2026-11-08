'use client';

import { useState, type ReactNode } from 'react';
import { useApi } from '../api';
import { Btn, Empty, Gate, LoopRow, Md, Panel, Row, SignInCard, SourceChip } from '../components';
import { closePanel, useStore } from '../store';
import { travelTo } from '../nav';
import type { LoopItem, ParsedDoc, PartError, SourceRef } from '@/lib/shared/types';

interface PersonalResponse {
  identity: { doc: ParsedDoc; source: SourceRef } | null;
  health: { doc: ParsedDoc; source: SourceRef } | null;
  os: { goals: string[]; lifeDirection: string[]; energy: string[]; health: string[]; source: SourceRef } | null;
  checkout: {
    date: string;
    energy?: string;
    health?: string;
    lineFlag?: boolean;
    priceSpend?: string;
    avoidance?: string;
    reading?: string;
    items: LoopItem[];
    moved: { lane: string; items: string[] }[];
    source: SourceRef;
  } | null;
  loops: { items: LoopItem[]; source: SourceRef | null };
  errors: PartError[];
}

/** Each private section stays covered until it is deliberately revealed. */
function Covered({ title, source, children, empty }: { title: string; source?: SourceRef | null; children: ReactNode; empty?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <section className={`covered ${open ? 'is-open' : ''}`}>
      <div className="sec-head">
        <h3>{title}</h3>
        <Btn small onClick={() => setOpen((o) => !o)}>
          {open ? 'Cover' : 'Reveal'}
        </Btn>
      </div>
      {open ? (
        <div className="covered-body">
          {empty ? <Empty>Nothing written here yet.</Empty> : children}
          {source && <SourceChip source={source} label="Original file" />}
        </div>
      ) : (
        <div className="covered-veil" aria-hidden>
          ▒▒▒▒▒▒▒▒ ▒▒▒▒ ▒▒▒▒▒▒▒ ▒▒▒▒▒
        </div>
      )}
    </section>
  );
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="bullets">
      {items.map((t, i) => (
        <li key={i}>{t}</li>
      ))}
    </ul>
  );
}

function DocBody({ doc }: { doc: ParsedDoc }) {
  return (
    <>
      {doc.intro && <Md text={doc.intro} />}
      {doc.sections.map((s) => (
        <div key={s.heading + s.level}>
          <h4>{s.heading}</h4>
          <Md text={s.body} />
        </div>
      ))}
    </>
  );
}

export function PersonalPanel({ tab: t0 }: { tab?: string }) {
  const [tab, setTab] = useState(t0 ?? 'planning');
  const signedIn = useStore((s) => s.session?.signedIn);
  const { data, error, loading, reload } = useApi<PersonalResponse>(signedIn ? '/api/hq/personal' : null, 120_000);
  return (
    <Panel
      title="Personal Space"
      icon="🔒"
      tone="personal"
      subtitle="Private. Everything starts covered; reveal one section at a time."
      tabs={[
        { id: 'planning', label: 'Planning' },
        { id: 'routines', label: 'Routines' },
        { id: 'reflection', label: 'Reflection' },
      ]}
      tab={tab}
      onTab={setTab}
      size="lg"
    >
      {!signedIn ? (
        <SignInCard compact />
      ) : (
        <Gate loading={loading && !data} error={error} onRetry={reload} what="Unlocking">
          {data?.errors?.length ? <p className="muted small">Couldn’t read: {data.errors.map((e) => e.part).join(', ')}.</p> : null}
          {data && tab === 'planning' && (
            <>
              <Covered title="Goals" source={data.os?.source} empty={!data.os?.goals.length}>
                <Bullets items={data.os?.goals ?? []} />
              </Covered>
              <Covered title="Life direction" source={data.os?.source} empty={!data.os?.lifeDirection.length}>
                <Bullets items={data.os?.lifeDirection ?? []} />
              </Covered>
              <Covered title="Personal and money loops" source={data.loops.source} empty={!data.loops.items.length}>
                <ul className="plain loops">
                  {data.loops.items.slice(0, 40).map((it) => (
                    <LoopRow key={it.id} item={it} />
                  ))}
                </ul>
              </Covered>
              {data.checkout && (
                <Covered title={`Moved today (${data.checkout.date})`} source={data.checkout.source} empty={!data.checkout.moved.length}>
                  {data.checkout.moved.map((m) => (
                    <div key={m.lane}>
                      <h4>{m.lane}</h4>
                      <Bullets items={m.items} />
                    </div>
                  ))}
                </Covered>
              )}
            </>
          )}
          {data && tab === 'routines' && (
            <>
              <Covered title="Energy" source={data.os?.source} empty={!data.os?.energy.length && !data.checkout?.energy}>
                {data.checkout?.energy && (
                  <p>
                    <span className="label">Latest checkout</span> {data.checkout.energy}
                  </p>
                )}
                <Bullets items={data.os?.energy ?? []} />
              </Covered>
              <Covered title="Health notes" source={data.health?.source ?? data.os?.source} empty={!data.health && !data.os?.health.length && !data.checkout?.health}>
                {data.checkout?.health && (
                  <p>
                    <span className="label">Latest checkout</span> {data.checkout.health}
                  </p>
                )}
                <Bullets items={data.os?.health ?? []} />
                {data.health && <DocBody doc={data.health.doc} />}
              </Covered>
            </>
          )}
          {data && tab === 'reflection' && (
            <>
              {data.checkout && (
                <Covered title={`Price and line (${data.checkout.date})`} source={data.checkout.source} empty={!data.checkout.priceSpend && !data.checkout.avoidance && data.checkout.lineFlag === undefined}>
                  {data.checkout.lineFlag !== undefined && (
                    <p>
                      <span className="label">Line</span> {data.checkout.lineFlag ? 'Flagged in the checkout' : 'Not flagged'}
                    </p>
                  )}
                  {data.checkout.priceSpend && (
                    <p>
                      <span className="label">Price</span> {data.checkout.priceSpend}
                    </p>
                  )}
                  {data.checkout.avoidance && (
                    <p>
                      <span className="label">Avoidance</span> {data.checkout.avoidance}
                    </p>
                  )}
                  {data.checkout.reading && (
                    <p>
                      <span className="label">Reading</span> {data.checkout.reading}
                    </p>
                  )}
                </Covered>
              )}
              <Covered title="Identity file" source={data.identity?.source} empty={!data.identity}>
                {data.identity && <DocBody doc={data.identity.doc} />}
              </Covered>
            </>
          )}
        </Gate>
      )}
    </Panel>
  );
}

export function ConfirmPersonalPanel() {
  return (
    <Panel title="Personal Space" icon="🚪" tone="personal" size="sm" subtitle="This door leads to your private notes.">
      <p>Inside are your goals, routines and reflections. Each section stays covered until you reveal it, so check who can see your screen first.</p>
      <Row>
        <Btn kind="primary" autoFocus onClick={() => travelTo('personal')}>
          Enter
        </Btn>
        <Btn onClick={() => closePanel()}>Not now</Btn>
      </Row>
    </Panel>
  );
}

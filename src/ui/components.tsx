'use client';

import { Fragment, useEffect, type ReactNode } from 'react';
import { ApiFailure } from './api';
import { closePanel, notify, useStore } from './store';
import { focus, isTextField } from './input/focus';
import { inputState } from '@/game/bus';
import { audio } from '@/game/audio';
import { STATUS_LABEL } from '@/lib/shared/loops';
import type { LoopItem, LoopStatus, SourceRef } from '@/lib/shared/types';

export type GlyphName = 'A' | 'B' | 'X' | 'Y' | 'LB' | 'RB' | 'VIEW' | 'MENU' | 'LT' | 'RT';

const KEYS: Record<GlyphName, string> = { A: 'E', B: 'Esc', X: 'F', Y: '/', LB: '[', RB: ']', VIEW: 'M', MENU: 'Tab', LT: 'V', RT: 'Shift' };
const PAD: Record<GlyphName, string> = { A: 'A', B: 'B', X: 'X', Y: 'Y', LB: 'LB', RB: 'RB', VIEW: '⧉', MENU: '≡', LT: 'LT', RT: 'RT' };

export function Glyph({ b }: { b: GlyphName }) {
  const device = useStore((s) => s.device);
  if (device === 'touch') return null;
  if (device === 'gamepad') return <span className={`glyph pad pad-${b}`} aria-label={`${b} button`}>{PAD[b]}</span>;
  return <kbd className="glyph key">{KEYS[b]}</kbd>;
}

export function openLink(url: string, label?: string): void {
  const w = window.open(url, '_blank', 'noopener,noreferrer');
  if (w) w.opener = null;
  notify(label ? `Opened ${label} in a new tab` : 'Opened in a new tab');
}

export async function copyText(text: string, what = 'Copied'): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    notify(`${what} to the clipboard`, 'ok');
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    notify(ok ? `${what} to the clipboard` : 'Copy failed. Select the text and copy it manually.', ok ? 'ok' : 'warn');
    return ok;
  }
}

export interface TabDef {
  id: string;
  label: string;
  count?: number;
}

export function Panel({
  title,
  icon,
  subtitle,
  tabs,
  tab,
  onTab,
  children,
  footer,
  size = 'md',
  tone,
}: {
  title: string;
  icon?: string;
  subtitle?: ReactNode;
  tabs?: TabDef[];
  tab?: string;
  onTab?: (id: string) => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  tone?: 'default' | 'lounge' | 'personal' | 'warroom';
}) {
  useEffect(() => {
    audio.sfx('open');
    const t = window.setTimeout(() => {
      const el = focus.ensure();
      // With a keyboard, put the caret straight into an autofocus text box so typing or dictation just works.
      if (el && inputState.device === 'keyboard' && el.hasAttribute('data-autofocus') && isTextField(el)) el.focus();
    }, 30);
    return () => window.clearTimeout(t);
  }, []);
  useEffect(() => {
    const t = window.setTimeout(() => focus.ensure(), 30);
    return () => window.clearTimeout(t);
  }, [tab]);
  return (
    <div className="panel-backdrop">
      <section className={`panel panel-${size} tone-${tone ?? 'default'}`} data-panel-root role="dialog" aria-modal="true" aria-label={title}>
        <header className="panel-head">
          {icon && <span className="panel-icon" aria-hidden>{icon}</span>}
          <div className="panel-titles">
            <h2>{title}</h2>
            {subtitle && <div className="panel-sub">{subtitle}</div>}
          </div>
          <button className="panel-close" data-nav onClick={() => closePanel()} aria-label="Close">
            <Glyph b="B" /> <span>Close</span>
          </button>
        </header>
        {tabs && tabs.length > 0 && (
          <nav className="tabs" role="tablist">
            <span className="tab-hint">
              <Glyph b="LB" />
            </span>
            {tabs.map((t) => (
              <button key={t.id} role="tab" data-nav data-tab aria-selected={t.id === tab} className={t.id === tab ? 'tab active' : 'tab'} onClick={() => onTab?.(t.id)}>
                {t.label}
                {t.count !== undefined && <span className="count">{t.count}</span>}
              </button>
            ))}
            <span className="tab-hint">
              <Glyph b="RB" />
            </span>
          </nav>
        )}
        <div className="panel-body" data-scroll>
          {children}
        </div>
        {footer && <footer className="panel-foot">{footer}</footer>}
      </section>
    </div>
  );
}

export function Btn({
  children,
  onClick,
  href,
  kind = 'default',
  autoFocus,
  secondary,
  disabled,
  title,
  sameTab,
  small,
}: {
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  kind?: 'default' | 'primary' | 'ghost' | 'danger';
  autoFocus?: boolean;
  secondary?: boolean;
  disabled?: boolean;
  title?: string;
  sameTab?: boolean;
  small?: boolean;
}) {
  const cls = `btn btn-${kind}${small ? ' btn-sm' : ''}`;
  const extra = { 'data-nav': '', ...(autoFocus ? { 'data-autofocus': '' } : {}), ...(secondary ? { 'data-secondary': '' } : {}) };
  if (href) {
    return (
      <a
        className={cls}
        href={href}
        title={title}
        {...extra}
        {...(sameTab ? {} : { target: '_blank', rel: 'noopener noreferrer' })}
        onClick={() => {
          if (!sameTab) notify('Opened in a new tab');
          onClick?.();
        }}
      >
        {children}
        {!sameTab && <span className="ext" aria-hidden>↗</span>}
      </a>
    );
  }
  return (
    <button className={cls} onClick={onClick} disabled={disabled} title={title} {...extra}>
      {children}
    </button>
  );
}

export function Row({ children, wrap = true }: { children: ReactNode; wrap?: boolean }) {
  return <div className={wrap ? 'row wrap' : 'row'}>{children}</div>;
}

export function Section({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <section className="sec">
      <div className="sec-head">
        <h3>{title}</h3>
        {right}
      </div>
      {children}
    </section>
  );
}

const FRESH: Record<string, string> = { fresh: 'fresh', recent: 'a few days old', stale: 'stale', unknown: '' };

export function SourceChip({ source, label }: { source: Partial<SourceRef> & { url: string; name: string }; label?: string }) {
  const f = source.freshness ?? 'unknown';
  return (
    <a className={`source fresh-${f}`} href={source.url} target="_blank" rel="noopener noreferrer" data-nav title="Open the original file">
      <span aria-hidden>📄</span> {label ?? source.name}
      {source.date && <span className="muted"> · {source.date}</span>}
      {FRESH[f] && <span className={`fresh fresh-${f}`}>{FRESH[f]}</span>}
    </a>
  );
}

export function Sources({ sources }: { sources: (Partial<SourceRef> & { url: string; name: string })[] | undefined }) {
  if (!sources?.length) return null;
  return (
    <div className="sources">
      <span className="muted">From:</span>
      {sources.map((s) => (
        <SourceChip key={s.url + s.name} source={s} />
      ))}
    </div>
  );
}

export function StatusBadge({ status }: { status: LoopStatus }) {
  return <span className={`status status-${status}`}>{STATUS_LABEL[status]}</span>;
}

export function LoopRow({ item, laneName }: { item: Pick<LoopItem, 'title' | 'text' | 'status' | 'who' | 'due' | 'dueLabel' | 'section'>; laneName?: string }) {
  return (
    <li className="loop">
      <div className="loop-head">
        <StatusBadge status={item.status} />
        <strong>{item.title}</strong>
        {item.due && <span className="due">{item.dueLabel ?? item.due}</span>}
      </div>
      {item.text && item.text !== item.title && <p className="loop-text">{item.text}</p>}
      <div className="loop-meta muted">
        {item.who && <span>Waiting on {item.who}</span>}
        {laneName && <span>{laneName}</span>}
      </div>
    </li>
  );
}

export function Loading({ what = 'Loading' }: { what?: string }) {
  return (
    <div className="state loading" role="status">
      <span className="spinner" aria-hidden /> {what}…
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="state empty">{children}</div>;
}

export function SignInCard({ compact }: { compact?: boolean }) {
  return (
    <div className="card signin">
      <p>{compact ? 'Sign in with Google to load your records.' : 'This reads your own Drive, Calendar and (optionally) Gmail, live. Nothing is copied or stored by the app.'}</p>
      <Btn href="/api/auth/login?return=/" sameTab kind="primary" autoFocus>
        Sign in with Google
      </Btn>
    </div>
  );
}

export function SetupCard({ setup }: { setup?: string[] }) {
  return (
    <div className="card setup">
      <p>
        <strong>Google sign-in isn’t set up on this deployment yet.</strong> The world works without it; your real records appear once it is. Nothing here is sample
        data.
      </p>
      {setup && (
        <ul className="plain">
          {setup.map((s) => (
            <li key={s}>
              <code>{s.split(':')[0]}</code>
              {s.includes(':') ? ` — ${s.split(':').slice(1).join(':').trim()}` : ''}
            </li>
          ))}
        </ul>
      )}
      <p className="muted">Exact steps: docs/SETUP-GOOGLE.md in the jesse-hq repo (about 10 minutes, free).</p>
      <Btn href="https://github.com/jessedeanrivero/jesse-hq/blob/hq-rpg/docs/SETUP-GOOGLE.md">Open the setup steps</Btn>
    </div>
  );
}

export function ErrorBox({ error, onRetry }: { error: ApiFailure | null; onRetry?: () => void }) {
  if (!error) return null;
  const code = error.body.code;
  if (code === 'not_signed_in') return <SignInCard />;
  if (code === 'not_configured' && error.body.setup) return <SetupCard setup={error.body.setup} />;
  return (
    <div className={`card error code-${code}`} role="alert">
      <p>
        <strong>{error.body.error}</strong>
      </p>
      {error.body.detail && <p className="muted">{error.body.detail}</p>}
      {code === 'missing_scope' && (
        <Btn href="/api/auth/logout" sameTab>
          Sign out and sign in again
        </Btn>
      )}
      {onRetry && code !== 'missing_scope' && <Btn onClick={onRetry}>Try again</Btn>}
    </div>
  );
}

export function Gate({ loading, error, onRetry, children, what }: { loading: boolean; error: ApiFailure | null; onRetry?: () => void; children: ReactNode; what?: string }) {
  if (error) return <ErrorBox error={error} onRetry={onRetry} />;
  if (loading) return <Loading what={what} />;
  return <>{children}</>;
}

/** Inline markdown: **bold**, `code`, [links](url) and bare URLs. No HTML injection. */
export function Inline({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\(https?:[^)]+\)|https?:\/\/[^\s)]+)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith('**')) parts.push(<strong key={i++}>{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith('`')) parts.push(<code key={i++}>{tok.slice(1, -1)}</code>);
    else if (tok.startsWith('[')) {
      const mm = tok.match(/^\[([^\]]+)\]\((.+)\)$/);
      parts.push(
        <a key={i++} href={mm?.[2]} target="_blank" rel="noopener noreferrer" data-nav>
          {mm?.[1]}
        </a>
      );
    } else
      parts.push(
        <a key={i++} href={tok} target="_blank" rel="noopener noreferrer" data-nav>
          {tok.replace(/^https?:\/\//, '')}
        </a>
      );
    last = m.index + tok.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

/** Block markdown for document bodies (paragraphs, lists, sub-headings). */
export function Md({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  const lines = (text ?? '').split('\n');
  let list: { ordered: boolean; items: string[] } | null = null;
  let para: string[] = [];
  let k = 0;
  const flushPara = () => {
    if (para.length) blocks.push(<p key={k++}><Inline text={para.join(' ')} /></p>);
    para = [];
  };
  const flushList = () => {
    if (list) {
      const items = list.items.map((it, j) => (
        <li key={j}>
          <Inline text={it} />
        </li>
      ));
      blocks.push(list.ordered ? <ol key={k++}>{items}</ol> : <ul key={k++}>{items}</ul>);
    }
    list = null;
  };
  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '');
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    const li = line.match(/^\s*([-*+]|\d+[.)])\s+(.*)$/);
    if (h) {
      flushPara();
      flushList();
      blocks.push(<h4 key={k++}><Inline text={h[2]} /></h4>);
    } else if (li) {
      flushPara();
      const ordered = /\d/.test(li[1]);
      if (!list || list.ordered !== ordered) {
        flushList();
        list = { ordered, items: [] };
      }
      list.items.push(li[2]);
    } else if (!line.trim()) {
      flushPara();
      flushList();
    } else if (list && /^\s+\S/.test(raw)) {
      list.items[list.items.length - 1] += ' ' + line.trim();
    } else {
      flushList();
      para.push(line.trim());
    }
  }
  flushPara();
  flushList();
  return <div className="md">{blocks.map((b, i) => <Fragment key={i}>{b}</Fragment>)}</div>;
}

export function fmtTime(iso: string, tz?: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: tz }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function fmtDay(iso: string, tz?: string): string {
  try {
    const d = iso.length === 10 ? new Date(`${iso}T12:00:00`) : new Date(iso);
    return new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: iso.length === 10 ? undefined : tz }).format(d);
  } catch {
    return iso;
  }
}

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { api, ApiFailure, useApi } from '../api';
import { Btn, Empty, ErrorBox, Gate, Panel, Row, Section, SignInCard, SourceChip, copyText, fmtDay } from '../components';
import { loadJson, notify, openPanel, replacePanel, saveJson, useStore } from '../store';
import { CATEGORY_LABEL, EXPANSION_PROMPTS, pickSurprise, type SurpriseFeedback, type SurpriseHistoryEntry, type SurprisePick } from '@/lib/shared/ideas';
import { todayIn } from '@/lib/shared/dates';
import type { Idea, IdeaCategory, PartError, SourceRef } from '@/lib/shared/types';
import { audio } from '@/game/audio';

interface IdeasResponse {
  ideas: Idea[];
  today: string;
  sources: SourceRef[];
  errors: PartError[];
}

export function useIdeas(enabled = true) {
  return useApi<IdeasResponse>(enabled ? '/api/hq/ideas' : null, 600_000);
}

const ORIGIN: Record<Idea['origin'], string> = { loops: 'From your loops', os: 'From your OS file', folder: 'From a creative folder' };

function IdeaCard({ idea, actions = true }: { idea: Idea; actions?: boolean }) {
  return (
    <article className={`idea-card cat-${idea.category}`}>
      <div className="idea-kind">{CATEGORY_LABEL[idea.category]}</div>
      <h4>{idea.title}</h4>
      {idea.text && idea.text !== idea.title && <p>{idea.text}</p>}
      <div className="muted small">
        {ORIGIN[idea.origin]}
        {idea.date ? ` · written ${fmtDay(idea.date)}` : ''}
        {idea.status ? ` · ${idea.status}` : ''}
      </div>
      <div className="row wrap">
        <SourceChip source={idea.source} label="Original" />
        {actions && (
          <>
            <Btn small onClick={() => replacePanelKeep('think', { idea })}>
              Think it through
            </Btn>
            <Btn small onClick={() => replacePanelKeep('journal', { prefill: `${idea.title}\n\n`, title: idea.title })}>
              Write about it
            </Btn>
          </>
        )}
      </div>
    </article>
  );
}

/** Open a follow-up panel on top so B returns to where you were. */
function replacePanelKeep(type: string, props: Record<string, unknown>) {
  openPanel(type, props);
}

export function DreamBoardPanel() {
  const signedIn = useStore((s) => s.session?.signedIn);
  const { data, error, loading, reload } = useIdeas(!!signedIn);
  const [cat, setCat] = useState<string>('all');
  const cats = useMemo(() => {
    const m = new Map<IdeaCategory, number>();
    for (const i of data?.ideas ?? []) m.set(i.category, (m.get(i.category) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [data]);
  const shown = (data?.ideas ?? []).filter((i) => cat === 'all' || i.category === cat);
  return (
    <Panel
      title="Dream Board"
      icon="🌙"
      tone="lounge"
      subtitle="Ideas you already wrote down. Nothing here is a task unless you make it one."
      tabs={[{ id: 'all', label: 'All', count: data?.ideas.length }, ...cats.slice(0, 6).map(([c, n]) => ({ id: c, label: CATEGORY_LABEL[c].replace(/^(A|An|Something) /, ''), count: n }))]}
      tab={cat}
      onTab={setCat}
      size="lg"
      footer={
        <Row>
          <Btn kind="primary" onClick={() => replacePanelKeep('surprise', {})}>
            Surprise me
          </Btn>
          <Btn onClick={() => replacePanelKeep('journal', {})}>New dream</Btn>
        </Row>
      }
    >
      {!signedIn ? (
        <SignInCard compact />
      ) : (
        <Gate loading={loading && !data} error={error} onRetry={reload} what="Gathering your ideas">
          {data?.errors?.length ? <p className="muted small">Couldn’t read: {data.errors.map((e) => e.part).join(', ')}.</p> : null}
          {shown.length ? (
            <div className="idea-grid">
              {shown.slice(0, 60).map((i) => (
                <IdeaCard key={i.id} idea={i} />
              ))}
            </div>
          ) : (
            <Empty>No ideas found in your loops, OS file or creative folders yet. Start one in the journal.</Empty>
          )}
        </Gate>
      )}
    </Panel>
  );
}

const HIST_KEY = 'surprise:history';
const FB_KEY = 'surprise:feedback';

export function SurprisePanel() {
  const signedIn = useStore((s) => s.session?.signedIn);
  const tz = useStore((s) => s.session?.tz);
  const { data, error, loading, reload } = useIdeas(!!signedIn);
  const [pick, setPick] = useState<SurprisePick | null>(null);
  const [round, setRound] = useState(0);
  const draw = (ideas: Idea[]) => {
    const history = loadJson<SurpriseHistoryEntry[]>(HIST_KEY, []);
    const feedback = loadJson<Record<string, SurpriseFeedback>>(FB_KEY, {});
    const today = todayIn(tz ?? undefined);
    const p = pickSurprise(ideas, history, feedback, today);
    setPick(p);
    if (p) saveJson(HIST_KEY, [...history, { id: p.idea.id, at: today, category: p.idea.category }].slice(-50));
    audio.sfx('chime');
  };
  useEffect(() => {
    if (data?.ideas) draw(data.ideas);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, round]);
  const feedback = (fb: SurpriseFeedback) => {
    if (!pick) return;
    const all = loadJson<Record<string, SurpriseFeedback>>(FB_KEY, {});
    all[pick.idea.id] = fb;
    saveJson(FB_KEY, all);
    notify(fb === 'more' ? 'Got it: more like this' : fb === 'never' ? 'Won’t show that one again' : 'Okay, not now');
    setRound((r) => r + 1);
  };
  return (
    <Panel title="Surprise me" icon="🎲" tone="lounge" subtitle="Picked by simple rules from ideas you wrote down. Not AI.">
      {!signedIn ? (
        <SignInCard compact />
      ) : (
        <Gate loading={loading && !data} error={error} onRetry={reload} what="Shuffling the deck">
          {pick ? (
            <>
              <IdeaCard idea={pick.idea} actions={false} />
              <p className="muted small">Why this one: {pick.reasons.join('; ')}.</p>
              <Row>
                <Btn kind="primary" autoFocus onClick={() => replacePanel('think', { idea: pick.idea })}>
                  Think it through
                </Btn>
                <Btn onClick={() => replacePanel('journal', { prefill: `${pick.idea.title}\n\n`, title: pick.idea.title })}>Write about it</Btn>
                <Btn onClick={() => setRound((r) => r + 1)}>Another</Btn>
              </Row>
              <Row>
                <Btn small onClick={() => feedback('more')}>
                  More like this
                </Btn>
                <Btn small onClick={() => feedback('notnow')}>
                  Not now
                </Btn>
                <Btn small kind="ghost" onClick={() => feedback('never')}>
                  Never show this
                </Btn>
              </Row>
            </>
          ) : (
            <Empty>No ideas to draw from yet. Write one in the journal and it can come back to surprise you.</Empty>
          )}
        </Gate>
      )}
    </Panel>
  );
}

export function ThinkPanel({ idea }: { idea?: Idea }) {
  const [title, setTitle] = useState(idea?.title ?? '');
  const [answers, setAnswers] = useState<string[]>(() => EXPANSION_PROMPTS.map(() => ''));
  const compose = () =>
    [
      idea?.text && idea.text !== idea.title ? idea.text : '',
      ...EXPANSION_PROMPTS.map((q, i) => (answers[i].trim() ? `**${q}**\n${answers[i].trim()}` : '')),
      idea ? `Source: ${idea.source.name}` : '',
    ]
      .filter(Boolean)
      .join('\n\n');
  return (
    <Panel title="Think it through" icon="💡" tone="lounge" subtitle="A few questions to play with. Answer any, skip any. Your dictation tool works in every box." size="lg">
      {idea ? (
        <IdeaCard idea={idea} actions={false} />
      ) : (
        <label className="field">
          <span>The idea</span>
          <input data-nav data-autofocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What are you thinking about?" />
        </label>
      )}
      {EXPANSION_PROMPTS.map((q, i) => (
        <label key={q} className="field">
          <span>{q}</span>
          <textarea
            data-nav
            rows={2}
            value={answers[i]}
            onChange={(e) => setAnswers((a) => a.map((v, j) => (j === i ? e.target.value : v)))}
          />
        </label>
      ))}
      <Row>
        <Btn kind="primary" onClick={() => replacePanel('journal', { title: idea?.title ?? title, prefill: compose(), intent: 'explore' })}>
          Continue in the journal
        </Btn>
        <Btn onClick={() => copyText(`${idea?.title ?? title}\n\n${compose()}`, 'Notes copied')}>Copy notes</Btn>
      </Row>
    </Panel>
  );
}

type Intent = 'save' | 'explore' | 'project';
type Step = 'edit' | 'confirm' | 'confirm-project' | 'folder' | 'saving' | 'saved';

const DRAFT_KEY = 'jhq:journal-draft';

function readDraft(): { title: string; text: string } | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeDraft(d: { title: string; text: string } | null): void {
  try {
    if (d && (d.title || d.text)) sessionStorage.setItem(DRAFT_KEY, JSON.stringify(d));
    else sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    // ignore
  }
}

const INTENT_LABEL: Record<Intent, string> = { save: 'Save for later', explore: 'Explore this idea', project: 'Turn into a project' };

export function JournalPanel({ prefill, title: t0, intent: i0 }: { prefill?: string; title?: string; intent?: Intent }) {
  const session = useStore((s) => s.session);
  const signedIn = !!session?.signedIn;
  const canWrite = !!session?.scopes?.driveFile;
  const initial = useRef(prefill || t0 ? { title: t0 ?? '', text: prefill ?? '' } : readDraft() ?? { title: '', text: '' });
  const [title, setTitle] = useState(initial.current.title);
  const [text, setText] = useState(initial.current.text);
  const [intent, setIntent] = useState<Intent>(i0 ?? 'save');
  const [step, setStep] = useState<Step>('edit');
  const [err, setErr] = useState<ApiFailure | null>(null);
  const [saved, setSaved] = useState<{ file: { name: string; url: string }; folder: { name: string; url: string } } | null>(null);
  const [folderName, setFolderName] = useState('Jesse HQ Dream Journal');
  useEffect(() => {
    const t = window.setTimeout(() => writeDraft({ title, text }), 400);
    return () => window.clearTimeout(t);
  }, [title, text]);

  const begin = (i: Intent) => {
    if (!text.trim()) {
      notify('Write or dictate something first.', 'warn');
      return;
    }
    setIntent(i);
    setErr(null);
    setStep('confirm');
  };

  const save = async (createFolder = false) => {
    setStep('saving');
    setErr(null);
    try {
      const res = await api<{ needsFolder?: boolean; folderName?: string; saved?: boolean; file?: { name: string; url: string }; folder?: { name: string; url: string } }>('/api/hq/journal', {
        method: 'POST',
        body: { text, title, intent, confirm: true, confirmProject: intent === 'project', createFolder },
      });
      if (res.needsFolder) {
        setFolderName(res.folderName ?? folderName);
        setStep('folder');
        return;
      }
      if (res.saved && res.file && res.folder) {
        setSaved({ file: res.file, folder: res.folder });
        setStep('saved');
        writeDraft(null);
        audio.sfx('save');
        notify(`Saved ${res.file.name} to Drive`, 'ok');
      } else {
        setStep('edit');
        notify('The save did not complete. Nothing was written.', 'warn');
      }
    } catch (e) {
      setErr(e instanceof ApiFailure ? e : null);
      setStep('edit');
      if (!(e instanceof ApiFailure)) notify('Could not reach the server. Your draft is still here.', 'warn');
    }
  };

  return (
    <Panel title="Dream Journal" icon="📓" tone="lounge" subtitle="Separate from your operating-system records. Saving always asks first." size="lg">
      {step === 'saved' && saved ? (
        <div className="card ok">
          <p>
            <strong>Saved.</strong> {saved.file.name} is in “{saved.folder.name}”.
          </p>
          <Row>
            <Btn href={saved.file.url} autoFocus>
              Open the file
            </Btn>
            <Btn href={saved.folder.url}>Open the folder</Btn>
            <Btn
              onClick={() => {
                setTitle('');
                setText('');
                setSaved(null);
                setStep('edit');
              }}
            >
              Write another
            </Btn>
          </Row>
        </div>
      ) : (
        <>
          <label className="field">
            <span>Title (optional)</span>
            <input data-nav value={title} onChange={(e) => setTitle(e.target.value)} placeholder="A name for this dream" disabled={step !== 'edit'} />
          </label>
          <label className="field">
            <span>Your idea. Press A or click here, then use your dictation hotkey or type.</span>
            <textarea data-nav data-autofocus rows={8} value={text} onChange={(e) => setText(e.target.value)} disabled={step !== 'edit'} placeholder="What do you want to make, try, or remember?" />
          </label>
          {err && <ErrorBox error={err} />}
          {step === 'edit' &&
            (signedIn && canWrite ? (
              <Row>
                <Btn kind="primary" onClick={() => begin('save')}>
                  Save for later
                </Btn>
                <Btn onClick={() => begin('explore')}>Explore this idea</Btn>
                <Btn onClick={() => begin('project')}>Turn into a project</Btn>
                <Btn kind="ghost" onClick={() => copyText(`${title ? `${title}\n\n` : ''}${text}`, 'Journal text copied')}>
                  Copy
                </Btn>
              </Row>
            ) : (
              <div className="card">
                <p>
                  {signedIn
                    ? 'Saving needs permission to create files this app makes in your Drive. Sign out and sign in again to grant it.'
                    : 'Sign in with Google to save entries to a Dream Journal folder in your Drive.'}{' '}
                  Your draft stays in this tab until then.
                </p>
                <Row>
                  <Btn href={signedIn ? '/api/auth/logout' : '/api/auth/login?return=/'} sameTab kind="primary">
                    {signedIn ? 'Sign in again' : 'Sign in with Google'}
                  </Btn>
                  <Btn onClick={() => copyText(`${title ? `${title}\n\n` : ''}${text}`, 'Journal text copied')}>Copy the text</Btn>
                </Row>
              </div>
            ))}
          {step === 'confirm' && (
            <div className="card confirm">
              <p>
                <strong>{INTENT_LABEL[intent]}?</strong> This creates one new file in your Dream Journal folder in Google Drive. Nothing else in Drive changes, and your
                operating-system files are never touched.
              </p>
              <Row>
                <Btn kind="primary" autoFocus onClick={() => (intent === 'project' ? setStep('confirm-project') : void save())}>
                  Yes, save it
                </Btn>
                <Btn onClick={() => setStep('edit')}>Not yet</Btn>
              </Row>
            </div>
          )}
          {step === 'confirm-project' && (
            <div className="card confirm">
              <p>
                <strong>One more check.</strong> The file will be marked as a proposed project. It will not be added to your loops or OS file; bring it to your next checkout if it
                should go on the spine.
              </p>
              <Row>
                <Btn kind="primary" autoFocus onClick={() => void save()}>
                  Save as a proposed project
                </Btn>
                <Btn onClick={() => setStep('edit')}>Back</Btn>
              </Row>
            </div>
          )}
          {step === 'folder' && (
            <div className="card confirm">
              <p>
                <strong>First save.</strong> There’s no journal folder yet. Create a new folder named “{folderName}” in My Drive? You can move it anywhere afterwards.
              </p>
              <Row>
                <Btn kind="primary" autoFocus onClick={() => void save(true)}>
                  Create the folder and save
                </Btn>
                <Btn onClick={() => setStep('edit')}>Cancel</Btn>
              </Row>
            </div>
          )}
          {step === 'saving' && <p className="muted">Saving…</p>}
        </>
      )}
    </Panel>
  );
}

export function QuietPanel() {
  const reduce = useStore((s) => s.settings.reduceMotion);
  const [minutes, setMinutes] = useState(1);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!running) return;
    const start = Date.now() - elapsed * 1000;
    const t = window.setInterval(() => {
      const e = Math.floor((Date.now() - start) / 1000);
      setElapsed(e);
      if (e >= minutes * 60) {
        setRunning(false);
        audio.sfx('chime');
        notify('That was a minute well spent.', 'ok');
      }
    }, 250);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, minutes]);
  const cycle = elapsed % 14;
  const phase = cycle < 4 ? 'Breathe in' : cycle < 8 ? 'Hold' : 'Breathe out';
  const left = Math.max(0, minutes * 60 - elapsed);
  return (
    <Panel title="A quiet minute" icon="🌿" tone="lounge" subtitle="In for 4, hold for 4, out for 6. Nothing to do here." size="sm">
      <div className={`breath ${running && !reduce ? `breath-${cycle < 4 ? 'in' : cycle < 8 ? 'hold' : 'out'}` : ''}`} aria-live="polite">
        <div className="breath-circle" />
        <div className="breath-label">{running ? phase : 'Ready when you are'}</div>
        {running && (
          <div className="muted small">
            {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')} left
          </div>
        )}
      </div>
      <Row>
        <Btn
          kind="primary"
          autoFocus
          onClick={() => {
            if (running) setRunning(false);
            else {
              setElapsed(0);
              setRunning(true);
            }
          }}
        >
          {running ? 'Stop' : 'Start'}
        </Btn>
        {[1, 3, 5].map((m) => (
          <Btn key={m} small kind={m === minutes ? 'primary' : 'default'} onClick={() => setMinutes(m)} disabled={running}>
            {m} min
          </Btn>
        ))}
      </Row>
    </Panel>
  );
}

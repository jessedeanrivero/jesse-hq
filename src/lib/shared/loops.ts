import { extractDate } from './dates';
import {
  extractTrailingTag,
  findSection,
  firstWords,
  hashId,
  normalizeMarkdown,
  parseFrontmatter,
  parseSections,
  stripInline,
  fmString,
} from './markdown';
import type { ListItem, LoopItem, LoopStatus, LoopsSpine, SourceRef } from './types';

/** Statuses that still need something from someone. */
export const OPEN_STATUSES: LoopStatus[] = ['owed', 'waiting', 'scheduled', 'decide', 'active', 'open'];

export const STATUS_LABEL: Record<LoopStatus, string> = {
  owed: 'Your move',
  waiting: 'Their move',
  scheduled: 'On the calendar',
  decide: 'Decision awaiting you',
  active: 'In motion',
  parked: 'Parked',
  idea: 'Idea',
  done: 'Closed',
  decided: 'Decided',
  standing: 'Standing rule',
  watch: 'Watching',
  warm: 'Warm contact',
  info: 'Note',
  open: 'Open',
};

const RULES: [RegExp, LoopStatus][] = [
  [/^waiting\b|^follow[- ]?up\b|^next\b.*\bmeeting\b|\bclock$/i, 'waiting'],
  [/^(decide|decision)\b/i, 'decide'],
  [/^(closed|done|merged|shipped|sent|answered|used|cut|superseded|killed|complete|completed|resolved|paid)\b/i, 'done'],
  [/^(decided|direction set|direction|agreed|settled)\b/i, 'decided'],
  [/^(owed|quick|verify|confirm|practice|ask|check|todo|to do|reply|send|fix)\b|\bowed\b/i, 'owed'],
  [/^(dated|booked|scheduled|calendar|set|held|on the calendar)\b/i, 'scheduled'],
  [/^(parked|deferred|later|someday|post-launch|on hold)\b/i, 'parked'],
  [/^(idea|low|hobby|fun|optional|creative|maybe)\b/i, 'idea'],
  [/^(standing|non-negotiable|recurring|weekly|rule)\b/i, 'standing'],
  [/^(active|live|in motion|in progress|in|current|ongoing|ready|drafted|proposed|pending|booking|scope)\b/i, 'active'],
  [/^(watch|monitor)\b/i, 'watch'],
  [/^(warm|relational|relationship)\b/i, 'warm'],
  [/^(signal|insight|note|notes|reference|known limit|positioning|ledger|milestones?|real|the real one|context|fyi)\b/i, 'info'],
];

/** Markers that describe ownership/context rather than state; the next tag part decides. */
const WEAK = /^(his|hers|theirs|mine|family|money|personal|work)$/i;

export interface ClassifyOptions {
  /** Lowercase first names that mean "the owner" (so "Jesse's" reads as owed, not waiting). */
  ownerNames?: string[];
}

function classifyPart(part: string, opts: ClassifyOptions): { status: LoopStatus; who?: string } | null {
  const p = part.trim();
  if (!p) return null;
  const first = p.split('/')[0].trim();
  const wait = first.match(/^waiting (?:on|for)\s+(.+)$/i);
  if (wait) return { status: 'waiting', who: wait[1].replace(/\s*\(.*\)$/, '').trim() };
  const poss = first.match(/^([A-Z][\w-]*(?:\s+(?:and|&)\s+[A-Z][\w-]*)?)'s\b(.*)$/);
  if (poss) {
    const name = poss[1];
    const owner = (opts.ownerNames ?? []).some((n) => n && name.toLowerCase() === n.toLowerCase());
    return owner ? { status: 'owed' } : { status: 'waiting', who: name };
  }
  for (const [re, status] of RULES) if (re.test(first)) return { status };
  return null;
}

export function classifyTag(tag: string | undefined, opts: ClassifyOptions = {}): { status: LoopStatus; who?: string; parts: string[] } {
  if (!tag) return { status: 'open', parts: [] };
  const parts = tag
    .split('·')
    .map((p) => p.trim())
    .filter(Boolean);
  for (let i = 0; i < parts.length; i++) {
    if (i === 0 && WEAK.test(parts[0]) && parts.length > 1) continue;
    const r = classifyPart(parts[i], opts);
    if (r) return { ...r, parts };
    if (i === 0) break;
  }
  // Weak-only or unknown first part: look for a known state anywhere, else info/open.
  for (const p of parts.slice(1)) {
    const r = classifyPart(p, opts);
    if (r && r.status !== 'info') return { ...r, parts };
  }
  if (parts.length && WEAK.test(parts[0])) return { status: 'info', parts };
  return { status: 'open', parts };
}

const DUE_STATUSES: LoopStatus[] = ['owed', 'waiting', 'scheduled', 'decide', 'active', 'open'];

export function parseLoopItem(item: ListItem, section: string, today: string, opts: ClassifyOptions = {}): LoopItem {
  const { tag, before } = extractTrailingTag(item.text);
  let title = item.bold ?? '';
  let text = item.bold ? extractTrailingTag(item.rest).before : before;
  if (!title) {
    title = firstWords(text, 9);
  }
  title = stripInline(title).replace(/[:.]+$/, '');
  text = stripInline(text);
  const cls = classifyTag(tag, opts);
  let due: string | undefined;
  let dueLabel: string | undefined;
  if (DUE_STATUSES.includes(cls.status)) {
    const fromTag = tag ? extractDate(tag, today) : null;
    const fromText = fromTag ? null : extractDate(`${title} ${text}`, today);
    const d = fromTag ?? fromText;
    if (d) {
      due = d.iso;
      dueLabel = d.label;
    }
  }
  return {
    id: hashId(`${section}|${title}|${item.index}`),
    title,
    text,
    status: cls.status,
    tag: tag ?? '',
    tagParts: cls.parts,
    who: cls.who,
    section,
    due,
    dueLabel,
  };
}

/** Parse the living loops spine (loops-YYYY-MM-DD.md). */
export function parseLoopsSpine(raw: string, source: SourceRef, today: string, opts: ClassifyOptions = {}): LoopsSpine {
  const md = normalizeMarkdown(raw);
  const { data, body } = parseFrontmatter(md);
  const { sections } = parseSections(body);
  const items: LoopItem[] = [];
  const summary: LoopsSpine['sections'] = [];
  let next: LoopItem[] = [];
  const recentlyClosed: LoopsSpine['recentlyClosed'] = [];
  let killed: string[] = [];

  for (const s of sections) {
    if (/recently closed/i.test(s.heading)) {
      for (const it of s.items) {
        recentlyClosed.push({
          label: it.bold ?? '',
          items: stripInline(it.bold ? it.rest : it.text)
            .split(/;\s+/)
            .map((x) => x.trim())
            .filter(Boolean),
        });
      }
      continue;
    }
    if (/killed/i.test(s.heading)) {
      killed = stripInline(s.body)
        .split(/\.\s+/)
        .map((x) => x.replace(/\.$/, '').trim())
        .filter(Boolean);
      continue;
    }
    const sectionItems: LoopItem[] = [];
    for (const it of s.items) {
      if (it.depth > 0 && sectionItems.length) {
        const parent = sectionItems[sectionItems.length - 1];
        parent.text = `${parent.text} ${stripInline(it.text)}`.trim();
        continue;
      }
      sectionItems.push(parseLoopItem(it, s.heading, today, opts));
    }
    if (/next \d+ hours|this week|next up/i.test(s.heading)) next = sectionItems;
    items.push(...sectionItems);
    summary.push({ heading: s.heading, count: sectionItems.length });
  }

  return {
    updated: fmString(data, 'loops_updated') ?? fmString(data, 'updated'),
    note: fmString(data, 'note'),
    items,
    sections: summary,
    next,
    recentlyClosed,
    killed,
    source,
  };
}

export function countByStatus(items: LoopItem[]): Partial<Record<LoopStatus, number>> {
  const c: Partial<Record<LoopStatus, number>> = {};
  for (const it of items) c[it.status] = (c[it.status] ?? 0) + 1;
  return c;
}

export function isOpen(it: LoopItem): boolean {
  return OPEN_STATUSES.includes(it.status);
}

export { findSection };

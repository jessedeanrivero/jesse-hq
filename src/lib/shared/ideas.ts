import { daysBetween, extractDate } from './dates';
import { hashId, stripInline } from './markdown';
import type { Idea, IdeaCategory, LoopsSpine, OsDoc, SourceRef } from './types';

const CATEGORY_WORDS: Record<Exclude<IdeaCategory, 'other'>, string[]> = {
  build: ['app', 'tool', 'feature', 'software', 'automation', 'workflow', 'nas', 'server', 'device', 'pedal', 'rig', 'shortcut', 'plugin', 'website', 'bot', 'build', 'prototype', 'macbook', 'tv', 'importer', 'claude', 'code'],
  music: ['song', 'songs', 'sync', 'producing', 'producer', 'record', 'album', 'ep', 'suno', 'mix', 'beat', 'cover', 'melody', 'writing'],
  content: ['podcast', 'youtube', 'episode', 'series', 'booth', 'video', 'channel', 'reel', 'newsletter', 'blog'],
  community: ['church', 'camp', 'workshop', 'cohort', 'library', 'class', 'teach', 'community', 'team', 'people'],
  family: ['family', 'kids', 'photos', 'recipe', 'recipes', 'dinner', 'home', 'house', 'soup', 'chili', 'cook', 'cooking'],
  game: ['game', 'games', 'arcade', 'puzzle', 'circuit'],
  experience: ['trip', 'travel', 'visit', 'vacation', 'beach', 'concert', 'hike', 'camping', 'hawaii', 'island'],
  venture: ['service', 'royalty', 'pilot', 'business', 'arm', 'agency', 'offer', 'revenue', 'publishing'],
  skill: ['learn', 'practice', 'course', 'book', 'lesson', 'study', 'skill'],
};

export const CATEGORY_LABEL: Record<IdeaCategory, string> = {
  build: 'Something to build',
  music: 'A music experiment',
  content: 'A content idea',
  community: 'A community idea',
  family: 'A family-friendly project',
  game: 'Something fun to play or make',
  experience: 'An experience to have',
  venture: 'A venture worth reconsidering',
  skill: 'A skill to explore',
  other: 'An idea worth a look',
};

export function categorize(text: string): IdeaCategory {
  const words = new Set(
    stripInline(text)
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(Boolean)
  );
  let best: IdeaCategory = 'other';
  let bestScore = 0;
  for (const [cat, list] of Object.entries(CATEGORY_WORDS) as [Exclude<IdeaCategory, 'other'>, string[]][]) {
    const score = list.filter((w) => words.has(w)).length;
    if (score > bestScore) {
      bestScore = score;
      best = cat;
    }
  }
  return best;
}

const IDEA_TAGS = /^(low|creative|hobby|fun|optional|maybe|someday)$/i;

/** Ideas the user has written down: idea/parked loops plus soft tags like "low · creative". */
export function ideasFromLoops(spine: LoopsSpine, today: string): Idea[] {
  const out: Idea[] = [];
  for (const it of spine.items) {
    const softTag = it.tagParts.some((p) => IDEA_TAGS.test(p.split('/')[0].trim()));
    if (!(it.status === 'idea' || it.status === 'parked' || softTag)) continue;
    const hasTitle = it.title && !it.title.endsWith('…');
    const sentences = it.text
      .split(/\.\s+/)
      .map((s) => s.replace(/\.$/, '').trim())
      .filter(Boolean);
    const date = extractDate(`${it.title} ${it.text}`, today)?.iso ?? spine.source.date;
    const safeDate = date && daysBetween(date, today) >= 0 ? date : spine.source.date;
    if (!hasTitle && sentences.length > 1 && sentences.every((s) => s.length <= 70)) {
      sentences.forEach((s, i) =>
        out.push({ id: hashId(`${it.id}|${i}`), title: s, text: `Listed under ${it.section}.`, category: categorize(s), origin: 'loops', status: it.status, date: safeDate, laneId: it.laneId, source: spine.source })
      );
      continue;
    }
    out.push({
      id: it.id,
      title: it.title,
      text: it.text,
      category: categorize(`${it.title} ${it.text}`),
      origin: 'loops',
      status: it.status,
      date: safeDate,
      laneId: it.laneId,
      source: spine.source,
    });
  }
  return out;
}

const ASPIRATION = /\b(deferred|someday|next year|one day|dream|bucket|trip|visit|travel|vacation)\b/i;
const MONEY = /(\$|debt|figures|income|salary|revenue|paid off|minimum due|\bk\/month)/i;

/** Aspirations from the goals and life-direction sections (never money goals). */
export function ideasFromOs(os: OsDoc): Idea[] {
  return [...os.goals, ...os.lifeDirection]
    .filter((g) => ASPIRATION.test(g) && !MONEY.test(g))
    .map((g) => {
      const clean = stripInline(g);
      const title = clean.split(/[.:]/)[0].slice(0, 80);
      return { id: hashId(`os|${clean}`), title, text: clean, category: categorize(clean) === 'other' ? 'experience' : categorize(clean), origin: 'os' as const, date: os.source.date, source: os.source };
    });
}

export interface FolderIdeaInput {
  folderName: string;
  folderUrl: string;
  files: { id: string; name: string; url: string; modifiedTime?: string }[];
}

/** Creative folders next to the context folder (games, recipes, …): each file is a possibility. */
export function ideasFromFolders(folders: FolderIdeaInput[]): Idea[] {
  const out: Idea[] = [];
  for (const f of folders) {
    const cat: IdeaCategory = /game/i.test(f.folderName) ? 'game' : /recipe|cook|food/i.test(f.folderName) ? 'family' : categorize(f.folderName);
    const label = f.folderName.replace(/^\d+\s*[—-]\s*/, '');
    for (const file of f.files) {
      const title = file.name.replace(/\.(md|txt|docx?)$/i, '').replace(/^\d+\s*[—-]\s*/, '');
      const source: SourceRef = { kind: 'folder', name: file.name, id: file.id, url: file.url, modifiedTime: file.modifiedTime, date: file.modifiedTime?.slice(0, 10), freshness: 'unknown' };
      out.push({ id: hashId(`folder|${file.id}`), title, text: `From your ${label} folder.`, category: cat, origin: 'folder', date: file.modifiedTime?.slice(0, 10), source });
    }
  }
  return out;
}

export interface SurpriseHistoryEntry {
  id: string;
  at: string;
  category: IdeaCategory;
}

export type SurpriseFeedback = 'more' | 'notnow' | 'never';

export interface SurprisePick {
  idea: Idea;
  reasons: string[];
}

/**
 * Pick one idea with simple, explainable rules: skip recent repeats and "never",
 * favor categories not shown lately, give older ideas a "forgotten" boost, and lean
 * toward categories marked "more like this". This is rules, not AI.
 */
export function pickSurprise(
  ideas: Idea[],
  history: SurpriseHistoryEntry[],
  feedback: Record<string, SurpriseFeedback>,
  today: string,
  random: () => number = Math.random
): SurprisePick | null {
  if (!ideas.length) return null;
  const recentIds = new Set(history.slice(-Math.min(12, Math.max(1, ideas.length - 1))).map((h) => h.id));
  const recentCats = history.slice(-3).map((h) => h.category);
  const moreCats = new Set(
    Object.entries(feedback)
      .filter(([, v]) => v === 'more')
      .map(([id]) => ideas.find((i) => i.id === id)?.category)
      .filter(Boolean) as IdeaCategory[]
  );
  const pool = ideas.filter((i) => feedback[i.id] !== 'never' && !recentIds.has(i.id));
  const candidates = pool.length ? pool : ideas.filter((i) => feedback[i.id] !== 'never');
  if (!candidates.length) return null;
  const scored = candidates.map((idea) => {
    let w = 1;
    const reasons: string[] = [];
    if (!recentCats.includes(idea.category)) {
      w += 0.6;
      reasons.push('a different kind of idea than the last few');
    }
    const age = idea.date ? daysBetween(idea.date, today) : 0;
    if (age >= 21) {
      w += 0.8;
      reasons.push(`you wrote it down ${age} days ago`);
    }
    if (moreCats.has(idea.category)) {
      w *= 1.6;
      reasons.push('you asked for more like this');
    }
    if (feedback[idea.id] === 'notnow') w *= 0.3;
    return { idea, w, reasons };
  });
  const total = scored.reduce((a, s) => a + s.w, 0);
  let r = random() * total;
  for (const s of scored) {
    r -= s.w;
    if (r <= 0) return { idea: s.idea, reasons: s.reasons.length ? s.reasons : ['a fair draw from your saved ideas'] };
  }
  const last = scored[scored.length - 1];
  return { idea: last.idea, reasons: last.reasons };
}

/** Structured prompts for thinking an idea through without an AI model. */
export const EXPANSION_PROMPTS = [
  'What is the smallest fun version you could try in an hour?',
  'Who would light up if this existed? Picture one specific person.',
  'What would make it delightful instead of just useful?',
  'What do you already have (gear, code, people, songs) that gets you halfway?',
  'What is the one thing you would need to learn first?',
  'If it stayed a hobby forever, would it still be worth doing?',
];

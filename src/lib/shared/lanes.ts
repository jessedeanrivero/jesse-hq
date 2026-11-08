import { countByStatus, isOpen } from './loops';
import { stripInline } from './markdown';
import type { DailyCheckout, Lane, LaneLink, LoopItem, LoopsSpine, OsDoc, RoomTheme } from './types';

const STOP = new Set([
  'the', 'and', 'for', 'with', 'from', 'into', 'this', 'that', 'not', 'own', 'its', 'are', 'was', 'his', 'her', 'their',
  'decided', 'opened', 'lane', 'lanes', 'week', 'via', 'met', 'about', 'only', 'one', 'offs', 'plan', 'put', 'new', 'old',
]);

export const THEMES: Record<RoomTheme, { label: string; words: string[] }> = {
  devoffice: {
    label: 'Dev office',
    words: ['app', 'apps', 'dev', 'developer', 'code', 'software', 'saas', 'stripe', 'portal', 'portals', 'redesign', 'pricing', 'users', 'mrr', 'launch', 'product', 'feature', 'features', 'bug', 'deploy', 'deploys', 'signups', 'staging'],
  },
  writersroom: {
    label: "Writers' room",
    words: ['publishing', 'publisher', 'publishers', 'write', 'writes', 'writing', 'cowrite', 'cowrites', 'songwriter', 'songwriting', 'sync', 'catalog', 'deal', 'royalty', 'royalties', 'lyrics'],
  },
  studio: {
    label: 'Session studio',
    words: ['freelance', 'recording', 'session', 'sessions', 'mix', 'mixing', 'master', 'mastering', 'production', 'producer', 'producing', 'album', 'engagement', 'consulting', 'services', 'capture', 'tracking'],
  },
  workshop: {
    label: 'Workshop',
    words: ['cohort', 'workshop', 'worship', 'kickstarter', 'church', 'churches', 'community', 'teach', 'teaching', 'intensive', 'camp', 'collective', 'resources', 'umbrella'],
  },
  label: {
    label: 'Label office',
    words: ['imprint', 'label', 'distribution', 'distributor', 'playlist', 'playlists', 'releases', 'release', 'vinyl', 'dsp', 'dsps', 'spotify', 'masters'],
  },
  archive: {
    label: 'Archive',
    words: ['winddown', 'wind', 'close', 'closing', 'closes', 'handback', 'handbacks', 'buyout', 'buyouts', 'llc', 'llcs', 'dissolve', 'paperwork', 'checklist'],
  },
  broadcast: {
    label: 'Broadcast booth',
    words: ['content', 'youtube', 'podcast', 'video', 'videos', 'social', 'episode', 'channel', 'reel', 'reels', 'stream', 'newsletter'],
  },
  office: {
    label: 'Contract desk',
    words: ['contract', 'contractor', 'hours', 'hourly', 'hrs', 'invoice', 'invoices', 'client', 'clients', 'async', 'execution'],
  },
  backstage: {
    label: 'Backstage',
    words: ['tour', 'touring', 'road', 'gig', 'gigs', 'live', 'bass', 'setlist', 'travel', 'shows'],
  },
  generic: { label: 'Project room', words: [] },
};

export function tokenize(text: string): string[] {
  return stripInline(text)
    .toLowerCase()
    .replace(/[’']/g, '')
    .split(/[^a-z0-9-]+/)
    .flatMap((w) => (w.includes('-') ? [w.replace(/-/g, ''), ...w.split('-')] : [w]))
    .filter((w) => w.length >= 2);
}

function stem(w: string): string {
  return w.replace(/(ings?|ed|es|s)$/, '');
}

export function scoreTheme(laneId: string, name: string, text: string): RoomTheme {
  const slug = tokenize(laneId.replace(/-/g, ' ') + ' ' + laneId);
  const nameT = tokenize(name);
  const textT = new Set(tokenize(text));
  let best: RoomTheme = 'generic';
  let bestScore = 0;
  for (const theme of Object.keys(THEMES) as RoomTheme[]) {
    const words = THEMES[theme].words;
    if (!words.length) continue;
    const set = new Set(words);
    let score = 0;
    score += 5 * slug.filter((w) => set.has(w)).length;
    score += 3 * nameT.filter((w) => set.has(w)).length;
    score += Math.min(6, words.filter((w) => textT.has(w)).length);
    if (score > bestScore) {
      bestScore = score;
      best = theme;
    }
  }
  return best;
}

export function prettifyId(id: string): string {
  return id
    .split('-')
    .map((w) => (w === 'winddown' ? 'Wind-down' : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}

function significant(words: string[]): string[] {
  return words.filter((w) => w.length >= 3 && !STOP.has(w));
}

/** How strongly a heading (or name) points at a lane. */
export function laneMatchScore(lane: { id: string; name: string; description?: string }, heading: string): number {
  const h = heading.toLowerCase();
  const hw = significant(tokenize(heading));
  let score = 0;
  if (h.includes(lane.id) || h.replace(/[\s/]+/g, '-').includes(lane.id)) score += 10;
  const slugWords = significant(lane.id.split('-')).concat(lane.id.includes('-') ? [lane.id.replace(/-/g, '')] : []);
  for (const w of slugWords) {
    if (w.length < 4) continue;
    if (hw.some((x) => x === w || (x.length >= 4 && (x.startsWith(w) || w.startsWith(x))))) score += 4;
  }
  const nameWords = significant(tokenize(lane.name)).filter((w) => !slugWords.includes(w));
  for (const w of nameWords) if (w.length >= 4 && hw.includes(w)) score += 3;
  if (lane.description) {
    const desc = new Set(tokenize(lane.description).map(stem));
    let extra = 0;
    for (const w of hw) if (w.length >= 5 && desc.has(stem(w))) extra++;
    score += Math.min(3, extra);
  }
  return score;
}

function bestLaneFor(lanes: { id: string; name: string; description?: string }[], heading: string, bodyText?: string): string | undefined {
  let best: string | undefined;
  let bestScore = 0;
  for (const l of lanes) {
    const s = laneMatchScore(l, heading);
    if (s > bestScore) {
      bestScore = s;
      best = l.id;
    }
  }
  if (bestScore >= 4) return best;
  if (bodyText) {
    const lower = bodyText.toLowerCase();
    let mBest: string | undefined;
    let mCount = 0;
    for (const l of lanes) {
      const needles = [l.id, l.name.toLowerCase()].filter((n) => n.length >= 4);
      const count = needles.reduce((acc, n) => acc + (lower.split(n).length - 1), 0);
      if (count > mCount) {
        mCount = count;
        mBest = l.id;
      }
    }
    if (mCount >= 2) return mBest;
  }
  return undefined;
}

const URL_RE = /https?:\/\/[^\s)\]>"'`]+/g;
const DOMAIN_RE = /(?<![@\w/.-])((?:[a-z0-9-]+\.)+(?:com|app|io|co|net|org|dev|fm|tv|music))(?![\w-])/gi;

export function extractLinks(text: string): LaneLink[] {
  const out: LaneLink[] = [];
  const seen = new Set<string>();
  for (const m of text.match(URL_RE) ?? []) {
    const url = m.replace(/[.,;:]+$/, '');
    if (seen.has(url)) continue;
    seen.add(url);
    out.push({ label: url.replace(/^https?:\/\//, '').replace(/\/$/, ''), url, kind: 'found' });
  }
  for (const m of text.matchAll(DOMAIN_RE)) {
    const host = m[1].toLowerCase();
    if (/\.(md|js|ts|json|png|jpg)$/.test(host)) continue;
    const url = `https://${host}`;
    if ([...seen].some((s) => s.includes(host))) continue;
    seen.add(url);
    out.push({ label: host, url, kind: 'found' });
  }
  return out;
}

const THEME_TOOLS: Partial<Record<RoomTheme, LaneLink[]>> = {
  devoffice: [
    { label: 'GitHub', url: 'https://github.com', kind: 'tool' },
    { label: 'Vercel', url: 'https://vercel.com/dashboard', kind: 'tool' },
    { label: 'Linear', url: 'https://linear.app', kind: 'tool' },
  ],
  broadcast: [{ label: 'YouTube Studio', url: 'https://studio.youtube.com', kind: 'tool' }],
};

export interface LaneInputs {
  os?: OsDoc | null;
  loops?: LoopsSpine | null;
  daily?: DailyCheckout | null;
}

/** Build the lane registry from the user's own current records. */
export function buildLaneRegistry({ os, loops, daily }: LaneInputs): Lane[] {
  let base = os?.lanes ?? [];
  if (!base.length && daily?.lanes.length) base = daily.lanes.map((id) => ({ id, closed: false }));
  if (!base.length && loops) {
    base = loops.sections
      .map((s) => s.heading.split(/[/(,]/)[0].trim().toLowerCase().replace(/\s+/g, '-'))
      .filter((id) => id && !/next|killed|closed|bet|money|system/.test(id))
      .map((id) => ({ id, closed: false }));
  }

  const businesses = os?.businesses ?? [];
  // How many lanes each business heading points at (e.g. "A / B wind-down" covers two lanes).
  const sharedBy = new Map<string, number>();
  for (const b of businesses) {
    sharedBy.set(b.name, base.filter((l) => laneMatchScore({ id: l.id, name: prettifyId(l.id) }, b.name) >= 4).length);
  }
  const shells = base.map((l) => {
    let bestBiz: { name: string; text: string } | undefined;
    let bestScore = 0;
    for (const b of businesses) {
      const s = laneMatchScore({ id: l.id, name: prettifyId(l.id) }, b.name);
      if (s > bestScore) {
        bestScore = s;
        bestBiz = b;
      }
    }
    const matched = bestScore >= 4 ? bestBiz : undefined;
    const pretty = prettifyId(l.id);
    let name = pretty;
    if (matched) {
      if ((sharedBy.get(matched.name) ?? 0) > 1) {
        // Shared heading: use the segment that names this lane.
        const segs = matched.name.split('/').map((s) => s.trim()).filter(Boolean);
        let bestSeg = pretty;
        let segScore = 0;
        for (const seg of segs) {
          const sc = laneMatchScore({ id: l.id, name: pretty }, seg);
          if (sc > segScore) {
            segScore = sc;
            bestSeg = seg;
          }
        }
        name = bestSeg;
      } else if (matched.name.length <= 32) {
        name = matched.name;
      }
    }
    return { id: l.id, name, note: l.note, closed: l.closed || /lane closed/i.test(matched?.text ?? ''), description: matched?.text };
  });

  // Assign loops sections to lanes.
  const sectionLane = new Map<string, string | undefined>();
  if (loops) {
    for (const s of loops.sections) {
      const text = loops.items
        .filter((i) => i.section === s.heading)
        .map((i) => `${i.title} ${i.text}`)
        .join(' ');
      sectionLane.set(s.heading, /next \d+ hours|this week/i.test(s.heading) ? undefined : bestLaneFor(shells, s.heading, text));
    }
    for (const s of loops.sections) s.laneId = sectionLane.get(s.heading);
    for (const it of loops.items) it.laneId = sectionLane.get(it.section);
  }

  return shells.map((shell) => {
    const laneLoops: LoopItem[] = loops ? loops.items.filter((i) => i.laneId === shell.id) : [];
    const sectionsFor = loops ? loops.sections.filter((s) => s.laneId === shell.id).map((s) => s.heading) : [];
    const allText = [shell.description ?? '', ...laneLoops.map((i) => `${i.title} ${i.text}`)].join(' ');
    const theme = scoreTheme(shell.id, shell.name, allText);
    const counts = countByStatus(laneLoops);
    const people = [...new Set(laneLoops.filter((i) => i.status === 'waiting' && i.who).map((i) => i.who as string))].slice(0, 8);

    const nameWords = [shell.id, ...significant(tokenize(shell.name))];
    const movedGroup = daily?.moved.find((g) => g.lane === shell.id || laneMatchScore(shell, g.lane) >= 4);
    const decisions = (daily?.decisions ?? []).filter((d) => nameWords.some((w) => w.length >= 4 && `${d.title} ${d.why}`.toLowerCase().includes(w))).slice(0, 4);
    const allocation = os?.allocation.find((a) => laneMatchScore(shell, a.name) >= 4);
    const schedule = (os?.laneMap ?? []).filter((line) => laneMatchScore(shell, line) >= 4).slice(0, 4);

    const links: LaneLink[] = [
      ...extractLinks(allText).slice(0, 6),
      ...(THEME_TOOLS[theme] ?? []),
      { label: `Search Drive for “${shell.name}”`, url: `https://drive.google.com/drive/search?q=${encodeURIComponent(shell.name)}`, kind: 'search' },
      { label: `Search Gmail for “${shell.name}”`, url: `https://mail.google.com/mail/u/0/#search/${encodeURIComponent(shell.name)}`, kind: 'search' },
    ];

    const open = laneLoops.filter(isOpen);
    return {
      id: shell.id,
      name: shell.name,
      note: shell.note,
      closed: shell.closed,
      personal: /^(personal|family|home|life)$/.test(shell.id),
      theme,
      description: shell.description,
      counts,
      openCount: open.length,
      waitingCount: counts.waiting ?? 0,
      loops: laneLoops,
      recent: movedGroup?.items.slice(0, 8) ?? [],
      decisions,
      people,
      links,
      allocation: allocation ? `${allocation.value}${allocation.text ? `: ${allocation.text}` : ''}` : undefined,
      schedule,
      sections: sectionsFor,
    } satisfies Lane;
  });
}

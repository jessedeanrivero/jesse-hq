import 'server-only';
import { cached } from './cache';

export interface WarRoomPage {
  label: string;
  url: string;
  kind: 'sheet' | 'recap' | 'page';
  season?: number;
  week?: number;
}

export interface WarRoomData {
  site: string;
  headline?: string;
  pages: WarRoomPage[];
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

const ROUND: Record<string, string> = { wc: 'Wild Card', div: 'Divisional', conf: 'Conference', sb: 'Super Bowl' };

export function labelForPath(path: string): WarRoomPage | null {
  const m = path.match(/\/g\/(\d{4})-(w(\d+)|wc|div|conf|sb)(-recap)?\/?$/i);
  if (m) {
    const season = Number(m[1]);
    const recap = !!m[4];
    const week = m[3] ? Number(m[3]) : undefined;
    const round = m[3] ? `Week ${m[3]}` : `${season} ${ROUND[m[2].toLowerCase()] ?? m[2]}`;
    return { label: `${round} ${recap ? 'recap' : 'game sheet'}`, url: path, kind: recap ? 'recap' : 'sheet', season, week };
  }
  if (/\/calltheplays\/?$/i.test(path)) return { label: 'Call the Plays', url: path, kind: 'page' };
  if (/\/prototype\/?$/i.test(path)) return { label: 'War Room Pocket prototype', url: path, kind: 'page' };
  return null;
}

export function parseSitemap(xml: string): string[] {
  return [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1]);
}

function sortPages(pages: WarRoomPage[]): WarRoomPage[] {
  return pages.sort((a, b) => (b.season ?? 0) - (a.season ?? 0) || (b.week ?? -1) - (a.week ?? -1) || (a.kind === 'sheet' ? -1 : 1));
}

async function get(url: string): Promise<Response> {
  return fetch(url, { signal: AbortSignal.timeout(7000), headers: { 'User-Agent': 'JesseHQ/1.0 (+private dashboard)' }, cache: 'no-store' });
}

/** Public data from the football site: its pages, current headline and the picks leaderboard. */
export async function loadWarRoom(base: string, now = new Date()): Promise<WarRoomData> {
  return cached(`warroom:${base}`, 10 * 60_000, async () => {
    const errors: string[] = [];
    const byUrl = new Map<string, WarRoomPage>();
    let headline: string | undefined;
    const origin = new URL(base).origin;

    try {
      const r = await get(`${origin}/sitemap.xml`);
      if (r.ok) {
        for (const loc of parseSitemap(await r.text())) {
          const p = labelForPath(new URL(loc).pathname);
          if (p) byUrl.set(p.url, { ...p, url: `${origin}${p.url}` });
        }
      } else errors.push(`sitemap returned ${r.status}`);
    } catch {
      errors.push('sitemap unreachable');
    }

    try {
      const r = await get(origin + '/');
      if (r.ok) {
        const html = await r.text();
        headline = html.match(/<title>([^<]+)<\/title>/i)?.[1]?.split('|')[0]?.trim();
        for (const m of html.matchAll(/href="(\/[^"#?]+)"/g)) {
          const p = labelForPath(m[1]);
          if (p && !byUrl.has(p.url)) byUrl.set(p.url, { ...p, url: `${origin}${p.url}` });
        }
      } else errors.push(`home page returned ${r.status}`);
    } catch {
      errors.push('home page unreachable');
    }

    let leaderboard: WarRoomData['leaderboard'];
    const season0 = now.getUTCMonth() >= 2 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
    for (const season of [season0, season0 - 1]) {
      try {
        const r = await get(`${origin}/data/${season}-prediction-leaderboard.json`);
        if (!r.ok) continue;
        const j = (await r.json()) as {
          season?: number;
          currentWeek?: number;
          standingsThroughWeek?: number;
          lastUpdated?: string;
          standings?: { name?: string; total?: number; rank?: number; average?: number }[];
          weeks?: Record<string, { opponent?: string; date?: string; status?: string; actual?: unknown }>;
        };
        const weeks = Object.entries(j.weeks ?? {})
          .map(([w, v]) => ({ week: Number(w), ...v }))
          .sort((a, b) => a.week - b.week);
        const next = weeks.find((w) => !w.actual && w.status !== 'final');
        leaderboard = {
          season: j.season ?? season,
          currentWeek: j.currentWeek,
          throughWeek: j.standingsThroughWeek,
          lastUpdated: j.lastUpdated,
          standings: (j.standings ?? [])
            .filter((s) => s.name)
            .map((s) => ({ name: String(s.name), total: Number(s.total ?? 0), rank: Number(s.rank ?? 0), average: s.average }))
            .sort((a, b) => a.rank - b.rank)
            .slice(0, 10),
          nextGame: next ? { week: next.week, opponent: next.opponent, date: next.date, status: next.status } : undefined,
        };
        break;
      } catch {
        // try previous season
      }
    }
    if (!leaderboard) errors.push('no leaderboard file found');

    return { site: origin, headline, pages: sortPages([...byUrl.values()]), leaderboard, fetchedAt: new Date().toISOString(), errors };
  });
}

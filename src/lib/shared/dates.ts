import type { Freshness, SourceKind } from './types';

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const DEFAULT_TZ = 'America/Chicago';

/** YYYY-MM-DD for an instant in a time zone. */
export function ymdIn(date: Date, tz: string = DEFAULT_TZ): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

export function todayIn(tz: string = DEFAULT_TZ, now: Date = new Date()): string {
  return ymdIn(now, tz);
}

function toUtc(ymd: string): number {
  const [y, m, d] = ymd.split('-').map(Number);
  return Date.UTC(y, (m || 1) - 1, d || 1);
}

/** Whole days from a to b (b - a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((toUtc(b) - toUtc(a)) / 86400000);
}

export function addDays(ymd: string, n: number): string {
  return new Date(toUtc(ymd) + n * 86400000).toISOString().slice(0, 10);
}

export function weekdayOf(ymd: string): string {
  return WEEKDAYS[new Date(toUtc(ymd)).getUTCDay()];
}

export function formatShort(ymd: string): string {
  const [, m, d] = ymd.split('-').map(Number);
  return `${weekdayOf(ymd)} ${m}/${d}`;
}

export function relativeDay(ymd: string, today: string): string {
  const n = daysBetween(today, ymd);
  if (n === 0) return 'today';
  if (n === 1) return 'tomorrow';
  if (n === -1) return 'yesterday';
  if (n > 1 && n < 7) return `in ${n} days`;
  if (n < -1 && n > -14) return `${-n} days ago`;
  return formatShort(ymd);
}

/** Freshness of a record relative to today. */
export function freshnessFor(kind: SourceKind, date: string | undefined, today: string): Freshness {
  if (!date) return 'unknown';
  const age = daysBetween(date, today);
  const limits: Partial<Record<SourceKind, [number, number]>> = {
    daily: [1, 3],
    loops: [1, 3],
    os: [7, 14],
    relationships: [30, 60],
    weekly: [7, 14],
    monthly: [35, 70],
    yearly: [400, 800],
  };
  const [fresh, recent] = limits[kind] ?? [2, 7];
  if (age <= fresh) return 'fresh';
  if (age <= recent) return 'recent';
  return 'stale';
}

function inferYear(month: number, day: number, today: string): number {
  const ty = Number(today.slice(0, 4));
  const candidate = `${ty}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const diff = daysBetween(today, candidate);
  if (diff < -150) return ty + 1;
  if (diff > 300) return ty - 1;
  return ty;
}

function valid(month: number, day: number): boolean {
  return month >= 1 && month <= 12 && day >= 1 && day <= 31;
}

/**
 * Find the first date mentioned in free text: "2026-11-23", "Nov 23", "Mon 11/23", "11/23/26".
 * Years are inferred relative to today when missing.
 */
export function extractDate(text: string, today: string): { iso: string; label: string } | null {
  if (!text) return null;
  const found: { index: number; iso: string; label: string }[] = [];
  const iso = /\b(20\d{2})-(\d{2})-(\d{2})\b/.exec(text);
  if (iso && valid(Number(iso[2]), Number(iso[3]))) found.push({ index: iso.index, iso: iso[0], label: iso[0] });

  const named = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(20\d{2}))?\b/i.exec(text);
  if (named) {
    const month = MONTHS.indexOf(named[1].slice(0, 3).toLowerCase()) + 1;
    const day = Number(named[2]);
    if (valid(month, day)) {
      const year = named[3] ? Number(named[3]) : inferYear(month, day, today);
      found.push({ index: named.index, iso: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`, label: named[0] });
    }
  }

  const slash = /(?<![\d/$.])(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?(?![\d/%])/g;
  let m: RegExpExecArray | null;
  while ((m = slash.exec(text))) {
    const month = Number(m[1]);
    const day = Number(m[2]);
    if (!valid(month, day)) continue;
    let year = m[3] ? Number(m[3]) : inferYear(month, day, today);
    if (year < 100) year += 2000;
    found.push({ index: m.index, iso: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`, label: m[0] });
    break;
  }
  if (!found.length) return null;
  found.sort((a, b) => a.index - b.index);
  return { iso: found[0].iso, label: found[0].label };
}

/** Date carried in a filename like 2026-11-06.md, loops-2026-11-06.md or 2026-10.md. */
export function dateFromName(name: string): string | undefined {
  const full = name.match(/(20\d{2})-(\d{2})-(\d{2})/);
  if (full) return `${full[1]}-${full[2]}-${full[3]}`;
  const month = name.match(/(20\d{2})-(\d{2})(?!\d)/);
  if (month) return `${month[1]}-${month[2]}-01`;
  return undefined;
}

export function greetingFor(hour: number): string {
  if (hour < 5) return 'Late night';
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function hourIn(tz: string = DEFAULT_TZ, now: Date = new Date()): number {
  try {
    return Number(new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hourCycle: 'h23' }).format(now));
  } catch {
    return now.getHours();
  }
}

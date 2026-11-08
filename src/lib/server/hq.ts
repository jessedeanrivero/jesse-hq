import 'server-only';
import { cfg } from './config';
import { upcomingEvents, eventDay } from './calendar';
import { GoogleClient } from './google';
import { loadDaily, loadLoops, loadOs, settle } from './os-resolver';
import { addDays, todayIn } from '@/lib/shared/dates';
import { publicCheckout } from '@/lib/shared/daily';
import { buildLaneRegistry } from '@/lib/shared/lanes';
import { countByStatus, isOpen } from '@/lib/shared/loops';
import type { DailyCheckout, DeadlineItem, Lane, LoopItem, LoopsSpine, OsDoc, PartError } from '@/lib/shared/types';

const SENSITIVE_TAG = /^(money|family|health|personal|medical|kids)$/i;
const SENSITIVE_SECTION = /\b(money|personal|health|family|finances?)\b/i;

/** Items that belong in the Personal Space rather than on shared screens. */
export function isSensitive(it: LoopItem, personalLanes: Set<string>): boolean {
  return (!!it.laneId && personalLanes.has(it.laneId)) || SENSITIVE_SECTION.test(it.section) || it.tagParts.some((p) => SENSITIVE_TAG.test(p));
}

export interface Context {
  today: string;
  tz: string;
  daily: DailyCheckout | null;
  loops: LoopsSpine | null;
  os: OsDoc | null;
  lanes: Lane[];
  personalLanes: Set<string>;
  errors: PartError[];
}

export async function loadContext(g: GoogleClient): Promise<Context> {
  const tz = cfg().tz;
  const today = todayIn(tz);
  const errors: PartError[] = [];
  const [daily, loops, os] = await Promise.all([
    settle('Latest checkout', loadDaily(g, today), errors),
    settle('Loops spine', loadLoops(g, today), errors),
    settle('Operating system file', loadOs(g, today), errors),
  ]);
  const lanes = buildLaneRegistry({ os, loops, daily });
  const personalLanes = new Set(lanes.filter((l) => l.personal).map((l) => l.id));
  return { today, tz, daily, loops, os, lanes, personalLanes, errors };
}

function slimLoop(it: LoopItem) {
  return { id: it.id, title: it.title, text: it.text, status: it.status, tag: it.tag, who: it.who, section: it.section, laneId: it.laneId, due: it.due, dueLabel: it.dueLabel };
}

export function deadlinesFrom(ctx: Context, horizonDays = 21): DeadlineItem[] {
  const out: DeadlineItem[] = [];
  const until = addDays(ctx.today, horizonDays);
  const consider = (it: LoopItem, origin: DeadlineItem['origin']) => {
    if (!it.due || !isOpen(it) || isSensitive(it, ctx.personalLanes)) return;
    if (it.due < ctx.today || it.due > until) return;
    out.push({ title: it.title, date: it.due, label: it.dueLabel ?? it.due, laneId: it.laneId, status: it.status, origin });
  };
  ctx.daily?.openLoops.forEach((it) => consider(it, 'checkout'));
  ctx.loops?.items.forEach((it) => consider(it, 'loops'));
  const seen = new Set<string>();
  return out
    .sort((a, b) => a.date.localeCompare(b.date))
    .filter((d) => {
      const k = d.title.toLowerCase().slice(0, 40);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, 14);
}

export async function buildOverview(g: GoogleClient) {
  const ctx = await loadContext(g);
  const cal = await settle('Calendar', upcomingEvents(g, ctx.tz, 7), ctx.errors);
  const visible = (ctx.loops?.items ?? []).filter((it) => !isSensitive(it, ctx.personalLanes));
  const open = visible.filter(isOpen);
  const pick = (status: LoopItem['status'], n: number) => open.filter((i) => i.status === status).slice(0, n).map(slimLoop);
  const checkout = ctx.daily ? publicCheckout(ctx.daily) : null;
  return {
    now: new Date().toISOString(),
    today: ctx.today,
    tz: ctx.tz,
    checkout: checkout
      ? { ...checkout, openLoops: checkout.openLoops.filter((it) => !isSensitive(it, ctx.personalLanes)).map(slimLoop), coach: undefined, syncNotes: undefined, instrumentation: undefined }
      : null,
    loops: ctx.loops
      ? {
          source: ctx.loops.source,
          updated: ctx.loops.updated,
          counts: countByStatus(visible),
          owed: pick('owed', 12),
          waiting: pick('waiting', 12),
          scheduled: pick('scheduled', 10),
          decide: [...pick('decide', 10), ...(checkout?.openLoops ?? []).filter((i) => i.status === 'decide').map(slimLoop)],
          next: ctx.loops.next.filter((i) => isOpen(i) && !isSensitive(i, ctx.personalLanes)).map(slimLoop),
          recentlyClosed: ctx.loops.recentlyClosed.slice(0, 3),
        }
      : null,
    os: ctx.os
      ? { source: ctx.os.source, updated: ctx.os.updated, changeSummary: ctx.os.changeSummary, allocation: ctx.os.allocation, weekPlan: ctx.os.weekPlan, laneMap: ctx.os.laneMap }
      : null,
    calendar: cal
      ? {
          calendars: cal.calendars,
          skipped: cal.skipped,
          today: cal.events.filter((e) => eventDay(e, ctx.tz) === ctx.today),
          upcoming: cal.events.filter((e) => eventDay(e, ctx.tz) > ctx.today).slice(0, 30),
        }
      : null,
    deadlines: deadlinesFrom(ctx),
    lanes: ctx.lanes.map((l) => ({ id: l.id, name: l.name, theme: l.theme, closed: l.closed, personal: l.personal, openCount: l.openCount, waitingCount: l.waitingCount, recent: l.recent.length })),
    sources: [ctx.daily?.source, ctx.loops?.source, ctx.os?.source].filter(Boolean),
    errors: ctx.errors,
  };
}

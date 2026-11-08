import { isSensitive, loadContext } from '@/lib/server/hq';
import { loadUndated, settle } from '@/lib/server/os-resolver';
import { withGoogle } from '@/lib/server/route';
import { parseDoc } from '@/lib/shared/markdown';

export const dynamic = 'force-dynamic';

/**
 * Personal Space data. Only requested from inside the Personal Space after a deliberate unlock,
 * and the UI keeps each section covered until it is revealed.
 */
export async function GET() {
  return withGoogle(async (g) => {
    const ctx = await loadContext(g);
    const errors = [...ctx.errors];
    const [identity, health] = await Promise.all([settle('Identity file', loadUndated(g, 'identity', ctx.today), errors), settle('Health file', loadUndated(g, 'health', ctx.today), errors)]);
    const personalLoops = (ctx.loops?.items ?? []).filter((it) => isSensitive(it, ctx.personalLanes));
    const checkoutPersonal = ctx.daily
      ? { date: ctx.daily.date, ...ctx.daily.personal, items: ctx.daily.openLoops.filter((it) => isSensitive(it, ctx.personalLanes)), moved: ctx.daily.moved.filter((m) => ctx.personalLanes.has(m.lane)) }
      : null;
    return {
      identity: identity ? { doc: parseDoc(identity.raw), source: identity.source } : null,
      health: health ? { doc: parseDoc(health.raw), source: health.source } : null,
      os: ctx.os ? { goals: ctx.os.goals, lifeDirection: ctx.os.lifeDirection, energy: ctx.os.energy, health: ctx.os.health, source: ctx.os.source } : null,
      checkout: checkoutPersonal ? { ...checkoutPersonal, source: ctx.daily!.source } : null,
      loops: { items: personalLoops, source: ctx.loops?.source ?? null },
      errors,
    };
  });
}

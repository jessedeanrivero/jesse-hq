import { loadContext, isSensitive } from '@/lib/server/hq';
import { withGoogle } from '@/lib/server/route';

export const dynamic = 'force-dynamic';

/** The lane registry, generated from the current OS file, loops spine and latest checkout. */
export async function GET() {
  return withGoogle(async (g) => {
    const ctx = await loadContext(g);
    return {
      lanes: ctx.lanes.map((l) => ({ ...l, loops: l.loops.filter((it) => !isSensitive(it, ctx.personalLanes)) })),
      sources: [ctx.os?.source, ctx.loops?.source, ctx.daily?.source].filter(Boolean),
      errors: ctx.errors,
    };
  });
}

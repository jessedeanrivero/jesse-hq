import { loadContext, isSensitive } from '@/lib/server/hq';
import { withGoogle } from '@/lib/server/route';
import { countByStatus } from '@/lib/shared/loops';

export const dynamic = 'force-dynamic';

/** The whole loops spine with lane assignments. Personal and money items are flagged so the UI hides them by default. */
export async function GET() {
  return withGoogle(async (g) => {
    const ctx = await loadContext(g);
    if (!ctx.loops) return { loops: null, errors: ctx.errors };
    const items = ctx.loops.items.map((it) => ({ ...it, sensitive: isSensitive(it, ctx.personalLanes) }));
    return {
      loops: {
        source: ctx.loops.source,
        updated: ctx.loops.updated,
        counts: countByStatus(items.filter((i) => !i.sensitive)),
        items,
        sections: ctx.loops.sections,
        next: ctx.loops.next.map((it) => ({ ...it, sensitive: isSensitive(it, ctx.personalLanes) })),
        recentlyClosed: ctx.loops.recentlyClosed,
        killed: ctx.loops.killed,
      },
      lanes: ctx.lanes.map((l) => ({ id: l.id, name: l.name })),
      errors: ctx.errors,
    };
  });
}

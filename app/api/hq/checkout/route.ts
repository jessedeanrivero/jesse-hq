import { loadContext, isSensitive } from '@/lib/server/hq';
import { withGoogle } from '@/lib/server/route';
import { publicCheckout } from '@/lib/shared/daily';

export const dynamic = 'force-dynamic';

/** The latest daily checkout, full sections (personal advocacy and health fields stay in the Personal Space). */
export async function GET() {
  return withGoogle(async (g) => {
    const ctx = await loadContext(g);
    if (!ctx.daily) return { checkout: null, errors: ctx.errors };
    const c = publicCheckout(ctx.daily);
    return {
      checkout: { ...c, openLoops: c.openLoops.map((it) => ({ ...it, sensitive: isSensitive(it, ctx.personalLanes) })) },
      errors: ctx.errors,
    };
  });
}

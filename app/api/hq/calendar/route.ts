import { upcomingEvents } from '@/lib/server/calendar';
import { cfg, SCOPES } from '@/lib/server/config';
import { hqError } from '@/lib/server/google';
import { withGoogle } from '@/lib/server/route';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const days = Math.min(30, Math.max(1, Number(new URL(req.url).searchParams.get('days') ?? 7) || 7));
  return withGoogle(async (g) => {
    if (!g.hasScope(SCOPES.calendarRead)) throw hqError('missing_scope', 'Calendar access was not granted.', 'Sign out, sign in again and allow calendar access.');
    const r = await upcomingEvents(g, cfg().tz, days);
    return { ...r, tz: cfg().tz };
  });
}

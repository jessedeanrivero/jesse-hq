import { cfg } from '@/lib/server/config';
import { json } from '@/lib/server/route';
import { loadWarRoom } from '@/lib/server/warroom';

export const dynamic = 'force-dynamic';

/** Public data from the football site (sitemap, headline, picks leaderboard). No sign-in needed. */
export async function GET() {
  try {
    return json(await loadWarRoom(cfg().warroomUrl));
  } catch {
    return json({ site: cfg().warroomUrl, pages: [], fetchedAt: new Date().toISOString(), errors: ['site unreachable'] });
  }
}

import { cfg } from '@/lib/server/config';
import { loadOs } from '@/lib/server/os-resolver';
import { withGoogle } from '@/lib/server/route';
import { todayIn } from '@/lib/shared/dates';
import { publicOs } from '@/lib/shared/osdoc';

export const dynamic = 'force-dynamic';

export async function GET() {
  return withGoogle(async (g) => {
    const os = await loadOs(g, todayIn(cfg().tz));
    return { os: os ? publicOs(os) : null };
  });
}

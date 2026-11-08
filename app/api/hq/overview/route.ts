import { buildOverview } from '@/lib/server/hq';
import { withGoogle } from '@/lib/server/route';

export const dynamic = 'force-dynamic';

export async function GET() {
  return withGoogle((g) => buildOverview(g));
}

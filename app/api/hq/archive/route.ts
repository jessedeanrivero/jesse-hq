import { cfg } from '@/lib/server/config';
import { fileUrl, listFolder } from '@/lib/server/drive';
import { hqError } from '@/lib/server/google';
import { PATTERNS, isRetired, resolveFolders } from '@/lib/server/os-resolver';
import { withGoogle } from '@/lib/server/route';
import { dateFromName, freshnessFor, todayIn } from '@/lib/shared/dates';

export const dynamic = 'force-dynamic';

const KINDS = ['daily', 'weekly', 'monthly', 'yearly', 'loops', 'os'] as const;
type Kind = (typeof KINDS)[number];

/** Lists historical records by kind, newest first. Retired (VOID-, superseded) files are left out. */
export async function GET(req: Request) {
  const kind = (new URL(req.url).searchParams.get('kind') ?? 'daily') as Kind;
  return withGoogle(async (g) => {
    if (!KINDS.includes(kind)) throw hqError('bad_request', 'Unknown archive kind.');
    const fm = await resolveFolders(g);
    const folder = fm.roles[kind];
    if (!folder) return { kind, files: [], folder: null };
    const pattern = PATTERNS[kind];
    const today = todayIn(cfg().tz);
    const files = (await listFolder(g, folder.id))
      .filter((f) => !isRetired(f.name) && pattern.test(f.name))
      .map((f) => {
        const date = dateFromName(f.name);
        return { id: f.id, name: f.name, date, url: fileUrl(f), modifiedTime: f.modifiedTime, freshness: freshnessFor(kind, date, today) };
      })
      .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
      .slice(0, 120);
    return { kind, files, folder: { name: folder.name, url: fileUrl(folder) } };
  });
}

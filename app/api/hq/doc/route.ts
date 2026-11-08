import { cfg } from '@/lib/server/config';
import { FOLDER, fileUrl, getFile, readText } from '@/lib/server/drive';
import { hqError } from '@/lib/server/google';
import { isPrivateExport, isRetired } from '@/lib/server/os-resolver';
import { withGoogle } from '@/lib/server/route';
import { dateFromName, freshnessFor, todayIn } from '@/lib/shared/dates';
import { parseDoc } from '@/lib/shared/markdown';

export const dynamic = 'force-dynamic';

const PERSONAL_KEYS = new Set(['health', 'energy', 'line_flag', 'price_spend', 'avoidance', 'reading']);

/** Read one Drive document as normalized sections, with a link back to the original. Read-only. */
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get('id') ?? '';
  return withGoogle(async (g) => {
    if (!/^[\w-]{10,}$/.test(id)) throw hqError('bad_request', 'Missing or invalid file id.');
    const f = await getFile(g, id);
    if (f.mimeType === FOLDER) throw hqError('bad_request', 'That is a folder.');
    if (isRetired(f.name)) throw hqError('forbidden', 'That file is retired (VOID or superseded) and is not shown.');
    if (await isPrivateExport(g, f)) throw hqError('forbidden', 'Message exports hold other people’s words and are never shown here.');
    const ok = f.mimeType.startsWith('text/') || f.mimeType === 'application/vnd.google-apps.document' || /\.(md|txt)$/i.test(f.name);
    if (!ok) return { doc: null, source: { name: f.name, url: fileUrl(f) }, note: 'This file type opens in Drive.' };
    const parsed = parseDoc(await readText(g, f));
    const frontmatter = Object.fromEntries(Object.entries(parsed.frontmatter).filter(([k]) => !PERSONAL_KEYS.has(k)));
    const date = dateFromName(f.name);
    return {
      doc: { ...parsed, frontmatter },
      source: { kind: 'other', name: f.name, id: f.id, url: fileUrl(f), modifiedTime: f.modifiedTime, date, freshness: freshnessFor('other', date, todayIn(cfg().tz)) },
    };
  });
}

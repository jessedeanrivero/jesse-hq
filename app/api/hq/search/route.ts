import { fileUrl, searchDrive } from '@/lib/server/drive';
import { hqError } from '@/lib/server/google';
import { isSensitive, loadContext } from '@/lib/server/hq';
import { isPrivateExport, isRetired, settle } from '@/lib/server/os-resolver';
import { withGoogle } from '@/lib/server/route';
import type { PartError } from '@/lib/shared/types';

export const dynamic = 'force-dynamic';

/** Drive search plus a quick match over loops, lanes and people from the current records. */
export async function GET(req: Request) {
  const q = (new URL(req.url).searchParams.get('q') ?? '').trim();
  return withGoogle(async (g) => {
    if (q.length < 2) throw hqError('bad_request', 'Type at least two characters.');
    if (q.length > 120) throw hqError('bad_request', 'That search is too long.');
    const errors: PartError[] = [];
    const [files, ctx] = await Promise.all([settle('Drive search', searchDrive(g, q, 30), errors), settle('Context', loadContext(g), errors)]);
    const visible = [];
    for (const f of files ?? []) {
      if (isRetired(f.name)) continue;
      if (await isPrivateExport(g, f)) continue;
      visible.push({ id: f.id, name: f.name, url: fileUrl(f), modifiedTime: f.modifiedTime, mimeType: f.mimeType });
    }
    const needle = q.toLowerCase();
    const loops = (ctx?.loops?.items ?? [])
      .filter((it) => !isSensitive(it, ctx!.personalLanes) && `${it.title} ${it.text} ${it.tag}`.toLowerCase().includes(needle))
      .slice(0, 20)
      .map((it) => ({ id: it.id, title: it.title, status: it.status, laneId: it.laneId, section: it.section, who: it.who, due: it.due }));
    const lanes = (ctx?.lanes ?? []).filter((l) => !l.personal && `${l.id} ${l.name} ${l.description ?? ''}`.toLowerCase().includes(needle)).map((l) => ({ id: l.id, name: l.name }));
    const people = [...new Set((ctx?.lanes ?? []).flatMap((l) => l.people))].filter((p) => p.toLowerCase().includes(needle)).slice(0, 10);
    return { q, files: visible.slice(0, 20), loops, lanes, people, loopsSource: ctx?.loops?.source ?? null, errors: [...errors, ...(ctx?.errors ?? [])] };
  });
}

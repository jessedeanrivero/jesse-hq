import { cfg } from '@/lib/server/config';
import { FOLDER, fileUrl, listFolder } from '@/lib/server/drive';
import { loadContext } from '@/lib/server/hq';
import { resolveFolders, settle } from '@/lib/server/os-resolver';
import { withGoogle } from '@/lib/server/route';
import { ideasFromFolders, ideasFromLoops, ideasFromOs, type FolderIdeaInput } from '@/lib/shared/ideas';
import type { PartError } from '@/lib/shared/types';

export const dynamic = 'force-dynamic';

const CREATIVE_FOLDER = /\b(games?|recipes?|ideas?|dreams?|someday|creative|projects?)\b/i;

/** Ideas and aspirations already written down. Nothing here is a commitment. */
export async function GET() {
  return withGoogle(async (g) => {
    const errors: PartError[] = [];
    const ctx = await loadContext(g);
    errors.push(...ctx.errors);
    const ideas = [...(ctx.loops ? ideasFromLoops(ctx.loops, ctx.today) : []), ...(ctx.os ? ideasFromOs(ctx.os) : [])];

    const folders = await settle(
      'Creative folders',
      (async () => {
        const fm = await resolveFolders(g);
        if (!fm.parentId) return [] as FolderIdeaInput[];
        const siblings = (await listFolder(g, fm.parentId, { foldersOnly: true })).filter((f) => f.id !== fm.root.id && CREATIVE_FOLDER.test(f.name));
        const out: FolderIdeaInput[] = [];
        for (const folder of siblings.slice(0, 6)) {
          const kids = (await listFolder(g, folder.id)).slice(0, 40);
          out.push({ folderName: folder.name, folderUrl: fileUrl(folder), files: kids.map((k) => ({ id: k.id, name: k.mimeType === FOLDER ? k.name : k.name, url: fileUrl(k), modifiedTime: k.modifiedTime })) });
        }
        return out;
      })(),
      errors
    );
    if (folders) ideas.push(...ideasFromFolders(folders));
    void cfg;
    return { ideas, today: ctx.today, sources: [ctx.loops?.source, ctx.os?.source].filter(Boolean), errors };
  });
}

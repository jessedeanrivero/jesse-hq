import { cfg } from '@/lib/server/config';
import { FOLDER, fileUrl, listFolder, type DriveFile } from '@/lib/server/drive';
import { isRetired, resolveFolders, settle } from '@/lib/server/os-resolver';
import { withGoogle } from '@/lib/server/route';
import { daysBetween, todayIn, ymdIn } from '@/lib/shared/dates';
import type { PartError } from '@/lib/shared/types';

export const dynamic = 'force-dynamic';

/**
 * What the existing workflows have actually written to Drive. This never claims a run happened:
 * it reports the newest file it can see in each output folder and when that file was written.
 */
export async function GET() {
  return withGoogle(async (g) => {
    const tz = cfg().tz;
    const today = todayIn(tz);
    const errors: PartError[] = [];
    const fm = await resolveFolders(g);
    const entries: { role: string; folder: DriveFile }[] = [
      ...Object.entries(fm.roles).map(([role, folder]) => ({ role, folder: folder as DriveFile })),
      ...fm.others.map((folder) => ({ role: 'other', folder })),
    ];
    const outputs = await Promise.all(
      entries.map(async ({ role, folder }) => {
        const files = await settle(folder.name, listFolder(g, folder.id), errors);
        const live = (files ?? []).filter((f) => f.mimeType !== FOLDER && !isRetired(f.name));
        const newest = [...live].sort((a, b) => (b.modifiedTime ?? '').localeCompare(a.modifiedTime ?? ''))[0];
        const weekAgo = Date.now() - 7 * 86400_000;
        const lastWeek = live.filter((f) => f.modifiedTime && Date.parse(f.modifiedTime) >= weekAgo).length;
        const newestDay = newest?.modifiedTime ? ymdIn(new Date(newest.modifiedTime), tz) : undefined;
        const privateFolder = role === 'texts';
        return {
          role,
          folder: { name: folder.name, url: fileUrl(folder) },
          newest: newest
            ? {
                // Message exports: show only that something was written, never names that could be opened.
                name: privateFolder ? 'latest export' : newest.name,
                url: privateFolder ? undefined : fileUrl(newest),
                modifiedTime: newest.modifiedTime,
                ageDays: newestDay ? daysBetween(newestDay, today) : undefined,
              }
            : null,
          filesLast7Days: lastWeek,
        };
      })
    );
    return { today, outputs, errors };
  });
}

import { cfg, SCOPES } from '@/lib/server/config';
import { FOLDER, createMarkdownFile, fileUrl, listFiles, type DriveFile } from '@/lib/server/drive';
import { GoogleClient, hqError } from '@/lib/server/google';
import { withGoogle, json } from '@/lib/server/route';
import { todayIn } from '@/lib/shared/dates';

export const dynamic = 'force-dynamic';

const FOLDER_NAME = 'Jesse HQ Dream Journal';
const API = 'https://www.googleapis.com/drive/v3';

async function findAppFolder(g: GoogleClient): Promise<DriveFile | null> {
  const found = await listFiles(g, `mimeType = '${FOLDER}' and trashed = false and appProperties has { key='jhq' and value='journal' }`, { pageSize: 5, maxPages: 1 });
  return found[0] ?? null;
}

async function createAppFolder(g: GoogleClient): Promise<DriveFile> {
  return g.json<DriveFile>(`${API}/files?fields=id,name,mimeType,webViewLink`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: FOLDER_NAME, mimeType: FOLDER, appProperties: { jhq: 'journal' }, description: 'New ideas captured in Jesse HQ. Separate from the operating-system records.' }),
  });
}

/**
 * Save a Dream Journal entry. The ONLY write Jesse HQ makes to Drive: a new markdown file in a folder
 * this app created (drive.file scope), never touching existing records. Requires explicit confirmation.
 */
export async function POST(req: Request) {
  const origin = req.headers.get('origin');
  const host = req.headers.get('host');
  if (origin && host && new URL(origin).host !== host) return json({ error: 'Cross-site request refused.', code: 'forbidden' }, 403);
  let body: { text?: string; intent?: string; confirm?: boolean; confirmProject?: boolean; createFolder?: boolean; title?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Expected JSON.', code: 'bad_request' }, 400);
  }
  return withGoogle(async (g) => {
    const text = (body.text ?? '').trim();
    const intent = body.intent === 'explore' || body.intent === 'project' ? body.intent : 'save';
    if (!body.confirm) throw hqError('bad_request', 'Saving needs an explicit confirmation.');
    if (intent === 'project' && !body.confirmProject) throw hqError('bad_request', 'Turning an idea into a project needs its own confirmation.');
    if (!text || text.length > 20000) throw hqError('bad_request', 'Write something first (up to 20,000 characters).');
    if (!g.hasScope(SCOPES.driveFile)) throw hqError('missing_scope', 'Drive file access was not granted, so the journal cannot save.', 'Sign out and sign in again, and allow “See, edit, create and delete only the specific Google Drive files you use with this app.”');

    let folder = await findAppFolder(g);
    if (!folder) {
      if (!body.createFolder) {
        return { needsFolder: true, folderName: FOLDER_NAME, note: 'A new folder will be created in My Drive. You can move it anywhere afterwards; the app keeps access to it.' };
      }
      folder = await createAppFolder(g);
    }

    const tz = cfg().tz;
    const day = todayIn(tz);
    const time = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date()).replace(':', '');
    const name = `dream-${day}-${time}.md`;
    const title = (body.title ?? '').trim().slice(0, 120);
    const lines = [
      '---',
      `date: ${day}`,
      `time: ${time.slice(0, 2)}:${time.slice(2)}`,
      `intent: ${intent}`,
      'source: Jesse HQ Dream Journal',
      '---',
      '',
      title ? `# ${title}` : '# Dream',
      '',
      text,
      '',
    ];
    if (intent === 'project') lines.push('## Proposed project', '', 'Not added to any loops or operating-system file. Bring it to the next checkout if it should go on the spine.', '');
    if (intent === 'explore') lines.push('## To explore', '', '- Smallest fun version:', '- Who would love it:', '- What I already have:', '');
    const file = await createMarkdownFile(g, name, folder.id, lines.join('\n'));
    return { saved: true, file: { id: file.id, name: file.name, url: fileUrl(file) }, folder: { id: folder.id, name: folder.name, url: fileUrl(folder) } };
  });
}

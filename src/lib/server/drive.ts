import 'server-only';
import { cached } from './cache';
import { GoogleClient, hqError } from './google';

const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
export const FOLDER = 'application/vnd.google-apps.folder';
export const GDOC = 'application/vnd.google-apps.document';

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  createdTime?: string;
  webViewLink?: string;
  size?: string;
  parents?: string[];
}

const FIELDS = 'nextPageToken,files(id,name,mimeType,modifiedTime,createdTime,webViewLink,size,parents)';

export function qs(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

export function fileUrl(f: Pick<DriveFile, 'id' | 'mimeType' | 'webViewLink'>): string {
  if (f.webViewLink) return f.webViewLink;
  if (f.mimeType === FOLDER) return `https://drive.google.com/drive/folders/${f.id}`;
  if (f.mimeType === GDOC) return `https://docs.google.com/document/d/${f.id}/edit`;
  return `https://drive.google.com/file/d/${f.id}/view`;
}

export async function listFiles(
  g: GoogleClient,
  q: string,
  opts: { pageSize?: number; orderBy?: string; maxPages?: number } = {}
): Promise<DriveFile[]> {
  const out: DriveFile[] = [];
  let pageToken: string | undefined;
  const maxPages = opts.maxPages ?? 2;
  for (let page = 0; page < maxPages; page++) {
    const params = new URLSearchParams({ q, fields: FIELDS, pageSize: String(opts.pageSize ?? 200), spaces: 'drive' });
    if (opts.orderBy) params.set('orderBy', opts.orderBy);
    if (pageToken) params.set('pageToken', pageToken);
    const j = await g.json<{ files?: DriveFile[]; nextPageToken?: string }>(`${API}/files?${params}`);
    out.push(...(j.files ?? []));
    pageToken = j.nextPageToken;
    if (!pageToken) break;
  }
  return out;
}

export async function listFolder(g: GoogleClient, folderId: string, opts: { foldersOnly?: boolean; ttlMs?: number } = {}): Promise<DriveFile[]> {
  const q = `'${qs(folderId)}' in parents and trashed = false${opts.foldersOnly ? ` and mimeType = '${FOLDER}'` : ''}`;
  return cached(`${g.session.email}:ls:${folderId}:${opts.foldersOnly ? 'f' : 'a'}`, opts.ttlMs ?? 60_000, () =>
    listFiles(g, q, { pageSize: 1000, orderBy: 'name desc', maxPages: 3 })
  );
}

export async function getFile(g: GoogleClient, id: string): Promise<DriveFile> {
  const params = new URLSearchParams({ fields: 'id,name,mimeType,modifiedTime,createdTime,webViewLink,size,parents' });
  return g.json<DriveFile>(`${API}/files/${encodeURIComponent(id)}?${params}`);
}

/** Read a markdown/text file or a Google Doc as text. Cached by id + modified time. */
export async function readText(g: GoogleClient, f: DriveFile): Promise<string> {
  return cached(`${g.session.email}:txt:${f.id}:${f.modifiedTime ?? ''}`, 10 * 60_000, async () => {
    if (f.mimeType === GDOC) {
      try {
        return await g.text(`${API}/files/${encodeURIComponent(f.id)}/export?mimeType=${encodeURIComponent('text/markdown')}`);
      } catch {
        return g.text(`${API}/files/${encodeURIComponent(f.id)}/export?mimeType=${encodeURIComponent('text/plain')}`);
      }
    }
    if (f.mimeType.startsWith('application/vnd.google-apps')) throw hqError('bad_request', 'That kind of Google file cannot be shown as text here.');
    return g.text(`${API}/files/${encodeURIComponent(f.id)}?alt=media`);
  });
}

export async function searchDrive(g: GoogleClient, term: string, limit = 25): Promise<DriveFile[]> {
  const t = qs(term.trim());
  const q = `(name contains '${t}' or fullText contains '${t}') and trashed = false and mimeType != '${FOLDER}'`;
  return listFiles(g, q, { pageSize: limit, maxPages: 1 });
}

export async function createFolder(g: GoogleClient, name: string): Promise<DriveFile> {
  return g.json<DriveFile>(`${API}/files?fields=id,name,mimeType,webViewLink`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, mimeType: FOLDER }),
  });
}

export async function createMarkdownFile(g: GoogleClient, name: string, parentId: string, content: string): Promise<DriveFile> {
  const boundary = `hq${Math.random().toString(36).slice(2)}`;
  const meta = JSON.stringify({ name, parents: [parentId], mimeType: 'text/markdown' });
  const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: text/markdown; charset=UTF-8\r\n\r\n${content}\r\n--${boundary}--`;
  return g.json<DriveFile>(`${UPLOAD}/files?uploadType=multipart&fields=id,name,mimeType,webViewLink,modifiedTime`, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  });
}

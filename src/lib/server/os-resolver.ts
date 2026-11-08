import 'server-only';
import { cached } from './cache';
import { cfg } from './config';
import { FOLDER, fileUrl, getFile, listFiles, listFolder, readText, qs, type DriveFile } from './drive';
import { GoogleClient, hqError } from './google';
import { dateFromName, freshnessFor, todayIn } from '@/lib/shared/dates';
import { parseDailyCheckout } from '@/lib/shared/daily';
import { parseLoopsSpine } from '@/lib/shared/loops';
import { parseOsDoc } from '@/lib/shared/osdoc';
import type { DailyCheckout, LoopsSpine, OsDoc, PartError, SourceKind, SourceRef } from '@/lib/shared/types';

/** Filename conventions of the existing system (dated-current unless noted). */
export const PATTERNS = {
  daily: /^(\d{4}-\d{2}-\d{2})\.md$/i,
  loops: /^loops-(\d{4}-\d{2}-\d{2})\.md$/i,
  os: /^operating-system-(\d{4}-\d{2}-\d{2})\.md$/i,
  relationships: /^relationships-(\d{4}-\d{2}-\d{2})\.md$/i,
  weekly: /^(\d{4}-\d{2}-\d{2})[^/]*\.(md|txt)$/i,
  monthly: /^(\d{4}-\d{2})(?:-\d{2})?[^/]*\.(md|txt)$/i,
  yearly: /^(\d{4})[^/]*\.(md|txt)$/i,
  /** Undated-current (the undated name is live; dated copies are archives) */
  identity: /^[a-z0-9-]*identity\.md$/i,
  health: /^[a-z0-9-]*health\.md$/i,
  lenses: /lenses\.md$/i,
};

export type FolderRole = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'loops' | 'os' | 'texts';

const ROLE_RE: [FolderRole, RegExp][] = [
  ['os', /operating system/i],
  ['daily', /\bdaily\b/i],
  ['weekly', /\bweekly\b/i],
  ['monthly', /\bmonthly\b/i],
  ['yearly', /\byearly\b|\bannual\b/i],
  ['loops', /\bloops?\b/i],
  ['texts', /\btexts?\b|\bimessages?\b|\bsms\b/i],
];
const DEAD_RE = /^0+\s*[—-]\s*system$/i;

export interface FolderMap {
  root: DriveFile;
  parentId?: string;
  roles: Partial<Record<FolderRole, DriveFile>>;
  /** Other numbered folders (social, assistants, …), shown in the Automation Lab */
  others: DriveFile[];
}

export function isRetired(name: string): boolean {
  return /^void-/i.test(name) || /superseded/i.test(name);
}

/** Pick the current dated file: newest date in the name, never VOID-/superseded. */
export function pickLatest(files: DriveFile[], pattern: RegExp): { file: DriveFile; date?: string } | null {
  const cands = files
    .filter((f) => f.mimeType !== FOLDER && !isRetired(f.name) && pattern.test(f.name))
    .map((f) => ({ file: f, date: dateFromName(f.name) ?? (pattern.exec(f.name)?.[1]?.length === 4 ? `${pattern.exec(f.name)?.[1]}-01-01` : undefined) }));
  if (!cands.length) return null;
  cands.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '') || (b.file.modifiedTime ?? '').localeCompare(a.file.modifiedTime ?? ''));
  return cands[0];
}

/** Pick an undated-current file by exact convention (the undated name is live). */
export function pickUndated(files: DriveFile[], pattern: RegExp): DriveFile | null {
  return files.find((f) => f.mimeType !== FOLDER && !isRetired(f.name) && pattern.test(f.name) && !dateFromName(f.name)) ?? null;
}

export function sourceRef(kind: SourceKind, f: DriveFile, today: string, date?: string): SourceRef {
  const d = date ?? dateFromName(f.name);
  return { kind, name: f.name, id: f.id, url: fileUrl(f), modifiedTime: f.modifiedTime, date: d, freshness: freshnessFor(kind, d, today) };
}

export async function resolveFolders(g: GoogleClient): Promise<FolderMap> {
  return cached(`${g.session.email}:folders`, 30 * 60_000, async () => {
    const c = cfg();
    let root: DriveFile | undefined;
    if (c.contextFolderId) {
      root = await getFile(g, c.contextFolderId);
    } else {
      const found = await listFiles(g, `mimeType = '${FOLDER}' and name contains '${qs('Context Building')}' and trashed = false and 'me' in owners`, { pageSize: 20, maxPages: 1 });
      const exact = found.filter((f) => /^\d+\s*[—-]\s*context building$/i.test(f.name.trim()));
      const pool = exact.length ? exact : found;
      for (const f of pool) {
        const kids = await listFolder(g, f.id, { foldersOnly: true });
        if (kids.some((k) => /\bdaily\b/i.test(k.name))) {
          root = f;
          break;
        }
      }
      root = root ?? pool[0];
    }
    if (!root) {
      throw hqError(
        'not_found',
        'Could not find the context folder in Drive.',
        'Looked for a folder named like “01 — Context Building” that holds the numbered Daily / Loops / Operating System folders. Set DRIVE_CONTEXT_FOLDER_ID to pin it.'
      );
    }
    const kids = await listFolder(g, root.id, { foldersOnly: true, ttlMs: 30 * 60_000 });
    const roles: FolderMap['roles'] = {};
    const others: DriveFile[] = [];
    for (const k of kids.sort((a, b) => a.name.localeCompare(b.name))) {
      if (DEAD_RE.test(k.name.trim())) continue;
      const role = ROLE_RE.find(([, re]) => re.test(k.name))?.[0];
      if (role && !roles[role]) roles[role] = k;
      else others.push(k);
    }
    return { root, parentId: root.parents?.[0], roles, others };
  });
}

async function latestIn(g: GoogleClient, folder: DriveFile | undefined, pattern: RegExp) {
  if (!folder) return null;
  const files = await listFolder(g, folder.id);
  return pickLatest(files, pattern);
}

function ownerNames(g: GoogleClient): string[] {
  return [g.session.given, g.session.name?.split(' ')[0]].filter(Boolean).map((n) => (n as string).toLowerCase());
}

export async function loadDaily(g: GoogleClient, today = todayIn(cfg().tz)): Promise<DailyCheckout | null> {
  const fm = await resolveFolders(g);
  if (!fm.roles.daily) throw hqError('not_found', 'No Daily folder found inside the context folder.');
  const hit = await latestIn(g, fm.roles.daily, PATTERNS.daily);
  if (!hit) return null;
  const raw = await readText(g, hit.file);
  return parseDailyCheckout(raw, sourceRef('daily', hit.file, today, hit.date), today, { ownerNames: ownerNames(g) });
}

export async function loadLoops(g: GoogleClient, today = todayIn(cfg().tz)): Promise<LoopsSpine | null> {
  const fm = await resolveFolders(g);
  if (!fm.roles.loops) throw hqError('not_found', 'No Loops folder found inside the context folder.');
  const hit = await latestIn(g, fm.roles.loops, PATTERNS.loops);
  if (!hit) return null;
  const raw = await readText(g, hit.file);
  return parseLoopsSpine(raw, sourceRef('loops', hit.file, today, hit.date), today, { ownerNames: ownerNames(g) });
}

export async function loadOs(g: GoogleClient, today = todayIn(cfg().tz)): Promise<OsDoc | null> {
  const fm = await resolveFolders(g);
  if (!fm.roles.os) throw hqError('not_found', 'No Operating System folder found inside the context folder.');
  const hit = await latestIn(g, fm.roles.os, PATTERNS.os);
  if (!hit) return null;
  const raw = await readText(g, hit.file);
  return parseOsDoc(raw, sourceRef('os', hit.file, today, hit.date));
}

export async function loadRollup(g: GoogleClient, kind: 'weekly' | 'monthly' | 'yearly', today = todayIn(cfg().tz)) {
  const fm = await resolveFolders(g);
  const hit = await latestIn(g, fm.roles[kind], PATTERNS[kind]);
  if (!hit) return null;
  const raw = await readText(g, hit.file);
  return { raw, source: sourceRef(kind, hit.file, today, hit.date) };
}

export async function loadUndated(g: GoogleClient, kind: 'identity' | 'health' | 'lenses', today = todayIn(cfg().tz)) {
  const fm = await resolveFolders(g);
  if (!fm.roles.os) return null;
  const files = await listFolder(g, fm.roles.os.id);
  const f = pickUndated(files, PATTERNS[kind]);
  if (!f) return null;
  const raw = await readText(g, f);
  return { raw, source: sourceRef(kind, f, today, f.modifiedTime?.slice(0, 10)) };
}

/** Run loaders independently so one failure never blanks the whole screen. */
export async function settle<T>(part: string, p: Promise<T>, errors: PartError[]): Promise<T | null> {
  try {
    return await p;
  } catch (e) {
    const err = e as { code?: PartError['code']; message?: string; detail?: string };
    errors.push({ part, message: [err.message ?? 'Failed to load.', err.detail].filter(Boolean).join(' '), code: err.code });
    return null;
  }
}

/** Is this file inside the texts-export folder? Those hold other people's messages and are never shown. */
export async function isPrivateExport(g: GoogleClient, f: DriveFile): Promise<boolean> {
  if (/^pulled-\d{4}-\d{2}-\d{2}/i.test(f.name)) return true;
  try {
    const fm = await resolveFolders(g);
    const texts = fm.roles.texts?.id;
    return !!texts && (f.parents ?? []).includes(texts);
  } catch {
    return false;
  }
}

import 'server-only';
import { cached } from './cache';
import { GoogleClient } from './google';
import type { MailThread } from '@/lib/shared/types';

const API = 'https://gmail.googleapis.com/gmail/v1/users/me';

function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function cleanFrom(v: string): string {
  const m = v.match(/^\s*"?([^"<]+?)"?\s*<[^>]+>\s*$/);
  return (m ? m[1] : v).trim();
}

/** Recent inbox threads from other people (self-sent automation digests are excluded). Metadata only. */
export async function inboxPreview(g: GoogleClient, email: string, max = 12): Promise<{ threads: MailThread[]; unread: number }> {
  return cached(`${email}:gmail:${max}`, 90_000, async () => {
    const q = 'in:inbox newer_than:4d -category:promotions -category:social -from:me';
    const list = await g.json<{ threads?: { id: string }[] }>(`${API}/threads?${new URLSearchParams({ q, maxResults: String(max) })}`);
    const ids = (list.threads ?? []).map((t) => t.id);
    const threads = await Promise.all(
      ids.map(async (id) => {
        const params = new URLSearchParams({ format: 'metadata', fields: 'id,messages(id,labelIds,snippet,payload/headers)' });
        ['From', 'Subject', 'Date'].forEach((h) => params.append('metadataHeaders', h));
        const t = await g.json<{ id: string; messages?: { labelIds?: string[]; snippet?: string; payload?: { headers?: { name: string; value: string }[] } }[] }>(
          `${API}/threads/${id}?${params}`
        );
        const msgs = t.messages ?? [];
        const last = msgs[msgs.length - 1];
        const header = (n: string) => last?.payload?.headers?.find((h) => h.name.toLowerCase() === n.toLowerCase())?.value ?? '';
        const fromRaw = header('From');
        return {
          id: t.id,
          from: cleanFrom(fromRaw),
          fromEmail: fromRaw.match(/<([^>]+)>/)?.[1] ?? (fromRaw.includes('@') ? fromRaw.trim() : undefined),
          subject: header('Subject') || '(no subject)',
          date: header('Date') ? new Date(header('Date')).toISOString() : undefined,
          snippet: decodeEntities(last?.snippet ?? ''),
          unread: msgs.some((m) => m.labelIds?.includes('UNREAD')),
          url: `https://mail.google.com/mail/?authuser=${encodeURIComponent(email)}#all/${t.id}`,
        } satisfies MailThread;
      })
    );
    let unread = 0;
    try {
      const inbox = await g.json<{ threadsUnread?: number }>(`${API}/labels/INBOX`);
      unread = inbox.threadsUnread ?? 0;
    } catch {
      unread = threads.filter((t) => t.unread).length;
    }
    return { threads, unread };
  });
}

import { cfg, SCOPES } from '@/lib/server/config';
import { inboxPreview } from '@/lib/server/gmail';
import { hqError } from '@/lib/server/google';
import { withGoogle } from '@/lib/server/route';

export const dynamic = 'force-dynamic';

/** Inbox preview: sender, subject, date, Gmail's own snippet. Read-only, metadata format. */
export async function GET() {
  return withGoogle(async (g, s) => {
    if (!cfg().gmailPreview) return { disabled: true, threads: [], unread: 0 };
    if (!g.hasScope(SCOPES.gmailRead)) throw hqError('missing_scope', 'Gmail read access was not granted, so inbox previews are off.', 'Gmail itself still opens from the terminal. To get previews, sign out, sign in again and allow Gmail access.');
    return inboxPreview(g, s.email);
  });
}

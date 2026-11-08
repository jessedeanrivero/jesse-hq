import { cfg, missingConfig, SCOPES } from '@/lib/server/config';
import { json } from '@/lib/server/route';
import { readSession } from '@/lib/server/session';

export const dynamic = 'force-dynamic';

export async function GET() {
  const missing = missingConfig();
  const s = missing.length ? null : await readSession();
  const granted = (s?.scope ?? '').split(' ');
  const c = cfg();
  return json({
    configured: missing.length === 0,
    missing: missing.map((m) => ({ name: m.name, why: m.why })),
    signedIn: !!s,
    email: s?.email ?? null,
    firstName: s?.given ?? s?.name?.split(' ')[0] ?? null,
    scopes: s
      ? {
          drive: granted.includes(SCOPES.driveRead),
          driveFile: granted.includes(SCOPES.driveFile),
          calendar: granted.includes(SCOPES.calendarRead),
          gmail: granted.includes(SCOPES.gmailRead),
        }
      : null,
    gmailPreview: c.gmailPreview,
    slackUrl: c.slackUrl || null,
    warroomUrl: c.warroomUrl,
    tz: c.tz,
  });
}

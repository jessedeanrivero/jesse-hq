// Server-only configuration, read at call time so Vercel env changes apply without a rebuild.
import 'server-only';

export function cfg() {
  return {
    googleClientId: process.env.GOOGLE_CLIENT_ID ?? '',
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    authSecret: process.env.AUTH_SECRET ?? '',
    allowedEmails: (process.env.ALLOWED_EMAILS ?? '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
    tz: process.env.HQ_TIMEZONE || 'America/Chicago',
    gmailPreview: process.env.HQ_GMAIL_PREVIEW !== '0',
    contextFolderId: process.env.DRIVE_CONTEXT_FOLDER_ID || '',
    warroomUrl: (process.env.WARROOM_URL || 'https://www.hawkswarroom.com').replace(/\/$/, ''),
    slackUrl: process.env.SLACK_WORKSPACE_URL || '',
  };
}

export interface SetupItem {
  name: string;
  why: string;
}

/** Environment variables that still need setting before sign-in can work. */
export function missingConfig(): SetupItem[] {
  const c = cfg();
  const out: SetupItem[] = [];
  if (!c.googleClientId) out.push({ name: 'GOOGLE_CLIENT_ID', why: 'Google OAuth client ID (web application).' });
  if (!c.googleClientSecret) out.push({ name: 'GOOGLE_CLIENT_SECRET', why: 'Google OAuth client secret.' });
  if (c.authSecret.length < 32) out.push({ name: 'AUTH_SECRET', why: 'At least 32 random characters, used to encrypt the session cookie.' });
  if (!c.allowedEmails.length) out.push({ name: 'ALLOWED_EMAILS', why: 'Which Google account(s) may sign in. Everyone else is refused.' });
  return out;
}

export const SCOPES = {
  driveRead: 'https://www.googleapis.com/auth/drive.readonly',
  driveFile: 'https://www.googleapis.com/auth/drive.file',
  calendarRead: 'https://www.googleapis.com/auth/calendar.readonly',
  gmailRead: 'https://www.googleapis.com/auth/gmail.readonly',
};

export function requestedScopes(): string[] {
  const s = ['openid', 'email', 'profile', SCOPES.driveRead, SCOPES.driveFile, SCOPES.calendarRead];
  if (cfg().gmailPreview) s.push(SCOPES.gmailRead);
  return s;
}

export function isAllowed(email: string | undefined): boolean {
  if (!email) return false;
  return cfg().allowedEmails.includes(email.toLowerCase());
}

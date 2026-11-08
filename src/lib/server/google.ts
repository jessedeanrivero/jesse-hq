import 'server-only';
import { cfg } from './config';
import type { SessionData } from './session';
import type { ApiErrorCode } from '@/lib/shared/types';

export class HqError extends Error {
  constructor(
    public code: ApiErrorCode,
    message: string,
    public status = 500,
    public detail?: string
  ) {
    super(message);
  }
}

const STATUS_FOR: Record<ApiErrorCode, number> = {
  not_configured: 503,
  not_signed_in: 401,
  forbidden: 403,
  missing_scope: 403,
  google_error: 502,
  not_found: 404,
  bad_request: 400,
  unavailable: 503,
};

export function hqError(code: ApiErrorCode, message: string, detail?: string): HqError {
  return new HqError(code, message, STATUS_FOR[code], detail);
}

/** Thin Google REST client using the signed-in user's own token. Refreshes when needed. */
export class GoogleClient {
  dirty = false;
  constructor(public session: SessionData) {}

  hasScope(scope: string): boolean {
    return (this.session.scope ?? '').split(' ').includes(scope);
  }

  async token(force = false): Promise<string> {
    const s = this.session;
    if (!force && s.at && s.exp && s.exp - 60_000 > Date.now()) return s.at;
    if (!s.rt) throw hqError('not_signed_in', 'Your Google session ended. Sign in again.');
    const c = cfg();
    const r = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: c.googleClientId, client_secret: c.googleClientSecret, refresh_token: s.rt, grant_type: 'refresh_token' }),
      cache: 'no-store',
    });
    const j = (await r.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; scope?: string; error?: string };
    if (!r.ok || !j.access_token) {
      if (j.error === 'invalid_grant') {
        throw hqError(
          'not_signed_in',
          'Google access expired or was revoked. Sign in again.',
          'If this happens every week, the OAuth consent screen is still in Testing. Publish it to Production (see docs/SETUP-GOOGLE.md).'
        );
      }
      throw hqError('google_error', 'Google token refresh failed.', j.error);
    }
    this.session = { ...s, at: j.access_token, exp: Date.now() + (j.expires_in ?? 3600) * 1000, scope: j.scope ?? s.scope };
    this.dirty = true;
    return j.access_token;
  }

  async request(url: string, init: RequestInit = {}, retried = false): Promise<Response> {
    const tok = await this.token(retried);
    const r = await fetch(url, { ...init, headers: { ...(init.headers ?? {}), Authorization: `Bearer ${tok}` }, cache: 'no-store' });
    if (r.status === 401 && !retried) return this.request(url, init, true);
    if (!r.ok) {
      const text = await r.text().catch(() => '');
      if (r.status === 403 && /insufficient|scope|PERMISSION_DENIED/i.test(text)) {
        throw hqError('missing_scope', 'Google did not grant the permission this needs.', 'Sign out and sign in again, and keep every box checked on the Google consent screen.');
      }
      if (r.status === 403 && /accessNotConfigured|has not been used|is disabled/i.test(text)) {
        throw hqError('not_configured', 'This Google API is not enabled for the OAuth project.', 'Enable the Drive, Calendar and Gmail APIs in Google Cloud Console (see docs/SETUP-GOOGLE.md).');
      }
      if (r.status === 404) throw hqError('not_found', 'Google could not find that item.');
      throw hqError('google_error', `Google returned ${r.status}.`);
    }
    return r;
  }

  async json<T>(url: string, init?: RequestInit): Promise<T> {
    const r = await this.request(url, init);
    return (await r.json()) as T;
  }

  async text(url: string, maxBytes = 2_000_000): Promise<string> {
    const r = await this.request(url);
    const buf = await r.arrayBuffer();
    if (buf.byteLength > maxBytes) throw hqError('bad_request', 'That file is too large to show here.');
    return new TextDecoder().decode(buf);
  }
}

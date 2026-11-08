import 'server-only';
import { cookies } from 'next/headers';
import { cfg, isAllowed } from './config';
import { seal, unseal } from './crypto';

export const SESSION_COOKIE = 'hq_session';
export const OAUTH_COOKIE = 'hq_oauth';

export interface SessionData {
  v: 1;
  email: string;
  name?: string;
  given?: string;
  /** Google refresh token. Lives only inside the encrypted, httpOnly cookie. */
  rt?: string;
  at?: string;
  /** Access token expiry, epoch ms */
  exp?: number;
  scope?: string;
  iat: number;
}

export interface OAuthState {
  state: string;
  verifier: string;
  returnTo: string;
  ts: number;
}

function secure(): boolean {
  return process.env.NODE_ENV === 'production';
}

export async function readSession(): Promise<SessionData | null> {
  const secret = cfg().authSecret;
  if (!secret) return null;
  const store = await cookies();
  const raw = store.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  const s = await unseal<SessionData>(raw, secret);
  if (!s || s.v !== 1 || !isAllowed(s.email)) return null;
  return s;
}

export async function writeSession(s: SessionData): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, await seal(s, cfg().authSecret), {
    httpOnly: true,
    secure: secure(),
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 180,
  });
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function writeOAuthState(o: OAuthState): Promise<void> {
  const store = await cookies();
  store.set(OAUTH_COOKIE, await seal(o, cfg().authSecret), { httpOnly: true, secure: secure(), sameSite: 'lax', path: '/api/auth', maxAge: 600 });
}

export async function takeOAuthState(): Promise<OAuthState | null> {
  const store = await cookies();
  const raw = store.get(OAUTH_COOKIE)?.value;
  store.delete({ name: OAUTH_COOKIE, path: '/api/auth' });
  if (!raw) return null;
  const o = await unseal<OAuthState>(raw, cfg().authSecret);
  if (!o || Date.now() - o.ts > 10 * 60 * 1000) return null;
  return o;
}

/** Only allow relative in-app return paths. */
export function safeReturn(p: string | null | undefined): string {
  if (!p || !p.startsWith('/') || p.startsWith('//') || p.includes('\\')) return '/';
  return p;
}

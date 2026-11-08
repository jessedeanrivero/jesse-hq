import 'server-only';
import { NextResponse } from 'next/server';
import { missingConfig } from './config';
import { GoogleClient, HqError } from './google';
import { readSession, writeSession, type SessionData } from './session';
import type { ApiError } from '@/lib/shared/types';

export function json(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status, headers: { 'Cache-Control': 'private, no-store' } });
}

export function errorJson(e: unknown): NextResponse {
  if (e instanceof HqError) {
    const body: ApiError = { error: e.message, code: e.code, detail: e.detail };
    return json(body, e.status);
  }
  // Never log private content: only the error class.
  console.error('[hq] unexpected error', (e as Error)?.name ?? 'Error');
  return json({ error: 'Something went wrong loading this.', code: 'google_error' } satisfies ApiError, 500);
}

export function notConfigured(): NextResponse | null {
  const missing = missingConfig();
  if (!missing.length) return null;
  const body: ApiError = {
    error: 'Google sign-in is not set up on this deployment yet.',
    code: 'not_configured',
    setup: missing.map((m) => `${m.name}: ${m.why}`),
  };
  return json(body, 503);
}

/** Run a handler with the signed-in user's Google client; persists refreshed tokens. */
export async function withGoogle(fn: (g: GoogleClient, s: SessionData) => Promise<unknown>): Promise<NextResponse> {
  const nc = notConfigured();
  if (nc) return nc;
  const session = await readSession();
  if (!session) return json({ error: 'Sign in with Google to load your context.', code: 'not_signed_in' } satisfies ApiError, 401);
  const g = new GoogleClient(session);
  try {
    const data = await fn(g, session);
    if (g.dirty) await writeSession(g.session);
    return json(data);
  } catch (e) {
    if (g.dirty) await writeSession(g.session).catch(() => undefined);
    return errorJson(e);
  }
}

import { NextResponse, type NextRequest } from 'next/server';
import { cfg, missingConfig, requestedScopes } from '@/lib/server/config';
import { randomToken, sha256b64url } from '@/lib/server/crypto';
import { safeReturn, writeOAuthState } from '@/lib/server/session';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (missingConfig().length) return NextResponse.redirect(new URL('/?auth=not_configured', req.url));
  const c = cfg();
  const verifier = randomToken(48);
  const state = randomToken(18);
  await writeOAuthState({ state, verifier, returnTo: safeReturn(req.nextUrl.searchParams.get('return')), ts: Date.now() });
  const params = new URLSearchParams({
    client_id: c.googleClientId,
    redirect_uri: `${req.nextUrl.origin}/api/auth/callback`,
    response_type: 'code',
    scope: requestedScopes().join(' '),
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
    code_challenge: await sha256b64url(verifier),
    code_challenge_method: 'S256',
  });
  if (c.allowedEmails.length === 1) params.set('login_hint', c.allowedEmails[0]);
  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
}

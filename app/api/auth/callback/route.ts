import { NextResponse, type NextRequest } from 'next/server';
import { cfg, isAllowed, missingConfig } from '@/lib/server/config';
import { takeOAuthState, writeSession } from '@/lib/server/session';

export const dynamic = 'force-dynamic';

function back(req: NextRequest, path: string) {
  return NextResponse.redirect(new URL(path, req.url));
}

export async function GET(req: NextRequest) {
  if (missingConfig().length) return back(req, '/?auth=not_configured');
  const url = req.nextUrl;
  const saved = await takeOAuthState();
  if (url.searchParams.get('error')) return back(req, '/?auth=denied');
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (!code || !state || !saved || saved.state !== state) return back(req, '/?auth=state');

  const c = cfg();
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: c.googleClientId,
      client_secret: c.googleClientSecret,
      redirect_uri: `${url.origin}/api/auth/callback`,
      grant_type: 'authorization_code',
      code_verifier: saved.verifier,
    }),
    cache: 'no-store',
  });
  const tok = (await tokenRes.json().catch(() => ({}))) as { access_token?: string; refresh_token?: string; expires_in?: number; scope?: string };
  if (!tokenRes.ok || !tok.access_token) return back(req, '/?auth=exchange');

  const infoRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: `Bearer ${tok.access_token}` }, cache: 'no-store' });
  const info = (await infoRes.json().catch(() => ({}))) as { email?: string; email_verified?: boolean; name?: string; given_name?: string };
  if (!info.email || info.email_verified === false || !isAllowed(info.email)) {
    // Not on the allowlist: keep nothing and drop the grant.
    await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(tok.access_token)}`, { method: 'POST' }).catch(() => undefined);
    return back(req, '/?auth=forbidden');
  }

  await writeSession({
    v: 1,
    email: info.email.toLowerCase(),
    name: info.name,
    given: info.given_name,
    rt: tok.refresh_token,
    at: tok.access_token,
    exp: Date.now() + (tok.expires_in ?? 3600) * 1000,
    scope: tok.scope,
    iat: Date.now(),
  });
  const ret = saved.returnTo || '/';
  return back(req, `${ret}${ret.includes('?') ? '&' : '?'}auth=ok`);
}

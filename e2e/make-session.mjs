// Seal a test session cookie the same way the server does (AES-GCM, key from AUTH_SECRET).
// Usage: node e2e/make-session.mjs <AUTH_SECRET> <allowed email>
const enc = new TextEncoder();
const [secret, email] = process.argv.slice(2);
if (!secret || !email) {
  console.error('usage: node e2e/make-session.mjs <AUTH_SECRET> <email>');
  process.exit(1);
}
const hash = await crypto.subtle.digest('SHA-256', enc.encode(`jesse-hq:session:v1:${secret}`));
const key = await crypto.subtle.importKey('raw', hash, 'AES-GCM', false, ['encrypt']);
const iv = crypto.getRandomValues(new Uint8Array(12));
const scope = ['openid', 'drive.readonly', 'drive.file', 'calendar.readonly', 'gmail.readonly'].map((s) => (s === 'openid' ? s : `https://www.googleapis.com/auth/${s}`)).join(' ');
const session = { v: 1, email, name: 'Test Person', given: 'Test', rt: 'fake-refresh', at: 'fake-access', exp: Date.now() + 3600e3, scope, iat: Date.now() };
const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(session))));
const out = new Uint8Array(12 + ct.length);
out.set(iv);
out.set(ct, 12);
console.log(Buffer.from(out).toString('base64url'));

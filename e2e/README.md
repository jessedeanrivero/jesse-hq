# Browser checks

Both scripts drive the system Chrome through puppeteer-core and save screenshots to `e2e/out/` (ignored by git).

## Signed out (`npm run e2e`)

```bash
npm run build && PORT=3100 npx next start -p 3100 &
E2E_BASE=http://localhost:3100 npm run e2e
```

Covers a simulated Xbox controller (move, menus, D-pad focus, A/B/X/Y, LB/RB, View, Menu), typing without moving,
keyboard Esc, the Google-not-configured state, offline, a blocked API, and a phone viewport with the touch stick.

## Signed in, with Google mocked (`e2e/signed-in.local.mjs`)

Runs every panel and every coworker topic against data. Google and hawkswarroom.com are replaced inside the server
process by `mock-google.mjs`, which serves the synthetic fixtures in `tests/fixtures` and never writes anywhere.

```bash
export AUTH_SECRET=$(openssl rand -base64 48)
NODE_OPTIONS="--import ./e2e/mock-google.mjs" GOOGLE_CLIENT_ID=test GOOGLE_CLIENT_SECRET=test \
  ALLOWED_EMAILS=test@example.com PORT=3101 npx next start -p 3101 &
HQ_COOKIE=$(node e2e/make-session.mjs "$AUTH_SECRET" test@example.com) E2E_BASE=http://localhost:3101 \
  node e2e/signed-in.local.mjs
```

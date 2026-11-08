# Connect Jesse HQ to Google (about 10 minutes, free)

The world runs without this. Your records (checkouts, loops, OS file, calendar, inbox previews) appear once
Google sign-in is set up. Everything below is free: no billing account, no paid plan.

You need two browser tabs: Google Cloud Console and Vercel.

## 1. Create a Google Cloud project

1. Open https://console.cloud.google.com and sign in with the Google account that owns your Drive.
2. Project picker (top left) → **New project** → name it `Jesse HQ` → **Create**, then select it.

## 2. Turn on the three APIs

**APIs & Services → Library**, search for each and press **Enable**:

- Google Drive API
- Google Calendar API
- Gmail API (only needed for inbox previews; skip it if you set `HQ_GMAIL_PREVIEW=0`)

## 3. Set up the sign-in screen

1. Go to **Google Auth Platform** (search for it in the top bar) → **Get started**.
2. App name `Jesse HQ`, your email as support email → **Next**.
3. Audience: **External** → **Next**. Contact email: yours → **Next** → agree → **Create**.
4. **Data Access → Add or remove scopes**. Paste these into "Manually add scopes", then **Add to table → Update → Save**:

   ```
   https://www.googleapis.com/auth/drive.readonly
   https://www.googleapis.com/auth/drive.file
   https://www.googleapis.com/auth/calendar.readonly
   https://www.googleapis.com/auth/gmail.readonly
   ```

   What each one is for:
   - `drive.readonly`: read your context folders. The app never edits or deletes anything there.
   - `drive.file`: lets the Dream Journal create its own folder and new files in it, and nothing else.
   - `calendar.readonly`: today's meetings and deadlines.
   - `gmail.readonly`: inbox previews in the Communications Hub. Nothing is ever sent.

5. **Audience → Publish app → Confirm.** Important: in "Testing" mode Google expires your sign-in every 7 days.
   Published but unverified is fine for a personal app; Google just shows a warning screen when you sign in.

## 4. Create the sign-in client

1. **Google Auth Platform → Clients → Create client**.
2. Application type: **Web application**. Name: `Jesse HQ web`.
3. **Authorized redirect URIs**, add one line per address you'll open the app from:

   ```
   https://YOUR-PREVIEW-ADDRESS/api/auth/callback
   https://YOUR-PRODUCTION-ADDRESS/api/auth/callback
   http://localhost:3000/api/auth/callback
   ```

   Use the stable branch address for previews (it ends in `-git-hq-rpg-...vercel.app`), not a one-off
   deployment address, or Google will refuse the sign-in with `redirect_uri_mismatch`.
4. **Create**. Copy the **Client ID** and **Client secret**.

## 5. Add four settings in Vercel

Vercel → your project → **Settings → Environment Variables**. Add each one for **Production** and **Preview**:

| Name | Value |
| --- | --- |
| `GOOGLE_CLIENT_ID` | the Client ID from step 4 |
| `GOOGLE_CLIENT_SECRET` | the Client secret from step 4 |
| `AUTH_SECRET` | a long random string. In Terminal: `openssl rand -base64 48` |
| `ALLOWED_EMAILS` | your Gmail address (comma-separate if you ever add another) |

Optional extras (defaults are fine): `HQ_TIMEZONE` (America/Chicago), `HQ_GMAIL_PREVIEW=0` to skip Gmail,
`DRIVE_CONTEXT_FOLDER_ID` to pin the context folder instead of finding it by name, `SLACK_WORKSPACE_URL`
for Slack deep links, `WARROOM_URL` (https://www.hawkswarroom.com).

## 6. Redeploy and sign in

1. Vercel → **Deployments** → the latest `hq-rpg` deployment → **⋯ → Redeploy** (new settings only apply to
   new deployments).
2. Open the preview address. Menu (Tab, or ≡ on the controller) → **Sign in with Google**.
3. On "Google hasn't verified this app": **Advanced → Go to Jesse HQ (unsafe)**. That warning is about Google's
   review process for public apps; this one only lets the addresses in `ALLOWED_EMAILS` in.
4. Leave every permission box checked, then **Continue**.

You land back in the Command Center with your records loaded.

## If something goes wrong

- **redirect_uri_mismatch**: the address in the browser isn't in step 4's list. Add it exactly, including `https://`.
- **"That Google account isn't on the allowed list"**: check `ALLOWED_EMAILS`, then redeploy.
- **Signed out after a week**: the app is still in Testing. Do step 3.5 and sign in again.
- **A room says a permission is missing**: Menu → Account → Sign out, then sign in again and leave all boxes checked.
- **Vercel asks you to log in before showing the preview**: that's Vercel's preview protection. Log in with your
  Vercel account, or turn it off under Settings → Deployment Protection.

## What the app stores

Nothing in a database. Your Google tokens live in one encrypted, http-only cookie on your own browser, sealed with
`AUTH_SECRET`. Records are read live from Google on each visit and cached in server memory for a minute or two.
To cut access completely: https://myaccount.google.com/permissions → Jesse HQ → Remove access.

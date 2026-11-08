// Google + war room mock for the signed-in walk. Loaded into `next start` with
//   NODE_OPTIONS="--import ./e2e/mock-google.mjs"
// It replaces fetch for googleapis.com and hawkswarroom.com only, serves the synthetic fixtures in tests/fixtures
// (or files you point HQ_MOCK_LOOPS / HQ_MOCK_OS at), and never writes anywhere. Test use only.
import { readFileSync } from 'node:fs';
const FX = new URL('../tests/fixtures/', import.meta.url).pathname;
const LOOPS = process.env.HQ_MOCK_LOOPS ?? `${FX}loops.md`;
const OS = process.env.HQ_MOCK_OS ?? `${FX}os.md`;
const FOLDER = 'application/vnd.google-apps.folder';
const iso = (d, t = '12:00:00') => `${d}T${t}.000Z`;
const files = [];
const content = {};
const add = (f) => (files.push(f), f);
add({ id: 'mockMEROOTxxxxxxxxxxxxxxxxxxxxx', name: '01 — Me', mimeType: FOLDER, parents: ['root'], modifiedTime: iso('2026-06-01') });
add({ id: 'mockCTXxxxxxxxxxxxxxxxxxxxxxxxxx', name: '01 — Context Building', mimeType: FOLDER, parents: ['mockMEROOTxxxxxxxxxxxxxxxxxxxxx'], modifiedTime: iso('2026-06-04') });
const folders = { daily: '01 — Daily', weekly: '02 — Weekly', monthly: '03 — Monthly', yearly: '04 — Yearly', loops: '05 — Loops', os: '06 — Operating System', texts: '07 — Texts', social: '08 — Social', instinct: '09 — Instinct', system: '00 — System' };
for (const [k, name] of Object.entries(folders)) add({ id: `mockFOLDER${k.toUpperCase()}`.padEnd(30, 'x'), name, mimeType: FOLDER, parents: ['mockCTXxxxxxxxxxxxxxxxxxxxxxxxxx'], modifiedTime: iso('2026-06-04') });
add({ id: 'mockFOLDERGAMES'.padEnd(30, 'x'), name: '02 — Games', mimeType: FOLDER, parents: ['mockMEROOTxxxxxxxxxxxxxxxxxxxxx'], modifiedTime: iso('2026-08-01') });
const file = (id, name, parent, text, mod) => {
  add({ id, name, mimeType: 'text/markdown', parents: [parent], modifiedTime: mod ?? iso('2026-11-07'), size: String(text.length) });
  content[id] = text;
};
const daily = readFileSync(`${FX}/daily.md`, 'utf8').replace(/2030-03-14/g, '2026-11-06').replace(/Thursday/g, 'Friday');
file('mockD1XXXXXXXXXXXXXXXXXXXXXXXXXX', '2026-11-06.md', 'mockFOLDERDAILY'.padEnd(30, 'x'), daily, iso('2026-11-07', '02:52:17'));
file('mockD0XXXXXXXXXXXXXXXXXXXXXXXXXX', '2026-11-05.md', 'mockFOLDERDAILY'.padEnd(30, 'x'), daily.replace(/2026-11-06/g, '2026-11-05'), iso('2026-11-06', '03:44:07'));
file('mockDVXXXXXXXXXXXXXXXXXXXXXXXXXX', 'VOID-2026-11-07.md', 'mockFOLDERDAILY'.padEnd(30, 'x'), 'void file must never show', iso('2026-11-08'));
file('mockL1XXXXXXXXXXXXXXXXXXXXXXXXXX', 'loops-2026-11-07.md', 'mockFOLDERLOOPS'.padEnd(30, 'x'), readFileSync(LOOPS, 'utf8'), iso('2026-11-07', '03:00:00'));
file('mockL0XXXXXXXXXXXXXXXXXXXXXXXXXX', 'loops-2026-10-31.md', 'mockFOLDERLOOPS'.padEnd(30, 'x'), readFileSync(LOOPS, 'utf8'), iso('2026-10-31'));
file('mockO1XXXXXXXXXXXXXXXXXXXXXXXXXX', 'operating-system-2026-11-06.md', 'mockFOLDEROS'.padEnd(30, 'x'), readFileSync(OS, 'utf8'), iso('2026-11-07', '02:53:55'));
file('mockOVXXXXXXXXXXXXXXXXXXXXXXXXXX', 'VOID-operating-system-2026-11-07-pre.md', 'mockFOLDEROS'.padEnd(30, 'x'), 'void');
file('mockID1XXXXXXXXXXXXXXXXXXXXXXXXXX', 'jesse-identity.md', 'mockFOLDEROS'.padEnd(30, 'x'), '# Identity\n\n## The line\n- Synthetic identity note for local testing.\n', iso('2026-10-20'));
file('mockH1XXXXXXXXXXXXXXXXXXXXXXXXXX', 'jesse-health.md', 'mockFOLDEROS'.padEnd(30, 'x'), '# Health\n\n## Move\n- Synthetic health note for local testing.\n', iso('2026-10-20'));
file('mockW1XXXXXXXXXXXXXXXXXXXXXXXXXX', '2026-11-06-weekend-rollup.md', 'mockFOLDERWEEKLY'.padEnd(30, 'x'), '# Week of Nov 2\n\n## Patterns\n- Synthetic weekly rollup.\n', iso('2026-11-07'));
file('mockM1XXXXXXXXXXXXXXXXXXXXXXXXXX', '2026-10.md', 'mockFOLDERMONTHLY'.padEnd(30, 'x'), '# October\n\n## Wrap\n- Synthetic monthly wrap.\n', iso('2026-10-31'));
file('mockT1XXXXXXXXXXXXXXXXXXXXXXXXXX', 'pulled-2026-11-06-2019.md', 'mockFOLDERTEXTS'.padEnd(30, 'x'), 'PRIVATE MESSAGES MUST NEVER SHOW', iso('2026-11-07', '01:19:00'));
file('mockG1XXXXXXXXXXXXXXXXXXXXXXXXXX', 'circuit-puzzle.md', 'mockFOLDERGAMES'.padEnd(30, 'x'), '# Circuit puzzle\nA synthetic game idea.', iso('2026-07-01'));

const J = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json' } });
const meta = (f) => ({ ...f, webViewLink: f.mimeType === FOLDER ? `https://drive.google.com/drive/folders/${f.id}` : `https://drive.google.com/file/d/${f.id}/view` });

function driveList(q, orderBy) {
  let out = [];
  if (/name contains 'Context Building'/.test(q)) out = files.filter((f) => f.id === 'mockCTXxxxxxxxxxxxxxxxxxxxxxxxxx');
  else if (/appProperties/.test(q)) out = [];
  else if (/' in parents/.test(q)) {
    const pid = q.match(/'([^']+)' in parents/)[1];
    out = files.filter((f) => f.parents?.includes(pid));
    if (/mimeType = 'application\/vnd.google-apps.folder'/.test(q)) out = out.filter((f) => f.mimeType === FOLDER);
  } else if (/fullText contains/.test(q)) {
    const t = q.match(/name contains '([^']+)'/)?.[1]?.toLowerCase() ?? '';
    out = files.filter((f) => f.mimeType !== FOLDER && (f.name.toLowerCase().includes(t) || (content[f.id] ?? '').toLowerCase().includes(t)));
  }
  if (orderBy === 'name desc') out = [...out].sort((a, b) => b.name.localeCompare(a.name));
  return { files: out.map(meta) };
}

const now = Date.now();
const at = (mins) => new Date(now + mins * 60000).toISOString();
const events = {
  primary: [
    { id: 'e1', summary: 'Write session (synthetic)', start: { dateTime: at(40) }, end: { dateTime: at(160) }, htmlLink: 'https://calendar.google.com', location: 'Studio' },
    { id: 'e2', summary: 'Team sync (synthetic)', start: { dateTime: at(60 * 26) }, end: { dateTime: at(60 * 27) }, htmlLink: 'https://calendar.google.com', hangoutLink: 'https://meet.google.com/abc' },
    { id: 'e3', summary: 'Declined thing', start: { dateTime: at(90) }, end: { dateTime: at(120) }, attendees: [{ self: true, responseStatus: 'declined' }] },
  ],
  writes: [{ id: 'e4', summary: 'All-day hold (synthetic)', start: { date: new Date(now + 86400000 * 2).toISOString().slice(0, 10) }, end: { date: new Date(now + 86400000 * 3).toISOString().slice(0, 10) } }],
};

function mockGoogle(url, init) {
  const u = new URL(url);
  if (u.host === 'oauth2.googleapis.com') return J({ access_token: 'fake-access-2', expires_in: 3600 });
  if (u.host === 'gmail.googleapis.com') {
    if (u.pathname.endsWith('/threads')) return J({ threads: [{ id: 'th1' }, { id: 'th2' }] });
    if (u.pathname.endsWith('/labels/INBOX')) return J({ threadsUnread: 1 });
    const id = u.pathname.split('/').pop();
    const h = id === 'th1' ? ['"Sam Example" <sam@example.com>', 'Pilot follow-up (synthetic)', true] : ['Pat Example <pat@example.com>', 'Mix notes (synthetic)', false];
    return J({ id, messages: [{ id: id + 'm', labelIds: h[2] ? ['UNREAD', 'INBOX'] : ['INBOX'], snippet: 'Synthetic preview text &amp; more', payload: { headers: [{ name: 'From', value: h[0] }, { name: 'Subject', value: h[1] }, { name: 'Date', value: new Date(now - 3600e3).toUTCString() }] } }] });
  }
  if (u.pathname.startsWith('/calendar/v3')) {
    if (u.pathname.endsWith('/calendarList')) return J({ items: [{ id: 'primary', summary: 'Joint calendar', selected: true, primary: true, accessRole: 'owner' }, { id: 'writes', summary: 'Writes', selected: true, accessRole: 'reader' }] });
    const cal = decodeURIComponent(u.pathname.split('/calendars/')[1].split('/')[0]);
    return J({ items: events[cal] ?? [] });
  }
  if (u.pathname.startsWith('/drive/v3/files') || u.pathname.startsWith('/upload/drive/v3/files')) {
    if (init?.method === 'POST') {
      // Pretend to create; nothing is written anywhere.
      if (u.pathname.startsWith('/upload/')) {
        const name = String(init.body ?? '').match(/"name":"([^"]+)"/)?.[1] ?? 'dream.md';
        globalThis.__mockWrites = (globalThis.__mockWrites ?? 0) + 1;
        return J({ id: 'mockNEWFILExxxxxxxxxxxxxxxxxxxxx', name, mimeType: 'text/markdown', webViewLink: 'https://drive.google.com/file/d/mockNEWFILE/view', modifiedTime: new Date().toISOString() });
      }
      const body = JSON.parse(String(init.body ?? '{}'));
      return J({ id: 'mockJOURNALFOLDERxxxxxxxxxxxxxx', name: body.name, mimeType: FOLDER, webViewLink: 'https://drive.google.com/drive/folders/mockJOURNAL' });
    }
    const rest = u.pathname.replace(/^\/(upload\/)?drive\/v3\/files\/?/, '');
    if (!rest) return J(driveList(u.searchParams.get('q') ?? '', u.searchParams.get('orderBy')));
    const id = decodeURIComponent(rest.split('/')[0]);
    const f = files.find((x) => x.id === id);
    if (!f) return J({ error: 'not found' }, 404);
    if (u.searchParams.get('alt') === 'media') return new Response(content[id] ?? '', { status: 200, headers: { 'content-type': 'text/markdown' } });
    return J(meta(f));
  }
  return J({ error: 'unmocked ' + u.pathname }, 404);
}

function mockWarroom(url) {
  const u = new URL(url);
  if (u.pathname === '/sitemap.xml')
    return new Response(`<?xml version="1.0"?><urlset><url><loc>https://www.hawkswarroom.com/g/2026-w10</loc></url><url><loc>https://www.hawkswarroom.com/g/2026-w9-recap</loc></url><url><loc>https://www.hawkswarroom.com/calltheplays</loc></url></urlset>`, { headers: { 'content-type': 'application/xml' } });
  if (u.pathname === '/' || u.pathname === '') return new Response('<html><head><title>Hawks War Room (synthetic)</title></head><body><a href="/prototype">Prototype</a></body></html>', { headers: { 'content-type': 'text/html' } });
  if (/prediction-leaderboard\.json$/.test(u.pathname))
    return J({ season: 2026, standingsThroughWeek: 9, lastUpdated: '2026-11-03', standings: [{ name: 'Player A', total: 41, rank: 1, average: 4.6 }, { name: 'Player B', total: 37, rank: 2, average: 4.1 }], weeks: { 9: { opponent: 'X', actual: { a: 1 }, status: 'final' }, 10: { opponent: 'Synthetic Opponent', date: 'Sun Nov 15', status: 'upcoming' } } });
  return new Response('not found', { status: 404 });
}

const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (/^https:\/\/(www\.googleapis\.com|gmail\.googleapis\.com|oauth2\.googleapis\.com|openidconnect\.googleapis\.com)/.test(url)) return mockGoogle(url, init);
  if (/^https:\/\/(www\.)?hawkswarroom\.com/.test(url)) return mockWarroom(url);
  return realFetch(input, init);
};
console.log('[mock] Google and war room mocked');

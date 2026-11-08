// Signed-in walk against a server whose Google calls are mocked (see e2e/README.md).
// Not part of `npm run e2e`: it needs a session cookie and a mock that only exist on the build machine.
// Usage: E2E_BASE=http://localhost:3101 HQ_COOKIE=<sealed session> node e2e/signed-in.local.mjs
import puppeteer from 'puppeteer-core';
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = process.env.E2E_BASE ?? 'http://localhost:3101';
const COOKIE = process.env.HQ_COOKIE;
if (!COOKIE) {
  console.log('HQ_COOKIE not set; skipping the signed-in walk.');
  process.exit(0);
}
const OUT = new URL('./out/signed-in/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const errors = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${String(detail).slice(0, 140)})` : ''}`);
};

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME ?? '/usr/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage();
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error' && !/status of (401|403|503)/.test(m.text())) errors.push(`console: ${m.text()}`);
});
await page.setViewport({ width: 1280, height: 800 });
const u = new URL(BASE);
await browser.setCookie({ name: 'hq_session', value: COOKIE, domain: u.hostname, path: '/', httpOnly: true });
await page.goto(`${BASE}/?e2e=1`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('canvas', { timeout: 20000 });
await sleep(3000);

const text = () => page.evaluate(() => document.querySelector('[data-panel-root]')?.textContent ?? '');
const open = async (type, props = {}, wait = 1200) => {
  await page.evaluate((t, p) => window.__hq.openPanel(t, p), type, props);
  await sleep(wait);
};
const close = async () => {
  await page.evaluate(() => {
    while (window.__hq.getState().panels.length) window.__hq.closePanel();
  });
  await sleep(150);
};
const shot = (name) => page.screenshot({ path: `${OUT}${name}.png` });
const bad = (t) => /Something went wrong|undefined|NaN|\[object Object\]/.test(t);

check('signed in: HUD shows the first name', await page.evaluate(() => /Test/.test(document.querySelector('.hud-right .chip.ok')?.textContent ?? '')));
check('lanes loaded into the world', (await page.evaluate(() => window.__hq.getState().lanes?.length ?? 0)) > 0);

await page.evaluate(() => window.__hq.travelTo('work'));
await sleep(1800);
await shot('01-work-district');
const lanes = await page.evaluate(() => window.__hq.getState().lanes.map((l) => l.id));
check('Work District has lane buildings', lanes.length >= 5, lanes.join(','));

const firstLane = lanes.find((l) => l !== 'personal' && l !== 'touring');
await page.evaluate((l) => window.__hq.travelTo(`lane:${l}`), firstLane);
await sleep(1800);
check('a lane room opens', (await page.evaluate(() => window.__hq.getState().room?.id)) === `lane:${firstLane}`);
await shot('02-lane-room');

for (const tab of ['overview', 'loops', 'dates', 'waiting', 'progress', 'docs', 'links']) {
  await open('lane', { laneId: firstLane, tab }, 900);
  const t = await text();
  check(`lane panel tab "${tab}" renders cleanly`, t.length > 40 && !bad(t), t.slice(0, 100));
  if (tab === 'overview') await shot('03-lane-panel');
  await close();
}
await open('handoff', { laneId: firstLane });
check('handoff panel renders', !bad(await text()));
await close();

const panels = [
  ['briefing', {}],
  ['wall', {}],
  ['checkout', {}],
  ['checkout', { tab: 'moved' }],
  ['checkout', { tab: 'loops' }],
  ['checkout', { tab: 'coach' }],
  ['loops', {}],
  ['loops', { tab: 'waiting' }],
  ['loops', { tab: 'closed' }],
  ['priorities', {}],
  ['calendar', {}],
  ['deadlines', {}],
  ['decisions', {}],
  ['lanes', {}],
  ['os', {}],
  ['sources', {}],
  ['comms', { tab: 'inbox' }],
  ['comms', { tab: 'followups' }],
  ['comms', { tab: 'slack' }],
  ['comms', { tab: 'tools' }],
  ['compose', { to: 'sam@example.com', subject: 'Hi' }],
  ['search', { q: 'pricing' }],
  ['archive', { kind: 'daily' }],
  ['archive', { kind: 'weekly' }],
  ['automations', {}],
  ['warroom', { tab: 'games' }],
  ['warroom', { tab: 'leaderboard' }],
  ['warroom', { tab: 'planning' }],
  ['warroom', { tab: 'dev' }],
  ['dreamboard', {}],
  ['surprise', {}],
  ['think', {}],
  ['personal', { tab: 'planning' }],
  ['personal', { tab: 'routines' }],
  ['personal', { tab: 'reflection' }],
  ['map', {}],
  ['settings', {}],
];
for (const [type, props] of panels) {
  await open(type, props, 1300);
  const t = await text();
  const label = `${type}${props.tab ? `/${props.tab}` : ''}`;
  check(`panel ${label} renders with data`, t.length > 60 && !bad(t) && !/didn’t load|Couldn’t read/.test(t), t.replace(/\s+/g, ' ').slice(0, 120));
  if (['briefing', 'wall', 'checkout', 'loops', 'calendar', 'comms', 'dreamboard', 'surprise', 'warroom', 'automations'].includes(type) && !props.tab) await shot(`p-${label}`);
  if (type === 'personal' && props.tab === 'planning') {
    check('personal sections start covered', await page.evaluate(() => document.querySelectorAll('.covered-veil').length > 0));
    await page.evaluate(() => document.querySelector('.covered .btn')?.click());
    await sleep(200);
    check('a personal section reveals on purpose', await page.evaluate(() => !!document.querySelector('.covered.is-open')));
  }
  await close();
}

// Open a document from the archive.
await open('archive', { kind: 'daily' });
await page.evaluate(() => document.querySelector('.file-open')?.click());
await sleep(1200);
const docText = await text();
check('archive opens a document in place', /What moved|Decisions|Open loops/i.test(docText), docText.slice(0, 80));
check('document hides personal frontmatter', !/price spend|price_spend|health/i.test((await page.evaluate(() => document.querySelector('dl.fm')?.textContent ?? '')) || ''));
await close();

// Coworkers answer every topic from records.
const npcs = await page.evaluate(() => ['chief', 'archivist', 'comms', 'coordinator', 'scout', 'inventor', 'blip']);
for (const id of npcs) {
  await open('npc', { npcId: id }, 500);
  const topics = await page.evaluate(() => [...document.querySelectorAll('.topic')].map((b) => b.textContent));
  for (let i = 0; i < topics.length; i++) {
    await page.evaluate((k) => document.querySelectorAll('.topic')[k].click(), i);
    await sleep(700);
    const r = await page.evaluate(() => document.querySelector('.reply')?.textContent ?? '');
    check(`${id}: "${topics[i]}"`, r.length > 10 && !bad(r) && !/went wrong/i.test(r), r.replace(/\s+/g, ' ').slice(0, 110));
    if (id === 'chief' && i === 0) await shot('npc-chief-briefing');
    if (id === 'inventor' && i === 0) await shot('npc-inventor-build');
  }
  await close();
}

// Typed question routes to a topic.
await open('npc', { npcId: 'archivist' }, 500);
await page.click('.ask-form input');
await page.keyboard.type('what got closed lately');
await page.keyboard.press('Enter');
await sleep(900);
check('typed question routes to a topic', /closed/i.test(await page.evaluate(() => document.querySelector('.reply')?.textContent ?? '')));
await close();

// Dream journal: full confirmation flow (the mock pretends to save; nothing is written).
await open('journal', {}, 600);
await page.click('textarea');
await page.keyboard.type('A pedal that turns hums into chord charts');
await page.evaluate(() => [...document.querySelectorAll('[data-panel-root] button')].find((b) => b.textContent === 'Turn into a project')?.click());
await sleep(300);
check('journal asks before saving', /This creates one new file/.test(await text()));
await page.evaluate(() => [...document.querySelectorAll('[data-panel-root] button')].find((b) => /Yes, save it/.test(b.textContent))?.click());
await sleep(300);
check('a project needs a second confirmation', /One more check/.test(await text()));
await page.evaluate(() => [...document.querySelectorAll('[data-panel-root] button')].find((b) => /Save as a proposed project/.test(b.textContent))?.click());
await sleep(900);
check('first save asks to create the folder', /Create a new folder named/.test(await text()), (await text()).slice(0, 120));
await page.evaluate(() => [...document.querySelectorAll('[data-panel-root] button')].find((b) => /Create the folder and save/.test(b.textContent))?.click());
await sleep(1200);
const saved = await text();
check('journal reports the saved file', /Saved\./.test(saved) && /dream-\d{4}-\d{2}-\d{2}-\d{4}\.md/.test(saved), saved.slice(0, 120));
await shot('journal-saved');
await close();

// Voice panel off by default explains itself.
await open('voice', {}, 400);
check('voice commands are off by default and explained', /Voice commands are off/.test(await text()));
await close();

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} signed-in checks passed.`);
if (errors.length) console.log('Browser errors:\n - ' + [...new Set(errors)].slice(0, 20).join('\n - '));
writeFileSync(`${OUT}results.json`, JSON.stringify({ results, errors }, null, 2));
process.exit(failed.length || errors.length ? 1 : 0);

// End-to-end check in headless Chrome against a running server (default http://localhost:3100).
// Simulates an Xbox controller through a fake navigator.getGamepads, plus keyboard, phone and offline runs.
// Usage: E2E_BASE=http://localhost:3100 node e2e/run-e2e.mjs
import puppeteer, { KnownDevices } from 'puppeteer-core';
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = process.env.E2E_BASE ?? 'http://localhost:3100';
const OUT = new URL('./out/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const results = [];
const errors = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function check(name, ok, detail = '') {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
}

const FAKE_PAD = () => {
  const mk = () => ({ pressed: false, touched: false, value: 0 });
  const pad = {
    id: 'Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)',
    index: 0,
    connected: true,
    mapping: 'standard',
    timestamp: 0,
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, mk),
  };
  window.__pad = pad;
  window.__padPress = (i) => {
    pad.buttons[i] = { pressed: true, touched: true, value: 1 };
    pad.timestamp++;
  };
  window.__padRelease = (i) => {
    pad.buttons[i] = mk();
    pad.timestamp++;
  };
  window.__padAxes = (x, y) => {
    pad.axes[0] = x;
    pad.axes[1] = y;
    pad.timestamp++;
  };
  Object.defineProperty(navigator, 'getGamepads', { value: () => [pad, null, null, null], configurable: true });
};

const B = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, VIEW: 8, MENU: 9, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };

async function tap(page, btn, hold = 90) {
  await page.evaluate((i) => window.__padPress(i), B[btn]);
  await sleep(hold);
  await page.evaluate((i) => window.__padRelease(i), B[btn]);
  await sleep(120);
}

const panelTitle = (page) => page.evaluate(() => document.querySelector('[data-panel-root]')?.getAttribute('aria-label') ?? null);
const roomName = (page) => page.evaluate(() => document.querySelector('.hud-room strong')?.textContent ?? null);
const pos = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('jhq:pos') || 'null'));
const focused = (page) => page.evaluate(() => document.querySelector('.vfocus')?.textContent?.trim().slice(0, 40) ?? null);

async function shot(page, name) {
  await page.screenshot({ path: `${OUT}${name}.png` });
}

function watch(page, label) {
  page.on('pageerror', (e) => errors.push(`${label} pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') {
      const t = m.text();
      // Expected: API calls answer 503/401 while Google isn't configured, and blocked external fetches in this sandbox.
      if (/Failed to load resource: the server responded with a status of (401|503|500)/.test(t)) return;
      if (/net::ERR_INTERNET_DISCONNECTED|net::ERR_FAILED/.test(t)) return;
      errors.push(`${label} console: ${t}`);
    }
  });
}

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME ?? '/usr/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
});

try {
  // ---------------- Desktop with a controller ----------------
  const page = await browser.newPage();
  watch(page, 'desktop');
  await page.setViewport({ width: 1280, height: 800 });
  await page.evaluateOnNewDocument(FAKE_PAD);
  await page.goto(`${BASE}/?e2e=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('canvas', { timeout: 20000 });
  await sleep(2500);
  check('world renders a canvas', await page.$('canvas'));
  check('starts in the Command Center', (await roomName(page)) === 'Command Center', await roomName(page));
  await shot(page, '01-command-center');

  const start = await pos(page);
  await page.evaluate(() => window.__padPress(15));
  await sleep(900);
  await page.evaluate(() => window.__padRelease(15));
  await page.evaluate(() => window.__padAxes(0, 1));
  await sleep(700);
  await page.evaluate(() => window.__padAxes(0, 0));
  await sleep(1800);
  const moved = await pos(page);
  check('controller moves the player (D-pad and stick)', start && moved && (moved.x !== start.x || moved.y !== start.y), `${JSON.stringify(start)} -> ${JSON.stringify(moved)}`);
  check('controller is detected', await page.evaluate(() => !!document.querySelector('.hud-right .chip[title="Controller connected"]')));

  await tap(page, 'Y');
  await sleep(300);
  check('Y opens search', (await panelTitle(page)) === 'Search', await panelTitle(page));
  await tap(page, 'A');
  await sleep(150);
  check('A on a text box gives it real focus (dictation-ready)', await page.evaluate(() => document.activeElement?.tagName === 'INPUT'));
  const before = await pos(page);
  await page.keyboard.type('wasd hawks');
  await sleep(600);
  const after = await pos(page);
  check('typing in a field does not move the player', JSON.stringify(before) === JSON.stringify(after));
  check('typed text lands in the field', (await page.evaluate(() => document.activeElement?.value)) === 'wasd hawks');
  await tap(page, 'B');
  check('B leaves the text box first', await page.evaluate(() => document.activeElement?.tagName !== 'INPUT'));
  check('panel still open after leaving the box', (await panelTitle(page)) === 'Search');
  await tap(page, 'B');
  await sleep(200);
  check('second B closes the panel', (await panelTitle(page)) === null);

  await tap(page, 'VIEW');
  await sleep(300);
  check('View opens the map', (await panelTitle(page)) === 'Map');
  const f1 = await focused(page);
  await tap(page, 'DOWN');
  await tap(page, 'DOWN');
  const f2 = await focused(page);
  check('D-pad moves focus inside a panel', f1 && f2 && f1 !== f2, `${f1} -> ${f2}`);
  await shot(page, '02-map');
  await tap(page, 'B');
  await sleep(200);

  await tap(page, 'MENU');
  await sleep(300);
  check('Menu opens the menu', (await panelTitle(page)) === 'Menu');
  await shot(page, '03-menu');
  await tap(page, 'A'); // Resume is focused first
  await sleep(200);
  check('A on Resume closes the menu', (await panelTitle(page)) === null);

  const r0 = await roomName(page);
  await tap(page, 'RB');
  await sleep(1400);
  const r1 = await roomName(page);
  check('RB walks to the next room', r0 !== r1, `${r0} -> ${r1}`);

  // Coworker conversation (honest when Google isn't configured).
  await page.evaluate(() => window.__hq.travelTo('command'));
  await sleep(1300);
  await page.evaluate(() => window.__hq.openPanel('npc', { npcId: 'chief' }));
  await sleep(400);
  check('coworker panel opens with a portrait', await page.evaluate(() => !!document.querySelector('.portrait')));
  await tap(page, 'A'); // first topic: briefing
  await sleep(900);
  const replyText = await page.evaluate(() => document.querySelector('.reply')?.textContent ?? '');
  check('coworker reply is honest about missing setup', /isn’t set up|sign in/i.test(replyText), replyText.slice(0, 90));
  await shot(page, '04-npc-chief');
  await tap(page, 'B');

  // Dream journal without sign-in keeps the draft and offers copy.
  await page.evaluate(() => window.__hq.openPanel('journal'));
  await sleep(400);
  await page.click('textarea');
  await page.keyboard.type('A pedal that turns hums into chord charts');
  await sleep(500);
  check('journal shows sign-in instead of saving', await page.evaluate(() => /Sign in with Google/.test(document.querySelector('[data-panel-root]')?.textContent ?? '')));
  check('journal draft survives in this tab', await page.evaluate(() => (sessionStorage.getItem('jhq:journal-draft') ?? '').includes('chord charts')));
  await shot(page, '05-journal');
  await page.keyboard.press('Escape'); // leaves the textarea
  await page.keyboard.press('Escape'); // closes the panel
  await sleep(200);
  check('Esc closes panels with the keyboard', (await panelTitle(page)) === null);

  // Room tour for visual review.
  for (const id of ['work', 'warroom', 'comms', 'library', 'lab', 'hall', 'lounge', 'garden', 'personal']) {
    await page.evaluate((r) => window.__hq.travelTo(r), id);
    await sleep(1500);
    await shot(page, `room-${id}`);
  }
  check('personal space reachable by deliberate travel', (await roomName(page)) === 'Personal Space', await roomName(page));

  // Panels render without crashing while Google is unconfigured.
  for (const [type, props] of [
    ['briefing', {}],
    ['loops', {}],
    ['warroom', { tab: 'leaderboard' }],
    ['dreamboard', {}],
    ['settings', {}],
    ['help', {}],
    ['automations', {}],
    ['personal', {}],
  ]) {
    await page.evaluate((t, p) => window.__hq.openPanel(t, p), type, props);
    await sleep(700);
    const ok = await page.evaluate(() => !!document.querySelector('[data-panel-root]'));
    check(`panel "${type}" renders`, ok);
    if (type === 'briefing') await shot(page, '06-briefing-unconfigured');
    if (type === 'settings') await shot(page, '07-settings');
    await page.evaluate(() => window.__hq.closePanel());
    await sleep(150);
  }

  // Offline: the world keeps running and panels explain.
  await page.setOfflineMode(true);
  await page.evaluate(() => window.__hq.openPanel('calendar'));
  await sleep(800);
  const offlineText = await page.evaluate(() => document.querySelector('[data-panel-root]')?.textContent ?? '');
  check('offline: panel explains instead of breaking', /offline/i.test(offlineText), offlineText.slice(0, 80));
  await page.evaluate(() => window.__hq.closePanel());
  await page.evaluate(() => window.__padAxes(1, 0));
  await sleep(500);
  await page.evaluate(() => window.__padAxes(0, 0));
  check('offline: world still responds', (await panelTitle(page)) === null);
  await page.setOfflineMode(false);
  await page.close();

  // ---------------- API blocked ----------------
  const blocked = await browser.newPage();
  watch(blocked, 'blocked');
  await blocked.setViewport({ width: 1280, height: 800 });
  await blocked.setRequestInterception(true);
  blocked.on('request', (req) => {
    if (req.url().includes('/api/')) req.respond({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Blocked by test', code: 'google_error' }) });
    else req.continue();
  });
  await blocked.goto(`${BASE}/?e2e=1`, { waitUntil: 'domcontentloaded' });
  await blocked.waitForSelector('canvas', { timeout: 20000 });
  await sleep(1500);
  check('API failure: world still loads', (await roomName(blocked)) !== null, await roomName(blocked));
  await blocked.evaluate(() => window.__hq.openPanel('loops'));
  await sleep(600);
  check('API failure: panel shows the error', await blocked.evaluate(() => /Blocked by test/.test(document.querySelector('[data-panel-root]')?.textContent ?? '')));
  await blocked.close();

  // ---------------- Phone ----------------
  const phone = await browser.newPage();
  watch(phone, 'phone');
  await phone.emulate(KnownDevices['iPhone 13'] ?? KnownDevices['iPhone 12']);
  await phone.goto(`${BASE}/?e2e=1`, { waitUntil: 'domcontentloaded' });
  await phone.waitForSelector('canvas', { timeout: 20000 });
  await sleep(2500);
  const phoneActive = await phone.evaluate(() => window.__hq.getState().phoneActive);
  check('phone: phone mode turns on automatically', phoneActive);
  check('phone: starts in the Dream Lounge', (await roomName(phone)) === 'Dream Lounge', await roomName(phone));
  check('phone: touch controls visible', await phone.$('.stick'));
  await shot(phone, '08-phone-lounge');
  const p0 = await pos(phone);
  const stick = await phone.$('.stick');
  const box = await stick.boundingBox();
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const t = await phone.touchscreen.touchStart(cx, cy);
  for (let i = 1; i <= 5; i++) {
    await t.move(cx + i * 9, cy);
    await sleep(60);
  }
  await sleep(900);
  await t.end();
  await sleep(1800);
  const p1 = await pos(phone);
  check('phone: stick moves the player', p0 && p1 && (p0.x !== p1.x || p0.y !== p1.y), `${JSON.stringify(p0)} -> ${JSON.stringify(p1)}`);
  await phone.evaluate(() => window.__hq.openPanel('map'));
  await sleep(500);
  const locked = await phone.evaluate(() => [...document.querySelectorAll('.map-row.locked strong')].map((e) => e.textContent));
  check('phone: laptop-only rooms are locked on the map', locked.includes('Command Center'), locked.join(', '));
  await shot(phone, '09-phone-map');
  await phone.evaluate(() => window.__hq.closePanel());
  await phone.evaluate(() => window.__hq.travelTo('command'));
  await sleep(600);
  check('phone: travel to a laptop-only room is refused', (await roomName(phone)) !== 'Command Center', await roomName(phone));
  await phone.close();
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
if (errors.length) {
  console.log(`\nBrowser errors (${errors.length}):`);
  for (const e of [...new Set(errors)].slice(0, 30)) console.log(' -', e);
}
writeFileSync(`${OUT}results.json`, JSON.stringify({ results, errors }, null, 2));
process.exit(failed.length || errors.length ? 1 : 0);

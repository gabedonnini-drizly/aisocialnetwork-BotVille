// TZ-12 delivery (cross-site session): BEFORE/AFTER proof + a desktop control check.
//
// The main `cross` mode reproduces prod honestly rather than with mocks: the client and
// the server are split across DIFFERENT sites (client.test / api.test via
// --host-resolver-rules), and Chrome starts with --test-third-party-cookie-phaseout,
// i.e. it really blocks the third-party cookie — exactly root cause #2 from the TZ.
//   BEFORE — the token path is disabled for the client (we block /api/session and strip the
//            X-Session-Token header): only the cookie remains, as before the fix → the HUD is empty.
//   AFTER  — the token path is enabled → the agent appears in the HUD.
//
// Modes:
//   node scripts/shots-tz12.mjs cross    — cross-site: hud-before.png / hud-after.png
//   node scripts/shots-tz12.mjs before   — desktop 1280x800 baseline (for the diff)
//   node scripts/shots-tz12.mjs after    — the same AFTER the changes
//   node scripts/shots-tz12.mjs diff     — pixel comparison (there must be no diff)
//
// Setup for `cross` (a human/CI brings up the server and the client beforehand):
//   1) server:  DB_PATH=<temporary> PORT=3999 NODE_ENV=production \
//               COOKIE_SAMESITE=none CLIENT_ORIGIN=http://client.test:5178 \
//               SESSION_SECRET=<32+> ENCRYPTION_SECRET=<32+> node dist/index.js
//   2) client:  VITE_API_URL=http://api.test:3999 npx vite build && \
//               npx vite preview --port 5178 --strictPort
// Output: docs/screenshots/tz12/
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { decodePng } from './png-lib.mjs';

const MODE = process.argv[2];
if (!['cross', 'before', 'after', 'diff'].includes(MODE ?? '')) {
  console.error('usage: node scripts/shots-tz12.mjs cross|before|after|diff');
  process.exit(1);
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'docs/screenshots/tz12');
const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ── diff: pixel-by-pixel comparison of the baseline and after (desktop React layer) ──
if (MODE === 'diff') {
  let bad = 0;
  for (const name of ['create']) {
    const a = decodePng(path.join(OUT, `desk-${name}-before.png`));
    const b = decodePng(path.join(OUT, `desk-${name}-after.png`));
    let diff = 0;
    if (a.w !== b.w || a.h !== b.h) diff = -1;
    else {
      for (let y = 0; y < a.h; y++) {
        for (let x = 0; x < a.w; x++) {
          const pa = a.px(x, y), pb = b.px(x, y);
          if (pa[0] !== pb[0] || pa[1] !== pb[1] || pa[2] !== pb[2] || pa[3] !== pb[3]) diff++;
        }
      }
    }
    console.log(`desk-${name}: ${diff === -1 ? 'DIFFERENT SIZE' : diff + ' px diff'}`);
    if (diff !== 0) bad++;
  }
  process.exit(bad ? 1 : 0);
}

// ── shared UI steps ──
async function openModalAndCreate(page, name) {
  await page.evaluate(() => {
    const s = [...document.querySelectorAll('[class*="emptySlot"]')];
    s[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await page.waitForSelector('[class*="modal"]', { timeout: 5000 });
  await sleep(300);
  await page.evaluate((nm) => {
    const input = document.querySelector('[class*="modal"] input:not([type=password])');
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    set.call(input, nm); input.dispatchEvent(new Event('input', { bubbles: true }));
  }, name);
  await sleep(150);
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('[class*="modal"] button')]
      .find(b => /Create Agent/.test(b.textContent));
    btn.click();
  });
  // The modal closes both on the bug and on success — so we wait for the close itself
  // and catch the difference from the HUD contents afterwards.
  await page.waitForFunction(() => !document.querySelector('[class*="modal"]'), { timeout: 15000 });
  await sleep(1200);
}

const slotNames = (page) => page.evaluate(() =>
  [...document.querySelectorAll('[class*="slot_"]')].map(e => e.textContent.trim()));

// ── cross-site: the main BEFORE/AFTER scenario ──
if (MODE === 'cross') {
  const CLIENT = process.env.CLIENT_URL ?? 'http://client.test:5178';
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: [
      '--no-sandbox', '--use-gl=angle', '--use-angle=metal', '--ignore-gpu-blocklist',
      // real third-party cookie blocking — this is root cause #2 itself
      '--test-third-party-cookie-phaseout',
      '--host-resolver-rules=MAP client.test 127.0.0.1, MAP api.test 127.0.0.1',
    ],
  });

  // legacy=true — emulates the client BEFORE the fix: the token path is unavailable
  async function run(legacy, label, agentName) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
    if (legacy) {
      await page.setRequestInterception(true);
      page.on('request', (req) => {
        const url = req.url();
        if (url.includes('/api/session')) return req.abort('failed'); // no bootstrap
        if (url.includes('/api/')) {
          const h = { ...req.headers() };
          delete h['x-session-token'];                                 // no header
          return req.continue({ headers: h });
        }
        req.continue();
      });
    }
    await page.goto(CLIENT + '/app', { waitUntil: 'networkidle2' });
    await page.waitForSelector('[class*="emptySlot"]', { timeout: 30000 });
    await openModalAndCreate(page, agentName);
    await page.evaluate(() => window.__setGameHour?.(12));
    await sleep(400);
    const names = await slotNames(page);
    await page.screenshot({ path: path.join(OUT, `hud-${label}.png`) });
    console.log(`✓ hud-${label}.png — slots: ${JSON.stringify(names)}`);
    await page.close();
    return names;
  }

  // The names are short: the name field truncates long ones, and the slot-text check
  // has to compare against what is actually rendered.
  const NAME_BEFORE = 'Bug', NAME_AFTER = 'Token';
  const before = await run(true, 'before', NAME_BEFORE);
  const after = await run(false, 'after', NAME_AFTER);
  await browser.close();

  const has = (names, n) => names.some(s => s.includes(n));
  const okBefore = !has(before, NAME_BEFORE); // bug reproduced: the agent is absent
  const okAfter = has(after, NAME_AFTER);     // fix works: the agent is present
  console.log(`\nBEFORE — agent in HUD: ${has(before, NAME_BEFORE) ? 'YES' : 'NO'} (expected NO — the bug)`);
  console.log(`AFTER  — agent in HUD: ${has(after, NAME_AFTER) ? 'YES' : 'NO'} (expected YES — the fix)`);
  process.exit(okBefore && okAfter ? 0 : 1);
}

// ── desktop control check (before/after): the same modal as in TZ-11 ──
{
  const BASE = process.env.CLIENT_URL ?? 'http://localhost:5173';
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=metal', '--ignore-gpu-blocklist'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
  await page.goto(BASE + '/app', { waitUntil: 'networkidle2' });
  await page.waitForSelector('[class*="emptySlot"]', { timeout: 30000 });
  await page.evaluate(() => { document.getElementById('game-container').style.display = 'none'; });
  await page.evaluate(() => {
    const s = [...document.querySelectorAll('[class*="emptySlot"]')];
    s[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await page.waitForSelector('[class*="modal"]', { timeout: 5000 });
  await page.evaluate(() => { document.querySelector('[class*="modal"]').scrollTop = 0; });
  await sleep(400);
  await page.screenshot({ path: path.join(OUT, `desk-create-${MODE}.png`) });
  console.log(`✓ desk-create-${MODE}.png`);
  await browser.close();
}

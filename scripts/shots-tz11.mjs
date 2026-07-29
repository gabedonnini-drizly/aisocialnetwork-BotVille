// TZ-11 delivery (mobile agent-creation bug): screenshots + a desktop control check.
//
// Modes:
//   node scripts/shots-tz11.mjs before   — desktop 1280x800: the create modal (baseline for the diff)
//   node scripts/shots-tz11.mjs after    — the same AFTER the changes
//   node scripts/shots-tz11.mjs diff      — pixel comparison of before/after (there must be no diff)
//   node scripts/shots-tz11.mjs mobile    — 375x667 iPhone SE, real touch:
//        offline API → a visible network error (submit + demo) and successful creation (submit + demo)
//
// The server is NOT needed: all /api calls are mocked by request interception (that is exactly the
// "Railway unreachable" scenario). Only the dev client (:5173) is required.
// Output: docs/screenshots/tz11/
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { decodePng } from './png-lib.mjs';

const MODE = process.argv[2];
if (!['before', 'after', 'diff', 'mobile'].includes(MODE ?? '')) {
  console.error('usage: node scripts/shots-tz11.mjs before|after|diff|mobile');
  process.exit(1);
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'docs/screenshots/tz11');
const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = process.env.CLIENT_URL ?? 'http://localhost:5173';
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

// one record exists → there is both an occupied slot AND a free "+"
const AGENTS = [
  { id: 'a1', user_id: 'u', slot_index: 0, name: 'Alex', avatar_variant: 0, system_prompt: '', provider_type: 'claude', model_id: 'claude-sonnet-4-6', created_at: Date.now(), has_key: 0 },
];

// postMode: 'ok' | 'fail' (abort — the server is unreachable) | 'hang'
function installMock(page, state) {
  page.on('request', (req) => {
    const url = req.url(), m = req.method();
    if (url.includes('/api/agents') && m === 'POST') {
      if (state.postMode === 'hang') return;               // hang with no timeout
      if (state.postMode === 'fail') return req.abort('failed'); // the server is unreachable
      const created = { ...AGENTS[0], id: 'new1', slot_index: 1, name: state.newName };
      state.extra = created;
      return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { id: 'new1' } }) });
    }
    if (url.includes('/api/chat/demo-status')) {
      return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { demoEnabled: true, demoRemaining: 20 } }) });
    }
    if (url.match(/\/api\/agents\/?($|\?)/) && m === 'GET') {
      const data = state.extra ? [AGENTS[0], state.extra] : AGENTS;
      return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ data }) });
    }
    if (url.includes('/api/')) {
      return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: {} }) });
    }
    req.continue();
  });
}

async function boot(page, state) {
  await page.setRequestInterception(true);
  installMock(page, state);
  await page.goto(BASE + '/app', { waitUntil: 'networkidle2' });
  await page.waitForFunction(() => window.__game?.scene.getScene('DistrictScene')?.scene.isActive(), { timeout: 60000, polling: 250 });
  await page.evaluate(() => window.__setGameHour(12));
  await sleep(600);
}

async function openModal(page, name) {
  await page.evaluate(() => {
    const s = [...document.querySelectorAll('[class*="emptySlot"]')];
    s[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await page.waitForSelector('[class*="modal"]', { timeout: 5000 });
  await sleep(400);
  await page.evaluate((nm) => {
    const input = document.querySelector('[class*="modal"] input:not([type=password])');
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    set.call(input, nm); input.dispatchEvent(new Event('input', { bubbles: true }));
  }, name);
  await sleep(100);
}

async function tapButton(page, reSrc, reFlags) {
  await page.evaluate(() => { const m = document.querySelector('[class*="modal"]'); m.scrollTop = m.scrollHeight; });
  await sleep(200);
  const box = await page.evaluate(({ src, flags }) => {
    const re = new RegExp(src, flags);
    const btn = [...document.querySelectorAll('[class*="modal"] button')].find(b => re.test(b.textContent));
    if (!btn) return null;
    const r = btn.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, { src: reSrc, flags: reFlags });
  if (!box) throw new Error('button not found: ' + reSrc);
  await page.touchscreen.tap(box.x, box.y); // a REAL touch
}

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: 'new',
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=metal', '--ignore-gpu-blocklist'],
});

// ── desktop control check (before/after) ──
if (MODE === 'before' || MODE === 'after') {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
  const state = { postMode: 'ok' };
  await boot(page, state);
  await page.waitForSelector('[class*="slotAvatar"]', { timeout: 15000 });
  await page.evaluate(() => { document.getElementById('game-container').style.display = 'none'; });
  await openModal(page, 'Test');
  await page.evaluate(() => { document.querySelector('[class*="modal"]').scrollTop = 0; });
  await page.evaluate(() => window.__setGameHour(12));
  await sleep(300);
  await page.screenshot({ path: path.join(OUT, `desk-create-${MODE}.png`) });
  console.log(`✓ desk-create-${MODE}.png`);
  await browser.close();
  process.exit(0);
}

// ── mobile: the delivery screenshots ──
const shot = async (page, name) => { await page.screenshot({ path: path.join(OUT, `mob-${name}.png`) }); console.log(`✓ mob-${name}.png`); };

// 1) offline API → a visible network error, the regular "Create Agent" button
{
  const page = await browser.newPage();
  await page.setViewport({ width: 375, height: 667, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const state = { postMode: 'fail' };
  await boot(page, state);
  await openModal(page, 'Testy');
  // NB: the Russian alternatives below match the RU button labels the client renders — do not translate.
  await tapButton(page, 'Создать агента|Create Agent|Создаю|Creating', '');
  await sleep(800);
  await shot(page, 'error-submit');
  await page.close();
}

// 2) offline API → a visible network error, the "Skip for now — start with the demo" button
{
  const page = await browser.newPage();
  await page.setViewport({ width: 375, height: 667, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const state = { postMode: 'fail' };
  await boot(page, state);
  await openModal(page, 'Testy');
  await tapButton(page, 'Позже|Skip for now', 'i');
  await sleep(800);
  await shot(page, 'error-demo');
  await page.close();
}

// 3) successful creation via the regular button → the agent appears in the HUD
{
  const page = await browser.newPage();
  await page.setViewport({ width: 375, height: 667, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const state = { postMode: 'ok', newName: 'Barsik' };
  await boot(page, state);
  await openModal(page, 'Barsik');
  await tapButton(page, 'Создать агента|Create Agent|Создаю|Creating', '');
  await page.waitForFunction(() => !document.querySelector('[class*="modal"]'), { timeout: 5000 });
  await page.evaluate(() => window.__setGameHour(12));
  await sleep(600);
  await shot(page, 'success-submit');
  await page.close();
}

// 4) successful creation via the "demo" button → the agent appears in the HUD
{
  const page = await browser.newPage();
  await page.setViewport({ width: 375, height: 667, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const state = { postMode: 'ok', newName: 'Murzik' };
  await boot(page, state);
  await openModal(page, 'Murzik');
  await tapButton(page, 'Позже|Skip for now', 'i');
  await page.waitForFunction(() => !document.querySelector('[class*="modal"]'), { timeout: 5000 });
  await page.evaluate(() => window.__setGameHour(12));
  await sleep(600);
  await shot(page, 'success-demo');
  await page.close();
}

await browser.close();
console.log('done:', OUT);

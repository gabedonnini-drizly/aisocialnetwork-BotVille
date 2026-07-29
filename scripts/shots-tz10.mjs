// TZ-10 delivery (mobile fit of the React layer): screenshots + a desktop control check.
//
// Modes:
//   node scripts/shots-tz10.mjs before   — desktop 1280x800: hud/create/profile/chat (baseline)
//   node scripts/shots-tz10.mjs after    — the same AFTER the changes
//   node scripts/shots-tz10.mjs diff     — pixel comparison of before/after (there must be no diff)
//   node scripts/shots-tz10.mjs mobile   — 375x667 (iPhone SE): hud, chat with keyboard emulation,
//                                          CreateAgentModal at the top/bottom of the scroll, profile
//
// Requires the dev client (:5173) and the dev server (:3001, real agents in the HUD).
// Output: docs/screenshots/tz10/
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { decodePng } from './png-lib.mjs';

const MODE = process.argv[2];
if (!['before', 'after', 'diff', 'mobile'].includes(MODE ?? '')) {
  console.error('usage: node scripts/shots-tz10.mjs before|after|diff|mobile');
  process.exit(1);
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'docs/screenshots/tz10');
const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = process.env.CLIENT_URL ?? 'http://localhost:5173';
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ── diff: pixel-by-pixel comparison of the baseline and after ──
if (MODE === 'diff') {
  let bad = 0;
  for (const name of ['hud', 'create', 'profile', 'chat']) {
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

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=metal', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage();
const MOBILE = MODE === 'mobile';
await page.setViewport(MOBILE
  ? { width: 375, height: 667, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
  : { width: 1280, height: 800, deviceScaleFactor: 1 });

await page.goto(BASE + '/app', { waitUntil: 'networkidle2' });
await page.waitForFunction(
  () => window.__game?.scene.getScene('DistrictScene')?.scene.isActive(),
  { timeout: 60_000, polling: 250 },
);

// agents: at least 2 (profile/chat/HUD), at least 1 free slot (the "+" modal)
await page.evaluate(async () => {
  const list = (await (await fetch('/api/agents', { credentials: 'include' })).json()).data ?? [];
  const wanted = [
    { name: 'Alex', avatarVariant: 0, providerType: 'claude', modelId: 'claude-sonnet-4-6', systemPrompt: '' },
    { name: 'Molly', avatarVariant: 3, providerType: 'claude', modelId: 'claude-sonnet-4-6', systemPrompt: '' },
  ];
  for (const w of wanted) {
    if (!list.some(a => a.name === w.name)) {
      await fetch('/api/agents', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(w) });
    }
  }
  const cur = (await (await fetch('/api/agents', { credentials: 'include' })).json()).data ?? [];
  for (const extra of cur.slice(3)) { // keep at most 3 — so the "+" stays visible
    await fetch(`/api/agents/${extra.id}`, { method: 'DELETE', credentials: 'include' });
  }
});
await page.reload({ waitUntil: 'networkidle2' });
await page.waitForFunction(
  () => window.__game?.scene.getScene('DistrictScene')?.scene.isActive(),
  { timeout: 60_000, polling: 250 },
);
await page.evaluate(() => window.__setGameHour(12));
await page.waitForSelector('[class*="slotAvatar"]', { timeout: 15_000 });
await sleep(700); // fade-in + HUD render

// desktop control: hide the canvas (the world is non-deterministic — agents roam),
// so the before/after diff compares the React layer only; the clock is frozen before each frame
if (!MOBILE) {
  await page.evaluate(() => { document.getElementById('game-container').style.display = 'none'; });
}
const freezeClock = () => page.evaluate(() => window.__setGameHour(12));

const prefix = MOBILE ? 'mob' : 'desk';
const suffix = MOBILE ? '' : `-${MODE}`;
const shot = async (name) => {
  await freezeClock();
  await page.screenshot({ path: path.join(OUT, `${prefix}-${name}${suffix}.png`) });
  console.log(`✓ ${prefix}-${name}${suffix}.png`);
};

// 1) city + HUD
await shot('hud');

// 2) CreateAgentModal (click on the "+")
await page.evaluate(() => {
  const slots = [...document.querySelectorAll('[class*="emptySlot"]')];
  slots[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
});
await page.waitForSelector('[class*="modal"]', { timeout: 5000 });
await sleep(400); // variant sprites
if (MOBILE) {
  await page.evaluate(() => { document.querySelector('[class*="modal"]').scrollTop = 0; });
  await shot('create-top');
  await page.evaluate(() => {
    const m = document.querySelector('[class*="modal"]');
    m.scrollTop = m.scrollHeight;
  });
  await sleep(150);
  await shot('create-bottom');
} else {
  await shot('create');
}
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find(b => /cancel/i.test(b.textContent));
  btn.click();
});
await sleep(200);

// 3) AgentProfile (click on the first occupied slot)
await page.evaluate(() => {
  document.querySelector('[class*="slotAvatar"]').closest('[class*="slot"]')
    .dispatchEvent(new MouseEvent('click', { bubbles: true }));
});
await page.waitForSelector('[class*="card"]', { timeout: 5000 });
await sleep(250);
await shot('profile');

// 4) ChatWindow (from the profile — the primary button)
await page.evaluate(() => {
  document.querySelector('[class*="btnPrimary"]').click();
});
await page.waitForSelector('textarea', { timeout: 5000 });
await sleep(250);
await shot('chat');

// 5) mobile: the keyboard — visualViewport shrinks; we emulate it with a short viewport
if (MOBILE) {
  await page.evaluate(() => { document.querySelector('textarea').focus(); });
  await page.setViewport({ width: 375, height: 340, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await sleep(400);
  await shot('chat-keyboard');
}

await browser.close();
console.log('done:', OUT);

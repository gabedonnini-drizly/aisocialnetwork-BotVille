// Сдача ТЗ-10 (мобильный fit React-слоя): скриншоты + контроль десктопа.
//
// Режимы:
//   node scripts/shots-tz10.mjs before   — десктоп 1280x800: hud/create/profile/chat (бейзлайн)
//   node scripts/shots-tz10.mjs after    — то же ПОСЛЕ правок
//   node scripts/shots-tz10.mjs diff     — пиксельное сравнение before/after (диффа быть не должно)
//   node scripts/shots-tz10.mjs mobile   — 375x667 (iPhone SE): hud, чат с эмуляцией клавиатуры,
//                                          CreateAgentModal верх/низ скролла, профиль
//
// Требует dev-клиент (:5173) и dev-сервер (:3001, реальные агенты в HUD).
// Выход: docs/screenshots/tz10/
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

// ── diff: попиксельное сравнение бейзлайна и after ──
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
    console.log(`desk-${name}: ${diff === -1 ? 'РАЗНЫЙ РАЗМЕР' : diff + ' px diff'}`);
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

// агенты: минимум 2 (профиль/чат/HUD), минимум 1 свободный слот (модалка «+»)
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
  for (const extra of cur.slice(3)) { // оставить максимум 3 — «+» виден
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
await sleep(700); // fade-in + отрисовка HUD

// десктоп-контроль: канвас прячем (мир недетерминирован — агенты бродят),
// дифф before/after сравнивает чисто React-слой; часы фиксируем перед кадром
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

// 1) город + HUD
await shot('hud');

// 2) CreateAgentModal (клик по «+»)
await page.evaluate(() => {
  const slots = [...document.querySelectorAll('[class*="emptySlot"]')];
  slots[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
});
await page.waitForSelector('[class*="modal"]', { timeout: 5000 });
await sleep(400); // спрайты вариантов
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
  const btn = [...document.querySelectorAll('button')].find(b => /cancel|отмена/i.test(b.textContent));
  btn.click();
});
await sleep(200);

// 3) AgentProfile (клик по первому занятому слоту)
await page.evaluate(() => {
  document.querySelector('[class*="slotAvatar"]').closest('[class*="slot"]')
    .dispatchEvent(new MouseEvent('click', { bubbles: true }));
});
await page.waitForSelector('[class*="card"]', { timeout: 5000 });
await sleep(250);
await shot('profile');

// 4) ChatWindow (из профиля — primary-кнопка)
await page.evaluate(() => {
  document.querySelector('[class*="btnPrimary"]').click();
});
await page.waitForSelector('textarea', { timeout: 5000 });
await sleep(250);
await shot('chat');

// 5) мобила: клавиатура — visualViewport сжимается; эмулируем узким вьюпортом
if (MOBILE) {
  await page.evaluate(() => { document.querySelector('textarea').focus(); });
  await page.setViewport({ width: 375, height: 340, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await sleep(400);
  await shot('chat-keyboard');
}

await browser.close();
console.log('готово:', OUT);

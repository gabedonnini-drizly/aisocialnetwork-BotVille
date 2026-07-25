// Сдача ТЗ-11 (мобильный баг создания агента): скриншоты + контроль десктопа.
//
// Режимы:
//   node scripts/shots-tz11.mjs before   — десктоп 1280x800: create-модалка (бейзлайн для diff)
//   node scripts/shots-tz11.mjs after    — то же ПОСЛЕ правок
//   node scripts/shots-tz11.mjs diff      — пиксельное сравнение before/after (диффа быть не должно)
//   node scripts/shots-tz11.mjs mobile    — 375x667 iPhone SE, реальный тач:
//        офлайн-API → видимая сетевая ошибка (submit + demo) и успешное создание (submit + demo)
//
// Сервер НЕ нужен: все /api замоканы перехватом запросов (это и есть сценарий
// «Railway недостижим»). Требуется только dev-клиент (:5173).
// Выход: docs/screenshots/tz11/
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

// ── diff: попиксельное сравнение бейзлайна и after (десктоп React-слой) ──
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
    console.log(`desk-${name}: ${diff === -1 ? 'РАЗНЫЙ РАЗМЕР' : diff + ' px diff'}`);
    if (diff !== 0) bad++;
  }
  process.exit(bad ? 1 : 0);
}

// одна запись существует → есть занятый слот И свободный «+»
const AGENTS = [
  { id: 'a1', user_id: 'u', slot_index: 0, name: 'Alex', avatar_variant: 0, system_prompt: '', provider_type: 'claude', model_id: 'claude-sonnet-4-6', created_at: Date.now(), has_key: 0 },
];

// postMode: 'ok' | 'fail' (abort — сервер недостижим) | 'hang'
function installMock(page, state) {
  page.on('request', (req) => {
    const url = req.url(), m = req.method();
    if (url.includes('/api/agents') && m === 'POST') {
      if (state.postMode === 'hang') return;               // зависание без таймаута
      if (state.postMode === 'fail') return req.abort('failed'); // сервер недостижим
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
  if (!box) throw new Error('кнопка не найдена: ' + reSrc);
  await page.touchscreen.tap(box.x, box.y); // РЕАЛЬНЫЙ тач
}

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: 'new',
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=metal', '--ignore-gpu-blocklist'],
});

// ── десктоп-контроль (before/after) ──
if (MODE === 'before' || MODE === 'after') {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
  const state = { postMode: 'ok' };
  await boot(page, state);
  await page.waitForSelector('[class*="slotAvatar"]', { timeout: 15000 });
  await page.evaluate(() => { document.getElementById('game-container').style.display = 'none'; });
  await openModal(page, 'Тест');
  await page.evaluate(() => { document.querySelector('[class*="modal"]').scrollTop = 0; });
  await page.evaluate(() => window.__setGameHour(12));
  await sleep(300);
  await page.screenshot({ path: path.join(OUT, `desk-create-${MODE}.png`) });
  console.log(`✓ desk-create-${MODE}.png`);
  await browser.close();
  process.exit(0);
}

// ── мобила: сдаточные скрины ──
const shot = async (page, name) => { await page.screenshot({ path: path.join(OUT, `mob-${name}.png`) }); console.log(`✓ mob-${name}.png`); };

// 1) офлайн-API → видимая сетевая ошибка, обычная кнопка «Создать агента»
{
  const page = await browser.newPage();
  await page.setViewport({ width: 375, height: 667, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const state = { postMode: 'fail' };
  await boot(page, state);
  await openModal(page, 'Тестик');
  await tapButton(page, 'Создать агента|Create Agent|Создаю|Creating', '');
  await sleep(800);
  await shot(page, 'error-submit');
  await page.close();
}

// 2) офлайн-API → видимая сетевая ошибка, кнопка «Позже — начать с демо»
{
  const page = await browser.newPage();
  await page.setViewport({ width: 375, height: 667, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const state = { postMode: 'fail' };
  await boot(page, state);
  await openModal(page, 'Тестик');
  await tapButton(page, 'Позже|Skip for now', 'i');
  await sleep(800);
  await shot(page, 'error-demo');
  await page.close();
}

// 3) успешное создание через обычную кнопку → агент в HUD
{
  const page = await browser.newPage();
  await page.setViewport({ width: 375, height: 667, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const state = { postMode: 'ok', newName: 'Барсик' };
  await boot(page, state);
  await openModal(page, 'Барсик');
  await tapButton(page, 'Создать агента|Create Agent|Создаю|Creating', '');
  await page.waitForFunction(() => !document.querySelector('[class*="modal"]'), { timeout: 5000 });
  await page.evaluate(() => window.__setGameHour(12));
  await sleep(600);
  await shot(page, 'success-submit');
  await page.close();
}

// 4) успешное создание через кнопку «демо» → агент в HUD
{
  const page = await browser.newPage();
  await page.setViewport({ width: 375, height: 667, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const state = { postMode: 'ok', newName: 'Мурзик' };
  await boot(page, state);
  await openModal(page, 'Мурзик');
  await tapButton(page, 'Позже|Skip for now', 'i');
  await page.waitForFunction(() => !document.querySelector('[class*="modal"]'), { timeout: 5000 });
  await page.evaluate(() => window.__setGameHour(12));
  await sleep(600);
  await shot(page, 'success-demo');
  await page.close();
}

await browser.close();
console.log('готово:', OUT);

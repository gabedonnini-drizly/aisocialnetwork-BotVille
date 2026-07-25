// Сдача ТЗ-12 (cross-site сессия): доказательство ДО/ПОСЛЕ + контроль десктопа.
//
// Главный режим `cross` воспроизводит прод честно, а не на моках: клиент и
// сервер разводятся по РАЗНЫМ сайтам (client.test / api.test через
// --host-resolver-rules), а Chrome стартует с --test-third-party-cookie-phaseout,
// то есть реально режет стороннюю куку — ровно корень №2 из ТЗ.
//   ДО  — клиенту глушим токен-путь (блокируем /api/session и срезаем заголовок
//          X-Session-Token): остаётся только кука, как было до фикса → HUD пуст.
//   ПОСЛЕ — токен-путь включён → агент появляется в HUD.
//
// Режимы:
//   node scripts/shots-tz12.mjs cross    — cross-site: hud-before.png / hud-after.png
//   node scripts/shots-tz12.mjs before   — десктоп 1280x800 бейзлайн (для diff)
//   node scripts/shots-tz12.mjs after    — то же ПОСЛЕ правок
//   node scripts/shots-tz12.mjs diff     — пиксельное сравнение (диффа быть не должно)
//
// Подготовка для `cross` (сервер и клиент поднимает человек/CI заранее):
//   1) сервер:  DB_PATH=<временный> PORT=3999 NODE_ENV=production \
//               COOKIE_SAMESITE=none CLIENT_ORIGIN=http://client.test:5178 \
//               SESSION_SECRET=<32+> ENCRYPTION_SECRET=<32+> node dist/index.js
//   2) клиент:  VITE_API_URL=http://api.test:3999 npx vite build && \
//               npx vite preview --port 5178 --strictPort
// Выход: docs/screenshots/tz12/
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

// ── общие шаги UI ──
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
      .find(b => /Создать агента|Create Agent/.test(b.textContent));
    btn.click();
  });
  // Модалка закрывается и на баге, и на успехе — ждём именно закрытия,
  // а разницу ловим уже по содержимому HUD.
  await page.waitForFunction(() => !document.querySelector('[class*="modal"]'), { timeout: 15000 });
  await sleep(1200);
}

const slotNames = (page) => page.evaluate(() =>
  [...document.querySelectorAll('[class*="slot_"]')].map(e => e.textContent.trim()));

// ── cross-site: главный сценарий ДО/ПОСЛЕ ──
if (MODE === 'cross') {
  const CLIENT = process.env.CLIENT_URL ?? 'http://client.test:5178';
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: [
      '--no-sandbox', '--use-gl=angle', '--use-angle=metal', '--ignore-gpu-blocklist',
      // реальная блокировка сторонних кук — это и есть корень №2
      '--test-third-party-cookie-phaseout',
      '--host-resolver-rules=MAP client.test 127.0.0.1, MAP api.test 127.0.0.1',
    ],
  });

  // legacy=true — эмуляция клиента ДО фикса: токен-путь недоступен
  async function run(legacy, label, agentName) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
    if (legacy) {
      await page.setRequestInterception(true);
      page.on('request', (req) => {
        const url = req.url();
        if (url.includes('/api/session')) return req.abort('failed'); // бутстрапа нет
        if (url.includes('/api/')) {
          const h = { ...req.headers() };
          delete h['x-session-token'];                                 // заголовка нет
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
    console.log(`✓ hud-${label}.png — слоты: ${JSON.stringify(names)}`);
    await page.close();
    return names;
  }

  // Имена короткие: поле имени обрезает длинные, и проверка по тексту слота
  // должна сравниваться с тем, что реально отрисовано.
  const NAME_BEFORE = 'Бага', NAME_AFTER = 'Токен';
  const before = await run(true, 'before', NAME_BEFORE);
  const after = await run(false, 'after', NAME_AFTER);
  await browser.close();

  const has = (names, n) => names.some(s => s.includes(n));
  const okBefore = !has(before, NAME_BEFORE); // баг воспроизведён: агента нет
  const okAfter = has(after, NAME_AFTER);     // фикс работает: агент есть
  console.log(`\nДО   — агент в HUD: ${has(before, NAME_BEFORE) ? 'ЕСТЬ' : 'НЕТ'} (ожидали НЕТ — баг)`);
  console.log(`ПОСЛЕ — агент в HUD: ${has(after, NAME_AFTER) ? 'ЕСТЬ' : 'НЕТ'} (ожидали ЕСТЬ — фикс)`);
  process.exit(okBefore && okAfter ? 0 : 1);
}

// ── десктоп-контроль (before/after): та же модалка, что в ТЗ-11 ──
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

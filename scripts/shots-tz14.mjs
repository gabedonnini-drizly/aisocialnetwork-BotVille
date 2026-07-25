// Сдача ТЗ-14 (OpenRouter + ключи на уровне юзера): скриншоты + контроль десктопа.
//
// Режимы:
//   node scripts/shots-tz14.mjs desk     — 1280x800: панель ключей, создание агента
//                                          с сохранённым ключом, каталог OpenRouter, чат
//   node scripts/shots-tz14.mjs mobile   — 375x667 (iPhone SE): то же самое
//   node scripts/shots-tz14.mjs before   — бейзлайн НЕТРОНУТЫХ экранов (профиль, чат)
//   node scripts/shots-tz14.mjs after    — они же после правок
//   node scripts/shots-tz14.mjs diff     — попиксельное сравнение before/after (должно быть 0)
//
// Требует поднятыми:
//   1) мок-провайдер:  node scripts/mock-openai-provider.mjs 4010
//   2) сервер на временной БД (:3999, DEMO_ENABLED=false)
//   3) клиент:         VITE_API_URL=http://localhost:3999 npx vite build &&
//                      npx vite preview --port 5178 --strictPort
// Выход: docs/screenshots/tz14/
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { decodePng } from './png-lib.mjs';

const MODE = process.argv[2];
if (!['desk', 'mobile', 'before', 'after', 'diff'].includes(MODE ?? '')) {
  console.error('usage: node scripts/shots-tz14.mjs desk|mobile|before|after|diff');
  process.exit(1);
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'docs/screenshots/tz14');
const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = process.env.CLIENT_URL ?? 'http://localhost:5178';
const MOCK_URL = process.env.MOCK_PROVIDER_URL ?? 'http://localhost:4010/v1';
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ── diff: попиксельное сравнение нетронутых экранов ──
if (MODE === 'diff') {
  let bad = 0;
  for (const name of ['profile', 'chat']) {
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

const MOBILE = MODE === 'mobile';
const CONTROL = MODE === 'before' || MODE === 'after';

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=metal', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage();
await page.setViewport(MOBILE
  ? { width: 375, height: 667, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
  : { width: 1280, height: 800, deviceScaleFactor: 1 });

const waitWorld = () => page.waitForFunction(
  () => window.__game?.scene.getScene('DistrictScene')?.scene.isActive(),
  { timeout: 60_000, polling: 250 },
);

await page.goto(BASE + '/app', { waitUntil: 'networkidle2' });
await waitWorld();

// Состояние сессии: сохранённый ключ юзера (один раз!) + два агента БЕЗ личных
// ключей — ровно сценарий приёмки. Для режима контроля ключ не нужен.
await page.evaluate(async ({ mockUrl, control, apiBase }) => {
  // Клиент и сервер — разные порты (как на проде разные сайты), поэтому сессия
  // едет токеном из localStorage, а не кукой (ТЗ-12).
  const token = localStorage.getItem('av_session_token');
  const api = (p, init = {}) => fetch(apiBase + p, {
    credentials: 'include',
    ...init,
    headers: { ...(init.headers ?? {}), 'X-Session-Token': token },
  });
  // Контрольные кадры снимаются и старой сборкой клиента (до ТЗ-14), поэтому
  // там агенты на claude: провайдера 'custom' старый клиент просто не знает и
  // отрисовал бы пустое имя — это был бы ложный дифф, а не регрессия.
  const cfg = control
    ? { providerType: 'claude', modelId: 'claude-sonnet-4-6' }
    : { providerType: 'custom', modelId: 'mock-model-1', customBaseUrl: mockUrl };

  if (!control) {
    await api('/api/keys/custom', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: 'mock-key-ok', baseUrl: mockUrl }),
    });
  }
  const list = (await (await api('/api/agents')).json()).data ?? [];
  for (const a of list) await api(`/api/agents/${a.id}`, { method: 'DELETE' });
  for (const w of [{ name: 'Alpha', avatarVariant: 0 }, { name: 'Beta', avatarVariant: 3 }]) {
    await api('/api/agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...w, systemPrompt: w.name, ...cfg }),
    });
  }
}, { mockUrl: MOCK_URL, control: CONTROL, apiBase: process.env.VITE_API_URL ?? 'http://localhost:3999' });

await page.reload({ waitUntil: 'networkidle2' });
await waitWorld();
await page.evaluate(() => window.__setGameHour(12));
await page.waitForSelector('[class*="slotAvatar"]', { timeout: 15_000 });
await sleep(700);

// Мир недетерминирован (агенты бродят) — на кадрах React-слоя канвас прячем
if (!MOBILE) await page.evaluate(() => { document.getElementById('game-container').style.display = 'none'; });

const prefix = MOBILE ? 'mob' : 'desk';
const suffix = CONTROL ? `-${MODE}` : '';
const shot = async (name) => {
  await page.evaluate(() => window.__setGameHour(12));
  await page.screenshot({ path: path.join(OUT, `${prefix}-${name}${suffix}.png`) });
  console.log(`✓ ${prefix}-${name}${suffix}.png`);
};
// Провайдер — первый <select> модалки (второй, если он есть, — список моделей)
const selectProvider = async (value) => {
  const [provider] = await page.$$('select');
  await provider.select(value);
};
const clickText = (re) => page.evaluate((src) => {
  const rx = new RegExp(src, 'i');
  const btn = [...document.querySelectorAll('button')].find(b => rx.test(b.textContent));
  if (!btn) throw new Error('кнопка не найдена: ' + src);
  btn.click();
}, re.source);

// ── Контрольные кадры: экраны, которые ТЗ-14 менять не должен ──
// Снимаем САМИ панели, а не весь экран: в HUD добавлена кнопка ключей, и он
// (центрированный) сдвигается по определению — это новая функциональность,
// а не регрессия. Контроль здесь про то, что профиль и чат не поехали.
if (CONTROL) {
  const shotEl = async (name, selector) => {
    await page.evaluate(() => window.__setGameHour(12));
    const el = await page.$(selector);
    await el.screenshot({ path: path.join(OUT, `${prefix}-${name}${suffix}.png`) });
    console.log(`✓ ${prefix}-${name}${suffix}.png`);
  };

  await page.evaluate(() => {
    document.querySelector('[class*="slotAvatar"]').closest('[class*="slot"]')
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await page.waitForSelector('[class*="card"]', { timeout: 5000 });
  await sleep(250);
  await shotEl('profile', '[class*="card"]');

  await page.evaluate(() => document.querySelector('[class*="btnPrimary"]').click());
  await page.waitForSelector('textarea', { timeout: 5000 });
  await sleep(250);
  await shotEl('chat', '[class*="window"]');

  await browser.close();
  console.log('готово:', OUT);
  process.exit(0);
}

// ── 1) Панель ключей из HUD ──
await page.evaluate(() => {
  document.querySelector('[class*="keysBtn"]').click();
});
await page.waitForSelector('[class*="panel"]', { timeout: 5000 });
await sleep(300);
await shot('keys-panel');
await page.evaluate(() => {
  document.querySelector('[class*="closeBtn"]').click();
});
await sleep(200);

// ── 2) Создание агента: сохранённый ключ вместо пустого поля ──
await page.evaluate(() => {
  document.querySelector('[class*="emptySlot"]').dispatchEvent(new MouseEvent('click', { bubbles: true }));
});
await page.waitForSelector('[class*="modal"]', { timeout: 5000 });
await sleep(400);
// провайдер → custom (для него ключ уже сохранён)
await selectProvider('custom');
await sleep(300);
await page.evaluate(() => {
  const m = document.querySelector('[class*="modal"]');
  m.scrollTop = m.scrollHeight;
});
await sleep(200);
await shot('create-saved-key');

// ── 3) Живой каталог OpenRouter: поиск + блок бесплатных ──
await selectProvider('openrouter');
await page.waitForFunction(
  () => !!document.querySelector('[class*="groupLabel"], [class*="row"]'),
  { timeout: 20_000, polling: 250 },
);
await sleep(400);
await page.evaluate(() => {
  const m = document.querySelector('[class*="modal"]');
  m.scrollTop = m.scrollHeight;
});
await sleep(200);
await shot('openrouter-free');

// поиск по каталогу
await page.evaluate(() => {
  const input = document.querySelector('[class*="search"]');
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(input, 'qwen');
  input.dispatchEvent(new Event('input', { bubbles: true }));
});
await sleep(400);
await shot('openrouter-search');

await clickText(/cancel|отмена/);
await sleep(250);

// ── 4) Оба агента отвечают на одном сохранённом ключе ──
for (const idx of [0, 1]) {
  await page.evaluate((i) => {
    const slots = [...document.querySelectorAll('[class*="slotAvatar"]')];
    slots[i].closest('[class*="slot"]').dispatchEvent(new MouseEvent('click', { bubbles: true }));
  }, idx);
  await page.waitForSelector('[class*="card"]', { timeout: 5000 });
  await page.evaluate(() => document.querySelector('[class*="btnPrimary"]').click());
  await page.waitForSelector('textarea', { timeout: 5000 });
  await page.evaluate(() => {
    const ta = document.querySelector('textarea');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
    setter.call(ta, 'привет');
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await sleep(150);
  await page.evaluate(() => document.querySelector('[class*="sendBtn"]').click());
  // ждём готовый ответ (стрим мок-провайдера ~1 с)
  await page.waitForFunction(
    () => /Ключ принят/.test(document.body.innerText),
    { timeout: 20_000, polling: 250 },
  );
  await sleep(400);
  await shot(`chat-agent${idx + 1}`);
  await page.keyboard.press('Escape');
  await sleep(250);
  const stillOpen = await page.$('textarea');
  if (stillOpen) {
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === '✕');
      btn?.click();
    });
    await sleep(250);
  }
}

// ── 5) Неверный ключ → человеческая ошибка, а не тишина ──
// Личному ключу агента даём заведомо неверное значение: он приоритетнее
// сохранённого, значит провайдер ответит 401 — проверяем текст в ленте.
await page.evaluate(async (apiBase) => {
  const token = localStorage.getItem('av_session_token');
  const list = (await (await fetch(apiBase + '/api/agents', {
    credentials: 'include', headers: { 'X-Session-Token': token },
  })).json()).data;
  await fetch(`${apiBase}/api/agents/${list[0].id}/key`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', 'X-Session-Token': token },
    body: JSON.stringify({ apiKey: 'wrong-key' }),
  });
}, process.env.VITE_API_URL ?? 'http://localhost:3999');

await page.evaluate(() => {
  const slots = [...document.querySelectorAll('[class*="slotAvatar"]')];
  slots[0].closest('[class*="slot"]').dispatchEvent(new MouseEvent('click', { bubbles: true }));
});
await page.waitForSelector('[class*="card"]', { timeout: 5000 });
await page.evaluate(() => document.querySelector('[class*="btnPrimary"]').click());
await page.waitForSelector('textarea', { timeout: 5000 });
await page.evaluate(() => {
  const ta = document.querySelector('textarea');
  const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
  setter.call(ta, 'привет');
  ta.dispatchEvent(new Event('input', { bubbles: true }));
});
await sleep(150);
await page.evaluate(() => document.querySelector('[class*="sendBtn"]').click());
await page.waitForFunction(
  () => /не подошёл|didn.t work/i.test(document.body.innerText),
  { timeout: 20_000, polling: 250 },
);
await sleep(300);
await shot('bad-key-error');

await browser.close();
console.log('готово:', OUT);

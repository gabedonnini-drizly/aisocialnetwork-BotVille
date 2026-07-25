// Сдача ТЗ-16 (местоположение агентов + конец «телепортации за игроком»).
//
// Режимы:
//   node scripts/shots-tz16.mjs desk    — 1280x800: доказательство фикса (пустое
//                                         кафе / агент в библиотеке), перезагрузка,
//                                         клик из HUD ведёт к агенту, ночь (дорм/загон)
//   node scripts/shots-tz16.mjs mobile  — 375x667: HUD с местами агентов
//   node scripts/shots-tz16.mjs move    — агент меняет локацию сам со временем
//                                         (ждёт реальный переход тика, до ~5.5 мин)
//
// Требует поднятыми:
//   1) сервер на временной БД:  PORT=3999 DB_PATH=<tmp>/tz16.db DEMO_ENABLED=false
//      CLIENT_ORIGIN=http://localhost:5178 node --env-file=.env --import tsx src/index.ts
//   2) клиент: VITE_API_URL=http://localhost:3999 npx vite build &&
//              npx vite preview --port 5178 --strictPort
// Выход: docs/screenshots/tz16/
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const MODE = process.argv[2];
if (!['desk', 'mobile', 'move'].includes(MODE ?? '')) {
  console.error('usage: node scripts/shots-tz16.mjs desk|mobile|move');
  process.exit(1);
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'docs/screenshots/tz16');
const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = process.env.CLIENT_URL ?? 'http://localhost:5178';
const API = process.env.VITE_API_URL ?? 'http://localhost:3999';
// путь к той же БД, что у сервера — для детерминированной расстановки агентов
const DB = process.env.DB_PATH;
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/** Перевести часы МИРА на сервере (dev-эндпоинт ТЗ-16); клиент подтянется сам. */
async function setWorldHour(h) {
  const res = await fetch(`${API}/api/debug/game-hour`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hour: h }),
  });
  if (!res.ok) throw new Error(`debug/game-hour: ${res.status}`);
}

/** Точечно расставить агентов по местам (правда — в БД, сервер читает её живьём). */
function placeAgents(byName) {
  if (!DB) throw new Error('DB_PATH env обязателен (та же БД, что у сервера)');
  const db = new DatabaseSync(DB);
  for (const [name, loc] of Object.entries(byName)) {
    db.prepare('UPDATE agents SET location = ? WHERE name = ?').run(loc, name);
  }
  db.close();
}

const MOBILE = MODE === 'mobile';
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=metal', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage();
await page.setViewport(MOBILE
  ? { width: 375, height: 667, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
  : { width: 1280, height: 800, deviceScaleFactor: 1 });

const waitScene = (key) => page.waitForFunction(
  (k) => window.__game?.scene.getScene(k)?.scene.isActive(),
  { timeout: 60_000, polling: 250 }, key,
);

// в другую сцену — как игрок через дверь (публичный transitionTo сцены)
const goScene = async (from, to) => {
  await page.evaluate(([f, t]) => window.__game.scene.getScene(f).transitionTo(t), [from, to]);
  await waitScene(to);
  await sleep(900); // fade + рассадка
};

const shot = async (name) => {
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  console.log(`✓ ${name}.png`);
};

// ── Сетап: день, свежий состав — 2 человека + 2 животных (4 агента, как в FPS-замере) ──
await setWorldHour(12);
await page.goto(BASE + '/app', { waitUntil: 'networkidle2' });
await waitScene('DistrictScene');

await page.evaluate(async (apiBase) => {
  const token = localStorage.getItem('av_session_token');
  const api = (p, init = {}) => fetch(apiBase + p, {
    credentials: 'include',
    ...init,
    headers: { ...(init.headers ?? {}), 'X-Session-Token': token },
  });
  const list = (await (await api('/api/agents')).json()).data ?? [];
  for (const a of list) await api(`/api/agents/${a.id}`, { method: 'DELETE' });
  const team = [
    { name: 'Dana', avatarVariant: 0 },
    { name: 'Riley', avatarVariant: 3 },
    { name: 'Mooki', avatarVariant: 12 },
    { name: 'Chirp', avatarVariant: 15 },
  ];
  for (const w of team) {
    await api('/api/agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...w, systemPrompt: w.name, providerType: 'claude', modelId: 'claude-sonnet-4-6' }),
    });
  }
}, API);

// ── move: агент сам меняет локацию по расписанию тика (2–4 игровых часа) ──
if (MODE === 'move') {
  await page.reload({ waitUntil: 'networkidle2' });
  await waitScene('DistrictScene');
  const read = () => page.evaluate(async (apiBase) => {
    const token = localStorage.getItem('av_session_token');
    const res = await fetch(apiBase + '/api/agents/locations', {
      credentials: 'include', headers: { 'X-Session-Token': token },
    });
    return (await res.json()).data;
  }, API);
  const before = await read();
  console.log('до:  ', `час ${before.gameHour.toFixed(1)}`, JSON.stringify(before.locations));
  await sleep(1500);
  await shot('desk-move-before');
  const t0 = Date.now();
  let after = null;
  while (Date.now() - t0 < 5.5 * 60_000) {
    await sleep(10_000);
    const now = await read();
    const moved = now.locations.some(l =>
      before.locations.find(b => b.id === l.id)?.location !== l.location);
    if (moved) { after = now; break; }
  }
  if (!after) throw new Error('за 5.5 минут никто не переехал — тик жизни не работает?');
  console.log('после:', `час ${after.gameHour.toFixed(1)}`, JSON.stringify(after.locations));
  await sleep(16_000); // клиентский поллинг подтянет и HUD, и сцену
  await shot('desk-move-after');
  await browser.close();
  console.log('готово:', OUT);
  process.exit(0);
}

// ── Детерминированная сцена бага: Dana в библиотеке, остальные на улице ──
placeAgents({ Dana: 'library', Riley: 'district', Mooki: 'district', Chirp: 'district' });
await page.reload({ waitUntil: 'networkidle2' });
await waitScene('DistrictScene');
await sleep(1200);

const prefix = MOBILE ? 'mob' : 'desk';

if (MOBILE) {
  // HUD с местами агентов на 375px (день) + ночной HUD
  await shot('mob-hud-day');
  await setWorldHour(23);
  await sleep(12_000); // серверный тик разложит всех по ночным местам
  await page.reload({ waitUntil: 'networkidle2' });
  await waitScene('DistrictScene');
  await sleep(1500);
  await shot('mob-hud-night');
  await browser.close();
  console.log('готово:', OUT);
  process.exit(0);
}

// 0) район днём: трое на улице, Dana не видно (она в библиотеке), HUD с местами
await shot('desk-district-day');

// 1) ДОКАЗАТЕЛЬСТВО ФИКСА: игрок заходит в кафе — там ПУСТО (раньше сюда
//    телепортировались все агенты)
await goScene('DistrictScene', 'CafeScene');
await shot('desk-cafe-empty');

// 2) идёт в библиотеку — Dana там (агент не «пришёл следом», он ЖИВЁТ там)
await goScene('CafeScene', 'DistrictScene');
await goScene('DistrictScene', 'LibraryScene');
await shot('desk-library-dana');

// 3) переживает перезагрузку: F5 — Dana всё ещё в библиотеке
await page.reload({ waitUntil: 'networkidle2' });
await waitScene('DistrictScene');
await sleep(800);
await goScene('DistrictScene', 'LibraryScene');
await shot('desk-library-after-reload');

// 4) клик по агенту в HUD ведёт к нему: из района — сразу в библиотеку Dana
await goScene('LibraryScene', 'DistrictScene');
await page.evaluate(() => {
  const name = [...document.querySelectorAll('[class*="slotName"]')]
    .find(el => el.textContent === 'Dana');
  if (!name) throw new Error('слот Dana не найден');
  name.closest('[class*="slot"]').dispatchEvent(new MouseEvent('click', { bubbles: true }));
});
await waitScene('LibraryScene');
await sleep(900);
// профиль откроется поверх — закрываем, чтобы был виден мир
await page.evaluate(() => document.querySelector('[class*="closeBtn"]')?.click());
await sleep(400);
await shot('desk-goto-from-hud');

// 5) ночь: сервер укладывает людей в дорм, животных в загон; глоу не сломан
await setWorldHour(23);
await sleep(12_000); // тик (10 сек) + запас
await page.reload({ waitUntil: 'networkidle2' });
await waitScene('DistrictScene');
await sleep(2500); // животные доходят до загона и засыпают (Z)
await shot('desk-night-district');

// FPS ночью при 4 агентах (сравнение с бейзлайном ~119)
const fps = await page.evaluate(async () => {
  const samples = [];
  for (let i = 0; i < 20; i++) {
    samples.push(window.__game.loop.actualFps);
    await new Promise(r => setTimeout(r, 100));
  }
  return (samples.reduce((a, b) => a + b, 0) / samples.length).toFixed(1);
});
console.log(`FPS ночью при 4 агентах: ${fps}`);

// 6) дорм ночью: люди спят в кроватях (ждём, пока дойдут и лягут)
await goScene('DistrictScene', 'DormScene');
await page.waitForFunction(() => {
  const scene = window.__game.scene.getScene('DormScene');
  return [...scene.agentSprites.values()].some(s => s.isSeated && s.currentSeatKind === 'bed');
}, { timeout: 20_000, polling: 300 });
await sleep(1500); // и второй дойдёт
await shot('desk-night-dorm');

// 7) пробуждение кликом: настоящий клик мышью по спящему в кровати
const bedPos = await page.evaluate(() => {
  const scene = window.__game.scene.getScene('DormScene');
  const sprite = [...scene.agentSprites.values()].find(s => s.isSeated && s.currentSeatKind === 'bed');
  if (!sprite) throw new Error('в дорме никто не спит в кровати');
  const cam = scene.cameras.main;
  const rect = window.__game.canvas.getBoundingClientRect();
  return {
    x: rect.left + (sprite.x - cam.worldView.x) * cam.zoom,
    y: rect.top + (sprite.y - cam.worldView.y) * cam.zoom - 8 * cam.zoom, // тело выше точки опоры
  };
});
await page.mouse.click(bedPos.x, bedPos.y);
await sleep(1200);
// клик открывает профиль — закрываем, чтобы видеть вставшего агента
await page.evaluate(() => document.querySelector('[class*="closeBtn"]')?.click());
await sleep(500);
await shot('desk-night-dorm-woken');

await browser.close();
console.log('готово:', OUT);
process.exit(0);

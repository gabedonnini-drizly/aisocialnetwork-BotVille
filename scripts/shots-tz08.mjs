// Скриншоты ТЗ-08 (полиш: интерьеры + Y-оффсет животных).
// Требует запущенного dev-клиента (:5173) и системный Chrome. Сервер НЕ нужен:
// агенты для кадра инжектируются прямо в сцену через syncAgents (чисто визуально).
// Запуск из корня:  node scripts/shots-tz08.mjs before|after
// Выход: docs/screenshots/tz08/{office,cafe,dorm,library,animals}-<mode>.png

import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const MODE = process.argv[2];
if (MODE !== 'before' && MODE !== 'after') {
  console.error('usage: node scripts/shots-tz08.mjs before|after');
  process.exit(1);
}

const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'docs/screenshots/tz08');
const BASE = 'http://localhost:5173';

mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new' });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800 });
page.on('pageerror', e => console.error('PAGE ERROR:', e.message));

await page.goto(BASE + '/app', { waitUntil: 'networkidle0' });

// ── ждём загрузку игры: активна DistrictScene ──
await page.waitForFunction(
  () => window.__game?.scene.getScene('DistrictScene')?.scene.isActive(),
  { timeout: 60_000, polling: 250 },
);
console.log('игра загружена, DistrictScene активна');

// день, чтобы не мешала тонировка
await page.evaluate(() => window.__setGameHour(12));
await sleep(400);

// ── 4 животных в ряд на улице, крупный план ──
await page.evaluate(() => {
  const g = window.__game;
  const d = g.scene.getScene('DistrictScene');
  d.syncAgents([
    { id: 'shot-cow', name: 'Cow', avatarVariant: 12 },
    { id: 'shot-pig', name: 'Pig', avatarVariant: 13 },
    { id: 'shot-dog', name: 'Dog', avatarVariant: 14 },
    { id: 'shot-chicken', name: 'Chicken', avatarVariant: 15 },
  ]);
});
await sleep(300);
const focus = await page.evaluate(() => {
  const g = window.__game;
  const d = g.scene.getScene('DistrictScene');
  // ряд на открытом месте у первого спавна
  const sp = d.spawnPoints[0];
  const ids = ['shot-cow', 'shot-pig', 'shot-dog', 'shot-chicken'];
  ids.forEach((id, i) => {
    const s = d.agentSprites.get(id);
    s.cancelGoal();
    s.setPosition(sp.x - 60 + i * 40, sp.y);
    s.update(0);
  });
  d.scene.pause(); // стоп update: никто не разбредается
  const cam = d.cameras.main;
  cam.setZoom(4);
  cam.centerOn(sp.x, sp.y - 8);
  return sp;
});
await sleep(400);
await page.screenshot({ path: path.join(OUT, `animals-${MODE}.png`) });
console.log(`✓ animals-${MODE}.png (спавн ${focus.x},${focus.y})`);

// ── те же животные в walk-анимации (проверка оффсета в движении) ──
await page.evaluate(() => {
  const g = window.__game;
  const d = g.scene.getScene('DistrictScene');
  d.scene.resume();
  ['shot-cow', 'shot-pig', 'shot-dog', 'shot-chicken'].forEach(id => {
    const s = d.agentSprites.get(id);
    s.walkTo(s.x + 90, s.y);
  });
});
await sleep(900); // идут ~40px — кадр в движении
await page.evaluate(() => window.__game.scene.getScene('DistrictScene').scene.pause());
await sleep(200);
await page.screenshot({ path: path.join(OUT, `animals-walk-${MODE}.png`) });
console.log(`✓ animals-walk-${MODE}.png`);
await page.evaluate(() => window.__game.scene.getScene('DistrictScene').scene.resume());

// ── интерьеры: заходим в каждый, 2 человека рассаживаются ──
const INTERIORS = [
  ['OfficeScene', 'office'],
  ['CafeScene', 'cafe'],
  ['DormScene', 'dorm'],
  ['LibraryScene', 'library'],
];
let current = 'DistrictScene';
for (const [sceneKey, name] of INTERIORS) {
  await page.evaluate((from, to) => {
    const g = window.__game;
    g.scene.getScene(from).scene.start(to);
  }, current, sceneKey);
  current = sceneKey;
  await page.waitForFunction(
    (key) => window.__game.scene.getScene(key)?.scene.isActive(),
    { timeout: 10_000, polling: 100 }, sceneKey,
  );
  await sleep(500); // fade-in
  await page.evaluate((key) => {
    const sc = window.__game.scene.getScene(key);
    sc.syncAgents([
      { id: 'shot-h1', name: 'Alex', avatarVariant: 0 },
      { id: 'shot-h2', name: 'Molly', avatarVariant: 3 },
    ]);
  }, sceneKey);
  await sleep(4500); // дошли до мест и сели
  await page.screenshot({ path: path.join(OUT, `${name}-${MODE}.png`) });
  console.log(`✓ ${name}-${MODE}.png`);
}

await browser.close();
console.log('готово:', OUT);

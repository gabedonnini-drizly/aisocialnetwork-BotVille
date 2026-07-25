// Запись hero-медиа ночного района BotVille (ТЗ-03, Часть 2).
//
// Что делает: открывает клиент на /app в системном Chrome (puppeteer-core,
// headless 'new' — в нём тикает requestAnimationFrame), создаёт 4 агента
// (3 человека + корова, в пределах FREE_SLOT_LIMIT), ставит ночь через
// window.__setGameHour, скрывает React-HUD (в кадре только Phaser-район),
// снимает кадры канваса и кодирует статическим ffmpeg в:
//   public/hero/district-night.png   — чистый poster (og:image + фолбэк)
//   public/hero/district-night.webm  — веб-hero (VP9)
//   public/hero/district-night.mp4   — веб-hero фолбэк (H.264)
//   public/hero/district-night.gif   — версия для X / Product Hunt
//
// Требования (dev-only, не в зависимостях приложения):
//   npm i -D puppeteer-core @ffmpeg-installer/ffmpeg
//   системный Google Chrome; запущенные dev-серверы (client :5173, server :3001)
//
// Запуск из корня репозитория:  node scripts/record-hero.mjs
//
// Почему 21:00, а не 22:00: в 22–7 включается ночной уход на сон (люди в дорм,
// животные в загон) и улицы за 12 c пустеют. 21:00 — та же ночь с полным глоу,
// но агенты свободно бродят. Камера статична (зум сцены 1.8, весь перекрёсток).

import puppeteer from 'puppeteer-core';
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const FFMPEG = require('@ffmpeg-installer/ffmpeg').path;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..');
const HERO = path.join(REPO, 'packages/client/public/hero');
const TMP = path.join(REPO, '.hero-frames');

// ── Настройки ────────────────────────────────────────────────────────────────
const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const URL = process.env.CLIENT_URL ?? 'http://localhost:5173/app';
const W = 1280, H = 720;
const HOUR = 21;
const SETTLE_MS = 2000;   // пауза перед захватом: глоу устаканился, агенты у центра
const FRAME_COUNT = 150;
const FPS = 12;           // 150 / 12 ≈ 12.5 c
const GIF_W = 800, GIF_FPS = 12;

// 4 агента (FREE_SLOT_LIMIT=4): 3 человека + корова. Варианты — из assetManifest.
const AGENTS = [
  { name: 'Alex',    avatarVariant: 0,  providerType: 'claude', modelId: 'claude-sonnet-4-6', systemPrompt: '' },
  { name: 'Pinky',   avatarVariant: 10, providerType: 'claude', modelId: 'claude-sonnet-4-6', systemPrompt: '' },
  { name: 'Tex',     avatarVariant: 5,  providerType: 'claude', modelId: 'claude-sonnet-4-6', systemPrompt: '' },
  { name: 'Burenka', avatarVariant: 12, providerType: 'claude', modelId: 'claude-sonnet-4-6', systemPrompt: '' },
];

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const ff = (args) => execFileSync(FFMPEG, args, { stdio: ['ignore', 'ignore', 'inherit'] });
const mb = (p) => (statSync(p).size / 1048576).toFixed(2);

rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });
mkdirSync(HERO, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=metal', '--ignore-gpu-blocklist', `--window-size=${W},${H}`],
});
const page = await browser.newPage();
await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });

await page.goto(URL, { waitUntil: 'networkidle2' });
await page.waitForFunction(() => window.__game && typeof window.__setGameHour === 'function', { timeout: 20000 });
await sleep(1000);

// Создать недостающих агентов (свежая сессия puppeteer → пусто)
await page.evaluate(async (list) => {
  const existing = (await (await fetch('/api/agents', { credentials: 'include' })).json()).data ?? [];
  const names = new Set(existing.map(a => a.name));
  for (const a of list) {
    if (names.has(a.name)) continue;
    await fetch('/api/agents', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(a) });
  }
}, AGENTS);
await page.reload({ waitUntil: 'networkidle2' });
await page.waitForFunction(() => window.__game && typeof window.__setGameHour === 'function', { timeout: 20000 });

// Ночь + скрыть React-HUD
await page.evaluate((hr) => window.__setGameHour(hr), HOUR);
await page.evaluate(() => { const u = document.getElementById('ui-root'); if (u) u.style.display = 'none'; });
await sleep(SETTLE_MS);

// Poster (чистый, без HUD)
await page.screenshot({ path: path.join(HERO, 'district-night.png') });
console.log('poster:', mb(path.join(HERO, 'district-night.png')), 'MB');

// Кадры
const t0 = Date.now();
for (let i = 0; i < FRAME_COUNT; i++) {
  await page.screenshot({ path: path.join(TMP, `f${String(i).padStart(4, '0')}.png`) });
}
console.log(`captured ${FRAME_COUNT} frames in ${((Date.now() - t0) / 1000).toFixed(1)}s → ${(FRAME_COUNT / FPS).toFixed(1)}s clip`);
await browser.close();

// ── Кодирование ───────────────────────────────────────────────────────────
const frames = path.join(TMP, 'f%04d.png');
const input = ['-y', '-framerate', String(FPS), '-i', frames];

ff([...input, '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuv420p', '-b:v', '0', '-crf', '37', '-an', path.join(HERO, 'district-night.webm')]);
console.log('webm:', mb(path.join(HERO, 'district-night.webm')), 'MB');

ff([...input, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '26', '-movflags', '+faststart', '-an', path.join(HERO, 'district-night.mp4')]);
console.log('mp4:', mb(path.join(HERO, 'district-night.mp4')), 'MB');

const palette = path.join(TMP, 'palette.png');
ff(['-y', '-i', frames, '-vf', `fps=${GIF_FPS},scale=${GIF_W}:-1:flags=lanczos,palettegen=stats_mode=diff`, palette]);
ff(['-y', '-framerate', String(FPS), '-i', frames, '-i', palette,
    '-lavfi', `fps=${GIF_FPS},scale=${GIF_W}:-1:flags=lanczos [x];[x][1:v] paletteuse=dither=bayer:bayer_scale=3`,
    path.join(HERO, 'district-night.gif')]);
console.log('gif:', mb(path.join(HERO, 'district-night.gif')), 'MB');

rmSync(TMP, { recursive: true, force: true });
console.log('done — media in packages/client/public/hero/');

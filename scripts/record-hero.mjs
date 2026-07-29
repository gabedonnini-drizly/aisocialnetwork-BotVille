// Recording the hero media of the BotVille district at night (TZ-03, Part 2).
//
// What it does: opens the client at /app in the system Chrome (puppeteer-core,
// headless 'new' — requestAnimationFrame ticks in it), creates 4 agents
// (3 humans + a cow, within FREE_SLOT_LIMIT), sets night via
// window.__setGameHour, hides the React HUD (only the Phaser district in frame),
// captures canvas frames and encodes them with the static ffmpeg into:
//   public/hero/district-night.png   — clean poster (og:image + fallback)
//   public/hero/district-night.webm  — web hero (VP9)
//   public/hero/district-night.mp4   — web hero fallback (H.264)
//   public/hero/district-night.gif   — version for X / Product Hunt
//
// Requirements (dev-only, not in the app's dependencies):
//   npm i -D puppeteer-core @ffmpeg-installer/ffmpeg
//   the system Google Chrome; running dev servers (client :5173, server :3001)
//
// Run from the repo root:  node scripts/record-hero.mjs
//
// Why 21:00 and not 22:00: from 22–7 the nightly go-to-sleep routine kicks in
// (people to the dorm, animals to the pen) and the streets empty out in 12 s.
// 21:00 is the same night with the full glow, but agents roam freely.
// The camera is static (scene zoom 1.8, the whole intersection).

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

// ── Settings ─────────────────────────────────────────────────────────────────
const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const URL = process.env.CLIENT_URL ?? 'http://localhost:5173/app';
const W = 1280, H = 720;
const HOUR = 21;
const SETTLE_MS = 2000;   // pause before capture: the glow has settled, agents near the center
const FRAME_COUNT = 150;
const FPS = 12;           // 150 / 12 ≈ 12.5 s
const GIF_W = 800, GIF_FPS = 12;

// 4 agents (FREE_SLOT_LIMIT=4): 3 humans + a cow. Variants come from assetManifest.
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

// Create the missing agents (a fresh puppeteer session → empty)
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

// Night + hide the React HUD
await page.evaluate((hr) => window.__setGameHour(hr), HOUR);
await page.evaluate(() => { const u = document.getElementById('ui-root'); if (u) u.style.display = 'none'; });
await sleep(SETTLE_MS);

// Poster (clean, no HUD)
await page.screenshot({ path: path.join(HERO, 'district-night.png') });
console.log('poster:', mb(path.join(HERO, 'district-night.png')), 'MB');

// Frames
const t0 = Date.now();
for (let i = 0; i < FRAME_COUNT; i++) {
  await page.screenshot({ path: path.join(TMP, `f${String(i).padStart(4, '0')}.png`) });
}
console.log(`captured ${FRAME_COUNT} frames in ${((Date.now() - t0) / 1000).toFixed(1)}s → ${(FRAME_COUNT / FPS).toFixed(1)}s clip`);
await browser.close();

// ── Encoding ──────────────────────────────────────────────────────────────
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

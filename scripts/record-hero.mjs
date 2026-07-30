// Recording the hero media of the BotVille district at night (TZ-03, Part 2).
//
// What it does: opens the client at /app in the system Chrome (puppeteer-core,
// headless 'new' — requestAnimationFrame ticks in it), creates 4 agents
// (3 humans + a cow, within FREE_SLOT_LIMIT), sets night via
// window.__setGameHour, hides the React HUD but keeps the LimeZu ArtCredit
// link on screen (the Phaser district plus the licence-required attribution
// line — see ui/ArtCredit.tsx — are in frame; nothing else React-side is),
// captures canvas frames and encodes them with the static ffmpeg into:
//   public/hero/district-night.png   — clean poster (og:image + fallback)
//   public/hero/district-night.webm  — web hero (VP9)
//   public/hero/district-night.mp4   — web hero fallback (H.264)
//   public/hero/district-night.gif   — version for X / Product Hunt
//
// Requirements (dev-only, not in the app's dependencies):
//   npm i -D puppeteer-core
//   a system ffmpeg (brew install ffmpeg) with libx264, libvpx-vp9 and gif
//   (palettegen/paletteuse) support — @ffmpeg-installer/ffmpeg is deliberately
//   not a project dependency, so this script resolves ffmpeg from the system
//   (FFMPEG_PATH env var, else whatever `ffmpeg` resolves to on PATH), falling
//   back to the npm installer package only if it happens to be present;
//   the system Google Chrome (or another Chromium, via CHROME_PATH); running
//   dev servers (client :5173, server :3001)
//
// Run from the repo root:  node scripts/record-hero.mjs
//
// Why 21:00 and not 22:00: from 22–7 the nightly go-to-sleep routine kicks in
// (people to the dorm, animals to the pen) and the streets empty out in 12 s.
// 21:00 is the same night with the full glow, but agents roam freely.
// The camera is static (scene zoom 2, the whole intersection).

import puppeteer from 'puppeteer-core';
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
function resolveFfmpeg() {
  if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH;
  try {
    return require('@ffmpeg-installer/ffmpeg').path;
  } catch {
    return 'ffmpeg'; // resolved from PATH by execFileSync/the shell
  }
}
const FFMPEG = resolveFfmpeg();

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

// Night + hide the React HUD — but NOT the LimeZu ArtCredit link: #ui-root is
// the actual React mount (index.html), and ArtCredit renders inside it
// alongside the HUD (App.tsx), so hiding the whole root would drop the
// licence-required attribution from the hero image. Hide every child of the
// app's #ui-overlay div except the credit anchor instead.
await page.evaluate((hr) => window.__setGameHour(hr), HOUR);
await page.evaluate(() => {
  const overlay = document.getElementById('ui-overlay');
  if (!overlay) return;
  for (const el of overlay.children) {
    const isCredit = el.tagName === 'A' && el.textContent?.includes('LimeZu');
    if (!isCredit) el.style.display = 'none';
  }
});
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

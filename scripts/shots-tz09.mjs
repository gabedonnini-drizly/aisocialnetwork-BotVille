// TZ-09 delivery: screenshots of the interior doors (after the doormat fix) plus
// recordings of camera control GIFs (drag-pan on desktop, pan/pinch in mobile
// emulation with real CDP touch events — Phaser brings up the TouchManager).
//
// Requires a running dev client (:5173) and the system Chrome; the server is not needed
// (agents are injected into the scene via syncAgents, purely visual).
// ffmpeg: npm i --no-save @ffmpeg-installer/ffmpeg (same as for record-hero).
//
// Run from the repo root:  node scripts/shots-tz09.mjs
// Output: docs/screenshots/tz09/{office,cafe,dorm,library}-door-after.png
//        docs/screenshots/tz09/camera-desktop-pan.gif
//        docs/screenshots/tz09/camera-mobile-pan-pinch.gif

import puppeteer from 'puppeteer-core';
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const FFMPEG = require('@ffmpeg-installer/ffmpeg').path;

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'docs/screenshots/tz09');
const TMP = path.join(ROOT, '.tz09-frames');
const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = process.env.CLIENT_URL ?? 'http://localhost:5173';
const FPS = 12;

mkdirSync(OUT, { recursive: true });
rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const ff = (args) => execFileSync(FFMPEG, args, { stdio: ['ignore', 'ignore', 'inherit'] });

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=metal', '--ignore-gpu-blocklist'],
});

async function openApp(page) {
  await page.goto(BASE + '/app', { waitUntil: 'networkidle2' });
  await page.waitForFunction(
    () => window.__game?.scene.getScene('DistrictScene')?.scene.isActive(),
    { timeout: 60_000, polling: 250 },
  );
  await page.evaluate(() => {
    window.__setGameHour(12);
    const d = window.__game.scene.getScene('DistrictScene');
    d.syncAgents([
      { id: 'shot-1', name: 'Alex', avatarVariant: 0 },
      { id: 'shot-2', name: 'Molly', avatarVariant: 3 },
    ]);
  });
  await sleep(600); // fade-in
}

async function gif(prefix, name) {
  const frames = path.join(TMP, `${prefix}-%04d.png`);
  const palette = path.join(TMP, `${prefix}-palette.png`);
  ff(['-y', '-framerate', String(FPS), '-i', frames, '-vf', 'palettegen=stats_mode=diff', palette]);
  ff(['-y', '-framerate', String(FPS), '-i', frames, '-i', palette,
    '-lavfi', 'paletteuse=dither=bayer:bayer_scale=3', path.join(OUT, name)]);
  console.log('✓', name);
}

// ── 1. Doors of the 4 interiors (desktop viewport, camera zooms in on the doorway) ──
{
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
  await openApp(page);
  await page.evaluate(() => { document.getElementById('ui-root').style.display = 'none'; });

  const INTERIORS = [
    ['OfficeScene', 'office'], ['CafeScene', 'cafe'],
    ['DormScene', 'dorm'], ['LibraryScene', 'library'],
  ];
  let current = 'DistrictScene';
  for (const [sceneKey, name] of INTERIORS) {
    await page.evaluate((from, to) => {
      window.__game.scene.getScene(from).scene.start(to);
    }, current, sceneKey);
    current = sceneKey;
    await page.waitForFunction(
      (key) => window.__game.scene.getScene(key)?.scene.isActive(),
      { timeout: 10_000, polling: 100 }, sceneKey,
    );
    await sleep(500); // fade-in
    // close-up of the doorway: center of the gap (160), bottom of the room
    await page.evaluate((key) => {
      const cam = window.__game.scene.getScene(key).cameras.main;
      cam.setZoom(4);
      cam.centerOn(160, 196);
    }, sceneKey);
    await sleep(250);
    await page.screenshot({ path: path.join(OUT, `${name}-door-after.png`) });
    console.log(`✓ ${name}-door-after.png`);
  }
  await page.close();
}

// ── 2. Desktop: pan with a left-button drag (mouse via CDP => real events) ──
{
  const page = await browser.newPage();
  await page.setViewport({ width: 960, height: 600, deviceScaleFactor: 1 });
  await openApp(page);

  let n = 0;
  const shot = () => page.screenshot({ path: path.join(TMP, `desk-${String(n++).padStart(4, '0')}.png`) });

  await shot();
  // drag right-down, then left-up (the world follows the finger), with inertia
  for (const [fromX, fromY, dx, dy] of [[480, 300, 260, 160], [700, 420, -420, -260]]) {
    await page.mouse.move(fromX, fromY);
    await page.mouse.down();
    const steps = 14;
    for (let i = 1; i <= steps; i++) {
      await page.mouse.move(fromX + dx * i / steps, fromY + dy * i / steps);
      await shot();
    }
    await page.mouse.up();
    for (let i = 0; i < 8; i++) { await sleep(60); await shot(); } // inertia
  }
  await page.close();
  await gif('desk', 'camera-desktop-pan.gif');
}

// ── 3. Mobile: one-finger pan + pinch zoom (CDP touch, iPhone viewport) ──
{
  const page = await browser.newPage();
  await page.setViewport({ width: 375, height: 812, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await openApp(page);

  const cdp = await page.createCDPSession();
  const touches = (pts) => pts.map(([x, y], i) => ({ x, y, id: i, force: 1, radiusX: 4, radiusY: 4 }));
  const dispatch = (type, pts) =>
    cdp.send('Input.dispatchTouchEvent', { type, touchPoints: touches(pts) });

  let n = 0;
  const shot = () => page.screenshot({ path: path.join(TMP, `mob-${String(n++).padStart(4, '0')}.png`) });

  await shot();
  // one-finger diagonal pan, there and back
  for (const [fromX, fromY, dx, dy] of [[190, 500, -120, -220], [120, 260, 160, 300]]) {
    await dispatch('touchStart', [[fromX, fromY]]);
    const steps = 12;
    for (let i = 1; i <= steps; i++) {
      await dispatch('touchMove', [[fromX + dx * i / steps, fromY + dy * i / steps]]);
      await shot();
    }
    await dispatch('touchEnd', []);
    for (let i = 0; i < 6; i++) { await sleep(60); await shot(); } // inertia
  }
  // pinch-out (zoom +), then pinch-in (zoom − down to the clamp limit)
  for (const dir of [1, -1]) {
    const cx = 187, cy = 420;
    const start = dir > 0 ? 40 : 150;
    const end = dir > 0 ? 150 : 40;
    await dispatch('touchStart', [[cx - start, cy], [cx + start, cy]]);
    const steps = 12;
    for (let i = 1; i <= steps; i++) {
      const r = start + (end - start) * i / steps;
      await dispatch('touchMove', [[cx - r, cy], [cx + r, cy]]);
      await shot();
    }
    await dispatch('touchEnd', []);
    await shot();
  }
  await page.close();
  await gif('mob', 'camera-mobile-pan-pinch.gif');
}

await browser.close();
rmSync(TMP, { recursive: true, force: true });
console.log('done:', OUT);

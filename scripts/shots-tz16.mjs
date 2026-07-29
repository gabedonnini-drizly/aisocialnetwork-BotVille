// TZ-16 delivery (agent locations + the end of "teleporting after the player").
//
// Modes:
//   node scripts/shots-tz16.mjs desk    — 1280x800: proof of the fix (an empty
//                                         cafe / the agent in the library), a reload,
//                                         clicking from the HUD takes you to the agent, night (dorm/pen)
//   node scripts/shots-tz16.mjs mobile  — 375x667: the HUD with agent locations
//   node scripts/shots-tz16.mjs move    — an agent changes location on its own over time
//                                         (waits for a real tick transition, up to ~5.5 min)
//
// Requires the following to be up:
//   1) the server on a temporary DB:  PORT=3999 DB_PATH=<tmp>/tz16.db DEMO_ENABLED=false
//      CLIENT_ORIGIN=http://localhost:5178 node --env-file=.env --import tsx src/index.ts
//   2) the client: VITE_API_URL=http://localhost:3999 npx vite build &&
//              npx vite preview --port 5178 --strictPort
// Output: docs/screenshots/tz16/
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
// path to the same DB the server uses — for deterministic agent placement
const DB = process.env.DB_PATH;
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/** Set the WORLD clock on the server (the TZ-16 dev endpoint); the client catches up on its own. */
async function setWorldHour(h) {
  const res = await fetch(`${API}/api/debug/game-hour`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hour: h }),
  });
  if (!res.ok) throw new Error(`debug/game-hour: ${res.status}`);
}

/** Place agents at specific locations (the source of truth is the DB, the server reads it live). */
function placeAgents(byName) {
  if (!DB) throw new Error('the DB_PATH env var is required (the same DB the server uses)');
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

// move to another scene the way a player would, through the door (the scene's public transitionTo)
const goScene = async (from, to) => {
  await page.evaluate(([f, t]) => window.__game.scene.getScene(f).transitionTo(t), [from, to]);
  await waitScene(to);
  await sleep(900); // fade + seating
};

const shot = async (name) => {
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  console.log(`✓ ${name}.png`);
};

// ── Setup: daytime, a fresh roster — 2 humans + 2 animals (4 agents, as in the FPS measurement) ──
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

// ── move: an agent changes location on its own on the tick schedule (2–4 game hours) ──
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
  console.log('before:', `hour ${before.gameHour.toFixed(1)}`, JSON.stringify(before.locations));
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
  if (!after) throw new Error('nobody moved in 5.5 minutes — is the life tick broken?');
  console.log('after: ', `hour ${after.gameHour.toFixed(1)}`, JSON.stringify(after.locations));
  await sleep(16_000); // the client polling will refresh both the HUD and the scene
  await shot('desk-move-after');
  await browser.close();
  console.log('done:', OUT);
  process.exit(0);
}

// ── Deterministic setup for the bug scenario: Dana in the library, the rest outside ──
placeAgents({ Dana: 'library', Riley: 'district', Mooki: 'district', Chirp: 'district' });
await page.reload({ waitUntil: 'networkidle2' });
await waitScene('DistrictScene');
await sleep(1200);

const prefix = MOBILE ? 'mob' : 'desk';

if (MOBILE) {
  // the HUD with agent locations at 375px (day) + the night HUD
  await shot('mob-hud-day');
  await setWorldHour(23);
  await sleep(12_000); // the server tick will send everyone to their night spots
  await page.reload({ waitUntil: 'networkidle2' });
  await waitScene('DistrictScene');
  await sleep(1500);
  await shot('mob-hud-night');
  await browser.close();
  console.log('done:', OUT);
  process.exit(0);
}

// 0) the district by day: three outside, Dana not visible (she is in the library), HUD with locations
await shot('desk-district-day');

// 1) PROOF OF THE FIX: the player enters the cafe — it is EMPTY (previously all
//    agents used to teleport here)
await goScene('DistrictScene', 'CafeScene');
await shot('desk-cafe-empty');

// 2) walks to the library — Dana is there (the agent did not "follow along", she LIVES there)
await goScene('CafeScene', 'DistrictScene');
await goScene('DistrictScene', 'LibraryScene');
await shot('desk-library-dana');

// 3) survives a reload: F5 — Dana is still in the library
await page.reload({ waitUntil: 'networkidle2' });
await waitScene('DistrictScene');
await sleep(800);
await goScene('DistrictScene', 'LibraryScene');
await shot('desk-library-after-reload');

// 4) clicking an agent in the HUD takes you to them: from the district straight to Dana's library
await goScene('LibraryScene', 'DistrictScene');
await page.evaluate(() => {
  const name = [...document.querySelectorAll('[class*="slotName"]')]
    .find(el => el.textContent === 'Dana');
  if (!name) throw new Error('Dana slot not found');
  name.closest('[class*="slot"]').dispatchEvent(new MouseEvent('click', { bubbles: true }));
});
await waitScene('LibraryScene');
await sleep(900);
// the profile opens on top — close it so the world is visible
await page.evaluate(() => document.querySelector('[class*="closeBtn"]')?.click());
await sleep(400);
await shot('desk-goto-from-hud');

// 5) night: the server puts the humans in the dorm and the animals in the pen; the glow isn't broken
await setWorldHour(23);
await sleep(12_000); // the tick (10 s) + some slack
await page.reload({ waitUntil: 'networkidle2' });
await waitScene('DistrictScene');
await sleep(2500); // the animals reach the pen and fall asleep (Z)
await shot('desk-night-district');

// FPS at night with 4 agents (compare with the ~119 baseline)
const fps = await page.evaluate(async () => {
  const samples = [];
  for (let i = 0; i < 20; i++) {
    samples.push(window.__game.loop.actualFps);
    await new Promise(r => setTimeout(r, 100));
  }
  return (samples.reduce((a, b) => a + b, 0) / samples.length).toFixed(1);
});
console.log(`FPS at night with 4 agents: ${fps}`);

// 6) the dorm at night: the humans sleep in beds (wait until they get there and lie down)
await goScene('DistrictScene', 'DormScene');
await page.waitForFunction(() => {
  const scene = window.__game.scene.getScene('DormScene');
  return [...scene.agentSprites.values()].some(s => s.isSeated && s.currentSeatKind === 'bed');
}, { timeout: 20_000, polling: 300 });
await sleep(1500); // and the second one will arrive too
await shot('desk-night-dorm');

// 7) waking by click: a real mouse click on someone asleep in a bed
const bedPos = await page.evaluate(() => {
  const scene = window.__game.scene.getScene('DormScene');
  const sprite = [...scene.agentSprites.values()].find(s => s.isSeated && s.currentSeatKind === 'bed');
  if (!sprite) throw new Error('nobody is asleep in a bed in the dorm');
  const cam = scene.cameras.main;
  const rect = window.__game.canvas.getBoundingClientRect();
  return {
    x: rect.left + (sprite.x - cam.worldView.x) * cam.zoom,
    y: rect.top + (sprite.y - cam.worldView.y) * cam.zoom - 8 * cam.zoom, // the body sits above the anchor point
  };
});
await page.mouse.click(bedPos.x, bedPos.y);
await sleep(1200);
// the click opens the profile — close it to see the agent who got up
await page.evaluate(() => document.querySelector('[class*="closeBtn"]')?.click());
await sleep(500);
await shot('desk-night-dorm-woken');

await browser.close();
console.log('done:', OUT);
process.exit(0);

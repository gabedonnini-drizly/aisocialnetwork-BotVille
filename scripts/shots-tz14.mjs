// TZ-14 delivery (OpenRouter + user-level keys): screenshots + a desktop control check.
//
// Modes:
//   node scripts/shots-tz14.mjs desk     — 1280x800: the keys panel, creating an agent
//                                          with a saved key, the OpenRouter catalog, chat
//   node scripts/shots-tz14.mjs mobile   — 375x667 (iPhone SE): the same
//   node scripts/shots-tz14.mjs before   — baseline of the UNTOUCHED screens (profile, chat)
//   node scripts/shots-tz14.mjs after    — the same ones after the changes
//   node scripts/shots-tz14.mjs diff     — pixel-by-pixel comparison of before/after (must be 0)
//
// Requires the following to be up:
//   1) mock provider:  node scripts/mock-openai-provider.mjs 4010
//   2) the server on a temporary DB (:3999, DEMO_ENABLED=false)
//   3) the client:     VITE_API_URL=http://localhost:3999 npx vite build &&
//                      npx vite preview --port 5178 --strictPort
// Output: docs/screenshots/tz14/
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

// ── diff: pixel-by-pixel comparison of the untouched screens ──
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
    console.log(`desk-${name}: ${diff === -1 ? 'DIFFERENT SIZE' : diff + ' px diff'}`);
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

// Session state: a saved user key (once!) + two agents WITHOUT personal
// keys — exactly the acceptance scenario. The control mode needs no key.
await page.evaluate(async ({ mockUrl, control, apiBase }) => {
  // The client and the server are on different ports (like different sites in prod), so the
  // session travels as a token from localStorage rather than as a cookie (TZ-12).
  const token = localStorage.getItem('av_session_token');
  const api = (p, init = {}) => fetch(apiBase + p, {
    credentials: 'include',
    ...init,
    headers: { ...(init.headers ?? {}), 'X-Session-Token': token },
  });
  // The control frames are also taken with the old client build (pre-TZ-14), so
  // there the agents use claude: the old client simply doesn't know the 'custom' provider
  // and would render an empty name — that would be a false diff, not a regression.
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

// The world is non-deterministic (agents roam) — hide the canvas for the React-layer frames
if (!MOBILE) await page.evaluate(() => { document.getElementById('game-container').style.display = 'none'; });

const prefix = MOBILE ? 'mob' : 'desk';
const suffix = CONTROL ? `-${MODE}` : '';
const shot = async (name) => {
  await page.evaluate(() => window.__setGameHour(12));
  await page.screenshot({ path: path.join(OUT, `${prefix}-${name}${suffix}.png`) });
  console.log(`✓ ${prefix}-${name}${suffix}.png`);
};
// The provider is the modal's first <select> (the second one, if present, is the model list)
const selectProvider = async (value) => {
  const [provider] = await page.$$('select');
  await provider.select(value);
};
const clickText = (re) => page.evaluate((src) => {
  const rx = new RegExp(src, 'i');
  const btn = [...document.querySelectorAll('button')].find(b => rx.test(b.textContent));
  if (!btn) throw new Error('button not found: ' + src);
  btn.click();
}, re.source);

// ── Control frames: screens that TZ-14 must not change ──
// We capture the panels THEMSELVES rather than the whole screen: a keys button was added to
// the HUD, and being centered it shifts by definition — that is new functionality,
// not a regression. The control here is about the profile and chat not drifting.
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
  console.log('done:', OUT);
  process.exit(0);
}

// ── 1) The keys panel from the HUD ──
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

// ── 2) Creating an agent: the saved key instead of an empty field ──
await page.evaluate(() => {
  document.querySelector('[class*="emptySlot"]').dispatchEvent(new MouseEvent('click', { bubbles: true }));
});
await page.waitForSelector('[class*="modal"]', { timeout: 5000 });
await sleep(400);
// provider → custom (its key is already saved)
await selectProvider('custom');
await sleep(300);
await page.evaluate(() => {
  const m = document.querySelector('[class*="modal"]');
  m.scrollTop = m.scrollHeight;
});
await sleep(200);
await shot('create-saved-key');

// ── 3) The live OpenRouter catalog: search + the free-models block ──
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

// catalog search
await page.evaluate(() => {
  const input = document.querySelector('[class*="search"]');
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(input, 'qwen');
  input.dispatchEvent(new Event('input', { bubbles: true }));
});
await sleep(400);
await shot('openrouter-search');

await clickText(/cancel/);
await sleep(250);

// ── 4) Both agents reply using the same saved key ──
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
    setter.call(ta, 'hello');
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await sleep(150);
  await page.evaluate(() => document.querySelector('[class*="sendBtn"]').click());
  // wait for the finished reply (the mock provider's stream takes ~1 s)
  // NB: this must match the text streamed by scripts/mock-openai-provider.mjs.
  await page.waitForFunction(
    () => /Key accepted/.test(document.body.innerText),
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

// ── 5) A wrong key → a human-readable error, not silence ──
// We give the agent's personal key a deliberately wrong value: it takes priority over
// the saved one, so the provider will answer 401 — we check the text in the feed.
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
  setter.call(ta, 'hello');
  ta.dispatchEvent(new Event('input', { bubbles: true }));
});
await sleep(150);
await page.evaluate(() => document.querySelector('[class*="sendBtn"]').click());
// NB: the "." wildcard matches the typographic apostrophe in "didn’t" (en.ts model.keyBad).
await page.waitForFunction(
  () => /didn.t work/i.test(document.body.innerText),
  { timeout: 20_000, polling: 250 },
);
await sleep(300);
await shot('bad-key-error');

await browser.close();
console.log('done:', OUT);

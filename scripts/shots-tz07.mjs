// Acceptance screenshots for the landing page and the HUD/chat. Originally the
// TZ-07 EN/RU i18n check; the app is English-only now, so what remains is a
// smoke test of the landing copy, agent creation and the chat flow.
// Requires running dev servers (client :5173, server :3001) and the system Chrome.
// Run from the repo root:  node scripts/shots-tz07.mjs
// Output: docs/screenshots/tz07/{landing,app-chat}.png

import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'docs/screenshots/tz07');
const BASE = 'http://localhost:5173';

mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Click a button by exact text (CSS modules hash the class names — so we search by text)
async function clickText(page, selector, text) {
  const ok = await page.evaluate((sel, txt) => {
    const el = [...document.querySelectorAll(sel)].find(e => e.textContent.trim() === txt);
    if (el) { el.click(); return true; }
    return false;
  }, selector, text);
  if (!ok) throw new Error(`clickText: could not find ${selector} with text "${text}"`);
}

async function expectText(page, text, where) {
  const ok = await page.evaluate((txt) => document.body.innerText.includes(txt), text);
  if (!ok) throw new Error(`CHECK: ${where} does not contain the text "${text}"`);
  console.log(`  ✓ ${where}: has "${text}"`);
}

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new' });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800 });

// ── Landing ──
await page.goto(BASE + '/', { waitUntil: 'networkidle0' });
await sleep(500);
await expectText(page, 'Your own city of AI agents', 'the landing page');
console.log('  title:', await page.title(), '| lang:', await page.evaluate(() => document.documentElement.lang));
await page.screenshot({ path: path.join(OUT, 'landing.png') });

// ── App: chat needs an agent — create one via the API if there are none ──
await page.goto(BASE + '/app', { waitUntil: 'networkidle0' });
const agents = await page.evaluate(async () => {
  const res = await fetch('/api/agents');
  return (await res.json()).data ?? [];
});
if (agents.length === 0) {
  console.log('  no agents — creating Alex (deepseek, no key → demo)');
  await page.evaluate(async () => {
    await fetch('/api/agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Alex', avatarVariant: 0, systemPrompt: '',
        providerType: 'deepseek', modelId: 'deepseek-chat',
      }),
    });
  });
  await page.reload({ waitUntil: 'networkidle0' });
}
await sleep(7000); // Phaser preloader + the first scene

// ── HUD/chat ──
await expectText(page, 'Idle', 'the HUD (status)');
// agent slot → profile → chat
const agentName = await page.evaluate(() => {
  const slot = [...document.querySelectorAll('[title]')].find(e => e.title.includes('Right-click'));
  if (!slot) return null;
  slot.click();
  return slot.title.split('—')[0].trim();
});
if (!agentName) throw new Error('could not find the agent slot in the HUD');
await sleep(600);
await expectText(page, 'No personality set.', 'the profile'); // the label above is uppercased via CSS
await clickText(page, 'button', '💬 Chat');
await sleep(600);
await expectText(page, `Start a conversation with ${agentName}`, 'the chat');
await page.screenshot({ path: path.join(OUT, 'app-chat.png') });

await browser.close();
console.log('Done:', OUT);

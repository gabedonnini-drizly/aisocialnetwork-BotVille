// Скриншоты приёмки ТЗ-07 (i18n EN/RU): лендинг и HUD/чат в обоих языках.
// Требует запущенных dev-серверов (client :5173, server :3001) и системный Chrome.
// Запуск из корня репозитория:  node scripts/shots-tz07.mjs
// Выход: docs/screenshots/tz07/{landing,app-chat}-{en,ru}.png

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

// Клик по кнопке с точным текстом (CSS-modules хешируют классы — ищем по тексту)
async function clickText(page, selector, text) {
  const ok = await page.evaluate((sel, txt) => {
    const el = [...document.querySelectorAll(sel)].find(e => e.textContent.trim() === txt);
    if (el) { el.click(); return true; }
    return false;
  }, selector, text);
  if (!ok) throw new Error(`clickText: не нашёл ${selector} с текстом "${text}"`);
}

async function expectText(page, text, where) {
  const ok = await page.evaluate((txt) => document.body.innerText.includes(txt), text);
  if (!ok) throw new Error(`ПРОВЕРКА: на ${where} нет текста "${text}"`);
  console.log(`  ✓ ${where}: есть "${text}"`);
}

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new' });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800 });

// ── Автодетект: без localStorage язык берётся из navigator.language ──
await page.goto(BASE + '/', { waitUntil: 'networkidle0' });
await page.evaluate(() => localStorage.removeItem('av_locale'));
await page.reload({ waitUntil: 'networkidle0' });
await sleep(500);
const navLang = await page.evaluate(() => navigator.language);
const autoRu = await page.evaluate(() => document.body.innerText.includes('Свой город ИИ-агентов'));
const autoEn = await page.evaluate(() => document.body.innerText.includes('Your own city of AI agents'));
console.log(`  автодетект: navigator.language=${navLang} → ${autoRu ? 'RU' : autoEn ? 'EN' : '???'}`);
if (navLang.toLowerCase().startsWith('ru') ? !autoRu : !autoEn) throw new Error('автодетект локали не совпал с navigator.language');

// ── Лендинг EN (явный клик по тумблеру) ──
await clickText(page, 'button', 'EN');
await sleep(300);
await expectText(page, 'Your own city of AI agents', 'лендинге EN');
console.log('  title:', await page.title(), '| lang:', await page.evaluate(() => document.documentElement.lang));
await page.screenshot({ path: path.join(OUT, 'landing-en.png') });

// ── Лендинг RU (клик по тумблеру) ──
await clickText(page, 'button', 'RU');
await sleep(300);
await expectText(page, 'Свой город ИИ-агентов', 'лендинге RU');
console.log('  title:', await page.title(), '| lang:', await page.evaluate(() => document.documentElement.lang));
await page.screenshot({ path: path.join(OUT, 'landing-ru.png') });

// Явный выбор переживает перезагрузку
await page.reload({ waitUntil: 'networkidle0' });
await sleep(500);
await expectText(page, 'Свой город ИИ-агентов', 'лендинге после reload (localStorage av_locale=ru)');

// ── Приложение: агент нужен для чата — создаём через API, если пусто ──
await page.evaluate(() => localStorage.setItem('av_locale', 'en'));
await page.goto(BASE + '/app', { waitUntil: 'networkidle0' });
const agents = await page.evaluate(async () => {
  const res = await fetch('/api/agents');
  return (await res.json()).data ?? [];
});
if (agents.length === 0) {
  console.log('  агентов нет — создаю Alex (deepseek, без ключа → demo)');
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
await sleep(7000); // Phaser-прелоадер + первая сцена

// ── HUD/чат EN ──
await expectText(page, 'Idle', 'HUD EN (статус)');
// слот агента → профиль → чат
const agentName = await page.evaluate(() => {
  const slot = [...document.querySelectorAll('[title]')].find(e => e.title.includes('Right-click'));
  if (!slot) return null;
  slot.click();
  return slot.title.split('—')[0].trim();
});
if (!agentName) throw new Error('не нашёл слот агента в HUD');
await sleep(600);
await expectText(page, 'No personality set.', 'профиле EN'); // label выше — uppercase через CSS
await clickText(page, 'button', '💬 Chat');
await sleep(600);
await expectText(page, `Start a conversation with ${agentName}`, 'чате EN');
await page.screenshot({ path: path.join(OUT, 'app-chat-en.png') });

// ── HUD/чат RU (тумблер в HUD, мгновенный ререндер) ──
await clickText(page, 'button', 'RU');
await sleep(400);
await expectText(page, `Начни разговор с ${agentName}`, 'чате RU');
await expectText(page, 'Свободен', 'HUD RU (статус)');
await page.screenshot({ path: path.join(OUT, 'app-chat-ru.png') });

await browser.close();
console.log('Готово:', OUT);

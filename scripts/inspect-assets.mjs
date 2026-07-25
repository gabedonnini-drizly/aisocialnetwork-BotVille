#!/usr/bin/env node
/**
 * Шаг 0 ТЗ-01: разведка форматов LimeZu-спрайтшитов.
 * Читает размеры PNG (IHDR) без зависимостей и печатает таблицу:
 * персонажи premade, животные фермы, эмоции, UI, room-builder'ы.
 * Результаты фиксируются вручную в packages/client/src/game/assetManifest.ts.
 *
 * Запуск: node scripts/inspect-assets.mjs
 */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..');
const SRC = join(ROOT, 'assets-src');

function pngSize(file) {
  const buf = readFileSync(file);
  if (buf.readUInt32BE(12) !== 0x49484452) throw new Error(`not a PNG: ${file}`);
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

function report(title, dir, { filter = () => true, frame } = {}) {
  console.log(`\n=== ${title} (${relative(ROOT, dir)}) ===`);
  if (!existsSync(dir)) { console.log('  !! MISSING'); return; }
  const entries = statSync(dir).isDirectory()
    ? readdirSync(dir).filter(f => f.endsWith('.png') && filter(f)).map(f => join(dir, f))
    : [dir];
  for (const file of entries.sort()) {
    const { w, h } = pngSize(file);
    let grid = '';
    if (frame) grid = `  -> ${w / frame[0]} x ${h / frame[1]} кадров ${frame[0]}x${frame[1]}`;
    console.log(`  ${relative(SRC, file).padEnd(70)} ${String(w).padStart(5)} x ${h}${grid}`);
  }
}

// Персонажи premade: ожидаем листы 896x656 (из ТЗ), кадры предположительно 16x32
report('Premade characters', join(SRC, 'interiors', 'characters-premade'), { frame: [16, 32] });

// Животные фермы — каждая папка вида Cows, Pigs...
const animalsRoot = join(SRC, 'farm', '16x16', 'Animals_16x16');
for (const kind of readdirSync(animalsRoot).filter(d => statSync(join(animalsRoot, d)).isDirectory())) {
  report(`Animals / ${kind}`, join(animalsRoot, kind), { frame: [16, 16] });
}

// Гайд по анимациям фермерских персонажей (для сверки рядов)
report('Farm characters + guide', join(SRC, 'farm', '16x16', 'Characters_16x16'));

// Эмоции и UI
report('UI', join(SRC, 'interiors', 'ui'), { frame: [16, 16] });

// Room builders
report('Room Builder (interiors)', join(SRC, 'interiors', 'Room_Builder_16x16.png'));
report('Room Builder (office)', join(SRC, 'office', 'room-builder'));

// Тайлсеты, которые пойдут в карту района
const themes = join(SRC, 'exteriors', 'themes');
report('Exterior themes (нужные для district)', themes, {
  filter: f => /^(1_|2_|3_|4_|7_|9_|10_|16_|17_|24_)/.test(f) && !f.includes('Singles'),
});

// Ферма: основной тайлсет
report('Farm tilesets', join(SRC, 'farm', '16x16'), { filter: f => /^[0-9]_/.test(f) });

// Интерьерные тайлсеты для 4 сцен
report('Interior themes', join(SRC, 'interiors', 'themes'), {
  filter: f => /^(1_|2_|4_|5_|12_|16_|22_|24_)/.test(f),
});

// Анимированные объекты интерьеров/экстерьеров
report('Animated interiors', join(SRC, 'interiors', 'animated'));
report('Animated exteriors', join(SRC, 'exteriors', 'animated'));

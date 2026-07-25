#!/usr/bin/env node
/**
 * Инструмент разведки: вырезает список тайлов из спрайтшита в одну полосу
 * (с magenta-фоном и разделителями) для визуальной проверки координат.
 *
 * node scripts/tile-strip.mjs <sheet.png> <out.png> "tx,ty[,w,h];tx,ty;..."
 * Координаты в тайлах 16px; w,h — размер в тайлах (по умолчанию 1x1).
 */
import { writeFileSync } from 'node:fs';
import { decodePng, createCanvas, encodePng } from './png-lib.mjs';

const [sheet, out, spec] = process.argv.slice(2);
if (!spec) {
  console.error('usage: node tile-strip.mjs <sheet.png> <out.png> "tx,ty[,w,h];..."');
  process.exit(1);
}
const img = decodePng(sheet);
const items = spec.split(';').map(s => {
  const [tx, ty, w = 1, h = 1] = s.split(',').map(Number);
  return { tx, ty, w, h };
});
const maxH = Math.max(...items.map(i => i.h)) * 16;
const totalW = items.reduce((a, i) => a + i.w * 16 + 2, 2);
const cv = createCanvas(totalW, maxH + 4);
for (let y = 0; y < cv.h; y++) for (let x = 0; x < cv.w; x++) cv.set(x, y, [255, 0, 255, 255]);
let cx = 2;
for (const it of items) {
  cv.blit(img, it.tx * 16, it.ty * 16, it.w * 16, it.h * 16, cx, 2);
  cx += it.w * 16 + 2;
}
writeFileSync(out, encodePng(cv));
console.log(`${out}: ${items.length} тайлов, ${cv.w}x${cv.h}`);
console.log(items.map((i, n) => `#${n}=(${i.tx},${i.ty},${i.w}x${i.h})`).join(' '));

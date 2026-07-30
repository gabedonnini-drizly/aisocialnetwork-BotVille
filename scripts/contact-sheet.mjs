#!/usr/bin/env node
/**
 * Renders every chosen sprite in a group onto one page, so a human can judge
 * 116 curation decisions in one pass instead of 116.
 *
 * Each cell shows the sprite THREE ways, because those are the three ways it
 * fails:
 *   1x on its floor tile   — does it read at all, and does it fight the floor
 *   2x                     — is the crop clean, or is a neighbour's pixel in it
 *   1x night-tinted        — does it survive DAY_TINT_KEYS at alpha 0.45
 *
 * Labels live in a sibling .html rather than in the pixels: captioning inside
 * the PNG would mean shipping a bitmap font to do what CSS does for free.
 *
 *   node scripts/contact-sheet.mjs [pack] [srcRoot]
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCanvas, encodePng } from './png-lib.mjs';
import { loadContract } from './lib/assetContract.mjs';
import { loadAdapter } from './lib/sourceAdapter.mjs';
import { readSprite, asSource } from './lib/spriteReader.mjs';

const ROOT = resolve(fileURLToPath(import.meta.url), '..', '..');
const PAD = 8;

/** DAY_TINT_KEYS at its darkest: #0a0a2e over the sprite at alpha 0.45. */
export function nightTint(canvas) {
  const out = createCanvas(canvas.w, canvas.h);
  const TINT = [0x0a, 0x0a, 0x2e];
  for (let i = 0; i < canvas.data.length; i += 4) {
    if (canvas.data[i + 3] === 0) continue;
    for (let k = 0; k < 3; k++) out.data[i + k] = Math.round(canvas.data[i + k] * 0.55 + TINT[k] * 0.45);
    out.data[i + 3] = canvas.data[i + 3];
  }
  return out;
}

function scale(src, factor) {
  const out = createCanvas(src.w * factor, src.h * factor);
  for (let y = 0; y < out.h; y++)
    for (let x = 0; x < out.w; x++)
      out.set(x, y, src.px(Math.floor(x / factor), Math.floor(y / factor)));
  return out;
}

function tileFloor(canvas, floor, x0, y0, w, h) {
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      canvas.set(x0 + x, y0 + y, floor.px(x % floor.w, y % floor.h));
}

/**
 * @returns {{canvas: object, cells: Array<{name,x,y,w,h}>}}
 */
export function contactSheet(contract, adapter, group, { floorTile, columns = 8 }) {
  const names = Object.keys(contract.props[group]).sort();
  const floor = asSource(readSprite(adapter, floorTile).canvas);

  const sprites = names.map(name => ({ name, s: readSprite(adapter, name) }));
  // One cell width for the whole sheet: a ragged grid is unreadable, and a
  // sprite that overflows its cell is itself a finding.
  const cellW = Math.max(...sprites.map(({ s }) => s.w * 3 + PAD * 4));
  const cellH = Math.max(...sprites.map(({ s }) => s.h * 2 + PAD * 2));
  const rows = Math.ceil(sprites.length / columns);

  const canvas = createCanvas(columns * cellW, rows * cellH);
  const cells = [];

  sprites.forEach(({ name, s }, i) => {
    const cx = (i % columns) * cellW;
    const cy = Math.floor(i / columns) * cellH;
    tileFloor(canvas, floor, cx, cy, cellW, cellH);

    const src = asSource(s.canvas);
    const baseY = cy + cellH - PAD - s.h;

    canvas.blit(src, 0, 0, s.w, s.h, cx + PAD, baseY);                       // 1x on the floor
    const big = scale(src, 2);
    canvas.blit(asSource(big), 0, 0, big.w, big.h, cx + PAD * 2 + s.w, cy + cellH - PAD - big.h);
    const night = nightTint(s.canvas);
    canvas.blit(asSource(night), 0, 0, s.w, s.h, cx + PAD * 3 + s.w * 3, baseY);

    cells.push({ name, x: cx, y: cy, w: cellW, h: cellH });
  });

  return { canvas, cells, columns, cellW, cellH };
}

const esc = s => String(s ?? '').replace(/[&<>"]/g, ch =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

function html(group, sheet, rects) {
  const cells = sheet.cells.map(c => {
    const r = rects[c.name] ?? {};
    return `    <a class="cell" style="left:${c.x}px;top:${c.y}px;width:${c.w}px;height:${c.h}px"
       title="${esc(r.note ?? 'no reason recorded')}${r.pin ? '' : '  [UNPINNED]'}"
       ><span>${esc(c.name)}</span></a>`;
  }).join('\n');

  return `<!doctype html><meta charset="utf-8"><title>${esc(group)} — contact sheet</title>
<style>
  body { background:#14141c; color:#ddd; font:12px/1.3 ui-monospace,monospace; margin:16px }
  .sheet { position:relative; display:inline-block; image-rendering:pixelated }
  .sheet img { display:block; image-rendering:pixelated }
  .cell { position:absolute; box-sizing:border-box; border:1px solid #ffffff22; text-decoration:none; color:inherit }
  .cell:hover { border-color:#7fd1ff; background:#7fd1ff18 }
  .cell span { position:absolute; left:2px; bottom:2px; background:#000c; padding:1px 3px; border-radius:2px }
  h1 { font-size:14px; font-weight:600 }
  p { color:#999; max-width:70ch }
</style>
<h1>${esc(group)} — ${sheet.cells.length} sprites</h1>
<p>Each cell: 1&times; on its floor tile, 2&times;, then night-tinted (#0a0a2e @ 0.45).
   Hover a cell for the reason it was chosen. <b>[UNPINNED]</b> means the crop has never been
   verified against real pixels.</p>
<div class="sheet"><img src="${esc(group)}.png" alt="">
${cells}
</div>
`;
}

export function writeContactSheets(contract, adapter, outDir, pack = adapter.pack) {
  // Notes and pins live on the adapter's rects; the Adapter API deliberately
  // does not expose them (the bake has no business seeing why a crop won), so
  // the review artifact reads the authored file directly.
  const { rects } = JSON.parse(readFileSync(join(ROOT, 'sources', `${pack}.json`), 'utf8'));
  // The floor each group is actually seen against.
  const FLOOR = { district: 'grass', interior: 'floorCafe' };
  mkdirSync(outDir, { recursive: true });

  const written = [];
  for (const group of Object.keys(contract.props)) {
    const sheet = contactSheet(contract, adapter, group, { floorTile: FLOOR[group] ?? 'grass', columns: 8 });
    writeFileSync(join(outDir, `${group}.png`), encodePng(sheet.canvas));
    writeFileSync(join(outDir, `${group}.html`), html(group, sheet, rects));
    written.push(group);
  }
  return written;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const pack = process.argv[2] ?? 'fixture';
  const srcRoot = process.argv[3] ?? (pack === 'fixture' ? 'test/fixtures/pack-src' : 'assets-src');
  const out = join(ROOT, 'contact');
  const groups = writeContactSheets(loadContract(), loadAdapter(`sources/${pack}.json`, srcRoot), out, pack);
  console.log(`contact sheets: ${groups.join(', ')} -> contact/  (open contact/${groups[0]}.html)`);
}

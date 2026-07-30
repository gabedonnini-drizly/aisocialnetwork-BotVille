#!/usr/bin/env node
/**
 * Generates a synthetic art pack under test/fixtures/pack-src/.
 * Real PNGs, known geometry, zero licensed pixels — this is what makes
 * the world bake testable in CI and on a machine with no packs.
 * Deterministic: same input, byte-identical output.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCanvas, encodePng } from './png-lib.mjs';
import { loadContract } from './lib/assetContract.mjs';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..');
const OUT = join(ROOT, 'test', 'fixtures', 'pack-src');

/** FNV-1a — the same spread function the rest of the system uses. */
function hash(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}
const colorFor = name => {
  const h = hash(name);
  return [(h & 0xff) | 0x20, ((h >> 8) & 0xff) | 0x20, ((h >> 16) & 0xff) | 0x20, 255];
};

/** A block of `w`x`h` with a 1px transparent margin and a darker border. */
function block(name, w, h) {
  const cv = createCanvas(w, h);
  const [r, g, b] = colorFor(name);
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const edge = x === 1 || y === 1 || x === w - 2 || y === h - 2;
      cv.set(x, y, edge ? [r >> 1, g >> 1, b >> 1, 255] : [r, g, b, 255]);
    }
  return cv;
}

function write(rel, canvas) {
  const p = join(OUT, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, encodePng(canvas));
}

const c = loadContract();
const rects = {};
const files = {};

// One 16x16 tile per ground-atlas name, each in its own file.
for (const atlas of Object.values(c.groundAtlases)) {
  for (const t of atlas.tiles) {
    const alias = `t_${t}`;
    files[alias] = `tiles/${t}.png`;
    rects[t] = { file: alias, x: 0, y: 0, w: 16, h: 16 };
    write(`tiles/${t}.png`, block(t, 16, 16));
  }
}

// One whole-file PNG per prop, sized to its contract maxSize. The `note` is
// honest rather than decorative — it flows to the contact sheet's tooltip
// (Task 9a), which must render notes and has to have one to render.
for (const group of Object.values(c.props)) {
  for (const [name, def] of Object.entries(group)) {
    const [w, h] = def.maxSize;
    const alias = `p_${name}`;
    files[alias] = `props/${name}.png`;
    rects[name] = { file: alias, trim: true,
      note: 'generated fixture sprite — geometry is derived from the contract, not chosen' };
    write(`props/${name}.png`, block(name, w, h));
  }
}

// Animated objects: `frames` cells laid out in a horizontal strip.
for (const [name, def] of Object.entries(c.animatedObjects)) {
  const cv = createCanvas(def.frameWidth * def.frames, def.frameHeight);
  for (let f = 0; f < def.frames; f++) {
    const cell = block(`${name}:${f}`, def.frameWidth, def.frameHeight);
    cv.blit({ w: cell.w, h: cell.h, px: (x, y) => {
      const i = (y * cell.w + x) * 4;
      return [cell.data[i], cell.data[i + 1], cell.data[i + 2], cell.data[i + 3]];
    } }, 0, 0, def.frameWidth, def.frameHeight, f * def.frameWidth, 0);
  }
  const alias = `a_${name}`;
  files[alias] = `animated/${name}.png`;
  rects[name] = { file: alias };
  write(`animated/${name}.png`, cv);
}

// Emote sheet: 10 columns x 10 rows of 16x16, matching the real layout.
files.emotes = 'ui/emotes.png';
rects.emote_sheet = { file: 'emotes' };
write('ui/emotes.png', block('emotes', 160, 160));
files.ui = 'ui/ui.png';
rects.ui_sheet = { file: 'ui' };
write('ui/ui.png', block('ui', 160, 160));

// Character parts: separable 16x32 layers, 56 columns x 8 rows — the
// *subset* AVATAR_VARIANTS uses (rows 0-7). The real premade sheets are
// 896x656 (20.5 rows of 32px); the fixture generates only the rows the
// runtime reads.
for (const part of c.characters.parts) {
  const alias = `c_${part}`;
  files[alias] = `characters/${part}.png`;
  rects[`char_${part}`] = { file: alias };
  write(`characters/${part}.png`, block(`char_${part}`, 16 * 56, 32 * 8));
}

// Any other runtime sheet without bespoke geometry above — interim, Task 23
// rider B: the premade character and animal avatar sheets. Only existence
// (and a stable pin) matters for these in the fixture pack; a small generic
// block is enough.
for (const name of c.runtimeSheets) {
  if (rects[name]) continue;
  const alias = `rs_${name}`;
  files[alias] = `runtime/${name}.png`;
  rects[name] = { file: alias };
  write(`runtime/${name}.png`, block(name, 64, 64));
}

writeFileSync(join(ROOT, 'sources', 'fixture.json'), JSON.stringify({
  pack: 'fixture',
  capabilities: { characterLayers: true },
  emoteFrames: Object.fromEntries(
    c.emotes.icons.statuses.map((s, i) => [s, [40 + i * 2, 41 + i * 2]])),
  files,
  rects,
}, null, 2) + '\n');

// Coverage is the claim, not a count: the generated pack must resolve every
// name the contract requires. Assert it here so a contract addition that the
// generator forgot fails at generation, not three tasks later in the bake.
const unresolved = c.allNames().filter(n => !rects[n]);
if (unresolved.length) {
  console.error(`fixture pack is incomplete — no pixels for: ${unresolved.join(', ')}`);
  process.exit(1);
}

console.log(`fixture pack: ${Object.keys(rects).length} names (contract requires ${c.allNames().length}), ${Object.keys(files).length} files`);

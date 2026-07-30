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
import { EYE_VARIANTS, HAIR_MANIFEST, OUTFIT_MANIFEST } from '../packages/shared/src/appearance/derive.mjs';

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

/**
 * Like `block`, but confined to a horizontal slice (`[bandTop, bandBottom)`)
 * of every `frameHeight`-px animation row, transparent elsewhere. Real
 * separable character layers only paint PART of their 16x32 cell — body
 * legs, a 2px eye band, hair over the head, outfit over the torso (measured
 * bounding boxes, docs/ASSETS.md) — never the whole cell. `composeSheet`
 * stacks five such layers; a fixture layer that (like plain `block`) fills
 * its ENTIRE cell would hide every earlier layer regardless of which file
 * got picked, no matter how many per-variant siblings exist. Same
 * deterministic colour derivation as `block` (`colorFor`, keyed off the
 * caller's `name`), just confined to a band so multiple stacked layers stay
 * visible in one composed frame — not a different generation algorithm.
 */
function characterLayerBlock(name, w, h, frameHeight, [bandTop, bandBottom]) {
  const cv = createCanvas(w, h);
  const [r, g, b] = colorFor(name);
  for (let y = 0; y < h; y++) {
    const yInFrame = y % frameHeight;
    if (yInFrame < bandTop || yInFrame >= bandBottom) continue;
    const edge = yInFrame === bandTop || yInFrame === bandBottom - 1;
    for (let x = 0; x < w; x++) cv.set(x, y, edge ? [r >> 1, g >> 1, b >> 1, 255] : [r, g, b, 255]);
  }
  return cv;
}

/**
 * Bands within one 32px animation row, in z-order (composeSheet stacks
 * body -> eyes -> hair -> outfit -> accessory). Deliberately overlapping in
 * spots (hair over the top of body, outfit over the middle of body,
 * accessory over the top of hair) — that IS the point: it proves later
 * layers draw over earlier ones while still leaving every layer a surviving
 * band in the final composite, so a test that changes one part's file can
 * tell from the composed pixels alone.
 */
const CHARACTER_BANDS = {
  body: [8, 32],
  eyes: [18, 20],
  hair: [0, 16],
  outfit: [20, 28],
  accessory: [0, 6],
};

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
//
// (D-19, 2026-07-30, Task 27 dependency flag #2) Hair, outfit and eyes are
// TWO-STAGE (hair/outfit) or single-stage (eyes) VARIANT layers on the real
// pack: the adapter aliases one index-0 sibling file
// (`Hairstyle_01_01.png`, `Outfit_01_01.png`, `Eyes_01.png`) and
// appearanceComposer.mjs's `resolveVariantFile` substitutes the record's
// own style/variant into that same filename shape to pick a sibling. Task
// 8's original generator emitted one monolithic sheet per part — no
// siblings to resolve — so composer tests against the fixture pack had
// nothing to select between.
//
// The sibling set generated here is derived from HAIR_MANIFEST /
// OUTFIT_MANIFEST / EYE_VARIANTS — the SAME committed, generated data
// `appearanceRecord()` (derive.mjs) actually draws its style/variant ids
// from — deliberately NOT `sources/fixture.variants{,.outfit}.json`'s
// smaller synthetic 3-style scaffold (that manifest exists to exercise
// `buildVariantManifest`'s grouping logic on an uneven-per-style shape, an
// orthogonal concern; `gen-variant-manifest.mjs`'s FIXTURE_HAIR_FILES /
// FIXTURE_OUTFIT_FILES are unrelated to this generator). `derive.mjs`
// hardcodes the import to the SHIPPING (limezu) manifest regardless of
// which adapter a test composes against (I-7 wants one manifest swap to
// re-roll every appearance, not a manifest per test pack) — so a seed can
// hash to any of the shipping manifest's 200 hair / 132 outfit
// combinations even when composing against the fixture pack. The fixture
// must therefore have a sibling file for every one of those combinations,
// not just a hand-picked few, or `resolveVariantFile` resolves a path that
// does not exist. Same deterministic `block()` algorithm, one distinct
// colour per file (the colour key is the filename, so every sibling is
// visually distinguishable); `char_<part>` aliases the INDEX-0 file
// (`variantFiles[0]`, sorted styles-then-variants — `01_01`), exactly as
// the real pack does.
function siblingFilenames(prefix, manifest) {
  const names = [];
  for (const style of manifest.styles) {
    for (const variant of manifest.variantsByStyle[style]) names.push(`${prefix}_${style}_${variant}.png`);
  }
  return names;
}
const VARIANT_LAYER_FILES = {
  hair: siblingFilenames('Hairstyle', HAIR_MANIFEST),
  outfit: siblingFilenames('Outfit', OUTFIT_MANIFEST),
  eyes: EYE_VARIANTS.map(v => `Eyes_${v}.png`),
};
for (const part of c.characters.parts) {
  const band = CHARACTER_BANDS[part] ?? [0, 32];
  const variantFiles = VARIANT_LAYER_FILES[part];
  if (variantFiles) {
    for (const filename of variantFiles) {
      const alias = `c_${part}_${filename}`;
      files[alias] = `characters/${filename}`;
      write(`characters/${filename}`, characterLayerBlock(`char_${part}:${filename}`, 16 * 56, 32 * 8, 32, band));
    }
    rects[`char_${part}`] = { file: `c_${part}_${variantFiles[0]}` };
    continue;
  }
  const alias = `c_${part}`;
  files[alias] = `characters/${part}.png`;
  rects[`char_${part}`] = { file: alias };
  write(`characters/${part}.png`, characterLayerBlock(`char_${part}`, 16 * 56, 32 * 8, 32, band));
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

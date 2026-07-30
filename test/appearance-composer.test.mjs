import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadContract } from '../scripts/lib/assetContract.mjs';
import { loadAdapter } from '../scripts/lib/sourceAdapter.mjs';
import { appearanceRecord } from '../packages/shared/src/appearance/derive.mjs';
import { composeSheet, composePortrait, remapPalette, hexToRgba } from '../scripts/lib/appearanceComposer.mjs';
import { createCanvas, encodePng } from '../scripts/png-lib.mjs';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const c = loadContract();
const a = loadAdapter('sources/fixture.json', 'test/fixtures/pack-src');
const rec = seed => appearanceRecord(seed, 'female');

test('a composed sheet has the contract frame geometry', () => {
  const cv = composeSheet(c, a, rec('aisha_khan'));
  assert.equal(cv.w % c.characters.frameWidth, 0);
  assert.equal(cv.h % c.characters.frameHeight, 0);
  assert.ok(cv.w >= c.characters.frameWidth * 6 * 4, 'at least four directions of six frames');
});

test('composition is deterministic', () => {
  assert.deepEqual([...composeSheet(c, a, rec('x')).data], [...composeSheet(c, a, rec('x')).data]);
});

test('two different seeds compose to different pixels', () => {
  assert.notDeepEqual([...composeSheet(c, a, rec('alpha')).data], [...composeSheet(c, a, rec('beta')).data]);
});

test('the portrait is 32x32', () => {
  const p = composePortrait(c, a, rec('aisha_khan'));
  assert.equal(p.w, 32);
  assert.equal(p.h, 32);
});

test('the portrait shares the record, so it cannot contradict the sprite', () => {
  const r = rec('aisha_khan');
  assert.deepEqual([...composePortrait(c, a, r).data], [...composePortrait(c, a, r).data]);
  assert.notDeepEqual([...composePortrait(c, a, r).data], [...composePortrait(c, a, rec('other')).data]);
});

test('hexToRgba parses a six-digit hex', () => {
  assert.deepEqual(hexToRgba('#c0392b'), [192, 57, 43, 255]);
});

test('remapPalette swaps declared colours and leaves the rest alone', () => {
  const cv = createCanvas(3, 1);
  cv.set(0, 0, [192, 57, 43, 255]);
  cv.set(1, 0, [1, 2, 3, 255]);
  const out = remapPalette(cv, [[192, 57, 43, 255]], [[9, 9, 9, 255]]);
  assert.deepEqual([out.data[0], out.data[1], out.data[2]], [9, 9, 9]);
  assert.deepEqual([out.data[4], out.data[5], out.data[6]], [1, 2, 3]);
});

test('remapPalette never touches transparent pixels', () => {
  const cv = createCanvas(1, 1);   // all zeroes = transparent
  const out = remapPalette(cv, [[0, 0, 0, 0]], [[255, 0, 0, 255]]);
  assert.equal(out.data[3], 0);
});

test('a 927px-wide body sheet is cropped onto the 896px shared canvas (the real-pack shape)', () => {
  // Real pack: Bodies ship 927x656 while Eyes/Hairstyles/Outfits ship
  // 896x656 — and 896 IS a whole number of 16px frames (56) where 927 is
  // not. The adapter's rect crops char_body to 896 wide (Plan 1 Task 7);
  // the composer must land every layer on that shared canvas, sized to
  // whole frames, never to a raw sheet.
  const dir = mkdtempSync(join(tmpdir(), 'body927-'));
  // readSprite throws on a fully transparent crop rather than emitting an
  // empty PNG (test/sprite-reader.test.mjs) — a real sheet is never
  // literally blank, so each canvas needs at least one opaque pixel to
  // stand in for one. Geometry, not pixel content, is what this test
  // checks; the single pixel exists only to satisfy that guard.
  const bodyCanvas = createCanvas(927, 656);
  bodyCanvas.set(1, 1, [1, 2, 3, 255]);
  const layerCanvas = createCanvas(896, 656);
  layerCanvas.set(1, 1, [4, 5, 6, 255]);
  writeFileSync(join(dir, 'body.png'), encodePng(bodyCanvas));
  writeFileSync(join(dir, 'layer.png'), encodePng(layerCanvas));
  const src = {
    pack: 'wide-fixture',
    capabilities: { characterLayers: true },
    files: { body: 'body.png', layer: 'layer.png' },
    rects: Object.fromEntries(c.characters.parts.map(p => [`char_${p}`,
      p === 'body' ? { file: 'body', x: 0, y: 0, w: 896, h: 656 } : { file: 'layer' }])),
  };
  writeFileSync(join(dir, 'wide.json'), JSON.stringify(src));
  const wide = loadAdapter(join(dir, 'wide.json'), dir);
  const cv = composeSheet(c, wide, rec('aisha_khan'));
  const fw = c.characters.frameWidth, fh = c.characters.frameHeight;
  assert.equal(cv.w, Math.floor(896 / fw) * fw, 'the shared canvas is exactly 56 whole frames wide');
  assert.equal(cv.w, 896);
  assert.equal(cv.h, Math.floor(656 / fh) * fh, '656px is 20.5 rows — the canvas floors to whole frames');
});

// ── D-19 variant-sheet resolution (dependency flag #2) ──────────────────
// The fixture pack (extended in gen-fixture-pack.mjs, Task 27) ships real
// per-variant hair/outfit/eyes sheets covering every style+variant the
// SHIPPING (limezu) manifest can produce — the one derive.mjs actually
// draws from regardless of which pack a test composes against — one
// distinct colour per file. These tests isolate the variant AXIS: holding
// every other record field fixed and changing only hairVariant/outfit
// proves resolveVariantFile is actually selecting a different sibling
// sheet, not just riding on some other field's incidental difference.
test('changing only hairVariant selects a different hair sheet', () => {
  const base = rec('aisha_khan');
  const other = { ...base, hairVariant: base.hairVariant === '01' ? '02' : '01' };
  assert.notDeepEqual([...composeSheet(c, a, base).data], [...composeSheet(c, a, other).data]);
});

test('changing only outfitVariant selects a different outfit sheet', () => {
  const base = rec('aisha_khan');
  const other = { ...base, outfitVariant: base.outfitVariant === '01' ? '02' : '01' };
  assert.notDeepEqual([...composeSheet(c, a, base).data], [...composeSheet(c, a, other).data]);
});

test('changing only eyes selects a different eyes sheet', () => {
  const base = rec('aisha_khan');
  const other = { ...base, eyes: base.eyes === '01' ? '02' : '01' };
  assert.notDeepEqual([...composeSheet(c, a, base).data], [...composeSheet(c, a, other).data]);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadAdapter } from '../scripts/lib/sourceAdapter.mjs';
import { readSprite, asSource, pinFor } from '../scripts/lib/spriteReader.mjs';
import { createCanvas } from '../scripts/png-lib.mjs';

const a = () => loadAdapter('sources/fixture.json', 'test/fixtures/pack-src');

test('a whole-file read returns the file size', () => {
  const s = readSprite(a(), 'grass');
  assert.equal(s.w, 16);
  assert.equal(s.h, 16);
});

test('trim removes the transparent margin the fixture builds in', () => {
  // fixture props are drawn inset by 1px on every side of maxSize
  const s = readSprite(a(), 'bookshelf_a');   // maxSize [48, 64]
  assert.equal(s.w, 46);
  assert.equal(s.h, 62);
});

test('the trimmed canvas has an opaque top-left pixel', () => {
  const s = readSprite(a(), 'bookshelf_a');
  const i = 0;
  assert.equal(s.canvas.data[i + 3], 255, 'trim left a transparent edge');
});

test('reading is a pure function of the pack: two reads are byte-identical', () => {
  const x = readSprite(a(), 'counter_wide');
  const y = readSprite(a(), 'counter_wide');
  assert.deepEqual([...x.canvas.data], [...y.canvas.data]);
});

test('a fully transparent region throws rather than emitting an empty PNG', () => {
  const empty = createCanvas(8, 8);
  assert.throws(() => readSprite({
    resolve: () => ({ name: 'blank', absPath: null, x: 0, y: 0, w: 8, h: 8, trim: true, generated: null }),
    _override: asSource(empty),
  }, 'blank'), /empty crop: blank/);
});

test('asSource round-trips a canvas into a readable source', () => {
  const cv = createCanvas(2, 1);
  cv.set(1, 0, [1, 2, 3, 255]);
  assert.deepEqual(asSource(cv).px(1, 0), [1, 2, 3, 255]);
});

test('pinFor is a pure function of the pixels — same crop, same pin; different crop, different pin', () => {
  assert.equal(pinFor(a(), 'counter_wide'), pinFor(a(), 'counter_wide'));
  assert.notEqual(pinFor(a(), 'counter_wide'), pinFor(a(), 'stool'));
});

test('npm run fixture leaves the fixture pack fully pinned', () => {
  // The fixture's pixels are generated, so there is no excuse for an
  // unpinned crop — and the pins are deterministic, so the committed
  // manifest stays byte-stable across runs (the clean-tree guard holds).
  const src = JSON.parse(readFileSync('sources/fixture.json', 'utf8'));
  const unpinned = Object.entries(src.rects).filter(([, r]) => !r.pin).map(([n]) => n);
  assert.deepEqual(unpinned, []);
});

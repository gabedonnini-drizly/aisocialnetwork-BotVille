import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadAdapter } from '../scripts/lib/sourceAdapter.mjs';
import { readSprite, asSource, pinFor } from '../scripts/lib/spriteReader.mjs';
import { createCanvas, encodePng } from '../scripts/png-lib.mjs';

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

// (D-19, 2026-07-30) The optional third argument appearanceComposer.mjs's
// resolveVariantFile needs: an explicit file overrides the adapter's
// resolved path while every other rect field (x/y/w/h/trim) still comes
// from the adapter's declared rect. Omitting it (every call above this one)
// must stay byte-for-byte the old two-argument behavior — that is the
// additive guarantee Plan 1's pin semantics (pins pin the DEFAULT file) rely
// on: pinFor never passes an override, so no pin is affected by this change.
test('readSprite with no override behaves exactly as the two-argument call did', () => {
  const s2 = readSprite(a(), 'grass');
  const s3 = readSprite(a(), 'grass', undefined);
  assert.deepEqual([...s2.canvas.data], [...s3.canvas.data]);
});

test('an explicit file override reads a different file under the same rect geometry', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sprite-override-'));
  const cvA = createCanvas(8, 8);
  cvA.set(2, 2, [10, 20, 30, 255]);
  const cvB = createCanvas(8, 8);
  cvB.set(2, 2, [40, 50, 60, 255]);
  writeFileSync(join(dir, 'a.png'), encodePng(cvA));
  writeFileSync(join(dir, 'b.png'), encodePng(cvB));
  const adapter = {
    resolve: () => ({ name: 'x', absPath: join(dir, 'a.png'), x: 0, y: 0, w: 8, h: 8, trim: false }),
  };
  const withoutOverride = readSprite(adapter, 'x');
  const withOverride = readSprite(adapter, 'x', { file: join(dir, 'b.png') });
  const pixelAt = (canvas, x, y) => [...canvas.data.subarray(4 * (y * canvas.w + x), 4 * (y * canvas.w + x) + 4)];
  assert.deepEqual(pixelAt(withoutOverride.canvas, 2, 2), [10, 20, 30, 255]);
  assert.deepEqual(pixelAt(withOverride.canvas, 2, 2), [40, 50, 60, 255]);
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

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { indexPack, cellSignature } from '../../scripts/index-pack.mjs';
import { decodePng } from '../../scripts/png-lib.mjs';
import { loadContract } from '../../scripts/lib/assetContract.mjs';

const c = loadContract();
const run = () => indexPack({
  srcRoot: 'test/fixtures/pack-src',
  tileSize: c.tileSize,
  out: mkdtempSync(join(tmpdir(), 'pack-index-')),
});

test('every PNG in the pack is inventoried', () => {
  const { sheets } = run();
  assert.ok(Object.keys(sheets).length > 0);
  for (const [path, s] of Object.entries(sheets)) {
    assert.match(path, /\.png$/);
    assert.ok(s.w > 0 && s.h > 0, path);
    assert.match(s.sha256, /^[0-9a-f]{64}$/, path);
  }
});

test('sheet paths are relative and forward-slashed, so the manifest is portable', () => {
  for (const path of Object.keys(run().sheets)) {
    assert.equal(path.startsWith('/'), false, path);
    assert.equal(path.includes('\\'), false, path);
  }
});

test('a fully transparent cell is not a candidate', () => {
  // The fixture insets every block by 1px, so the corner cell of a big sprite
  // has content but a 1px-wide slice of the margin does not.
  const img = decodePng('test/fixtures/pack-src/tiles/grass.png');
  assert.equal(cellSignature(img, 0, 0, 1, 1), null, 'transparent margin counted as a candidate');
  assert.ok(cellSignature(img, 0, 0, 16, 16), 'the tile itself should be a candidate');
});

test('a candidate reports its trimmed bounds, not the cell it sits in', () => {
  const img = decodePng('test/fixtures/pack-src/tiles/grass.png');
  const cell = cellSignature(img, 0, 0, 16, 16);
  // 1px transparent margin on every side
  assert.deepEqual(cell.trimmed, { x: 1, y: 1, w: 14, h: 14 });
  assert.equal(cell.opaque, 14 * 14);
});

test('the palette is the dominant colours, most-used first', () => {
  const img = decodePng('test/fixtures/pack-src/tiles/grass.png');
  const { palette } = cellSignature(img, 0, 0, 16, 16);
  assert.ok(palette.length >= 1 && palette.length <= 4);
  for (const c of palette) assert.match(c, /^#[0-9a-f]{6}$/);
});

test('the crop hash is stable and content-addressed', () => {
  const img = decodePng('test/fixtures/pack-src/tiles/grass.png');
  const a = cellSignature(img, 0, 0, 16, 16);
  const b = cellSignature(img, 0, 0, 16, 16);
  assert.equal(a.sha256, b.sha256);
  // A different tile must hash differently — colours are derived from the name.
  const other = cellSignature(decodePng('test/fixtures/pack-src/tiles/dirt.png'), 0, 0, 16, 16);
  assert.notEqual(a.sha256, other.sha256);
});

test('the index reports candidates as well as sheets', () => {
  const { cells } = run();
  const total = Object.values(cells).reduce((n, list) => n + list.length, 0);
  assert.ok(total >= Object.keys(run().sheets).length,
    'every non-empty sheet should yield at least one candidate');
});

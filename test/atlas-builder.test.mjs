import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadContract } from '../scripts/lib/assetContract.mjs';
import { loadAdapter } from '../scripts/lib/sourceAdapter.mjs';
import { buildAtlas } from '../scripts/lib/atlasBuilder.mjs';

const c = loadContract();
const a = () => loadAdapter('sources/fixture.json', 'test/fixtures/pack-src');

test('the district atlas is 8 columns x 3 rows for 23 tiles', () => {
  const at = buildAtlas(c, a(), 'district_ground');
  assert.equal(at.tileCount, 23);
  assert.equal(at.columns, 8);
  assert.equal(at.rows, 3);
  assert.equal(at.canvas.w, 128);
  assert.equal(at.canvas.h, 48);
});

test('the interiors atlas is 8 columns x 2 rows for 13 tiles', () => {
  const at = buildAtlas(c, a(), 'interiors_ground');
  assert.equal(at.canvas.w, 128);
  assert.equal(at.canvas.h, 32);
});

test('gid is index+1 in contract order', () => {
  const at = buildAtlas(c, a(), 'district_ground');
  assert.equal(at.gid.grass, 1);
  assert.equal(at.gid.grassA, 2);
  assert.equal(at.gid.dirtA, 23);
});

test('each tile lands at its row-major slot', () => {
  const at = buildAtlas(c, a(), 'district_ground');
  // tile index 8 -> column 0, row 1 -> pixel (0, 16)
  const i = (16 * at.canvas.w + 0) * 4;
  assert.equal(at.canvas.data[i + 3], 0, 'slot corner is the fixture 1px transparent margin');
  const j = ((16 + 1) * at.canvas.w + 1) * 4;
  assert.equal(at.canvas.data[j + 3], 255, 'slot interior is opaque');
});

test('the atlas is deterministic', () => {
  assert.deepEqual([...buildAtlas(c, a(), 'district_ground').canvas.data],
                   [...buildAtlas(c, a(), 'district_ground').canvas.data]);
});

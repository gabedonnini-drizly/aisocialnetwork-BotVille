import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadContract } from '../scripts/lib/assetContract.mjs';

const src = JSON.parse(readFileSync('sources/limezu.json', 'utf8'));

test('the adapter declares its pack and capabilities', () => {
  assert.equal(src.pack, 'limezu');
  assert.equal(typeof src.capabilities.characterLayers, 'boolean');
});

test('every ground tile in the contract has a rect', () => {
  const c = loadContract();
  const missing = [];
  for (const atlas of Object.values(c.groundAtlases))
    for (const t of atlas.tiles) if (!src.rects[t]) missing.push(t);
  assert.deepEqual(missing, []);
});

test('ground rects are 16x16 and carry a file alias', () => {
  const c = loadContract();
  for (const atlas of Object.values(c.groundAtlases)) {
    for (const t of atlas.tiles) {
      const r = src.rects[t];
      assert.equal(r.w, 16, `${t} width`);
      assert.equal(r.h, 16, `${t} height`);
      assert.ok(src.files[r.file], `${t} names an unknown file alias ${r.file}`);
    }
  }
});

test('grass matches build-district.mjs ATLAS_TILES (TERR tile 1,12)', () => {
  assert.deepEqual(src.rects.grass, { file: 'terrains', x: 16, y: 192, w: 16, h: 16 });
});

test('border matches build-interiors.mjs ATLAS_TILES (RB tile 1,44)', () => {
  assert.deepEqual(src.rects.border, { file: 'room_builder', x: 16, y: 704, w: 16, h: 16 });
});

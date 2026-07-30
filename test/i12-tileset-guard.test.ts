import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasGroundArt } from '../packages/client/src/game/tilesetGuard.ts';

// I-12: a fresh clone has no licensed art (gitignored pack dirs are empty), so
// Tiled tileset images 404 and Phaser's Tilemap#addTilesetImage returns null.
// hasGroundArt is the pure guard both DistrictScene and VenueScene use to skip
// Tilemap#createLayer(name, null, ...) instead of crashing on it.

test('null/undefined (the art-free, 404 case) fails the guard', () => {
  assert.equal(hasGroundArt(null), false);
  assert.equal(hasGroundArt(undefined), false);
});

test('a real tileset object passes the guard', () => {
  assert.equal(hasGroundArt({ name: 'district_ground' }), true);
});

test('falsy-but-present values still count as "has" (only null/undefined mean missing)', () => {
  assert.equal(hasGroundArt(0), true);
  assert.equal(hasGroundArt(''), true);
  assert.equal(hasGroundArt(false), true);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadContract } from '../scripts/lib/assetContract.mjs';
import { loadAdapter } from '../scripts/lib/sourceAdapter.mjs';
import { buildAtlas } from '../scripts/lib/atlasBuilder.mjs';
import { cityGrid } from '../scripts/lib/districtGround.mjs';

const c = loadContract();
const { gid } = buildAtlas(c, loadAdapter('sources/fixture.json', 'test/fixtures/pack-src'), 'district_ground');
const v = JSON.parse(readFileSync('venues/district/venue.json', 'utf8'));
const run = () => cityGrid(v.generator.params, v.generator.seed, gid, v.sizeTiles);

test('both layers are 48x46', () => {
  const { ground, roads } = run();
  assert.equal(ground.length, 48 * 46);
  assert.equal(roads.length, 48 * 46);
});

test('road tiles are empty in ground and asphalt in roads', () => {
  const { ground, roads } = run();
  const i = 22 * 48 + 23;         // on both the vertical and horizontal road
  assert.equal(ground[i], 0);
  assert.ok([gid.asphA, gid.asphB, gid.asphC, gid.asphD].includes(roads[i]));
});

test('the farm pen is dirt', () => {
  const { ground } = run();
  const i = 10 * 48 + 40;
  assert.ok([gid.dirt, gid.dirtA].includes(ground[i]));
});

test('open land is the base grass tile, never a variant', () => {
  const { ground } = run();
  assert.equal(ground[5 * 48 + 5], gid.grass);
});

test('the centre line skips the junction and the crossings', () => {
  const { roads } = run();
  assert.equal(roads[22 * 48 + 2], gid.dashH);
  assert.notEqual(roads[22 * 48 + 22], gid.dashH, 'no dash inside the junction');
});

test('zebra crossings sit on the sidewalk lines', () => {
  const { roads } = run();
  assert.ok([gid.zebHa1, gid.zebHb1].includes(roads[19 * 48 + 22]));
  assert.ok([gid.zebVa1, gid.zebVb1, gid.zebVa2, gid.zebVb2].includes(roads[21 * 48 + 20]));
});

test('the same seed reproduces the same layers byte for byte', () => {
  const x = run(), y = run();
  assert.deepEqual(x.ground, y.ground);
  assert.deepEqual(x.roads, y.roads);
});

test('a different seed produces different pavement', () => {
  const other = cityGrid(v.generator.params, 1, gid, v.sizeTiles);
  assert.notDeepEqual(other.ground, run().ground);
});

test('the PRNG is handed back mid-stream for the caller to continue', () => {
  const { rnd } = run();
  const a = rnd(), b = rnd();
  assert.ok(a >= 0 && a < 1 && b >= 0 && b < 1);
  assert.notEqual(a, b);
});

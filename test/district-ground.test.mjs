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

// The stride is the DESCRIPTOR's width, not a literal. D-88 grew the district
// from 48x46 to 92x92 and will grow it again — a test that hardcodes the
// stride is testing the size, when what it means to test is the layout at
// coordinates the layout is defined by (the road, the pen, the crossings).
const [W, H] = v.sizeTiles;
const at = (x, y) => y * W + x;

test('both layers cover the descriptor\'s whole grid', () => {
  const { ground, roads } = run();
  assert.equal(ground.length, W * H);
  assert.equal(roads.length, W * H);
});

test('road tiles are empty in ground and asphalt in roads', () => {
  const { ground, roads } = run();
  const i = at(23, 22);           // on both the vertical and horizontal road
  assert.equal(ground[i], 0);
  assert.ok([gid.asphA, gid.asphB, gid.asphC, gid.asphD].includes(roads[i]));
});

test('the farm pen is dirt', () => {
  const { ground } = run();
  const i = at(40, 10);
  assert.ok([gid.dirt, gid.dirtA].includes(ground[i]));
});

test('open land is the base grass tile, never a variant', () => {
  const { ground } = run();
  assert.equal(ground[at(5, 5)], gid.grass);
});

test('the centre line skips the junction and the crossings', () => {
  const { roads } = run();
  assert.equal(roads[at(2, 22)], gid.dashH);
  assert.notEqual(roads[at(22, 22)], gid.dashH, 'no dash inside the junction');
});

test('zebra crossings sit on the sidewalk lines', () => {
  const { roads } = run();
  assert.ok([gid.zebHa1, gid.zebHb1].includes(roads[at(22, 19)]));
  assert.ok([gid.zebVa1, gid.zebVb1, gid.zebVa2, gid.zebVb2].includes(roads[at(20, 21)]));
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

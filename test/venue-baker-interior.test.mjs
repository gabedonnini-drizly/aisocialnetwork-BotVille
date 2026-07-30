import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadContract } from '../scripts/lib/assetContract.mjs';
import { loadAdapter } from '../scripts/lib/sourceAdapter.mjs';
import { buildAtlas } from '../scripts/lib/atlasBuilder.mjs';
import { bakeProps } from '../scripts/lib/propBaker.mjs';
import { bakeInterior } from '../scripts/lib/venueBaker.mjs';

const c = loadContract();
const a = loadAdapter('sources/fixture.json', 'test/fixtures/pack-src');
const atlas = buildAtlas(c, a, 'interiors_ground');
const propSizes = bakeProps(c, a, 'interior');
const cafe = JSON.parse(readFileSync('venues/cafe/venue.json', 'utf8'));
const tmj = () => bakeInterior(c, cafe, { atlas, propSizes });

test('the map is 20x15 with 16px tiles', () => {
  const m = tmj();
  assert.equal(m.width, 20);
  assert.equal(m.height, 15);
  assert.equal(m.tilewidth, 16);
});

test('layer names are exactly what InteriorScene reads', () => {
  assert.deepEqual(tmj().layers.map(l => l.name),
    ['ground', 'furniture', 'seats', 'animated', 'doors', 'spawns', 'collision']);
});

test('the ground layer paints walls, floor and a border', () => {
  const g = tmj().layers[0].data;
  assert.equal(g.length, 300);
  assert.equal(g[0], atlas.gid.wallCafeA, 'row 0 is wallA');
  assert.equal(g[20], atlas.gid.wallCafeB, 'row 1 is wallB');
  assert.equal(g[2 * 20 + 0], atlas.gid.border, 'left column is border');
  assert.equal(g[5 * 20 + 10], atlas.gid.floorCafe, 'interior is floor');
});

test('the doorway is floor, not border', () => {
  const g = tmj().layers[0].data;
  assert.equal(g[14 * 20 + 9], atlas.gid.floorCafe);
  assert.equal(g[14 * 20 + 10], atlas.gid.floorCafe);
});

test('furniture objects carry sizes read from the baked bitmaps', () => {
  const f = tmj().layers[1].objects.find(o => o.name === 'counter_wide');
  const real = propSizes.get('counter_wide');
  assert.equal(f.width, real.w);
  assert.equal(f.height, real.h);
});

test('a doormat is added at the doorway even though the descriptor omits it', () => {
  const mats = tmj().layers[1].objects.filter(o => o.name === 'doormat');
  assert.equal(mats.length, 1);
  assert.ok(mats[0].properties.some(p => p.name === 'doormat' && p.value === true));
});

test('seats become point objects with side and kind', () => {
  const seats = tmj().layers[2].objects;
  assert.equal(seats.length, 9);
  assert.equal(seats[0].point, true);
  assert.deepEqual(seats[0].properties.map(p => p.name).sort(), ['kind', 'side']);
});

test('collision is derived: walls, borders, doorway gap and colliding furniture', () => {
  const col = tmj().layers[6].objects;
  // five structural rects + one per colliding furniture item
  const colliding = cafe.furniture.filter(f => f.collide !== false).length;
  assert.equal(col.length, 5 + colliding);
});

test('non-colliding furniture contributes no collision box', () => {
  const m = tmj();
  const stoolCount = cafe.furniture.filter(f => f.name === 'stool').length;
  assert.equal(stoolCount, 3);
  assert.equal(m.layers[6].objects.length, 5 + cafe.furniture.filter(f => f.collide !== false).length);
});

test('the exit door targets the district venue', () => {
  const door = tmj().layers[4].objects[0];
  assert.equal(door.name, 'exit');
  assert.ok(door.properties.some(p => p.name === 'targetVenue' && p.value === 'district'));
});

test('baking is deterministic', () => {
  assert.equal(JSON.stringify(tmj()), JSON.stringify(tmj()));
});

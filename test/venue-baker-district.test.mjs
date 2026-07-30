import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadContract } from '../scripts/lib/assetContract.mjs';
import { loadAdapter } from '../scripts/lib/sourceAdapter.mjs';
import { buildAtlas } from '../scripts/lib/atlasBuilder.mjs';
import { bakeProps } from '../scripts/lib/propBaker.mjs';
import { bakeDistrict } from '../scripts/lib/venueBaker.mjs';

const c = loadContract();
const a = loadAdapter('sources/fixture.json', 'test/fixtures/pack-src');
const atlas = buildAtlas(c, a, 'district_ground');
const propSizes = bakeProps(c, a, 'district');
const v = JSON.parse(readFileSync('venues/district/venue.json', 'utf8'));
const tmj = () => bakeDistrict(c, v, { atlas, propSizes });

test('layer names are exactly what DistrictScene reads', () => {
  assert.deepEqual(tmj().layers.map(l => l.name),
    ['ground', 'roads', 'props-below', 'buildings', 'props-above', 'doors', 'spawns', 'collision', 'glows', 'night']);
});

test('the five buildings land on the buildings layer with a label', () => {
  const b = tmj().layers.find(l => l.name === 'buildings').objects;
  assert.equal(b.length, 5);
  assert.ok(b.every(o => o.properties.some(p => p.name === 'label')));
});

test('the four enterable buildings carry targetVenue', () => {
  const b = tmj().layers.find(l => l.name === 'buildings').objects;
  const targets = b.flatMap(o => o.properties.filter(p => p.name === 'targetVenue').map(p => p.value));
  assert.deepEqual(targets.sort(), ['cafe', 'dorm', 'library', 'office']);
});

test('building sizes come from the baked bitmaps', () => {
  const office = tmj().layers.find(l => l.name === 'buildings').objects.find(o => o.name === 'office_building');
  assert.equal(office.width, propSizes.get('office_building').w);
});

test('the fence rings the pen with a gate gap in the bottom run', () => {
  const above = tmj().layers.find(l => l.name === 'props-above').objects;
  const fences = above.filter(o => o.name.startsWith('fence_'));

  // Derived from the descriptor, not counted by hand: the expectation has to
  // stay true when the pen or the gate moves.
  const [PX0, PY0, PX1, PY1] = v.generator.params.pen;
  const [G0, G1] = v.generator.params.gate;
  const spanX = PX1 - PX0 - 1;                 // interior columns, corners excluded
  const spanY = PY1 - PY0 - 1;                 // interior rows
  const gateCols = Math.min(G1, PX1 - 1) - Math.max(G0, PX0 + 1) + 1;
  const expected = spanX                        // top run
                 + (spanX - gateCols)           // bottom run, gate removed
                 + spanY * 2                    // left and right runs
                 + 4;                           // corners
  assert.equal(fences.length, expected);

  for (const corner of ['top_left', 'top_right', 'bottom_left', 'bottom_right'])
    assert.equal(fences.filter(o => o.name === `fence_${corner}`).length, 1, corner);
});

test('the gate gap is where the descriptor says it is', () => {
  const above = tmj().layers.find(l => l.name === 'props-above').objects;
  const [, , , PY1] = v.generator.params.pen;
  const [G0, G1] = v.generator.params.gate;
  const bottomXs = new Set(above
    .filter(o => o.name === 'fence_bottom_middle' && o.y === PY1 * 16)
    .map(o => o.x / 16));
  for (let x = G0; x <= G1; x++) assert.equal(bottomXs.has(x), false, `gate column ${x} is fenced`);
  assert.equal(bottomXs.has(G0 - 1), true, 'the run does not resume left of the gate');
});

test('crop rows alternate on props-below, one soil strip per row', () => {
  const below = tmj().layers.find(l => l.name === 'props-below').objects;
  const { rows, alternate } = v.scatter.crops;
  const PER_ROW = 3;                                  // left / mid / right

  assert.equal(below.filter(o => o.name.startsWith('soil_')).length, rows * PER_ROW);
  alternate.forEach((crop, i) => {
    const rowsOfThisCrop = Math.floor((rows - i + alternate.length - 1) / alternate.length);
    assert.equal(below.filter(o => o.name === crop).length, rowsOfThisCrop * PER_ROW, crop);
  });
});

test('street lamps are typed so the client can hang a night glow', () => {
  const lamps = tmj().layers.find(l => l.name === 'props-above').objects.filter(o => o.name === 'street_lamp');
  assert.equal(lamps.length, v.furniture.filter(f => f.name === 'street_lamp').length);
  assert.ok(lamps.length > 0, 'the district descriptor places no street lamps');
  assert.ok(lamps.every(o => o.type === 'lamp'));
});

test('glow points carry their kind as the object type', () => {
  const glows = tmj().layers.find(l => l.name === 'glows').objects;
  assert.equal(glows.length, v.glows.length);
  assert.ok(glows.every(o => o.point === true && o.type === o.name));
});

test('the night layer keeps every animal sleep point the descriptor declares', () => {
  assert.equal(tmj().layers.find(l => l.name === 'night').objects.length, v.night.length);
});

test('baking is deterministic', () => {
  assert.equal(JSON.stringify(tmj()), JSON.stringify(tmj()));
});

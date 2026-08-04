import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadContract } from '../scripts/lib/assetContract.mjs';

const v = JSON.parse(readFileSync('venues/district/venue.json', 'utf8'));
const c = loadContract();

test('the district is an outdoor venue whose size is bake data (D-88)', () => {
  assert.equal(v.id, 'district');
  assert.equal(v.indoor, false);
  // Size is CONFIG (D-88: the district grows; growth controls are
  // config-driven), so this asserts the descriptor agrees with the config
  // rather than pinning a number that a ruled growth would falsify.
  const growth = JSON.parse(readFileSync('town/growth.json', 'utf8'));
  assert.deepEqual(v.sizeTiles, growth.districtSizeTiles);
  assert.equal(v.groundAtlas, 'district_ground');
});

test('the ground is generated, not authored, and pins the PRNG seed', () => {
  assert.equal(v.generator.name, 'cityGrid');
  assert.equal(v.generator.seed, 20260703);
  assert.equal(v.ground, undefined, 'outdoor venues use generator, not ground');
});

test('the generator params match build-district.mjs road and pen geometry', () => {
  const p = v.generator.params;
  assert.deepEqual(p.vRoad, [22, 24]);
  assert.deepEqual(p.hRoad, [21, 23]);
  assert.deepEqual(p.vSidewalks, [[20, 21], [25, 26]]);
  assert.deepEqual(p.hSidewalks, [[19, 20], [24, 25]]);
  assert.deepEqual(p.pen, [36, 2, 47, 18]);
  assert.deepEqual(p.gate, [40, 42]);
});

test('every furniture name is a district prop in the contract', () => {
  const props = new Set(Object.keys(c.props.district));
  for (const f of v.furniture) assert.ok(props.has(f.name), f.name);
});

test('the four building doors target the four interior venues', () => {
  assert.deepEqual(v.doors.map(d => d.targetVenue).sort(), ['cafe', 'dorm', 'library', 'office']);
});

test('glows declare a kind the client knows (GLOW_KINDS)', () => {
  const kinds = new Set(['lamp', 'window', 'sign', 'headlight']);
  for (const g of v.glows) assert.ok(kinds.has(g.kind), g.kind);
  assert.ok(v.glows.length >= 12, 'at least the twelve street lamps');
});

test('capacity is generous — the district is the outdoor overflow', () => {
  assert.ok(v.capacity >= 64);
});

test('the district affords idle at every hour — the total fallback (addendum I.1)', () => {
  // Plan 5's deriveVenuesAffording falls back to venues affording 'idle';
  // the district always affording it, always open, is what makes that
  // fallback total and the F-7 ReferenceError class unrepresentable.
  assert.ok(v.affords.includes('idle'));
  assert.deepEqual(v.hours, [{ open: 0, close: 24 }]);
});

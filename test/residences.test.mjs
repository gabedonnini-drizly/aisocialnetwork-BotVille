import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadContract } from '../scripts/lib/assetContract.mjs';
import {
  RESIDENCE_OCCUPANCY_TARGET_AGENTS,
  deriveResidenceCount,
  deriveResidenceInstances,
} from '../scripts/lib/residences.mjs';

const archetype = JSON.parse(readFileSync('venues/_archetypes/house.json', 'utf8'));
const town = JSON.parse(readFileSync('town/town.json', 'utf8'));

test('residence count is derived from population, never authored', () => {
  const T = RESIDENCE_OCCUPANCY_TARGET_AGENTS;
  assert.equal(deriveResidenceCount({ population: 0 }), 0);
  assert.equal(deriveResidenceCount({ population: 1 }), 1);
  assert.equal(deriveResidenceCount({ population: T }), 1);
  assert.equal(deriveResidenceCount({ population: T + 1 }), 2);
  assert.equal(deriveResidenceCount(town), Math.ceil(town.population / T));
});

test('a malformed town is refused, not guessed at', () => {
  assert.throws(() => deriveResidenceCount({}), /population/);
  assert.throws(() => deriveResidenceCount({ population: -1 }), /population/);
  assert.throws(() => deriveResidenceCount({ population: 2.5 }), /population/);
});

test('instances are stamped from the archetype with unique sequential ids', () => {
  const instances = deriveResidenceInstances(town, archetype);
  assert.equal(instances.length, deriveResidenceCount(town));
  assert.deepEqual(instances.map(v => v.id),
    instances.map((_, i) => `house_${i + 1}`));
  for (const v of instances) {
    assert.equal(v.archetype, 'house');
    assert.deepEqual(v.roles, ['home']);
    assert.ok(v.affords.includes('sleep'), `${v.id} must afford sleep`);
    assert.equal(v.capacity, RESIDENCE_OCCUPANCY_TARGET_AGENTS,
      'published capacity IS the occupancy target — the api fills homes by it');
  }
});

test('the instance list is append-only: growth never reshuffles the prefix (addendum I.2)', () => {
  const now = deriveResidenceInstances(town, archetype);
  const grown = deriveResidenceInstances({ ...town, population: town.population * 2 }, archetype);
  assert.ok(grown.length > now.length);
  assert.deepEqual(grown.slice(0, now.length), now,
    'an existing agent\'s home must never change when the town grows');
});

test('instances are independent copies, not shared references', () => {
  const [a, b] = deriveResidenceInstances({ population: RESIDENCE_OCCUPANCY_TARGET_AGENTS * 2 }, archetype);
  a.furniture.push({ name: 'plant_pot', at: [1, 1] });
  assert.notEqual(a.furniture.length, b.furniture.length);
});

test('the archetype names only contract furniture, seats within the room', () => {
  const c = loadContract();
  const props = new Set(Object.keys(c.props.interior));
  const anims = new Set(Object.keys(c.animatedObjects));
  for (const f of archetype.furniture) assert.ok(props.has(f.name), f.name);
  for (const a of archetype.animated) assert.ok(anims.has(a.name), a.name);
  const [W, H] = archetype.sizeTiles;
  for (const s of archetype.seats) {
    assert.ok(s.at[0] > 0 && s.at[0] < W && s.at[1] > 0 && s.at[1] < H);
  }
});

test('the archetype seats what it houses', () => {
  assert.equal(archetype.seats.length, archetype.capacity,
    'every resident needs a place to be — beds and chairs together');
  assert.ok(archetype.seats.filter(s => s.kind === 'bed').length >= 4);
});

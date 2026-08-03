import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { deriveInstances } from '../scripts/lib/archetypes.mjs';
import { deriveResidenceCount, deriveResidenceInstances } from '../scripts/lib/residences.mjs';

const house = JSON.parse(readFileSync('venues/_archetypes/house.json', 'utf8'));
const town = JSON.parse(readFileSync('town/town.json', 'utf8'));

/**
 * A second archetype, authored HERE rather than in venues/_archetypes/:
 * declaring archetypes is a separate job, and this test is about the
 * generator, not about the vocabulary.
 */
const kiosk = {
  archetype: 'kiosk',
  labelPrefix: 'Kiosk',
  indoor: true,
  sizeTiles: [6, 5],
  groundAtlas: 'interiors_ground',
  capacity: 2,
  roles: ['hangout'],
  affords: ['socialize', 'idle'],
  hours: [{ open: 8, close: 18 }],
  furniture: [{ name: 'stool', at: [2, 2] }],
};

test('ids and labels are stable and sequential in provisioning order', () => {
  const instances = deriveInstances(house, 3);
  assert.deepEqual(instances.map(v => v.id), ['house_1', 'house_2', 'house_3']);
  assert.deepEqual(instances.map(v => v.label), ['House 1', 'House 2', 'House 3']);
});

test('labelPrefix is authoring metadata: stripped from the instance, used for the label', () => {
  const [v] = deriveInstances(house, 1);
  assert.equal('labelPrefix' in v, false, 'labelPrefix must not survive into a venue descriptor');
  assert.equal(v.label, 'House 1');
  // No labelPrefix authored -> the archetype name is the label prefix.
  const { labelPrefix, ...unnamed } = kiosk;
  assert.equal(deriveInstances(unnamed, 1)[0].label, 'kiosk 1');
  // A generator may override it without editing the archetype file.
  assert.equal(deriveInstances(house, 1, { labelPrefix: 'Home' })[0].label, 'Home 1');
});

test('the instance list is append-only: raising the count never reshuffles the prefix', () => {
  const now = deriveInstances(house, 3);
  const grown = deriveInstances(house, 6);
  assert.equal(grown.length, 6);
  assert.deepEqual(grown.slice(0, now.length), now,
    'an existing instance must never change when the count grows');
});

test('instances are independent copies, not shared references', () => {
  const [a, b] = deriveInstances(house, 2);
  a.furniture.push({ name: 'plant_pot', at: [1, 1] });
  assert.notEqual(a.furniture.length, b.furniture.length);
  a.hours[0].close = 12;
  assert.equal(b.hours[0].close, 24, 'nested objects must be cloned too');
});

test('a count that is not a non-negative integer is refused, not guessed at', () => {
  assert.equal(deriveInstances(house, 0).length, 0);
  assert.throws(() => deriveInstances(house, -1), /count/);
  assert.throws(() => deriveInstances(house, 2.5), /count/);
  assert.throws(() => deriveInstances(house, undefined), /count/);
});

test('an archetype without a name is refused: `undefined_1` is not an id', () => {
  const { archetype, ...nameless } = house;
  assert.throws(() => deriveInstances(nameless, 1), /archetype/);
});

test('a second archetype stamps alongside residences with no id collision', () => {
  const homes = deriveInstances(house, 13);
  const kiosks = deriveInstances(kiosk, 3);
  assert.deepEqual(kiosks.map(v => v.id), ['kiosk_1', 'kiosk_2', 'kiosk_3']);
  assert.deepEqual(kiosks.map(v => v.label), ['Kiosk 1', 'Kiosk 2', 'Kiosk 3']);
  // The id namespace is the archetype name, so two archetypes cannot collide.
  const ids = [...homes, ...kiosks].map(v => v.id);
  assert.equal(new Set(ids).size, ids.length);
  // Each carries its own template, not the other's.
  assert.equal(kiosks[0].capacity, kiosk.capacity);
  assert.deepEqual(kiosks[0].roles, kiosk.roles);
  assert.equal(homes[0].capacity, house.capacity);
});

test('deriveResidenceInstances is exactly this generator, driven by the town', () => {
  assert.deepEqual(
    deriveResidenceInstances(town, house),
    deriveInstances(house, deriveResidenceCount(town)));
});

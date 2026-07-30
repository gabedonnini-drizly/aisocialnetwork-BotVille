import { test } from 'node:test';
import assert from 'node:assert/strict';
import { venueRegistry, sceneKeyFor } from '../packages/client/src/game/venueRegistry.ts';

test('the registry enumerates every baked venue, sorted by id', () => {
  // Derived, not transcribed: the five authored venues plus however many
  // residence instances the town snapshot provisioned (Plan 2 Task 14a).
  const ids = venueRegistry.all().map(v => v.id);
  assert.deepEqual(ids, [...ids].sort());
  for (const id of ['cafe', 'district', 'dorm', 'library', 'office'])
    assert.ok(ids.includes(id), id);
  assert.ok(venueRegistry.all().some(v => v.roles.includes('home')),
    'residence instances are venues like any other and must be enumerable');
});

test('get() returns the descriptor', () => {
  assert.equal(venueRegistry.get('cafe')?.label, 'Café');
  assert.equal(venueRegistry.get('cafe')?.capacity, 9);
});

test('an unknown id is undefined, not a throw — that is the unknown path', () => {
  assert.equal(venueRegistry.get('speakeasy'), undefined);
  assert.equal(venueRegistry.has('speakeasy'), false);
});

test('indoor() excludes the district', () => {
  const ids = venueRegistry.indoor().map(v => v.id);
  assert.equal(ids.includes('district'), false);
  for (const id of ['cafe', 'dorm', 'library', 'office']) assert.ok(ids.includes(id), id);
});

test('published() emits exactly the vocabulary fields', () => {
  const pub = venueRegistry.published();
  assert.equal(pub.length, venueRegistry.all().length);
  for (const v of pub) {
    assert.deepEqual(Object.keys(v).sort(),
      ['affords', 'archetype', 'capacity', 'hours', 'id', 'indoor', 'label', 'roles']);
  }
});

test('published() matches the committed venues.json byte for byte', async () => {
  const { readFileSync } = await import('node:fs');
  const onDisk = JSON.parse(readFileSync('packages/client/public/assets/venues.json', 'utf8'));
  assert.deepEqual(venueRegistry.published(), onDisk);
});

test('scene keys: the district keeps its class, venues get one shared scene', () => {
  assert.equal(sceneKeyFor('district'), 'DistrictScene');
  assert.equal(sceneKeyFor('cafe'), 'VenueScene:cafe');
});

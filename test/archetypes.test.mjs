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
  // ...and the override path strips it just the same. Stripping happens on
  // the destructure of the CLONE, so a reader could reasonably expect the
  // opts path to reinstate it; it must not.
  const [withOpts] = deriveInstances(house, 1, { labelPrefix: 'Home' });
  assert.equal('labelPrefix' in withOpts, false,
    'labelPrefix survived into the instance when a generator overrode it');
});

/**
 * `opts.labelPrefix` moves the LABEL and nothing else. The id namespace is
 * `archetype.archetype`, always — so relabelling house instances "Villa"
 * does not make them villas, it makes them houses wearing a villa's name,
 * and their ids still collide with the residences. Pinned here because the
 * option's doc used to invite exactly that reading.
 */
test('opts.labelPrefix cannot move the id namespace', () => {
  const relabelled = deriveInstances(house, 3, { labelPrefix: 'Villa' });
  assert.deepEqual(relabelled.map(v => v.id), ['house_1', 'house_2', 'house_3']);
  assert.deepEqual(relabelled.map(v => v.label), ['Villa 1', 'Villa 2', 'Villa 3']);
  assert.deepEqual(relabelled.map(v => v.archetype), ['house', 'house', 'house']);
  // Which is to say: it is not a way to stamp a second family alongside the
  // first. Those ids ARE the residences' ids.
  assert.deepEqual(relabelled.map(v => v.id),
    deriveInstances(house, 3).map(v => v.id));
});

/**
 * A template that carries `id`/`label` must have them OVERRIDDEN, not
 * copied. This is a live risk rather than a hypothetical: every
 * `venues/<id>/venue.json` in the tree carries both, so an archetype
 * authored by copying one starts out with them. Spread the stamped fields
 * before the template — `{ id, label, ...template }` — and thirteen
 * residences all come out as `house` labelled "House", silently.
 */
test('a template carrying id and label has both stamped over, not copied', () => {
  const authoredLikeAVenue = {
    ...house,
    id: 'copied_from_a_venue_json',
    label: 'Copied From A venue.json',
  };
  const instances = deriveInstances(authoredLikeAVenue, 3);
  assert.deepEqual(instances.map(v => v.id), ['house_1', 'house_2', 'house_3']);
  assert.deepEqual(instances.map(v => v.label), ['House 1', 'House 2', 'House 3']);
  assert.equal(new Set(instances.map(v => v.id)).size, 3,
    'stamped ids must stay unique even when the template supplies one');
  // And the same on the opts path, where the label comes from elsewhere again.
  assert.deepEqual(
    deriveInstances(authoredLikeAVenue, 2, { labelPrefix: 'Home' }).map(v => v.label),
    ['Home 1', 'Home 2']);
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

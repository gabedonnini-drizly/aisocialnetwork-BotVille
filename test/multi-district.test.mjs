import { test } from 'node:test';
import assert from 'node:assert/strict';
import { drawnByDistrict, planSync } from '../packages/client/src/game/districtPresence.ts';
import {
  CLIENT_INTERNAL_LOCATIONS,
  CLIENT_INTERNAL_LOCATION_IDS,
  DISTRICT_SCENE_KEY,
  districtForLocation,
  districtForLocationIn,
  sceneKeyFor,
  sceneKeyForIn,
  sceneTargetFor,
  startingDistrict,
  venueRegistry,
} from '../packages/client/src/game/venueRegistry.ts';

/**
 * D-62: multi-district is architectural from day one, and one district's
 * CONTENT ships. Both halves are tested here, and they pull in opposite
 * directions on purpose — the capability tests run against a SYNTHETIC second
 * district that exists only in this file, and the exposure test asserts the
 * bake still ships exactly one.
 *
 * Before this, `DistrictScene` filtered on `a.location === 'district'` and
 * `sceneKeyFor` compared against the same literal: a second district rendered
 * ZERO agents, and its scene key was `VenueScene:<id>`, which nothing is
 * registered under (a black screen, the farm bug again).
 */

// ── the synthetic second district: capability, never content ───────────────
const v = (id, indoor) => ({
  id, label: id, indoor, sizeTiles: [10, 10], groundAtlas: 'g',
  capacity: 1, roles: [], affords: [], hours: [], furniture: [], seats: [],
  spawns: [], animated: [], doors: [], glows: [],
});
const TWO_DISTRICTS = [v('district', false), v('north', false), v('cafe', true), v('barn', true)];
const lookup = { get: id => TWO_DISTRICTS.find(x => x.id === id) };
/** Each district's own client-internal geography. The farm belongs to one of them. */
const INTERNAL = { farm: 'district', orchard: 'north' };
const resolveDistrict = loc => districtForLocationIn(loc, lookup, INTERNAL);

test('a second district draws its own agents, and only its own', () => {
  const roster = [
    { id: 'a', location: 'district' },
    { id: 'b', location: 'farm' },     // district's back yard
    { id: 'c', location: 'north' },
    { id: 'd', location: 'orchard' },  // north's back yard
    { id: 'e', location: 'cafe' },     // indoors
    { id: 'f', location: 'nowhere' },  // unknown to the registry
  ];
  const plan = (districtId) => planSync({
    districtId,
    fullList: roster,
    drawnIds: [],
    lastLoc: new Map(),
    hasDoorFor: () => false,
    isAsleep: () => false,
    isLeaving: () => false,
    resolveDistrict,
  });

  assert.deepEqual(plan('district').present.map(a => a.id), ['a', 'b'],
    'the first district drew somebody else’s agents, or lost its own farm');
  assert.deepEqual(plan('north').present.map(a => a.id), ['c', 'd'],
    'a second district must render agents — it rendered none before this change');
});

test('a second district gets the district scene, not a venue key nothing registers', () => {
  // `sceneKeyFor` used to be `venueId === 'district' ? 'DistrictScene' : ...`,
  // so district B resolved to `VenueScene:north` — the same unregistered-key
  // black screen the farm produced. Asked against the synthetic registry, a
  // re-hardcoded version fails here even though one district ships.
  assert.equal(sceneKeyForIn('north', lookup), DISTRICT_SCENE_KEY);
  assert.equal(sceneKeyForIn('district', lookup), DISTRICT_SCENE_KEY);
  assert.equal(sceneKeyForIn('cafe', lookup), 'VenueScene:cafe');
  assert.equal(sceneKeyForIn('barn', lookup), 'VenueScene:barn');
  assert.equal(sceneKeyForIn('nowhere', lookup), 'VenueScene:nowhere');
});

test('the second district is a real district everywhere, not just in the filter', () => {
  // scene routing, door lookups and the presence filter must agree, or an
  // agent is "in" a district that cannot draw them (the farm black-screen).
  for (const id of ['district', 'north']) {
    assert.equal(resolveDistrict(id), id);
    assert.equal(drawnByDistrict(id, id, resolveDistrict), true);
  }
  assert.equal(drawnByDistrict('north', 'district', resolveDistrict), false);
  assert.equal(drawnByDistrict('orchard', 'district', resolveDistrict), false);
  assert.equal(drawnByDistrict('cafe', 'district', resolveDistrict), false);
  assert.equal(resolveDistrict('cafe'), undefined, 'an interior is nobody’s district');
  assert.equal(resolveDistrict('nowhere'), undefined, 'an unknown id is nobody’s district');
});

test('an agent walking out of district B does not appear at district A’s door', () => {
  // The door-origin branch used to read `from !== 'district'`: coming from
  // ANY other district passed the test and hunted for a door on this map.
  const plan = planSync({
    districtId: 'district',
    fullList: [{ id: 'a', location: 'district' }],
    drawnIds: [],
    lastLoc: new Map([['a', 'north']]),
    hasDoorFor: () => true, // even with a door for everything...
    isAsleep: () => false,
    isLeaving: () => false,
    resolveDistrict,
  });
  assert.deepEqual(plan.spawn.get('a'), { atDoorOf: 'north' },
    'crossing between districts is a real arrival — the other district is not "here"');

  // ...whereas this district's own geography never spawns anyone at a door.
  const home = planSync({
    districtId: 'district',
    fullList: [{ id: 'a', location: 'district' }],
    drawnIds: [],
    lastLoc: new Map([['a', 'farm']]),
    hasDoorFor: () => true,
    isAsleep: () => false,
    isLeaving: () => false,
    resolveDistrict,
  });
  assert.deepEqual(home.spawn.get('a'), {}, 'the farm is this district — no door to come out of');
});

// ── the live registry ──────────────────────────────────────────────────────

test('scene keys are derived from the registry, not from an id', () => {
  for (const venue of venueRegistry.outdoor()) {
    assert.equal(sceneKeyFor(venue.id), DISTRICT_SCENE_KEY,
      'every outdoor venue is drawn by the one district scene');
    assert.deepEqual(sceneTargetFor(venue.id), {
      key: DISTRICT_SCENE_KEY, data: { districtId: venue.id },
    }, 'starting the district scene without its id draws whichever district was last up');
  }
  for (const venue of venueRegistry.indoor()) {
    assert.equal(sceneKeyFor(venue.id), `VenueScene:${venue.id}`);
    assert.deepEqual(sceneTargetFor(venue.id), { key: `VenueScene:${venue.id}` });
  }
  // The unknown path (spec §8.1) is unchanged: no registry entry, no scene.
  assert.equal(sceneKeyFor('no-such-venue'), 'VenueScene:no-such-venue');
  assert.deepEqual(sceneTargetFor('no-such-venue'), { key: 'VenueScene:no-such-venue' });
});

test('every client-internal location is owned by a district that exists', () => {
  assert.ok(CLIENT_INTERNAL_LOCATION_IDS.length > 0, 'the exemption list is empty — this check is vacuous');
  for (const [location, districtId] of Object.entries(CLIENT_INTERNAL_LOCATIONS)) {
    const owner = venueRegistry.get(districtId);
    assert.ok(owner && !owner.indoor,
      `'${location}' is owned by '${districtId}', which is not an outdoor venue — nothing would draw it`);
    assert.equal(districtForLocation(location), districtId);
    assert.equal(sceneTargetFor(location).data?.districtId, districtId,
      'a HUD click on this location must open the district that draws it');
  }
});

test('the capability ships; a second district’s content does not (D-62)', () => {
  const outdoor = venueRegistry.outdoor();
  assert.equal(outdoor.length, 1,
    'a second district appeared in the bake. That is content, and this plan ships capability '
    + 'only — the measured round stays clean.');
  assert.equal(startingDistrict().id, outdoor[0].id);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { loadContract } from '../scripts/lib/assetContract.mjs';

const load = id => JSON.parse(readFileSync(`venues/${id}/venue.json`, 'utf8'));
const INTERIORS = ['office', 'cafe', 'dorm', 'library'];
const c = loadContract();

test('all four interior descriptors exist', () => {
  for (const id of INTERIORS) assert.ok(existsSync(`venues/${id}/venue.json`), id);
});

test('interiors are 20x15 on the interiors_ground atlas', () => {
  for (const id of INTERIORS) {
    const v = load(id);
    assert.deepEqual(v.sizeTiles, [20, 15], id);
    assert.equal(v.groundAtlas, 'interiors_ground', id);
    assert.equal(v.indoor, true, id);
  }
});

test('every ground key names a tile in the atlas', () => {
  const tiles = new Set(c.groundAtlases.interiors_ground.tiles);
  for (const id of INTERIORS) {
    const g = load(id).ground;
    for (const key of ['wallA', 'wallB', 'floor']) assert.ok(tiles.has(g[key]), `${id}.${key}=${g[key]}`);
  }
});

test('every furniture and animated name is in the contract', () => {
  const props = new Set(Object.keys(c.props.interior));
  const anims = new Set(Object.keys(c.animatedObjects));
  for (const id of INTERIORS) {
    const v = load(id);
    for (const f of v.furniture) assert.ok(props.has(f.name), `${id}: ${f.name}`);
    for (const a of v.animated) assert.ok(anims.has(a.name), `${id}: ${a.name}`);
  }
});

test('capacity equals the seat count the art supports', () => {
  assert.equal(load('office').seats.length, 4);
  assert.equal(load('cafe').seats.length, 9);
  assert.equal(load('dorm').seats.length, 6);
  assert.equal(load('library').seats.length, 4);
  for (const id of INTERIORS) assert.equal(load(id).capacity, load(id).seats.length, id);
});

test('every interior exits to the district', () => {
  for (const id of INTERIORS) {
    const v = load(id);
    assert.equal(v.doors.length, 1, id);
    assert.equal(v.doors[0].targetVenue, 'district', id);
  }
});

test('every descriptor carries the affordance fields (addendum I.1)', () => {
  for (const id of INTERIORS) {
    const v = load(id);
    assert.ok(Array.isArray(v.roles) && v.roles.length > 0, `${id}.roles`);
    assert.ok(Array.isArray(v.affords) && v.affords.length > 0, `${id}.affords`);
    assert.ok(Array.isArray(v.hours) && v.hours.length > 0, `${id}.hours`);
    for (const w of v.hours) {
      assert.ok(Number.isInteger(w.open) && Number.isInteger(w.close), `${id}.hours`);
      assert.ok(w.open >= 0 && w.close <= 24 && w.open < w.close, `${id}.hours ${w.open}-${w.close} must not wrap — split at midnight`);
    }
  }
});

test('the café stays open past midnight — the night-venues window (owner decision)', () => {
  const cafe = load('cafe');
  assert.ok(cafe.hours.some(w => w.open === 0 && w.close >= 2),
    'the café must carry an after-midnight window (split at midnight, never wrapped) so night-owls have an indoor venue');
});

test('the dorm is a hangout, not a home — sleep happens in residences (F-12)', () => {
  const dorm = load('dorm');
  assert.deepEqual(dorm.roles, ['hangout']);
  assert.equal(dorm.affords.includes('sleep'), false,
    'the dorm must not afford sleep, or the schedule writer funnels the whole roster back into it');
});

test('descriptor ids match their directory', () => {
  // `_`-prefixed entries are not venues — venues/_archetypes/ holds archetype
  // files (Task 14a).
  for (const dir of readdirSync('venues').filter(d => !d.startsWith('_') && !d.startsWith('.')))
    assert.equal(load(dir).id, dir);
});

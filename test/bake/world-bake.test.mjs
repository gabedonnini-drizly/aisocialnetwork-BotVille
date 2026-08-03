import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { worldBake } from '../../scripts/world-bake.mjs';
import { loadContract } from '../../scripts/lib/assetContract.mjs';
import { deriveResidenceCount, deriveResidenceInstances } from '../../scripts/lib/residences.mjs';

const c = loadContract();

/** Every bake in this file writes to a temp dir. Nothing touches the repo. */
function bake() {
  const out = mkdtempSync(join(tmpdir(), 'world-out-'));
  const gen = mkdtempSync(join(tmpdir(), 'world-gen-'));
  const result = worldBake({
    pack: 'fixture', srcRoot: 'test/fixtures/pack-src', outDir: out, generatedDir: gen,
  });
  return { out, gen, result };
}

test('worldBake refuses to guess where to write', () => {
  assert.throws(() => worldBake({ pack: 'fixture', srcRoot: 'test/fixtures/pack-src' }),
    /outDir is required/);
  assert.throws(() => worldBake({ pack: 'fixture', srcRoot: 'test/fixtures/pack-src', outDir: '/tmp/x' }),
    /generatedDir is required/);
});

test('both ground atlases are written under tilesets/pack', () => {
  const { out } = bake();
  assert.ok(existsSync(join(out, 'tilesets/pack/district_ground.png')));
  assert.ok(existsSync(join(out, 'tilesets/pack/interiors_ground.png')));
});

test('no output path names a vendor (I-1)', () => {
  const { out } = bake();
  const walk = d => readdirSync(d, { withFileTypes: true }).flatMap(e =>
    e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]);
  assert.deepEqual(walk(out).filter(p => /limezu/i.test(p)), []);
});

test('one prop PNG per contract name, in every group', () => {
  const { out } = bake();
  for (const group of Object.keys(c.props)) {
    assert.equal(readdirSync(join(out, 'sprites/pack', group)).length,
      Object.keys(c.props[group]).length, group);
  }
});

test('one tilemap per venue, residence instances included', () => {
  const { out } = bake();
  // Derived, not transcribed: authored venue dirs plus the residence
  // instances the town snapshot provisions (Task 14a).
  const town = JSON.parse(readFileSync('town/town.json', 'utf8'));
  const authored = readdirSync('venues').filter(d => !d.startsWith('_') && !d.startsWith('.'));
  const instances = deriveResidenceInstances(town,
    JSON.parse(readFileSync('venues/_archetypes/house.json', 'utf8'))).map(v => v.id);
  assert.deepEqual(readdirSync(join(out, 'tilemaps')).sort(),
    [...authored, ...instances].map(id => `${id}.tmj`).sort());
});

test('tilemaps reference ../tilesets/pack/, never a vendor name', () => {
  const { out } = bake();
  const m = JSON.parse(readFileSync(join(out, 'tilemaps/cafe.tmj'), 'utf8'));
  assert.equal(m.tilesets[0].image, '../tilesets/pack/interiors_ground.png');
});

test('venues.json publishes the vocabulary sorted by id (I-8)', () => {
  const { out } = bake();
  const pub = JSON.parse(readFileSync(join(out, 'venues.json'), 'utf8'));
  assert.deepEqual(pub.map(v => v.id), [...pub.map(v => v.id)].sort());
  const authored = readdirSync('venues').filter(d => !d.startsWith('_') && !d.startsWith('.'));
  for (const id of authored) assert.ok(pub.some(v => v.id === id), id);
  for (const v of pub) {
    assert.deepEqual(Object.keys(v).sort(),
      ['affords', 'archetype', 'capacity', 'hours', 'id', 'indoor', 'label', 'roles']);
  }
  // Publisher fidelity, not a magic number: capacity is whatever the
  // descriptor says (Task 13), read from it rather than transcribed.
  const cafe = JSON.parse(readFileSync('venues/cafe/venue.json', 'utf8'));
  assert.equal(pub.find(v => v.id === 'cafe').capacity, cafe.capacity);
  assert.deepEqual(pub.find(v => v.id === 'cafe').affords, cafe.affords);
});

/**
 * Two things that used to be the same set and are not any more.
 *
 * RESIDENCE INSTANCES are what the house generator stamps —
 * `deriveResidenceCount(town)` of them, all archetype `house`.
 *
 * HOME-ROLE VENUES are everything the schedule writer can put a sleeping
 * agent in. D-60's shelter joined that set without being a stamped
 * residence: it is an authored venue that is a hangout by day and a home by
 * night. Collapsing the two would either miscount the residences or forbid
 * the shelter.
 *
 * What has NOT changed is the F-12 night rule: only a home-role venue may
 * afford sleep, so a sleeping agent can never be placed in a public room.
 */
test('residence instances join the vocabulary and afford sleep (addendum I.2)', () => {
  const { out } = bake();
  const pub = JSON.parse(readFileSync(join(out, 'venues.json'), 'utf8'));
  const town = JSON.parse(readFileSync('town/town.json', 'utf8'));

  const stamped = pub.filter(v => v.archetype === 'house');
  assert.equal(stamped.length, deriveResidenceCount(town),
    'the house generator stamps the town-derived count');
  for (const h of stamped) {
    assert.ok(h.roles.includes('home'), h.id);
    assert.ok(h.affords.includes('sleep'), h.id);
  }

  const homes = pub.filter(v => v.roles.includes('home'));
  for (const h of homes) {
    assert.ok(h.affords.includes('sleep'),
      `${h.id} carries the home role but affords no sleep — the schedule writer would send `
      + 'an agent home to a venue it cannot sleep in');
  }

  // D-60's shelter: a home that is not a stamped residence. Asserted as a
  // SHAPE, not by id, so it survives the vocabulary changing again.
  const shelters = homes.filter(v => v.archetype !== 'house');
  for (const s of shelters) {
    assert.ok(s.roles.includes('hangout'),
      `${s.id} is a home but not a residence instance — the only such venue is the shelter, `
      + 'which stays a daytime hangout too');
  }

  // The F-12 night rule, by construction: nothing outside the home-role set
  // affords sleep.
  assert.deepEqual(pub.filter(v => v.affords.includes('sleep')), homes);
});

test('the published schema ships beside the data (Conventions table)', () => {
  const { out } = bake();
  assert.deepEqual(
    JSON.parse(readFileSync(join(out, 'venues.schema.json'), 'utf8')),
    JSON.parse(readFileSync('schemas/venues.schema.json', 'utf8')));
});

test('the generated registry module lands in generatedDir, carrying every venue', () => {
  // generatedDir is REQUIRED because this write exists: Plan 3 Task 21's
  // venueRegistry.ts imports the module Vite bundles statically.
  const { gen } = bake();
  const src = readFileSync(join(gen, 'venues.generated.ts'), 'utf8');
  assert.ok(src.startsWith('// GENERATED by scripts/world-bake.mjs'));
  assert.ok(src.includes('export const VENUES: VenueDescriptor[] ='));
  const authored = readdirSync('venues').filter(d => !d.startsWith('_') && !d.startsWith('.'));
  for (const id of authored) assert.ok(src.includes(`"id": "${id}"`), id);
});

test('the bake is deterministic across runs', () => {
  const a = bake(), b = bake();
  const read = (o, p) => readFileSync(join(o, p));
  for (const p of ['tilesets/pack/district_ground.png', 'tilemaps/district.tmj', 'venues.json']) {
    assert.deepEqual(read(a.out, p), read(b.out, p), p);
  }
});

test('the bake reports what it wrote, and the report matches the contract', () => {
  const { out, result } = bake();
  assert.equal(result.atlases, Object.keys(c.groundAtlases).length);
  assert.equal(result.props,
    Object.values(c.props).reduce((n, g) => n + Object.keys(g).length, 0));
  assert.equal(result.venues, readdirSync(join(out, 'tilemaps')).length);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { GENERATORS, countFor } from '../scripts/lib/generators.mjs';
import { deriveResidenceCount } from '../scripts/lib/residences.mjs';
import { loadContract } from '../scripts/lib/assetContract.mjs';

const DIR = 'venues/_archetypes';
const town = JSON.parse(readFileSync('town/town.json', 'utf8'));
const contract = loadContract();

const files = readdirSync(DIR).filter(f => f.endsWith('.json')).sort();
const archetypes = files.map(f => ({ file: f, ...JSON.parse(readFileSync(join(DIR, f), 'utf8')) }));

test('every archetype file names the family it stamps, and the file agrees with it', () => {
  assert.ok(archetypes.length > 0, 'no archetypes declared');
  for (const a of archetypes) {
    assert.ok(a.archetype, `${a.file} has no archetype name — it is the id namespace`);
    assert.equal(`${a.archetype}.json`, a.file,
      'the filename IS the lookup key the generator registry is read against');
  }
});

/**
 * ABSENCE IS ZERO (generators.mjs). This is the answer to "what makes
 * condo's count zero" — not an authored `0` somewhere that could be
 * forgotten, but having no generator at all. Asserting it here rather than
 * asserting "the bake produced no condo" is the difference between testing
 * the mechanism and restating a tautology [R: S-6].
 */
test('an archetype with no generator stamps nothing — absence is zero', () => {
  assert.equal(countFor('condo', town), 0);
  assert.equal(countFor('a_name_no_one_ever_declared', town), 0);
  for (const a of archetypes) {
    if (Object.hasOwn(GENERATORS, a.archetype)) continue;
    assert.equal(countFor(a.archetype, town), 0, `${a.archetype} is declared, not instantiated`);
  }
});

test('presence is a count: registering a generator is the whole difference', () => {
  assert.equal(countFor('condo', town), 0);
  try {
    GENERATORS.condo = () => 3;
    assert.equal(countFor('condo', town), 3,
      'a registry entry is the ONLY thing standing between declared and instantiated');
  } finally {
    delete GENERATORS.condo;
  }
  assert.equal(countFor('condo', town), 0, 'the fixture must not leak into other tests');
});

test('the residence generator is the town-derived count, not a number written down', () => {
  assert.equal(countFor('house', town), deriveResidenceCount(town));
});

/**
 * The reverse direction, which absence-is-zero makes silent on its own: a
 * generator registered for an archetype that does not exist stamps nothing
 * and says nothing. Renaming an archetype file without renaming its registry
 * key would retire the venue it counts — with no error anywhere.
 */
test('every generator names an archetype that exists', () => {
  for (const key of Object.keys(GENERATORS)) {
    assert.ok(files.includes(`${key}.json`),
      `GENERATORS has an entry for "${key}" but venues/_archetypes/${key}.json does not exist — `
      + 'the generator counts nothing and the absence is silent');
  }
});

/**
 * The published schema requires `roles` and `affords` to be non-empty
 * (schemas/venues.schema.json, minItems 1). The ladder tiers used to ship
 * `"roles": []` — a LATENT schema violation, harmless only while nothing
 * stamped them — because `home` was withheld until plan `01-` backfilled
 * stored home assignments.
 *
 * The backfill landed and the tiers now declare `home`, so this gate is
 * SATISFIABLE for them: registering a generator for a tier is now a bake
 * decision rather than a schema violation waiting to happen. The gate stays,
 * because it is about every future archetype too — a new one declared
 * without roles and then given a generator would publish a venue the
 * platform refuses to validate.
 */
test('an archetype with a generator satisfies the published schema (roles/affords non-empty)', () => {
  const schema = JSON.parse(readFileSync('schemas/venues.schema.json', 'utf8'));
  const minRoles = schema.items.properties.roles.minItems;
  const minAffords = schema.items.properties.affords.minItems;
  assert.ok(minRoles >= 1 && minAffords >= 1, 'the schema stopped requiring these — re-read this test');

  for (const a of archetypes) {
    if (!Object.hasOwn(GENERATORS, a.archetype)) continue;   // declared, dormant
    assert.ok((a.roles ?? []).length >= minRoles,
      `${a.file} has a generator but declares no roles — every instance it stamps would violate `
      + 'the published schema. If this is a residence tier, the role lands with plan 01-\'s '
      + 'stored-home backfill, and the generator must not be registered before it.');
    assert.ok((a.affords ?? []).length >= minAffords,
      `${a.file} has a generator but affords nothing — every instance it stamps would violate the schema`);
  }
});

/**
 * THE BACKFILL HAS LANDED, so the role has too [R: F-7, S-5].
 *
 * `deriveResidenceVenues` orders `home`-role venues by numeric id and
 * `deriveHomeVenue` fills them in that order, so publishing any new
 * home-role venue re-homes every agent who holds NO stored assignment — 73
 * of 85, measured. The ladder tiers were therefore declared with the role
 * withheld until plan `01-` Task 3 wrote one stored assignment per agent.
 *
 * That backfill ran (85/85 stored, verified re-run: written 0, already
 * assigned 85), so the derived fallback is unreachable and the ordering is
 * free to change. The proof is plan `01-`'s empty-home-diff test, which runs
 * against THIS bake output: with rows stored, adding a home-role venue moves
 * nobody.
 *
 * What this test guards NOW is the other half of the same rule: only a
 * residence may claim the role. A civic archetype picking up `home` would
 * put a school in the residence pool.
 */
const LADDER = ['house', 'mobile_home', 'villa', 'condo'];

test('the home role belongs to the housing ladder, and to nothing else', () => {
  for (const a of archetypes) {
    if (LADDER.includes(a.archetype)) continue;
    assert.equal((a.roles ?? []).includes('home'), false,
      `${a.file} claims the home role but is not a housing tier — it would join the residence `
      + 'pool that deriveHomeVenue fills, and agents would be assigned to sleep in it');
  }
});

/**
 * The post-backfill state of the tiers themselves. This replaces the
 * `roles: []` pin, which existed ONLY to hold the withheld state and would
 * now be asserting the bug: a residence tier with no role is a latent schema
 * violation (roles minItems 1) waiting for someone to register its
 * generator.
 *
 * A tier's only role is `home` — a `hangout` here would quietly make a house
 * a public daytime candidate.
 */
test('every housing tier declares exactly the home role', () => {
  for (const a of archetypes) {
    if (!LADDER.includes(a.archetype)) continue;
    assert.deepEqual(a.roles, ['home'],
      `${a.file} declares roles ${JSON.stringify(a.roles)} — a residence tier's only role is \`home\``);
  }
});

/**
 * The bake's only ground generator is `cityGrid`, and it hard-requires a farm
 * pen and a gate — so an outdoor venue cannot bake without one it knows. The
 * garden is declared outdoor (D-75: outdoor only, no interior) and is
 * therefore not instantiable until an open-ground generator exists. That is a
 * real gap, and this is where it fails loudly: the day someone registers a
 * generator for an outdoor archetype without giving it ground, rather than
 * three tasks later in a bake.
 */
test('an outdoor archetype is not instantiable until it names a ground generator', () => {
  for (const a of archetypes) {
    if (a.indoor !== false) continue;
    if (!Object.hasOwn(GENERATORS, a.archetype)) continue;   // declared, dormant: fine
    assert.ok(a.generator?.name,
      `${a.file} has a generator registered but names no ground generator — bakeDistrict `
      + 'would throw. Outdoor venues need one before they can be instantiated.');
  }
});

/**
 * An archetype that is never instantiated never reaches
 * `validate(contract, adapter, { venues })`, so I-2's guardrail does not
 * cover it: a typo'd prop name would sit in the tree until the day someone
 * registers a generator, and fail the bake then. Close that here — the
 * template is checked against the contract whether or not the town wants
 * one yet.
 */
test('every archetype references only names the contract declares (I-2, before instancing)', () => {
  const props = new Set([...Object.keys(contract.props.district), ...Object.keys(contract.props.interior)]);
  const animated = new Set(Object.keys(contract.animatedObjects));
  for (const a of archetypes) {
    for (const f of a.furniture ?? []) {
      assert.ok(props.has(f.name), `${a.file}: furniture "${f.name}" is not in the contract`);
    }
    for (const an of a.animated ?? []) {
      assert.ok(animated.has(an.name), `${a.file}: animated "${an.name}" is not in the contract`);
    }
    const atlas = contract.groundAtlases[a.groundAtlas];
    assert.ok(atlas, `${a.file}: unknown groundAtlas "${a.groundAtlas}"`);
    for (const [part, tile] of Object.entries(a.ground ?? {})) {
      assert.ok(atlas.tiles.includes(tile),
        `${a.file}: ground.${part} "${tile}" is not a tile of "${a.groundAtlas}"`);
    }
    for (const d of a.doors ?? []) {
      assert.ok(d.targetVenue, `${a.file}: door "${d.name}" leads nowhere`);
    }
  }
});

/**
 * D-75's first-pass building set. Declared here, dormant by absence from the
 * registry — I-8 holds either way: the art exists and the vocabulary of
 * NAMES exists, and the unlock state (plan `01-`) decides whether any of them
 * ever appears.
 */
test('the D-75 civic set is declared in full, and every one of them is dormant', () => {
  const civic = ['garden', 'market', 'post_office', 'school', 'swimming_pool', 'museum'];
  const declared = archetypes.map(a => a.archetype);
  for (const name of civic) assert.ok(declared.includes(name), `${name} is not declared`);
  for (const name of civic) {
    assert.equal(countFor(name, town), 0, `${name} is instantiated — plan 01- owns that decision`);
  }
});

test('no civic archetype affords sleep — only a residence can be slept in (F-12)', () => {
  for (const a of archetypes) {
    if (['house', 'mobile_home', 'villa', 'condo'].includes(a.archetype)) continue;
    assert.equal(a.affords.includes('sleep'), false,
      `${a.file} affords sleep, which would make it a bed the schedule writer could reach`);
  }
});

/**
 * D-65: the tier changes the EXTERIOR only. The interiors are shared, so a
 * hand edit to one ladder tier's furniture that never reached the others is
 * a defect — this is the test that says so.
 */
test('the housing ladder shares one interior; only capacity varies by tier', () => {
  const ladder = archetypes.filter(a => ['house', 'mobile_home', 'villa', 'condo'].includes(a.archetype));
  assert.equal(ladder.length, 4, 'the ladder is house/mobile_home/villa/condo (tent is art, not a venue)');
  const house = ladder.find(a => a.archetype === 'house');
  const interior = a => JSON.stringify([a.sizeTiles, a.groundAtlas, a.ground, a.furniture, a.seats, a.animated, a.spawns, a.doors]);
  for (const a of ladder) {
    assert.equal(interior(a), interior(house), `${a.file}'s interior has drifted from house.json`);
  }
});

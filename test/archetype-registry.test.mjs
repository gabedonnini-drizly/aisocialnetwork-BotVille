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
 * The kickoff's correction 3 and [R: F-7, S-5]: `deriveResidenceVenues`
 * orders `home`-role venues by numeric id and `deriveHomeVenue` fills them
 * in that order, so publishing ANY new home-role venue re-homes agents who
 * hold no stored assignment. The ladder tiers are therefore declared with
 * the role withheld; plan `01-` Task 3 backfills stored homes, and only then
 * does a follow-up bake add it. This test is the tripwire on that ordering.
 */
test('no archetype but `house` claims the home role — the role lands after the backfill', () => {
  for (const a of archetypes) {
    if (a.archetype === 'house') {
      assert.deepEqual(a.roles, ['home'], 'the shipped residence keeps its role');
      continue;
    }
    assert.deepEqual(a.roles ?? [], [],
      `${a.file} declares roles ${JSON.stringify(a.roles)} — adding a home-role venue is a `
      + 'home-reassignment event, not a declaration (kickoff correction 3)');
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

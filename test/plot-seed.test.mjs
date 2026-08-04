import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { hashString, pickFrom, SEED_SALT } from '../packages/client/src/game/plotSeed.ts';
import { resolveSiblingRepo, envKey } from './helpers/siblingRepo.mjs';
import { skipUnless } from './helpers/skip.mjs';

/**
 * D-75 rules ONE variant pick: `pickFrom(pool, spriteSeed, salt)` from
 * `api/src/utils/agentSeed.js:178`. The client cannot import it — CommonJS,
 * different repo, browser bundle — so plan `04-` Task 5 ruled the remedy:
 * mirror it, and pin the mirror with a shared fixture.
 *
 * Three checks, and it takes all three:
 *   1. the mirror reproduces a COMMITTED vector — works with no sibling repo,
 *      so this is never a vacuous suite;
 *   2. the api's real pickFrom reproduces the SAME vector — runs whenever the
 *      sibling is on disk, and is what catches the api moving;
 *   3. the mirror and the original agree on fresh inputs, not just the ones
 *      somebody remembered to write down.
 */

const API_NAME = 'aisocialnetwork-api';
const apiRoot = resolveSiblingRepo(API_NAME);

/** The committed vector. Every entry was produced by the api's own pickFrom. */
const FIXTURE = JSON.parse(readFileSync('test/fixtures/pick-from-vector.json', 'utf8'));

test('the mirrored pickFrom reproduces the committed vector', () => {
  assert.ok(FIXTURE.cases.length > 0, 'the vector is empty — this check is vacuous');
  for (const c of FIXTURE.cases) {
    assert.equal(hashString(c.seed, c.salt), c.hash,
      `hashString('${c.seed}', '${c.salt}') moved — every agent's art changes with it`);
    assert.equal(pickFrom(c.pool, c.seed, c.salt), c.pick,
      `pickFrom moved for seed '${c.seed}' salt '${c.salt}'`);
  }
});

test('the api\'s pickFrom reproduces the same vector',
  skipUnless(apiRoot, `${API_NAME} not found — set ${envKey(API_NAME)} or check it out beside this repo`),
  () => {
    const modPath = join(apiRoot, 'src', 'utils', 'agentSeed.js');
    assert.ok(existsSync(modPath),
      `${modPath} is gone — D-75 names it as the helper this mirrors; find where it moved`);
    const api = createRequire(import.meta.url)(modPath);
    for (const c of FIXTURE.cases) {
      assert.equal(api.hashString(c.seed, c.salt), c.hash);
      assert.equal(api.pickFrom(c.pool, c.seed, c.salt), c.pick);
    }
  });

test('mirror and original agree on inputs nobody wrote down',
  skipUnless(apiRoot, `${API_NAME} not found — set ${envKey(API_NAME)}`),
  () => {
    const api = createRequire(import.meta.url)(join(apiRoot, 'src', 'utils', 'agentSeed.js'));
    const pools = JSON.parse(readFileSync('contract/variant_pools.json', 'utf8')).pools;
    let compared = 0;
    for (const [poolName, pool] of Object.entries(pools)) {
      for (let i = 0; i < 40; i++) {
        const seed = `agent_${poolName}_${i}`;
        for (const salt of Object.values(SEED_SALT)) {
          assert.equal(pickFrom(pool, seed, salt), api.pickFrom(pool, seed, salt),
            `divergence at pool '${poolName}', seed '${seed}', salt '${salt}'`);
          compared++;
        }
      }
    }
    assert.ok(compared > 1000, `only ${compared} comparisons — the loop is not running`);
  });

test('the same agent gets the same tent forever; different agents spread the pool', () => {
  const pool = JSON.parse(readFileSync('contract/variant_pools.json', 'utf8')).pools.tent;
  assert.equal(pool.length, 6);

  // "Same agent, same tent, forever" (plan 03- Task 2), across calls and
  // across whatever else the client happens to be seeding at the time.
  const once = pickFrom(pool, 'noah_klein', SEED_SALT.tent);
  for (let i = 0; i < 100; i++) assert.equal(pickFrom(pool, 'noah_klein', SEED_SALT.tent), once);

  // ...and different agents spread. Not "perfectly uniform" — a hash over 85
  // agents is not — but every member of the pool must be reachable, or the
  // pool is decoration.
  const seeds = Array.from({ length: 85 }, (_, i) => `agent_${i}`);
  const hit = new Set(seeds.map(s => pickFrom(pool, s, SEED_SALT.tent)));
  assert.equal(hit.size, pool.length,
    `85 agents reached only ${hit.size} of ${pool.length} tents — the pick is collapsing`);
});

test('every salt is distinct — two salts that collide are one salt', () => {
  const values = Object.values(SEED_SALT);
  assert.equal(new Set(values).size, values.length);
  // And they actually separate: the same seed must not give the same index
  // under every salt, or the "one salt each so two cannot lock in step"
  // comment is false.
  const pool = ['a', 'b', 'c', 'd', 'e', 'f'];
  const picks = new Set(values.map(salt => pickFrom(pool, 'plot_7', salt)));
  assert.ok(picks.size > 1, 'every salt gives the same answer for the same seed');
});

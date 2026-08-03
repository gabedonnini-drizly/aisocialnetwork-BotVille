import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadContract } from '../scripts/lib/assetContract.mjs';

const OURS = 'contract/variant_pools.json';
const PUBLISHED = 'packages/client/public/assets/variant_pools.json';
const registry = JSON.parse(readFileSync(OURS, 'utf8'));
const contract = loadContract();

test('every pool member is a name the contract declares (I-2)', () => {
  const declared = new Set([
    ...Object.keys(contract.props.district),
    ...Object.keys(contract.props.interior),
  ]);
  for (const [pool, members] of Object.entries(registry.pools)) {
    const unresolved = members.filter(n => !declared.has(n));
    assert.deepEqual(unresolved, [], `pool "${pool}" names props the contract does not declare`);
  }
});

test('a pool is non-empty and holds no member twice', () => {
  assert.ok(Object.keys(registry.pools).length > 0, 'no pools declared');
  for (const [pool, members] of Object.entries(registry.pools)) {
    assert.ok(members.length > 0, `pool "${pool}" is empty — an empty pool has no pick`);
    assert.equal(new Set(members).size, members.length,
      `pool "${pool}" repeats a member, which silently weights it`);
  }
});

/**
 * The verified count, from the pack itself: Tent_1..6. This is the pool the
 * owner ruling names, so it is the one worth pinning by number as well as by
 * resolution — a pack update that dropped one would otherwise pass every
 * check above.
 */
test('the tent pool is the six tents the pack ships', () => {
  assert.deepEqual(registry.pools.tent,
    ['tent_1', 'tent_2', 'tent_3', 'tent_4', 'tent_5', 'tent_6']);
});

test('every housing tier with art has a pool', () => {
  for (const tier of ['tent', 'mobile_home', 'house', 'villa', 'condo']) {
    assert.ok(Array.isArray(registry.pools[tier]) && registry.pools[tier].length > 0,
      `${tier} has no variant pool`);
  }
});

/**
 * Stability is the claim (D-75: the pool is bake data, the pick is not). The
 * bake COPIES this file rather than re-serialising it, so "the same names in
 * the same order on every bake" reduces to "the published artifact is this
 * file, byte for byte" — which is checkable here, without agents, without a
 * spriteSeed, and without inventing a second seeding scheme [R: S-4].
 */
test('the published pool is this file, byte for byte — order cannot drift in the bake', () => {
  assert.equal(readFileSync(PUBLISHED, 'utf8'), readFileSync(OURS, 'utf8'),
    'variant_pools.json is stale — run npm run bake:world');
});

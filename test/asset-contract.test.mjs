import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadContract } from '../scripts/lib/assetContract.mjs';
import { legacyAtlasTiles, legacyPropNames } from './helpers/legacySource.mjs';

test('contract loads with schemaVersion 1 and 16px tiles', () => {
  const c = loadContract();
  assert.equal(c.schemaVersion, 1);
  assert.equal(c.tileSize, 16);
});

test('ground atlas order reconciles with the scripts it replaces', () => {
  const c = loadContract();
  for (const [atlasId, legacy] of Object.entries(legacyAtlasTiles())) {
    // Order defines GID. Not "the same names" — the same names IN ORDER.
    assert.deepEqual(c.groundAtlases[atlasId].tiles, legacy, atlasId);
  }
});

/**
 * The migration claim, and only the migration claim: every name the legacy
 * lists carried is still declared, under the same spelling.
 *
 * This was an equality assertion while the contract's only job was to
 * reproduce the lists it replaced. It cannot stay one: plan `04-` declares
 * the housing ladder, the construction states and the civic archetypes, so
 * the contract now legitimately holds names the legacy pipeline never had.
 * Equality would make *growth* the failure — the exact thing the contract
 * exists to make cheap. Containment keeps the half that was ever load-
 * bearing (nothing was dropped or renamed on the way in) and drops the half
 * that only ever said "and nothing has been added since".
 *
 * The atlas assertion above stays an equality on purpose: tile ORDER defines
 * GID, so a ground atlas that grows is a different tilemap.
 */
test('prop names reconcile with DISTRICT_IMAGES and INTERIOR_IMAGES', () => {
  const c = loadContract();
  for (const [group, legacy] of Object.entries(legacyPropNames())) {
    const declared = new Set(Object.keys(c.props[group]));
    const lost = [...legacy].filter(n => !declared.has(n)).sort();
    assert.deepEqual(lost, [], `${group}: the contract no longer declares these legacy names`);
  }
});

test('emotes name statuses, never frame indices (I-1)', () => {
  const c = loadContract();
  assert.deepEqual(c.emotes.icons.statuses,
    ['work', 'task_running', 'task_done', 'chat_npc', 'rest', 'error']);
  assert.equal(JSON.stringify(c).includes('byStatus'), false);
});

test('character geometry is 16x32 with four directions of six frames', () => {
  const c = loadContract();
  assert.equal(c.characters.frameWidth, 16);
  assert.equal(c.characters.frameHeight, 32);
  assert.equal(c.characters.anims.walk.framesPerDirection, 6);
  assert.equal(c.characters.anims.walk.directions, 4);
});

test('allNames() is unique and covers every class', () => {
  const names = loadContract().allNames();
  assert.equal(new Set(names).size, names.length, 'duplicate name in contract');
  assert.ok(names.includes('grass'));           // ground
  assert.ok(names.includes('office_building')); // district prop
  assert.ok(names.includes('bookshelf_a'));     // interior prop
  assert.ok(names.includes('coffee_steam'));    // animated
});

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

test('prop names reconcile with DISTRICT_IMAGES and INTERIOR_IMAGES', () => {
  const c = loadContract();
  for (const [group, legacy] of Object.entries(legacyPropNames())) {
    assert.deepEqual(Object.keys(c.props[group]).sort(), [...legacy].sort(), group);
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

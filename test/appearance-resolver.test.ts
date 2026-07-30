import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveAppearance, fallbackTextureKey, HUMAN_VARIANT_IDS } from '../packages/client/src/game/agents/AppearanceResolver.ts';
import { appearanceHash, appearanceRecord } from '../packages/shared/src/appearance/derive.mjs';

test('the resolver agrees with the baker on the hash', () => {
  const r = resolveAppearance('aisha_khan', 'female');
  assert.equal(r.hash, appearanceHash(appearanceRecord('aisha_khan', 'female')));
});

test('the texture key is derived from the hash', () => {
  const r = resolveAppearance('aisha_khan', 'female');
  assert.equal(r.textureKey, `agent-${r.hash}`);
  assert.equal(r.url, `assets/baked/${r.hash}.png`);
});

test('resolution is deterministic and pure', () => {
  assert.deepEqual(resolveAppearance('x', 'male'), resolveAppearance('x', 'male'));
});

test('the fallback is always a human variant (I-13)', () => {
  for (let i = 0; i < 2000; i++) {
    const key = fallbackTextureKey(`agent_${i}`);
    assert.match(key, /^char-premade-\d\d$/, key);
  }
});

test('no animal texture key can ever be produced (I-13)', () => {
  for (let i = 0; i < 2000; i++) {
    const key = fallbackTextureKey(`agent_${i}`);
    for (const animal of ['animal-cow', 'animal-pig', 'animal-dog', 'animal-chicken'])
      assert.notEqual(key, animal);
  }
});

test('the fallback pool is exactly the twelve human variants', () => {
  assert.equal(HUMAN_VARIANT_IDS.length, 12);
  assert.ok(HUMAN_VARIANT_IDS.every(id => id >= 0 && id < 12));
});

test('the fallback spreads across the pool rather than collapsing', () => {
  const seen = new Set<string>();
  for (let i = 0; i < 500; i++) seen.add(fallbackTextureKey(`agent_${i}`));
  assert.ok(seen.size >= 10, `only ${seen.size} distinct fallbacks`);
});

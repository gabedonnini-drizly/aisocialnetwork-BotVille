import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveAppearance, fallbackTextureKey, HUMAN_VARIANT_IDS, resolvedAnimDef } from '../packages/client/src/game/agents/AppearanceResolver.ts';
import { appearanceHash, appearanceRecord } from '../packages/shared/src/appearance/derive.mjs';
import { AVATAR_VARIANTS, DIRECTION_ORDER, animKey, animStartFrame, sitFrames, sleepFrames } from '../packages/client/src/game/assetManifest.ts';

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

// ── resolvedAnimDef (review Finding 1 fix: animations must target the
// texture actually on screen, not the legacy avatarVariant) ─────────────────

test('resolvedAnimDef carries the requested texture key', () => {
  const v = resolvedAnimDef('agent-deadbeef');
  assert.equal(v.textureKey, 'agent-deadbeef');
});

test('resolvedAnimDef produces anim keys namespaced to that texture, not to any human premade', () => {
  for (const dir of DIRECTION_ORDER) {
    assert.equal(animKey(resolvedAnimDef('agent-deadbeef'), 'idle', dir), `agent-deadbeef-idle-${dir}`);
    assert.equal(animKey(resolvedAnimDef('agent-deadbeef'), 'walk', dir), `agent-deadbeef-walk-${dir}`);
  }
  assert.equal(animKey(resolvedAnimDef('agent-deadbeef'), 'sit-right'), 'agent-deadbeef-sit-right');
  assert.equal(animKey(resolvedAnimDef('agent-deadbeef'), 'sit-left'), 'agent-deadbeef-sit-left');
  assert.equal(animKey(resolvedAnimDef('agent-deadbeef'), 'sleep'), 'agent-deadbeef-sleep');
});

test('two different resolved texture keys never collide on an anim key', () => {
  const a = resolvedAnimDef('agent-aaaa0000');
  const b = resolvedAnimDef('agent-bbbb1111');
  for (const dir of DIRECTION_ORDER) {
    assert.notEqual(animKey(a, 'idle', dir), animKey(b, 'idle', dir));
    assert.notEqual(animKey(a, 'walk', dir), animKey(b, 'walk', dir));
  }
});

test('resolvedAnimDef always has sit/sleep rows (I-13: the resolved path is always human)', () => {
  const v = resolvedAnimDef('agent-deadbeef');
  assert.notEqual(v.rows.sit, undefined);
  assert.notEqual(v.rows.sleep, undefined);
});

test('resolvedAnimDef reproduces the SAME frame-index math as a real human premade — a baked sheet shares the exact composited layout (Task 27), so no new layout table is needed', () => {
  const human = AVATAR_VARIANTS[HUMAN_VARIANT_IDS[0]];
  const v = resolvedAnimDef('agent-deadbeef');
  for (const dir of DIRECTION_ORDER) {
    assert.equal(animStartFrame(v, 'idle', dir), animStartFrame(human, 'idle', dir));
    assert.equal(animStartFrame(v, 'walk', dir), animStartFrame(human, 'walk', dir));
  }
  assert.deepEqual(sitFrames(v, 'right'), sitFrames(human, 'right'));
  assert.deepEqual(sitFrames(v, 'left'), sitFrames(human, 'left'));
  assert.deepEqual(sleepFrames(v), sleepFrames(human));
});

test('resolvedAnimDef on a fallback human textureKey produces the SAME anim keys the fallback premade already has registered — no double registration needed', () => {
  const fallback = fallbackTextureKey('some_agent');
  const v = resolvedAnimDef(fallback);
  const real = AVATAR_VARIANTS.find(av => av.textureKey === fallback);
  assert.ok(real, `no AVATAR_VARIANTS entry for ${fallback}`);
  for (const dir of DIRECTION_ORDER) {
    assert.equal(animKey(v, 'idle', dir), animKey(real!, 'idle', dir));
    assert.equal(animStartFrame(v, 'idle', dir), animStartFrame(real!, 'idle', dir));
  }
});

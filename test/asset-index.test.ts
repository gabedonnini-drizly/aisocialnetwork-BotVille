import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DISTRICT_PROPS, INTERIOR_PROPS, EMOTE_FRAMES } from '../packages/client/src/game/assets.generated.ts';
// A .ts test importing an .mjs library is the allowed direction (Task 1).
import { loadContract } from '../scripts/lib/assetContract.mjs';

test('the generated index carries every prop the contract declares', () => {
  // Set equality against the contract, not a transcribed count (Global
  // Constraints): the claim is "these two artifacts agree", by name.
  const c = loadContract();
  assert.deepEqual([...DISTRICT_PROPS].sort(), Object.keys(c.props.district).sort());
  assert.deepEqual([...INTERIOR_PROPS].sort(), Object.keys(c.props.interior).sort());
});

test('emote frame indices come from the adapter, not from code (I-1)', () => {
  assert.deepEqual(Object.keys(EMOTE_FRAMES).sort(),
    ['chat_npc', 'error', 'rest', 'task_done', 'task_running', 'work']);
  for (const pair of Object.values(EMOTE_FRAMES)) assert.equal(pair.length, 2);
});

test('no source file under packages/client hardcodes an emote frame index', async () => {
  const { readFileSync } = await import('node:fs');
  const manifest = readFileSync('packages/client/src/game/assetManifest.ts', 'utf8');
  assert.equal(/byStatus\s*:\s*\{[^}]*\d+\s*,\s*\d+/.test(manifest), false,
    'assetManifest still hardcodes byStatus frame pairs');
});

test('the committed asset index was generated from a real pack, not the fixture', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync('packages/client/src/game/assets.generated.ts', 'utf8');
  const pack = src.match(/from pack "([^"]+)"/)?.[1];
  assert.ok(pack, 'the generated header lost its pack marker');
  // The fixture pack is correct for a clean checkout and for CI. It is NOT
  // correct for anything that ships pixels — Task 39 re-bakes with limezu and
  // this assertion is what makes forgetting that a test failure.
  assert.equal(pack, process.env.BOTVILLE_PACK ?? 'fixture',
    `assets.generated.ts was baked from "${pack}" — re-run npm run bake:world with the pack you intend to ship`);
});

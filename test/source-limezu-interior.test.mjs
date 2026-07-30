import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadContract } from '../scripts/lib/assetContract.mjs';

const src = JSON.parse(readFileSync('sources/limezu.json', 'utf8'));
const c = loadContract();

test('every interior prop resolves', () => {
  const missing = Object.keys(c.props.interior).filter(n => !src.rects[n]);
  assert.deepEqual(missing, []);
  assert.ok(Object.keys(c.props.interior).length > 0, 'contract declares no interior props');
});

test('chair_red_r keeps build-interiors.mjs region 81,224 14x32', () => {
  const r = src.rects.chair_red_r;
  assert.equal(r.file, 'bedroom');
  assert.deepEqual([r.x, r.y, r.w, r.h], [81, 224, 14, 32]);
  assert.equal(r.trim, true);
});

test('counter_wide keeps region 192,268 52x22 from the kitchen sheet', () => {
  const r = src.rects.counter_wide;
  assert.equal(r.file, 'kitchen');
  assert.deepEqual([r.x, r.y, r.w, r.h], [192, 268, 52, 22]);
});

test('every animated object in the contract resolves', () => {
  const missing = Object.keys(c.animatedObjects).filter(n => !src.rects[n]);
  assert.deepEqual(missing, []);
});

test('emote frame indices live in the adapter, not the contract (I-1)', () => {
  assert.deepEqual(Object.keys(src.emoteFrames).sort(), [...c.emotes.icons.statuses].sort());
  for (const [status, pair] of Object.entries(src.emoteFrames)) {
    assert.equal(pair.length, 2, `${status} needs a two-frame pulse`);
    assert.ok(Number.isInteger(pair[0]) && Number.isInteger(pair[1]));
  }
});

test('emoteFrames matches the verified assetManifest byStatus layout', () => {
  assert.deepEqual(src.emoteFrames, {
    work: [44, 45], task_running: [40, 41], task_done: [64, 65],
    chat_npc: [66, 67], rest: [56, 57], error: [50, 51],
  });
});

test('contract.allNames() is fully covered by the adapter (I-2 precondition)', () => {
  const unresolved = c.allNames().filter(n => !src.rects[n]);
  assert.deepEqual(unresolved, []);
});

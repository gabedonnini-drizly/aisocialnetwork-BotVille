import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planSync } from '../packages/client/src/game/districtPresence.ts';

const base = {
  districtId: 'district',
  lastLoc: new Map(),
  hasDoorFor: () => false,
  isAsleep: () => false,
  isLeaving: () => false,
  resolveDistrict: loc => (loc === 'district' ? 'district' : undefined),
};

/**
 * `drawnIds` is read TWICE — once per sprite to decide its fate, once as a set
 * to know who is already drawn. A single-use iterator (`map.keys()`, the most
 * natural thing to pass from the scene) would be empty by the second read, so
 * every drawn agent would ALSO be planned as a new spawn: a duplicate sprite
 * per agent per 15-second tick, growing without bound.
 *
 * Every other test in the suite passes an array, which cannot see this. This
 * one passes a generator on purpose.
 */
test('drawnIds may be a single-use iterator — it is consumed once, not twice', () => {
  function* ids() { yield 'drawn-already'; }
  const plan = planSync({
    ...base,
    fullList: [{ id: 'drawn-already', location: 'district' }, { id: 'newcomer', location: 'district' }],
    drawnIds: ids(),
  });

  assert.deepEqual(plan.drawn.get('drawn-already'), { kind: 'stay', cancelLeaving: false });
  assert.equal(plan.spawn.has('drawn-already'), false,
    'an agent that already has a sprite was planned a second one — drawnIds was exhausted by the first pass');
  assert.deepEqual([...plan.spawn.keys()], ['newcomer']);
});

test('...and the same call with an array agrees, so the guard is about the iterator', () => {
  const withArray = planSync({
    ...base,
    fullList: [{ id: 'drawn-already', location: 'district' }, { id: 'newcomer', location: 'district' }],
    drawnIds: ['drawn-already'],
  });
  assert.deepEqual([...withArray.spawn.keys()], ['newcomer']);
});

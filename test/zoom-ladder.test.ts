import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ZOOM_LADDER, CAMERA, nextZoom, snapZoom } from '../packages/client/src/game/config.ts';

test('the ladder is the spec-pinned design constant', () => {
  assert.deepEqual([...ZOOM_LADDER], [0.5, 1, 2, 3, 4]);
});

test('the initial zoom is on the ladder and integral', () => {
  assert.equal(CAMERA.initialZoom, 2);
  assert.ok(ZOOM_LADDER.includes(CAMERA.initialZoom));
});

test('the range is the ladder ends', () => {
  assert.equal(CAMERA.minZoom, ZOOM_LADDER[0]);
  assert.equal(CAMERA.maxZoom, ZOOM_LADDER[ZOOM_LADDER.length - 1]);
});

test('zooming moves exactly one rung', () => {
  assert.equal(nextZoom(1, 1), 2);
  assert.equal(nextZoom(2, 1), 3);
  assert.equal(nextZoom(2, -1), 1);
  assert.equal(nextZoom(0.5, -1), 0.5, 'clamped at the bottom');
  assert.equal(nextZoom(4, 1), 4, 'clamped at the top');
});

test('an off-ladder zoom snaps to the nearest rung before stepping', () => {
  assert.equal(snapZoom(1.8), 2);
  assert.equal(snapZoom(0.7), 0.5);
  assert.equal(snapZoom(3.4), 3);
  assert.equal(nextZoom(1.8, 1), 3, 'snap to 2, then one rung up');
});

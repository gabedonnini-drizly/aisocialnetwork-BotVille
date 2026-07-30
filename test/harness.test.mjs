import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCanvas, encodePng } from '../scripts/png-lib.mjs';

test('the runner picks up .mjs tests and png-lib is importable', () => {
  const cv = createCanvas(2, 2);
  cv.set(0, 0, [255, 0, 0, 255]);
  const png = encodePng(cv);
  assert.equal(png.subarray(1, 4).toString('ascii'), 'PNG');
});

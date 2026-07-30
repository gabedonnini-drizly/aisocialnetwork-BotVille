import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCanvas } from '../scripts/png-lib.mjs';
import { asSource } from '../scripts/lib/spriteReader.mjs';
import { ROWS, rowHasCoverage, rowCoverage } from '../scripts/lib/rowCoverage.mjs';

function sheetWithArtInRows(rows, frameHeight = 32, width = 16, rowCount = 6) {
  const cv = createCanvas(width, frameHeight * rowCount);
  for (const r of rows) cv.set(0, r * frameHeight + 1, [1, 2, 3, 255]);
  return asSource(cv);
}

test('a row with an opaque pixel has coverage', () => {
  const img = sheetWithArtInRows([ROWS.sleep]);
  assert.equal(rowHasCoverage(img, ROWS.sleep), true);
});

test('a row with no opaque pixel has no coverage', () => {
  const img = sheetWithArtInRows([ROWS.sleep]);
  assert.equal(rowHasCoverage(img, ROWS.idle), false);
});

test('a row past the bottom of a short sheet reads as no coverage, not a throw', () => {
  const img = sheetWithArtInRows([ROWS.idle], 32, 16, 2); // only rows 0-1 exist
  assert.doesNotThrow(() => rowHasCoverage(img, ROWS.sitLeft));
  assert.equal(rowHasCoverage(img, ROWS.sitLeft), false);
});

test('rowCoverage reports every requested row', () => {
  const img = sheetWithArtInRows([ROWS.sitRight, ROWS.sitLeft]);
  assert.deepEqual(rowCoverage(img, [ROWS.sleep, ROWS.sitRight, ROWS.sitLeft]),
    { [ROWS.sleep]: false, [ROWS.sitRight]: true, [ROWS.sitLeft]: true });
});

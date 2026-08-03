import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { captureDistrictRender } from './helpers/districtRender.mjs';

/**
 * The bracketing check for Plan 03 Task 1 (Planning-mode QA: "the same capture
 * must differ ONLY in the ways this plan intends"). The baseline was captured
 * from the pre-refactor scene at a882a79; every later change to the outdoor
 * scene must either leave it identical or explain every line that moved.
 *
 * THE COMMITTED DOCUMENT IS NOT THE ORIGINAL BYTES. It has been re-baselined
 * twice, both times deliberately, and both diffs are recorded field by field
 * in test/helpers/districtRender.mjs's PROVENANCE block — read it before
 * treating "the golden file matches" as "nothing has changed since capture".
 * That file also lists what the capture cannot see, including the parts of
 * DistrictScene.create it TRANSCRIBES rather than calls.
 *
 * Regenerate deliberately, never to clear a red: npm run golden:district
 */
const BASELINE = 'test/golden/district-render.json';

test('the outdoor scene still renders what the baseline recorded', () => {
  const expected = JSON.parse(readFileSync(BASELINE, 'utf8'));
  const actual = captureDistrictRender();
  // Field by field first: a deepEqual on the whole document reports the
  // difference as two 400-line dumps, which is how a real diff gets skimmed.
  for (const key of Object.keys(expected)) {
    assert.deepEqual(actual[key], expected[key], `${BASELINE}: '${key}' has moved`);
  }
  assert.deepEqual(Object.keys(actual).sort(), Object.keys(expected).sort());
});

test('the capture is not empty — a baseline of nothing passes for the wrong reason', () => {
  const c = captureDistrictRender();
  assert.ok(c.objects.buildings.length > 0, 'no buildings captured');
  assert.ok(c.objects.doors.length > 0, 'no doors captured');
  assert.ok(c.objects.spawns.length > 0, 'no spawn points captured');
  assert.ok(c.objects.penSpots.length > 0, 'no farm pen spots captured');
  assert.ok(c.walkability.blockedTiles > 0, 'nothing blocks the walkability grid');
  assert.ok(c.paths.every(p => p.steps > 0), 'a door is unreachable from spawn point 0');
  assert.ok(c.tick.present.length > 0, 'the fixed tick draws nobody');
  assert.ok(Object.keys(c.tick.spawn).length > 0, 'the fixed tick spawns nobody');
});

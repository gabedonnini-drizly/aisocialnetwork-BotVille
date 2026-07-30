import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadContract } from '../scripts/lib/assetContract.mjs';

const src = JSON.parse(readFileSync('sources/limezu.json', 'utf8'));
const c = loadContract();

test('every district prop resolves to a rect or a generator', () => {
  // No count assertion: Task 4 already reconciles the contract against the
  // snapshot of DISTRICT_IMAGES. Here the only claim is total coverage.
  const missing = Object.keys(c.props.district).filter(n => !src.rects[n]);
  assert.deepEqual(missing, []);
  assert.ok(Object.keys(c.props.district).length > 0, 'contract declares no district props');
});

test('whole-file props carry a file alias and no x/y/w/h', () => {
  const r = src.rects.office_building;
  assert.ok(src.files[r.file]);
  assert.equal(r.x, undefined);
  assert.equal(r.w, undefined);
});

test('villa_building keeps build-district.mjs region 152,216 148x232', () => {
  // pin is Task 9/10 tooling metadata (npm run pin), not part of the
  // geometry this test asserts — strip it before comparing.
  const { pin, ...rest } = src.rects.villa_building;
  assert.deepEqual(rest, { file: 'villas', x: 152, y: 216, w: 148, h: 232, trim: true });
});

test('library_building is generated, not cropped — the pack has no book shop', () => {
  assert.equal(src.rects.library_building.generated, 'bookSign');
  assert.ok(src.files[src.rects.library_building.file], 'generator still needs a base file');
});

test('every rect file alias is declared', () => {
  for (const [name, r] of Object.entries(src.rects))
    assert.ok(src.files[r.file], `${name} names unknown alias ${r.file}`);
});

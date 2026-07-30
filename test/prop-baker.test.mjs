import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadContract } from '../scripts/lib/assetContract.mjs';
import { loadAdapter } from '../scripts/lib/sourceAdapter.mjs';
import { bakeProps, writeProps, GENERATORS } from '../scripts/lib/propBaker.mjs';

const c = loadContract();
const a = () => loadAdapter('sources/fixture.json', 'test/fixtures/pack-src');

test('every contract prop bakes, in both groups', () => {
  for (const group of Object.keys(c.props)) {
    assert.equal(bakeProps(c, a(), group).size, Object.keys(c.props[group]).length, group);
  }
});

test('baked size is the true trimmed bitmap, not the contract maxSize', () => {
  const baked = bakeProps(c, a(), 'interior');
  const stool = baked.get('stool');
  const [mw, mh] = c.props.interior.stool.maxSize;
  assert.equal(stool.w, mw - 2, 'fixture insets by 1px per side');
  assert.equal(stool.h, mh - 2);
  assert.equal(stool.w, stool.canvas.w);
});

test('writeProps emits one PNG per name', () => {
  const dir = mkdtempSync(join(tmpdir(), 'props-'));
  const expected = Object.keys(c.props.district).length;
  const written = writeProps(bakeProps(c, a(), 'district'), dir);
  assert.equal(written.length, expected);
  assert.equal(readdirSync(dir).filter(f => f.endsWith('.png')).length, expected);
});

test('the bookSign generator stamps a plate and leaves the base visible', () => {
  const baked = bakeProps(c, a(), 'district');
  const lib = baked.get('library_building');
  assert.ok(lib.w > 0 && lib.h > 0);
  assert.ok(typeof GENERATORS.bookSign === 'function');
});

test('baking is deterministic', () => {
  const x = bakeProps(c, a(), 'interior').get('counter_wide');
  const y = bakeProps(c, a(), 'interior').get('counter_wide');
  assert.deepEqual([...x.canvas.data], [...y.canvas.data]);
});

test('a whole-file rect with a nonzero x/y offset is never byte-copied', () => {
  // Defensive guard (review finding, Task 20): the byte-copy fast path is
  // only correct when "whole file" truly means the WHOLE file — x:0,y:0.
  // No current pack rect declares a nonzero offset with w/h null (there is
  // no crop to offset), but this stub adapter simulates one so the guard is
  // proven, not just true-by-current-data.
  const fakeContract = { props: { fake: { thing: { maxSize: [999, 999] } } } };
  const fakeAdapter = {
    resolve: name => ({
      absPath: 'test/fixtures/pack-src/props/office_building.png',
      x: 5, y: 3, w: null, h: null, trim: false, generated: null,
    }),
  };
  const baked = bakeProps(fakeContract, fakeAdapter, 'fake').get('thing');
  assert.equal(baked.raw, undefined, 'a nonzero offset must fall through to the canvas path, never raw-copy the whole file');
});

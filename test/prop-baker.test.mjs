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

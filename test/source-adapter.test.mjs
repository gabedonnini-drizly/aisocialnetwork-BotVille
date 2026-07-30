import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { loadContract } from '../scripts/lib/assetContract.mjs';
import { loadAdapter } from '../scripts/lib/sourceAdapter.mjs';

const fixture = () => loadAdapter('sources/fixture.json', 'test/fixtures/pack-src');

test('the fixture adapter declares itself', () => {
  const a = fixture();
  assert.equal(a.pack, 'fixture');
  assert.equal(a.capabilities.characterLayers, true);
});

test('resolve() returns an absolute path that exists', () => {
  const r = fixture().resolve('grass');
  assert.ok(r.absPath.endsWith('.png'));
  assert.ok(existsSync(r.absPath), `${r.absPath} missing — run npm run fixture`);
});

test('a rect with no w/h means the whole file', () => {
  const r = fixture().resolve('office_building');
  assert.equal(r.x, 0);
  assert.equal(r.y, 0);
  assert.equal(r.w, null);
  assert.equal(r.h, null);
});

test('unresolved() reports names the pack cannot supply', () => {
  const a = fixture();
  assert.deepEqual(a.unresolved(['grass', 'definitely_not_a_real_prop']),
    ['definitely_not_a_real_prop']);
});

test('the fixture pack covers every contract name (I-2 on the fixture)', () => {
  assert.deepEqual(fixture().unresolved(loadContract().allNames()), []);
});

test('resolve() throws rather than returning a guess', () => {
  assert.throws(() => fixture().resolve('nope'), /unresolved name: nope/);
});

test('the limezu adapter loads and covers every contract name', () => {
  const a = loadAdapter('sources/limezu.json', 'assets-src');
  assert.equal(a.pack, 'limezu');
  assert.deepEqual(a.unresolved(loadContract().allNames()), []);
});

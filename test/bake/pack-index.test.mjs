import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { indexPack, cellSignature, scopeToReferenced } from '../../scripts/index-pack.mjs';
import { decodePng } from '../../scripts/png-lib.mjs';
import { loadContract } from '../../scripts/lib/assetContract.mjs';

const c = loadContract();
const run = () => indexPack({
  srcRoot: 'test/fixtures/pack-src',
  tileSize: c.tileSize,
  out: mkdtempSync(join(tmpdir(), 'pack-index-')),
});

test('every PNG in the pack is inventoried', () => {
  const { sheets } = run();
  assert.ok(Object.keys(sheets).length > 0);
  for (const [path, s] of Object.entries(sheets)) {
    assert.match(path, /\.png$/);
    assert.ok(s.w > 0 && s.h > 0, path);
    assert.match(s.sha256, /^[0-9a-f]{64}$/, path);
  }
});

test('sheet paths are relative and forward-slashed, so the manifest is portable', () => {
  for (const path of Object.keys(run().sheets)) {
    assert.equal(path.startsWith('/'), false, path);
    assert.equal(path.includes('\\'), false, path);
  }
});

test('a fully transparent cell is not a candidate', () => {
  // The fixture insets every block by 1px, so the corner cell of a big sprite
  // has content but a 1px-wide slice of the margin does not.
  const img = decodePng('test/fixtures/pack-src/tiles/grass.png');
  assert.equal(cellSignature(img, 0, 0, 1, 1), null, 'transparent margin counted as a candidate');
  assert.ok(cellSignature(img, 0, 0, 16, 16), 'the tile itself should be a candidate');
});

test('a candidate reports its trimmed bounds, not the cell it sits in', () => {
  const img = decodePng('test/fixtures/pack-src/tiles/grass.png');
  const cell = cellSignature(img, 0, 0, 16, 16);
  // 1px transparent margin on every side
  assert.deepEqual(cell.trimmed, { x: 1, y: 1, w: 14, h: 14 });
  assert.equal(cell.opaque, 14 * 14);
});

test('the palette is the dominant colours, most-used first', () => {
  const img = decodePng('test/fixtures/pack-src/tiles/grass.png');
  const { palette } = cellSignature(img, 0, 0, 16, 16);
  assert.ok(palette.length >= 1 && palette.length <= 4);
  for (const c of palette) assert.match(c, /^#[0-9a-f]{6}$/);
});

test('the crop hash is stable and content-addressed', () => {
  const img = decodePng('test/fixtures/pack-src/tiles/grass.png');
  const a = cellSignature(img, 0, 0, 16, 16);
  const b = cellSignature(img, 0, 0, 16, 16);
  assert.equal(a.sha256, b.sha256);
  // A different tile must hash differently — colours are derived from the name.
  const other = cellSignature(decodePng('test/fixtures/pack-src/tiles/dirt.png'), 0, 0, 16, 16);
  assert.notEqual(a.sha256, other.sha256);
});

test('the index reports candidates as well as sheets', () => {
  const { cells } = run();
  const total = Object.values(cells).reduce((n, list) => n + list.length, 0);
  assert.ok(total >= Object.keys(run().sheets).length,
    'every non-empty sheet should yield at least one candidate');
});

// The COMMITTED sheets manifest (sources/<pack>.sheets.json) is scoped to
// only the sheets a pack manifest's `files` block names — an unscoped
// full-pack manifest measured 9.7MB / 41,488 rows against the real four
// packs and was rejected (see index-pack.mjs's header comment on
// scopeToReferenced). This is the regression tripwire for that filter:
// derived from the fixture pack's own real sheet paths, not hand-typed
// strings, so a real path-matching bug (not just a toy example) would fail
// it too.
test('scopeToReferenced keeps exactly the manifest-referenced sheets, nothing else', () => {
  const { sheets } = run();
  const allPaths = Object.keys(sheets);
  assert.ok(allPaths.length >= 2, 'need at least two sheets for scoping to actually exclude one');

  const referencedPaths = allPaths.slice(0, Math.ceil(allPaths.length / 2));
  const manifest = { files: Object.fromEntries(referencedPaths.map((p, i) => [`alias${i}`, p])) };
  const scoped = scopeToReferenced(sheets, manifest);

  const referencedSet = new Set(referencedPaths);
  // manifest keys are a subset of the adapter-referenced sheet set
  for (const key of Object.keys(scoped)) assert.ok(referencedSet.has(key), `${key} should not be scoped in`);
  // count matches exactly — every referenced path exists in sheets here
  assert.equal(Object.keys(scoped).length, referencedPaths.length);
  // a pack file nothing references does NOT appear
  const unreferenced = allPaths.find(p => !referencedSet.has(p));
  assert.ok(unreferenced, 'fixture pack should have at least one sheet nothing references, to test against');
  assert.equal(unreferenced in scoped, false, `${unreferenced} leaked through unscoped`);
});

test('scopeToReferenced passes every sheet through when there is no manifest yet', () => {
  // A brand-new pack has no sources/<pack>.json to scope against — nothing
  // to filter, so indexing it for the first time must not silently drop
  // every sheet.
  const sheets = { 'a.png': { w: 1, h: 1, sha256: '0'.repeat(64) } };
  assert.deepEqual(scopeToReferenced(sheets, null), sheets);
});

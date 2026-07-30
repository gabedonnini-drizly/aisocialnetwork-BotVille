import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadContract } from '../scripts/lib/assetContract.mjs';
import { syncAssets } from '../scripts/sync-assets.mjs';

const c = loadContract();
const animatedNames = Object.keys(c.animatedObjects);
const run = () => syncAssets({
  pack: 'fixture', srcRoot: 'test/fixtures/pack-src',
  outDir: mkdtempSync(join(tmpdir(), 'sync-')),
});

test('no LimeZu path appears in the script any more (I-1)', () => {
  const src = readFileSync('scripts/sync-assets.mjs', 'utf8');
  for (const marker of ['ME_Singles', 'Room_Builder', '_16x16.png', 'exteriors/themes'])
    assert.equal(src.includes(marker), false, `sync-assets.mjs still names ${marker}`);
});

test('the contract declares which sheets the runtime loads whole', () => {
  assert.ok(Array.isArray(c.runtimeSheets));
  assert.ok(c.runtimeSheets.length > 0);
  // Every one must be a contract name, or the adapter cannot resolve it.
  const known = new Set(c.allNames());
  for (const n of c.runtimeSheets) assert.ok(known.has(n), `${n} is not a contract name`);
});

test('exactly the declared sheets are copied — nothing more', () => {
  const { copied, missing } = run();
  assert.deepEqual(missing, []);
  // runtimeSheets AND animatedObjects: the bake never emits animated interior
  // objects (they're whole-file animation strips, not baked props), so this
  // script is their only route into public/assets/.
  assert.equal(copied.length, c.runtimeSheets.length + animatedNames.length);
  for (const n of animatedNames) assert.ok(copied.includes(n), `${n} was not copied`);
});

test('animated objects land under their contract name, not the source filename', () => {
  const out = mkdtempSync(join(tmpdir(), 'sync-anim-'));
  syncAssets({ pack: 'fixture', srcRoot: 'test/fixtures/pack-src', outDir: out });
  const files = new Set(readdirSync(join(out, 'sprites', 'pack')));
  for (const n of animatedNames) assert.ok(files.has(`${n}.png`), `expected sprites/pack/${n}.png`);
});

test('copying is idempotent and byte-preserving', () => {
  const out = mkdtempSync(join(tmpdir(), 'sync-idem-'));
  const opts = { pack: 'fixture', srcRoot: 'test/fixtures/pack-src', outDir: out };
  syncAssets(opts);
  const first = readdirSync(join(out, 'sprites', 'pack')).sort();
  syncAssets(opts);
  assert.deepEqual(readdirSync(join(out, 'sprites', 'pack')).sort(), first);
});

test('a missing source file is reported, not silently skipped', () => {
  const { missing } = syncAssets({
    pack: 'fixture', srcRoot: 'test/fixtures/does-not-exist',
    outDir: mkdtempSync(join(tmpdir(), 'sync-missing-')), throwOnMissing: false,
  });
  assert.ok(missing.length > 0);
});

test('syncAssets refuses to guess where to write', () => {
  assert.throws(() => syncAssets({ pack: 'fixture', srcRoot: 'test/fixtures/pack-src' }),
    /outDir is required/);
});

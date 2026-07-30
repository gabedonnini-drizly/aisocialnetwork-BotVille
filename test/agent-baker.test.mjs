import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadContract } from '../scripts/lib/assetContract.mjs';
import { loadAdapter } from '../scripts/lib/sourceAdapter.mjs';
import { appearanceRecord, appearanceHash } from '../packages/shared/src/appearance/derive.mjs';
import { bake, bakedPath, portraitPath } from '../scripts/lib/agentBaker.mjs';

const ctx = () => ({
  contract: loadContract(),
  adapter: loadAdapter('sources/fixture.json', 'test/fixtures/pack-src'),
  outDir: mkdtempSync(join(tmpdir(), 'baked-')),
});
const rec = appearanceRecord('aisha_khan', 'female');

test('bake writes a sheet and a portrait named by the hash', async () => {
  const c = ctx();
  const r = await bake(c, rec);
  assert.equal(r.hash, appearanceHash(rec));
  assert.ok(existsSync(bakedPath(c.outDir, r.hash)));
  assert.ok(existsSync(portraitPath(c.outDir, r.hash)));
  assert.equal(r.written, true);
});

test('bake is idempotent — the second call writes nothing (I-6)', async () => {
  const c = ctx();
  const first = await bake(c, rec);
  const mtime = statSync(bakedPath(c.outDir, first.hash)).mtimeMs;
  const second = await bake(c, rec);
  assert.equal(second.written, false);
  assert.equal(statSync(bakedPath(c.outDir, second.hash)).mtimeMs, mtime);
});

test('concurrent bakes of the same hash produce one intact file', async () => {
  const c = ctx();
  const results = await Promise.all(Array.from({ length: 8 }, () => bake(c, rec)));
  const hash = results[0].hash;
  assert.equal(new Set(results.map(r => r.hash)).size, 1);
  const png = readFileSync(bakedPath(c.outDir, hash));
  assert.equal(png.subarray(1, 4).toString('ascii'), 'PNG');
  assert.deepEqual([...png.subarray(png.length - 8, png.length - 4)].map(n => String.fromCharCode(n)).join(''), 'IEND');
  assert.equal(readdirSync(c.outDir).filter(f => f.endsWith('.tmp')).length, 0, 'temp files left behind');
});

test('different records produce different hashes and different files', async () => {
  const c = ctx();
  const a = await bake(c, appearanceRecord('alpha', 'male'));
  const b = await bake(c, appearanceRecord('beta', 'female'));
  assert.notEqual(a.hash, b.hash);
  assert.notDeepEqual(readFileSync(bakedPath(c.outDir, a.hash)), readFileSync(bakedPath(c.outDir, b.hash)));
});

test('the same appearance from two different seeds bakes once', async () => {
  const c = ctx();
  // find two seeds that collide on the record
  let s1 = null, s2 = null;
  const seen = new Map();
  for (let i = 0; i < 20_000 && !s2; i++) {
    const h = appearanceHash(appearanceRecord(`a_${i}`, 'neutral'));
    if (seen.has(h)) { s1 = seen.get(h); s2 = `a_${i}`; } else seen.set(h, `a_${i}`);
  }
  assert.ok(s2, 'expected a collision within 20k seeds');
  const x = await bake(c, appearanceRecord(s1, 'neutral'));
  const y = await bake(c, appearanceRecord(s2, 'neutral'));
  assert.equal(x.hash, y.hash);
  assert.equal(y.written, false, 'content-addressing means one bake, not two');
});

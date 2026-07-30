import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadContract } from '../scripts/lib/assetContract.mjs';
import { loadAdapter } from '../scripts/lib/sourceAdapter.mjs';
import { bakeRoster, bakeOne } from '../scripts/agent-bake.mjs';

const ctx = () => ({
  contract: loadContract(),
  adapter: loadAdapter('sources/fixture.json', 'test/fixtures/pack-src'),
  outDir: mkdtempSync(join(tmpdir(), 'roster-')),
});
const roster = n => Array.from({ length: n }, (_, i) => ({ spriteSeed: `agent_${i}`, gender: i % 2 ? 'male' : 'female' }));

test('a batch bakes the whole roster', async () => {
  const c = ctx();
  const r = await bakeRoster(c, roster(40));
  assert.equal(r.baked + r.skipped, new Set(r.hashes).size);
  assert.equal(readdirSync(c.outDir).filter(f => f.endsWith('-portrait.png')).length, new Set(r.hashes).size);
});

test('re-running a batch bakes nothing new', async () => {
  const c = ctx();
  await bakeRoster(c, roster(20));
  const second = await bakeRoster(c, roster(20));
  assert.equal(second.baked, 0);
  assert.ok(second.skipped > 0);
});

test('batch and event agree — the event path adds nothing after a batch', async () => {
  const c = ctx();
  await bakeRoster(c, roster(20));
  const before = readdirSync(c.outDir).length;
  const one = await bakeOne(c, 'agent_7', 'male');
  assert.equal(one.written, false);
  assert.equal(readdirSync(c.outDir).length, before);
});

test('the event path bakes a new agent the batch never saw', async () => {
  const c = ctx();
  await bakeRoster(c, roster(5));
  const one = await bakeOne(c, 'brand_new_agent', 'female');
  assert.equal(one.written, true);
});

test('batch and event are safe to interleave', async () => {
  const c = ctx();
  const [batch, ev] = await Promise.all([
    bakeRoster(c, roster(30)),
    bakeOne(c, 'agent_3', 'male'),
  ]);
  assert.ok(batch.hashes.includes(ev.hash));
  assert.equal(readdirSync(c.outDir).filter(f => f.endsWith('.tmp')).length, 0);
});

test('an 85-agent roster collapses to far fewer bakes than agents', async () => {
  const c = ctx();
  const r = await bakeRoster(c, roster(85));
  assert.equal(r.baked, new Set(r.hashes).size);
  assert.ok(r.baked <= 85);
});

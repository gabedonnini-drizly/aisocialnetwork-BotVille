import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { worldBake } from '../../scripts/world-bake.mjs';
import { REPO_ROOT } from '../helpers/siblingRepo.mjs';

/**
 * G-C as an executable claim: a venue that no code mentions must bake into
 * a loadable scene. Nothing under packages/client knows the word "speakeasy".
 */
function bakeWithFixture() {
  const out = mkdtempSync(join(tmpdir(), 'fixture-venue-'));
  const r = worldBake({
    pack: 'fixture',
    srcRoot: 'test/fixtures/pack-src',
    outDir: out,
    generatedDir: mkdtempSync(join(tmpdir(), 'fixture-venue-gen-')),
    venuesDirs: [join(REPO_ROOT, 'venues'), join(REPO_ROOT, 'test/fixtures/venues')],
  });
  return { out, r };
}

test('a venue nobody wrote code for bakes into a tilemap', () => {
  const { out } = bakeWithFixture();
  assert.ok(existsSync(join(out, 'tilemaps/speakeasy.tmj')));
});

test('its tilemap has the layers the venue scene reads', () => {
  const { out } = bakeWithFixture();
  const m = JSON.parse(readFileSync(join(out, 'tilemaps/speakeasy.tmj'), 'utf8'));
  assert.deepEqual(m.layers.map(l => l.name),
    ['ground', 'furniture', 'seats', 'animated', 'doors', 'spawns', 'collision']);
  assert.equal(m.layers[2].objects.length, 3, 'three seats');
});

test('it joins the published vocabulary with no code change (G-C)', () => {
  const { out } = bakeWithFixture();
  const pub = JSON.parse(readFileSync(join(out, 'venues.json'), 'utf8'));
  const sp = pub.find(v => v.id === 'speakeasy');
  assert.deepEqual(sp, {
    id: 'speakeasy', label: 'Speakeasy', indoor: true, capacity: 3,
    archetype: 'speakeasy', roles: ['hangout'], affords: ['socialize', 'idle'],
    hours: [{ open: 18, close: 24 }, { open: 0, close: 2 }],
  });
});

test('it lands in the generated registry module', () => {
  const { r } = bakeWithFixture();
  const gen = readFileSync(join(r.generatedDir, 'venues.generated.ts'), 'utf8');
  assert.ok(gen.includes('"id": "speakeasy"'));
});

test('no source file mentions the fixture venue (G-C)', async () => {
  const { readdirSync } = await import('node:fs');
  const walk = d => readdirSync(d, { withFileTypes: true }).flatMap(e =>
    e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]);
  // Runtime AND tooling: if scripts/ had to learn the word, venues are not data.
  const hits = [...walk(join(REPO_ROOT, 'packages/client/src')), ...walk(join(REPO_ROOT, 'scripts'))]
    .filter(p => /\.(tsx?|mjs)$/.test(p) && !p.endsWith('.generated.ts'))
    .filter(p => readFileSync(p, 'utf8').includes('speakeasy'));
  assert.deepEqual(hits, [], 'G-C violated: code mentions the fixture venue');
});

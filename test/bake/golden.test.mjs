import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { worldBake } from '../../scripts/world-bake.mjs';
import { loadContract } from '../../scripts/lib/assetContract.mjs';
import { decodePng, createCanvas, encodePng } from '../../scripts/png-lib.mjs';
import { skipUnless } from '../helpers/skip.mjs';

const HAVE_ART = existsSync('assets-src');
const GATE = skipUnless(HAVE_ART, 'assets-src/ absent — run Task 3 to capture the baseline');
const UPDATE = process.env.UPDATE_GOLDEN === '1';

const golden = JSON.parse(readFileSync('test/golden/baseline.json', 'utf8'));
const shaBuf = buf => createHash('sha256').update(buf).digest('hex');
const sha = p => shaBuf(readFileSync(p));
const rename = p => Object.entries(golden.renames).reduce((s, [from, to]) => s.replace(from, to), p);

// "Generated" is decided by NAME, derived from the contract — never by path
// prefix. The baseline also hashes the raw sync-assets copies that live under
// the same directories, and those are bake INPUTS, not outputs.
const contract = loadContract();
const generatedNames = new Set([
  ...Object.keys(contract.groundAtlases).map(id => `tilesets/limezu/${id}.png`),
  ...Object.entries(contract.props).flatMap(([group, defs]) =>
    Object.keys(defs).map(n => `sprites/limezu/${group}/${n}.png`)),
]);
const isGenerated = p => generatedNames.has(p);

// Names of the atlas the given generated path is, or null for a prop file.
const atlasIdFor = rel => Object.keys(contract.groundAtlases).find(id => rel === `tilesets/limezu/${id}.png`) ?? null;

const readTmj = p => JSON.parse(readFileSync(p, 'utf8'));

/** The venues the legacy pipeline knew about — read, not listed. */
const legacyVenueIds = () =>
  readdirSync('test/golden/tmj').filter(f => f.endsWith('.tmj')).map(f => f.replace('.tmj', '')).sort();

let baked = null;
function bakeOnce() {
  if (!baked) {
    const out = mkdtempSync(join(tmpdir(), 'golden-out-'));
    const gen = mkdtempSync(join(tmpdir(), 'golden-gen-'));
    worldBake({ pack: 'limezu', srcRoot: 'assets-src', outDir: out, generatedDir: gen });
    baked = out;
  }
  return baked;
}

// ── Known, declared, shrink-only exceptions (2026-07-30 amendment) ────────
//
// Three of this plan's deliberate improvements change generated output on
// purpose (path rename, targetVenue, derived collision, doormats — see the
// plan doc's table). None of those touch pixels or tile data, so they need
// no entry here. What DOES touch pixels are two already-reviewed data fixes
// (Plan 1 Tasks 9 and 10) that correct bugs the legacy pipeline shipped —
// this list is the committed record of exactly those, and nothing else.
// The gate stays zero-tolerance for every name NOT in this file, and the
// file may only ever shrink (an entry leaves once nothing exercises it).
const knownDiffs = JSON.parse(readFileSync('test/golden/known-diffs.json', 'utf8'));
const knownDiffsMap = new Map(knownDiffs.map(d => [d.name, d]));
const usedKnownDiffs = new Set();

/**
 * The one decision the whole mechanism reduces to: is this name's byte
 * difference declared? `map`/`used` are passed in rather than closed over so
 * the synthetic test below can exercise this EXACT function against a
 * throwaway map, without marking a real known-diffs.json entry "used" as a
 * side effect (which would hide a real entry going stale).
 */
function classify(name, got, want, map, used) {
  if (got === want) return { status: 'match' };
  if (map.has(name)) { used.add(name); return { status: 'known', reason: map.get(name).reason }; }
  return { status: 'drift' };
}

// Ground truth for the two ATLAS-tile known-diffs (grassA/grassB): the
// legacy rect (build-district.mjs's hardcoded TERR col 3/row 5 and col
// 4/row 5) landed in a fully transparent 16x16 gap in the source sheet
// (verified directly: every pixel there has alpha exactly 0). atlasBuilder's
// blit — this repo's OWN png-lib canvas.blit, which the legacy script used
// too — skips every source pixel whose alpha is 0, so blitting an
// all-transparent rect onto a freshly zeroed canvas writes nothing at all.
// The legacy tile is therefore blank (0,0,0,0), not a copy of whatever
// stray bytes sit under that alpha in the source file — confirmed by
// reconstructing it exactly this way and matching the frozen baseline hash.
// If a future known-diff needs different reconstruction, add it here
// deliberately: an unlisted name (or one not marked 'blank') is never
// patched, so it fails closed rather than silently exempting more.
const LEGACY_ATLAS_TILE = { grassA: 'blank', grassB: 'blank' };

/** A faithful pixel-for-pixel copy of a decoded PNG into a mutable canvas. */
function toCanvas(decoded) {
  const cv = createCanvas(decoded.w, decoded.h);
  for (let y = 0; y < decoded.h; y++)
    for (let x = 0; x < decoded.w; x++)
      cv.set(x, y, decoded.px(x, y));
  return cv;
}

/**
 * Reconstructs what the legacy atlas PNG would hash to, by taking the
 * freshly baked atlas and patching exactly the declared, in-this-atlas
 * known-diff tiles back to their legacy content. If the result matches the
 * frozen baseline hash, the ONLY divergence in the whole file is confined to
 * those names — proven, not assumed. If it doesn't match, something else in
 * the atlas ALSO drifted, and the gate must still fail on that.
 */
function reconstructAtlasHash(bakedPath, atlasId, patchNames) {
  const T = contract.tileSize;
  const def = contract.groundAtlases[atlasId];
  const canvas = toCanvas(decodePng(bakedPath));
  for (const name of patchNames) {
    const i = def.tiles.indexOf(name);
    if (i < 0) continue; // not a tile of this atlas — nothing to patch here
    if (LEGACY_ATLAS_TILE[name] !== 'blank') continue; // no reconstruction recorded — fails closed below
    const tx = (i % def.columns) * T, ty = Math.floor(i / def.columns) * T;
    for (let y = 0; y < T; y++)
      for (let x = 0; x < T; x++)
        canvas.set(tx + x, ty + y, [0, 0, 0, 0]);
  }
  return shaBuf(encodePng(canvas));
}

const report = { images: [] };
function writeReport() {
  if (report.images.length) {
    writeFileSync('test/golden/report.json', JSON.stringify(report, null, 2) + '\n');
  }
}

// ── Tier 1: pixels are byte-exact ────────────────────────────────────────
test('every generated image is byte-identical to the legacy pipeline (except the declared, reviewed data fixes)', GATE, () => {
  const out = bakeOnce();
  let compared = 0;

  for (const [rel, want] of Object.entries(golden.images)) {
    if (!isGenerated(rel)) continue;              // raw sync-assets copies are not bake outputs
    const p = join(out, rename(rel));
    if (!existsSync(p)) { report.images.push({ path: rel, status: 'missing' }); continue; }
    compared++;
    const got = sha(p);
    if (got === want) continue;

    const atlasId = atlasIdFor(rel);
    if (atlasId) {
      // Shared file: only the DECLARED tiles in this atlas may explain a
      // whole-file mismatch, and only if patching exactly those reproduces
      // the frozen hash byte for byte.
      const candidates = contract.groundAtlases[atlasId].tiles.filter(n => knownDiffsMap.has(n));
      const fixed = candidates.length ? reconstructAtlasHash(p, atlasId, candidates) : null;
      if (fixed === want) {
        for (const n of candidates) usedKnownDiffs.add(n);
      } else {
        report.images.push({ path: rel, status: 'drift', want, got, note: 'whole-atlas mismatch not fully explained by known-diffs.json' });
      }
      continue;
    }

    const name = rel.split('/').pop().replace(/\.png$/, '');
    const outcome = classify(name, got, want, knownDiffsMap, usedKnownDiffs);
    if (outcome.status !== 'known') report.images.push({ path: rel, status: 'drift', want, got });
  }

  // The report is written BEFORE any assertion, and only when there is
  // something to explain — a clean or fully-declared run leaves no file
  // behind, matching "writes report.json on failure".
  writeReport();
  assert.ok(compared > 0, 'compared no images — the rename map or the baseline is wrong');
  assert.equal(compared, Object.keys(golden.images).filter(isGenerated).length,
    'some baseline images were not produced by the bake — see test/golden/report.json');
  assert.deepEqual(report.images, [],
    'pixels drifted with no declared reason — a rect in sources/limezu.json is wrong, or known-diffs.json needs an entry. See test/golden/report.json');

  const unused = knownDiffs.map(d => d.name).filter(n => !usedKnownDiffs.has(n));
  assert.deepEqual(unused, [],
    `known-diffs.json has entries nothing matched: ${unused.join(', ')} — the list may only ever shrink; remove entries no longer needed`);
});

// ── Tier 2: tile layers are byte-exact ───────────────────────────────────
//
// ...except where a ruled change makes the legacy pipeline incapable of
// reproducing the map at all. known-tmj-diffs.json is that list, and it works
// like known-diffs.json does for pixels: an entry is a DECLARED reason, not a
// mute. A declared venue still has to prove the part that did not change —
// its `preserves` object layers must be byte-identical — so "the district
// grew" cannot quietly become "the district moved".
const knownTmjDiffs = JSON.parse(readFileSync('test/golden/known-tmj-diffs.json', 'utf8'));
const tmjDiffFor = id => knownTmjDiffs.find(d => d.name === id) ?? null;
/**
 * Object PLACEMENTS — name and position, deliberately not size.
 *
 * "Nothing moved" is the claim a declared growth has to keep, and size is not
 * part of it: a sprite's baked width is a trim question, which Tier 1 already
 * covers pixel-by-pixel against known-diffs.json. Comparing sizes here would
 * fold an unrelated pre-existing divergence into this assertion —
 * `villa_building` bakes 12px narrower than the frozen legacy baseline (140
 * vs 152 at the same 80,432), because the current propBaker trims to the true
 * content bbox and build-district.mjs did not.
 */
const objectsOf = (m, name) => {
  const l = m.layers.find(x => x.name === name);
  return l ? l.objects.map(o => `${o.name}@${o.x},${o.y}`) : null;
};

test('every tile layer reproduces exactly', GATE, () => {
  const out = bakeOnce();
  const usedTmjDiffs = new Set();
  for (const id of legacyVenueIds()) {
    const now = readTmj(join(out, 'tilemaps', `${id}.tmj`));
    const was = readTmj(`test/golden/tmj/${id}.tmj`);
    assert.deepEqual(now.layers.map(l => l.name), was.layers.map(l => l.name), `${id}: layer set`);

    const declared = tmjDiffFor(id);
    if (declared) {
      usedTmjDiffs.add(id);
      // The half that must still hold: nothing MOVED. Every object layer the
      // entry claims to preserve is compared byte for byte against the
      // baseline, so a "growth" that shifted a building or a door fails here.
      for (const layerName of declared.preserves) {
        assert.deepEqual(objectsOf(now, layerName), objectsOf(was, layerName),
          `${id}/${layerName}: declared preserved in known-tmj-diffs.json, but it moved`);
      }
      // ...and growth is growth: the map may get bigger, never smaller.
      assert.ok(now.width >= was.width && now.height >= was.height,
        `${id}: declared as grown but is now ${now.width}x${now.height}, was ${was.width}x${was.height}`);

      // The claim the entry actually makes: inside the ORIGINAL region,
      // nothing moved — only procedural variant choice changed. Skipping tile
      // data entirely would make that claim unfalsifiable and would let a
      // moved road through forever (vRoad [22,24] -> [40,42] passes every
      // other assertion here). So compare the NONZERO MASK cell by cell over
      // the original rectangle: which tiles are road, which are ground, which
      // are pen is structure; WHICH grass it picked is the declared diff.
      for (const l of now.layers.filter(x => x.type === 'tilelayer')) {
        const w = was.layers.find(x => x.name === l.name);
        if (!w) continue;
        const moved = [];
        for (let y = 0; y < was.height; y++) {
          for (let x = 0; x < was.width; x++) {
            const a = l.data[y * now.width + x] !== 0;
            const b = w.data[y * was.width + x] !== 0;
            if (a !== b) moved.push(`${x},${y}`);
          }
        }
        assert.deepEqual(moved.slice(0, 8), [],
          `${id}/${l.name}: the layout MOVED inside the original ${was.width}x${was.height} region `
          + `(${moved.length} cells differ in occupancy, not just in variant) — a declared growth may `
          + 'repaint, never rearrange');
      }
      continue;
    }

    assert.deepEqual([now.width, now.height], [was.width, was.height], `${id}: size`);
    for (const l of now.layers.filter(l => l.type === 'tilelayer')) {
      const w = was.layers.find(x => x.name === l.name);
      assert.deepEqual(l.data, w.data,
        `${id}/${l.name}: tile data drifted — check the PRNG consumption order in cityGrid`);
    }
  }
  const unused = knownTmjDiffs.map(d => d.name).filter(n => !usedTmjDiffs.has(n));
  assert.deepEqual(unused, [],
    `known-tmj-diffs.json has entries nothing matched: ${unused.join(', ')} — the list may only ever shrink`);
});

// ── Bite-proof: the mechanism actually gates (synthetic, no art needed) ───
// Not gated behind GATE: this exercises `classify` directly (the same
// function Tier 1 calls) against a THROWAWAY map — never the real
// knownDiffsMap/usedKnownDiffs — so this can never mask a real entry going
// stale, and it always runs, needing no assets-src.
test('classify(): a declared name is tolerated, an undeclared one is not', () => {
  const fakeMap = new Map([['a_declared_prop', { reason: 'synthetic, for this test only' }]]);
  const fakeUsed = new Set();

  assert.equal(classify('a_declared_prop', 'aaa', 'bbb', fakeMap, fakeUsed).status, 'known',
    'a name present in known-diffs.json must be tolerated when its hash mismatches');
  assert.ok(fakeUsed.has('a_declared_prop'), 'a tolerated name must be recorded as used, for the shrink-only check');

  assert.equal(classify('an_undeclared_prop', 'aaa', 'bbb', fakeMap, fakeUsed).status, 'drift',
    'an undeclared name must NOT be tolerated — this is the zero-tolerance floor the gate stands on. ' +
    'If this assertion ever fails, the golden gate no longer bites.');

  assert.equal(classify('an_undeclared_prop', 'same', 'same', fakeMap, fakeUsed).status, 'match',
    'identical hashes never need the known-diffs list at all');
});

// ── Re-recording, deliberately ───────────────────────────────────────────
test('UPDATE_GOLDEN re-records the baseline', skipUnless(HAVE_ART && UPDATE, 'set UPDATE_GOLDEN=1 to re-record'), () => {
  console.warn('\n!! Re-recording the golden baseline. Review the diff before committing:');
  console.warn('!!   git diff test/golden/\n');
  execFileSync(process.execPath, ['scripts/capture-golden-baseline.mjs'], { stdio: 'inherit' });
});

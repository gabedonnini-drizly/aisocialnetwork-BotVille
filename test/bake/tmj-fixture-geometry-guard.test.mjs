import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { worldBake } from '../../scripts/world-bake.mjs';

/**
 * Task 35's artifact policy (I-12): the COMMITTED .tmj maps under
 * packages/client/public/assets/tilemaps/ stay FIXTURE geometry, always. A
 * fresh clone must render a complete, art-free city with zero setup.
 *
 * Real-art geometry only ever exists locally or on a self-hosted machine —
 * baked with `bake:world -- limezu assets-src` before running/serving the
 * app, or by a Docker build with PACK=limezu (see DEPLOY.md) — and it must
 * never be committed.
 *
 * This is the structural guard: it re-bakes the fixture pack into a temp
 * dir and diffs the result, byte for byte, against what is checked in. A
 * `bake:world -- limezu assets-src` run followed by an accidental `git add`
 * of the tilemaps directory fails this test loudly instead of silently
 * shipping licensed geometry to every clone.
 */

const COMMITTED_DIR = join(process.cwd(), 'packages/client/public/assets/tilemaps');

function fixtureBake() {
  const outDir = mkdtempSync(join(tmpdir(), 'tmj-guard-out-'));
  const generatedDir = mkdtempSync(join(tmpdir(), 'tmj-guard-gen-'));
  worldBake({ pack: 'fixture', srcRoot: 'test/fixtures/pack-src', outDir, generatedDir });
  return outDir;
}

test('committed .tmj maps are byte-identical to a fresh fixture bake', () => {
  const out = fixtureBake();
  const fresh = readdirSync(join(out, 'tilemaps'));
  const committed = readdirSync(COMMITTED_DIR).filter(f => f.endsWith('.tmj'));

  assert.ok(fresh.length > 0, 'the fixture bake produced no tilemaps at all');
  assert.deepEqual([...committed].sort(), [...fresh].sort(),
    'the committed tilemaps directory and a fresh fixture bake disagree on which venues exist');

  for (const f of fresh) {
    const freshBytes = readFileSync(join(out, 'tilemaps', f), 'utf8');
    const committedBytes = readFileSync(join(COMMITTED_DIR, f), 'utf8');
    assert.equal(committedBytes, freshBytes,
      `packages/client/public/assets/tilemaps/${f} does not match a fixture bake — ` +
      'this looks like a real-pack (limezu) bake got committed by mistake. Restore it ' +
      '(git restore packages/client) and re-bake with `npm run bake:world -- fixture` ' +
      'before committing — the bare `bake:world` now refuses to overwrite a ' +
      'licensed bake, so the pack must be named explicitly here.');
  }
});

test('committed tilemaps reference the generic pack path, never a vendor name (I-1/I-12)', () => {
  for (const f of readdirSync(COMMITTED_DIR).filter(n => n.endsWith('.tmj'))) {
    const m = JSON.parse(readFileSync(join(COMMITTED_DIR, f), 'utf8'));
    for (const ts of m.tilesets) assert.doesNotMatch(ts.image, /limezu/i, `${f}: ${ts.image}`);
  }
});

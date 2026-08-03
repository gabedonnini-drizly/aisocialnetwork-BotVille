import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { worldBake } from '../../scripts/world-bake.mjs';
import { REPO_ROOT } from '../helpers/siblingRepo.mjs';

/**
 * Instance ids are namespaced by archetype, so archetypes cannot collide with
 * each other. They CAN collide with an authored venue, and that is the case
 * the bake's duplicate check exists for — fire-proven here rather than
 * assumed, because the check guards the one invariant instancing rests on.
 */
function bakeWith(venuesDirs) {
  return worldBake({
    pack: 'fixture',
    srcRoot: 'test/fixtures/pack-src',
    outDir: mkdtempSync(join(tmpdir(), 'archetype-collision-')),
    generatedDir: mkdtempSync(join(tmpdir(), 'archetype-collision-gen-')),
    venuesDirs,
  });
}

/** An authored venue whose id is one a residence instance already stamps. */
function collidingVenueDir() {
  const dir = mkdtempSync(join(tmpdir(), 'archetype-collision-venues-'));
  const speakeasy = JSON.parse(
    readFileSync(join(REPO_ROOT, 'test/fixtures/venues/speakeasy/venue.json'), 'utf8'));
  mkdirSync(join(dir, 'house_1'));
  writeFileSync(join(dir, 'house_1', 'venue.json'),
    JSON.stringify({ ...speakeasy, id: 'house_1', label: 'Not A House' }));
  return dir;
}

test('an authored venue that shadows a stamped instance id fails the bake', () => {
  assert.throws(
    () => bakeWith([join(REPO_ROOT, 'venues'), collidingVenueDir()]),
    /duplicate venue id.*house_1/);
});

test('without the collision the same bake succeeds — the check is not a blanket refusal', () => {
  const r = bakeWith([join(REPO_ROOT, 'venues')]);
  assert.ok(r.venues > 0);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { worldBake } from '../../scripts/world-bake.mjs';
import { deriveResidenceCount } from '../../scripts/lib/residences.mjs';
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
  // Derived, not `> 0`: a bake that lost every residence, or stamped an extra
  // archetype nobody registered a generator for, would also be "> 0". The
  // claim is that this bake produced EXACTLY the authored venues plus the
  // town's residences — which is also what makes the dormant archetypes'
  // absence an assertion rather than an assumption.
  const town = JSON.parse(readFileSync(join(REPO_ROOT, 'town', 'town.json'), 'utf8'));
  const authored = readdirSync(join(REPO_ROOT, 'venues'))
    .filter(id => !id.startsWith('_') && !id.startsWith('.')).length;
  assert.equal(r.venues, authored + deriveResidenceCount(town));
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { plotRegistry } from '../packages/client/src/game/plotRegistry.ts';
import { venueRegistry } from '../packages/client/src/game/venueRegistry.ts';
import { listPlots } from '../packages/server/src/api/plots.ts';

/**
 * THE GUARDS THE STATIC IMPORT LIST NEEDS.
 *
 * `plotRegistry.ts` reads plot geometry through one static import per district
 * — the only form Vite bundles AND `node --test` resolves. A static list is
 * fine as long as something checks it against the tree; without that, the
 * seam's failure mode is silence: a `venues/north/plots.json` that nobody
 * imported renders as bare grass, and every other plot check passes because
 * there is nothing inconsistent to find.
 *
 * THREE CONSUMERS READ THE SAME TREE and this file is where they are made to
 * agree: the bake scans `venues/*​/plots.json` (world-bake.mjs), the fixture
 * server scans it (packages/server/src/api/plots.ts), and the client imports
 * it. Two of the three scan; the third is pinned here.
 */

const VENUES_DIR = 'venues';

/** Every `venues/<district>/plots.json` on disk — the same walk the bake does. */
function districtsWithPlotsOnDisk() {
  return readdirSync(VENUES_DIR, { withFileTypes: true })
    .filter(e => e.isDirectory() && !e.name.startsWith('_') && !e.name.startsWith('.'))
    .filter(e => existsSync(join(VENUES_DIR, e.name, 'plots.json')))
    .map(e => e.name)
    .sort();
}

test('every district with plots on disk is imported by the client registry', () => {
  const onDisk = districtsWithPlotsOnDisk();
  assert.ok(onDisk.length > 0,
    'no venues/*/plots.json on disk — this check is vacuous, and so is every other plot check');

  const imported = [...plotRegistry.registeredDistricts()].sort();

  const unimported = onDisk.filter(d => !imported.includes(d));
  assert.deepEqual(unimported, [],
    `venues/${unimported.join('/plots.json, venues/')}/plots.json exists and NOTHING IMPORTS IT. `
    + 'The bake will publish those parcels as venues and the client will draw bare grass where '
    + 'they are. Add a line to REGISTRIES in packages/client/src/game/plotRegistry.ts.');

  const phantom = imported.filter(d => !onDisk.includes(d));
  assert.deepEqual(phantom, [],
    `plotRegistry imports plots for ${phantom.join(', ')}, which has no plots.json — a stale `
    + 'import list is a district that exists only in the client');
});

test('the client, the bake and the fixture server agree on which parcels exist', () => {
  // The bake's answer, read off its artifact rather than by re-running it:
  // every published venue whose archetype is `plot` came from a plots.json.
  const baked = venueRegistry.all().filter(v => v.archetype === 'plot').map(v => v.id).sort();
  const client = plotRegistry.all().map(p => p.id).sort();
  const server = listPlots().map(p => p.id).sort();

  assert.ok(baked.length > 0, 'the bake published no parcels — this check is vacuous');
  assert.deepEqual(client, baked, 'the client imports a different set of parcels than the bake published');
  assert.deepEqual(server, baked, 'the fixture server serves a different set of parcels than the bake published');
});

test('the fixture server attributes each parcel to the district directory it came from', () => {
  const byId = new Map(plotRegistry.all().map(p => [p.id, p.districtId]));
  for (const row of listPlots()) {
    assert.equal(row.districtId, byId.get(row.id),
      `${row.id}: the server says district '${row.districtId}', the client says '${byId.get(row.id)}'`);
  }
});

/**
 * `derivePlotVenues` copies `doorAnchor` into the published venue's
 * `spawns[0]` ("the door anchor is where the parcel meets the street, so it is
 * also the only sensible place to put someone who arrives at it"). That makes
 * the same number exist twice, in two artifacts, generated at different times
 * — and Task 3 hangs a door off one copy while whoever places an arriving
 * agent uses the other.
 */
test('every plot’s doorAnchor is its published descriptor’s spawn point', () => {
  const plots = plotRegistry.all();
  assert.ok(plots.length > 0, 'no parcels — this check is vacuous');
  for (const plot of plots) {
    const venue = venueRegistry.get(plot.id);
    assert.ok(venue, `${plot.id} has geometry but no published venue`);
    assert.equal(venue.spawns?.length, 1,
      `${plot.id}: a parcel publishes exactly one spawn — its door anchor`);
    assert.deepEqual(venue.spawns[0], [...plot.doorAnchor],
      `${plot.id}: the geometry says the parcel meets the street at ${JSON.stringify(plot.doorAnchor)}, `
      + `the published descriptor says ${JSON.stringify(venue.spawns[0])}. The door hangs off the `
      + 'first and arrivals land on the second.');
  }
});

test('every plot’s published size is its geometry’s size', () => {
  // Same class of duplication, same failure: sizeTiles is the parcel's own
  // footprint, and the fence ring, the camp slots and the worksite patch are
  // all laid out against the geometry copy.
  for (const plot of plotRegistry.all()) {
    assert.deepEqual(venueRegistry.get(plot.id).sizeTiles, [...plot.size], `${plot.id}: size drift`);
  }
});

test('the guards fire — a district nobody imported is caught', () => {
  // Fire-proof for the completeness check, without touching the tree: the
  // comparison is over two lists, so feeding it a third district proves the
  // assertion is the thing doing the work and not the equality of two empties.
  const onDisk = [...districtsWithPlotsOnDisk(), 'north'];
  const imported = plotRegistry.registeredDistricts();
  assert.deepEqual(onDisk.filter(d => !imported.includes(d)), ['north'],
    'the completeness comparison does not detect an unimported district');

  // ...and the anchor check: a one-tile drift must not compare equal.
  const plot = plotRegistry.all()[0];
  const drifted = [plot.doorAnchor[0] + 1, plot.doorAnchor[1]];
  assert.notDeepEqual(venueRegistry.get(plot.id).spawns[0], drifted);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { derivePlotVenues, VACANT_PLOT_CAPACITY } from '../scripts/lib/plots.mjs';
import { deriveResidenceCount } from '../scripts/lib/residences.mjs';
import { loadContract } from '../scripts/lib/assetContract.mjs';

const registry = JSON.parse(readFileSync('venues/district/plots.json', 'utf8'));
const growth = JSON.parse(readFileSync('town/growth.json', 'utf8'));
const buildings = JSON.parse(readFileSync('contract/buildings.json', 'utf8'));
const district = JSON.parse(readFileSync('venues/district/venue.json', 'utf8'));
const town = JSON.parse(readFileSync('town/town.json', 'utf8'));
const published = JSON.parse(readFileSync('packages/client/public/assets/venues.json', 'utf8'));
const contract = loadContract();

const housing = registry.plots.filter(p => p.kind === 'housing');

test('the committed plots are what the derivation produces (no hand edits)', () => {
  // The file is generated and committed — committed because a plot id is a
  // venue id and venue ids are append-only, generated because D-79 says
  // viability is derived from physics, not authored. `--check` is what stops
  // those two facts drifting apart.
  execFileSync(process.execPath, ['scripts/derive-plots.mjs', '--check'], { stdio: 'pipe' });
});

/**
 * THE DEADLOCK ASSERTION. Fewer housing plots than the town needs homes and
 * the town cannot house itself however well the loop works — round (g) would
 * measure a deadlock the design created rather than an agent's unwillingness.
 * Derived on both sides: the floor from the town and the occupancy target,
 * the count from the file.
 */
test('there are at least ceil(population / capacity) housing plots', () => {
  const floor = deriveResidenceCount(town);
  assert.ok(housing.length >= floor,
    `${housing.length} housing plots against a floor of ${floor} — the town cannot house itself`);
});

test('the plot count is the scarcity ratio applied to the floor, not a number someone picked', () => {
  const floor = deriveResidenceCount(town);
  assert.equal(housing.length, Math.ceil(growth.scarcityRatio * floor));
  const [lo, hi] = growth.scarcityRatioBand;
  assert.ok(growth.scarcityRatio >= lo && growth.scarcityRatio <= hi,
    `scarcityRatio ${growth.scarcityRatio} is outside the ruled band ${lo}..${hi}`);
});

test('every plot is inside the district and no two overlap', () => {
  const [W, H] = district.sizeTiles;
  assert.deepEqual(growth.districtSizeTiles, district.sizeTiles, 'config and descriptor disagree on size');
  for (const p of registry.plots) {
    const [x, y] = p.at; const [w, h] = p.size;
    assert.ok(x >= 0 && y >= 0 && x + w <= W && y + h <= H, `${p.id} falls outside ${W}x${H}`);
  }
  for (let i = 0; i < registry.plots.length; i++) {
    for (let j = i + 1; j < registry.plots.length; j++) {
      const a = registry.plots[i], b = registry.plots[j];
      const hit = a.at[0] < b.at[0] + b.size[0] && b.at[0] < a.at[0] + a.size[0]
               && a.at[1] < b.at[1] + b.size[1] && b.at[1] < a.at[1] + a.size[1];
      assert.equal(hit, false, `${a.id} and ${b.id} overlap`);
    }
  }
});

/**
 * D-66 stands: viability is FOOTPRINT FIT, never taste. So it is checkable —
 * recompute it from the art and compare. A hand-added entry, or a hand-removed
 * one, fails here.
 */
test('allowedArchetypes is exactly what fits, recomputed from the declared art', () => {
  const T = contract.tileSize;
  const fp = {};
  for (const [name, b] of Object.entries(buildings.buildings)) {
    fp[name] = b.footprintTiles
      ?? [Math.ceil(contract.props.district[b.exterior].maxSize[0] / T),
          Math.ceil(contract.props.district[b.exterior].maxSize[1] / T)];
  }
  const declared = readdirSync('venues/_archetypes').filter(f => f.endsWith('.json')).map(f => f.replace(/\.json$/, ''));
  for (const p of registry.plots) {
    const want = [...new Set(Object.entries(fp)
      .filter(([, [w, h]]) => w <= p.size[0] && h <= p.size[1])
      .map(([n]) => buildings.buildings[n].archetypeVenue ?? n))].sort();
    assert.deepEqual(p.allowedArchetypes, want, `${p.id} (${p.size.join('x')})`);
    for (const a of p.allowedArchetypes) {
      assert.ok(declared.includes(a), `${p.id} allows "${a}", which is not a declared archetype`);
    }
  }
});

test('a plot that admits nothing would be a plot nobody can build on', () => {
  for (const p of registry.plots) {
    assert.ok(p.allowedArchetypes.length > 0, `${p.id} admits no archetype at all`);
  }
});

test('every plot has a door anchor on its own boundary', () => {
  for (const p of registry.plots) {
    const [dx, dy] = p.doorAnchor;
    const [x, y] = p.at; const [w, h] = p.size;
    const onEdge = dx === x || dx === x + w || dy === y || dy === y + h;
    assert.ok(onEdge, `${p.id}: doorAnchor ${p.doorAnchor} is not on the parcel boundary`);
    assert.ok(dx >= x && dx <= x + w && dy >= y && dy <= y + h, `${p.id}: doorAnchor is off the parcel`);
  }
});

// ── the published shape (D-89) ────────────────────────────────────────────

test('a vacant plot publishes as the tent camp: roles home, affords sleep', () => {
  const plotVenues = published.filter(v => v.archetype === 'plot');
  assert.equal(plotVenues.length, registry.plots.length, 'every plot is published, and only plots');
  for (const v of plotVenues) {
    assert.deepEqual(v.roles, ['home'], `${v.id} — D-89 fixes this shape`);
    assert.deepEqual(v.affords, ['sleep'], `${v.id} — D-89 fixes this shape`);
    assert.equal(v.indoor, false, 'a vacant plot is a parcel on the district map, not a room');
    assert.equal(v.capacity, VACANT_PLOT_CAPACITY);
  }
});

/**
 * The derivation-safety proof, as a test rather than a note.
 *
 * A `home`-role venue is excluded from `deriveVenuesAffording`'s public pool
 * and from the capacity-weighted hangout/workplace pools by construction, so
 * publishing plots cannot move a daytime derivation. What it COULD move is
 * the home derivation — and it does not, for two structural reasons that are
 * asserted here rather than assumed: plot ids sort after every house under
 * the numeric collation the platform uses, so the residence list grows by
 * appending; and the pre-plot capacity already exceeds the roster, so the
 * fill never reaches a plot.
 */
test('publishing plots cannot move a derivation: they append, and the fill never reaches them', () => {
  const residences = published
    .filter(v => v.roles.includes('home'))
    .sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }));
  const plotIds = residences.filter(v => v.archetype === 'plot').map(v => v.id);
  const houseIds = residences.filter(v => v.archetype !== 'plot').map(v => v.id);

  const firstPlot = residences.findIndex(v => v.archetype === 'plot');
  assert.equal(firstPlot, houseIds.length,
    'a plot sorts before a house — the residence list would no longer be append-only');

  const preCapacity = residences.slice(0, firstPlot).reduce((n, v) => n + v.capacity, 0);
  assert.ok(preCapacity >= town.population,
    `pre-plot capacity ${preCapacity} < roster ${town.population} — the fill would spill into a plot `
    + 'and move an agent\'s derived home');
  assert.ok(plotIds.length > 0, 'no plots published — this proof is checking nothing');

  // No plot may afford anything a public candidate pool draws on.
  for (const v of published.filter(x => x.archetype === 'plot')) {
    assert.equal(v.roles.some(r => r === 'work' || r === 'hangout'), false,
      `${v.id} carries a public role and would join a candidate pool`);
  }
});

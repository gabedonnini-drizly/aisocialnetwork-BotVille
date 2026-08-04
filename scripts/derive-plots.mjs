#!/usr/bin/env node
/**
 * Derive the district's plots from config and geometry, and write
 * venues/district/plots.json.
 *
 *   node scripts/derive-plots.mjs [--check]
 *
 * D-79: plots are predetermined at authoring time from the map's ACTUAL
 * geometry, and each plot's viable building types are derived from physical
 * constraints — footprint fit against what the surroundings leave free —
 * never authorial taste. D-66 therefore stands: there is no zone field here,
 * and nothing in this file expresses a preference about what should stand
 * where. It expresses what CAN.
 *
 * WHY THE OUTPUT IS COMMITTED RATHER THAN DERIVED AT BAKE TIME.
 * Under D-79 the plot id IS the venue id, so plot ids are published
 * vocabulary and inherit the append-only invariant that makes "my agent's
 * home" durable. A layout recomputed on every bake would renumber parcels
 * whenever the config moved a tile — silently rehoming the town, which is
 * the exact failure the archetype instance list is careful to avoid. So the
 * derivation is reproducible and recorded, the OUTPUT is committed, and
 * re-deriving is a deliberate act with a reviewable diff. `--check` re-runs
 * the derivation and fails if the committed file no longer matches, which is
 * what keeps "derived" honest.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadContract } from './lib/assetContract.mjs';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..');
const rd = p => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));

const growth = rd('town/growth.json');
const buildings = rd('contract/buildings.json');
const district = rd('venues/district/venue.json');
const contract = loadContract();
const T = contract.tileSize;

/**
 * Every building's footprint IN TILES, read from the art it names. An
 * explicit `footprintTiles` is only honoured for compositions that have no
 * single sprite (the museum facade, the modular pool, the garden parcel) —
 * everything else is measured, so a prop that grows cannot keep a plot it no
 * longer fits.
 */
export function footprints() {
  const out = {};
  for (const [name, b] of Object.entries(buildings.buildings)) {
    if (b.footprintTiles) { out[name] = b.footprintTiles; continue; }
    const def = contract.props.district[b.exterior];
    if (!def) throw new Error(`buildings.json: "${name}" names exterior "${b.exterior}", which the contract does not declare`);
    out[name] = [Math.ceil(def.maxSize[0] / T), Math.ceil(def.maxSize[1] / T)];
  }
  return out;
}

/** The tiles a plot may not touch: roads, sidewalks, the pen, buildings, paths. */
export function occupancy([W, H]) {
  const p = district.generator.params;
  const occ = new Uint8Array(W * H);
  const mark = (x0, y0, x1, y1) => {
    for (let y = Math.max(0, y0); y <= Math.min(H - 1, y1); y++)
      for (let x = Math.max(0, x0); x <= Math.min(W - 1, x1); x++) occ[y * W + x] = 1;
  };
  mark(p.vRoad[0], 0, p.vRoad[1], H - 1);
  for (const [a, b] of p.vSidewalks) mark(a, 0, b, H - 1);
  mark(0, p.hRoad[0], W - 1, p.hRoad[1]);
  for (const [a, b] of p.hSidewalks) mark(0, a, W - 1, b);
  mark(p.pen[0], p.pen[1], p.pen[2], p.pen[3]);
  for (const [x0, y0, x1, y1] of p.paths) mark(x0, y0, x1, y1);
  // The five hand-placed buildings, at the footprint their declared art has.
  for (const f of district.furniture) {
    if (f.layer !== 'buildings') continue;
    const def = contract.props.district[f.name];
    if (!def) continue;
    const [w, h] = [Math.ceil(def.maxSize[0] / T), Math.ceil(def.maxSize[1] / T)];
    mark(Math.floor(f.at[0]), Math.floor(f.at[1]), Math.floor(f.at[0]) + w - 1, Math.floor(f.at[1]) + h - 1);
  }
  return occ;
}

/** Is the plot's own area free, with the walkable margin clear around it? */
function placeable(occ, [W, H], x, y, w, h, margin) {
  if (x + w > W || y + h > H) return false;
  for (let j = y - margin; j < y + h + margin; j++)
    for (let i = x - margin; i < x + w + margin; i++) {
      if (i < 0 || j < 0 || i >= W || j >= H) continue;
      if (occ[j * W + i]) return false;
    }
  return true;
}

/**
 * The door faces the nearest road or sidewalk corridor, so a plot is reached
 * from the street rather than from wherever the packer happened to leave a
 * gap. Ties go to the bottom edge — the direction the district's own four
 * authored doors face.
 */
function doorAnchor(p, [W, H], x, y, w, h) {
  const corridorX = [...range(p.vRoad[0], p.vRoad[1]), ...p.vSidewalks.flatMap(([a, b]) => range(a, b))];
  const corridorY = [...range(p.hRoad[0], p.hRoad[1]), ...p.hSidewalks.flatMap(([a, b]) => range(a, b))];
  const dist = (v, list) => Math.min(...list.map(c => Math.abs(c - v)));
  const options = [
    { doorAnchor: [x + w / 2, y + h], doorSide: 'south', d: dist(y + h, corridorY) },
    { doorAnchor: [x + w / 2, y], doorSide: 'north', d: dist(y, corridorY) + 0.5 },
    { doorAnchor: [x + w, y + h / 2], doorSide: 'east', d: dist(x + w, corridorX) + 0.25 },
    { doorAnchor: [x, y + h / 2], doorSide: 'west', d: dist(x, corridorX) + 0.75 },
  ];
  options.sort((a, b) => a.d - b.d);
  const { doorAnchor: at, doorSide } = options[0];
  return { doorAnchor: at, doorSide };
}
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

export function derive() {
  const size = growth.districtSizeTiles;
  const [W, H] = size;
  const margin = growth.walkableMarginTiles;
  const occ = occupancy(size);
  const fp = footprints();
  const p = district.generator.params;

  // Largest first: a big parcel placed after the small ones has nowhere left.
  const demand = [
    ...growth.civicPlots.map(c => ({ ...c, kind: 'civic' })),
    ...growth.plotSizeClasses.map(c => ({ ...c, kind: 'housing' })),
  ].sort((a, b) => (b.size[0] * b.size[1]) - (a.size[0] * a.size[1]));

  const plots = [];
  const taken = Uint8Array.from(occ);
  for (const cls of demand) {
    let placed = 0;
    for (let y = 0; y < H && placed < cls.count; y++) {
      for (let x = 0; x < W && placed < cls.count; x++) {
        const [w, h] = cls.size;
        if (!placeable(taken, size, x, y, w, h, margin)) continue;
        placed++;
        for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) taken[j * W + i] = 1;
        // What the plot admits is a set of ARCHETYPES (venues), not of config
        // rows. `house_detached` is a second, larger exterior for the `house`
        // archetype, so a plot that fits either admits `house` — and a plot
        // that fits only the terraced one still admits `house`, it just cannot
        // take the detached exterior. Mapping through `archetypeVenue` and
        // deduping is what keeps allowedArchetypes ⊆ declared archetypes.
        const allowed = [...new Set(Object.entries(fp)
          .filter(([, [bw, bh]]) => bw <= w && bh <= h)
          .map(([name]) => buildings.buildings[name].archetypeVenue ?? name))].sort();
        plots.push({
          id: `plot_${plots.length + 1}`,
          sizeClass: cls.name,
          kind: cls.kind,
          at: [x, y],
          size: [w, h],
          ...doorAnchor(p, size, x, y, w, h),
          allowedArchetypes: allowed,
        });
      }
    }
    if (placed < cls.count) {
      throw new Error(`derive-plots: only ${placed} of ${cls.count} ${cls.kind} plots of ${cls.size.join('x')} fit in ${W}x${H} — grow districtSizeTiles or lower scarcityRatio`);
    }
  }

  return {
    schemaVersion: 1,
    note: 'GENERATED by scripts/derive-plots.mjs from town/growth.json + contract/buildings.json + this district\'s geometry. Do not hand-edit: `node scripts/derive-plots.mjs --check` fails if this file and the derivation disagree. Committed rather than derived at bake time because under D-79 a plot id IS a venue id, and published venue ids are append-only.',
    derivedFrom: {
      districtSizeTiles: size,
      scarcityRatio: growth.scarcityRatio,
      housingFloor: Math.ceil(rd('town/town.json').population / 7),
      walkableMarginTiles: margin,
    },
    plots,
  };
}

const OUT = 'venues/district/plots.json';
if (import.meta.url === `file://${process.argv[1]}`) {
  const next = JSON.stringify(derive(), null, 2) + '\n';
  if (process.argv.includes('--check')) {
    const have = readFileSync(join(ROOT, OUT), 'utf8');
    if (have !== next) {
      console.error(`error: ${OUT} does not match the derivation. Re-run: node scripts/derive-plots.mjs`);
      process.exit(1);
    }
    console.log(`${OUT}: matches the derivation`);
  } else {
    writeFileSync(join(ROOT, OUT), next);
    const d = JSON.parse(next);
    const housing = d.plots.filter(p => p.kind === 'housing').length;
    console.log(`${OUT}: ${d.plots.length} plots (${housing} housing, floor ${d.derivedFrom.housingFloor}, ratio ${d.derivedFrom.scarcityRatio})`);
  }
}

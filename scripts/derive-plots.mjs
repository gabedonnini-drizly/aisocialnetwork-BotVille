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
import { join, resolve } from 'node:path';
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

/**
 * The tiles a plot may not touch: the road/sidewalk network, the pen, the
 * paved paths, and EVERY SOLID THING ALREADY STANDING THERE.
 *
 * The solid things are read from the baked district's own `collision` layer
 * rather than recomputed here. That is the whole point: `bakeDistrict` emits
 * collision boxes for buildings AND for tree trunks, street lamps, benches,
 * trash cans, hydrants, parked cars, the pen fence and the scatter bushes,
 * each with its own bespoke offset. The first version of this packer knew
 * only about the buildings layer, and it put the only school-sized parcel on
 * top of four trees and a bench. A second copy of those rules would have gone
 * stale the same way; the baker's output cannot.
 *
 * The map-bounds rects the baker adds outside the grid are ignored by the
 * clamp in `mark`.
 */
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

  const tmj = JSON.parse(readFileSync(join(ROOT, 'packages/client/public/assets/tilemaps/district.tmj'), 'utf8'));
  if (tmj.width !== W || tmj.height !== H) {
    throw new Error(
      `derive-plots: the baked district is ${tmj.width}x${tmj.height} but growth.json says ${W}x${H}. `
      + 'Run `npm run bake:world` first — the packer reads the bake\'s collision layer, so a stale '
      + 'tilemap would place plots against the wrong obstacles.');
  }
  const collision = tmj.layers.find(l => l.name === 'collision');
  if (!collision) throw new Error('derive-plots: the baked district has no collision layer');
  for (const o of collision.objects) {
    mark(Math.floor(o.x / T), Math.floor(o.y / T),
         Math.ceil((o.x + o.width) / T) - 1, Math.ceil((o.y + o.height) / T) - 1);
  }
  return occ;
}

/** Every tile of the road/sidewalk network — what a door anchor wants to reach. */
export function networkTiles([W, H]) {
  const p = district.generator.params;
  const tiles = [];
  const cols = [...range(p.vRoad[0], p.vRoad[1]), ...p.vSidewalks.flatMap(([a, b]) => range(a, b))];
  const rows = [...range(p.hRoad[0], p.hRoad[1]), ...p.hSidewalks.flatMap(([a, b]) => range(a, b))];
  for (let y = 0; y < H; y++) for (const x of cols) tiles.push([x, y]);
  for (let x = 0; x < W; x++) for (const y of rows) tiles.push([x, y]);
  return tiles;
}

/** Chebyshev-ish walking distance from a point to the nearest network tile. */
export function distanceToNetwork([x, y]) {
  const p = district.generator.params;
  const cols = [...range(p.vRoad[0], p.vRoad[1]), ...p.vSidewalks.flatMap(([a, b]) => range(a, b))];
  const rows = [...range(p.hRoad[0], p.hRoad[1]), ...p.hSidewalks.flatMap(([a, b]) => range(a, b))];
  const dx = Math.min(...cols.map(c => Math.abs(c - x)));
  const dy = Math.min(...rows.map(r => Math.abs(r - y)));
  return Math.min(dx, dy);
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
    const [cw, ch] = cls.size;
    // Nearest the street first. Row-major order put parcels wherever the scan
    // happened to reach one, which in a district whose new region has no roads
    // meant door anchors 30 tiles from the nearest pavement. Ordering
    // candidates by how far the parcel's door would be from the network costs
    // nothing and makes the anchors as reachable as this geometry allows.
    const candidates = [];
    for (let y = 0; y <= H - ch; y++) {
      for (let x = 0; x <= W - cw; x++) candidates.push([x, y, distanceToNetwork([x + cw / 2, y + ch / 2])]);
    }
    candidates.sort((a, b) => a[2] - b[2] || a[1] - b[1] || a[0] - b[0]);
    for (const [x, y] of candidates) {
      if (placed >= cls.count) break;
      {
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
    note: 'GENERATED by scripts/derive-plots.mjs from town/growth.json + contract/buildings.json + this district\'s geometry and its baked collision layer. Do not hand-edit: `node scripts/derive-plots.mjs --check` fails if this file and the derivation disagree. Committed rather than derived at bake time because under D-79 a plot id IS a venue id, and published venue ids are append-only.',
    appendOnlyFrom: 'THIS LAYOUT IS FROZEN. Plot ids are venue ids (D-79), so from here they are APPEND-ONLY: a re-derivation that renumbers or repositions an existing plot rehomes whoever is standing on it and orphans any claim, structure or contribution row that names it. The 2026-08-03 re-derivation (F-6: the packer was blind to prop collision boxes and had put the only school-sized parcel on top of four trees and a bench; F-5: the M class was sized against art no building row names) moved all 23 and was the LAST permissible one — it was safe only because nothing referenced a plot id yet: no DB rows, no claims, and the api was holding its hydration for it. Growing the town from here means APPENDING plots, which is what raising a size class count in town/growth.json does; changing an existing one is a migration, not a re-run.',
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
// `file://${argv[1]}` is not a URL comparison — a path with a space or any
// other character URL-encoding touches makes it silently false, and the CLI
// then does nothing at all. Compare resolved PATHS.
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
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

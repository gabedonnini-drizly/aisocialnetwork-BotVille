/**
 * What stands on a parcel, as DATA — plan `03-` Task 2.
 *
 * A plot's visible state is an enum (D-75 "Visible construction"), and
 * `contract/plot_states.json` maps each state to a PROP COMPOSITION. That file
 * is the authority; this module is the layout, and the two are separate on
 * purpose. Adding a fourth state is an edit to that file plus a state in the
 * source — no branch here names a state, no branch here names a prop.
 *
 * WHERE THE DATA COMES FROM, and the rule that decides:
 *   the bake PUBLISHES it (public/assets/…)  -> the client fetches the copy;
 *   the bake CONSUMES it (contract/, venues/) -> the client imports the source.
 * `plot_states.json` and `variant_pools.json` are copied beside the artifact
 * by world-bake.mjs for exactly this reason, so they arrive as documents at
 * runtime and are parameters here. `plots.json` and `buildings.json` are bake
 * INPUTS, so they are static imports (see plotRegistry.ts / buildingRegistry.ts).
 * Neither route adds an output to the bake.
 *
 * EVERYTHING IS IN TILES. Pixel positions depend on the real art's size, which
 * only exists once a texture is loaded, so a placement carries a tile point and
 * an alignment and the scene resolves the pixels. That keeps this module pure,
 * keeps the golden baseline deterministic, and means a prop that gets redrawn
 * one pixel taller does not silently move.
 *
 * Do not import Phaser: the module is tested under node --test.
 */
import type { Plot, PlotState } from './plotRegistry.js';
import { pickFrom, SEED_SALT } from './plotSeed.js';

/** The three object layers DistrictScene draws, in the .tmj's own vocabulary. */
export type PlotLayer = 'props-below' | 'buildings' | 'props-above';

/**
 * `top-left` is the tilemap's own convention (`setOrigin(0, 0)` at
 * `tile * 16`). `centre-bottom` puts the tile point at the middle of the
 * sprite's FOOTPRINT — the only sane anchor for a building whose art is
 * taller than the ground it stands on.
 */
export type PlotAlign = 'top-left' | 'centre-bottom';

export interface Placement {
  name: string;
  layer: PlotLayer;
  /** Tile coordinates on the district map. */
  tile: [number, number];
  align: PlotAlign;
}

/** contract/plot_states.json, as far as this module reads it. */
export interface PlotStatesDoc {
  states: string[];
  composition: Record<string, PlotComposition>;
}

interface PlotComposition {
  boundary?: { prefix?: string; pick?: string[]; layer: PlotLayer };
  ground?: { pick: string[]; layer: PlotLayer };
  centre?: { pick: string[]; layer: PlotLayer };
  entrance?: { name: string; layer: PlotLayer };
  plant?: { pick: string[]; layer: PlotLayer };
  scatter?: { pick: string[]; layer: PlotLayer };
  exterior?: string;
}

/** contract/variant_pools.json, as far as this module reads it. */
export interface VariantPoolsDoc {
  pools: Record<string, string[]>;
}

/** An agent standing on this parcel. `spriteSeed` is what the tent is picked by. */
export interface Occupant {
  id: string;
  spriteSeed: string;
}

export interface ComposeInput {
  plot: Plot;
  state: PlotState;
  states: PlotStatesDoc;
  pools: VariantPoolsDoc;
  /** Occupants of a camp. Ignored for `built` — a house is not a camp. */
  occupants?: readonly Occupant[];
  /** For `built`: the exterior prop of whatever was built (buildingRegistry). */
  exterior?: string;
}

/** The eight named pieces of the shipped fence set, in ring position order. */
const RING_PARTS = {
  topLeft: 'top_left',
  topRight: 'top_right',
  bottomLeft: 'bottom_left',
  bottomRight: 'bottom_right',
  top: 'top_middle',
  bottom: 'bottom_middle',
  left: 'middle_left',
  right: 'middle_right',
} as const;

/** Tiles of gap left in the boundary at the door anchor — the pen's own gate width. */
export const GATE_WIDTH_TILES = 3;

/** Camps hold four (VACANT_PLOT_CAPACITY); four slots, so no two tents collide. */
const CAMP_SLOTS: ReadonlyArray<readonly [number, number]> = [[-2, -1], [2, -1], [-2, 2], [2, 2]];

/** The parcel's tile bounds, half-open in the same convention plots.json uses. */
function bounds(plot: Plot) {
  const [ax, ay] = plot.at;
  const [w, h] = plot.size;
  return { ax, ay, w, h, x1: ax + w - 1, y1: ay + h - 1 };
}

/** The parcel's centre tile — where a structure or a worksite sits. */
export function centreTile(plot: Plot): [number, number] {
  const { ax, ay, w, h } = bounds(plot);
  return [ax + Math.floor(w / 2), ay + Math.floor(h / 2)];
}

/**
 * The gate cell: the door anchor, clamped onto the ring.
 *
 * Two conversions, both forced by how `derive-plots.mjs` writes an anchor:
 *
 *   CLAMP  the convention is half-open — a `north` anchor sits ON the top row,
 *          a `south` anchor one row PAST the bottom one (`at.y + h`, the
 *          parcel's edge LINE, not a tile it owns). Clamping makes both name
 *          the same physical opening.
 *   FLOOR  the along-edge coordinate is `at + size / 2`, NOT floored, so an
 *          odd-sized parcel gets a genuinely fractional anchor: plot_7 is
 *          12x15 and its west anchor is [28, 54.5], a point on the line
 *          BETWEEN tiles 54 and 55. Left un-floored the gate straddles it and
 *          comes out two tiles wide instead of three. The tile containing the
 *          point is the floor of it; the door itself keeps the exact fraction
 *          (see the door geometry — a door is a rectangle in pixels and can
 *          sit on a half-tile, a hole in a fence cannot).
 */
export function gateTile(plot: Plot): [number, number] {
  const { ax, ay, x1, y1 } = bounds(plot);
  const [dx, dy] = plot.doorAnchor;
  return [
    Math.floor(Math.min(Math.max(dx, ax), x1)),
    Math.floor(Math.min(Math.max(dy, ay), y1)),
  ];
}

/** Is this ring cell inside the gate opening? */
function inGate(plot: Plot, tx: number, ty: number): boolean {
  const [gx, gy] = gateTile(plot);
  const half = Math.floor(GATE_WIDTH_TILES / 2);
  const horizontal = plot.doorSide === 'north' || plot.doorSide === 'south';
  return horizontal
    ? ty === gy && Math.abs(tx - gx) <= half
    : tx === gx && Math.abs(ty - gy) <= half;
}

/**
 * The boundary ring, mirroring the bake's own pen fence (venueBaker.mjs:174-193)
 * piece for piece — corners, then the four edge runs — with a gap at the gate.
 *
 * Two boundary shapes, both from the data:
 *   `prefix`  the shipped 8-piece corner/edge set, addressed by NAME. This is
 *             what a residential lot uses, and what the district already draws.
 *   `pick`    an unordered set of interchangeable panels (the worksite
 *             hoarding: `worksite_fence_1_1..1_8` carry no corner semantics —
 *             plot_states.json calls it "a solid site hoarding"). Each cell
 *             takes a deterministic pick, so the run has variety and the same
 *             parcel draws the same run every time.
 */
function ring(plot: Plot, spec: NonNullable<PlotComposition['boundary']>): Placement[] {
  const { ax, ay, x1, y1, w, h } = bounds(plot);
  if (w < 2 || h < 2) return [];
  const out: Placement[] = [];
  const named = (part: string, tx: number, ty: number) =>
    out.push({ name: `${spec.prefix}${part}`, layer: spec.layer, tile: [tx, ty], align: 'top-left' });
  const picked = (tx: number, ty: number) => out.push({
    name: pickFrom(spec.pick!, `${plot.id}:${tx},${ty}`, SEED_SALT.worksiteBoundary),
    layer: spec.layer,
    tile: [tx, ty],
    align: 'top-left',
  });
  const place = spec.prefix
    ? (part: keyof typeof RING_PARTS, tx: number, ty: number) => named(RING_PARTS[part], tx, ty)
    : (_part: keyof typeof RING_PARTS, tx: number, ty: number) => picked(tx, ty);

  for (let x = ax + 1; x < x1; x++) {
    if (!inGate(plot, x, ay)) place('top', x, ay);
    if (!inGate(plot, x, y1)) place('bottom', x, y1);
  }
  for (let y = ay + 1; y < y1; y++) {
    if (!inGate(plot, ax, y)) place('left', ax, y);
    if (!inGate(plot, x1, y)) place('right', x1, y);
  }
  for (const [part, tx, ty] of [
    ['topLeft', ax, ay], ['topRight', x1, ay], ['bottomLeft', ax, y1], ['bottomRight', x1, y1],
  ] as const) {
    if (!inGate(plot, tx, ty)) place(part, tx, ty);
  }
  return out;
}

/**
 * Scatter sits at the four inside corners of the lot, and nowhere else.
 *
 * A rule, not a taste: it is the only placement that is defined for a 6x6 S
 * parcel and a 24x23 XL one without either drowning the small ones or leaving
 * the big ones bare, and it needs no density constant to tune. A parcel with
 * no interior (w or h below 3) gets none rather than a piece on its own fence.
 */
function scatter(plot: Plot, spec: { pick: string[]; layer: PlotLayer }, salt: string): Placement[] {
  const { ax, ay, x1, y1, w, h } = bounds(plot);
  if (w < 3 || h < 3) return [];
  return ([[ax + 1, ay + 1], [x1 - 1, ay + 1], [ax + 1, y1 - 1], [x1 - 1, y1 - 1]] as const)
    .map(([tx, ty]) => ({
      name: pickFrom(spec.pick, `${plot.id}:${tx},${ty}`, salt),
      layer: spec.layer,
      tile: [tx, ty] as [number, number],
      align: 'top-left' as const,
    }));
}

/** The worked ground: a patch around the site, not the whole parcel. */
function worksiteGround(plot: Plot, spec: { pick: string[]; layer: PlotLayer }): Placement[] {
  const { ax, ay, x1, y1, w, h } = bounds(plot);
  if (w < 3 || h < 3) return [];
  const [cx, cy] = centreTile(plot);
  const half = 2;
  const out: Placement[] = [];
  for (let ty = Math.max(cy - half, ay + 1); ty <= Math.min(cy + half, y1 - 1); ty++) {
    for (let tx = Math.max(cx - half, ax + 1); tx <= Math.min(cx + half, x1 - 1); tx++) {
      out.push({
        name: pickFrom(spec.pick, `${plot.id}:${tx},${ty}`, SEED_SALT.worksiteGround),
        layer: spec.layer,
        tile: [tx, ty],
        align: 'top-left',
      });
    }
  }
  return out;
}

/**
 * Where an occupant's tent stands, in tiles — and therefore where the occupant
 * standing beside it is drawn. One function for both, so a sprite can never
 * appear at a camp the tent is not at.
 */
export function campSlotTile(plot: Plot, index: number): [number, number] {
  const { ax, ay, x1, y1 } = bounds(plot);
  const [cx, cy] = centreTile(plot);
  const [dx, dy] = CAMP_SLOTS[index % CAMP_SLOTS.length];
  return [
    Math.min(Math.max(cx + dx, ax + 1), Math.max(x1 - 1, ax + 1)),
    Math.min(Math.max(cy + dy, ay + 1), Math.max(y1 - 1, ay + 1)),
  ];
}

/**
 * The tents. D-60/D-89: the homeless camp stands on the land the town has not
 * built on, so a vacant parcel with people on it IS the camp — and a vacant
 * parcel with nobody on it is a fenced empty lot, which is the honest picture.
 *
 * D-75's ruled seeding, unchanged: `pickFrom(pool, spriteSeed, salt)` against
 * the pool the bake declares. Per AGENT, so the same agent pitches the same
 * tent forever and takes it with them if they move camp — plan `03-` Task 2's
 * own words. Occupants are sorted by id so slot assignment cannot depend on
 * roster order.
 */
function tents(plot: Plot, pools: VariantPoolsDoc, occupants: readonly Occupant[]): Placement[] {
  const pool = pools.pools?.tent;
  if (!pool?.length) return [];
  return [...occupants]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((o, i) => ({
      name: pickFrom(pool, o.spriteSeed, SEED_SALT.tent),
      layer: 'props-above' as const,
      tile: campSlotTile(plot, i),
      align: 'centre-bottom' as const,
    }));
}

/**
 * Everything that stands on one parcel, in draw order.
 *
 * Total over the declared states, and it names none of them: the composition
 * keys present in `plot_states.json` decide what gets built. An UNDECLARED
 * state throws rather than rendering as bare grass — I-2's spirit, applied to
 * the one input that arrives at runtime.
 */
export function composePlot(input: ComposeInput): Placement[] {
  const { plot, state, states, pools, occupants = [], exterior } = input;
  const comp = states.composition?.[state];
  if (!comp) {
    throw new Error(
      `plot ${plot.id}: state '${state}' has no composition in plot_states.json `
      + `(declared: ${(states.states ?? []).join(' | ')})`,
    );
  }

  const out: Placement[] = [];
  if (comp.ground) out.push(...worksiteGround(plot, comp.ground));
  if (comp.boundary) out.push(...ring(plot, comp.boundary));
  if (comp.scatter) out.push(...scatter(plot, comp.scatter, SEED_SALT.plotScatter));
  if (comp.centre) {
    out.push({
      name: pickFrom(comp.centre.pick, plot.id, SEED_SALT.worksiteCentre),
      layer: comp.centre.layer,
      tile: centreTile(plot),
      align: 'centre-bottom',
    });
  }
  if (comp.plant) {
    const [cx, cy] = centreTile(plot);
    out.push({
      name: pickFrom(comp.plant.pick, plot.id, SEED_SALT.worksitePlant),
      layer: comp.plant.layer,
      tile: [Math.max(cx - 3, plot.at[0] + 1), Math.min(cy + 3, plot.at[1] + plot.size[1] - 2)],
      align: 'centre-bottom',
    });
  }
  if (comp.entrance) {
    out.push({
      name: comp.entrance.name,
      layer: comp.entrance.layer,
      tile: gateTile(plot),
      align: 'centre-bottom',
    });
  }
  // `built` composes from the ARCHETYPE, not from the table (plot_states.json:
  // props here would make every built plot look the same). No archetype yet =
  // nothing to draw, which is a state of the world, not an error.
  if (comp.exterior === 'archetype' && exterior) {
    out.push({ name: exterior, layer: 'buildings', tile: centreTile(plot), align: 'centre-bottom' });
  }
  // A camp is what a plot without a structure IS. Never on a built plot.
  if (comp.exterior !== 'archetype') out.push(...tents(plot, pools, occupants));
  return out;
}

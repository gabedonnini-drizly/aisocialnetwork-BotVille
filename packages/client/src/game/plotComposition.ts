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
 * ── V1 PLOT PROPS ARE DECORATIVE: NOTHING HERE COLLIDES ──────────────────
 *
 * A ruling, not an oversight, and it is written here because here is where
 * somebody would look for it. Every placement this module returns becomes an
 * image and nothing else — no `blockRect`, no walkability. Three reasons:
 *
 *   • THE PATHFINDER GRID BELONGS TO THE BAKE. `DistrictScene` builds it from
 *     the .tmj's `collision` object layer and from nothing else, and that
 *     layer is world-bake.mjs's output. Adding 23 runtime fence rings would
 *     make walkability depend on plot STATE, i.e. on a wire that has not
 *     shipped, and the golden baseline's `walkability` sha — the thing that
 *     proved the 92x92 growth was non-destructive cell for cell — would stop
 *     describing the map the agents actually walk.
 *   • NOTHING ABOUT REACHABILITY DEPENDS ON IT. The gate in the ring is a
 *     VISUAL opening, so the parcel reads as enterable at the point where its
 *     door is; agents already walk through the fence line because it is
 *     scenery. `test/plot-doors.test.mjs` proves the door anchors are reachable
 *     against the REAL grid, which is the claim that matters, and it would go
 *     on being true with no ring drawn at all.
 *   • NO TEST COULD PROVE NOBODY GETS STRANDED. 23 rings with 1-tile margins
 *     between parcels is a maze; "every door is reachable from spawn 0" is not
 *     the same as "every agent standing anywhere can leave", and the second is
 *     what a collision change would need to establish.
 *
 * REVISIT WHEN BUILT-PLOT INTERIORS LAND. Once a built parcel has a room
 * behind its door, a solid building on the map is the thing you cannot walk
 * through, and the honest home for that is the BAKE — a built structure's
 * footprint in the collision layer — not a runtime overlay.
 *
 * EVERYTHING IS IN TILES. Pixel positions depend on the real art's size, which
 * only exists once a texture is loaded, so a placement carries a tile point and
 * an alignment and the scene resolves the pixels. That keeps this module pure,
 * keeps the golden baseline deterministic, and means a prop that gets redrawn
 * one pixel taller does not silently move.
 *
 * Do not import Phaser: the module is tested under node --test.
 */
import type { DoorSide, Plot, PlotState } from './plotRegistry.js';
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
  /** A second, interchangeable boundary set — picked per parcel (see `ring`). */
  boundaryAlternate?: { prefix?: string; pick?: string[]; layer: PlotLayer };
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

/**
 * Camps hold four (VACANT_PLOT_CAPACITY), so four quadrants around the centre.
 *
 * A camp is not GUARANTEED to hold four, though — capacity is the api's
 * derivation, not a lock, and D-89's whole point is that the camp is wherever
 * the unhoused are. So the slots FAN OUT past the fourth instead of wrapping
 * onto the first: occupant 5 takes quadrant 1 one ring further from the
 * centre, and so on. On a parcel with room that keeps every tent visible; on a
 * 6x6 the outer rings clamp back onto the inner ones, which is an overfull
 * camp and looks like one.
 */
const CAMP_SLOTS: ReadonlyArray<readonly [number, number]> = [[-2, -1], [2, -1], [-2, 2], [2, 2]];
/** How far each extra ring of four steps outward, in tiles. */
const CAMP_RING_STEP = 3;

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
  const base = CAMP_SLOTS[index % CAMP_SLOTS.length];
  const ring = Math.floor(index / CAMP_SLOTS.length);
  const dx = base[0] + Math.sign(base[0]) * ring * CAMP_RING_STEP;
  const dy = base[1] + Math.sign(base[1]) * ring * CAMP_RING_STEP;
  return [
    Math.min(Math.max(cx + dx, ax + 1), Math.max(x1 - 1, ax + 1)),
    Math.min(Math.max(cy + dy, ay + 1), Math.max(y1 - 1, ay + 1)),
  ];
}

/** One parcel's whole render: what to draw, and the door if it has one. */
export interface PlotRender {
  plot: Plot;
  placements: Placement[];
  door?: PlotDoor;
}

export interface ComposeDistrictInput {
  plots: readonly Plot[];
  statusOf: (plotId: string) => { state: PlotState; archetype?: string };
  states: PlotStatesDoc;
  pools: VariantPoolsDoc;
  occupantsOf?: (plotId: string) => readonly Occupant[];
  exteriorFor?: (archetype: string) => string | undefined;
  /** Called instead of throwing when one parcel cannot be composed. */
  onSkip?: (plotId: string, reason: string) => void;
}

/**
 * EVERY parcel of one district, and ONE PARCEL NEVER TAKES THE TOWN WITH IT.
 *
 * `composePlot` throws on a state no composition declares, which is the right
 * call for a pure function whose caller might be the bake or a test. It is the
 * wrong call for the scene: `DistrictScene.renderPlots` runs from `create()`,
 * so an uncaught throw there is a BLACK SCREEN AT BOOT — reachable from DATA
 * rather than from code (a stale published `plot_states.json`, or a state the
 * api starts sending before the copy beside the artifact knows about it).
 *
 * `plotState.ts` already states the policy for anything arriving on a wire:
 * an unknown state "is DROPPED, never rendered". This is the second door into
 * the same room, and it now behaves the same way — skip the parcel, name it,
 * draw the other twenty-two. Living in this module rather than in the scene is
 * what makes it testable without Phaser.
 */
export function composeDistrict(input: ComposeDistrictInput): PlotRender[] {
  const { plots, statusOf, states, pools, occupantsOf, exteriorFor, onSkip } = input;
  const out: PlotRender[] = [];
  for (const plot of plots) {
    const status = statusOf(plot.id);
    let placements: Placement[];
    try {
      placements = composePlot({
        plot,
        state: status.state,
        states,
        pools,
        occupants: occupantsOf?.(plot.id) ?? [],
        ...(status.archetype && exteriorFor ? { exterior: exteriorFor(status.archetype) } : {}),
      });
    } catch (err) {
      onSkip?.(plot.id, err instanceof Error ? err.message : String(err));
      continue;
    }
    const door = plotDoorFor(plot, status.state);
    out.push(door ? { plot, placements, door } : { plot, placements });
  }
  return out;
}

/** Which way is OUT of the parcel, per door side. */
const OUTWARD: Record<DoorSide, readonly [number, number]> = {
  north: [0, -1],
  south: [0, 1],
  west: [-1, 0],
  east: [1, 0],
};

/** How far past the threshold the waiting spot sits, px. */
const DOOR_STANDOFF_PX = 14;

/** A generated door, in the same PIXEL vocabulary an authored .tmj door uses. */
export interface PlotDoor {
  /** Target venue — D-79: the plot id IS the venue id. */
  targetVenue: string;
  /** The clickable threshold. Centre + size, as the scene's zones want them. */
  zone: { x: number; y: number; width: number; height: number };
  /** Where an agent stands to use it — `doorPoints`' value, keyed by target. */
  point: { x: number; y: number };
}

/**
 * THE DOOR OF A BUILT STRUCTURE, GENERATED FROM THE PLOT — plan `03-` Task 3.
 *
 * "Doors for built structures are generated from the plot's doorAnchor, not
 * hand-authored furniture entries. Hand-placement is the pattern this drive
 * exists to retire." Since the district was founded there has been no house
 * building and no house door on the map while 85 agents slept in 13 rooms
 * nightly; `venues/district/venue.json` carries four doors — office, cafe,
 * dorm, library — and not one of them is a home.
 *
 * The output is deliberately the SAME SHAPE an authored door produces in
 * DistrictScene.create: a centre-and-size zone, and a point keyed by target
 * venue id in `doorPoints`. Everything downstream — the walk-to-door departure,
 * spawning at the door on the way back, `planSync`'s `hasDoorFor`, the
 * pathfinder route, the click that transitions — reads `doorPoints` and knows
 * nothing about where the entry came from. That is what "route to a generated
 * door exactly as to an authored one" has to mean to be checkable.
 *
 * Two differences from an authored door, both forced and both stated:
 *   • the standoff is along the door's OWN side. Every authored door faces
 *     south, so `y + height + 6` was enough; a parcel's anchor can be on any
 *     of the four edges (plots.json has all four), and a west-facing door
 *     whose waiting spot is south of it is inside the house.
 *   • the anchor may be FRACTIONAL (`at + size / 2` — plot_7's is [28, 54.5]),
 *     and unlike the fence gap a door is a pixel rectangle, so it keeps the
 *     half-tile instead of flooring it.
 */
/**
 * The door a parcel has IN A GIVEN STATE, or none.
 *
 * The whole of "a built plot is navigable; a vacant plot is not enterable"
 * (plan `03-` Task 3), as one function rather than as a condition inside a
 * Phaser scene no node test can reach. A vacant parcel is a tent camp standing
 * in the open — it has no threshold, and its occupants are drawn where they
 * sleep instead of walking through a door that is not there.
 */
export function plotDoorFor(plot: Plot, state: PlotState): PlotDoor | undefined {
  return state === 'built' ? plotDoor(plot) : undefined;
}

export function plotDoor(plot: Plot): PlotDoor {
  const [dx, dy] = plot.doorAnchor;
  const [ox, oy] = OUTWARD[plot.doorSide];
  const cx = dx * 16;
  const cy = dy * 16;
  // The threshold lies ALONG the wall it is in. A 32x16 zone is right on a
  // north or south edge and wrong on a west or east one, where it would stick
  // two tiles out into the street and one tile along a wall it is supposed to
  // span — clickable where the building is not, and not clickable where it is.
  const along = 32;
  const across = 16;
  const horizontal = oy !== 0;
  return {
    targetVenue: plot.id,
    zone: {
      x: cx,
      y: cy,
      width: horizontal ? along : across,
      height: horizontal ? across : along,
    },
    point: { x: cx + ox * DOOR_STANDOFF_PX, y: cy + oy * DOOR_STANDOFF_PX },
  };
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
  if (comp.boundary) {
    // `boundaryAlternate` is a SECOND hoarding set, and it used to be data
    // nothing read — plot_states.json declared worksite_fence_2_* beside
    // worksite_fence_1_* and every worksite in town wore set 1. Two sites side
    // by side looked like one site. Which set a parcel wears is a per-plot
    // deterministic pick, so it is stable for the life of the build and
    // different between neighbours; a composition that declares no alternate
    // behaves exactly as before.
    const sets = comp.boundaryAlternate ? [comp.boundary, comp.boundaryAlternate] : [comp.boundary];
    out.push(...ring(plot, pickFrom(sets, plot.id, SEED_SALT.worksiteBoundary)));
  }
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

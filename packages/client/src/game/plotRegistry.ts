/**
 * Plot GEOMETRY — the half of a plot that is not in the published vocabulary.
 *
 * D-79 made the plot id the venue id, so `venueRegistry` already knows every
 * plot exists, what it is called and what it affords. What it does NOT know is
 * WHERE the parcel is: `at`, `size`, `doorAnchor` and `doorSide` are geometry,
 * and geometry is not something the platform needs (`venues.json` is the api's
 * contract, and the api places agents by roles/affords, never by coordinates).
 * Keeping it out of the published projection is deliberate — it is also what
 * keeps `venues.json` byte-stable while the client learns to draw the land.
 *
 * So the geometry comes from the authoring file the bake derives, exactly as
 * `venues.generated.ts` does, one district at a time. THE IMPORT LIST BELOW IS
 * THE MULTI-DISTRICT SEAM: `venues/<districtId>/plots.json` is the file layout
 * the bake already uses, and a second district adds one line here naming its
 * own file.
 *
 * A static list needs a guard, and it has one — `test/plot-registry.test.mjs`,
 * which asserts:
 *
 *   • REGISTRIES IS COMPLETE against `venues/*​/plots.json` on disk. A district
 *     whose parcels nobody imported fails there rather than rendering as bare
 *     grass (I-2 in spirit: an unresolved parcel is as invisible as an
 *     unresolved texture). The bake and the fixture server SCAN that same
 *     tree, so this test is the third side of the triangle: all three agree
 *     about which districts have land, or one of them goes red.
 *   • EVERY PLOT'S doorAnchor MATCHES ITS PUBLISHED DESCRIPTOR'S `spawns[0]`.
 *     `derivePlotVenues` copies the anchor into the venue's spawn point, so
 *     the same number exists twice in two artifacts; the door, the fence gap
 *     and wherever the api puts an arriving agent all depend on them agreeing.
 *
 * Do not import Phaser: the module is tested under node --test.
 */
import districtPlots from '../../../../venues/district/plots.json' with { type: 'json' };

/** A plot's visible construction state (contract/plot_states.json `states`). */
export type PlotState = 'vacant' | 'under_construction' | 'built';

/** Which edge of the parcel the door anchor sits on. */
export type DoorSide = 'north' | 'south' | 'east' | 'west';

/**
 * One parcel, in TILE coordinates of the district map that draws it.
 *
 * `at` is the top-left corner, `size` the footprint, `doorAnchor` the point on
 * the perimeter where the parcel meets the street — the same anchor the plot's
 * published `spawns[0]` carries, which is what `plot-registry.test.mjs` cross-
 * checks so the two copies can never drift.
 */
export interface Plot {
  id: string;
  /** The district whose map draws this parcel. Not in the file — it IS the file's directory. */
  districtId: string;
  sizeClass: string;
  kind: 'housing' | 'civic';
  at: readonly [number, number];
  size: readonly [number, number];
  doorAnchor: readonly [number, number];
  doorSide: DoorSide;
  /** Archetypes whose footprint fits (D-66: computed from physics, never authored). */
  allowedArchetypes: readonly string[];
}

interface PlotDoc {
  plots: Plot[];
}

/**
 * One entry per `venues/<districtId>/plots.json`. A static import, because it
 * is what Vite bundles and what `node --test` resolves — `import.meta.glob`
 * would work in one of those two and not the other.
 */
const REGISTRIES: ReadonlyArray<{ districtId: string; doc: PlotDoc }> = [
  { districtId: 'district', doc: districtPlots as unknown as PlotDoc },
];

const PLOTS: readonly Plot[] = REGISTRIES.flatMap(({ districtId, doc }) =>
  (doc.plots ?? []).map(p => ({ ...p, districtId })),
);

const byId = new Map<string, Plot>(PLOTS.map(p => [p.id, p]));

/**
 * Location -> the district that DRAWS it, for every parcel.
 *
 * This is the merge-critical fact. A plot venue is `indoor: false`, so every
 * "is this outdoor?" test in the client says yes — but a plot is NOT a
 * district: it has no tilemap, no ground atlas of its own and no scene. Route
 * one as though it were and `DistrictScene` boots with `mapKey: 'plot_7'` and
 * draws a black screen, which is the farm bug with a new name. Merged into
 * `CLIENT_INTERNAL_LOCATIONS` (same shape, same purpose: "this location is
 * drawn by that district's map"), it routes to the district instead.
 */
export const PLOT_DISTRICTS: Readonly<Record<string, string>> =
  Object.freeze(Object.fromEntries(PLOTS.map(p => [p.id, p.districtId])));

export const plotRegistry = {
  all(): readonly Plot[] {
    return PLOTS;
  },
  get(id: string): Plot | undefined {
    return byId.get(id);
  },
  has(id: string): boolean {
    return byId.has(id);
  },
  /** The parcels drawn on one district's map, in authoring (append-only) order. */
  inDistrict(districtId: string): Plot[] {
    return PLOTS.filter(p => p.districtId === districtId);
  },
  /**
   * The districts whose plots.json this module actually imported — the list
   * `test/plot-registry.test.mjs` compares against the tree on disk. Exported
   * so the guard can read the SEAM rather than infer it from the plots, which
   * would make a registry entry with an empty `plots` array look absent.
   */
  registeredDistricts(): string[] {
    return REGISTRIES.map(r => r.districtId);
  },
};

/** Is this venue id a parcel rather than a place with a map of its own? */
export function isPlot(venueId: string): boolean {
  return byId.has(venueId);
}

/**
 * The single runtime authority on which venues exist.
 *
 * get() returns undefined for an unknown id — that is the `unknown` path
 * (spec §8.1), not an error. It is exactly what lets the platform add,
 * rename and retire venues without forcing BotVille to lie about where
 * an agent is.
 *
 * Do not import Phaser: the module is tested under node --test.
 */
import type { PublishedVenue, VenueDescriptor } from '@botville/shared';
import { VENUES } from './venues.generated.js';
import { isPlot, PLOT_DISTRICTS } from './plotRegistry.js';

const byId = new Map<string, VenueDescriptor>(VENUES.map(v => [v.id, v]));

export const venueRegistry = {
  all(): VenueDescriptor[] {
    return VENUES;
  },
  get(id: string): VenueDescriptor | undefined {
    return byId.get(id);
  },
  has(id: string): boolean {
    return byId.has(id);
  },
  indoor(): VenueDescriptor[] {
    return VENUES.filter(v => v.indoor);
  },
  /**
   * Every venue that is not inside something — the districts AND the parcels
   * drawn on them. D-79 published 23 plots as `indoor: false`, so "outdoor" is
   * no longer a synonym for "district": use `districts()` when the question is
   * "which map is this", and this one only when it is literally "is this
   * under a roof".
   */
  outdoor(): VenueDescriptor[] {
    return VENUES.filter(v => !v.indoor);
  },
  /**
   * The districts — outdoor venues that have a map of their own. D-62:
   * multi-district is architectural from day one, so this is a list and never
   * "the district". One district's content ships today; that is a fact about
   * the bake, not about the code.
   *
   * A PARCEL IS NOT A DISTRICT. A plot is outdoor and published (D-79), but it
   * is a rectangle ON a district's map: no tilemap, no ground atlas of its own,
   * no scene. Everything that used to ask `outdoor()` "which map do I draw"
   * asks this instead, or boots `DistrictScene` with `mapKey: 'plot_7'`.
   */
  districts(): VenueDescriptor[] {
    return VENUES.filter(v => !v.indoor && !isPlot(v.id));
  },
  /**
   * The venues the bake writes a `.tmj` for — F-2.
   *
   * `world-bake.mjs` runs its tilemap loop over authored venues and archetype
   * instances only; plot venues are appended AFTER it, precisely because a
   * vacant parcel has no interior. Asking the loader for all 41 venues
   * therefore asks for 23 files that were never written: 23 guaranteed 404s on
   * every boot, each one a red line in the console and a failed request the
   * progress bar still waits on. `test/preloader-scene.test.mjs` pins this list
   * against the baked `tilemaps/` directory in both directions, so the day a
   * built plot gains an interior the pin fails rather than the map going
   * missing.
   */
  withTilemap(): VenueDescriptor[] {
    return VENUES.filter(v => !isPlot(v.id));
  },
  published(): PublishedVenue[] {
    // Mirrors the bake's published projection EXACTLY (Plan 2 Task 18),
    // including the `archetype ?? id` default for authored venues — the
    // byte-for-byte test against the committed venues.json depends on it.
    return VENUES.map(v => ({
      id: v.id,
      label: v.label,
      indoor: v.indoor,
      capacity: v.capacity,
      archetype: v.archetype ?? v.id,
      roles: v.roles,
      affords: v.affords,
      hours: v.hours,
    }));
  },
};

/**
 * The one Phaser scene that draws outdoor venues. ONE class, N districts: it
 * takes the district it is drawing from scene data (see `sceneTargetFor`), so
 * a second district needs no second scene, no second key and no code.
 */
export const DISTRICT_SCENE_KEY = 'DistrictScene';

/**
 * Venue -> Phaser scene key, DERIVED FROM THE REGISTRY, never from an id.
 * Outdoor venues are drawn by the district scene (cars, glow, day/night);
 * all the interiors share the parameterised VenueScene. Adding a district is
 * therefore a bake change, not a code change (D-62).
 *
 * VENUES ONLY. This is what InteriorScene registers itself under and what
 * DistrictScene keys doors against, so it must stay a pure function of the
 * vocabulary. An id the registry does not know keeps its VenueScene key —
 * the `unknown` path (spec §8.1), unchanged. For "where do I draw an agent
 * reported at X", use `sceneForLocation`: X may be a client-internal
 * location, which is not a venue and has no scene of its own.
 */
export function sceneKeyForIn(venueId: string, venues: VenueLookup): string {
  return venues.get(venueId)?.indoor === false ? DISTRICT_SCENE_KEY : `VenueScene:${venueId}`;
}

export function sceneKeyFor(venueId: string): string {
  return sceneKeyForIn(venueId, venueRegistry);
}

/**
 * Locations the client knows that the published vocabulary does NOT contain,
 * each mapped to THE DISTRICT WHOSE MAP DRAWS IT. The value is what makes the
 * exemption multi-district-safe: a second district's own internal geography
 * belongs to that district, and the scene drawing district A must not pick up
 * an agent standing in district B's back yard.
 *
 * 'farm' is cosmetic district geography — the pen the cityGrid generator
 * draws inside the district map, with animals in it. It is a legitimate place
 * an agent can be, and the fixture server (D-28, the default dev runtime)
 * emits it: `packages/server/src/world/agentLife.ts:37` puts it in the human
 * daytime pool, `:38` in the animal pool, and `:100` sends EVERY animal there
 * at night. `packages/shared` AGENT_LOCATIONS carries it for the same reason.
 *
 * It is NOT drift, and it is NOT a venue: there is no VenueScene for it, no
 * entry in the registry, no door. This is the ONE list that says so, and both
 * the runtime (presence.ts's lookup, `districtForLocation` below) and
 * test/vocabulary-sync.test.mjs's client-vs-vocabulary check read it, so the
 * exemption can never be granted in one place and forgotten in another.
 */
export const CLIENT_INTERNAL_LOCATIONS: Readonly<Record<string, string>> = {
  farm: 'district',
};

/** The ids alone, for the checks that only care that a location is exempt. */
export const CLIENT_INTERNAL_LOCATION_IDS: readonly string[] = Object.keys(CLIENT_INTERNAL_LOCATIONS);

export function isClientInternalLocation(location: string): boolean {
  return Object.hasOwn(CLIENT_INTERNAL_LOCATIONS, location);
}

/**
 * Every location that is drawn by SOMEBODY ELSE'S map, in one table.
 *
 * Two kinds live here for one reason: neither has a map of its own, and both
 * would otherwise be resolved to themselves.
 *
 *  • client-internal geography (the farm pen) — not a venue at all;
 *  • PARCELS (D-79's plots) — venues, published, `indoor: false`, and still
 *    rectangles ON a district map. `venues/<district>/plots.json` is where the
 *    ownership comes from: the directory IS the answer.
 *
 * Merging them is what makes the plot case free. `districtForLocation`,
 * `sceneTargetFor` and the outdoor presence filter all read this one table, so
 * an agent asleep in Camp 7 is drawn by the district that contains Camp 7 —
 * and `DistrictScene` is never handed `plot_7` as the map to load.
 */
export const DRAWN_BY_DISTRICT: Readonly<Record<string, string>> = Object.freeze({
  ...CLIENT_INTERNAL_LOCATIONS,
  ...PLOT_DISTRICTS,
});

/** Just enough registry for the resolver — so a test can hand it a second district. */
export interface VenueLookup {
  get(id: string): VenueDescriptor | undefined;
}

/**
 * Which district DRAWS this location, if any — the single answer both the
 * scene routing and the outdoor scene's presence filter are derived from.
 *
 * A district is its own answer. Anything in `DRAWN_BY_DISTRICT` — the farm pen,
 * every parcel — belongs to the district named there. Everything else (an
 * interior, an id nobody knows) is not drawn outdoors at all, and gets
 * `undefined`.
 *
 * Injectable on purpose: it is what lets a test stand up a synthetic second
 * district and prove the capability without shipping a second district's
 * content (D-62 — capability, not exposure).
 */
export function districtForLocationIn(
  location: string,
  venues: VenueLookup,
  drawnBy: Readonly<Record<string, string>>,
): string | undefined {
  const owner = Object.hasOwn(drawnBy, location) ? drawnBy[location] : location;
  const venue = venues.get(owner);
  return venue && !venue.indoor ? venue.id : undefined;
}

/** The live resolver, over the shipped registry. */
export function districtForLocation(location: string): string | undefined {
  return districtForLocationIn(location, venueRegistry, DRAWN_BY_DISTRICT);
}

/**
 * Agent location -> the scene that draws it. Total over every location the
 * client can be told about: an outdoor venue and its internal geography go to
 * the district scene, an interior to its own, an unknown id keeps the venue
 * key nothing is registered under (the honest `unknown` path).
 *
 * Load-bearing, not a leftover. Route 'farm' through `sceneKeyFor` instead
 * and you get 'VenueScene:farm', a key no scene is registered under —
 * `transitionTo` fades out into a black screen that never comes back,
 * reachable from a HUD click on an agent "At the farm" and from a ?follow=
 * deep link.
 */
export function sceneForLocation(location: string): string {
  return sceneKeyFor(districtForLocation(location) ?? location);
}

/** A scene to start, with the data it needs to know WHICH place it is drawing. */
export interface SceneTarget {
  key: string;
  data?: { districtId: string };
}

/**
 * Where a click, a HUD jump or a ?follow= deep link should take the camera.
 *
 * The district scene is one scene for every district, so its key alone does
 * not say where you are going — the district id travels with it as scene
 * data. Anything that starts the outdoor scene must go through here; start
 * `DISTRICT_SCENE_KEY` bare and you get whichever district was last drawn.
 */
export function sceneTargetFor(location: string): SceneTarget {
  const districtId = districtForLocation(location);
  return districtId === undefined
    ? { key: sceneKeyFor(location) }
    : { key: DISTRICT_SCENE_KEY, data: { districtId } };
}

/**
 * Does going to `location` actually take you to a DIFFERENT scene from the
 * district currently on screen?
 *
 * The question a door has to answer before it promises anything. An authored
 * door leads to an interior, so this is always true for one; a BUILT PARCEL's
 * generated door resolves back to the district you are standing in, because
 * the plot id IS the venue id (D-79) while the bake writes an interior per
 * authored venue and archetype instance — and a parcel is neither. There is a
 * real door with no room behind it yet.
 *
 * One predicate, two consumers, so they cannot drift: `DistrictScene` asks it
 * to decide whether the cursor turns into a hand, and `transitionToVenue` asks
 * it before refusing a fade-out into the same view. A hand cursor over a click
 * that does nothing is the dead end this exists to stop.
 */
export function opensASceneFrom(location: string, currentDistrictId: string): boolean {
  const target = sceneTargetFor(location);
  return !(target.key === DISTRICT_SCENE_KEY && target.data?.districtId === currentDistrictId);
}

/**
 * The district the game boots into: the first outdoor venue in the bake.
 * Unambiguous while one district's content ships (D-62), and a loud failure
 * rather than a black screen if a bake ever ships none.
 */
export function startingDistrict(): VenueDescriptor {
  const [first] = venueRegistry.districts();
  if (!first) throw new Error('the bake declares no district — nothing can draw the world');
  return first;
}

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
   * The outdoor venues — the districts. D-62: multi-district is architectural
   * from day one, so this is a list and never "the district". One district's
   * content ships today; that is a fact about the bake, not about the code.
   */
  outdoor(): VenueDescriptor[] {
    return VENUES.filter(v => !v.indoor);
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

/** Just enough registry for the resolver — so a test can hand it a second district. */
export interface VenueLookup {
  get(id: string): VenueDescriptor | undefined;
}

/**
 * Which district DRAWS this location, if any — the single answer both the
 * scene routing and the outdoor scene's presence filter are derived from.
 *
 * An outdoor venue is its own district. A client-internal location belongs to
 * the district declared above. Everything else (an interior, an id nobody
 * knows) is not drawn outdoors at all, and gets `undefined`.
 *
 * Injectable on purpose: it is what lets a test stand up a synthetic second
 * district and prove the capability without shipping a second district's
 * content (D-62 — capability, not exposure).
 */
export function districtForLocationIn(
  location: string,
  venues: VenueLookup,
  internal: Readonly<Record<string, string>>,
): string | undefined {
  const owner = Object.hasOwn(internal, location) ? internal[location] : location;
  const venue = venues.get(owner);
  return venue && !venue.indoor ? venue.id : undefined;
}

/** The live resolver, over the shipped registry. */
export function districtForLocation(location: string): string | undefined {
  return districtForLocationIn(location, venueRegistry, CLIENT_INTERNAL_LOCATIONS);
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
 * The district the game boots into: the first outdoor venue in the bake.
 * Unambiguous while one district's content ships (D-62), and a loud failure
 * rather than a black screen if a bake ever ships none.
 */
export function startingDistrict(): VenueDescriptor {
  const [first] = venueRegistry.outdoor();
  if (!first) throw new Error('the bake declares no outdoor venue — nothing can draw the world');
  return first;
}

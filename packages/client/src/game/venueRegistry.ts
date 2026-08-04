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
 * Venue -> Phaser scene key. The district is drawn by its own scene (cars,
 * glow, day/night); all the interiors share one parameterised VenueScene.
 *
 * VENUES ONLY. This is what InteriorScene registers itself under and what
 * DistrictScene keys its doors by, so it must stay a pure function of the
 * vocabulary. For "where do I draw an agent reported at X", use
 * `sceneForLocation` — X may be a client-internal location, which is not a
 * venue and has no scene of its own.
 */
export function sceneKeyFor(venueId: string): string {
  return venueId === 'district' ? 'DistrictScene' : `VenueScene:${venueId}`;
}

/**
 * Locations the client knows that the published vocabulary does NOT contain.
 *
 * 'farm' is cosmetic district geography — the pen the cityGrid generator
 * draws inside DistrictScene, with animals in it. It is a legitimate place an
 * agent can be, and the fixture server (D-28, the default dev runtime) emits
 * it: `packages/server/src/world/agentLife.ts:37` puts it in the human
 * daytime pool, `:38` in the animal pool, and `:100` sends EVERY animal there
 * at night. `packages/shared` AGENT_LOCATIONS carries it for the same reason.
 *
 * It is NOT drift, and it is NOT a venue: there is no VenueScene for it, no
 * entry in the registry, no door. This is the ONE list that says so, and both
 * the runtime (presence.ts's lookup, `sceneForLocation` below) and
 * test/vocabulary-sync.test.mjs's client-vs-vocabulary check read it, so the
 * exemption can never be granted in one place and forgotten in another.
 */
export const CLIENT_INTERNAL_LOCATIONS = ['farm'] as const;

export function isClientInternalLocation(location: string): boolean {
  return (CLIENT_INTERNAL_LOCATIONS as readonly string[]).includes(location);
}

/**
 * Agent location -> the scene that draws it. Total over every location the
 * client can be told about: a venue goes to its own scene, a client-internal
 * location goes to the scene that draws it (the farm is district geography).
 *
 * Load-bearing, not a leftover. Route 'farm' through `sceneKeyFor` instead
 * and you get 'VenueScene:farm', a key no scene is registered under —
 * `transitionTo` fades out into a black screen that never comes back,
 * reachable from a HUD click on an agent "At the farm" and from a ?follow=
 * deep link.
 */
export function sceneForLocation(location: string): string {
  if (isClientInternalLocation(location)) return 'DistrictScene';
  // An OUTDOOR venue has no scene of its own either — only interiors get a
  // VenueScene (see `indoor()`, which is what the scene factory walks). Plot
  // venues (D-79: the plot id IS the venue id) are the case that made this
  // matter: 23 of them are published, they are parcels drawn on the district
  // map, and routing one through sceneKeyFor would hand transitionTo a
  // 'VenueScene:plot_7' that no scene is registered under — the same black
  // screen the farm produced.
  const venue = byId.get(location);
  if (venue && !venue.indoor) return 'DistrictScene';
  return sceneKeyFor(location);
}

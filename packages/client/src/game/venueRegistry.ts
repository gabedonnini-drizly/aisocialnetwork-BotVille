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
 */
export function sceneKeyFor(venueId: string): string {
  return venueId === 'district' ? 'DistrictScene' : `VenueScene:${venueId}`;
}

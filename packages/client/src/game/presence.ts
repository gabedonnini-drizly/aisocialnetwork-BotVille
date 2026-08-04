/**
 * F-3: the live wiring that makes PresenceModel the runtime authority over
 * "who is where" — retiring the six-string AGENT_LOCATIONS clamp that used
 * to silently fold any unknown id into 'district'.
 *
 * 'farm' is not a venue (no VenueScene instance, no entry in the venue
 * registry) — it is cosmetic geography drawn inside DistrictScene (see
 * venueRegistry.CLIENT_INTERNAL_LOCATIONS and sceneForLocation) — but it IS a
 * legitimate place an agent can be, so the live lookup treats it as known
 * alongside every registered venue.
 *
 * Does not import Phaser: tested under node --test.
 */
import type { AgentPresence } from '@botville/shared';
import { PresenceModel } from './PresenceModel.js';
import { isClientInternalLocation, venueRegistry } from './venueRegistry.js';

interface VenueLookup { has(id: string): boolean }

/**
 * venueRegistry + the client-internal locations. The exemption itself lives
 * in venueRegistry (CLIENT_INTERNAL_LOCATIONS), so this lookup, the scene
 * mapping and the vocabulary-sync check cannot disagree about what is a
 * legitimate non-venue place.
 */
export const liveVenueLookup: VenueLookup = {
  has(id: string): boolean {
    return isClientInternalLocation(id) || venueRegistry.has(id);
  },
};

/** The runtime PresenceModel: constructed once, over the live registry (+farm). */
export const presenceModel = new PresenceModel(liveVenueLookup);

/** Every id the partition places "somewhere" (any venue, or farm) — the only ids any scene may draw. */
export function flattenSomewhere(somewhere: Map<string, AgentPresence[]>): Set<string> {
  const ids = new Set<string>();
  for (const bucket of somewhere.values()) for (const p of bucket) ids.add(p.id);
  return ids;
}

/**
 * A compact, once-per-id logger for ids PresenceModel could not place anywhere
 * (the honest I-3 alternative to the retired clamp, which silently drew them
 * in the district instead). `logger` is injectable so this stays node-testable
 * without spying on the real console.
 */
export function createUnknownWarner(logger: (msg: string) => void = (m) => console.warn(m)) {
  const warned = new Set<string>();
  return (unknown: readonly AgentPresence[]): void => {
    for (const p of unknown) {
      if (warned.has(p.id)) continue;
      warned.add(p.id);
      logger(`[presence] agent ${p.id}: unknown venue "${p.venueId}" — not drawn anywhere (I-3)`);
    }
  };
}

/** The live singleton warner — one dedupe Set for the whole session. */
export const warnUnknown = createUnknownWarner();

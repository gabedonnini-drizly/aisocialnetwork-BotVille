/**
 * Residence provisioning (2026-07-29 addendum §I.2, §I.3). Pure functions of
 * the town — no fixed residence count exists anywhere.
 *
 * THE INSTANCE LIST IS APPEND-ONLY. Ids are `house_1..house_N` in
 * provisioning order; growing the town appends, never reshuffles. The api
 * assigns agents to residences by roster creation order against this stable
 * prefix (Plan 5 Task 32 deriveHomeVenue), which is what makes "my agent's
 * home" a durable fact with zero stored rows.
 *
 * The occupancy target is defined HERE and nowhere else. It reaches the api
 * as each instance's published `capacity` — data, not a mirrored constant.
 *
 * The stamping itself is not residence-specific and lives in archetypes.mjs;
 * what is residence-specific is the count.
 */
import { deriveInstances } from './archetypes.mjs';

/** Addendum §I.2: target ≈ 6–8 agents per residence. */
export const RESIDENCE_OCCUPANCY_TARGET_AGENTS = 7;

/** @param {{population: number}} town */
export function deriveResidenceCount(town) {
  const p = town?.population;
  if (!Number.isInteger(p) || p < 0) {
    throw new Error(`deriveResidenceCount: town.population must be a non-negative integer, got ${p}`);
  }
  return Math.ceil(p / RESIDENCE_OCCUPANCY_TARGET_AGENTS);
}

/**
 * Stamp concrete residence descriptors out of an archetype: the residence
 * generator, i.e. the town-driven count plus the general stamper.
 * One archetype in v1; when `apartment`/`hotel` land, this is where the
 * seeded per-archetype mix goes — deterministic in (townId, index), per the
 * addendum. With one archetype a weight table would have one row.
 *
 * @param {{population: number}} town
 * @param {object} archetype — venues/_archetypes/<name>.json
 * @returns {object[]} VenueDescriptor[]
 */
export function deriveResidenceInstances(town, archetype) {
  return deriveInstances(archetype, deriveResidenceCount(town));
}

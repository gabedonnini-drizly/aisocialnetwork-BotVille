/**
 * The generator registry: which archetypes the town actually stamps, and how
 * many of each.
 *
 * `deriveInstances` (archetypes.mjs) knows how to stamp N copies of a
 * template. It does not know N. N is the generator's business, and the
 * generators live here — one small pure function per archetype that has one,
 * each a function of the town snapshot alone.
 *
 * ── ABSENCE IS ZERO ──────────────────────────────────────────────────────
 *
 * An archetype with no entry in this registry stamps NOTHING. That is the
 * whole mechanism behind "declared, not instantiated" (D-76's condo, and the
 * ladder tiers whose instantiation belongs to plan `01-`): the art is
 * declared, the contract names resolve, the template is authored and
 * validated — and the town gets zero of them until a generator says
 * otherwise.
 *
 * Absence rather than an explicit `0` is deliberate. A registry of
 * `{ house: …, condo: () => 0, villa: () => 0, … }` makes dormancy something
 * you must remember to write down, so the failure mode of forgetting is a
 * NEW archetype silently entering the published vocabulary — a
 * home-reassignment event, in the residence case (kickoff correction 3).
 * With absence-is-zero the failure mode of forgetting is that nothing
 * happens, which is the direction a vocabulary this many downstream systems
 * read should fail in.
 */
import { deriveResidenceCount } from './residences.mjs';

/**
 * archetype name -> (town) => count.
 *
 * @type {Record<string, (town: {population: number}) => number>}
 */
export const GENERATORS = {
  house: town => deriveResidenceCount(town),
};

/**
 * How many instances of `archetypeName` this town provisions.
 * Zero for any archetype without a generator — see ABSENCE IS ZERO above.
 *
 * @param {string} archetypeName
 * @param {{population: number}} town
 * @returns {number}
 */
export function countFor(archetypeName, town) {
  const generator = GENERATORS[archetypeName];
  return generator ? generator(town) : 0;
}

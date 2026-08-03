/**
 * Archetype instancing (2026-07-29 addendum §I.2, §I.3) — the general form of
 * the pattern residences were the first instance of.
 *
 * An archetype is a template under `venues/_archetypes/`; a generator decides
 * how many of it the town gets and stamps them out through here. The count is
 * the generator's business (residences derive it from population); the
 * stamping is the same for every archetype, so it lives in one place.
 *
 * THE INSTANCE LIST IS APPEND-ONLY. Ids are `<archetype>_1..N` in
 * provisioning order; raising the count appends, never reshuffles. Ids are
 * namespaced by archetype name, which is what lets a second archetype stamp
 * alongside the first without colliding.
 */

/**
 * Stamp `count` concrete venue descriptors out of one archetype.
 *
 * `id` and `label` are STAMPED, not copied: whatever the template carries
 * under those keys is overridden, because they are per-instance facts. Every
 * other field is copied verbatim, so it must be true of all instances.
 *
 * @param {object} archetype — venues/_archetypes/<name>.json
 * @param {number} count — non-negative integer, derived by the caller
 * @param {{labelPrefix?: string}} [opts] — overrides the archetype's own
 *   `labelPrefix`. THE LABEL ONLY: the id namespace is always
 *   `archetype.archetype`, and no option changes it. This is not a way to
 *   stamp a template "under a different name" — `deriveInstances(house, 5,
 *   { labelPrefix: 'Villa' })` yields ids `house_1..5` labelled "Villa 1..5",
 *   which would collide with the residences rather than sit beside them. To
 *   stamp a different family, author a different archetype. Either way
 *   `labelPrefix` is stripped from the instance: it is authoring metadata,
 *   not a field of a published venue.
 * @returns {object[]} VenueDescriptor[]
 */
export function deriveInstances(archetype, count, opts = {}) {
  if (!archetype?.archetype) {
    throw new Error('deriveInstances: archetype.archetype is required — it is the id namespace');
  }
  if (!Number.isInteger(count) || count < 0) {
    throw new Error(`deriveInstances: count must be a non-negative integer, got ${count}`);
  }
  return Array.from({ length: count }, (_, i) => {
    // structuredClone is a Node global (≥17): each instance must be an
    // independent copy — the "instances are independent copies" test pins it.
    const { labelPrefix, ...template } = structuredClone(archetype);
    return {
      ...template,
      id: `${archetype.archetype}_${i + 1}`,
      label: `${opts.labelPrefix ?? labelPrefix ?? archetype.archetype} ${i + 1}`,
    };
  });
}

/**
 * Plot venues (D-79, D-89).
 *
 * D-79 decoupled venue identity from archetype: THE PLOT ID IS THE VENUE ID,
 * baked once, and the built archetype later selects the interior TMJ, the
 * exterior sprite and what the place affords. So a plot is published from the
 * day the land exists, not from the day something stands on it — which is
 * what lets an unhoused agent resolve to a real venue instead of nowhere.
 *
 * D-89 fixes what a VACANT plot publishes: `roles: ["home"]`,
 * `affords: ["sleep"]` — the homeless camp standing on land the town has not
 * built on (D-60, made literal). That shape is not a preference; it is the
 * only one that leaves every daytime derivation untouched. Measured against
 * the api's own helpers: every other shape (hangout/idle, work/work,
 * hangout/wander) changes `deriveVenuesAffording` or the capacity-weighted
 * hangout/workplace pools for 31+ agents. `home` is excluded from
 * `publicVenues` by construction, so a home-role plot cannot enter any public
 * candidate pool at all.
 *
 * It is safe on the home side too, and for a structural reason rather than a
 * lucky one: plot ids sort AFTER every house under the numeric collation
 * `deriveResidenceVenues` uses, so the residence list grows by APPENDING, and
 * `deriveHomeVenue` fills to published capacity in order. Existing capacity
 * (97) already exceeds the roster (85), so no agent's derived home reaches a
 * plot. test/plots.test.mjs pins both halves.
 *
 * A vacant plot has NO interior and therefore no TMJ and no scene of its own:
 * it is a parcel drawn on the district map. `world-bake.mjs` keeps it out of
 * the tilemap loop for that reason, and the client routes outdoor venues to
 * DistrictScene (venueRegistry.sceneForLocation).
 */

/** The camp a vacant plot is. Small on purpose — it is a tent, not a house. */
export const VACANT_PLOT_CAPACITY = 4;

/**
 * Stamp one venue descriptor per authored plot.
 *
 * @param {{plots: object[]}} registry — venues/district/plots.json
 * @param {{groundAtlas?: string}} [opts]
 * @returns {object[]} VenueDescriptor[]
 */
export function derivePlotVenues(registry, opts = {}) {
  const plots = registry?.plots;
  if (!Array.isArray(plots)) {
    throw new Error('derivePlotVenues: plots.json has no `plots` array');
  }
  return plots.map(p => {
    if (!p.id) throw new Error('derivePlotVenues: a plot has no id — the id IS the venue id (D-79)');
    return {
      id: p.id,
      label: labelFor(p),
      indoor: false,
      sizeTiles: p.size,
      groundAtlas: opts.groundAtlas ?? 'district_ground',
      capacity: VACANT_PLOT_CAPACITY,
      archetype: 'plot',
      // D-89. State-dependent: when the plot is built, the archetype supplies
      // these instead. Vacant, it is the tent camp.
      roles: ['home'],
      affords: ['sleep'],
      hours: [{ open: 0, close: 24 }],
      furniture: [],
      seats: [],
      // The door anchor is where the parcel meets the street, so it is also
      // the only sensible place to put someone who arrives at it.
      spawns: [p.doorAnchor],
      animated: [],
      doors: [],
      glows: [],
    };
  });
}

/**
 * "Camp 3", not "Plot 3": the label is what an agent is told, and while the
 * plot is vacant the thing standing there is a camp. The id stays `plot_3` —
 * ids are identity, labels are description.
 */
function labelFor(p) {
  const n = String(p.id).replace(/^plot_/, '');
  return `Camp ${n}`;
}

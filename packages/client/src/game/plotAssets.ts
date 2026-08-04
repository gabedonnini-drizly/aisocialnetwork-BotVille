/**
 * The two runtime-loaded plot data files, named in one place.
 *
 * PreloaderScene queues them; DistrictScene reads them out of the JSON cache.
 * The keys live here rather than as literals at both ends because a typo at
 * either end is a silent empty town — `cache.json.get` returns undefined, and
 * `composePlot` would then be asked to compose against nothing.
 *
 * Do not import Phaser: the module is tested under node --test.
 */
export const PLOT_STATES_KEY = 'plot-states';
export const VARIANT_POOLS_KEY = 'variant-pools';

/** Where the bake writes them (world-bake.mjs), relative to the client's assets. */
export const PLOT_STATES_PATH = 'assets/plot_states.json';
export const VARIANT_POOLS_PATH = 'assets/variant_pools.json';

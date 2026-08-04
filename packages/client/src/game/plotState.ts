/**
 * WHAT STATE EACH PARCEL IS IN — the seam, and the honest default.
 *
 * Measured, not assumed: as of this commit plot state is on NO wire the client
 * consumes. `LocationsSnapshot` (packages/shared/src/types/Assets.ts) carries
 * schemaVersion, gameHour and a roster of AgentPresence, and nothing else; the
 * api's `GET /api/public/botville/locations` serves exactly that
 * (botvilleController.js:17). The api HAS the state machine and the table
 * (migration 045, plotsService.js) — it just does not publish them yet.
 *
 * So the default is `vacant` for every parcel, AND THAT IS TRUE TODAY, not a
 * placeholder: nothing has been claimed or built, and `deriveHomeVenue` fills
 * to published capacity in id order, which reaches the houses (97 beds) long
 * before it reaches a camp. When the wire carries state, `applyPlotStates`
 * is the only thing that has to be called — no scene, no composition and no
 * data file changes.
 *
 * Do not import Phaser: the module is tested under node --test.
 */
import type { PlotState } from './plotRegistry.js';
import { plotRegistry } from './plotRegistry.js';

/** The state a parcel is in until something says otherwise. */
export const DEFAULT_PLOT_STATE: PlotState = 'vacant';

/** One parcel's state, plus what stands on it once something does. */
export interface PlotStatus {
  state: PlotState;
  /** Set only for `built`: the archetype, which selects the exterior art. */
  archetype?: string;
}

const VACANT: PlotStatus = Object.freeze({ state: DEFAULT_PLOT_STATE });

const statuses = new Map<string, PlotStatus>();
const listeners = new Set<() => void>();

/**
 * A row as a state source delivers it. Deliberately tolerant in the same shape
 * as `fetchPlatformLocations`: an unknown state or an id that is not a parcel
 * is DROPPED, never rendered. The client renders nothing the source did not
 * assert, and it does not invent a fourth state (I-3).
 */
export interface PlotStateRow {
  id?: unknown;
  state?: unknown;
  archetype?: unknown;
}

/** The states the client will accept off a wire — the declared enum, closed. */
export const KNOWN_PLOT_STATES: readonly PlotState[] = ['vacant', 'under_construction', 'built'];

export function plotStatus(plotId: string): PlotStatus {
  return statuses.get(plotId) ?? VACANT;
}

export function plotStateOf(plotId: string): PlotState {
  return plotStatus(plotId).state;
}

/**
 * Apply a source's rows. Returns true if anything actually moved, so a poll
 * that says the same thing every 15 seconds does not redraw the town.
 */
export function applyPlotStates(rows: readonly PlotStateRow[]): boolean {
  let changed = false;
  const seen = new Set<string>();
  for (const row of rows) {
    if (typeof row?.id !== 'string' || !plotRegistry.has(row.id)) continue;
    if (typeof row.state !== 'string') continue;
    if (!KNOWN_PLOT_STATES.includes(row.state as PlotState)) continue;
    const next: PlotStatus = { state: row.state as PlotState };
    if (typeof row.archetype === 'string') next.archetype = row.archetype;
    seen.add(row.id);
    const prev = statuses.get(row.id);
    if (prev?.state !== next.state || prev?.archetype !== next.archetype) changed = true;
    statuses.set(row.id, next);
  }
  // A parcel the source stopped mentioning falls back to the default rather
  // than keeping a stale state forever.
  for (const id of [...statuses.keys()]) {
    if (!seen.has(id)) { statuses.delete(id); changed = true; }
  }
  if (changed) for (const cb of listeners) cb();
  return changed;
}

/** Test seam and boot state: forget everything a source ever said. */
export function resetPlotStates(): void {
  const had = statuses.size > 0;
  statuses.clear();
  if (had) for (const cb of listeners) cb();
}

/** Scenes subscribe so a state change redraws the land without a reload. */
export function onPlotStatesChanged(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

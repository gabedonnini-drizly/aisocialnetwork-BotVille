import { Router } from 'express';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * GET /api/world/plots — the parcels and what state each is in.
 *
 * THE FIXTURE-MODE HALF of plan `03-` Task 2's state seam. In integrated mode
 * the platform api owns plot state (migration 045, plotsService.js's state
 * machine) and will serve it on its own surface; this server exists so the
 * default dev runtime (D-28) is fully self-contained, and it answers the same
 * question with the same shape.
 *
 * EVERY PLOT IS `vacant`, AND THAT IS THE TRUTH, not a stub. Nothing has been
 * claimed and nothing has been built — the client's DEFAULT_PLOT_STATE says
 * the same thing for the same reason, and both read it from the same place so
 * they cannot drift into disagreeing about an empty town.
 *
 * It deliberately does NOT move any agent onto a plot. Camps render for the
 * agents the world puts there, and putting them there is a change to the
 * fixture world's daytime pools — a behaviour change to existing venues, which
 * this task is not.
 */
export const plotsRouter = Router();

const HERE = dirname(fileURLToPath(import.meta.url));

/**
 * The repo's `venues/` directory — the tree world-bake.mjs walks.
 *
 * dist/api/ -> package -> packages/ -> repo root, and the src/ equivalent
 * under tsx. Both are tried rather than assumed, so `npm run dev` and a built
 * server behave identically.
 */
function venuesRoot(): string | null {
  for (const up of ['../../../..', '../../..']) {
    const candidate = resolve(HERE, up, 'venues');
    if (existsSync(candidate)) return candidate;
  }
  const cwd = join(process.cwd(), 'venues');
  return existsSync(cwd) ? cwd : null;
}

export interface PlotStateRow {
  id: string;
  state: 'vacant' | 'under_construction' | 'built';
  /** Which district's map draws this parcel — the directory it came from. */
  districtId: string;
}

/** Read once: the layout is frozen (plots.json's `appendOnlyFrom` header). */
let cached: PlotStateRow[] | null = null;

/**
 * EVERY district's parcels, from the same `venues/<district>/plots.json` walk
 * the bake does. Not one hardcoded path: a second district's plots would have
 * been served as "there are none", which is indistinguishable from a working
 * empty town and is exactly the vacuous green D-62 keeps costing us.
 *
 * A district directory with no plots.json contributes nothing, which is
 * legitimate — a district may simply have no parcels.
 */
export function listPlots(): PlotStateRow[] {
  if (cached) return cached;
  const root = venuesRoot();
  if (!root) {
    // No venues tree at all. An empty list, not a 500: this server must run
    // against a bake that predates the land.
    cached = [];
    return cached;
  }
  cached = readdirSync(root, { withFileTypes: true })
    .filter(e => e.isDirectory() && !e.name.startsWith('_') && !e.name.startsWith('.'))
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap(e => {
      const file = join(root, e.name, 'plots.json');
      if (!existsSync(file)) return [];
      const doc = JSON.parse(readFileSync(file, 'utf8')) as { plots?: Array<{ id?: string }> };
      return (doc.plots ?? [])
        .filter((p): p is { id: string } => typeof p.id === 'string')
        .map(p => ({ id: p.id, state: 'vacant' as const, districtId: e.name }));
    });
  return cached;
}

/** Test seam: the layout is frozen, but a test may add a synthetic district. */
export function resetPlotCache(): void {
  cached = null;
}

plotsRouter.get('/plots', (_req, res) => {
  res.json({ data: { plots: listPlots() } });
});

import { Router } from 'express';
import { existsSync, readFileSync } from 'node:fs';
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

/** The authoring file the bake derives — the same one plotRegistry.ts imports. */
function plotsFile(): string | null {
  // dist/api/ -> package -> packages/ -> repo root, and the src/ equivalent
  // under tsx. Both are tried rather than assumed, so `npm run dev` and a
  // built server behave identically.
  for (const up of ['../../../..', '../../..']) {
    const candidate = resolve(HERE, up, 'venues', 'district', 'plots.json');
    if (existsSync(candidate)) return candidate;
  }
  const cwd = join(process.cwd(), 'venues', 'district', 'plots.json');
  return existsSync(cwd) ? cwd : null;
}

export interface PlotStateRow {
  id: string;
  state: 'vacant' | 'under_construction' | 'built';
}

/** Read once: the layout is frozen (plots.json's `appendOnlyFrom` header). */
let cached: PlotStateRow[] | null = null;

export function listPlots(): PlotStateRow[] {
  if (cached) return cached;
  const file = plotsFile();
  if (!file) {
    // No plots file = a district with no parcels. An empty list, not a 500:
    // this server must run against a bake that predates the land.
    cached = [];
    return cached;
  }
  const doc = JSON.parse(readFileSync(file, 'utf8')) as { plots?: Array<{ id?: string }> };
  cached = (doc.plots ?? [])
    .filter((p): p is { id: string } => typeof p.id === 'string')
    .map(p => ({ id: p.id, state: 'vacant' as const }));
  return cached;
}

plotsRouter.get('/plots', (_req, res) => {
  res.json({ data: { plots: listPlots() } });
});

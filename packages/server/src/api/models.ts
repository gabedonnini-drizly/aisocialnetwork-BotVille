import { Router } from 'express';
import { OPENROUTER_BASE_URL } from '@botville/shared';
import type { CatalogModel } from '@botville/shared';
import { openRouterConfig } from '../config.js';
import { openRouterHeaders } from '../llm/LLMRouter.js';

// TZ-14: live OpenRouter model catalog.
//
// OpenRouter's list is PUBLIC — the user's key is neither passed here nor
// needed. The URL is hardcoded: the endpoint accepts no user-supplied addresses
// and therefore can't become an open proxy to the outside.

export const modelsRouter = Router();

const CATALOG_URL = `${OPENROUTER_BASE_URL}/models`;
const FETCH_TIMEOUT_MS = Number(process.env.OPENROUTER_CATALOG_TIMEOUT_MS ?? 8000);

let cache: { models: CatalogModel[]; fetchedAt: number } | null = null;
let inflight: Promise<CatalogModel[]> | null = null;

interface RawModel {
  id?: unknown;
  name?: unknown;
  context_length?: unknown;
  pricing?: { prompt?: unknown; completion?: unknown };
}

/** OpenRouter prices are strings in USD per 1 token. Convert to USD per 1M tokens. */
function perMillion(raw: unknown): number | null {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return null;
  return n * 1_000_000;
}

function normalize(raw: RawModel): CatalogModel | null {
  const id = typeof raw.id === 'string' ? raw.id : null;
  if (!id) return null;
  const promptPrice = perMillion(raw.pricing?.prompt);
  const completionPrice = perMillion(raw.pricing?.completion);
  return {
    id,
    name: typeof raw.name === 'string' && raw.name ? raw.name : id,
    contextWindow: Number(raw.context_length) || 0,
    promptPrice,
    completionPrice,
    // `:free` is OpenRouter's own marker; a zero price confirms it
    isFree: id.endsWith(':free') || (promptPrice === 0 && completionPrice === 0),
  };
}

async function fetchCatalog(): Promise<CatalogModel[]> {
  const res = await fetch(CATALOG_URL, {
    headers: openRouterHeaders(),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`OpenRouter catalog ${res.status}`);
  const json = (await res.json()) as { data?: RawModel[] };
  const models = (json.data ?? [])
    .map(normalize)
    .filter((m): m is CatalogModel => m !== null);
  if (!models.length) throw new Error('OpenRouter catalog empty');
  // Free models first, then by name — the UI shows them as a separate block,
  // but they shouldn't drown in the overall list either.
  models.sort((a, b) =>
    a.isFree === b.isFree ? a.name.localeCompare(b.name) : a.isFree ? -1 : 1,
  );
  return models;
}

// GET /api/models/openrouter — in-memory cache, default TTL 1 h
modelsRouter.get('/openrouter', async (_req, res) => {
  const fresh = cache && Date.now() - cache.fetchedAt < openRouterConfig.catalogTtlMs;
  if (fresh) return res.json({ data: { models: cache!.models, cachedAt: cache!.fetchedAt } });

  try {
    // Parallel requests after the cache expires must not hit OpenRouter in a
    // burst — they wait on one shared promise.
    inflight ??= fetchCatalog().finally(() => { inflight = null; });
    const models = await inflight;
    cache = { models, fetchedAt: Date.now() };
    res.json({ data: { models, cachedAt: cache.fetchedAt } });
  } catch {
    // Catalog unavailable — serve the stale one if we have it: being able to
    // pick a model matters more than showing a fresh list.
    if (cache) return res.json({ data: { models: cache.models, cachedAt: cache.fetchedAt, stale: true } });
    res.status(503).json({ error: { code: 'CATALOG_UNAVAILABLE', message: 'Model catalog unavailable' } });
  }
});

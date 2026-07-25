import { Router } from 'express';
import { OPENROUTER_BASE_URL } from '@botville/shared';
import type { CatalogModel } from '@botville/shared';
import { openRouterConfig } from '../config.js';
import { openRouterHeaders } from '../llm/LLMRouter.js';

// ТЗ-14: живой каталог моделей OpenRouter.
//
// Список у OpenRouter ПУБЛИЧНЫЙ — ключ юзера сюда не передаётся и не нужен.
// URL зашит намертво: эндпоинт не принимает пользовательских адресов и потому
// не может стать открытым прокси наружу.

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

/** Цена у OpenRouter — строка USD за 1 токен. Приводим к USD за 1M токенов. */
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
    // `:free` — маркер самого OpenRouter; нулевая цена подтверждает
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
  // Бесплатные вперёд, дальше по имени — UI показывает их отдельным блоком,
  // но и в общем списке они не должны тонуть.
  models.sort((a, b) =>
    a.isFree === b.isFree ? a.name.localeCompare(b.name) : a.isFree ? -1 : 1,
  );
  return models;
}

// GET /api/models/openrouter — кэш в памяти, TTL по умолчанию 1 ч
modelsRouter.get('/openrouter', async (_req, res) => {
  const fresh = cache && Date.now() - cache.fetchedAt < openRouterConfig.catalogTtlMs;
  if (fresh) return res.json({ data: { models: cache!.models, cachedAt: cache!.fetchedAt } });

  try {
    // Параллельные запросы после протухания кэша не должны бить по OpenRouter
    // пачкой — ждут один общий промис.
    inflight ??= fetchCatalog().finally(() => { inflight = null; });
    const models = await inflight;
    cache = { models, fetchedAt: Date.now() };
    res.json({ data: { models, cachedAt: cache.fetchedAt } });
  } catch {
    // Каталог недоступен — отдаём протухший, если он есть: выбрать модель
    // важнее, чем показать свежий список.
    if (cache) return res.json({ data: { models: cache.models, cachedAt: cache.fetchedAt, stale: true } });
    res.status(503).json({ error: { code: 'CATALOG_UNAVAILABLE', message: 'Model catalog unavailable' } });
  }
});

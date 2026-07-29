import { Router } from 'express';
import { getDb } from '../db/schema.js';
import { encryptKey, decryptKey } from '../crypto/keyEncryption.js';
import { checkApiKey } from '../llm/keyCheck.js';
import { validateBaseUrl } from '../llm/baseUrl.js';
import { LLM_PROVIDERS } from '@botville/shared';
import type { LLMProviderType, SetUserKeyDto, UserKeyStatus } from '@botville/shared';

// TZ-14: USER-level keys — entered once and reused by all new agents. The key
// itself is never returned: only the "configured" fact and a masked tail. Keys
// are never written to logs (there isn't a single console.* here).

export const keysRouter = Router();

/** Providers for which storing a key makes sense at all. */
const KEYABLE = new Set<LLMProviderType>(
  LLM_PROVIDERS.filter(p => p.requiresApiKey).map(p => p.id),
);

function isKeyable(value: string): value is LLMProviderType {
  return KEYABLE.has(value as LLMProviderType);
}

/** Key tail for recognition: `…f3a9`. Short keys are not revealed at all. */
function maskKey(apiKey: string): string {
  return apiKey.length >= 8 ? `…${apiKey.slice(-4)}` : '…';
}

/** Whether this provider needs a user-supplied baseUrl (custom). */
function needsBaseUrl(provider: LLMProviderType): boolean {
  return LLM_PROVIDERS.find(p => p.id === provider)?.userBaseUrl === true;
}

// GET /api/keys — which providers are configured (no keys included)
keysRouter.get('/', (req, res) => {
  const userId = req.userId;
  if (!userId) return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Missing user id' } });
  const rows = getDb()
    .prepare('SELECT provider, masked_key, base_url, updated_at FROM user_keys WHERE user_id = ?')
    .all(userId) as Record<string, unknown>[];
  const data: UserKeyStatus[] = rows.map(r => ({
    provider: r.provider as LLMProviderType,
    maskedKey: r.masked_key as string,
    baseUrl: (r.base_url as string) ?? undefined,
    updatedAt: r.updated_at as number,
  }));
  res.json({ data });
});

// PUT /api/keys/:provider — save/update the user's key + health check
keysRouter.put('/:provider', async (req, res) => {
  const userId = req.userId;
  if (!userId) return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Missing user id' } });

  const provider = req.params.provider;
  if (!isKeyable(provider)) {
    return res.status(400).json({ error: { code: 'INVALID_PROVIDER', message: 'Unknown provider' } });
  }

  const { apiKey, baseUrl } = (req.body ?? {}) as SetUserKeyDto;
  if (!apiKey || typeof apiKey !== 'string') {
    return res.status(400).json({ error: { code: 'INVALID_BODY', message: 'apiKey required' } });
  }

  let storedBaseUrl: string | null = null;
  if (needsBaseUrl(provider)) {
    if (!baseUrl) {
      return res.status(400).json({ error: { code: 'BASE_URL_REQUIRED', message: 'baseUrl required' } });
    }
    const check = validateBaseUrl(baseUrl);
    if (!check.ok) {
      return res.status(400).json({ error: { code: check.code!, message: 'Invalid base URL' } });
    }
    storedBaseUrl = check.url!;
  }

  const { encrypted, iv } = encryptKey(apiKey);
  const now = Date.now();
  getDb().prepare(`
    INSERT INTO user_keys (user_id, provider, encrypted_key, iv, masked_key, base_url, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, provider) DO UPDATE SET
      encrypted_key = excluded.encrypted_key,
      iv = excluded.iv,
      masked_key = excluded.masked_key,
      base_url = excluded.base_url,
      updated_at = excluded.updated_at
  `).run(userId, provider, encrypted, iv, maskKey(apiKey), storedBaseUrl, now, now);

  // Same as with an agent key: false — the provider rejected it, null — the
  // check couldn't be performed. A network error does not cancel the save.
  const valid = await checkApiKey(provider, apiKey, storedBaseUrl ?? undefined);
  res.json({ data: { ok: true, valid, maskedKey: maskKey(apiKey), baseUrl: storedBaseUrl ?? undefined } });
});

// DELETE /api/keys/:provider
keysRouter.delete('/:provider', (req, res) => {
  const userId = req.userId;
  if (!userId) return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Missing user id' } });
  getDb().prepare('DELETE FROM user_keys WHERE user_id = ? AND provider = ?').run(userId, req.params.provider);
  res.json({ data: { ok: true } });
});

/** Internal helper: the user's decrypted key for a provider (or null). */
export function getUserKey(
  userId: string,
  provider: LLMProviderType,
): { apiKey: string; baseUrl?: string } | null {
  const row = getDb()
    .prepare('SELECT encrypted_key, iv, base_url FROM user_keys WHERE user_id = ? AND provider = ?')
    .get(userId, provider) as { encrypted_key: Uint8Array; iv: Uint8Array; base_url: string | null } | undefined;
  if (!row) return null;
  return {
    apiKey: decryptKey(Buffer.from(row.encrypted_key), Buffer.from(row.iv)),
    baseUrl: row.base_url ?? undefined,
  };
}

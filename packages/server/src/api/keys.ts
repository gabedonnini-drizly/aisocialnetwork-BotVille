import { Router } from 'express';
import { getDb } from '../db/schema.js';
import { encryptKey, decryptKey } from '../crypto/keyEncryption.js';
import { checkApiKey } from '../llm/keyCheck.js';
import { validateBaseUrl } from '../llm/baseUrl.js';
import { LLM_PROVIDERS } from '@botville/shared';
import type { LLMProviderType, SetUserKeyDto, UserKeyStatus } from '@botville/shared';

// ТЗ-14: ключи на уровне ЮЗЕРА — вводятся один раз и переиспользуются всеми
// новыми агентами. Наружу ключ не отдаётся никогда: только факт «настроен» и
// маска-хвост. В логи ключ не пишется (здесь нет ни одного console.*).

export const keysRouter = Router();

/** Провайдеры, для которых вообще имеет смысл хранить ключ. */
const KEYABLE = new Set<LLMProviderType>(
  LLM_PROVIDERS.filter(p => p.requiresApiKey).map(p => p.id),
);

function isKeyable(value: string): value is LLMProviderType {
  return KEYABLE.has(value as LLMProviderType);
}

/** Хвост ключа для узнавания: `…f3a9`. Короткие ключи не раскрываем вовсе. */
function maskKey(apiKey: string): string {
  return apiKey.length >= 8 ? `…${apiKey.slice(-4)}` : '…';
}

/** Нужен ли этому провайдеру пользовательский baseUrl (custom). */
function needsBaseUrl(provider: LLMProviderType): boolean {
  return LLM_PROVIDERS.find(p => p.id === provider)?.userBaseUrl === true;
}

// GET /api/keys — какие провайдеры настроены (без ключей)
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

// PUT /api/keys/:provider — сохранить/обновить ключ юзера + health-check
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

  // Как и в ключе агента: false — провайдер отверг, null — проверить не вышло.
  // Сохранение сетевая ошибка не отменяет.
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

/** Внутренний хелпер: расшифрованный ключ юзера для провайдера (или null). */
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

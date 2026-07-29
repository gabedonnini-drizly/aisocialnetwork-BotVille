import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { getDb } from '../db/schema.js';
import { encryptKey, decryptKey } from '../crypto/keyEncryption.js';
import { checkApiKey } from '../llm/keyCheck.js';
import { validateBaseUrl } from '../llm/baseUrl.js';
import type { CreateAgentDto, UpdateAgentDto, LLMProviderType } from '@botville/shared';
import type { SetApiKeyDto } from '@botville/shared';
import { FREE_SLOT_LIMIT } from '@botville/shared';
import { gameHour } from '../world/clock.js';

export const agentsRouter = Router();

// GET /api/agents/locations — lightweight TZ-16 polling: who is where + the
// server hour. The client calls it about every 15 s so scenes only draw agents
// who are actually there.
agentsRouter.get('/locations', (req, res) => {
  const userId = req.userId;
  if (!userId) return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Missing user id' } });
  const locations = getDb()
    .prepare('SELECT id, location FROM agents WHERE user_id = ?')
    .all(userId);
  res.json({ data: { gameHour: gameHour(), locations } });
});

// GET /api/agents — list user's agents
agentsRouter.get('/', (req, res) => {
  const userId = req.userId;
  if (!userId) return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Missing user id' } });
  const db = getDb();
  // hasKey — whether a saved key exists (the key itself is never returned), so
  // the UI can show a "Delete key" button. An EXISTS subquery, no schema change.
  const agents = db.prepare(`
    SELECT a.*, (SELECT COUNT(*) FROM agent_keys k WHERE k.agent_id = a.id) AS has_key
    FROM agents a WHERE a.user_id = ? ORDER BY a.slot_index
  `).all(userId);
  res.json({ data: agents });
});

// POST /api/agents — create agent
agentsRouter.post('/', (req, res) => {
  const userId = req.userId;
  if (!userId) return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Missing user id' } });
  const db = getDb();
  const count = (db.prepare('SELECT COUNT(*) as c FROM agents WHERE user_id = ?').get(userId) as { c: number }).c;
  if (count >= FREE_SLOT_LIMIT) {
    return res.status(400).json({ error: { code: 'SLOT_LIMIT', message: 'Free plan allows 4 agents max' } });
  }
  const body = req.body as CreateAgentDto;
  if (!body.name || !body.providerType || !body.modelId) {
    return res.status(400).json({ error: { code: 'INVALID_BODY', message: 'name, providerType, modelId required' } });
  }
  // TZ-14: the 'custom' provider's own endpoint — validate before writing
  let customBaseUrl: string | null = null;
  if (body.providerType === 'custom') {
    const check = validateBaseUrl(body.customBaseUrl ?? '');
    if (!check.ok) {
      return res.status(400).json({ error: { code: check.code!, message: 'Invalid base URL' } });
    }
    customBaseUrl = check.url!;
  }
  const id = uuid();
  const slotIndex = count;
  db.prepare(`
    INSERT INTO agents (id, user_id, slot_index, name, avatar_variant, system_prompt, provider_type, model_id, ollama_base_url, custom_base_url, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, userId, slotIndex, body.name, body.avatarVariant ?? 0, body.systemPrompt ?? '', body.providerType, body.modelId, body.ollamaBaseUrl ?? null, customBaseUrl, Date.now());
  res.status(201).json({ data: { id, slotIndex } });
});

// PATCH /api/agents/:id — update agent config
agentsRouter.patch('/:id', (req, res) => {
  const userId = req.userId;
  const db = getDb();
  const agent = db.prepare('SELECT * FROM agents WHERE id = ? AND user_id = ?').get(req.params.id, userId);
  if (!agent) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Agent not found' } });
  const body = req.body as UpdateAgentDto;
  let customBaseUrl: string | null = null;
  if (body.customBaseUrl) {
    const check = validateBaseUrl(body.customBaseUrl);
    if (!check.ok) {
      return res.status(400).json({ error: { code: check.code!, message: 'Invalid base URL' } });
    }
    customBaseUrl = check.url!;
  }
  db.prepare(`
    UPDATE agents SET
      name = COALESCE(?, name),
      system_prompt = COALESCE(?, system_prompt),
      provider_type = COALESCE(?, provider_type),
      model_id = COALESCE(?, model_id),
      ollama_base_url = COALESCE(?, ollama_base_url),
      custom_base_url = COALESCE(?, custom_base_url)
    WHERE id = ?
  `).run(body.name ?? null, body.systemPrompt ?? null, body.providerType ?? null, body.modelId ?? null, body.ollamaBaseUrl ?? null, customBaseUrl, req.params.id);
  res.json({ data: { ok: true } });
});

// DELETE /api/agents/:id
agentsRouter.delete('/:id', (req, res) => {
  const userId = req.userId;
  const db = getDb();
  const result = db.prepare('DELETE FROM agents WHERE id = ? AND user_id = ?').run(req.params.id, userId);
  if (result.changes === 0) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Agent not found' } });
  res.json({ data: { ok: true } });
});

// PUT /api/agents/:id/key — save encrypted API key + health-check the key
agentsRouter.put('/:id/key', async (req, res) => {
  const userId = req.userId;
  const db = getDb();
  const agent = db.prepare('SELECT * FROM agents WHERE id = ? AND user_id = ?').get(req.params.id, userId) as
    | Record<string, unknown>
    | undefined;
  if (!agent) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Agent not found' } });
  const { apiKey } = req.body as SetApiKeyDto;
  if (!apiKey) return res.status(400).json({ error: { code: 'INVALID_BODY', message: 'apiKey required' } });
  const { encrypted, iv } = encryptKey(apiKey);
  db.prepare(`
    INSERT INTO agent_keys (agent_id, encrypted_key, iv, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(agent_id) DO UPDATE SET encrypted_key=excluded.encrypted_key, iv=excluded.iv, updated_at=excluded.updated_at
  `).run(req.params.id, encrypted, iv, Date.now());
  // Minimal request to the provider: valid true/false, null — the check failed
  // (a network error does not block saving)
  const valid = await checkApiKey(
    agent.provider_type as LLMProviderType,
    apiKey,
    (agent.custom_base_url as string) ?? undefined,
  );
  res.json({ data: { ok: true, valid } });
});

// DELETE /api/agents/:id/key — delete the saved key (TZ-04, checklist item 4).
// After deletion the agent requires a key again / falls back to demo.
agentsRouter.delete('/:id/key', (req, res) => {
  const userId = req.userId;
  const db = getDb();
  const agent = db.prepare('SELECT id FROM agents WHERE id = ? AND user_id = ?').get(req.params.id, userId);
  if (!agent) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Agent not found' } });
  db.prepare('DELETE FROM agent_keys WHERE agent_id = ?').run(req.params.id);
  res.json({ data: { ok: true } });
});

// Internal helper — get decrypted key (used by chat route)
export function getDecryptedKey(agentId: string): string | null {
  const db = getDb();
  const row = db.prepare('SELECT encrypted_key, iv FROM agent_keys WHERE agent_id = ?').get(agentId) as { encrypted_key: Uint8Array; iv: Uint8Array } | undefined;
  if (!row) return null;
  return decryptKey(Buffer.from(row.encrypted_key), Buffer.from(row.iv));
}

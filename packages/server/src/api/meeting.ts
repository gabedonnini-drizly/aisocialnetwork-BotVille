import { Router } from 'express';
import { getDb } from '../db/schema.js';
import { resolveAgentKey } from '../llm/keyResolution.js';
import { getAdapter } from '../llm/LLMRouter.js';
import { normalizeLLMError } from '../llm/errors.js';
import { buildSystemPrompt } from '../llm/worldContext.js';
import { markAgentBusy } from '../world/agentLife.js';
import type { LLMProviderType } from '@botville/shared';

export const meetingRouter = Router();

// POST /api/meeting — fan-out one task to all agents, stream results via SSE
// Response: SSE stream with chunks tagged by agentId
meetingRouter.post('/', async (req, res) => {
  const userId = req.userId;
  if (!userId) return res.status(401).json({ error: { code: 'UNAUTHORIZED' } });

  const { task, agentIds } = req.body as { task: string; agentIds?: string[] };
  if (!task) return res.status(400).json({ error: { code: 'INVALID_BODY', message: 'task required' } });

  const db = getDb();
  let agents = db.prepare('SELECT * FROM agents WHERE user_id = ?').all(userId) as Record<string, unknown>[];
  if (agentIds?.length) {
    agents = agents.filter(a => agentIds.includes(a.id as string));
  }
  if (!agents.length) return res.status(400).json({ error: { code: 'NO_AGENTS', message: 'No agents found' } });

  // SSE setup
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  // Disable response buffering in the hosting reverse proxy (TZ-05), otherwise
  // SSE piles up and arrives in a batch instead of token-by-token.
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const send = (data: object) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  // Kick off all agents in parallel
  const promises = agents.map(async (agent) => {
    const agentId = agent.id as string;
    const providerType = agent.provider_type as LLMProviderType;

    // TZ-16: a meeting participant is "busy" — the server tick doesn't move it
    markAgentBusy(agentId);

    // TZ-14: agent key → saved user key → error (no demo mode in meetings)
    const { source, apiKey, baseUrl } = resolveAgentKey(agent, userId);
    if (source === 'none') {
      send({ type: 'agent_error', agentId, error: 'No API key set' });
      return;
    }
    if (providerType === 'custom' && !baseUrl) {
      send({ type: 'agent_error', agentId, error: 'No endpoint URL set' });
      return;
    }

    const adapter = getAdapter(providerType, baseUrl);
    send({ type: 'agent_start', agentId, name: agent.name });

    await adapter.stream({
      model: agent.model_id as string,
      systemPrompt: buildSystemPrompt(agent),
      messages: [{ role: 'user', content: task }],
      apiKey,
      baseUrl,
      onDelta: (text) => send({ type: 'agent_delta', agentId, content: text }),
      onDone: () => send({ type: 'agent_done', agentId }),
      onError: (err) => send({ type: 'agent_error', agentId, error: normalizeLLMError(err).message }),
    });
  });

  await Promise.allSettled(promises);
  send({ type: 'meeting_done' });
  res.end();
});

import { Router } from 'express';
import { getDb } from '../db/schema.js';
import { resolveAgentKey } from '../llm/keyResolution.js';
import { getAdapter, getDemoAdapter } from '../llm/LLMRouter.js';
import { normalizeLLMError } from '../llm/errors.js';
import { buildSystemPrompt } from '../llm/worldContext.js';
import { markAgentBusy } from '../world/agentLife.js';
import { demoConfig } from '../config.js';
import type { ChatRequest, LLMProviderType } from '@botville/shared';

export const chatRouter = Router();

// ── Demo mode: usage accounting ──────────────────────────────────────────────

function getDemoUsed(userId: string): number {
  const row = getDb().prepare('SELECT demo_messages_used AS used FROM users WHERE id = ?').get(userId) as
    | { used: number }
    | undefined;
  return row?.used ?? 0;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function getDemoIpCount(ip: string): number {
  const row = getDb().prepare('SELECT count FROM demo_ip_usage WHERE ip = ? AND date = ?').get(ip, today()) as
    | { count: number }
    | undefined;
  return row?.count ?? 0;
}

function recordDemoUsage(userId: string, ip: string) {
  const db = getDb();
  db.prepare('UPDATE users SET demo_messages_used = demo_messages_used + 1 WHERE id = ?').run(userId);
  db.prepare(`
    INSERT INTO demo_ip_usage (ip, date, count) VALUES (?, ?, 1)
    ON CONFLICT(ip, date) DO UPDATE SET count = count + 1
  `).run(ip, today());
}

// GET /api/chat/demo-status — demo state for the current session (for the UI)
chatRouter.get('/demo-status', (req, res) => {
  if (!demoConfig.enabled) return res.json({ data: { demoEnabled: false } });
  const remaining = Math.max(0, demoConfig.messageLimit - getDemoUsed(req.userId));
  res.json({ data: { demoEnabled: true, demoRemaining: remaining } });
});

// POST /api/chat — SSE streaming response
chatRouter.post('/', async (req, res) => {
  const userId = req.userId;
  if (!userId) return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });

  const { agentId, message, history = [] } = req.body as ChatRequest;
  if (!agentId || !message) {
    return res.status(400).json({ error: { code: 'INVALID_BODY', message: 'agentId and message required' } });
  }

  const db = getDb();
  const agent = db.prepare('SELECT * FROM agents WHERE id = ? AND user_id = ?').get(agentId, userId) as Record<string, unknown> | undefined;
  if (!agent) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Agent not found' } });

  // TZ-16: an agent in an active chat is "busy" — the server tick doesn't move it
  markAgentBusy(agentId);

  const providerType = agent.provider_type as LLMProviderType;

  // TZ-14: agent key → saved user key → demo → a human-readable error
  const resolved = resolveAgentKey(agent, userId);
  let model = agent.model_id as string;
  let apiKey = resolved.apiKey;
  let baseUrl = resolved.baseUrl;
  let isDemo = false;

  const sendEvent = (data: object) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };
  const startSSE = () => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    // Disable response buffering in the hosting reverse proxy (Railway/nginx),
    // otherwise SSE piles up and arrives in a batch instead of token-by-token (TZ-05).
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();
  };

  let adapter;
  if (resolved.source === 'none') {
    if (!demoConfig.enabled) {
      return res.status(400).json({ error: { code: 'NO_API_KEY', message: 'No API key set for this agent' } });
    }
    // Neither a personal key nor a saved one — try demo mode
    const used = getDemoUsed(userId);
    const ip = req.ip ?? 'unknown';
    if (used >= demoConfig.messageLimit || getDemoIpCount(ip) >= demoConfig.ipDailyLimit) {
      // Limit exhausted — an SSE event, not an HTTP error
      startSSE();
      sendEvent({ type: 'demo_limit_reached', demoRemaining: 0 });
      return res.end();
    }
    isDemo = true;
    adapter = getDemoAdapter(demoConfig.provider as LLMProviderType, demoConfig.baseUrl);
    model = demoConfig.model;
    apiKey = demoConfig.apiKey;
    baseUrl = undefined;
  } else {
    if (providerType === 'custom' && !baseUrl) {
      return res.status(400).json({ error: { code: 'NO_BASE_URL', message: 'No endpoint URL set for this agent' } });
    }
    adapter = getAdapter(providerType, baseUrl);
  }

  startSSE();

  // Save user message
  db.prepare('INSERT INTO chat_history (id, agent_id, role, content, timestamp) VALUES (?, ?, ?, ?, ?)')
    .run(crypto.randomUUID(), agentId, 'user', message, Date.now());

  // Remaining demo messages including the current one — in every demo-mode SSE response
  const demoRemaining = isDemo
    ? Math.max(0, demoConfig.messageLimit - getDemoUsed(userId) - 1)
    : undefined;
  if (isDemo) sendEvent({ type: 'demo_info', demoRemaining });

  let fullResponse = '';

  await adapter.stream({
    model,
    systemPrompt: buildSystemPrompt(agent),
    messages: [
      ...history.map(m => ({ role: m.role, content: m.content })),
      { role: 'user' as const, content: message },
    ],
    apiKey,
    baseUrl,
    onDelta: (text) => {
      fullResponse += text;
      sendEvent({ type: 'delta', content: text });
    },
    onDone: () => {
      // Save assistant message
      db.prepare('INSERT INTO chat_history (id, agent_id, role, content, timestamp) VALUES (?, ?, ?, ?, ?)')
        .run(crypto.randomUUID(), agentId, 'assistant', fullResponse, Date.now());
      if (isDemo) recordDemoUsage(userId, req.ip ?? 'unknown');
      sendEvent(isDemo ? { type: 'done', demoRemaining } : { type: 'done' });
      res.end();
    },
    onError: (err) => {
      sendEvent({ type: 'error', error: normalizeLLMError(err) });
      res.end();
    },
  });
});

// GET /api/chat/:agentId/history
chatRouter.get('/:agentId/history', (req, res) => {
  const userId = req.userId;
  const db = getDb();
  const agent = db.prepare('SELECT id FROM agents WHERE id = ? AND user_id = ?').get(req.params.agentId, userId);
  if (!agent) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Agent not found' } });
  const history = db.prepare(
    'SELECT role, content, timestamp FROM chat_history WHERE agent_id = ? ORDER BY timestamp ASC LIMIT 100'
  ).all(req.params.agentId);
  res.json({ data: history });
});

import crypto from 'crypto';
import { Router } from 'express';
import type { Request } from 'express';
import { getDb } from '../db/schema.js';
import { statsConfig } from '../config.js';

// TZ-18: read-only production summary for the owner — "are people coming in,
// and do they make it to activation". Aggregates only and SELECT only.
//
// What deliberately NEVER leaves the server: emails, keys (even masked), the
// text of messages and prompts, user_id / agent_id. Every response field is a
// number.
//
// The endpoint is protected by the STATS_TOKEN secret. Without a set (or with a
// too-short) secret it is DISABLED — responds 404 as if the route didn't exist.
// That way "forgot to set the variable" results in a closed door, not exposed
// numbers.

export const adminStatsRouter = Router();

const DAY_MS = 24 * 60 * 60 * 1000;

/** Token from a header: `X-Stats-Token` or `Authorization: Bearer`. */
function tokenFromHeaders(req: Request): string | undefined {
  const raw = req.headers['x-stats-token'];
  if (typeof raw === 'string' && raw) return raw;
  const auth = req.headers.authorization;
  if (typeof auth === 'string' && auth.startsWith('Bearer ')) return auth.slice(7);
  return undefined;
}

/**
 * Constant-time comparison. We compare sha256 digests rather than the strings
 * themselves: the lengths are always equal, so the real token's length can't
 * leak via a timingSafeEqual error.
 */
function tokenMatches(given: string | undefined, expected: string): boolean {
  if (!given) return false;
  const a = crypto.createHash('sha256').update(given).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

function count(sql: string, ...params: (string | number)[]): number {
  const row = getDb().prepare(sql).get(...params) as { c: number | bigint };
  return Number(row.c);
}

// GET /api/admin/stats — compact JSON with aggregates
adminStatsRouter.get('/stats', (req, res) => {
  const expected = statsConfig.token;
  // Secret unset/too short — as far as the outside world knows, the route doesn't exist.
  if (!expected) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Not found' } });
  }
  if (!tokenMatches(tokenFromHeaders(req), expected)) {
    // The token is never logged in any form.
    return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid stats token' } });
  }

  const since = Date.now() - DAY_MS;

  const sessions = count('SELECT COUNT(*) AS c FROM users');
  const agents = count('SELECT COUNT(*) AS c FROM agents');
  const agentsLast24h = count('SELECT COUNT(*) AS c FROM agents WHERE created_at >= ?', since);
  const usersLast24h = count('SELECT COUNT(*) AS c FROM users WHERE created_at >= ?', since);
  const messages = count('SELECT COUNT(*) AS c FROM chat_history');

  // The key metric: a user created an agent AND got at least one reply.
  // chat_history has exactly two roles ('user' | 'assistant'); a model reply is
  // a row with role='assistant'. The JOIN goes via agents.id / idx_chat_agent.
  const activatedUsers = count(`
    SELECT COUNT(DISTINCT a.user_id) AS c
    FROM agents a
    JOIN chat_history h ON h.agent_id = a.id AND h.role = 'assistant'
  `);

  const demoMessagesUsed = count('SELECT COALESCE(SUM(demo_messages_used), 0) AS c FROM users');

  res.json({
    data: {
      sessions,
      usersLast24h,
      agents,
      agentsLast24h,
      activatedUsers,
      agentsPerSession: sessions ? Math.round((agents / sessions) * 100) / 100 : 0,
      messages,
      demoMessagesUsed,
      generatedAt: Date.now(),
    },
  });
});

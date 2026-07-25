import crypto from 'crypto';
import { Router } from 'express';
import type { Request } from 'express';
import { getDb } from '../db/schema.js';
import { statsConfig } from '../config.js';

// ТЗ-18: read-only сводка по проду для владельца — «заходят ли люди и
// доходят ли до активации». Только агрегаты и только SELECT.
//
// Что НЕ уезжает наружу принципиально: email, ключи (даже маски), тексты
// сообщений и промптов, user_id / agent_id. Любое поле ответа — число.
//
// Эндпоинт закрыт секретом STATS_TOKEN. Без заданного (или слишком короткого)
// секрета он ВЫКЛЮЧЕН — отвечает 404, как будто маршрута нет. Так «забыл
// задать переменную» приводит к закрытой двери, а не к открытым цифрам.

export const adminStatsRouter = Router();

const DAY_MS = 24 * 60 * 60 * 1000;

/** Токен из заголовка: `X-Stats-Token` или `Authorization: Bearer`. */
function tokenFromHeaders(req: Request): string | undefined {
  const raw = req.headers['x-stats-token'];
  if (typeof raw === 'string' && raw) return raw;
  const auth = req.headers.authorization;
  if (typeof auth === 'string' && auth.startsWith('Bearer ')) return auth.slice(7);
  return undefined;
}

/**
 * Сравнение постоянного времени. Сравниваем sha256-дайджесты, а не сами
 * строки: длины всегда равны, поэтому длина настоящего токена не утекает
 * через ошибку timingSafeEqual.
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

// GET /api/admin/stats — компактный JSON с агрегатами
adminStatsRouter.get('/stats', (req, res) => {
  const expected = statsConfig.token;
  // Секрет не задан/короткий — маршрута для внешнего мира не существует.
  if (!expected) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Not found' } });
  }
  if (!tokenMatches(tokenFromHeaders(req), expected)) {
    // Токен не логируем ни в каком виде.
    return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid stats token' } });
  }

  const since = Date.now() - DAY_MS;

  const sessions = count('SELECT COUNT(*) AS c FROM users');
  const agents = count('SELECT COUNT(*) AS c FROM agents');
  const agentsLast24h = count('SELECT COUNT(*) AS c FROM agents WHERE created_at >= ?', since);
  const usersLast24h = count('SELECT COUNT(*) AS c FROM users WHERE created_at >= ?', since);
  const messages = count('SELECT COUNT(*) AS c FROM chat_history');

  // Главная метрика: юзер создал агента И получил хотя бы один ответ.
  // В chat_history роли ровно две ('user' | 'assistant'), ответ модели —
  // строка с role='assistant'. JOIN идёт по agents.id / idx_chat_agent.
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

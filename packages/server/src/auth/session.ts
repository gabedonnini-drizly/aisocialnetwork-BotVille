import crypto from 'crypto';
import type { IncomingMessage } from 'http';
import type { Request, Response, NextFunction } from 'express';
import { getDb } from '../db/schema.js';
import { sessionConfig, cookieConfig } from '../config.js';

/**
 * Заголовок токен-сессии (ТЗ-12). Клиент на vercel.app и сервер на railway.app —
 * разные сайты, и cross-site cookie `av_session` до сервера не доходит: Safari
 * (ITP) режет сторонние куки по умолчанию, Chrome их сворачивает. Без этого
 * POST /api/agents создавал агента в одной сессии, а следующий GET уходил уже в
 * новой и возвращал пусто. Токен — та же подписанная строка `<uuid>.<hmac>`,
 * что и в куке, только едет в заголовке. Кука остаётся как есть: где браузер
 * её пускает, работают оба пути.
 */
export const SESSION_HEADER = 'x-session-token';

// req.userId проставляется этим middleware для всех /api-запросов
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId: string;
    }
  }
}

function hmac(sessionId: string): string {
  return crypto.createHmac('sha256', sessionConfig.secret).update(sessionId).digest('base64url');
}

/** Подписанное значение cookie: `<uuid>.<hmac>` */
export function signSession(sessionId: string): string {
  return `${sessionId}.${hmac(sessionId)}`;
}

/** Возвращает sessionId, если подпись валидна, иначе null. */
export function verifySession(cookieValue: string | undefined): string | null {
  if (!cookieValue) return null;
  const dot = cookieValue.lastIndexOf('.');
  if (dot <= 0) return null;
  const sessionId = cookieValue.slice(0, dot);
  const signature = cookieValue.slice(dot + 1);
  const expected = hmac(sessionId);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return sessionId;
}

/** Токен сессии из заголовков: `X-Session-Token` или `Authorization: Bearer`. */
function tokenFromHeaders(req: Request): string | undefined {
  const raw = req.headers[SESSION_HEADER];
  if (typeof raw === 'string' && raw) return raw;
  const auth = req.headers.authorization;
  if (typeof auth === 'string' && auth.startsWith('Bearer ')) return auth.slice(7);
  return undefined;
}

/** userId из сырого заголовка Cookie (для WebSocket upgrade, где нет cookie-parser). */
export function userIdFromCookieHeader(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() !== sessionConfig.cookieName) continue;
    return verifySession(decodeURIComponent(part.slice(eq + 1).trim()));
  }
  return null;
}

function ensureUser(sessionId: string) {
  getDb()
    .prepare('INSERT OR IGNORE INTO users (id, email, password_hash, plan, created_at) VALUES (?, NULL, NULL, ?, ?)')
    .run(sessionId, 'free', Date.now());
}

/**
 * userId для WebSocket-upgrade. Браузерный WS не умеет слать кастомные
 * заголовки, поэтому токен приезжает query-параметром `?token=`. Значение
 * проверяется той же подписью, что и кука, — доверия к «сырому» id нет.
 */
export function userIdFromUpgrade(req: IncomingMessage): string | null {
  const fromCookie = userIdFromCookieHeader(req.headers.cookie);
  if (fromCookie) return fromCookie;
  // base нужен только чтобы распарсить относительный req.url
  const token = new URL(req.url ?? '/', 'http://localhost').searchParams.get('token');
  return verifySession(token ?? undefined);
}

function setSessionCookie(res: Response, sessionId: string) {
  res.cookie(sessionConfig.cookieName, signSession(sessionId), {
    httpOnly: true,
    sameSite: cookieConfig.sameSite,
    secure: cookieConfig.secure,
    maxAge: sessionConfig.maxAgeDays * 24 * 60 * 60 * 1000,
  });
}

/**
 * Анонимные сессии. Порядок: валидная cookie `av_session` → валидный токен из
 * заголовка → новая сессия (не 403). Токен текущей сессии всегда уезжает назад
 * в заголовке `X-Session-Token`, чтобы клиент подхватил его с первого же ответа
 * и не зависел от порядка бутстрапа.
 */
export function sessionMiddleware(req: Request, res: Response, next: NextFunction) {
  const fromCookie = verifySession(req.cookies?.[sessionConfig.cookieName]);
  const sessionId = fromCookie ?? verifySession(tokenFromHeaders(req)) ?? crypto.randomUUID();
  // Куку переставляем и когда сессия приехала токеном: браузер, который куку
  // всё-таки принимает, сходится обратно на неё.
  if (!fromCookie) setSessionCookie(res, sessionId);
  res.setHeader(SESSION_HEADER, signSession(sessionId));
  ensureUser(sessionId);
  req.userId = sessionId;
  next();
}

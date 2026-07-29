import crypto from 'crypto';
import type { IncomingMessage } from 'http';
import type { Request, Response, NextFunction } from 'express';
import { getDb } from '../db/schema.js';
import { sessionConfig, cookieConfig } from '../config.js';

/**
 * Token-session header (TZ-12). The client on vercel.app and the server on
 * railway.app are different sites, and the cross-site `av_session` cookie never
 * reaches the server: Safari (ITP) blocks third-party cookies by default and
 * Chrome is phasing them out. Without this, POST /api/agents would create an
 * agent in one session while the next GET went out in a new one and returned
 * nothing. The token is the same signed `<uuid>.<hmac>` string as in the
 * cookie, it just travels in a header. The cookie stays as is: where the
 * browser allows it, both paths work.
 */
export const SESSION_HEADER = 'x-session-token';

// req.userId is set by this middleware for all /api requests
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

/** Signed cookie value: `<uuid>.<hmac>` */
export function signSession(sessionId: string): string {
  return `${sessionId}.${hmac(sessionId)}`;
}

/** Returns the sessionId if the signature is valid, otherwise null. */
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

/** Session token from headers: `X-Session-Token` or `Authorization: Bearer`. */
function tokenFromHeaders(req: Request): string | undefined {
  const raw = req.headers[SESSION_HEADER];
  if (typeof raw === 'string' && raw) return raw;
  const auth = req.headers.authorization;
  if (typeof auth === 'string' && auth.startsWith('Bearer ')) return auth.slice(7);
  return undefined;
}

/** userId from the raw Cookie header (for WebSocket upgrade, where there is no cookie-parser). */
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
 * userId for the WebSocket upgrade. Browser WS can't send custom headers, so
 * the token arrives as the `?token=` query parameter. The value is verified
 * with the same signature as the cookie — a "raw" id is never trusted.
 */
export function userIdFromUpgrade(req: IncomingMessage): string | null {
  const fromCookie = userIdFromCookieHeader(req.headers.cookie);
  if (fromCookie) return fromCookie;
  // base is only needed to parse the relative req.url
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
 * Anonymous sessions. Order: valid `av_session` cookie → valid token from the
 * header → new session (not 403). The current session's token is always sent
 * back in the `X-Session-Token` header, so the client picks it up from the very
 * first response and doesn't depend on bootstrap order.
 */
export function sessionMiddleware(req: Request, res: Response, next: NextFunction) {
  const fromCookie = verifySession(req.cookies?.[sessionConfig.cookieName]);
  const sessionId = fromCookie ?? verifySession(tokenFromHeaders(req)) ?? crypto.randomUUID();
  // Re-set the cookie even when the session arrived via token: a browser that
  // does accept the cookie converges back onto it.
  if (!fromCookie) setSessionCookie(res, sessionId);
  res.setHeader(SESSION_HEADER, signSession(sessionId));
  ensureUser(sessionId);
  req.userId = sessionId;
  next();
}

import type { Request, Response, NextFunction } from 'express';

// TZ-04, checklist item 7: single error handler. The client receives only a
// code and a human-readable message — no stack traces, file paths, or raw
// provider bodies. The full error is logged on the server (without secrets
// from the request body).

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  const isCors = err instanceof Error && err.message === 'Not allowed by CORS';

  // Server-side log: message + stack, without the request body (it may contain keys).
  console.error(`[error] ${req.method} ${req.path}:`, err instanceof Error ? err.stack ?? err.message : err);

  // If the response has already started (e.g. an SSE stream) — just close the connection.
  if (res.headersSent) return res.end();

  if (isCors) {
    return res.status(403).json({ error: { code: 'CORS_FORBIDDEN', message: 'Origin not allowed' } });
  }

  // Client errors (e.g. broken JSON from body-parser) — return their status
  // with a generic message, without the raw error text. Everything else — 500.
  const status = (err as { status?: number; statusCode?: number })?.status
    ?? (err as { statusCode?: number })?.statusCode;
  if (typeof status === 'number' && status >= 400 && status < 500) {
    return res.status(status).json({ error: { code: 'BAD_REQUEST', message: 'Invalid request' } });
  }
  res.status(500).json({ error: { code: 'INTERNAL', message: 'Something went wrong on the server' } });
}

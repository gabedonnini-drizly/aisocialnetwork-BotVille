import type { Request, Response, NextFunction } from 'express';

// ТЗ-04, чеклист 7: единый обработчик ошибок. Клиенту уходит только код и
// человекочитаемое сообщение — никаких стек-трейсов, путей файлов и сырых тел
// провайдера. Полная ошибка логируется на сервере (без секретов из тела).

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  const isCors = err instanceof Error && err.message === 'Not allowed by CORS';

  // Лог на сервере: message + stack, без тела запроса (там могут быть ключи).
  console.error(`[error] ${req.method} ${req.path}:`, err instanceof Error ? err.stack ?? err.message : err);

  // Если ответ уже начат (например, SSE-стрим) — просто закрываем соединение.
  if (res.headersSent) return res.end();

  if (isCors) {
    return res.status(403).json({ error: { code: 'CORS_FORBIDDEN', message: 'Origin не разрешён' } });
  }

  // Клиентские ошибки (например, битый JSON от body-parser) — отдаём их статус
  // с обобщённым сообщением, без сырого текста ошибки. Всё прочее — 500.
  const status = (err as { status?: number; statusCode?: number })?.status
    ?? (err as { statusCode?: number })?.statusCode;
  if (typeof status === 'number' && status >= 400 && status < 500) {
    return res.status(status).json({ error: { code: 'BAD_REQUEST', message: 'Некорректный запрос' } });
  }
  res.status(500).json({ error: { code: 'INTERNAL', message: 'Что-то пошло не так на сервере' } });
}

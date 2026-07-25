import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { agentsRouter } from './api/agents.js';
import { chatRouter } from './api/chat.js';
import { meetingRouter } from './api/meeting.js';
import { keysRouter } from './api/keys.js';
import { modelsRouter } from './api/models.js';
import { adminStatsRouter } from './api/adminStats.js';
import { createWSSServer } from './ws/stateSync.js';
import { getDb } from './db/schema.js';
import { startAgentLife } from './world/agentLife.js';
import { gameHour, setGameHour } from './world/clock.js';
import { sessionMiddleware, signSession, SESSION_HEADER } from './auth/session.js';
import { rateLimitConfig, corsConfig, assertSecretsOrExit } from './config.js';
import { errorHandler } from './api/errorHandler.js';

// Boot-guard (ТЗ-04, чеклист 3): в production не стартуем с отсутствующими/
// дефолтными секретами. Вызываем до инициализации БД и HTTP-сервера.
assertSecretsOrExit();

const PORT = Number(process.env.PORT ?? 3001);

const app = express();

// За reverse-proxy (Railway) req.ip должен браться из X-Forwarded-For
if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1);

// Security-заголовки (ТЗ-04, чеклист 8). CSP отключаем: приложение — Phaser/
// WebGL с inline-стилями и blob/data-URL текстурами; строгий CSP ломает игру,
// а безопасный минимум (X-Content-Type-Options, Referrer-Policy, X-Frame-Options
// и т.п.) helmet ставит и без CSP. COEP тоже выключен — мешает hero-медиа/ассетам.
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));

// CORS: только origin'ы из env-allowlist (прод + preview), с креденшелами.
// Запрос без Origin (curl, health-чекеры, same-origin) пропускаем.
const allowedOrigins = corsConfig.allowedOrigins;
app.use(cors({
  origin(origin, cb) {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
  // Токен-сессия (ТЗ-12): без exposedHeaders браузер не отдаст этот заголовок
  // JS'у на cross-site ответе, и клиент не сможет его сохранить.
  exposedHeaders: [SESSION_HEADER],
}));
app.use(express.json());
app.use(cookieParser());

// Health check
app.get('/health', (_req, res) => {
  res.json({ ok: true, version: '0.1.0', ts: Date.now() });
});

// Rate limiting: глобально — на IP, chat/meeting — на сессию
const limiterDefaults = { windowMs: 60_000, standardHeaders: true, legacyHeaders: false } as const;
const perSessionKey = (req: express.Request) => req.userId;
const globalLimiter = rateLimit({ ...limiterDefaults, limit: rateLimitConfig.globalPerMin });
const chatLimiter = rateLimit({ ...limiterDefaults, limit: rateLimitConfig.chatPerMin, keyGenerator: perSessionKey });
const meetingLimiter = rateLimit({ ...limiterDefaults, limit: rateLimitConfig.meetingPerMin, keyGenerator: perSessionKey });

// ТЗ-18: read-only статистика владельца. Монтируется ДО sessionMiddleware —
// иначе каждый вызов заводил бы новую строку в users и сам портил метрику
// sessions. Свой лимитер на IP: перебор токена не должен быть дешёвым.
const statsLimiter = rateLimit({ ...limiterDefaults, limit: rateLimitConfig.statsPerMin });
app.use('/api/admin', statsLimiter, adminStatsRouter);

// Routes (все /api — за анонимной сессией)
app.use('/api', globalLimiter, sessionMiddleware);
// Бутстрап токен-сессии (ТЗ-12): клиент зовёт до остальных вызовов и кладёт
// токен в localStorage. Тот же токен приходит и заголовком с любого /api-ответа.
app.get('/api/session', (req, res) => {
  res.json({ data: { token: signSession(req.userId) } });
});
app.use('/api/agents', agentsRouter);
// ТЗ-14: ключи юзера (вводятся один раз) и живой каталог моделей OpenRouter
app.use('/api/keys', keysRouter);
app.use('/api/models', modelsRouter);
app.use('/api/chat', chatLimiter, chatRouter);
app.use('/api/meeting', meetingLimiter, meetingRouter);

// ТЗ-16, только вне продакшена: перевести часы мира (приёмка ночного поведения).
// Клиентский __setGameHour дёргает этот эндпоинт в dev, чтобы сервер и клиент
// жили по одному часу.
if (process.env.NODE_ENV !== 'production') {
  app.post('/api/debug/game-hour', (req, res) => {
    const hour = Number((req.body as { hour?: unknown })?.hour);
    if (!Number.isFinite(hour)) {
      return res.status(400).json({ error: { code: 'INVALID_BODY', message: 'hour (number) required' } });
    }
    setGameHour(hour);
    res.json({ data: { ok: true, gameHour: gameHour() } });
  });
}

// Нормализованный обработчик ошибок (ТЗ-04, чеклист 7): клиент не получает
// стек-трейсы, пути и сырые тела провайдера. Ставится последним.
app.use(errorHandler);

// HTTP server + WebSocket
const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });
createWSSServer(wss);

// Initialize DB
getDb();

// ТЗ-16: серверный тик жизни агентов (расписание + статус, без LLM)
startAgentLife();

// Слушаем на 0.0.0.0, а не localhost — иначе reverse-proxy хостинга (Railway)
// не достучится до контейнера (ТЗ-05).
server.listen(PORT, '0.0.0.0', () => {
  console.log(`[BotVille Server] Running on 0.0.0.0:${PORT}`);
  console.log(`[BotVille Server] WebSocket on /ws`);
});

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

// Boot guard (TZ-04, checklist item 3): in production, refuse to start with
// missing/default secrets. Called before the DB and HTTP server initialize.
assertSecretsOrExit();

const PORT = Number(process.env.PORT ?? 3001);

const app = express();

// Behind a reverse proxy (Railway), req.ip must come from X-Forwarded-For
if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1);

// Security headers (TZ-04, checklist item 8). CSP is disabled: the app is
// Phaser/WebGL with inline styles and blob/data-URL textures; a strict CSP
// breaks the game, while the safe baseline (X-Content-Type-Options,
// Referrer-Policy, X-Frame-Options, etc.) is set by helmet even without CSP.
// COEP is off too — it interferes with hero media/assets.
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));

// CORS: only origins from the env allowlist (prod + preview), with credentials.
// Requests without an Origin (curl, health checkers, same-origin) pass through.
const allowedOrigins = corsConfig.allowedOrigins;
app.use(cors({
  origin(origin, cb) {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
  // Token session (TZ-12): without exposedHeaders the browser won't expose this
  // header to JS on a cross-site response, and the client couldn't store it.
  exposedHeaders: [SESSION_HEADER],
}));
app.use(express.json());
app.use(cookieParser());

// Health check
app.get('/health', (_req, res) => {
  res.json({ ok: true, version: '0.1.0', ts: Date.now() });
});

// Rate limiting: global — per IP, chat/meeting — per session
const limiterDefaults = { windowMs: 60_000, standardHeaders: true, legacyHeaders: false } as const;
const perSessionKey = (req: express.Request) => req.userId;
const globalLimiter = rateLimit({ ...limiterDefaults, limit: rateLimitConfig.globalPerMin });
const chatLimiter = rateLimit({ ...limiterDefaults, limit: rateLimitConfig.chatPerMin, keyGenerator: perSessionKey });
const meetingLimiter = rateLimit({ ...limiterDefaults, limit: rateLimitConfig.meetingPerMin, keyGenerator: perSessionKey });

// TZ-18: read-only stats for the owner. Mounted BEFORE sessionMiddleware —
// otherwise every call would create a new row in users and itself corrupt the
// sessions metric. Its own per-IP limiter: brute-forcing the token must not
// be cheap.
const statsLimiter = rateLimit({ ...limiterDefaults, limit: rateLimitConfig.statsPerMin });
app.use('/api/admin', statsLimiter, adminStatsRouter);

// Routes (all /api — behind an anonymous session)
app.use('/api', globalLimiter, sessionMiddleware);
// Token-session bootstrap (TZ-12): the client calls this before any other
// request and puts the token in localStorage. The same token also arrives as a
// header on every /api response.
app.get('/api/session', (req, res) => {
  res.json({ data: { token: signSession(req.userId) } });
});
app.use('/api/agents', agentsRouter);
// TZ-14: user keys (entered once) and the live OpenRouter model catalog
app.use('/api/keys', keysRouter);
app.use('/api/models', modelsRouter);
app.use('/api/chat', chatLimiter, chatRouter);
app.use('/api/meeting', meetingLimiter, meetingRouter);

// TZ-16, non-production only: set the world clock (acceptance testing of night
// behavior). The client-side __setGameHour hits this endpoint in dev so that the
// server and client live on the same hour.
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

// Normalized error handler (TZ-04, checklist item 7): the client never receives
// stack traces, file paths, or raw provider bodies. Mounted last.
app.use(errorHandler);

// HTTP server + WebSocket
const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });
createWSSServer(wss);

// Initialize DB
getDb();

// TZ-16: server-side agent life tick (schedule + status, no LLM involved)
startAgentLife();

// Listen on 0.0.0.0, not localhost — otherwise the hosting reverse proxy
// (Railway) can't reach the container (TZ-05).
server.listen(PORT, '0.0.0.0', () => {
  console.log(`[BotVille Server] Running on 0.0.0.0:${PORT}`);
  console.log(`[BotVille Server] WebSocket on /ws`);
});

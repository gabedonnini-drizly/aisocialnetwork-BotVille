// Центральный конфиг сервера: все настраиваемые константы читаются из env,
// значения по умолчанию — здесь, а не разбросаны по коду.

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} env var is required`);
  return value;
}

const isProd = process.env.NODE_ENV === 'production';

export const sessionConfig = {
  cookieName: 'av_session',
  get secret(): string {
    return requireEnv('SESSION_SECRET');
  },
  maxAgeDays: Number(process.env.SESSION_MAX_AGE_DAYS ?? 180),
};

// Cookie-флаги (ТЗ-04, чеклист 6). secure/sameSite зависят от прод-домена и
// финализируются на деплое (ТЗ-05) — поэтому читаются из env, а не прибиты.
// При кросс-сайт деплое (клиент Vercel / сервер Railway) нужен sameSite=None +
// secure=true, иначе браузер не пошлёт cookie. Локально по умолчанию lax.
export const cookieConfig = {
  // 'lax' | 'strict' | 'none'
  get sameSite(): 'lax' | 'strict' | 'none' {
    const v = (process.env.COOKIE_SAMESITE ?? 'lax').toLowerCase();
    return v === 'none' || v === 'strict' ? v : 'lax';
  },
  get secure(): boolean {
    // Явный override COOKIE_SECURE, иначе — включён в production.
    // sameSite=none по спецификации требует secure — форсим.
    if (process.env.COOKIE_SECURE !== undefined) return process.env.COOKIE_SECURE === 'true';
    return isProd || this.sameSite === 'none';
  },
};

// CORS (ТЗ-04, чеклист 1). Список origin'ов через запятую (прод + preview),
// не '*' — cookies ходят с credentials:include, поэтому нужен конкретный origin.
export const corsConfig = {
  get allowedOrigins(): string[] {
    return (process.env.CLIENT_ORIGIN ?? 'http://localhost:5173')
      .split(',')
      .map(o => o.trim())
      .filter(Boolean);
  },
};

// Demo-режим: первый агент отвечает без ключа пользователя (ТЗ-02, часть 2)
export const demoConfig = {
  get enabled(): boolean {
    return process.env.DEMO_ENABLED === 'true' && !!process.env.DEMO_API_KEY;
  },
  get provider(): string {
    return process.env.DEMO_PROVIDER ?? 'deepseek';
  },
  get model(): string {
    return process.env.DEMO_MODEL ?? 'deepseek-chat';
  },
  get apiKey(): string {
    return requireEnv('DEMO_API_KEY');
  },
  // Необязательный override базового URL (тесты, совместимые прокси)
  get baseUrl(): string | undefined {
    return process.env.DEMO_BASE_URL || undefined;
  },
  get messageLimit(): number {
    return Number(process.env.DEMO_MESSAGE_LIMIT ?? 10);
  },
  // Жёсткий лимит demo-сообщений с одного IP в сутки (ферма инкогнито-вкладок)
  get ipDailyLimit(): number {
    return Number(process.env.DEMO_IP_DAILY_LIMIT ?? 30);
  },
};

// ТЗ-14: OpenRouter просит заголовки атрибуции приложения (HTTP-Referer,
// X-Title) — по ним он показывает нас в своих рейтингах. Ни на что в запросе
// не влияет, но так правильно.
export const openRouterConfig = {
  get appUrl(): string {
    return process.env.PUBLIC_APP_URL ?? 'https://bot-ville-client.vercel.app';
  },
  appTitle: 'BotVille',
  // TTL кэша каталога моделей (список публичный, меняется редко)
  get catalogTtlMs(): number {
    return Number(process.env.OPENROUTER_CATALOG_TTL_MS ?? 3_600_000);
  },
};

export const rateLimitConfig = {
  chatPerMin: Number(process.env.RATE_LIMIT_CHAT_PER_MIN ?? 20),
  meetingPerMin: Number(process.env.RATE_LIMIT_MEETING_PER_MIN ?? 5),
  globalPerMin: Number(process.env.RATE_LIMIT_GLOBAL_PER_MIN ?? 100),
  // ТЗ-18: статистику владелец смотрит руками, изредка — лимит намеренно жёсткий
  statsPerMin: Number(process.env.RATE_LIMIT_STATS_PER_MIN ?? 10),
};

// Boot-guard (ТЗ-04, чеклист 3): в production сервер отказывается стартовать,
// если обязательный секрет отсутствует, слишком короткий или остался
// дефолт-заглушкой из .env.example. В dev — только предупреждение, чтобы не
// мешать локальной разработке. Никаких значений секретов в лог не попадает.
const REQUIRED_SECRETS = ['SESSION_SECRET', 'ENCRYPTION_SECRET'] as const;
const MIN_SECRET_LEN = 32;

// ТЗ-18: секрет read-only эндпоинта статистики. Пустой, короткий или
// оставшийся заглушкой секрет = эндпоинт ВЫКЛЮЧЕН (404). Так «забыл задать
// переменную» приводит к закрытой двери, а не к цифрам на всю сеть.
export const statsConfig = {
  /** Валидный токен либо null, если эндпоинт должен быть выключен. */
  get token(): string | null {
    const value = process.env.STATS_TOKEN;
    if (!value || value.length < MIN_SECRET_LEN || value.startsWith('change-this')) return null;
    return value;
  },
};

function secretProblem(name: string): string | null {
  const value = process.env[name];
  if (!value) return `${name} отсутствует`;
  if (value.startsWith('change-this')) return `${name} — дефолт-заглушка из .env.example`;
  if (value.length < MIN_SECRET_LEN) return `${name} короче ${MIN_SECRET_LEN} символов`;
  return null;
}

export function assertSecretsOrExit(): void {
  const problems: string[] = [];
  for (const name of REQUIRED_SECRETS) {
    const p = secretProblem(name);
    if (p) problems.push(p);
  }
  // DEMO_API_KEY обязателен только когда demo включён
  if (process.env.DEMO_ENABLED === 'true') {
    const key = process.env.DEMO_API_KEY;
    if (!key || key === 'your-deepseek-key') {
      problems.push('DEMO_ENABLED=true, но DEMO_API_KEY отсутствует или заглушка');
    }
  }
  if (problems.length === 0) return;

  const header = '[BotVille Server] Проблемы с обязательными секретами:';
  const lines = problems.map(p => `  - ${p}`).join('\n');
  if (isProd) {
    console.error(`${header}\n${lines}\nСервер не может стартовать в production. Задай секреты в env.`);
    process.exit(1);
  }
  console.warn(`${header}\n${lines}\n(dev-режим: продолжаю, но в production такой старт будет отклонён)`);
}

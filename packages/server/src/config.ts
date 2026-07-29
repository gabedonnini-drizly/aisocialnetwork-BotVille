// Central server config: all tunable constants are read from env, with the
// defaults kept here rather than scattered around the code.

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

// Cookie flags (TZ-04, checklist item 6). secure/sameSite depend on the prod
// domain and are finalized at deploy time (TZ-05) — hence read from env, not
// hardcoded. A cross-site deploy (client on Vercel / server on Railway) needs
// sameSite=None + secure=true, or the browser won't send the cookie. Locally
// the default is lax.
export const cookieConfig = {
  // 'lax' | 'strict' | 'none'
  get sameSite(): 'lax' | 'strict' | 'none' {
    const v = (process.env.COOKIE_SAMESITE ?? 'lax').toLowerCase();
    return v === 'none' || v === 'strict' ? v : 'lax';
  },
  get secure(): boolean {
    // Explicit COOKIE_SECURE override, otherwise enabled in production.
    // sameSite=none requires secure per the spec — force it.
    if (process.env.COOKIE_SECURE !== undefined) return process.env.COOKIE_SECURE === 'true';
    return isProd || this.sameSite === 'none';
  },
};

// CORS (TZ-04, checklist item 1). Comma-separated list of origins (prod +
// preview), not '*' — cookies travel with credentials:include, which requires
// a concrete origin.
export const corsConfig = {
  get allowedOrigins(): string[] {
    return (process.env.CLIENT_ORIGIN ?? 'http://localhost:5173')
      .split(',')
      .map(o => o.trim())
      .filter(Boolean);
  },
};

// Demo mode: the first agent replies without a user-provided key (TZ-02, part 2)
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
  // Optional base URL override (tests, compatible proxies)
  get baseUrl(): string | undefined {
    return process.env.DEMO_BASE_URL || undefined;
  },
  get messageLimit(): number {
    return Number(process.env.DEMO_MESSAGE_LIMIT ?? 10);
  },
  // Hard daily limit on demo messages per IP (guards against an incognito-tab farm)
  get ipDailyLimit(): number {
    return Number(process.env.DEMO_IP_DAILY_LIMIT ?? 30);
  },
};

// TZ-14: OpenRouter asks for app attribution headers (HTTP-Referer, X-Title) —
// it uses them to feature us in its rankings. They affect nothing in the
// request itself, but it's the right thing to do.
export const openRouterConfig = {
  get appUrl(): string {
    return process.env.PUBLIC_APP_URL ?? 'https://bot-ville-client.vercel.app';
  },
  appTitle: 'BotVille',
  // Model catalog cache TTL (the list is public and changes rarely)
  get catalogTtlMs(): number {
    return Number(process.env.OPENROUTER_CATALOG_TTL_MS ?? 3_600_000);
  },
};

export const rateLimitConfig = {
  chatPerMin: Number(process.env.RATE_LIMIT_CHAT_PER_MIN ?? 20),
  meetingPerMin: Number(process.env.RATE_LIMIT_MEETING_PER_MIN ?? 5),
  globalPerMin: Number(process.env.RATE_LIMIT_GLOBAL_PER_MIN ?? 100),
  // TZ-18: the owner checks stats by hand, occasionally — the limit is deliberately strict
  statsPerMin: Number(process.env.RATE_LIMIT_STATS_PER_MIN ?? 10),
};

// Boot guard (TZ-04, checklist item 3): in production the server refuses to
// start if a required secret is missing, too short, or still the default
// placeholder from .env.example. In dev it's only a warning, so local
// development isn't blocked. No secret values ever reach the log.
const REQUIRED_SECRETS = ['SESSION_SECRET', 'ENCRYPTION_SECRET'] as const;
const MIN_SECRET_LEN = 32;

// TZ-18: secret for the read-only stats endpoint. An empty, short, or
// still-placeholder secret = the endpoint is DISABLED (404). That way
// "forgot to set the variable" results in a closed door, not numbers exposed
// to the whole internet.
export const statsConfig = {
  /** The valid token, or null if the endpoint should be disabled. */
  get token(): string | null {
    const value = process.env.STATS_TOKEN;
    if (!value || value.length < MIN_SECRET_LEN || value.startsWith('change-this')) return null;
    return value;
  },
};

function secretProblem(name: string): string | null {
  const value = process.env[name];
  if (!value) return `${name} is missing`;
  if (value.startsWith('change-this')) return `${name} is the default placeholder from .env.example`;
  if (value.length < MIN_SECRET_LEN) return `${name} is shorter than ${MIN_SECRET_LEN} characters`;
  return null;
}

export function assertSecretsOrExit(): void {
  const problems: string[] = [];
  for (const name of REQUIRED_SECRETS) {
    const p = secretProblem(name);
    if (p) problems.push(p);
  }
  // DEMO_API_KEY is required only when demo mode is enabled
  if (process.env.DEMO_ENABLED === 'true') {
    const key = process.env.DEMO_API_KEY;
    if (!key || key === 'your-deepseek-key') {
      problems.push('DEMO_ENABLED=true, but DEMO_API_KEY is missing or a placeholder');
    }
  }
  if (problems.length === 0) return;

  const header = '[BotVille Server] Problems with required secrets:';
  const lines = problems.map(p => `  - ${p}`).join('\n');
  if (isProd) {
    console.error(`${header}\n${lines}\nThe server cannot start in production. Set the secrets in env.`);
    process.exit(1);
  }
  console.warn(`${header}\n${lines}\n(dev mode: continuing, but in production this startup would be rejected)`);
}

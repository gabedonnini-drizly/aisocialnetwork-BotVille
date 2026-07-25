export type LLMProviderType =
  | 'claude'
  | 'openai'
  | 'deepseek'
  | 'ollama'
  | 'openrouter'
  | 'custom';

export interface LLMModel {
  id: string;
  name: string;
  contextWindow: number;
  supportsStreaming: boolean;
}

export interface LLMProvider {
  id: LLMProviderType;
  name: string;
  models: LLMModel[];
  requiresApiKey: boolean;
  baseUrl?: string;
  /** Список моделей приходит с сервера (живой каталог), а не из этого файла. */
  dynamicModels?: boolean;
  /** Базовый URL задаёт пользователь (Ollama, custom). */
  userBaseUrl?: boolean;
}

/** Фиксированный базовый URL OpenRouter — пользовательские URL сюда не попадают. */
export const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

export const LLM_PROVIDERS: LLMProvider[] = [
  {
    id: 'claude',
    name: 'Claude (Anthropic)',
    requiresApiKey: true,
    models: [
      { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', contextWindow: 200000, supportsStreaming: true },
      { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5', contextWindow: 200000, supportsStreaming: true },
    ],
  },
  {
    id: 'openai',
    name: 'OpenAI',
    requiresApiKey: true,
    models: [
      { id: 'gpt-4o', name: 'GPT-4o', contextWindow: 128000, supportsStreaming: true },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', contextWindow: 128000, supportsStreaming: true },
    ],
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    requiresApiKey: true,
    models: [
      { id: 'deepseek-chat', name: 'DeepSeek Chat', contextWindow: 64000, supportsStreaming: true },
      { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner', contextWindow: 64000, supportsStreaming: true },
    ],
  },
  {
    // ТЗ-14: агрегатор с OpenAI-совместимым API — один ключ на сотни моделей,
    // включая бесплатные (:free). Каталог живой, см. GET /api/models/openrouter.
    id: 'openrouter',
    name: 'OpenRouter (100+ models)',
    requiresApiKey: true,
    baseUrl: OPENROUTER_BASE_URL,
    dynamicModels: true,
    models: [],
  },
  {
    id: 'ollama',
    name: 'Ollama (Local)',
    requiresApiKey: false,
    baseUrl: 'http://localhost:11434',
    userBaseUrl: true,
    models: [
      { id: 'llama3.2', name: 'Llama 3.2', contextWindow: 128000, supportsStreaming: true },
      { id: 'mistral', name: 'Mistral 7B', contextWindow: 32000, supportsStreaming: true },
      { id: 'qwen2.5', name: 'Qwen 2.5', contextWindow: 128000, supportsStreaming: true },
    ],
  },
  {
    // ТЗ-14: любой OpenAI-совместимый endpoint (Groq, Together, локальный прокси).
    // baseUrl и имя модели вводит пользователь.
    id: 'custom',
    name: 'Custom (OpenAI-compatible)',
    requiresApiKey: true,
    userBaseUrl: true,
    models: [],
  },
];

/** Модель из живого каталога OpenRouter (GET /api/models/openrouter). */
export interface CatalogModel {
  id: string;
  name: string;
  contextWindow: number;
  /** Цена за 1M входных токенов в USD; null — цену провайдер не отдал. */
  promptPrice: number | null;
  /** Цена за 1M выходных токенов в USD; null — цену провайдер не отдал. */
  completionPrice: number | null;
  isFree: boolean;
}

/** Статус сохранённого ключа юзера. Сам ключ наружу не отдаётся — только маска. */
export interface UserKeyStatus {
  provider: LLMProviderType;
  /** Хвост ключа для узнавания, напр. `…f3a9`. Никогда не полный ключ. */
  maskedKey: string;
  baseUrl?: string;
  updatedAt: number;
}

export interface SetUserKeyDto {
  apiKey: string;
  /** Только для провайдеров с userBaseUrl (custom). */
  baseUrl?: string;
}

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
  /** The model list comes from the server (live catalog), not from this file. */
  dynamicModels?: boolean;
  /** The base URL is set by the user (Ollama, custom). */
  userBaseUrl?: boolean;
}

/** Fixed OpenRouter base URL — user-supplied URLs never end up here. */
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
    // TZ-14: an aggregator with an OpenAI-compatible API — one key for hundreds
    // of models, free ones (:free) included. The catalog is live, see
    // GET /api/models/openrouter.
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
    // TZ-14: any OpenAI-compatible endpoint (Groq, Together, a local proxy).
    // The user enters the baseUrl and the model name.
    id: 'custom',
    name: 'Custom (OpenAI-compatible)',
    requiresApiKey: true,
    userBaseUrl: true,
    models: [],
  },
];

/** A model from the live OpenRouter catalog (GET /api/models/openrouter). */
export interface CatalogModel {
  id: string;
  name: string;
  contextWindow: number;
  /** Price per 1M input tokens in USD; null — the provider didn't report a price. */
  promptPrice: number | null;
  /** Price per 1M output tokens in USD; null — the provider didn't report a price. */
  completionPrice: number | null;
  isFree: boolean;
}

/** Status of a saved user key. The key itself is never returned — only the mask. */
export interface UserKeyStatus {
  provider: LLMProviderType;
  /** Key tail for recognition, e.g. `…f3a9`. Never the full key. */
  maskedKey: string;
  baseUrl?: string;
  updatedAt: number;
}

export interface SetUserKeyDto {
  apiKey: string;
  /** Only for providers with userBaseUrl (custom). */
  baseUrl?: string;
}

export interface ApiError {
  code: string;
  message: string;
}

export interface ApiResponse<T> {
  data?: T;
  error?: ApiError;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface ChatRequest {
  agentId: string;
  message: string;
  history?: ChatMessage[];
}

export interface ChatChunk {
  type: 'delta' | 'done' | 'error' | 'demo_info' | 'demo_limit_reached';
  content?: string;
  /** Нормализованная ошибка провайдера: { code, message } с готовым текстом (RU) */
  error?: ApiError;
  /** Остаток demo-сообщений; присутствует в ответах demo-режима */
  demoRemaining?: number;
}

/** GET /api/chat/demo-status */
export interface DemoStatus {
  demoEnabled: boolean;
  demoRemaining?: number;
}

export interface SetApiKeyDto {
  apiKey: string;
  modelId: string;
  ollamaBaseUrl?: string;
}

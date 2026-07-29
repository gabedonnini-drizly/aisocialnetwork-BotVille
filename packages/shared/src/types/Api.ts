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
  /** Normalized provider error: { code, message } with ready-to-show text */
  error?: ApiError;
  /** Remaining demo messages; present in demo-mode responses */
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

export interface LLMMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface LLMStreamOptions {
  model: string;
  systemPrompt: string;
  messages: LLMMessage[];
  apiKey?: string;
  baseUrl?: string;
  onDelta: (text: string) => void;
  onDone: () => void;
  onError: (err: Error) => void;
}

export interface LLMAdapter {
  stream(options: LLMStreamOptions): Promise<void>;
}

import type { LLMAdapter, LLMStreamOptions } from '../LLMAdapter.js';
import { LLMError } from '../errors.js';

export class OpenAIAdapter implements LLMAdapter {
  /**
   * @param baseUrl базовый URL OpenAI-совместимого API
   * @param extraHeaders дополнительные заголовки провайдера (атрибуция OpenRouter)
   */
  constructor(
    private readonly baseUrl: string = 'https://api.openai.com/v1',
    private readonly extraHeaders: Record<string, string> = {},
  ) {}

  async stream({ model, systemPrompt, messages, apiKey, onDelta, onDone, onError }: LLMStreamOptions) {
    if (!apiKey) return onError(new Error('API key required'));
    try {
      const res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          ...this.extraHeaders,
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          stream: true,
          messages: [{ role: 'system', content: systemPrompt }, ...messages],
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        return onError(new LLMError(`API error ${res.status}`, res.status, text));
      }
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) onDelta(delta);
          } catch {}
        }
      }
      onDone();
    } catch (err) {
      onError(err instanceof Error ? err : new Error(String(err)));
    }
  }
}

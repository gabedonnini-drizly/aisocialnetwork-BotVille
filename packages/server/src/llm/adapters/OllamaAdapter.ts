import type { LLMAdapter, LLMStreamOptions } from '../LLMAdapter.js';
import { LLMError } from '../errors.js';

export class OllamaAdapter implements LLMAdapter {
  async stream({ model, systemPrompt, messages, baseUrl = 'http://localhost:11434', onDelta, onDone, onError }: LLMStreamOptions) {
    try {
      const res = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          stream: true,
          messages: [{ role: 'system', content: systemPrompt }, ...messages],
        }),
      });
      if (!res.ok) return onError(new LLMError(`Ollama error ${res.status}`, res.status));
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
          if (!line.trim()) continue;
          try {
            const parsed = JSON.parse(line);
            if (parsed.message?.content) onDelta(parsed.message.content);
            if (parsed.done) onDone();
          } catch {}
        }
      }
    } catch (err) {
      onError(err instanceof Error ? err : new Error(String(err)));
    }
  }
}

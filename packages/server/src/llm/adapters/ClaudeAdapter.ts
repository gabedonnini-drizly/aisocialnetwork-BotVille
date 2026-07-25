import type { LLMAdapter, LLMStreamOptions } from '../LLMAdapter.js';
import { LLMError } from '../errors.js';

export class ClaudeAdapter implements LLMAdapter {
  async stream({ model, systemPrompt, messages, apiKey, onDelta, onDone, onError }: LLMStreamOptions) {
    if (!apiKey) return onError(new Error('Claude API key required'));
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model,
          max_tokens: 4096,
          system: systemPrompt,
          messages,
          stream: true,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        return onError(new LLMError(`Claude API error ${res.status}`, res.status, text));
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
            if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
              onDelta(parsed.delta.text);
            }
          } catch {}
        }
      }
      onDone();
    } catch (err) {
      onError(err instanceof Error ? err : new Error(String(err)));
    }
  }
}

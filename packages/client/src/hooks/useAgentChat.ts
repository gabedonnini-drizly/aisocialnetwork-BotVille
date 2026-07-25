import { useState, useCallback, useRef } from 'react';
import { apiFetch } from '../lib/api.js';
import type { TKey } from '../i18n/index.js';

/** Сообщение в ленте чата; 'system' — служебные (ошибки), в историю LLM не попадают */
export interface ChatFeedMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  /** Ошибки храним ключом словаря — текст переводится при рендере (смена языка на лету) */
  i18nKey?: TKey;
}

interface UseChatReturn {
  messages: ChatFeedMessage[];
  isStreaming: boolean;
  sendMessage: (text: string) => Promise<void>;
  clearHistory: () => void;
  /** Остаток demo-сообщений (из SSE); null — агент работает на своём ключе */
  demoRemaining: number | null;
  demoLimitReached: boolean;
  dismissDemoLimit: () => void;
  /** Стрим оборвался и авторетрай не помог — показать кнопку «Повторить» */
  canRetry: boolean;
  retryLast: () => void;
}

const RETRY_DELAY_MS = 2000;

// Коды нормализованных ошибок сервера (llm/errors.ts) → ключи словаря error.*
const KNOWN_ERROR_CODES = ['invalid_key', 'rate_limited', 'no_credits', 'stream_error', 'server_down', 'no_model_access'] as const;

// ТЗ-14: HTTP-400 от /api/chat — агент недонастроен, а не сбой связи
const SETUP_ERROR_KEYS: Record<string, TKey> = {
  NO_API_KEY: 'error.no_key_set',
  NO_BASE_URL: 'error.no_endpoint_set',
};

type AttemptResult = 'ok' | 'break' | 'http_error';

export function useAgentChat(agentId: string): UseChatReturn {
  const [messages, setMessages] = useState<ChatFeedMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [demoRemaining, setDemoRemaining] = useState<number | null>(null);
  const [demoLimitReached, setDemoLimitReached] = useState(false);
  const [canRetry, setCanRetry] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const messagesRef = useRef<ChatFeedMessage[]>([]);
  const lastTextRef = useRef('');
  messagesRef.current = messages;

  const pushSystem = (content: string, i18nKey?: TKey) => {
    setMessages(prev => {
      // убираем пустой assistant-плейсхолдер — ответа не будет
      const last = prev[prev.length - 1];
      const base = last?.role === 'assistant' && !last.content ? prev.slice(0, -1) : prev;
      return [...base, { role: 'system' as const, content, i18nKey, timestamp: Date.now() }];
    });
  };

  // Один заход стрима: 'ok' — получили терминальное событие (done/error/…),
  // 'break' — обрыв соединения или стрим кончился без терминального события.
  const attempt = useCallback(async (text: string): Promise<AttemptResult> => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    let terminal = false;

    try {
      const res = await apiFetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId,
          message: text,
          history: messagesRef.current.filter(m => m.role !== 'system' && m.content).slice(-10),
        }),
        signal: abortRef.current.signal,
      });
      if (!res.ok || !res.body) {
        // 429 — понятный лимит, ретраить бессмысленно; 5xx/прокси-ошибка
        // (сервер недоступен) — как обрыв соединения: авторетрай + «Повторить»
        if (res.status === 429) {
          pushSystem('', 'error.too_many_requests');
          setIsStreaming(false);
          return 'http_error';
        }
        // ТЗ-14: настройка агента неполна (нет ключа / адреса) — ретрай ничего
        // не изменит, поэтому сразу человеческий текст, а не «связь прервалась»
        if (res.status === 400) {
          const code = await res.json().then(j => j?.error?.code).catch(() => undefined);
          const key = SETUP_ERROR_KEYS[code as string];
          if (key) {
            pushSystem('', key);
            setIsStreaming(false);
            return 'http_error';
          }
        }
        return 'break';
      }
      const reader = res.body.getReader();
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
          try {
            const chunk = JSON.parse(line.slice(6));
            if (chunk.type === 'delta' && chunk.content) {
              setMessages(prev => {
                const copy = [...prev];
                const last = copy[copy.length - 1];
                if (last?.role === 'assistant') copy[copy.length - 1] = { ...last, content: last.content + chunk.content };
                return copy;
              });
            }
            if (chunk.type === 'done') {
              terminal = true;
              setIsStreaming(false);
              if (typeof chunk.demoRemaining === 'number') setDemoRemaining(chunk.demoRemaining);
            }
            if (chunk.type === 'demo_info' && typeof chunk.demoRemaining === 'number') {
              setDemoRemaining(chunk.demoRemaining);
            }
            if (chunk.type === 'demo_limit_reached') {
              terminal = true;
              setIsStreaming(false);
              setDemoRemaining(0);
              setDemoLimitReached(true);
              setMessages(prev => {
                const last = prev[prev.length - 1];
                return last?.role === 'assistant' && !last.content ? prev.slice(0, -1) : prev;
              });
            }
            if (chunk.type === 'error') {
              // Нормализованная ошибка провайдера — системкой в ленту.
              // Текст берём по code из словаря; серверный message — фолбэк (ТЗ-07).
              terminal = true;
              setIsStreaming(false);
              const code = typeof chunk.error === 'object' ? chunk.error?.code : undefined;
              if (KNOWN_ERROR_CODES.includes(code)) {
                pushSystem('', `error.${code as typeof KNOWN_ERROR_CODES[number]}`);
              } else {
                const message = typeof chunk.error === 'string' ? chunk.error : chunk.error?.message;
                pushSystem(message ?? '', message ? undefined : 'error.generic');
              }
            }
          } catch {}
        }
      }
      if (terminal) return 'ok';
      return 'break';
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'ok';
      return 'break';
    }
  }, [agentId]);

  // addUserMsg=false — повтор после обрыва, сообщение уже в ленте
  const run = useCallback(async (text: string, addUserMsg: boolean) => {
    lastTextRef.current = text;
    setCanRetry(false);
    setMessages(prev => [
      ...prev,
      ...(addUserMsg ? [{ role: 'user' as const, content: text, timestamp: Date.now() }] : []),
      { role: 'assistant' as const, content: '', timestamp: Date.now() },
    ]);
    setIsStreaming(true);

    let result = await attempt(text);
    if (result === 'break') {
      // 1 автоматический ретрай через 2 секунды
      await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
      // сбрасываем частично полученный ответ перед повтором
      setMessages(prev => {
        const copy = [...prev];
        const last = copy[copy.length - 1];
        if (last?.role === 'assistant') copy[copy.length - 1] = { ...last, content: '' };
        return copy;
      });
      result = await attempt(text);
    }
    if (result === 'break') {
      setIsStreaming(false);
      pushSystem('', 'error.stream_error');
      setCanRetry(true);
    }
  }, [attempt]);

  const sendMessage = useCallback((text: string) => run(text, true), [run]);
  const retryLast = useCallback(() => {
    if (lastTextRef.current) {
      // убираем системку про обрыв перед повтором
      setMessages(prev => prev.filter((m, i) => !(i === prev.length - 1 && m.role === 'system')));
      void run(lastTextRef.current, false);
    }
  }, [run]);

  return {
    messages,
    isStreaming,
    sendMessage,
    clearHistory: () => setMessages([]),
    demoRemaining,
    demoLimitReached,
    dismissDemoLimit: () => setDemoLimitReached(false),
    canRetry,
    retryLast,
  };
}

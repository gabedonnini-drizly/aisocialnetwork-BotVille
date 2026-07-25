import { useState, useRef, useEffect } from 'react';
import { useUIStore, useAgentStore } from '../../store/agentStore.js';
import { useAgentChat } from '../../hooks/useAgentChat.js';
import { useT } from '../../i18n/index.js';
import styles from './ChatWindow.module.css';

export function ChatWindow() {
  const t = useT();
  const { selectedAgentId, chatOpen, closeChat, openProfile } = useUIStore();
  const agents = useAgentStore(s => s.agents);
  const agent = agents.find(a => a.id === selectedAgentId);
  const [input, setInput] = useState('');
  const { messages, isStreaming, sendMessage, demoRemaining, demoLimitReached, dismissDemoLimit, canRetry, retryLast } =
    useAgentChat(selectedAgentId ?? '');
  const bottomRef = useRef<HTMLDivElement>(null);
  const windowRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // Клавиатура iOS не сжимает layout viewport (dvh из CSS не срабатывает) —
  // на мобиле подгоняем окно чата по visualViewport, чтобы поле ввода
  // оставалось видимым. На десктопе инлайн-стили снимаются (ТЗ-10).
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const apply = () => {
      const el = windowRef.current;
      if (!el) return;
      if (!window.matchMedia('(max-width: 480px)').matches) {
        el.style.bottom = '';
        el.style.height = '';
        return;
      }
      const overlap = window.innerHeight - vv.height - vv.offsetTop;
      el.style.bottom = `${Math.max(8, overlap + 8)}px`;
      el.style.height = `${Math.min(520, vv.height - 16)}px`;
    };
    apply();
    vv.addEventListener('resize', apply);
    vv.addEventListener('scroll', apply);
    return () => {
      vv.removeEventListener('resize', apply);
      vv.removeEventListener('scroll', apply);
    };
  }, []);

  if (!chatOpen || !agent) return null;

  const handleSend = () => {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput('');
    sendMessage(text);
  };

  return (
    <div className={styles.window} ref={windowRef} onClick={e => e.stopPropagation()}>
      {/* Header */}
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => { closeChat(); openProfile(agent.id); }}>←</button>
        <div className={styles.agentName}>{agent.name}</div>
        <div className={styles.modelInfo}>{agent.modelId}</div>
        {demoRemaining !== null && (
          <div className={styles.demoBadge}>{t('chat.demoRemaining', { n: demoRemaining })}</div>
        )}
        <button className={styles.closeBtn} onClick={closeChat}>✕</button>
      </div>

      {/* Messages */}
      <div className={styles.messages}>
        {messages.length === 0 && (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>💬</div>
            <div>{t('chat.empty', { name: agent.name })}</div>
          </div>
        )}
        {messages.map((msg, i) =>
          msg.role === 'system' ? (
            <div key={i} className={styles.systemMsg}>{msg.i18nKey ? t(msg.i18nKey) : msg.content}</div>
          ) : (
            <div key={i} className={`${styles.message} ${styles[msg.role]}`}>
              <div className={styles.bubble}>
                {msg.content || (isStreaming && i === messages.length - 1 ? <span className={styles.cursor}>▊</span> : null)}
              </div>
            </div>
          )
        )}
        {canRetry && (
          <button className={styles.retryBtn} onClick={retryLast}>{t('chat.retry')}</button>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className={styles.inputArea}>
        <textarea
          className={styles.textarea}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          placeholder={t('chat.placeholder', { name: agent.name })}
          rows={2}
          disabled={isStreaming}
        />
        <button className={styles.sendBtn} onClick={handleSend} disabled={isStreaming || !input.trim()}>
          {isStreaming ? '⏳' : '↑'}
        </button>
      </div>

      {/* Демо закончилось — дружелюбный апселл */}
      {demoLimitReached && (
        <div className={styles.demoModalOverlay}>
          <div className={styles.demoModal}>
            <div className={styles.demoModalIcon}>🎉</div>
            <div className={styles.demoModalTitle}>{t('chat.demoOverTitle')}</div>
            <div className={styles.demoModalText}>{t('chat.demoOverText')}</div>
            <div className={styles.demoModalBtns}>
              <button className={styles.demoModalSecondary} onClick={dismissDemoLimit}>{t('chat.later')}</button>
              <button
                className={styles.demoModalPrimary}
                onClick={() => { dismissDemoLimit(); closeChat(); openProfile(agent.id); }}
              >
                {t('chat.addKey')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

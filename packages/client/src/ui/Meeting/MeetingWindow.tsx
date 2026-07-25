import { useState, useRef, useEffect } from 'react';
import { useAgentStore, useUIStore } from '../../store/agentStore.js';
import { GameBridge } from '../../game/GameBridge.js';
import { apiFetch } from '../../lib/api.js';
import { useT } from '../../i18n/index.js';
import styles from './MeetingWindow.module.css';

interface AgentResult {
  agentId: string;
  name: string;
  content: string;
  status: 'waiting' | 'thinking' | 'done' | 'error';
  error?: string;
}

export function MeetingWindow() {
  const t = useT();
  const { closeMeeting } = useUIStore();
  const { agents } = useAgentStore();
  const [task, setTask] = useState('');
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<AgentResult[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  // Notify Phaser to gather agents
  useEffect(() => {
    if (running) {
      agents.forEach(a => GameBridge.emit('dispatch:task', { agentId: a.id, task }));
    }
  }, [running]);

  const startMeeting = async () => {
    if (!task.trim() || running) return;
    setRunning(true);
    // Init results for each agent
    setResults(agents.map(a => ({ agentId: a.id, name: a.name, content: '', status: 'waiting' })));

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    try {
      const res = await apiFetch('/api/meeting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task: task.trim() }),
        signal: abortRef.current.signal,
      });

      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

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
            if (chunk.type === 'agent_start') {
              setResults(prev => prev.map(r =>
                r.agentId === chunk.agentId ? { ...r, status: 'thinking' } : r
              ));
            }
            if (chunk.type === 'agent_delta') {
              setResults(prev => prev.map(r =>
                r.agentId === chunk.agentId ? { ...r, content: r.content + chunk.content } : r
              ));
            }
            if (chunk.type === 'agent_done') {
              setResults(prev => prev.map(r =>
                r.agentId === chunk.agentId ? { ...r, status: 'done' } : r
              ));
            }
            if (chunk.type === 'agent_error') {
              setResults(prev => prev.map(r =>
                r.agentId === chunk.agentId ? { ...r, status: 'error', error: chunk.error } : r
              ));
            }
            if (chunk.type === 'meeting_done') setRunning(false);
          } catch {}
        }
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') console.error(e);
      setRunning(false);
    }
  };

  const stop = () => { abortRef.current?.abort(); setRunning(false); };

  const statusIcon = (s: AgentResult['status']) =>
    ({ waiting: '⏸', thinking: '🔄', done: '✅', error: '❌' })[s];

  return (
    <div className={styles.overlay} onClick={closeMeeting}>
      <div className={styles.window} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <span className={styles.icon}>🏢</span>
          <div>
            <div className={styles.title}>{t('meeting.title')}</div>
            <div className={styles.subtitle}>{t('meeting.subtitle', { n: agents.length })}</div>
          </div>
          <button className={styles.closeBtn} onClick={closeMeeting}>✕</button>
        </div>

        {/* Task input */}
        <div className={styles.inputSection}>
          <textarea
            className={styles.taskInput}
            value={task}
            onChange={e => setTask(e.target.value)}
            placeholder={t('meeting.placeholder')}
            rows={3}
            disabled={running}
          />
          <div className={styles.btnRow}>
            {running
              ? <button className={styles.stopBtn} onClick={stop}>{t('meeting.stop')}</button>
              : <button className={styles.startBtn} onClick={startMeeting} disabled={!task.trim() || !agents.length}>
                  {t('meeting.start', { n: agents.length })}
                </button>
            }
          </div>
        </div>

        {/* Results grid */}
        {results.length > 0 && (
          <div className={styles.resultsGrid} style={{ gridTemplateColumns: `repeat(${Math.min(agents.length, 2)}, 1fr)` }}>
            {results.map(r => (
              <div key={r.agentId} className={`${styles.agentCard} ${styles[r.status]}`}>
                <div className={styles.agentHeader}>
                  <div className={styles.agentAvatar} style={{
                    background: `hsl(${(agents.find(a => a.id === r.agentId)?.avatarVariant ?? 0) * 45}, 50%, 35%)`
                  }}>
                    {r.name[0].toUpperCase()}
                  </div>
                  <div className={styles.agentName}>{r.name}</div>
                  <span className={styles.statusIcon}>{statusIcon(r.status)}</span>
                </div>
                <div className={styles.agentResponse}>
                  {r.status === 'error'
                    ? <span className={styles.errorText}>{r.error}</span>
                    : r.status === 'waiting'
                    ? <span className={styles.waitingText}>{t('meeting.waiting')}</span>
                    : r.content || <span className={styles.thinkingText}>{t('meeting.thinking')}<span className={styles.dots}>...</span></span>
                  }
                </div>
              </div>
            ))}
          </div>
        )}

        {agents.length === 0 && (
          <div className={styles.noAgents}>{t('meeting.noAgents')}</div>
        )}
      </div>
    </div>
  );
}

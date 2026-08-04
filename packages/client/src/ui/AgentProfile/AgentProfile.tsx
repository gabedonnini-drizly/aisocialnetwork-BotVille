import { useState } from 'react';
import { useAgentStore, useUIStore } from '../../store/agentStore.js';
import { ModelSelector } from './ModelSelector.js';
import { LLM_PROVIDERS } from '@botville/shared';
import { GameBridge } from '../../game/GameBridge.js';
import { STATUS_COLORS } from '../../game/palette.js';
import { useT, STATUS_KEYS, locationKey } from '../../i18n/index.js';
import { useWorldStore } from '../../store/worldStore.js';
import { isSleepTime } from '../../game/dayNight.js';
import styles from './AgentProfile.module.css';

export function AgentProfile() {
  const t = useT();
  const { selectedAgentId, closeProfile, openChat } = useUIStore();
  const agents = useAgentStore(s => s.agents);
  const timeOfDay = useWorldStore(s => s.timeOfDay);
  const agent = agents.find(a => a.id === selectedAgentId);

  if (!agent) return null;

  const providerName = LLM_PROVIDERS.find(p => p.id === agent.providerType)?.name ?? agent.providerType;
  const modelName = LLM_PROVIDERS.find(p => p.id === agent.providerType)?.models.find(m => m.id === agent.modelId)?.name ?? agent.modelId;

  const statusColors = STATUS_COLORS;
  const statusLabel = STATUS_KEYS[agent.status] ? t(STATUS_KEYS[agent.status]) : agent.status;
  // TZ-16: where the agent is right now (at night in the dorm — "Sleeping")
  const locationLabel = isSleepTime(timeOfDay) && agent.location === 'dorm'
    ? t('loc.dormSleeping')
    : t(locationKey(agent.location));

  return (
    <div className={styles.overlay} onClick={closeProfile}>
      <div className={styles.card} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.avatar} style={{ background: `hsl(${agent.avatarVariant * 45}, 60%, 40%)` }}>
            <span className={styles.avatarInitial}>{agent.name[0].toUpperCase()}</span>
          </div>
          <div className={styles.agentInfo}>
            <h2 className={styles.agentName}>{agent.name}</h2>
            <div className={styles.statusRow}>
              <span className={styles.statusDot} style={{ background: statusColors[agent.status] ?? '#a69e8e' }} />
              <span className={styles.statusText}>{statusLabel} · {locationLabel}</span>
            </div>
            <div className={styles.modelBadge}>{providerName} · {modelName}</div>
          </div>
          <button className={styles.closeBtn} onClick={closeProfile}>✕</button>
        </div>

        {/* System prompt */}
        <div className={styles.section}>
          <div className={styles.label}>{t('profile.personality')}</div>
          <div className={styles.systemPrompt}>{agent.systemPrompt || t('profile.noPersonality')}</div>
        </div>

        {/* Model selector */}
        <ModelSelector agent={agent} />

        {/* Actions */}
        <div className={styles.actions}>
          <button
            className={styles.btnPrimary}
            onClick={() => { closeProfile(); openChat(agent.id); }}
          >
            {t('profile.chat')}
          </button>
          <button
            className={styles.btnSecondary}
            onClick={() => {
              GameBridge.emit('dispatch:task', { agentId: agent.id, task: '' });
              closeProfile();
            }}
          >
            {t('profile.sendTask')}
          </button>
        </div>
      </div>
    </div>
  );
}

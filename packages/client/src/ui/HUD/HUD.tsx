import { useEffect, useState } from 'react';
import { useAgentStore, useUIStore } from '../../store/agentStore.js';
import { useWorldStore } from '../../store/worldStore.js';
import { CreateAgentModal } from './CreateAgentModal.js';
import { KeysPanel } from './KeysPanel.js';
import { Clock } from './Clock.js';
import { GameBridge } from '../../game/GameBridge.js';
import { isSleepTime } from '../../game/dayNight.js';
import { FREE_SLOT_LIMIT } from '@botville/shared';
import { STATUS_COLORS } from '../../game/palette.js';
import { useT, STATUS_KEYS, LOCATION_KEYS } from '../../i18n/index.js';
import styles from './HUD.module.css';

export function HUD() {
  const t = useT();
  const { agents, fetchAgents, deleteAgent } = useAgentStore();
  const { openProfile, openMeeting } = useUIStore();
  const [showCreate, setShowCreate] = useState(false);
  const [showKeys, setShowKeys] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ agentId: string; x: number; y: number } | null>(null);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  const slots = Array.from({ length: FREE_SLOT_LIMIT }, (_, i) => agents.find(a => a.slotIndex === i));

  const statusColors = STATUS_COLORS;
  const statusLabel = (status: string) =>
    STATUS_KEYS[status] ? t(STATUS_KEYS[status]) : status;

  // TZ-16: the agent's location in the HUD; at night in the dorm — "Sleeping (dorm)"
  const night = isSleepTime(useWorldStore(s => s.timeOfDay));
  const locationLabel = (location: string) =>
    night && location === 'dorm' ? t('loc.dormSleeping') : t(LOCATION_KEYS[location] ?? 'loc.district');

  return (
    <>
      <div className={styles.hud} onClick={() => setContextMenu(null)}>
        <div className={styles.logo}>
          <span className={styles.logoIcon}>⬛</span>
          BotVille
        </div>

        <div className={styles.divider} />

        <Clock />

        <div className={styles.divider} />

        <div className={styles.slots}>
          {slots.map((agent, i) =>
            agent ? (
              <div
                key={agent.id}
                className={styles.slot}
                onClick={() => {
                  openProfile(agent.id);
                  // a click leads to the agent (TZ-16): on the street — camera pan,
                  // inside a building — switch to its interior and point at them
                  GameBridge.emit('agent:goto', { agentId: agent.id, location: agent.location });
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setContextMenu({ agentId: agent.id, x: e.clientX, y: e.clientY });
                }}
                title={`${agent.name} — ${statusLabel(agent.status)} · ${locationLabel(agent.location)}\n${t('hud.gotoHint')}\n${t('hud.rightClickHint')}`}
              >
                <div
                  className={styles.slotAvatar}
                  style={{ background: `hsl(${agent.avatarVariant * 45}, 55%, 32%)` }}
                >
                  {agent.name[0].toUpperCase()}
                  <span
                    className={styles.slotDot}
                    style={{ background: statusColors[agent.status] ?? '#a69e8e' }}
                  />
                </div>
                <div className={styles.slotName}>{agent.name.slice(0, 8)}</div>
                <div className={styles.slotStatus}>{statusLabel(agent.status)}</div>
                <div className={styles.slotLoc}>{locationLabel(agent.location)}</div>
              </div>
            ) : (
              <div key={i} className={`${styles.slot} ${styles.emptySlot}`} onClick={() => setShowCreate(true)}>
                <div className={styles.addIcon}>＋</div>
                <div className={styles.slotName}>{t('hud.new')}</div>
              </div>
            )
          )}
        </div>

        {agents.length >= 2 && (
          <>
            <div className={styles.divider} />
            <button className={styles.meetingBtn} onClick={openMeeting} title={t('hud.meetingHint')}>
              {t('hud.meeting')}
            </button>
          </>
        )}

        <div className={styles.divider} />

        {/* TZ-14: keys — a compact panel opened from the HUD, not a separate tab */}
        <button className={styles.keysBtn} onClick={() => setShowKeys(true)} title={t('hud.keysHint')}>
          🔑
        </button>
      </div>

      {/* Right-click context menu */}
      {contextMenu && (
        <div
          className={styles.contextMenu}
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={() => setContextMenu(null)}
        >
          <div className={styles.contextItem} onClick={() => openProfile(contextMenu.agentId)}>
            {t('hud.openProfile')}
          </div>
          <div className={styles.contextItem} onClick={() => {
            if (confirm(t('hud.confirmDelete'))) deleteAgent(contextMenu.agentId);
          }}>
            {t('hud.deleteAgent')}
          </div>
        </div>
      )}

      {showCreate && <CreateAgentModal onClose={() => { setShowCreate(false); fetchAgents(); }} />}
      {showKeys && <KeysPanel onClose={() => setShowKeys(false)} />}
    </>
  );
}

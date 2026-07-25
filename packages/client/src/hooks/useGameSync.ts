import { useEffect, useRef, useCallback } from 'react';
import { useAgentStore, useUIStore } from '../store/agentStore.js';
import { sceneRegistry } from '../game/SceneRegistry.js';
import { GameBridge } from '../game/GameBridge.js';
import { GameTime } from '../game/time.js';
import { fetchAgentLocations } from '../lib/api.js';
import { LOCATION_POLL_MS } from '../game/config.js';
import type { Agent, AgentLocation } from '@botville/shared';

/** Что сцена знает об агенте; location решает, рисовать ли его здесь (ТЗ-16). */
export interface SyncedAgent {
  id: string;
  name: string;
  avatarVariant: number;
  location: AgentLocation;
}

/** Сцены, в которые синкается список агентов (район и все интерьеры). */
interface AgentSyncScene extends Phaser.Scene {
  syncAgents(list: SyncedAgent[]): void;
}

function isSyncable(scene: Phaser.Scene | undefined): scene is AgentSyncScene {
  return !!scene && typeof (scene as Partial<AgentSyncScene>).syncAgents === 'function';
}

export function useGameSync() {
  const { agents, fetchAgents } = useAgentStore();
  const { setScene } = useUIStore();
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const agentsRef = useRef<Agent[]>(agents);
  const sceneKeyRef = useRef('DistrictScene');

  // Keep ref current
  useEffect(() => { agentsRef.current = agents; }, [agents]);

  // Fetch on mount
  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  // ТЗ-16: поллинг «кто где» + серверный игровой час. Сервер — правда о месте,
  // клиент лишь дорисовывает; час подтягиваем, чтобы ночь клиента и сервера
  // не спорили (см. GameTime.syncFrom).
  useEffect(() => {
    let stopped = false;
    const poll = async () => {
      const snap = await fetchAgentLocations();
      if (!snap || stopped) return;
      GameTime.syncFrom(snap.gameHour);
      useAgentStore.getState().applyLocations(snap.locations);
    };
    void poll();
    const interval = setInterval(() => { void poll(); }, LOCATION_POLL_MS);
    return () => { stopped = true; clearInterval(interval); };
  }, []);

  // Синк в активную сцену; ретраи, пока она не зарегистрируется
  const syncToScene = useCallback((retries = 30) => {
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    const scene = sceneRegistry.get(sceneKeyRef.current);
    if (isSyncable(scene)) {
      scene.syncAgents(agentsRef.current.map(a => ({
        id: a.id,
        name: a.name,
        avatarVariant: a.avatarVariant,
        location: a.location,
      })));
    } else if (retries > 0) {
      syncTimeoutRef.current = setTimeout(() => syncToScene(retries - 1), 400);
    }
  }, []);

  // Sync whenever agents list changes
  useEffect(() => {
    agentsRef.current = agents;
    syncToScene();
    return () => {
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    };
  }, [agents, syncToScene]);

  // Смена сцены — синк агентов в новую сцену
  useEffect(() => {
    const handler = ({ scene }: { scene: string }) => {
      setScene(scene);
      sceneKeyRef.current = scene;
      // небольшая пауза, чтобы Phaser дорегистрировал новую сцену
      setTimeout(() => syncToScene(), 100);
    };
    GameBridge.on('scene:changed', handler);
    return () => { GameBridge.off('scene:changed', handler); };
  }, [setScene, syncToScene]);
}

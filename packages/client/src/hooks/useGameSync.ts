import { useEffect, useRef, useCallback } from 'react';
import { useAgentStore, useUIStore } from '../store/agentStore.js';
import { sceneRegistry } from '../game/SceneRegistry.js';
import { GameBridge } from '../game/GameBridge.js';
import { GameTime } from '../game/time.js';
import { fetchAgentLocations } from '../lib/api.js';
import { LOCATION_POLL_MS } from '../game/config.js';
import { flattenSomewhere, presenceModel, warnUnknown } from '../game/presence.js';
import type { Agent, AgentPresence } from '@botville/shared';

/** What a scene knows about an agent; location decides whether to draw it here (TZ-16).
 *  F-3: a venue id (string) — the runtime authority on "known" is PresenceModel over
 *  the venue registry (game/presence.ts), not a closed AGENT_LOCATIONS vocabulary. */
export interface SyncedAgent {
  id: string;
  name: string;
  avatarVariant: number;
  location: string;
}

/** Scenes the agent list is synced into (the district and all interiors). */
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

  // TZ-16: "who is where" polling + server game hour. The server is the source of
  // truth for location, the client only renders; we pull the hour so the client's
  // and server's night don't disagree (see GameTime.syncFrom).
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

  // Sync into the active scene; retries until it registers
  const syncToScene = useCallback((retries = 30) => {
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    const scene = sceneRegistry.get(sceneKeyRef.current);
    if (isSyncable(scene)) {
      // F-3: PresenceModel is the runtime authority on "who is where". Unknown/absent
      // agents never reach a scene — not even mid-transit — and unknown ids get a
      // single compact warning instead of the retired clamp's silent district fallback.
      const roster: AgentPresence[] = agentsRef.current.map(a => ({
        id: a.id, displayName: a.name, spriteSeed: a.id, venueId: a.location,
      }));
      const { somewhere, unknown } = presenceModel.partition(roster);
      warnUnknown(unknown);
      const visible = flattenSomewhere(somewhere);
      scene.syncAgents(agentsRef.current
        .filter(a => visible.has(a.id))
        .map(a => ({
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

  // Scene change — sync agents into the new scene
  useEffect(() => {
    const handler = ({ scene }: { scene: string }) => {
      setScene(scene);
      sceneKeyRef.current = scene;
      // a short pause so Phaser finishes registering the new scene
      setTimeout(() => syncToScene(), 100);
    };
    GameBridge.on('scene:changed', handler);
    return () => { GameBridge.off('scene:changed', handler); };
  }, [setScene, syncToScene]);
}

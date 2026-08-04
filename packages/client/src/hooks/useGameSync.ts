import { useEffect, useRef, useCallback } from 'react';
import { useAgentStore, useUIStore } from '../store/agentStore.js';
import { sceneRegistry } from '../game/SceneRegistry.js';
import { GameBridge } from '../game/GameBridge.js';
import { GameTime } from '../game/time.js';
import {
  fetchAgentLocations, fetchPlatformLocations, fetchPlotStates, PRESENCE_MODE, type PresenceMode,
} from '../lib/api.js';
import { applyPlotStates } from '../game/plotState.js';
import { LOCATION_POLL_MS } from '../game/config.js';
import { DISTRICT_SCENE_KEY } from '../game/venueRegistry.js';
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
  /** Addendum O-2 #1 «where + what»: coarse activity label; integrated mode only. */
  activity?: string;
  /** Platform identity for derived appearance (D-25); fixture agents omit it. */
  spriteSeed?: string;
}

/** Scenes the agent list is synced into (the district and all interiors). */
interface AgentSyncScene extends Phaser.Scene {
  syncAgents(list: SyncedAgent[]): void;
}

function isSyncable(scene: Phaser.Scene | undefined): scene is AgentSyncScene {
  return !!scene && typeof (scene as Partial<AgentSyncScene>).syncAgents === 'function';
}

// Addendum II.1: the mode is picked ONCE at module scope from the
// build-time env (PRESENCE_MODE). The only runtime transition is
// integrated → fixture when the platform serves an invalid snapshot
// (one warn, in api.ts).
let presenceMode: PresenceMode = PRESENCE_MODE;
/** Latest platform roster; syncToScene partitions it instead of the store in integrated mode. */
let platformRoster: AgentPresence[] = [];

export function useGameSync() {
  const { agents, fetchAgents } = useAgentStore();
  const { setScene } = useUIStore();
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const agentsRef = useRef<Agent[]>(agents);
  const sceneKeyRef = useRef(DISTRICT_SCENE_KEY);

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
      // Plot state rides the existing tick rather than adding a timer: a
      // parcel changes state at dawn (D-36), so 15s is already far finer than
      // the world moves, and `applyPlotStates` is a no-op unless something
      // actually moved. A null answer means no source spoke; keep what we had.
      void fetchPlotStates().then(rows => { if (rows && !stopped) applyPlotStates(rows); });
      if (presenceMode === 'integrated') {
        const result = await fetchPlatformLocations();
        if (stopped) return;
        if (result.ok) {
          GameTime.syncFrom(result.gameHour);
          platformRoster = result.roster;
          syncToScene();
          return;
        }
        if (result.reason === 'network') return; // keep last roster; retry next tick
        presenceMode = 'fixture'; // invalid schema — warned once in api.ts
      }
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
      // F-3: PresenceModel is the runtime authority on "who is where" — BOTH
      // modes route through it. Unknown/absent agents never reach a scene,
      // and unknown ids get warnUnknown's single compact warning per id.
      const roster: AgentPresence[] = presenceMode === 'integrated'
        ? platformRoster
        : agentsRef.current.map(a => ({
            id: a.id, displayName: a.name, spriteSeed: a.id, venueId: a.location,
          }));
      const { somewhere, unknown } = presenceModel.partition(roster);
      warnUnknown(unknown);
      const visible = flattenSomewhere(somewhere);
      const list: SyncedAgent[] = presenceMode === 'integrated'
        ? platformRoster
            .filter(p => visible.has(p.id) && p.venueId !== null)
            .map(p => ({
              id: p.id,
              name: p.displayName,
              avatarVariant: 0, // dead field for platform agents — identity drives appearance (D-25)
              spriteSeed: p.spriteSeed,
              location: p.venueId as string,
              ...(p.activity !== undefined ? { activity: p.activity } : {}),
            }))
        : agentsRef.current
            .filter(a => visible.has(a.id))
            .map(a => ({
              id: a.id,
              name: a.name,
              avatarVariant: a.avatarVariant,
              location: a.location,
            }));
      scene.syncAgents(list);
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

import { create } from 'zustand';
import type { Agent, AgentStatus, CreateAgentDto } from '@botville/shared';
import { apiFetch } from '../lib/api.js';
import { DISTRICT_SCENE_KEY } from '../game/venueRegistry.js';

// The session is anonymous: httpOnly av_session cookie plus a signed token in
// localStorage for cross-site (TZ-12, see lib/api.ts). The client neither knows
// nor constructs the userId — it only carries the signed value issued by the server.

// ── Agent Store ───────────────────────────────────────────────────────────────
interface AgentStore {
  agents: Agent[];
  loading: boolean;
  error: string | null;
  fetchAgents: () => Promise<void>;
  /** Creation outcome: success with an id, or failure flagged as "network"
   *  (server unreachable/timeout) vs "server" (validation/response error) —
   *  the modal shows different human-readable text for each. */
  createAgent: (dto: CreateAgentDto) => Promise<{ ok: true; id: string } | { ok: false; network: boolean }>;
  deleteAgent: (agentId: string) => Promise<void>;
  updateAgentStatus: (agentId: string, status: AgentStatus) => void;
  /** TZ-16: merges fresh locations from polling without touching runtime statuses.
   *  F-3: a venue id, not a member of a closed vocabulary — PresenceModel (over the
   *  venue registry), not this store, decides what "known" means (see game/presence.ts). */
  applyLocations: (locations: Array<{ id: string; location: string }>) => void;
  /** Saves the key; returns the health-check verdict: true/false, null — the check could not be performed */
  setApiKey: (agentId: string, apiKey: string) => Promise<boolean | null>;
  /** Deletes the agent's saved key (TZ-04): the agent requires a key again / falls back to demo. */
  deleteApiKey: (agentId: string) => Promise<void>;
}

export const useAgentStore = create<AgentStore>((set, get) => ({
  agents: [],
  loading: false,
  error: null,

  fetchAgents: async () => {
    set({ loading: true, error: null });
    try {
      const res = await apiFetch('/api/agents');
      const json = await res.json();
      if (json.error) throw new Error(json.error.message);
      const agents: Agent[] = (json.data ?? []).map((r: Record<string, unknown>) => ({
        id: r.id as string,
        userId: r.user_id as string,
        slotIndex: r.slot_index as number,
        name: r.name as string,
        avatarVariant: (r.avatar_variant as number) ?? 0,
        systemPrompt: (r.system_prompt as string) ?? '',
        providerType: r.provider_type as Agent['providerType'],
        modelId: r.model_id as string,
        ollamaBaseUrl: r.ollama_base_url as string | undefined,
        customBaseUrl: r.custom_base_url as string | undefined,
        createdAt: r.created_at as number,
        hasKey: Number(r.has_key ?? 0) > 0,
        // TZ-16: the agent's whereabouts are the server's truth. F-3: kept RAW —
        // no clamp to a closed vocabulary. PresenceModel decides somewhere/absent/
        // unknown downstream (game/presence.ts); this store must not pre-judge it.
        location: r.location as Agent['location'],
        // runtime defaults
        status: 'idle' as AgentStatus,
        position: { locationId: 'district' as const, x: 0, y: 0 },
        currentTaskId: null,
        lastActiveAt: Date.now(),
        isOnline: true,
      }));
      set({ agents, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  createAgent: async (dto) => {
    try {
      const res = await apiFetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dto),
      }, { timeoutMs: 12_000 });
      const json = await res.json();
      if (json.error) throw new Error(json.error.message);
      await get().fetchAgents();
      set({ error: null });
      return { ok: true, id: json.data.id as string };
    } catch (e) {
      // Network: fetch never reached the server (TypeError) or the timeout fired
      // (AbortError). A server response with json.error is NOT a network failure.
      const network = e instanceof TypeError
        || (e instanceof DOMException && e.name === 'AbortError');
      set({ error: String(e) });
      return { ok: false, network };
    }
  },

  deleteAgent: async (agentId) => {
    await apiFetch(`/api/agents/${agentId}`, { method: 'DELETE' });
    set(s => ({ agents: s.agents.filter(a => a.id !== agentId) }));
  },

  updateAgentStatus: (agentId, status) => {
    set(s => ({ agents: s.agents.map(a => a.id === agentId ? { ...a, status } : a) }));
  },

  applyLocations: (locations) => {
    set(s => {
      const byId = new Map(locations.map(l => [l.id, l.location]));
      let changed = false;
      const agents = s.agents.map(a => {
        const loc = byId.get(a.id);
        if (loc !== undefined && loc !== a.location) {
          changed = true;
          return { ...a, location: loc as Agent['location'] };
        }
        return a;
      });
      // no changes — keep the same reference to avoid pointless scene resyncs
      return changed ? { agents } : {};
    });
  },

  setApiKey: async (agentId, apiKey) => {
    try {
      const res = await apiFetch(`/api/agents/${agentId}/key`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey }),
      });
      const json = await res.json();
      set(s => ({ agents: s.agents.map(a => a.id === agentId ? { ...a, hasKey: true } : a) }));
      return json?.data?.valid ?? null;
    } catch {
      return null;
    }
  },

  deleteApiKey: async (agentId) => {
    await apiFetch(`/api/agents/${agentId}/key`, { method: 'DELETE' });
    set(s => ({ agents: s.agents.map(a => a.id === agentId ? { ...a, hasKey: false } : a) }));
  },
}));

// ── UI Store ──────────────────────────────────────────────────────────────────
interface UIStore {
  selectedAgentId: string | null;
  chatOpen: boolean;
  profileOpen: boolean;
  currentScene: string;
  meetingOpen: boolean;
  openProfile: (agentId: string) => void;
  closeProfile: () => void;
  openChat: (agentId: string) => void;
  closeChat: () => void;
  openMeeting: () => void;
  closeMeeting: () => void;
  setScene: (scene: string) => void;
}

export const useUIStore = create<UIStore>((set) => ({
  selectedAgentId: null,
  chatOpen: false,
  profileOpen: false,
  currentScene: DISTRICT_SCENE_KEY,
  meetingOpen: false,
  openProfile: (agentId) => set({ selectedAgentId: agentId, profileOpen: true, chatOpen: false }),
  closeProfile: () => set({ profileOpen: false, selectedAgentId: null }),
  openChat: (agentId) => set({ selectedAgentId: agentId, chatOpen: true, profileOpen: false }),
  closeChat: () => set({ chatOpen: false }),
  openMeeting: () => set({ meetingOpen: true }),
  closeMeeting: () => set({ meetingOpen: false }),
  setScene: (scene) => set({ currentScene: scene }),
}));

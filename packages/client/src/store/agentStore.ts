import { create } from 'zustand';
import type { Agent, AgentLocation, AgentStatus, CreateAgentDto } from '@botville/shared';
import { AGENT_LOCATIONS } from '@botville/shared';
import { apiFetch } from '../lib/api.js';

// Сессия — анонимная: httpOnly-cookie av_session плюс подписанный токен в
// localStorage для cross-site (ТЗ-12, см. lib/api.ts). Клиент не знает и не
// конструирует userId — только возит выданное сервером подписанное значение.

function normalizeLocation(value: unknown): AgentLocation {
  return AGENT_LOCATIONS.includes(value as AgentLocation) ? (value as AgentLocation) : 'district';
}

// ── Agent Store ───────────────────────────────────────────────────────────────
interface AgentStore {
  agents: Agent[];
  loading: boolean;
  error: string | null;
  fetchAgents: () => Promise<void>;
  /** Итог создания: успех с id, либо провал с признаком «сеть» (сервер
   *  недостижим/таймаут) vs «сервер» (валидация/ошибка ответа) — модалка
   *  показывает разный человеческий текст. */
  createAgent: (dto: CreateAgentDto) => Promise<{ ok: true; id: string } | { ok: false; network: boolean }>;
  deleteAgent: (agentId: string) => Promise<void>;
  updateAgentStatus: (agentId: string, status: AgentStatus) => void;
  /** ТЗ-16: вливает свежие location из поллинга, не трогая runtime-статусы. */
  applyLocations: (locations: Array<{ id: string; location: AgentLocation }>) => void;
  /** Сохраняет ключ; возвращает вердикт health-check: true/false, null — проверить не удалось */
  setApiKey: (agentId: string, apiKey: string) => Promise<boolean | null>;
  /** Удаляет сохранённый ключ агента (ТЗ-04): агент снова требует ключ / уходит в demo. */
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
        // ТЗ-16: где агент — правда сервера; незнакомое значение не роняет UI
        location: normalizeLocation(r.location),
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
      // Сеть: fetch не дошёл до сервера (TypeError) или сработал таймаут
      // (AbortError). Ответ сервера с json.error — это НЕ сеть.
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
      const byId = new Map(locations.map(l => [l.id, normalizeLocation(l.location)]));
      let changed = false;
      const agents = s.agents.map(a => {
        const loc = byId.get(a.id);
        if (loc && loc !== a.location) { changed = true; return { ...a, location: loc }; }
        return a;
      });
      // без изменений — не трогаем ссылку, чтобы не гонять ресинк сцен впустую
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
  currentScene: 'DistrictScene',
  meetingOpen: false,
  openProfile: (agentId) => set({ selectedAgentId: agentId, profileOpen: true, chatOpen: false }),
  closeProfile: () => set({ profileOpen: false, selectedAgentId: null }),
  openChat: (agentId) => set({ selectedAgentId: agentId, chatOpen: true, profileOpen: false }),
  closeChat: () => set({ chatOpen: false }),
  openMeeting: () => set({ meetingOpen: true }),
  closeMeeting: () => set({ meetingOpen: false }),
  setScene: (scene) => set({ currentScene: scene }),
}));

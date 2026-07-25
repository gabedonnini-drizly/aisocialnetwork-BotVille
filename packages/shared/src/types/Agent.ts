import type { LLMProviderType } from './LLMProvider';

export type AgentStatus =
  | 'idle'
  | 'wander'
  | 'rest'
  | 'chat_npc'
  | 'work'
  | 'task_running'
  | 'task_done';

export type LocationId = 'office' | 'cafe' | 'dorm' | 'street' | 'district';

// ── ТЗ-16: грубое местоположение агента — правда на СЕРВЕРЕ ──────────────────
// 'district' — на улице, 'farm' — у фермы/в загоне (рисуется в сцене района).
// Точная координата внутри локации — косметика клиента.
export const AGENT_LOCATIONS = ['district', 'office', 'cafe', 'library', 'dorm', 'farm'] as const;
export type AgentLocation = (typeof AGENT_LOCATIONS)[number];

/**
 * Зеркало клиентского assetManifest (AVATAR_VARIANTS): всего 16 обликов,
 * 0..11 — люди, 12..15 — животные. Сервер решает «дорм или загон» по этому
 * признаку, не зная о спрайтах. Менять СИНХРОННО с assetManifest.ts.
 */
export const AVATAR_VARIANT_COUNT = 16;
export const ANIMAL_VARIANT_MIN = 12;

export function isAnimalVariant(avatarVariant: number): boolean {
  const norm = ((avatarVariant % AVATAR_VARIANT_COUNT) + AVATAR_VARIANT_COUNT) % AVATAR_VARIANT_COUNT;
  return norm >= ANIMAL_VARIANT_MIN;
}

export interface AgentPosition {
  locationId: LocationId;
  x: number;
  y: number;
}

export interface AgentConfig {
  id: string;
  userId: string;
  slotIndex: number;
  name: string;
  avatarVariant: number;
  systemPrompt: string;
  providerType: LLMProviderType;
  modelId: string;
  ollamaBaseUrl?: string;
  /** ТЗ-14: базовый URL для провайдера 'custom' (OpenAI-совместимый endpoint). */
  customBaseUrl?: string;
  createdAt: number;
  /** Задан ли у агента ЛИЧНЫЙ сохранённый API-ключ (сам ключ клиенту не отдаётся). */
  hasKey?: boolean;
  /** ТЗ-16: где агент находится. Владеет сервер, переживает перезагрузку. */
  location: AgentLocation;
}

export interface AgentRuntimeState {
  id: string;
  status: AgentStatus;
  position: AgentPosition;
  currentTaskId: string | null;
  lastActiveAt: number;
  isOnline: boolean;
}

export type Agent = AgentConfig & AgentRuntimeState;

export interface CreateAgentDto {
  name: string;
  avatarVariant: number;
  systemPrompt: string;
  providerType: LLMProviderType;
  modelId: string;
  ollamaBaseUrl?: string;
  customBaseUrl?: string;
}

export interface UpdateAgentDto {
  name?: string;
  systemPrompt?: string;
  providerType?: LLMProviderType;
  modelId?: string;
  ollamaBaseUrl?: string;
  customBaseUrl?: string;
}

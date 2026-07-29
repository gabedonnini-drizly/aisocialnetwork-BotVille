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

// ── TZ-16: an agent's coarse location — the truth lives on the SERVER ────────
// 'district' — out on the street, 'farm' — at the farm/in the pen (drawn in the
// district scene). The exact coordinate within a location is client cosmetics.
export const AGENT_LOCATIONS = ['district', 'office', 'cafe', 'library', 'dorm', 'farm'] as const;
export type AgentLocation = (typeof AGENT_LOCATIONS)[number];

/**
 * Mirror of the client-side assetManifest (AVATAR_VARIANTS): 16 appearances in
 * total, 0..11 — humans, 12..15 — animals. The server decides "dorm or pen" by
 * this flag without knowing anything about sprites. Change IN SYNC with
 * assetManifest.ts.
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
  /** TZ-14: base URL for the 'custom' provider (an OpenAI-compatible endpoint). */
  customBaseUrl?: string;
  createdAt: number;
  /** Whether the agent has a PERSONAL saved API key (the key itself is never sent to the client). */
  hasKey?: boolean;
  /** TZ-16: where the agent is. Owned by the server, survives a restart. */
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

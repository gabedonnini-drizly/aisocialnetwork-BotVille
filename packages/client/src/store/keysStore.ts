import { create } from 'zustand';
import type { LLMProviderType, UserKeyStatus } from '@botville/shared';
import { fetchUserKeys, saveUserKey, deleteUserKey } from '../lib/api.js';

// TZ-14: keys live at the user level, not the agent level — enter them once and
// every new agent picks them up automatically. The client never sees the key
// itself: only the mask.

interface KeysStore {
  keys: UserKeyStatus[];
  loaded: boolean;
  fetchKeys: () => Promise<void>;
  /** @returns health-check verdict (true/false/null) or a save error code */
  saveKey: (
    provider: LLMProviderType,
    apiKey: string,
    baseUrl?: string,
  ) => Promise<{ ok: boolean; valid: boolean | null; errorCode?: string }>;
  removeKey: (provider: LLMProviderType) => Promise<void>;
  /** Status of the saved key for a provider (undefined — not configured). */
  keyFor: (provider: LLMProviderType) => UserKeyStatus | undefined;
}

export const useKeysStore = create<KeysStore>((set, get) => ({
  keys: [],
  loaded: false,

  fetchKeys: async () => {
    const keys = await fetchUserKeys();
    set({ keys, loaded: true });
  },

  saveKey: async (provider, apiKey, baseUrl) => {
    const res = await saveUserKey(provider, apiKey, baseUrl);
    if (res.ok) await get().fetchKeys();
    return res;
  },

  removeKey: async (provider) => {
    await deleteUserKey(provider);
    set(s => ({ keys: s.keys.filter(k => k.provider !== provider) }));
  },

  keyFor: (provider) => get().keys.find(k => k.provider === provider),
}));

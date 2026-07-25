import { create } from 'zustand';
import type { LLMProviderType, UserKeyStatus } from '@botville/shared';
import { fetchUserKeys, saveUserKey, deleteUserKey } from '../lib/api.js';

// ТЗ-14: ключи живут на уровне юзера, а не агента — ввёл один раз, дальше все
// новые агенты берут их сами. Клиент никогда не видит сам ключ: только маску.

interface KeysStore {
  keys: UserKeyStatus[];
  loaded: boolean;
  fetchKeys: () => Promise<void>;
  /** @returns вердикт health-check (true/false/null) либо код ошибки сохранения */
  saveKey: (
    provider: LLMProviderType,
    apiKey: string,
    baseUrl?: string,
  ) => Promise<{ ok: boolean; valid: boolean | null; errorCode?: string }>;
  removeKey: (provider: LLMProviderType) => Promise<void>;
  /** Статус сохранённого ключа для провайдера (undefined — не настроен). */
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

// TZ-07: EN/RU language state. Default — en; ru — for Russian-language browsers;
// an explicit user choice survives reload via localStorage (av_locale).

import { useCallback } from 'react';
import { create } from 'zustand';
import { en } from './en.js';
import { ru } from './ru.js';

export type Locale = 'en' | 'ru';
export type TKey = keyof typeof en;
export type TParams = Record<string, string | number>;
export type TFunc = (key: TKey, params?: TParams) => string;

const DICTS: Record<Locale, Record<TKey, string>> = { en, ru };
const STORAGE_KEY = 'av_locale';

function detectLocale(): Locale {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'en' || saved === 'ru') return saved;
  } catch { /* localStorage unavailable (private mode) — not critical */ }
  return navigator.language?.toLowerCase().startsWith('ru') ? 'ru' : 'en';
}

function format(template: string, params?: TParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (m, k) => (k in params ? String(params[k]) : m));
}

// <html lang> and <title> follow the locale (static index.html is the EN fallback for crawlers)
function applyToDocument(locale: Locale) {
  document.documentElement.lang = locale;
  document.title = DICTS[locale]['meta.title'];
}

interface LocaleStore {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

export const useLocaleStore = create<LocaleStore>((set) => ({
  locale: detectLocale(),
  setLocale: (locale) => {
    try { localStorage.setItem(STORAGE_KEY, locale); } catch {}
    applyToDocument(locale);
    set({ locale });
  },
}));

applyToDocument(useLocaleStore.getState().locale);

/** Translation hook: const t = useT(); t('chat.retry'); t('chat.demoRemaining', { n: 5 }). */
export function useT(): TFunc {
  const locale = useLocaleStore((s) => s.locale);
  return useCallback<TFunc>((key, params) => format(DICTS[locale][key], params), [locale]);
}

/** Non-reactive translation — for code outside React (Phaser scenes). */
export function tr(key: TKey, params?: TParams): string {
  return format(DICTS[useLocaleStore.getState().locale][key], params);
}

/** Agent status → dictionary key (shared by the HUD and the profile). */
export const STATUS_KEYS: Record<string, TKey> = {
  idle: 'status.idle',
  wander: 'status.wander',
  rest: 'status.rest',
  work: 'status.work',
  task_running: 'status.task_running',
  task_done: 'status.task_done',
  chat_npc: 'status.chat_npc',
};

/** Agent location → dictionary key (TZ-16; the nighttime dorm has its own key). */
export const LOCATION_KEYS: Record<string, TKey> = {
  district: 'loc.district',
  office: 'loc.office',
  cafe: 'loc.cafe',
  library: 'loc.library',
  dorm: 'loc.dorm',
  farm: 'loc.farm',
};

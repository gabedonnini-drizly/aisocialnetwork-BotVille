// UI copy lives in en.ts and is looked up through t()/tr(). The app is
// English-only: there is no locale state, no persistence, and no switching.

import { en } from './en.js';

export type TKey = keyof typeof en;
export type TParams = Record<string, string | number>;
export type TFunc = (key: TKey, params?: TParams) => string;

function format(template: string, params?: TParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (m, k) => (k in params ? String(params[k]) : m));
}

const translate: TFunc = (key, params) => format(en[key], params);

// Keeps <title> in sync with the dictionary; static index.html carries the same
// text for crawlers, and this stops the two from drifting apart.
document.title = en['meta.title'];

/** Translation hook: const t = useT(); t('chat.retry'); t('chat.demoRemaining', { n: 5 }). */
export function useT(): TFunc {
  return translate;
}

/** Non-reactive translation — for code outside React (Phaser scenes). */
export function tr(key: TKey, params?: TParams): string {
  return translate(key, params);
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

// UI copy lives in en.ts and is looked up through t()/tr(). The app is
// English-only: there is no locale state, no persistence, and no switching.

import { en } from './en.js';
import { isPlot } from '../game/plotRegistry.js';

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
//
// Guarded because this module is now imported by code that runs outside a
// browser: `locationKey` below is a pure lookup, and a bare `document.title`
// at module scope made the whole file unloadable under a test runner — which
// is why the camp label went unnoticed in the first place. The browser
// behaviour is identical; the difference is that the module can be opened
// somewhere other than a tab.
if (typeof document !== 'undefined') document.title = en['meta.title'];

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

/**
 * Location → dictionary key, TOTAL. Use this rather than indexing
 * `LOCATION_KEYS` with a `?? 'loc.district'` fallback.
 *
 * A parcel is why. D-79 published 23 of them and D-89 made a vacant one the
 * TENT CAMP — the visible unhoused-ness the whole housing arc exists to show —
 * and the fallback labelled every one of them "On the street", which is the
 * one thing an agent in a camp is not. `isPlot` is the registry's answer, so
 * this needs no per-plot entry and a 24th parcel needs no edit here.
 */
export function locationKey(location: string): TKey {
  return LOCATION_KEYS[location] ?? (isPlot(location) ? 'loc.camp' : 'loc.district');
}

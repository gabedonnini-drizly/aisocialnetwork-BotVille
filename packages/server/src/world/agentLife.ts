import { getDb } from '../db/schema.js';
import { gameHour, MS_PER_GAME_HOUR } from './clock.js';
import { isAnimalVariant, type AgentLocation } from '@botville/shared';

/**
 * TZ-16: agents' own life — a server tick moves them between locations based on
 * schedule and status, WITHOUT a single call to an LLM. The server owns only the
 * answer to "which location is the agent in" (agents.location in the DB); how an
 * agent looks and walks within a location is client-side cosmetics.
 *
 * World addendum II.2 (2026-07-29): this module is the FIXTURE-MODE world
 * generator. In integrated mode (client built with VITE_PLATFORM_LOCATIONS_URL)
 * the platform api computes presence and the client never reads this server's
 * locations — but nothing here changes for that: fixture mode must stay fully
 * self-contained and is the default whenever the env var is absent.
 *
 * Rules (all knobs live in LIFE_RULES, tune by feel):
 * - busy (recent chat/meeting) — stays where it is;
 * - night (22–7): humans go to the dorm, animals to the farm pen; wake-up at a
 *   personal hour between 7–9;
 * - day: a move every 2–4 game hours (= 2–4 real minutes) to a random location
 *   from the pool — with slight randomness so the town doesn't feel mechanical.
 */
export const LIFE_RULES = {
  /** Server tick period, ms (decisions still happen only every 2–4 game hours). */
  tickMs: 10_000,
  /** Night: mirror of the client-side NIGHT_SCHEDULE (sleepStart/wakeStart/wakeEnd). */
  sleepStart: 22,
  wakeStart: 7,
  wakeEnd: 9,
  /** Interval between daytime moves, in game hours (min..max). */
  moveMinHours: 2,
  moveMaxHours: 4,
  /** How long an agent counts as "busy" after a chat/meeting message, ms. */
  busyTtlMs: 120_000,
  /** Daytime location pools; 'district' twice — the street is slightly more likely. */
  humanDay: ['district', 'district', 'office', 'cafe', 'library', 'farm'] as AgentLocation[],
  animalDay: ['district', 'farm'] as AgentLocation[],
} as const;

// ── In-memory tick state (does not need to survive a restart: a restart simply
// rolls out the schedule anew; the source-of-truth location lives in the DB) ──
const busyUntil = new Map<string, number>();
const nextMoveAt = new Map<string, number>();
const wakeHourOf = new Map<string, number>();

/** Called by chat/meeting on every message: busy agents don't go anywhere. */
export function markAgentBusy(agentId: string, ttlMs: number = LIFE_RULES.busyTtlMs): void {
  busyUntil.set(agentId, Date.now() + ttlMs);
}

function isBusy(agentId: string, now: number): boolean {
  const until = busyUntil.get(agentId);
  if (until === undefined) return false;
  if (now >= until) {
    busyUntil.delete(agentId);
    return false;
  }
  return true;
}

function rollMoveDelayMs(): number {
  const { moveMinHours, moveMaxHours } = LIFE_RULES;
  return (moveMinHours + Math.random() * (moveMaxHours - moveMinHours)) * MS_PER_GAME_HOUR;
}

function pickNext(pool: readonly AgentLocation[], current: AgentLocation): AgentLocation {
  const options = pool.filter(l => l !== current);
  return options[Math.floor(Math.random() * options.length)] ?? current;
}

interface AgentRow {
  id: string;
  avatar_variant: number;
  location: AgentLocation;
}

/** One tick: walk over all agents and move those whose time has come. */
export function tickAgentLife(now: number = Date.now(), hour: number = gameHour()): void {
  const db = getDb();
  const rows = db.prepare('SELECT id, avatar_variant, location FROM agents').all() as unknown as AgentRow[];

  // clean up state for deleted agents
  const alive = new Set(rows.map(r => r.id));
  for (const map of [busyUntil, nextMoveAt, wakeHourOf]) {
    for (const id of map.keys()) if (!alive.has(id)) map.delete(id);
  }

  const night = hour >= LIFE_RULES.sleepStart || hour < LIFE_RULES.wakeStart;
  const update = db.prepare('UPDATE agents SET location = ? WHERE id = ?');

  for (const row of rows) {
    if (isBusy(row.id, now)) continue; // busy agents neither sleep nor leave

    const animal = isAnimalVariant(row.avatar_variant);
    let desired: AgentLocation = row.location;

    if (night) {
      // existing night behavior: humans to the dorm, animals to the pen
      desired = animal ? 'farm' : 'dorm';
      if (!wakeHourOf.has(row.id)) {
        wakeHourOf.set(row.id,
          LIFE_RULES.wakeStart + Math.random() * (LIFE_RULES.wakeEnd - LIFE_RULES.wakeStart));
      }
      nextMoveAt.delete(row.id); // the daytime schedule rolls out anew in the morning
    } else {
      const wakeAt = wakeHourOf.get(row.id);
      if (wakeAt !== undefined && hour < wakeAt && hour < LIFE_RULES.wakeEnd) {
        continue; // morning, but the personal wake-up hour hasn't come yet — keeps sleeping
      }
      wakeHourOf.delete(row.id);

      if (!animal && row.location === 'dorm') {
        // wake-up (or a daytime server restart): out of the dorm and straight to business
        desired = pickNext(LIFE_RULES.humanDay, row.location);
        nextMoveAt.set(row.id, now + rollMoveDelayMs());
      } else {
        const at = nextMoveAt.get(row.id);
        if (at === undefined) {
          nextMoveAt.set(row.id, now + rollMoveDelayMs());
        } else if (now >= at) {
          desired = pickNext(animal ? LIFE_RULES.animalDay : LIFE_RULES.humanDay, row.location);
          nextMoveAt.set(row.id, now + rollMoveDelayMs());
        }
      }
    }

    if (desired !== row.location) update.run(desired, row.id);
  }
}

let timer: ReturnType<typeof setInterval> | null = null;

export function startAgentLife(): void {
  if (timer) return;
  timer = setInterval(() => {
    try {
      tickAgentLife();
    } catch (e) {
      // a tick must not bring down the server; the next run will try again
      console.error('[agentLife] tick failed:', e);
    }
  }, LIFE_RULES.tickMs);
  timer.unref?.();
}

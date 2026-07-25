import { getDb } from '../db/schema.js';
import { gameHour, MS_PER_GAME_HOUR } from './clock.js';
import { isAnimalVariant, type AgentLocation } from '@botville/shared';

/**
 * ТЗ-16: собственная жизнь агентов — серверный тик двигает их между локациями
 * по расписанию и статусу, БЕЗ единого обращения к LLM. Сервер владеет только
 * ответом «в каком месте агент» (agents.location в БД); как агент выглядит и
 * ходит внутри локации — косметика клиента.
 *
 * Правила (все ручки — в LIFE_RULES, крутить по ощущениям):
 * - занят (недавний чат/собрание) — остаётся на месте;
 * - ночь (22–7): люди в дорм, животные в загон фермы; подъём — в личный час 7–9;
 * - день: переход раз в 2–4 игровых часа (= 2–4 реальные минуты) в случайную
 *   локацию из пула — с лёгкой случайностью, чтобы город не был механическим.
 */
export const LIFE_RULES = {
  /** Период серверного тика, мс (решения всё равно раз в 2–4 игровых часа). */
  tickMs: 10_000,
  /** Ночь: зеркало клиентского NIGHT_SCHEDULE (sleepStart/wakeStart/wakeEnd). */
  sleepStart: 22,
  wakeStart: 7,
  wakeEnd: 9,
  /** Интервал между дневными переходами, игровые часы (мин..макс). */
  moveMinHours: 2,
  moveMaxHours: 4,
  /** Сколько агент считается «занятым» после сообщения чата/собрания, мс. */
  busyTtlMs: 120_000,
  /** Дневные пулы локаций; 'district' дважды — улица чуть вероятнее. */
  humanDay: ['district', 'district', 'office', 'cafe', 'library', 'farm'] as AgentLocation[],
  animalDay: ['district', 'farm'] as AgentLocation[],
} as const;

// ── In-memory состояние тика (переживать рестарт не обязано: перезапуск просто
// заново раскатает расписание, местоположение-правда лежит в БД) ─────────────
const busyUntil = new Map<string, number>();
const nextMoveAt = new Map<string, number>();
const wakeHourOf = new Map<string, number>();

/** Чат/собрание зовут при каждом сообщении: занятые агенты никуда не уходят. */
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

/** Один тик: пройтись по всем агентам и подвинуть тех, кому пора. */
export function tickAgentLife(now: number = Date.now(), hour: number = gameHour()): void {
  const db = getDb();
  const rows = db.prepare('SELECT id, avatar_variant, location FROM agents').all() as unknown as AgentRow[];

  // подчистить состояние удалённых агентов
  const alive = new Set(rows.map(r => r.id));
  for (const map of [busyUntil, nextMoveAt, wakeHourOf]) {
    for (const id of map.keys()) if (!alive.has(id)) map.delete(id);
  }

  const night = hour >= LIFE_RULES.sleepStart || hour < LIFE_RULES.wakeStart;
  const update = db.prepare('UPDATE agents SET location = ? WHERE id = ?');

  for (const row of rows) {
    if (isBusy(row.id, now)) continue; // занятые не спят и не уходят

    const animal = isAnimalVariant(row.avatar_variant);
    let desired: AgentLocation = row.location;

    if (night) {
      // существующее ночное поведение: люди в дорм, животные в загон
      desired = animal ? 'farm' : 'dorm';
      if (!wakeHourOf.has(row.id)) {
        wakeHourOf.set(row.id,
          LIFE_RULES.wakeStart + Math.random() * (LIFE_RULES.wakeEnd - LIFE_RULES.wakeStart));
      }
      nextMoveAt.delete(row.id); // дневное расписание раскатается заново утром
    } else {
      const wakeAt = wakeHourOf.get(row.id);
      if (wakeAt !== undefined && hour < wakeAt && hour < LIFE_RULES.wakeEnd) {
        continue; // утро, но личный час подъёма ещё не настал — спит дальше
      }
      wakeHourOf.delete(row.id);

      if (!animal && row.location === 'dorm') {
        // подъём (или рестарт сервера днём): из дорма сразу по делам
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
      // тик не должен ронять сервер; следующий заход попробует снова
      console.error('[agentLife] tick failed:', e);
    }
  }, LIFE_RULES.tickMs);
  timer.unref?.();
}

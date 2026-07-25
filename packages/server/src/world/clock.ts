/**
 * ТЗ-16: серверные игровые часы — ЕДИНСТВЕННЫЙ источник игрового времени.
 * Клиентский GameTime подстраивается под этот час при загрузке и в поллинге
 * (иначе клиент, стартующий всегда с 10:00, спорил бы с серверным тиком).
 *
 * Час выводится из wall-clock детерминированно, поэтому переживает рестарты
 * сервера без какого-либо состояния в БД.
 */

/** Зеркало клиентского TIME.msPerGameHour: 1 реальная минута = 1 игровой час. */
export const MS_PER_GAME_HOUR = 60_000;

/** Debug-override (dev-эндпоинт приёмки): часы продолжают идти от заданного часа. */
let overrideBase: { hour: number; atMs: number } | null = null;

/** Текущий игровой час, 0 <= h < 24 (float). */
export function gameHour(): number {
  if (overrideBase) {
    return (overrideBase.hour + (Date.now() - overrideBase.atMs) / MS_PER_GAME_HOUR) % 24;
  }
  return (Date.now() / MS_PER_GAME_HOUR) % 24;
}

/** Перевести часы мира (только dev/приёмка; в памяти, до рестарта). */
export function setGameHour(h: number): void {
  overrideBase = { hour: ((h % 24) + 24) % 24, atMs: Date.now() };
}

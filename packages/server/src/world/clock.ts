/**
 * TZ-16: the server game clock — the SINGLE source of game time. The client-side
 * GameTime adjusts to this hour on load and during polling (otherwise the
 * client, which always starts at 10:00, would disagree with the server tick).
 *
 * The hour is derived from the wall clock deterministically, so it survives
 * server restarts without any state in the DB.
 */

/** Mirror of the client-side TIME.msPerGameHour: 1 real minute = 1 game hour. */
export const MS_PER_GAME_HOUR = 60_000;

/** Debug override (dev acceptance endpoint): the clock keeps running from the given hour. */
let overrideBase: { hour: number; atMs: number } | null = null;

/** Current game hour, 0 <= h < 24 (float). */
export function gameHour(): number {
  if (overrideBase) {
    return (overrideBase.hour + (Date.now() - overrideBase.atMs) / MS_PER_GAME_HOUR) % 24;
  }
  return (Date.now() / MS_PER_GAME_HOUR) % 24;
}

/** Set the world clock (dev/acceptance only; in memory, until restart). */
export function setGameHour(h: number): void {
  overrideBase = { hour: ((h % 24) + 24) % 24, atMs: Date.now() };
}

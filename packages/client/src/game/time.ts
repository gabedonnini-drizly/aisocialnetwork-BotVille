import { TIME } from './config.js';

/**
 * Game clock: continuous time of day 0-24 (float), derived from
 * real time (TIME.msPerGameHour), so lerps over it are smooth
 * on every frame without a separate ticker.
 */
class GameTimeImpl {
  private startReal = performance.now();
  private baseHour: number = TIME.startHour;
  /** The clock was set manually (__setGameHour) — auto-sync with the server is off. */
  private manual = false;

  /** Current game hour, 0 <= h < 24. */
  get hour(): number {
    const elapsed = (performance.now() - this.startReal) / TIME.msPerGameHour;
    return (this.baseHour + elapsed) % 24;
  }

  /** Set the clock (debugging, acceptance screenshots). */
  set(h: number) {
    this.manual = true;
    this.baseHour = ((h % 24) + 24) % 24;
    this.startReal = performance.now();
  }

  /**
   * TZ-16: align with the server hour (the truth about time lives on the server,
   * otherwise the client's 10:00 after a reload would contradict the server tick,
   * which has already sent the agents to bed). Small drift is left alone so the
   * tint/glow don't jitter.
   */
  syncFrom(serverHour: number) {
    if (this.manual) return;
    const raw = Math.abs(this.hour - serverHour);
    const drift = Math.min(raw, 24 - raw);
    if (drift < 0.1) return;
    this.baseHour = ((serverHour % 24) + 24) % 24;
    this.startReal = performance.now();
  }
}

export const GameTime = new GameTimeImpl();

// Debug hook: __setGameHour(19.5) in devtools/acceptance scripts.
// In dev it also sets the SERVER clock (otherwise the server-side agent life tick
// would keep running on its own time — TZ-16).
declare global {
  interface Window { __setGameHour?: (h: number) => void }
}
if (typeof window !== 'undefined') {
  window.__setGameHour = (h: number) => {
    GameTime.set(h);
    if (import.meta.env.DEV) {
      void import('../lib/api.js').then(({ apiFetch }) =>
        apiFetch('/api/debug/game-hour', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ hour: h }),
        }),
      ).catch(() => { /* server without the dev endpoint — client clock only */ });
    }
  };
}

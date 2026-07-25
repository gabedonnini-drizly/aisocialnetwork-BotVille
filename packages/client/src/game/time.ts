import { TIME } from './config.js';

/**
 * Игровые часы: непрерывное время суток 0-24 (float), считается от
 * реального времени (TIME.msPerGameHour), поэтому лерпы по нему плавные
 * на каждом кадре без отдельного тикера.
 */
class GameTimeImpl {
  private startReal = performance.now();
  private baseHour: number = TIME.startHour;
  /** Часы переведены вручную (__setGameHour) — авто-синк с сервером выключен. */
  private manual = false;

  /** Текущий игровой час, 0 <= h < 24. */
  get hour(): number {
    const elapsed = (performance.now() - this.startReal) / TIME.msPerGameHour;
    return (this.baseHour + elapsed) % 24;
  }

  /** Перевести часы (отладка, скриншоты приёмки). */
  set(h: number) {
    this.manual = true;
    this.baseHour = ((h % 24) + 24) % 24;
    this.startReal = performance.now();
  }

  /**
   * ТЗ-16: подстройка под серверный час (правда о времени — на сервере,
   * иначе клиентские 10:00 после перезагрузки спорили бы с серверным тиком,
   * который уже увёл агентов спать). Мелкий дрейф не трогаем, чтобы
   * тонировка/глоу не дёргались.
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

// Отладочный хук: __setGameHour(19.5) в devtools/скриптах приёмки.
// В dev дополнительно переводит и СЕРВЕРНЫЕ часы (иначе серверный тик жизни
// агентов продолжил бы жить по своему времени — ТЗ-16).
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
      ).catch(() => { /* сервер без dev-эндпоинта — только клиентские часы */ });
    }
  };
}

import Phaser from 'phaser';
import { DAY_TINT_KEYS, NIGHT_LIGHT, NIGHT_SCHEDULE } from './config.js';

/** Agents' sleep window: sleepStart..wakeStart across midnight. */
export function isSleepTime(hour: number): boolean {
  return hour >= NIGHT_SCHEDULE.sleepStart || hour < NIGHT_SCHEDULE.wakeStart;
}

/**
 * District tint by time of day: linear lerp of color and alpha between
 * the DAY_TINT_KEYS key points, wrapping around midnight.
 */
/**
 * Night light intensity 0..1: 0 by day, 1 at night (NIGHT_LIGHT.start..end),
 * with a linear fade over fadeHours when switching on and off.
 */
export function nightIntensity(hour: number): number {
  const { start, end, fadeHours } = NIGHT_LIGHT;
  const h = hour >= start ? hour : hour + 24; // night without a wraparound: start..end+24
  const endH = end + 24;
  if (h < start || h >= endH) return 0;
  const rise = (h - start) / fadeHours;
  const fall = (endH - h) / fadeHours;
  return Math.max(0, Math.min(1, rise, fall));
}

export function tintAt(hour: number): { color: number; alpha: number } {
  const keys = DAY_TINT_KEYS;
  // find the pair of adjacent keys [prev, next] whose interval contains hour
  let prev = keys[keys.length - 1];
  let next = keys[0];
  for (let i = 0; i < keys.length; i++) {
    if (hour < keys[i].h) {
      next = keys[i];
      prev = keys[(i + keys.length - 1) % keys.length];
      break;
    }
    if (i === keys.length - 1) {
      // past the last key — the interval up to the first key of the next day
      prev = keys[i];
      next = keys[0];
    }
  }
  const span = (next.h - prev.h + 24) % 24 || 24;
  const t = ((hour - prev.h + 24) % 24) / span;

  const a = Phaser.Display.Color.IntegerToColor(prev.color);
  const b = Phaser.Display.Color.IntegerToColor(next.color);
  const c = Phaser.Display.Color.Interpolate.ColorWithColor(a, b, 1, t);
  return {
    color: Phaser.Display.Color.GetColor(c.r, c.g, c.b),
    alpha: prev.alpha + (next.alpha - prev.alpha) * t,
  };
}

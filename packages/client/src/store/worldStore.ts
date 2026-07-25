import { create } from 'zustand';
import { TIME } from '../game/config.js';

/**
 * Состояние игрового мира для React-слоя. Источник времени — GameTime
 * в Phaser, сюда прилетает через GameBridge 'time:changed' (useGameEvents).
 */
interface WorldStore {
  /** Время суток 0-24 (float). */
  timeOfDay: number;
  setTimeOfDay: (hour: number) => void;
}

export const useWorldStore = create<WorldStore>((set) => ({
  timeOfDay: TIME.startHour,
  setTimeOfDay: (hour) => set({ timeOfDay: hour }),
}));

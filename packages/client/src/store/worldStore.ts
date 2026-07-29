import { create } from 'zustand';
import { TIME } from '../game/config.js';

/**
 * Game world state for the React layer. The time source is GameTime in
 * Phaser; it arrives here via GameBridge 'time:changed' (useGameEvents).
 */
interface WorldStore {
  /** Time of day 0-24 (float). */
  timeOfDay: number;
  setTimeOfDay: (hour: number) => void;
}

export const useWorldStore = create<WorldStore>((set) => ({
  timeOfDay: TIME.startHour,
  setTimeOfDay: (hour) => set({ timeOfDay: hour }),
}));

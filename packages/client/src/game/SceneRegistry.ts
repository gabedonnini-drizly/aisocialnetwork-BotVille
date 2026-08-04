import Phaser from 'phaser';
import type { DistrictScene } from './scenes/DistrictScene.js';
import { DISTRICT_SCENE_KEY } from './venueRegistry.js';

/** References to the live scenes, so React/the store can call their methods. */
class SceneRegistry {
  private scenes: Map<string, Phaser.Scene> = new Map();

  register(key: string, scene: Phaser.Scene) { this.scenes.set(key, scene); }
  unregister(key: string) { this.scenes.delete(key); }
  get<T extends Phaser.Scene>(key: string): T | undefined { return this.scenes.get(key) as T | undefined; }
  /** The live outdoor scene, whichever district it is currently drawing. */
  getDistrict(): DistrictScene | undefined { return this.get<DistrictScene>(DISTRICT_SCENE_KEY); }
}

export const sceneRegistry = new SceneRegistry();

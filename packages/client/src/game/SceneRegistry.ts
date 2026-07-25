import type { DistrictScene } from './scenes/DistrictScene.js';

// Holds reference to active scenes so React/store can call methods on them
class SceneRegistry {
  private scenes: Map<string, Phaser.Scene> = new Map();

  register(key: string, scene: Phaser.Scene) {
    this.scenes.set(key, scene);
  }

  unregister(key: string) {
    this.scenes.delete(key);
  }

  get<T extends Phaser.Scene>(key: string): T | undefined {
    return this.scenes.get(key) as T | undefined;
  }

  getDistrict(): DistrictScene | undefined {
    return this.get<DistrictScene>('DistrictScene');
  }
}

// import Phaser type globally
import Phaser from 'phaser';
export const sceneRegistry = new SceneRegistry();

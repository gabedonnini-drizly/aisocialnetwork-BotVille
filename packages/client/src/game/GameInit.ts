import Phaser from 'phaser';
import { GameBridge } from './GameBridge.js';
import { GameTime } from './time.js';
import './navigation.js'; // TZ-16: agent:goto — jump to an agent from the HUD
import { PreloaderScene } from './scenes/PreloaderScene.js';
import { DistrictScene } from './scenes/DistrictScene.js';
import { OfficeScene } from './scenes/OfficeScene.js';
import { CafeScene } from './scenes/CafeScene.js';
import { DormScene } from './scenes/DormScene.js';
import { LibraryScene } from './scenes/LibraryScene.js';

let game: Phaser.Game | null = null;

export function initGame(): Phaser.Game {
  if (game) return game;

  game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game-container',
    backgroundColor: '#1a1915',
    pixelArt: true,
    roundPixels: true,
    // mouse + 2 touch pointers: pinch zoom (cameraControls, TZ-09)
    input: { activePointers: 3 },
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [PreloaderScene, DistrictScene, OfficeScene, CafeScene, DormScene, LibraryScene],
  });

  // Game clock -> React (HUD): once per real second (= one game minute)
  let clockAcc = 0;
  game.events.on(Phaser.Core.Events.STEP, (_t: number, dms: number) => {
    clockAcc += dms;
    if (clockAcc >= 1000) {
      clockAcc = 0;
      GameBridge.emit('time:changed', { hour: GameTime.hour });
    }
  });

  // For debugging in devtools
  (window as unknown as { __game?: Phaser.Game }).__game = game;

  return game;
}

export function getGame(): Phaser.Game | null {
  return game;
}

export function destroyGame(): void {
  game?.destroy(true);
  game = null;
}

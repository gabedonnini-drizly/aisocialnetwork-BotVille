import Phaser from 'phaser';
import { GameBridge } from './GameBridge.js';
import { GameTime } from './time.js';
import './navigation.js'; // ТЗ-16: agent:goto — переход к агенту из HUD
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
    // мышь + 2 touch-указателя: pinch-зум (cameraControls, ТЗ-09)
    input: { activePointers: 3 },
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [PreloaderScene, DistrictScene, OfficeScene, CafeScene, DormScene, LibraryScene],
  });

  // Игровые часы -> React (HUD): раз в реальную секунду (= игровая минута)
  let clockAcc = 0;
  game.events.on(Phaser.Core.Events.STEP, (_t: number, dms: number) => {
    clockAcc += dms;
    if (clockAcc >= 1000) {
      clockAcc = 0;
      GameBridge.emit('time:changed', { hour: GameTime.hour });
    }
  });

  // Для отладки в devtools
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

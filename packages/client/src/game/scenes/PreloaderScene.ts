import Phaser from 'phaser';
import { DISTRICT, DISTRICT_IMAGES, INTERIORS, INTERIOR_IMAGES, INTERIOR_TILESET } from '../config.js';
import { UI, UI_HEX } from '../palette.js';
import { tr } from '../../i18n/index.js';
import {
  ANIMATED_OBJECTS,
  AVATAR_VARIANTS,
  DIRECTION_ORDER,
  EMOTES,
  animKey,
  animStartFrame,
  sitFrames,
  sleepFrames,
} from '../assetManifest.js';

const ANIM_RATE = { idle: 5, walk: 10, sit: 4, sleep: 3 } as const;

export class PreloaderScene extends Phaser.Scene {
  constructor() { super({ key: 'PreloaderScene' }); }

  preload() {
    const { width, height } = this.scale;

    // Loading UI — палитра ТЗ-06 (матовый графит + коралловый прогресс-бар)
    this.add.rectangle(width / 2, height / 2, 280, 12, UI_HEX.ink900).setStrokeStyle(1, 0x3a352c);
    const bar = this.add.rectangle(width / 2 - 140, height / 2, 0, 10, UI_HEX.accentCoral).setOrigin(0, 0.5);
    this.add.text(width / 2, height / 2 - 28, 'BotVille', {
      fontSize: '18px', color: UI.textOnDark, fontFamily: 'monospace', letterSpacing: 4,
    }).setOrigin(0.5);
    const status = this.add.text(width / 2, height / 2 + 22, tr('game.initializing'), {
      fontSize: '10px', color: UI.textOnDarkMuted, fontFamily: 'monospace',
    }).setOrigin(0.5);

    this.load.on('progress', (v: number) => {
      bar.width = 280 * v;
      status.setText(tr('game.loading', { pct: Math.round(v * 100) }));
    });

    // Карта района + атлас земли (генерируются scripts/build-district.mjs)
    this.load.tilemapTiledJSON(DISTRICT.mapKey, 'assets/tilemaps/district.tmj');
    this.load.image(DISTRICT.tilesetName, 'assets/tilesets/limezu/district_ground.png');

    // Здания и пропсы района
    for (const key of DISTRICT_IMAGES) {
      this.load.image(key, `assets/sprites/limezu/district/${key}.png`);
    }

    // Спрайтшиты агентов (люди + животные) — размеры кадров из манифеста
    for (const v of AVATAR_VARIANTS) {
      this.load.spritesheet(v.textureKey, v.file, {
        frameWidth: v.frameWidth,
        frameHeight: v.frameHeight,
      });
    }

    // Интерьеры: карты, атлас, мебель, анимированные объекты
    for (const mapKey of Object.values(INTERIORS)) {
      this.load.tilemapTiledJSON(mapKey, `assets/tilemaps/${mapKey}.tmj`);
    }
    this.load.image(INTERIOR_TILESET, 'assets/tilesets/limezu/interiors_ground.png');
    for (const key of INTERIOR_IMAGES) {
      this.load.image(key, `assets/sprites/limezu/interior/${key}.png`);
    }
    for (const [key, def] of Object.entries(ANIMATED_OBJECTS)) {
      this.load.spritesheet(`anim-${key}`, def.file, {
        frameWidth: def.frameWidth,
        frameHeight: def.frameHeight,
      });
    }

    // Эмоции: один файл, две нарезки (пузырь 16x32 и иконки 16x16)
    this.load.spritesheet(EMOTES.think.textureKey, EMOTES.file, {
      frameWidth: EMOTES.think.frameWidth,
      frameHeight: EMOTES.think.frameHeight,
    });
    this.load.spritesheet(EMOTES.icons.textureKey, EMOTES.file, {
      frameWidth: EMOTES.icons.frameWidth,
      frameHeight: EMOTES.icons.frameHeight,
    });
  }

  create() {
    this.registerAgentAnimations();

    this.time.delayedCall(50, () => {
      this.scene.start('DistrictScene');
    });
  }

  /** Все анимации агентов и эмоций — по данным манифеста, без магических чисел. */
  private registerAgentAnimations() {
    const mk = (key: string, texture: string, frames: number[], frameRate: number, repeat = -1) => {
      if (this.anims.exists(key)) return;
      this.anims.create({
        key,
        frames: frames.map(f => ({ key: texture, frame: f })),
        frameRate,
        repeat,
      });
    };
    const range = (start: number, len: number) => Array.from({ length: len }, (_, i) => start + i);

    for (const v of AVATAR_VARIANTS) {
      for (const dir of DIRECTION_ORDER) {
        mk(animKey(v, 'idle', dir), v.textureKey, range(animStartFrame(v, 'idle', dir), v.framesPerDirection), ANIM_RATE.idle);
        mk(animKey(v, 'walk', dir), v.textureKey, range(animStartFrame(v, 'walk', dir), v.framesPerDirection), ANIM_RATE.walk);
      }
      if (v.rows.sit !== undefined) {
        mk(animKey(v, 'sit-right'), v.textureKey, sitFrames(v, 'right'), ANIM_RATE.sit);
        mk(animKey(v, 'sit-left'), v.textureKey, sitFrames(v, 'left'), ANIM_RATE.sit);
      }
      if (v.rows.sleep !== undefined) {
        mk(animKey(v, 'sleep'), v.textureKey, sleepFrames(v), ANIM_RATE.sleep);
      }
    }

    // Пузырь «думает»: появление, затем зацикленное «бурление»
    mk('emote-think-appear', EMOTES.think.textureKey, [...EMOTES.think.appearFrames], EMOTES.think.frameRate, 0);
    mk('emote-think-loop', EMOTES.think.textureKey, [...EMOTES.think.loopFrames], EMOTES.think.frameRate);

    // Иконки статусов — двухкадровая пульсация
    for (const [statusName, pair] of Object.entries(EMOTES.icons.byStatus)) {
      mk(`emote-icon-${statusName}`, EMOTES.icons.textureKey, [...pair], EMOTES.icons.frameRate);
    }

    // Анимированные объекты интерьеров
    for (const [key, def] of Object.entries(ANIMATED_OBJECTS)) {
      mk(`anim-${key}`, `anim-${key}`, range(0, def.frames), def.frameRate);
    }
  }
}

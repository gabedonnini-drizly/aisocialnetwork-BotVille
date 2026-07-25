import Phaser from 'phaser';
import { GLOW_TEXTURE } from './config.js';

/**
 * Белый радиальный градиент для ночных глоу (фонари, окна, фары).
 * Генерится ОДИН раз в RenderTexture (Light2D не используем — дорого);
 * цвет задаётся тинтом спрайта, blend — ADD.
 */
export function ensureGlowTexture(scene: Phaser.Scene) {
  if (scene.textures.exists(GLOW_TEXTURE.key)) return;

  const size = GLOW_TEXTURE.size;
  const r = size / 2;
  const steps = 24;

  const g = scene.make.graphics({}, false);
  for (let i = steps; i >= 1; i--) {
    // концентрические круги: к центру альфа накапливается, край сходит в ноль
    const t = i / steps;
    g.fillStyle(0xffffff, (1 - t) * 0.12 + 0.015);
    g.fillCircle(r, r, r * t);
  }

  const rt = scene.make.renderTexture({ width: size, height: size }, false);
  rt.draw(g, 0, 0);
  rt.saveTexture(GLOW_TEXTURE.key);
  g.destroy();
  rt.destroy();
}

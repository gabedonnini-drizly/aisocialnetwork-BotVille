import Phaser from 'phaser';
import { GLOW_TEXTURE } from './config.js';

/**
 * A white radial gradient for night glows (street lamps, windows, headlights).
 * Generated ONCE into a RenderTexture (we don't use Light2D — too expensive);
 * the color comes from the sprite tint, the blend mode is ADD.
 */
export function ensureGlowTexture(scene: Phaser.Scene) {
  if (scene.textures.exists(GLOW_TEXTURE.key)) return;

  const size = GLOW_TEXTURE.size;
  const r = size / 2;
  const steps = 24;

  const g = scene.make.graphics({}, false);
  for (let i = steps; i >= 1; i--) {
    // concentric circles: alpha accumulates towards the center, the edge fades to zero
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

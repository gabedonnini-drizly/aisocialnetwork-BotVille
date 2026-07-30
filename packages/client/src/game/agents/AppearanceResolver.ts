/**
 * spriteSeed -> appearanceHash -> texture key.
 *
 * A pure module (does not import Phaser) — tested under node --test.
 * The AppearanceResolver class below adds the SINGLE impure part:
 * asking Phaser's texture cache "is this baked appearance already loaded?".
 *
 * I-13: an agent is NEVER assigned an animal look. The rule binds precisely
 * this — the new — path. Existing BotVille agents (SQLite) keep their
 * avatar_variant, and the animal textures stay loaded, because the world is
 * still owned by agentLife.ts (out of scope). What is forbidden is DERIVING an
 * animal look, not drawing animals at all.
 */
import { appearanceHash, appearanceRecord, hashString } from '@botville/shared/appearance/derive.mjs';
import { AVATAR_VARIANTS } from '../assetManifest.js';

/** Humans are ids 0..11 in AVATAR_VARIANTS. Animals (12..15) are excluded for good. */
export const HUMAN_VARIANT_IDS: number[] = AVATAR_VARIANTS
  .filter(v => v.kind === 'human')
  .map(v => v.id);

export interface ResolvedAppearance {
  hash: string;
  textureKey: string;
  url: string;
}

export function resolveAppearance(spriteSeed: string, gender: string): ResolvedAppearance {
  const hash = appearanceHash(appearanceRecord(spriteSeed, gender));
  return { hash, textureKey: `agent-${hash}`, url: `assets/baked/${hash}.png` };
}

/**
 * The fallback sheet when no bake exists: a deterministic HUMAN premade.
 * An agent is never drawn with a broken texture (spec §8.3).
 */
export function fallbackTextureKey(spriteSeed: string): string {
  const id = HUMAN_VARIANT_IDS[hashString(spriteSeed, 'sprite:fallback') % HUMAN_VARIANT_IDS.length];
  return AVATAR_VARIANTS[id].textureKey;
}

/** A wrapper over the scene's texture cache. The module's only impure part. */
export class AppearanceResolver {
  /** An explicit field: a parameter property does not survive strip-only type stripping. */
  private readonly textures: { exists(key: string): boolean };

  constructor(textures: { exists(key: string): boolean }) {
    this.textures = textures;
  }

  has(hash: string): boolean {
    return this.textures.exists(`agent-${hash}`);
  }

  /** The texture key for an agent: a baked sheet or the fallback human. */
  textureFor(spriteSeed: string, gender: string): string {
    const r = resolveAppearance(spriteSeed, gender);
    return this.has(r.hash) ? r.textureKey : fallbackTextureKey(spriteSeed);
  }
}

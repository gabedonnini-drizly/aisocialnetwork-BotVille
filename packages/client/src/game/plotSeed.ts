/**
 * `pickFrom(pool, seed, salt)` — the ONE deterministic variant pick.
 *
 * D-75 ("Variant pools") names the helper that must be used:
 * `api/src/utils/agentSeed.js:178`, where `pickFrom(list, seed, salt)` sits on
 * `hashString(seed, salt)` — FNV-1a over `${salt}:${seed}`, unsigned 32-bit.
 * That is not a preference. The api derives a great deal from those two
 * functions already, and a second seeding scheme would mean the same agent
 * hashing to two different answers depending on which repo asked.
 *
 * IT CANNOT BE IMPORTED. It is CommonJS in a different repository and this
 * module is bundled into a browser build; plan `04-` Task 5 anticipated
 * exactly this and ruled the remedy: MIRROR IT, AND PIN THE MIRROR WITH A
 * SHARED FIXTURE. `test/plot-seed.test.mjs` runs a committed vector through
 * this copy always, and through the api's real `pickFrom` whenever the sibling
 * repo is on disk — so neither copy can move without the other going red.
 *
 * Line-for-line equivalent to the original; the only changes are TypeScript
 * types and this comment.
 *
 * Do not import Phaser: the module is tested under node --test.
 */

/** FNV-1a over `${salt}:${str}`, unsigned 32-bit. Mirrors api agentSeed.js:30. */
export function hashString(str: string, salt = ''): number {
  const input = `${salt}:${str}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Mirrors api agentSeed.js:178. */
export function pickFrom<T>(list: readonly T[], seed: string, salt: string): T {
  return list[hashString(seed, salt) % list.length];
}

/**
 * Salts, in one place because a salt is part of the answer.
 *
 * Change one and every agent's tent changes overnight — the same hazard
 * `contract/variant_pools.json`'s `appendOnly` note records for pool ORDER.
 * They are values, not literals scattered at call sites, so that hazard is
 * visible in one file.
 */
export const SEED_SALT = {
  /** Which tent an agent pitches. Per AGENT (plan `03-` Task 2: "same agent,
   *  same tent, forever"), so it follows them if they move camp. */
  tent: 'tent',
  /** Which bush/worksite piece a PARCEL gets — per plot, not per agent: the
   *  scenery belongs to the land. */
  plotScatter: 'plotScatter',
  /** The worksite's skeleton, plant and ground flavour — per plot, one salt
   *  each so two of them cannot lock in step across the town. */
  worksiteCentre: 'worksiteCentre',
  worksitePlant: 'worksitePlant',
  worksiteGround: 'worksiteGround',
  worksiteBoundary: 'worksiteBoundary',
} as const;

/**
 * Deterministic 32-bit string hash (FNV-1a variant). Not cryptographic —
 * it only needs to spread inputs evenly across buckets.
 *
 * CROSS-REPO CONTRACT: byte-for-byte the same function as
 * aisocialnetwork-api/src/utils/agentSeed.js:30. The api derives an agent's
 * city, traits and description seeds from it; BotVille derives that same
 * agent's appearance (Plan 4 Task 26) and its in-venue slot (Plan 3 Task 37).
 * If the two implementations drift, the sprite and the profile stop
 * describing the same person, silently. The test in shared-types.test.ts
 * pins it — and its skip is loud, never silent.
 *
 * WHY .mjs AND NOT .ts: same reason as schemaVersion.mjs — bare `node` (the
 * bake CLIs) and Vite (the client bundle) both load it, and neither rewrites
 * a `.js` specifier onto a `.ts` file.
 */
export function hashString(str, salt = '') {
  const input = `${salt}:${str}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0; // unsigned 32-bit integer
}

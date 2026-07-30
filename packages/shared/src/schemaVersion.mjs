/**
 * The one definition of SCHEMA_VERSION.
 *
 * Bumping it invalidates every baked appearance artifact, because it is
 * hashed into `appearanceHash` (I-7). There is no manual purge step.
 *
 * WHY .mjs AND NOT .ts: appearance/derive.mjs hashes this value, and that
 * module is loaded by bare `node` (scripts/agent-bake.mjs) and by Vite (the
 * client bundle). Neither rewrites a `.js` specifier onto a `.ts` file —
 * only test/ts-resolve.mjs does, and it exists only inside `node --test`.
 * A .mjs constant is reachable from every loader. types/Assets.ts
 * re-exports it so TypeScript consumers see it on @botville/shared.
 * test/harness-no-hook.test.mjs enforces this.
 */
export const SCHEMA_VERSION = 1;

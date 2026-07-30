/**
 * Lets `node --test` load this repo's runtime TypeScript.
 *
 * TS source here imports siblings with a `.js` extension for a `.ts` file
 * (moduleResolution: "bundler" — what Vite and tsc expect). Node's type
 * stripping does NOT rewrite that extension, so plain `node --test` cannot
 * load venueRegistry.ts, AppearanceResolver.ts and friends. This hook maps
 * a relative `./x.js` onto `./x.ts` when only the .ts file exists.
 *
 * Test-only. Nothing in the shipped build depends on it.
 */
import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (context.parentURL && specifier.endsWith('.js') && /^\.{1,2}\//.test(specifier)) {
      const asJs = new URL(specifier, context.parentURL);
      const asTs = new URL(`${specifier.slice(0, -3)}.ts`, context.parentURL);
      if (!existsSync(fileURLToPath(asJs)) && existsSync(fileURLToPath(asTs))) {
        return { url: asTs.href, shortCircuit: true };
      }
    }
    return nextResolve(specifier, context);
  },
});

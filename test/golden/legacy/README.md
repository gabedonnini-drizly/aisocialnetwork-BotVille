# Frozen legacy pipeline — do not modify, do not import

These are the imperative build scripts this repo used before the world bake
existed. They are kept for exactly one purpose: proving that
`scripts/world-bake.mjs` reproduces what they produced, byte for byte
(Task 20's golden gate).

- Nothing in `scripts/`, `packages/` or `test/` imports them.
- The build never runs them.
- Their only callers are `scripts/capture-golden-baseline.mjs` and
  `test/bake/golden.test.mjs`, both of which are about comparing to the past.
- They need `assets-src/` to run, so they are inert without the licensed packs.

If you are tempted to fix a bug in here: don't. Fix it in the contract, the
adapter or the venue descriptor, and let the golden gate tell you the output
changed. A change here would make the gate compare the new pipeline against a
moving target, which is the one thing it must never do.

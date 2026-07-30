import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/**
 * Final review Critical Finding 1: PreloaderScene.ts registered baked-hash
 * animations BEFORE their spritesheets finished loading. Phaser 3.90
 * resolves animation frames eagerly (Animation.getFrames ->
 * TextureManager.getFrame), so any `anims.create()` call that runs before
 * the matching texture is in the cache produces a permanently empty
 * animation — `mk()`'s `anims.exists` guard then blocks it from ever being
 * re-created correctly.
 *
 * packages/client has no test runner wired up yet (no vitest, no DOM), and
 * Phaser itself needs a browser-ish environment to instantiate a Scene, so
 * this cannot drive `create()` and observe real anim frames under `node
 * --test`. What CAN be pinned under bare node is the CONTRACT the source
 * must satisfy: `registerAgentAnimations(baked)` must be called from
 * strictly inside the loader's COMPLETE handler — i.e. after both (a) the
 * baked spritesheets are queued and (b) the loader has started — never as a
 * bare statement in `create()` ahead of the load. This is a structural
 * (source-text) assertion, in the same spirit as
 * test/shared-types.test.ts's regex pins on Assets.ts.
 */
const SRC_PATH = 'packages/client/src/game/scenes/PreloaderScene.ts';
const src = readFileSync(SRC_PATH, 'utf8');

const createStart = src.indexOf('create()');
const createEnd = src.indexOf('private registerAgentAnimations');
assert.ok(createStart >= 0 && createEnd > createStart, 'could not locate create() body in ' + SRC_PATH);
const createBody = src.slice(createStart, createEnd);

test('create() queues baked spritesheets before attaching the COMPLETE listener', () => {
  const queueBakedIdx = createBody.indexOf('this.load.spritesheet(`agent-${hash}`');
  const completeIdx = createBody.indexOf('Loader.Events.COMPLETE');
  assert.ok(queueBakedIdx >= 0, 'create() must queue agent-<hash> spritesheets');
  assert.ok(completeIdx >= 0, 'create() must attach a Loader COMPLETE listener');
  assert.ok(queueBakedIdx < completeIdx,
    'baked spritesheets must be queued before the COMPLETE listener is attached');
});

test('registerAgentAnimations(baked) runs strictly inside the loader COMPLETE handler, not eagerly in create()', () => {
  const completeIdx = createBody.indexOf('Loader.Events.COMPLETE');
  // The literal statement, semicolon included, so this can't match a prose
  // mention of `this.load.start()` inside a comment (there is one, just above).
  const startIdx = createBody.indexOf('this.load.start();');
  assert.ok(completeIdx >= 0 && startIdx > completeIdx,
    'expected a COMPLETE listener attached before this.load.start() is called');

  // The handler body is the callback passed to `this.load.once(...)`, i.e.
  // everything between the COMPLETE token and the `this.load.start()` call
  // that follows it (the callback is defined before start() is invoked, but
  // its body only runs once the load actually completes).
  const handlerBody = createBody.slice(completeIdx, startIdx);
  const registerIdx = handlerBody.indexOf('this.registerAgentAnimations(baked)');
  assert.ok(registerIdx >= 0,
    'registerAgentAnimations(baked) must be called from inside the COMPLETE handler ' +
    '(found outside it — this reintroduces Critical Finding 1: baked anims registered before their textures load)');

  // And the reverse: it must NOT also appear earlier, as a bare statement
  // in create() ahead of the COMPLETE attachment (the original bug's shape).
  const eagerCallBeforeComplete = createBody.slice(0, completeIdx).includes('this.registerAgentAnimations(baked)');
  assert.equal(eagerCallBeforeComplete, false,
    'registerAgentAnimations(baked) must not be called before the COMPLETE listener is attached');
});

test('registerAgentAnimations keeps its idempotency guard (anims.exists) — baked anims are safe to re-register', () => {
  assert.match(src, /if \(this\.anims\.exists\(key\)\) return;/,
    'mk()\'s anims.exists guard must remain, since registration now runs from an event handler that could in ' +
    'principle fire more than once per scene lifetime');
});

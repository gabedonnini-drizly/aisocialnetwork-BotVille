import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { venueRegistry } from '../packages/client/src/game/venueRegistry.ts';
import { isPlot } from '../packages/client/src/game/plotRegistry.ts';

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

/**
 * F-2. The preloader asked the loader for a tilemap per VENUE, and D-79 made
 * 23 of the 41 venues parcels — rectangles on the district map with no
 * interior and therefore no baked .tmj. Result: 23 requests per boot that
 * could only ever 404.
 *
 * The pin is a SET EQUALITY against the baked directory, in both directions,
 * because each direction catches a different bug:
 *
 *   load list \ disk   a request that can only 404 (the bug being fixed);
 *   disk \ load list   a map the bake wrote and the client never asks for —
 *                      which is how a venue becomes unreachable in silence.
 *
 * It is also deliberately NOT a check that "plots are excluded". The day a
 * built plot gains an interior TMJ, this fails and someone has to decide,
 * rather than the map quietly going missing.
 */
const TILEMAP_DIR = 'packages/client/public/assets/tilemaps';

test('the tilemaps the preloader requests are exactly the tilemaps the bake wrote (F-2)', () => {
  const onDisk = readdirSync(TILEMAP_DIR)
    .filter(f => f.endsWith('.tmj'))
    .map(f => f.replace(/\.tmj$/, ''))
    .sort();
  const requested = venueRegistry.withTilemap().map(v => v.id).sort();

  assert.ok(onDisk.length > 0, `${TILEMAP_DIR} is empty — this check is vacuous`);

  const missing = requested.filter(id => !onDisk.includes(id));
  assert.deepEqual(missing, [],
    `the preloader would request ${missing.length} tilemap(s) the bake never wrote: `
    + `${missing.join(', ')} — one 404 per boot, each one counted toward the progress bar`);

  const unrequested = onDisk.filter(id => !requested.includes(id));
  assert.deepEqual(unrequested, [],
    `the bake wrote ${unrequested.join(', ')} and nothing loads them — those venues open black`);
});

test('every parcel is excluded, and excluded for being a parcel (F-2)', () => {
  // The count is the finding, restated as an assertion: 41 published venues,
  // 18 with a map. If a future bake bakes a plot interior this fails HERE
  // first, with a name, rather than at the set-equality check above.
  const parcels = venueRegistry.all().filter(v => isPlot(v.id));
  assert.ok(parcels.length > 0, 'no parcels — this check is vacuous');
  assert.equal(venueRegistry.withTilemap().length + parcels.length, venueRegistry.all().length);
  for (const p of parcels) {
    assert.equal(venueRegistry.withTilemap().some(v => v.id === p.id), false,
      `${p.id} is a parcel and has no interior — asking for its tilemap is a guaranteed 404`);
  }
});

test('preload() sizes its tilemap loop by withTilemap(), not by all() (F-2)', () => {
  // Source-level, in the same spirit as the pins above: the 404s came back
  // the moment somebody wrote `for (const v of venueRegistry.all())` beside a
  // `load.tilemapTiledJSON`, and no runtime test in this repo boots Phaser.
  const preloadBody = src.slice(src.indexOf('preload()'), createStart);
  const upto = preloadBody.slice(0, preloadBody.indexOf('tilemapTiledJSON'));
  // The `for` header immediately above the load call — not the prose above
  // it, which legitimately names `all()` while explaining why it is wrong.
  const header = upto.slice(upto.lastIndexOf('for ('));
  assert.ok(header.includes('venueRegistry.withTilemap()'),
    `the tilemap loop must iterate venueRegistry.withTilemap(); it iterates: ${header.trim()}`);
  assert.equal(header.includes('venueRegistry.all()'), false,
    'the tilemap loop iterates every venue again — 23 of them have no map (F-2)');
});

test('registerAgentAnimations keeps its idempotency guard (anims.exists) — baked anims are safe to re-register', () => {
  assert.match(src, /if \(this\.anims\.exists\(key\)\) return;/,
    'mk()\'s anims.exists guard must remain, since registration now runs from an event handler that could in ' +
    'principle fire more than once per scene lifetime');
});

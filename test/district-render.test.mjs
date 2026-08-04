import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { captureDistrictRender } from './helpers/districtRender.mjs';
import { districtGeometry } from '../packages/client/src/game/config.ts';
import { venueRegistry } from '../packages/client/src/game/venueRegistry.ts';

/**
 * The bracketing check for Plan 03 Task 1 (Planning-mode QA: "the same capture
 * must differ ONLY in the ways this plan intends"). The baseline was captured
 * from the pre-refactor scene at a882a79; every later change to the outdoor
 * scene must either leave it identical or explain every line that moved.
 *
 * THE COMMITTED DOCUMENT IS NOT THE ORIGINAL BYTES. It has been re-baselined
 * twice, both times deliberately, and both diffs are recorded field by field
 * in test/helpers/districtRender.mjs's PROVENANCE block — read it before
 * treating "the golden file matches" as "nothing has changed since capture".
 * That file also lists what the capture cannot see, including the parts of
 * DistrictScene.create it TRANSCRIBES rather than calls.
 *
 * Regenerate deliberately, never to clear a red: npm run golden:district
 */
const BASELINE = 'test/golden/district-render.json';

test('the outdoor scene still renders what the baseline recorded', () => {
  const expected = JSON.parse(readFileSync(BASELINE, 'utf8'));
  const actual = captureDistrictRender();
  // Field by field first: a deepEqual on the whole document reports the
  // difference as two 400-line dumps, which is how a real diff gets skimmed.
  for (const key of Object.keys(expected)) {
    assert.deepEqual(actual[key], expected[key], `${BASELINE}: '${key}' has moved`);
  }
  assert.deepEqual(Object.keys(actual).sort(), Object.keys(expected).sort());
});

/**
 * F-1, the assertion that would have caught the pin.
 *
 * The defect the Task 7 review found was not subtle once named: the client
 * sized its camera, its Pathfinder grid and its tint overlay from a `DISTRICT`
 * constant in config.ts that said 48 x 46, while the bake had grown the map to
 * 92 x 92. Nothing failed. The Pathfinder simply built a grid over the top-left
 * 48 x 46 of a 92 x 92 town and reported every tile beyond it unwalkable; the
 * camera refused to pan past the old edge. A SECOND COPY OF A DIMENSION IS THE
 * BUG, and the only check that catches it is one that compares the copy the
 * scene uses against the file it loads.
 *
 * `districtGeometry` is that copy — it is what DistrictScene.create passes to
 * `new Pathfinder(...)`, `cam.setBounds` and the overlay. So: for every
 * district, what the scene will size itself by must equal what the loader will
 * hand it.
 */
test('every district’s geometry IS the tilemap it loads (F-1)', () => {
  const districts = venueRegistry.districts();
  assert.ok(districts.length > 0, 'no districts — this check is vacuous');
  for (const venue of districts) {
    const geo = districtGeometry(venue);
    const path = `packages/client/public/assets/tilemaps/${geo.mapKey}.tmj`;
    assert.ok(existsSync(path),
      `district '${venue.id}' has no tilemap at ${path} — the scene would boot into a black screen`);
    const map = JSON.parse(readFileSync(path, 'utf8'));
    assert.equal(geo.widthTiles, map.width,
      `district '${venue.id}': the client sizes itself ${geo.widthTiles} wide, the map it loads is `
      + `${map.width}. Every tile past ${geo.widthTiles} is off the pathfinder grid and outside the `
      + 'camera bounds.');
    assert.equal(geo.heightTiles, map.height,
      `district '${venue.id}': the client sizes itself ${geo.heightTiles} tall, the map it loads is `
      + `${map.height}.`);
    assert.equal(geo.widthPx, map.width * map.tilewidth);
    assert.equal(geo.heightPx, map.height * map.tileheight);
    assert.ok(map.tilesets.some(t => t.name === geo.tilesetName || t.source?.includes(geo.tilesetName)),
      `district '${venue.id}': ground atlas '${geo.tilesetName}' is not a tileset of its own map`);
  }
});

test('the camera opens on the town, not on the middle of the grass (F-1)', () => {
  // The regression this is here for: `centerOn(widthPx/2 - 24, heightPx/2 - 8)`
  // was derived from the geometry and still wrong the moment the district grew
  // by extension rather than around its centre. The opening view must sit
  // inside the bounding box of the places the map actually declares.
  const c = captureDistrictRender();
  const { initialCentre, bounds } = c.camera;
  const xs = c.objects.spawns.map(s => s.x);
  const ys = c.objects.spawns.map(s => s.y);
  assert.ok(initialCentre.x >= Math.min(...xs) && initialCentre.x <= Math.max(...xs),
    `the camera opens at x=${initialCentre.x}, outside the spawn spread `
    + `${Math.min(...xs)}..${Math.max(...xs)} — it is looking at empty ground`);
  assert.ok(initialCentre.y >= Math.min(...ys) && initialCentre.y <= Math.max(...ys),
    `the camera opens at y=${initialCentre.y}, outside the spawn spread `
    + `${Math.min(...ys)}..${Math.max(...ys)}`);
  assert.deepEqual(bounds, { x: 0, y: 0, width: c.geometry.widthPx, height: c.geometry.heightPx },
    'camera bounds must be the whole map, or half the town is unreachable by panning');
  assert.equal(c.camera.carCull.maxX, c.geometry.widthPx + 16,
    'cars culled at the OLD map edge vanish mid-screen');
  assert.equal(c.camera.carCull.maxY, c.geometry.heightPx + 16);
  assert.deepEqual(c.camera.tintOverlay, {
    x: -c.geometry.widthPx, y: -c.geometry.heightPx,
    width: c.geometry.widthPx * 3, height: c.geometry.heightPx * 3,
  }, 'a tint overlay sized to the old map leaves the grown quarters undarkened at night');
});

test('the capture is not empty — a baseline of nothing passes for the wrong reason', () => {
  const c = captureDistrictRender();
  assert.ok(c.objects.buildings.length > 0, 'no buildings captured');
  assert.ok(c.objects.doors.length > 0, 'no doors captured');
  assert.ok(c.objects.spawns.length > 0, 'no spawn points captured');
  assert.ok(c.objects.penSpots.length > 0, 'no farm pen spots captured');
  assert.ok(c.walkability.blockedTiles > 0, 'nothing blocks the walkability grid');
  assert.ok(c.paths.every(p => p.steps > 0), 'a door is unreachable from spawn point 0');
  assert.ok(c.tick.present.length > 0, 'the fixed tick draws nobody');
  assert.ok(Object.keys(c.tick.spawn).length > 0, 'the fixed tick spawns nobody');
});

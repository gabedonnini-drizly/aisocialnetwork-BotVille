import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assignSlots, standingSlot, isOverCapacity, displacedSlot } from '../packages/client/src/game/venueSlots.ts';
import type { FootprintRect } from '../packages/client/src/game/venueSlots.ts';
import { venueRegistry } from '../packages/client/src/game/venueRegistry.ts';

const cafe = venueRegistry.get('cafe')!;
const ids = (n: number) => Array.from({ length: n }, (_, i) => `agent_${i}`);

// Pixel-space furniture footprints, the shape the .tmj collision layer holds.
// One aligned to the grid, one deliberately off-grid: exclusion is by
// intersection, not by tile-coordinate equality.
const FOOTPRINTS: FootprintRect[] = [
  { x: 4 * 16, y: 8 * 16, w: 48, h: 18 },
  { x: 12 * 16 + 5, y: 9 * 16 + 3, w: 30, h: 18 },
];

test('assignment is deterministic — the same roster lands identically', () => {
  assert.deepEqual([...assignSlots(cafe, ids(20))], [...assignSlots(cafe, ids(20))]);
});

test('assignment does not depend on roster order', () => {
  const a = assignSlots(cafe, ids(9));
  const b = assignSlots(cafe, [...ids(9)].reverse());
  for (const id of ids(9)) assert.deepEqual(a.get(id), b.get(id), id);
});

test('no two agents share a seat', () => {
  const m = assignSlots(cafe, ids(9));
  const taken = [...m.values()].map(v => v.seatIndex).filter(i => i !== null);
  assert.equal(new Set(taken).size, taken.length);
});

test('seats fill before anyone stands', () => {
  const m = assignSlots(cafe, ids(cafe.seats.length));
  assert.equal([...m.values()].filter(v => v.seatIndex === null).length, 0);
});

test('overflow agents never share a standing position', () => {
  // Exact, not "mostly distinct": rank -> cell is a bijection, so a
  // collision is a bug in strideFor, not an acceptable coincidence. A
  // threshold here would have hidden exactly that.
  for (const n of [10, 25, 40]) {
    const standing = [...assignSlots(cafe, ids(n)).values()].filter(v => v.seatIndex === null);
    assert.equal(standing.length, Math.max(0, n - cafe.seats.length), `roster of ${n}`);
    const keys = new Set(standing.map(v => `${v.x},${v.y}`));
    assert.equal(keys.size, standing.length, `roster of ${n}: two agents on the same tile`);
  }
});

test('standing capacity is the free floor, and we know what it is', () => {
  const [W, H] = cafe.sizeTiles;
  const cells = (W - 4) * (H - 5);
  const standing = [...assignSlots(cafe, ids(cells + cafe.seats.length)).values()]
    .filter(v => v.seatIndex === null);
  assert.equal(new Set(standing.map(v => `${v.x},${v.y}`)).size, cells,
    'the floor grid should be exactly filled before anything repeats');
});

test('standing positions stay inside the room', () => {
  const [W, H] = cafe.sizeTiles;
  for (const v of assignSlots(cafe, ids(40)).values()) {
    assert.ok(v.x > 16 && v.x < (W - 1) * 16, `x ${v.x}`);
    assert.ok(v.y > 32 && v.y < (H - 1) * 16, `y ${v.y}`);
  }
});

// ── F-14: furniture footprints exclude standing cells ────────────────────

test('no standing slot intersects a furniture footprint (F-14)', () => {
  const standing = [...assignSlots(cafe, ids(40), FOOTPRINTS).values()]
    .filter(v => v.seatIndex === null);
  assert.ok(standing.length > 0, 'the roster must overflow the seats for this test to bite');
  for (const s of standing) {
    // The slot is a cell centre; the whole 16px cell must be clear.
    const cx = s.x - 8, cy = s.y - 8;
    for (const f of FOOTPRINTS) {
      const overlaps = f.x < cx + 16 && f.x + f.w > cx && f.y < cy + 16 && f.y + f.h > cy;
      assert.equal(overlaps, false, `slot at ${s.x},${s.y} stands in the footprint at ${f.x},${f.y}`);
    }
  }
});

test('footprints shrink the bijection without breaking it', () => {
  // Same guarantee as the free-floor test, over the REDUCED cell set: fill
  // every free cell exactly once before anything repeats.
  const [W, H] = cafe.sizeTiles;
  const T = 16;
  let free = 0;
  for (let cy = 3; cy < H - 2; cy++) {
    for (let cx = 2; cx < W - 2; cx++) {
      const blocked = FOOTPRINTS.some(f =>
        f.x < (cx + 1) * T && f.x + f.w > cx * T && f.y < (cy + 1) * T && f.y + f.h > cy * T);
      if (!blocked) free++;
    }
  }
  const all = (W - 4) * (H - 5);
  assert.ok(free < all, 'the fixture footprints must actually block cells');
  const standing = [...assignSlots(cafe, ids(free + cafe.seats.length), FOOTPRINTS).values()]
    .filter(v => v.seatIndex === null);
  assert.equal(new Set(standing.map(v => `${v.x},${v.y}`)).size, free,
    'the free cells should be exactly filled before anything repeats');
});

test('footprints do not disturb determinism or order-independence', () => {
  assert.deepEqual([...assignSlots(cafe, ids(20), FOOTPRINTS)],
                   [...assignSlots(cafe, ids(20), FOOTPRINTS)]);
  const a = assignSlots(cafe, ids(20), FOOTPRINTS);
  const b = assignSlots(cafe, [...ids(20)].reverse(), FOOTPRINTS);
  for (const id of ids(20)) assert.deepEqual(a.get(id), b.get(id), id);
});

test('a pathologically furnished room degrades to the raw grid, never crashes', () => {
  const everything: FootprintRect[] = [{ x: 0, y: 0, w: cafe.sizeTiles[0] * 16, h: cafe.sizeTiles[1] * 16 }];
  const s = standingSlot(cafe, 'a', 0, everything);
  assert.ok(Number.isFinite(s.x) && Number.isFinite(s.y));
});

test('standingSlot is a pure function of venue, agent and rank', () => {
  assert.deepEqual(standingSlot(cafe, 'a', 3), standingSlot(cafe, 'a', 3));
  assert.notDeepEqual(standingSlot(cafe, 'a', 3), standingSlot(cafe, 'a', 4));
});

test('isOverCapacity reports against the descriptor', () => {
  assert.equal(isOverCapacity(cafe, cafe.capacity), false);
  assert.equal(isOverCapacity(cafe, cafe.capacity + 1), true);
});

test('every venue can seat at least one agent', () => {
  for (const v of venueRegistry.indoor()) {
    assert.ok(v.seats.length > 0, v.id);
    assert.equal(assignSlots(v, ['solo']).get('solo')!.seatIndex, 0);
  }
});

// ── displaced seats (animal-on-bed / bed-outside-sleep-hours) ────────────
// VenueScene falls back to displacedSlot(venue, id, seatIndex, standingCount)
// whenever an agent's ranked seat is off-limits to them right now. The
// partition (standingCount + seatIndex) must never collide with a genuine
// standing rank or with another displaced seat — pinned here against real
// descriptor data (cafe.seats.length), not a hypothetical seat count.

test('displaced seats never collide with standing agents or each other', () => {
  for (const standingCount of [0, 1, 3, cafe.seats.length, cafe.seats.length + 5]) {
    const standingKeys = new Set<string>();
    for (let r = 0; r < standingCount; r++) {
      const { x, y } = standingSlot(cafe, `standee_${r}`, r);
      standingKeys.add(`${x},${y}`);
    }
    const displacedKeys = new Set<string>();
    for (let seatIndex = 0; seatIndex < cafe.seats.length; seatIndex++) {
      const { x, y } = displacedSlot(cafe, `displaced_${seatIndex}`, seatIndex, standingCount);
      const key = `${x},${y}`;
      assert.equal(standingKeys.has(key), false,
        `standingCount ${standingCount}: displaced seat ${seatIndex} collides with a standing agent`);
      assert.equal(displacedKeys.has(key), false,
        `standingCount ${standingCount}: displaced seat ${seatIndex} collides with another displaced seat`);
      displacedKeys.add(key);
    }
  }
});

test('displacedSlot is deterministic and agent-independent (only the seat and standingCount matter)', () => {
  assert.deepEqual(displacedSlot(cafe, 'a', 2, 3), displacedSlot(cafe, 'a', 2, 3));
  assert.deepEqual(displacedSlot(cafe, 'a', 2, 3), displacedSlot(cafe, 'z', 2, 3),
    'the same seat/standingCount lands the same regardless of WHICH agent was displaced');
});

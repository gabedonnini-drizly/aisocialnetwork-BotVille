/**
 * Deterministic distribution of agents across the slots inside a venue.
 *
 * Six venues and a town of 150 agents means ~25 agents per 20x15 room with
 * 4-9 chairs (spec §10.3). Previously syncAgents laid newcomers out in three
 * columns from the spawn point and assigned the first free chair — i.e. it
 * depended on arrival order: the same agent ended up in different places
 * after a reload.
 *
 * Here order plays no part: the slot is derived from the agentId and the venue id.
 * The same roster -> the same arrangement, always.
 *
 * In scope: capacity and layout. NOT in scope: the over-capacity UX — that has to
 * be judged on a populated world; inventing it now would be guesswork (R-3).
 *
 * Does not import Phaser: tested under node --test.
 */
import { hashString } from '@botville/shared/hash.mjs';
import type { VenueDescriptor } from '@botville/shared';

const T = 16;

export interface Slot { x: number; y: number; seatIndex: number | null }

/** A footprint rectangle in pixels — as the collision layer stores it in the .tmj. */
export interface FootprintRect { x: number; y: number; w: number; h: number }

export function isOverCapacity(venue: VenueDescriptor, count: number): boolean {
  return count > venue.capacity;
}

/**
 * The largest stride coprime with the number of cells. This guarantees that
 * rank -> cell is a BIJECTION over the first N ranks: two standing agents cannot
 * land in the same cell. The previous version mixed the agent's hash into cell,
 * which made collisions possible — the test could fail intermittently.
 */
function strideFor(cells: number): number {
  const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
  for (let s = Math.floor(cells / 2) | 1; s > 1; s -= 2) if (gcd(s, cells) === 1) return s;
  return 1;
}

/**
 * FREE floor cells (F-14): the grid between the walls MINUS the cells touched by
 * a furniture footprint. The bake derives the collision layer from exactly these
 * footprints (Plan 2 Task 15) — the system knows which cells are occupied, and
 * the layout is obliged to use that knowledge, otherwise agents stand inside tables.
 *
 * Structural wall rectangles from the same layer do not intersect the grid
 * (it is inset from the walls), so the scene can pass the whole layer through.
 */
function freeFloorCells(venue: VenueDescriptor, footprints: FootprintRect[]): { cx: number; cy: number }[] {
  const [W, H] = venue.sizeTiles;
  // floor: from the 2nd row (below the walls) to the second-to-last, excluding the edge columns
  const cells: { cx: number; cy: number }[] = [];
  for (let cy = 3; cy < H - 2; cy++) {
    for (let cx = 2; cx < W - 2; cx++) {
      const blocked = footprints.some(f =>
        f.x < (cx + 1) * T && f.x + f.w > cx * T &&
        f.y < (cy + 1) * T && f.y + f.h > cy * T);
      if (!blocked) cells.push({ cx, cy });
    }
  }
  return cells;
}

/**
 * A standing agent's position: a free-floor cell derived from the rank.
 *
 * Individuality comes not from a hash HERE but from the ordering in assignSlots:
 * an agent's rank is derived from its seed. That makes the layout simultaneously
 * deterministic, agent-dependent and collision-FREE as long as there are fewer
 * standing agents than cells. The rank -> cell bijection operates on the FREE
 * cells: cells is their count, and the argument from strideFor carries over
 * unchanged (F-14).
 */
export function standingSlot(
  venue: VenueDescriptor,
  agentId: string,
  rank: number,
  footprints: FootprintRect[] = [],
): { x: number; y: number } {
  let free = freeFloorCells(venue, footprints);
  // The pathological "furniture covered the whole floor" case: degrade to the raw
  // grid — standing inside a table is worse than standing nowhere, but crashing is not an option.
  if (free.length === 0) free = freeFloorCells(venue, []);
  const cells = free.length;

  // The offset is a property of the VENUE, not the agent: different rooms fill
  // differently, but within a room the mapping stays a bijection.
  const offset = hashString(venue.id, 'slot:offset') % cells;
  const { cx, cy } = free[(rank * strideFor(cells) + offset) % cells];
  return { x: cx * T + T / 2, y: cy * T + T / 2 };
}

/**
 * Where an agent goes when their assigned SEAT is off-limits to them right now
 * (an animal ranked onto a bed; a bed ranked outside sleep hours — VenueScene
 * decides the "off-limits" part, this only decides WHERE they land instead).
 *
 * Standing agents occupy floor ranks 0..(standingCount-1) (assignSlots above).
 * A displaced agent takes standingCount + their own seatIndex: seatIndex is
 * unique per seat (0..venue.seats.length-1), so the displaced range
 * [standingCount, standingCount+seats.length-1] can never overlap the genuine
 * standing range, and two displaced agents (different seats) can never
 * collide with each other either. The bijection in standingSlot wraps modulo
 * the free-cell count, so an out-of-range rank is safe by construction.
 */
export function displacedSlot(
  venue: VenueDescriptor,
  agentId: string,
  seatIndex: number,
  standingCount: number,
  footprints: FootprintRect[] = [],
): { x: number; y: number } {
  return standingSlot(venue, agentId, standingCount + seatIndex, footprints);
}

/**
 * Hand out slots to the whole roster in a single pass.
 * Chairs fill up before anyone stands; the roster's order has no effect.
 * footprints is the collision layer from the baked map: standing agents route
 * around furniture (F-14).
 */
export function assignSlots(
  venue: VenueDescriptor,
  agentIds: string[],
  footprints: FootprintRect[] = [],
): Map<string, Slot> {
  // a stable order regardless of the order the roster arrived in
  const ordered = [...agentIds].sort((a, b) => {
    const ha = hashString(a, `order:${venue.id}`);
    const hb = hashString(b, `order:${venue.id}`);
    return ha - hb || (a < b ? -1 : a > b ? 1 : 0);
  });

  const out = new Map<string, Slot>();
  ordered.forEach((id, rank) => {
    if (rank < venue.seats.length) {
      const seat = venue.seats[rank];
      out.set(id, { x: seat.at[0] * T, y: seat.at[1] * T, seatIndex: rank });
    } else {
      const { x, y } = standingSlot(venue, id, rank - venue.seats.length, footprints);
      out.set(id, { x, y, seatIndex: null });
    }
  });
  return out;
}

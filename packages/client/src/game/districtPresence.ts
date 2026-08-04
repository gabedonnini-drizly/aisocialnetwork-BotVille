/**
 * Who the outdoor scene draws, and what it does with everyone else.
 *
 * This is DistrictScene.syncAgents' DECISION, lifted out of the scene so it
 * can be tested without Phaser and pinned by a golden baseline. The scene
 * keeps every EFFECT (creating sprites, walking them to doors, destroying
 * them); this module only says which effect each agent gets.
 *
 * D-62: every question here is asked about A district, never THE district.
 * The scene passes the id it is drawing and the module derives the rest from
 * the registry, so a second district draws its own agents — and only its own
 * — with no code change.
 *
 * Do not import Phaser: the module is tested under node --test.
 */
import { districtForLocation } from './venueRegistry.js';

/** The little a decision needs to know about an agent. */
export interface LocatedAgent {
  id: string;
  location: string;
}

/** What happens to a sprite that is already on the map. */
export type DrawnDecision =
  /** Still here — keep it (and cancel a departure that never completed). */
  | { kind: 'stay'; cancelLeaving: boolean }
  /** Went indoors through a door we can see — walk there, then vanish. */
  | { kind: 'walk-to-door'; venueId: string }
  /** Already walking to a door — leave the departure alone. */
  | { kind: 'leaving' }
  /** Gone with no walk-out: deleted, asleep, or no door to walk to. */
  | { kind: 'remove'; reason: 'deleted' | 'asleep' | 'no-door' };

/** Where a sprite that is NOT yet on the map appears. */
export interface SpawnDecision {
  /** Came out of this venue's door; absent = a spawn point. */
  atDoorOf?: string;
}

export interface SyncPlan<A extends LocatedAgent> {
  /** Everyone this district draws, in roster order. */
  present: A[];
  /** Decision per already-drawn sprite, in sprite order. */
  drawn: Map<string, DrawnDecision>;
  /** Decision per newly appearing agent, in roster order. */
  spawn: Map<string, SpawnDecision>;
}

export interface SyncInputs<A extends LocatedAgent> {
  /** The district being drawn — an outdoor venue id, from the scene's data. */
  districtId: string;
  /** The whole roster PresenceModel placed somewhere (F-3), not just this district's. */
  fullList: readonly A[];
  /**
   * Ids that currently have a sprite, in the order the scene holds them.
   *
   * Any iterable, INCLUDING a single-use one: `planSync` materialises it once
   * before either pass. It is read twice — once to decide each existing
   * sprite's fate, once to know who is already drawn — and the obvious call
   * `drawnIds: this.agentSprites.keys()` hands over a MapIterator that the
   * first pass would exhaust, leaving the second to conclude that nobody is
   * drawn and to spawn a second sprite for every agent, on every 15s tick.
   */
  drawnIds: Iterable<string>;
  /** Where each agent was on the previous sync. */
  lastLoc: ReadonlyMap<string, string>;
  /** Is there a door to that venue on this map? */
  hasDoorFor: (venueId: string) => boolean;
  /** Is this sprite asleep? An asleep agent never walks out. */
  isAsleep: (id: string) => boolean;
  /** Is this sprite already walking to a door? */
  isLeaving: (id: string) => boolean;
  /** Which district draws a location. Injectable so a test can add a second one. */
  resolveDistrict?: (location: string) => string | undefined;
}

/**
 * Does the scene drawing `districtId` draw an agent reported at `location`?
 *
 * This is THE presence filter, and it names no district and no location. An
 * outdoor venue is drawn by itself; that district's client-internal geography
 * is drawn by it too; everything else is somewhere this scene cannot see.
 *
 * The client-internal half is not a detail. 'farm' IS DISTRICT GEOGRAPHY, not
 * a venue and not drift: the pen is drawn on the district map (the cityGrid
 * generator's pen/gate), so an agent at the farm is drawn by that district's
 * scene. The fixture server emits it — agentLife.ts:37 puts 'farm' in the
 * human daytime pool, :38 in the animal pool, and :100 sends EVERY animal to
 * the pen at night. Lose it here and the animals vanish nightly and
 * updateNightBehavior loses its subjects. venueRegistry's
 * CLIENT_INTERNAL_LOCATIONS is the one list that says which district owns it.
 */
export function drawnByDistrict(
  location: string,
  districtId: string,
  resolveDistrict: (location: string) => string | undefined = districtForLocation,
): boolean {
  return resolveDistrict(location) === districtId;
}

/** The whole of syncAgents' branch selection, as data. */
export function planSync<A extends LocatedAgent>(inputs: SyncInputs<A>): SyncPlan<A> {
  const {
    districtId, fullList, drawnIds, lastLoc, hasDoorFor, isAsleep, isLeaving,
    resolveDistrict = districtForLocation,
  } = inputs;
  const drawsHere = (location: string) => drawnByDistrict(location, districtId, resolveDistrict);
  // ONCE: both passes below read it, and a MapIterator survives only the first.
  const spriteIds = [...drawnIds];

  const present = fullList.filter(a => drawsHere(a.location));
  const incoming = new Set(present.map(a => a.id));
  const locOf = new Map(fullList.map(a => [a.id, a.location]));

  const drawn = new Map<string, DrawnDecision>();
  for (const id of spriteIds) {
    if (incoming.has(id)) {
      // came back before reaching the door — the departure is cancelled
      drawn.set(id, { kind: 'stay', cancelLeaving: isLeaving(id) });
      continue;
    }
    const newLoc = locOf.get(id);
    if (newLoc === undefined) { drawn.set(id, { kind: 'remove', reason: 'deleted' }); continue; }
    if (isLeaving(id)) { drawn.set(id, { kind: 'leaving' }); continue; }
    // cosmetics: went into a building — walk to its door and "enter" (incl. at
    // night to the dorm — that is exactly the old going-to-bed visual)
    const hasDoor = hasDoorFor(newLoc);
    const asleep = isAsleep(id);
    if (hasDoor && !asleep) { drawn.set(id, { kind: 'walk-to-door', venueId: newLoc }); continue; }
    // asleep or no door found (incl. an unknown/absent new location) — no walk-out
    drawn.set(id, { kind: 'remove', reason: asleep ? 'asleep' : 'no-door' });
  }

  const alreadyDrawn = new Set(spriteIds);
  const spawn = new Map<string, SpawnDecision>();
  for (const a of present) {
    if (alreadyDrawn.has(a.id)) continue;
    // came out of a building — appears at its door; otherwise at a spawn
    // point. "Somewhere this district draws" covers the district itself AND
    // its farm, neither of which has a door: the old `from !== 'district'`
    // test let the farm through to a door lookup that could never match.
    const from = lastLoc.get(a.id);
    const atDoorOf = from !== undefined && !drawsHere(from) && hasDoorFor(from)
      ? from
      : undefined;
    spawn.set(a.id, atDoorOf === undefined ? {} : { atDoorOf });
  }

  return { present, drawn, spawn };
}

/**
 * Presence: EXACTLY three states (I-3).
 *
 *   venueId present and known    -> somewhere: draw in that venue
 *   venueId === null             -> absent:    don't draw, HUD shows "not here"
 *   venueId present but NOT known -> unknown:  draw nowhere, HUD shows "unknown"
 *
 * That third line is what lets the platform add, rename and remove venues at any
 * time while BotVille never lies about where an agent is. The client does not
 * invent any fourth state.
 *
 * Does not import Phaser: tested under node --test.
 */
import type { AgentPresence, PresenceState } from '@botville/shared';

interface VenueLookup { has(id: string): boolean }

export function resolvePresence(p: AgentPresence, registry: VenueLookup): PresenceState {
  if (p.venueId === null) return { kind: 'absent' };
  if (!registry.has(p.venueId)) return { kind: 'unknown' };
  return { kind: 'somewhere', venueId: p.venueId };
}

export interface PresencePartition {
  /** venue -> who is in it */
  somewhere: Map<string, AgentPresence[]>;
  absent: AgentPresence[];
  unknown: AgentPresence[];
}

export class PresenceModel {
  /** An explicit field: a parameter property does not survive strip-only type stripping. */
  private readonly registry: VenueLookup;

  constructor(registry: VenueLookup) {
    this.registry = registry;
  }

  resolve(p: AgentPresence): PresenceState {
    return resolvePresence(p, this.registry);
  }

  /** Sort the roster into states. Nobody gets lost. */
  partition(roster: AgentPresence[]): PresencePartition {
    const out: PresencePartition = { somewhere: new Map(), absent: [], unknown: [] };
    for (const p of roster) {
      const state = this.resolve(p);
      if (state.kind === 'absent') { out.absent.push(p); continue; }
      if (state.kind === 'unknown') { out.unknown.push(p); continue; }
      const bucket = out.somewhere.get(state.venueId);
      if (bucket) bucket.push(p); else out.somewhere.set(state.venueId, [p]);
    }
    return out;
  }
}

/**
 * `?follow=<agent>` deep-link (Plan 03 Task 3): the platform frontend links
 * `/botville?follow=<username>` ("watch in town"), and the town page forwards
 * the param onto the iframe src. In integrated mode the roster's `spriteSeed`
 * IS the username (shared AgentPresence contract), so the param matches on
 * either `spriteSeed` or `id` — the latter keeps fixture mode addressable too.
 *
 * Does not import Phaser: tested under vitest (packages/client). The bus
 * wiring lives in navigation.ts — this module only owns parse + resolve.
 */

/** The slice of a synced roster row the deep-link needs. */
export interface FollowTarget {
  id: string;
  location: string;
  spriteSeed?: string;
}

/** The raw param, or null when absent/empty. */
export function parseFollowParam(search: string): string | null {
  return new URLSearchParams(search).get('follow') || null;
}

/**
 * One pending follow per page load. Presence loads async, so the followed
 * agent arriving LATER than boot is the normal case: `consume` is called on
 * every roster sync and resolves at the first roster that contains the agent,
 * then never fires again. A key the roster never contains just stays pending —
 * default camera, no error (unknown/absent → default view).
 */
export function createPendingFollow(search: string): {
  consume(roster: readonly FollowTarget[]): FollowTarget | null;
} {
  let key = parseFollowParam(search);
  return {
    consume(roster) {
      if (!key) return null;
      const match = roster.find(a => a.id === key || a.spriteSeed === key);
      if (!match) return null; // not present yet — try again on the next sync
      key = null;
      return match;
    },
  };
}

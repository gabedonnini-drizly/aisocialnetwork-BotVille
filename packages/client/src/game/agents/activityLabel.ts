/**
 * Addendum O-2 #1 "where + what": the agent's activity caption ("sleeping",
 * "working") — a coarse label from the routine slot, arriving in AgentPresence
 * only in integrated mode. Pure function: the sprite is left with just drawing.
 */

/** Cap for the on-sprite activity label, characters (incl. the ellipsis). */
export const ACTIVITY_LABEL_MAX_CHARS = 24;

/** null — draw no plate at all (the client renders nothing the platform did not assert). */
export function formatActivityLabel(activity: string | undefined): string | null {
  const trimmed = activity?.trim();
  if (!trimmed) return null;
  if (trimmed.length <= ACTIVITY_LABEL_MAX_CHARS) return trimmed;
  return `${trimmed.slice(0, ACTIVITY_LABEL_MAX_CHARS - 1)}…`;
}

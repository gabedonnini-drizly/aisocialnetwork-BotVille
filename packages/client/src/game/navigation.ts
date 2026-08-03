import Phaser from 'phaser';
import { GameBridge } from './GameBridge.js';
import { sceneRegistry } from './SceneRegistry.js';
import { sceneKeyFor } from './venueRegistry.js';
import { createPendingFollow, type FollowTarget } from './followParam.js';

/**
 * TZ-16: clicking an agent in the HUD takes you to them.
 * - agent in the current scene — just agent:focus (pan+zoom, as before);
 * - agent in another location — transition to its scene (fade, as through a door),
 *   and after the first syncAgents the new scene aims the camera at the agent.
 * The module is wired up by an import from GameInit (listeners live for the whole game).
 */

/** A scene that can transition to another scene with a fade (the district and interiors). */
interface TransitionCapable extends Phaser.Scene {
  transitionTo(targetScene: string): void;
}

function canTransition(scene: Phaser.Scene | undefined): scene is TransitionCapable {
  return !!scene && typeof (scene as Partial<TransitionCapable>).transitionTo === 'function';
}

let currentSceneKey = 'DistrictScene';
let pendingFocusId: string | null = null;

GameBridge.on('scene:changed', ({ scene }) => { currentSceneKey = scene; });

GameBridge.on('agent:goto', ({ agentId, location }) => {
  // A FOURTH `farm` site, which the plan's three-site anchor missed and the
  // new vocabulary-sync check found: `loc === 'farm' ? 'DistrictScene' : …`.
  // It was unreachable for the same reason as the other three — the api only
  // ever asserts a venueId the published vocabulary vouches for, and `farm`
  // has never been published. sceneKeyFor already sends 'district' to
  // DistrictScene, so the special case bought nothing.
  const targetScene = sceneKeyFor(location);
  if (targetScene === currentSceneKey) {
    pendingFocusId = null;
    GameBridge.emit('agent:focus', { agentId });
    return;
  }
  const active = sceneRegistry.get(currentSceneKey);
  if (!canTransition(active)) return; // the world is still loading — nobody to transition
  pendingFocusId = agentId;
  active.transitionTo(targetScene);
});

/**
 * Scenes call this at the end of syncAgents: if we came here for a specific agent and
 * they are already drawn — aim the camera. The pending focus lives until the first sync.
 */
export function consumePendingFocus(sceneKey: string, hasAgent: (id: string) => boolean): void {
  if (!pendingFocusId || sceneKey !== currentSceneKey) return;
  if (!hasAgent(pendingFocusId)) { pendingFocusId = null; return; } // already gone
  const agentId = pendingFocusId;
  pendingFocusId = null;
  GameBridge.emit('agent:focus', { agentId });
}

// ── ?follow= deep-link (Plan 03 Task 3) ──────────────────────────────────────
// Read once at boot. The first syncAgents whose roster contains the agent
// routes through the SAME agent:goto path as a HUD click (TZ-16): same scene —
// agent:focus pan; another scene — fade transition + pendingFocusId above.
// No parallel camera path.
const pendingFollow = createPendingFollow(
  typeof window !== 'undefined' ? window.location.search : '',
);

/**
 * Scenes call this at the end of syncAgents, right after consumePendingFocus.
 * `fullList` is everyone PresenceModel placed "somewhere" (F-3), so a followed
 * agent that is absent/unknown simply stays pending — default camera until the
 * roster first contains them (presence loads async; arriving later is normal).
 */
export function consumePendingFollow(fullList: readonly FollowTarget[]): void {
  const target = pendingFollow.consume(fullList);
  if (!target) return;
  // Deep-link observability: one line per page load, so a "follow didn't
  // work" report can be split into not-resolved vs not-visible from the
  // browser console alone.
  console.info(`[follow] resolved: centering on ${target.spriteSeed ?? target.id} @ ${target.location}`);
  GameBridge.emit('agent:goto', { agentId: target.id, location: target.location });
}

import Phaser from 'phaser';
import { GameBridge } from './GameBridge.js';
import { sceneRegistry } from './SceneRegistry.js';
import { sceneKeyFor } from './venueRegistry.js';
import type { AgentLocation } from '@botville/shared';

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
  // the farm is drawn on the district map; it has no venue of its own
  const sceneFor = (loc: AgentLocation) => (loc === 'farm' ? 'DistrictScene' : sceneKeyFor(loc));
  const targetScene = sceneFor(location);
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

import Phaser from 'phaser';
import { GameBridge } from './GameBridge.js';
import { sceneRegistry } from './SceneRegistry.js';
import { LOCATION_SCENES } from './config.js';

/**
 * ТЗ-16: клик по агенту в HUD ведёт к нему.
 * - агент в текущей сцене — просто agent:focus (пан+зум, как раньше);
 * - агент в другой локации — переход в её сцену (fade, как через дверь),
 *   и после первого syncAgents новая сцена наводит камеру на агента.
 * Модуль подключается импортом из GameInit (слушатели — на весь срок игры).
 */

/** Сцена, умеющая переходить в другую сцену с fade (район и интерьеры). */
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
  const targetScene = LOCATION_SCENES[location] ?? 'DistrictScene';
  if (targetScene === currentSceneKey) {
    pendingFocusId = null;
    GameBridge.emit('agent:focus', { agentId });
    return;
  }
  const active = sceneRegistry.get(currentSceneKey);
  if (!canTransition(active)) return; // мир ещё грузится — некому переходить
  pendingFocusId = agentId;
  active.transitionTo(targetScene);
});

/**
 * Сцены зовут в конце syncAgents: если сюда шли за конкретным агентом и он
 * уже отрисован — навести камеру. Отложенный фокус живёт до первого синка.
 */
export function consumePendingFocus(sceneKey: string, hasAgent: (id: string) => boolean): void {
  if (!pendingFocusId || sceneKey !== currentSceneKey) return;
  if (!hasAgent(pendingFocusId)) { pendingFocusId = null; return; } // уже ушёл
  const agentId = pendingFocusId;
  pendingFocusId = null;
  GameBridge.emit('agent:focus', { agentId });
}

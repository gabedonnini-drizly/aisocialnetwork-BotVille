import Phaser from 'phaser';

// Typed event map
import type { AgentLocation } from '@botville/shared';

export interface GameEvents {
  'agent:clicked': { agentId: string };
  'agent:focus': { agentId: string };
  /** ТЗ-16: клик в HUD «отведи меня к агенту» — с переходом между сценами. */
  'agent:goto': { agentId: string; location: AgentLocation };
  'agent:moved': { agentId: string; x: number; y: number };
  'task:started': { agentId: string };
  'task:done': { agentId: string };
  'scene:changed': { scene: string };
  'time:changed': { hour: number };
  'dispatch:task': { agentId: string; task: string };
  'dispatch:move': { agentId: string; locationId: string };
}

class TypedBridge extends Phaser.Events.EventEmitter {
  emit<K extends keyof GameEvents>(event: K, payload: GameEvents[K]): boolean {
    return super.emit(event as string, payload);
  }
  on<K extends keyof GameEvents>(event: K, fn: (payload: GameEvents[K]) => void): this {
    return super.on(event as string, fn);
  }
  off<K extends keyof GameEvents>(event: K, fn: (payload: GameEvents[K]) => void): this {
    return super.off(event as string, fn);
  }
}

export const GameBridge = new TypedBridge();

import Phaser from 'phaser';

export interface GameEvents {
  'agent:clicked': { agentId: string };
  'agent:focus': { agentId: string };
  /** TZ-16: the HUD click "take me to the agent" — with a transition between scenes.
   *  F-3: a venue id (string), not the retired six-string AGENT_LOCATIONS union. */
  'agent:goto': { agentId: string; location: string };
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

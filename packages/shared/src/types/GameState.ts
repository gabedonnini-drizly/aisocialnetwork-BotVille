import type { AgentRuntimeState } from './Agent';

export interface WorldState {
  agents: AgentRuntimeState[];
  timestamp: number;
}

export type WSMessageType =
  | 'world:state'
  | 'agent:moved'
  | 'agent:status'
  | 'task:progress'
  | 'task:done'
  | 'error';

export interface WSMessage<T = unknown> {
  type: WSMessageType;
  payload: T;
}

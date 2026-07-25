import type { AgentStatus } from '@botville/shared';

export interface StateMachineContext {
  agentId: string;
  currentStatus: AgentStatus;
  targetX: number;
  targetY: number;
  pathProgress: number;
  idleTimer: number;
  wanderTimer: number;
  onStatusChange: (status: AgentStatus) => void;
  getRandomWalkableTile: () => { x: number; y: number };
  setPathTo: (x: number, y: number) => void;
}

const WANDER_INTERVAL_MIN = 3;
const WANDER_INTERVAL_MAX = 8;
const IDLE_DURATION_MIN = 2;
const IDLE_DURATION_MAX = 6;

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

export class AgentStateMachine {
  private ctx: StateMachineContext;

  constructor(ctx: StateMachineContext) {
    this.ctx = ctx;
    this.ctx.wanderTimer = rand(WANDER_INTERVAL_MIN, WANDER_INTERVAL_MAX);
  }

  update(dt: number): void {
    const { currentStatus } = this.ctx;

    // Task states — don't interrupt
    if (currentStatus === 'task_running' || currentStatus === 'task_done') return;

    switch (currentStatus) {
      case 'idle':
        this.updateIdle(dt);
        break;
      case 'wander':
        this.updateWander(dt);
        break;
      case 'rest':
        this.updateRest(dt);
        break;
      case 'work':
        // Work is driven externally
        break;
    }
  }

  private updateIdle(dt: number) {
    this.ctx.idleTimer -= dt;
    if (this.ctx.idleTimer <= 0) {
      const roll = Math.random();
      if (roll < 0.6) {
        this.transitionTo('wander');
      } else if (roll < 0.8) {
        this.transitionTo('rest');
      } else {
        this.ctx.idleTimer = rand(IDLE_DURATION_MIN, IDLE_DURATION_MAX);
      }
    }
  }

  private updateWander(dt: number) {
    this.ctx.wanderTimer -= dt;
    if (this.ctx.wanderTimer <= 0) {
      const tile = this.ctx.getRandomWalkableTile();
      this.ctx.setPathTo(tile.x, tile.y);
      this.ctx.wanderTimer = rand(WANDER_INTERVAL_MIN, WANDER_INTERVAL_MAX);
    }
  }

  private updateRest(dt: number) {
    this.ctx.idleTimer -= dt;
    if (this.ctx.idleTimer <= 0) {
      this.transitionTo('idle');
    }
  }

  transitionTo(status: AgentStatus): void {
    this.ctx.currentStatus = status;
    if (status === 'idle') this.ctx.idleTimer = rand(IDLE_DURATION_MIN, IDLE_DURATION_MAX);
    if (status === 'rest') this.ctx.idleTimer = rand(4, 10);
    if (status === 'wander') this.ctx.wanderTimer = rand(1, 3);
    this.ctx.onStatusChange(status);
  }

  forceTask(): void {
    this.transitionTo('task_running');
  }

  taskDone(): void {
    this.transitionTo('idle');
  }
}

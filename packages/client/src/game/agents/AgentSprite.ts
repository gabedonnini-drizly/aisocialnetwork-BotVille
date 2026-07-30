import Phaser from 'phaser';
import { AgentStateMachine } from './AgentStateMachine.js';
import { GameBridge } from '../GameBridge.js';
import { NAME_LABEL_DEPTH, WALK_SPEED, WANDER_RADIUS } from '../config.js';
import { onTap } from '../cameraControls.js';
import { UI, UI_HEX } from '../palette.js';
import {
  type AvatarVariantDef,
  type Direction,
  EMOTES,
  animKey,
  getVariant,
} from '../assetManifest.js';
import { EMOTE_FRAMES } from '../assets.generated.js';
import type { AgentStatus } from '@botville/shared';
import { AppearanceResolver, resolvedAnimDef } from './AppearanceResolver.js';

/** A scene that can answer walkability questions (DistrictScene and interiors). */
interface WalkableHost {
  randomWalkableNear(x: number, y: number): { x: number; y: number };
  findPath(fromX: number, fromY: number, toX: number, toY: number): { x: number; y: number }[];
}

function isWalkableHost(scene: Phaser.Scene): scene is Phaser.Scene & WalkableHost {
  return typeof (scene as Partial<WalkableHost>).randomWalkableNear === 'function'
    && typeof (scene as Partial<WalkableHost>).findPath === 'function';
}

/**
 * Agent sprite: a LimeZu premade character or a farm animal.
 * The container stands "on its feet": container (0,0) = the support point, which
 * also drives depth-sorting and collisions (footprint is always 1 tile regardless of frame size).
 */
export class AgentSprite extends Phaser.GameObjects.Container {
  private sprite: Phaser.GameObjects.Sprite;
  private shadow: Phaser.GameObjects.Ellipse;
  private nameLabel: Phaser.GameObjects.Text;
  private emote: Phaser.GameObjects.Sprite;
  private emoteTween: Phaser.Tweens.Tween | null = null;
  private stateMachine: AgentStateMachine;
  private path: { x: number; y: number }[] = [];
  private facing: Direction = 'down';
  /** Compensation for empty pixels below the feet in the frame (manifest footGaps). */
  private targetFootY = 0;
  private sitting = false;
  private seatLock = false;
  private seatKind: 'chair' | 'stool' | 'bed' | null = null;
  private seatDepthBoost = 0;
  /** Sleeping outdoors at night (animals in the pen). */
  private asleep = false;
  /** Heading to a goal (e.g. a seat) — the state machine is paused. */
  private goalLock = false;
  public agentId: string;
  public currentStatus: AgentStatus = 'idle';
  private variantDef: AvatarVariantDef;
  /**
   * The def whose animKey()s are actually registered against the texture
   * on screen: `variantDef` itself when there's no `identity` (legacy path,
   * unchanged), or a human-shaped clone of the resolved texture key when
   * there is (Task 30 review Finding 1 fix — see the constructor and
   * AppearanceResolver.resolvedAnimDef). `variantDef` keeps driving geometry
   * (footGaps, frame size for the shadow/name-label/emote) per the brief's
   * documented "known geometry caveat" — only ANIMATION SELECTION moves.
   */
  private animDef: AvatarVariantDef;

  constructor(
    scene: Phaser.Scene,
    agentId: string,
    name: string,
    avatarVariant: number,
    pixelX: number,
    pixelY: number,
    /** TZ-BotVille: the identity for a derived appearance. Absent — the old path. */
    identity?: { spriteSeed: string; gender: string },
  ) {
    super(scene, pixelX, pixelY);
    this.agentId = agentId;
    // Compatibility: any old numeric variants (0..7 and beyond)
    // map deterministically into the current list via getVariant
    this.variantDef = getVariant(avatarVariant);
    const vd = this.variantDef;
    const spriteH = vd.frameHeight * vd.scale;
    const spriteW = vd.frameWidth * vd.scale;

    // Shadow ellipse under the feet (sized from frame width)
    this.shadow = scene.add.ellipse(0, 0, Math.max(10, spriteW * 0.7), Math.max(4, spriteW * 0.22), 0x000000, 0.3);
    this.shadow.setOrigin(0.5, 0.5);

    // Derived appearance (spec §6): a baked sheet or the fallback human.
    const textureKey = identity
      ? new AppearanceResolver(scene.textures).textureFor(identity.spriteSeed, identity.gender)
      : vd.textureKey;
    // Animations must target whatever texture is ACTUALLY on screen, not
    // vd — otherwise Phaser's sprite.play() switches straight back to the
    // legacy sheet the moment any animation starts (review Finding 1).
    this.animDef = identity ? resolvedAnimDef(textureKey) : vd;

    // Sprite: origin at the feet
    this.sprite = scene.add.sprite(0, 0, textureKey, 0);
    this.sprite.setOrigin(0.5, 1);
    this.sprite.setScale(vd.scale);
    this.sprite.setInteractive({ useHandCursor: true });

    // Name — above the head, accounting for sprite height. NOT in the container:
    // the label is drawn above props-above (tree crowns), even when
    // the sprite itself is hidden by a crown.
    // Name: warm cream text with a thin dark stroke — readable over
    // busy tiles both by day and in the night glow (TZ-06 palette, mirror of ui/theme.css).
    this.nameLabel = scene.add.text(pixelX, pixelY - spriteH - 6, name, {
      fontSize: '7px',
      color: UI.textOnDark,
      fontFamily: 'monospace',
      stroke: UI.ink900,
      strokeThickness: 3,
    }).setOrigin(0.5, 1).setDepth(NAME_LABEL_DEPTH);

    // Emote/status: a bubble or icon above the head (higher for a cow than a human)
    this.emote = scene.add.sprite(0, -spriteH - 16, EMOTES.think.textureKey, 0);
    this.emote.setOrigin(0.5, 1);
    this.emote.setVisible(false);

    this.add([this.shadow, this.sprite, this.emote]);
    scene.add.existing(this);
    this.setDepth(pixelY); // Y-sort by the feet

    this.playAnim('idle', 'down');

    onTap(this.sprite, () => {
      // clicking a sleeper wakes them (the chat still opens as usual)
      if (this.asleep) this.wakeUp();
      GameBridge.emit('agent:clicked', { agentId });
    });
    this.sprite.on('pointerover', () => this.sprite.setTint(UI_HEX.hoverTint));
    this.sprite.on('pointerout', () => this.sprite.clearTint());

    this.stateMachine = new AgentStateMachine({
      agentId,
      currentStatus: 'idle',
      targetX: pixelX,
      targetY: pixelY,
      pathProgress: 0,
      idleTimer: 1 + Math.random() * 3,
      wanderTimer: 2 + Math.random() * 4,
      onStatusChange: (s) => this.onStatusChange(s),
      getRandomWalkableTile: () => {
        if (isWalkableHost(scene)) return scene.randomWalkableNear(this.x, this.y);
        return {
          x: this.x + (Math.random() - 0.5) * WANDER_RADIUS,
          y: this.y + (Math.random() - 0.5) * WANDER_RADIUS * 0.75,
        };
      },
      setPathTo: (x, y) => {
        if (isWalkableHost(scene)) {
          this.path = scene.findPath(this.x, this.y, x, y);
        } else {
          this.path = [{ x, y }];
        }
      },
    });

    GameBridge.on('dispatch:task', this.onDispatchTask);
  }

  private onDispatchTask = ({ agentId: id }: { agentId: string }) => {
    if (id === this.agentId) {
      this.wakeUp(); // a task rouses even a sleeper/someone gone to the dorm
      this.startTask();
    }
  };

  private playAnim(type: 'idle' | 'walk', dir: Direction) {
    this.sprite.play(animKey(this.animDef, type, dir), true);
    // feet on the ground: in animals' side views the frame bottom doesn't match the feet
    this.targetFootY = (this.variantDef.footGaps?.[dir] ?? 0) * this.variantDef.scale;
  }

  /**
   * Seat the agent (interiors): kind='chair'|'stool' — sit animation in
   * profile view, kind='bed' — sleep. Animals can do neither —
   * they play idle facing the right way.
   */
  sit(side: 'right' | 'left' = 'right', kind: 'chair' | 'stool' | 'bed' = 'chair') {
    this.sitting = true;
    this.path = [];
    if (kind === 'bed' && this.animDef.rows.sleep !== undefined) {
      this.sprite.play(animKey(this.animDef, 'sleep'), true);
    } else if (kind !== 'bed' && this.animDef.rows.sit !== undefined) {
      this.sprite.play(animKey(this.animDef, side === 'right' ? 'sit-right' : 'sit-left'), true);
    } else {
      this.playAnim('idle', side === 'right' ? 'right' : 'left');
    }
  }

  standUp() {
    this.sitting = false;
    this.playAnim('idle', this.facing);
  }

  /**
   * Pin the agent to a seat (chair/bed in an interior): teleport to the point,
   * sit down and pause the state machine until released.
   */
  takeSeat(x: number, y: number, side: 'right' | 'left', kind: 'chair' | 'stool' | 'bed') {
    this.seatLock = true;
    this.seatKind = kind;
    // a sitting/lying agent is drawn above their furniture (bed/armchair)
    this.seatDepthBoost = kind === 'bed' ? 30 : 24;
    this.path = [];
    this.setPosition(x, y);
    this.sit(side, kind);
    this.hideEmote();
  }

  releaseSeat() {
    this.seatLock = false;
    this.seatKind = null;
    this.seatDepthBoost = 0;
    this.standUp();
  }

  get isSeated() { return this.seatLock; }

  get currentSeatKind() { return this.seatKind; }

  get hasPath() { return this.path.length > 0; }

  get isAnimal() { return this.variantDef.kind === 'animal'; }

  /** Deliberately walk to a point (wandering is paused until arrival). */
  walkTo(x: number, y: number) {
    if (this.sitting) this.standUp();
    const scene = this.scene;
    this.path = isWalkableHost(scene) ? scene.findPath(this.x, this.y, x, y) : [{ x, y }];
    this.goalLock = this.path.length > 0;
  }

  /** Drop the goal route (e.g. on waking up or a new task). */
  cancelGoal() {
    this.path = [];
    this.goalLock = false;
  }

  // ------------------------------------------------------------- night sleep

  /** Sleeping under the open sky (animals in the pen): idle pose + Z icon. */
  sleepOutside() {
    this.asleep = true;
    this.cancelGoal();
    this.playAnim('idle', 'down');
    this.showIcon('rest');
  }

  /** Wake up / come outside: clears night sleep. */
  wakeUp() {
    if (this.asleep) {
      this.asleep = false;
      this.hideEmote();
      this.playAnim('idle', 'down');
    }
    this.cancelGoal();
  }

  get isAsleep() { return this.asleep; }

  // ---------------------------------------------------------------- emotes

  private showThinkBubble() {
    this.hideEmote();
    this.emote.setTexture(EMOTES.think.textureKey, 0);
    this.emote.setVisible(true);
    this.emote.play('emote-think-appear');
    this.emote.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      if (this.emote.visible && this.currentStatus === 'task_running') {
        this.emote.play('emote-think-loop');
      }
    });
  }

  private showIcon(status: string) {
    const pair = EMOTE_FRAMES[status];
    if (!pair) { this.hideEmote(); return; }
    this.hideEmote();
    this.emote.setTexture(EMOTES.icons.textureKey, pair[0]);
    this.emote.setVisible(true);
    this.emote.play(`emote-icon-${status}`);
    // a gentle bob tween
    const baseY = -this.variantDef.frameHeight * this.variantDef.scale - 16;
    this.emoteTween = this.scene.tweens.add({
      targets: this.emote,
      y: baseY - 3,
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private hideEmote() {
    this.emoteTween?.destroy();
    this.emoteTween = null;
    this.emote.stop();
    this.emote.setVisible(false);
    this.emote.y = -this.variantDef.frameHeight * this.variantDef.scale - 16;
  }

  // ---------------------------------------------------------------- update

  update(dt: number) {
    if (!this.seatLock && !this.asleep) {
      if (this.goalLock) {
        this.moveAlongPath(dt);
        if (!this.path.length) this.goalLock = false;
      } else {
        this.stateMachine.update(dt);
        if (!this.sitting) this.moveAlongPath(dt);
      }
    }
    // smoothly ease the sprite towards its target foot offset (no jump when turning)
    if (this.sprite.y !== this.targetFootY) {
      const d = this.targetFootY - this.sprite.y;
      this.sprite.y = Math.abs(d) < 0.5 ? this.targetFootY : this.sprite.y + d * Math.min(1, dt * 10);
    }
    this.setDepth(this.y + this.seatDepthBoost); // Y-sort by the support point
    this.nameLabel.setPosition(
      this.x,
      this.y - this.variantDef.frameHeight * this.variantDef.scale - 6,
    );
  }

  private moveAlongPath(dt: number) {
    if (!this.path.length) return;
    const target = this.path[0];
    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 3) {
      this.path.shift();
      if (!this.path.length) this.playAnim('idle', this.facing);
      return;
    }

    const speed = WALK_SPEED * dt;
    this.x += (dx / dist) * speed;
    this.y += (dy / dist) * speed;

    if (Math.abs(dx) > Math.abs(dy)) {
      this.facing = dx > 0 ? 'right' : 'left';
    } else {
      this.facing = dy > 0 ? 'down' : 'up';
    }
    this.playAnim('walk', this.facing);
  }

  private onStatusChange(status: AgentStatus) {
    this.currentStatus = status;

    switch (status) {
      case 'task_running':
        // waiting on the LLM — the animated "thinking" bubble from the pack
        this.showThinkBubble();
        break;
      case 'work':
      case 'task_done':
      case 'chat_npc':
        this.showIcon(status);
        break;
      case 'rest':
        // no icon: Z is reserved for night sleep (sleepOutside);
        // a daytime break reads from the sit animation itself
        this.hideEmote();
        break;
      default:
        this.hideEmote();
    }

    if (status === 'rest') {
      // resting: humans sit down (sit row), animals — idle
      this.sit(Math.random() < 0.5 ? 'right' : 'left');
    } else if (this.sitting) {
      this.standUp();
    }
  }

  startTask() { this.stateMachine.forceTask(); }
  finishTask() { this.stateMachine.taskDone(); }

  destroy(fromScene?: boolean) {
    GameBridge.off('dispatch:task', this.onDispatchTask);
    this.emoteTween?.destroy();
    this.nameLabel.destroy();
    super.destroy(fromScene);
  }
}

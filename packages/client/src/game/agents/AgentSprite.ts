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
import type { AgentStatus } from '@botville/shared';

/** Сцена, умеющая отвечать на вопросы проходимости (DistrictScene и интерьеры). */
interface WalkableHost {
  randomWalkableNear(x: number, y: number): { x: number; y: number };
  findPath(fromX: number, fromY: number, toX: number, toY: number): { x: number; y: number }[];
}

function isWalkableHost(scene: Phaser.Scene): scene is Phaser.Scene & WalkableHost {
  return typeof (scene as Partial<WalkableHost>).randomWalkableNear === 'function'
    && typeof (scene as Partial<WalkableHost>).findPath === 'function';
}

/**
 * Спрайт агента: LimeZu premade-персонаж или фермерское животное.
 * Контейнер стоит «на ногах»: (0,0) контейнера = точка опоры, по ней же
 * depth-sort и коллизии (footprint всегда 1 тайл независимо от размера кадра).
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
  /** Компенсация пустых пикселей под ногами в кадре (footGaps манифеста). */
  private targetFootY = 0;
  private sitting = false;
  private seatLock = false;
  private seatKind: 'chair' | 'stool' | 'bed' | null = null;
  private seatDepthBoost = 0;
  /** Ночной сон под открытым небом (животные в загоне). */
  private asleep = false;
  /** Агент «внутри здания» (ночь в дорме): спрайт скрыт, логика на паузе. */
  private hiddenInside = false;
  /** Идёт к цели (например, к месту) — машина состояний на паузе. */
  private goalLock = false;
  public agentId: string;
  public currentStatus: AgentStatus = 'idle';
  private variantDef: AvatarVariantDef;

  constructor(
    scene: Phaser.Scene,
    agentId: string,
    name: string,
    avatarVariant: number,
    pixelX: number,
    pixelY: number,
  ) {
    super(scene, pixelX, pixelY);
    this.agentId = agentId;
    // Совместимость: любые старые числовые варианты (0..7 и дальше)
    // детерминированно маппятся в текущий список через getVariant
    this.variantDef = getVariant(avatarVariant);
    const vd = this.variantDef;
    const spriteH = vd.frameHeight * vd.scale;
    const spriteW = vd.frameWidth * vd.scale;

    // Тень-эллипс под ногами (размер от ширины кадра)
    this.shadow = scene.add.ellipse(0, 0, Math.max(10, spriteW * 0.7), Math.max(4, spriteW * 0.22), 0x000000, 0.3);
    this.shadow.setOrigin(0.5, 0.5);

    // Спрайт: origin по ногам
    this.sprite = scene.add.sprite(0, 0, vd.textureKey, 0);
    this.sprite.setOrigin(0.5, 1);
    this.sprite.setScale(vd.scale);
    this.sprite.setInteractive({ useHandCursor: true });

    // Имя — над головой, с учётом высоты спрайта. НЕ в контейнере:
    // плашка рисуется поверх props-above (крон деревьев), даже когда
    // сам спрайт скрыт кроной.
    // Имя: тёплый кремовый текст с тонкой тёмной обводкой — читаемо поверх
    // пёстрых тайлов и днём, и в ночном глоу (палитра ТЗ-06, ui/theme.css зеркало).
    this.nameLabel = scene.add.text(pixelX, pixelY - spriteH - 6, name, {
      fontSize: '7px',
      color: UI.textOnDark,
      fontFamily: 'monospace',
      stroke: UI.ink900,
      strokeThickness: 3,
    }).setOrigin(0.5, 1).setDepth(NAME_LABEL_DEPTH);

    // Эмоция/статус: пузырь или иконка над головой (у коровы выше, чем у человека)
    this.emote = scene.add.sprite(0, -spriteH - 16, EMOTES.think.textureKey, 0);
    this.emote.setOrigin(0.5, 1);
    this.emote.setVisible(false);

    this.add([this.shadow, this.sprite, this.emote]);
    scene.add.existing(this);
    this.setDepth(pixelY); // Y-sort по ногам

    this.playAnim('idle', 'down');

    onTap(this.sprite, () => {
      // клик по спящему будит (чат при этом открывается как обычно)
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
      this.wakeUp(); // задача поднимает даже спящего/ушедшего в дорм
      this.startTask();
    }
  };

  private playAnim(type: 'idle' | 'walk', dir: Direction) {
    this.sprite.play(animKey(this.variantDef, type, dir), true);
    // ноги на землю: у боковых видов животных низ кадра не совпадает с ногами
    this.targetFootY = (this.variantDef.footGaps?.[dir] ?? 0) * this.variantDef.scale;
  }

  /**
   * Посадить агента (интерьеры): kind='chair'|'stool' — sit-анимация в
   * профиль, kind='bed' — sleep. Животные ни того ни другого не умеют —
   * играют idle в нужную сторону.
   */
  sit(side: 'right' | 'left' = 'right', kind: 'chair' | 'stool' | 'bed' = 'chair') {
    this.sitting = true;
    this.path = [];
    if (kind === 'bed' && this.variantDef.rows.sleep !== undefined) {
      this.sprite.play(animKey(this.variantDef, 'sleep'), true);
    } else if (kind !== 'bed' && this.variantDef.rows.sit !== undefined) {
      this.sprite.play(animKey(this.variantDef, side === 'right' ? 'sit-right' : 'sit-left'), true);
    } else {
      this.playAnim('idle', side === 'right' ? 'right' : 'left');
    }
  }

  standUp() {
    this.sitting = false;
    this.playAnim('idle', this.facing);
  }

  /**
   * Закрепить агента на месте (стул/кровать в интерьере): телепорт к точке,
   * посадка и пауза машины состояний до снятия.
   */
  takeSeat(x: number, y: number, side: 'right' | 'left', kind: 'chair' | 'stool' | 'bed') {
    this.seatLock = true;
    this.seatKind = kind;
    // сидящий/лежащий агент рисуется поверх своей мебели (кровати/кресла)
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

  /** Целенаправленно идти к точке (блуждание на паузе, пока не дойдёт). */
  walkTo(x: number, y: number) {
    if (this.sitting) this.standUp();
    const scene = this.scene;
    this.path = isWalkableHost(scene) ? scene.findPath(this.x, this.y, x, y) : [{ x, y }];
    this.goalLock = this.path.length > 0;
  }

  /** Сбросить целевой маршрут (например, при пробуждении или новой задаче). */
  cancelGoal() {
    this.path = [];
    this.goalLock = false;
  }

  // ------------------------------------------------------------- ночной сон

  /** Сон под открытым небом (животные в загоне): idle-поза + Z-иконка. */
  sleepOutside() {
    this.asleep = true;
    this.cancelGoal();
    this.playAnim('idle', 'down');
    this.showIcon('rest');
  }

  /** Скрыть агента «внутри здания» (ночёвка в дорме с улицы). */
  hideInside() {
    this.hiddenInside = true;
    this.cancelGoal();
    this.setVisible(false);
    this.nameLabel.setVisible(false);
  }

  /** Проснуться/выйти наружу: снимает и сон, и «внутри здания». */
  wakeUp() {
    if (this.asleep) {
      this.asleep = false;
      this.hideEmote();
      this.playAnim('idle', 'down');
    }
    if (this.hiddenInside) {
      this.hiddenInside = false;
      this.setVisible(true);
      this.nameLabel.setVisible(true);
    }
    this.cancelGoal();
  }

  get isAsleep() { return this.asleep; }

  get isHiddenInside() { return this.hiddenInside; }

  // ---------------------------------------------------------------- эмоции

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
    const pair = EMOTES.icons.byStatus[status];
    if (!pair) { this.hideEmote(); return; }
    this.hideEmote();
    this.emote.setTexture(EMOTES.icons.textureKey, pair[0]);
    this.emote.setVisible(true);
    this.emote.play(`emote-icon-${status}`);
    // лёгкий bob-tween
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
    if (!this.seatLock && !this.asleep && !this.hiddenInside) {
      if (this.goalLock) {
        this.moveAlongPath(dt);
        if (!this.path.length) this.goalLock = false;
      } else {
        this.stateMachine.update(dt);
        if (!this.sitting) this.moveAlongPath(dt);
      }
    }
    // плавно подводим спрайт к целевому foot-оффсету (без скачка при повороте)
    if (this.sprite.y !== this.targetFootY) {
      const d = this.targetFootY - this.sprite.y;
      this.sprite.y = Math.abs(d) < 0.5 ? this.targetFootY : this.sprite.y + d * Math.min(1, dt * 10);
    }
    this.setDepth(this.y + this.seatDepthBoost); // Y-sort по точке опоры
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
        // ждём LLM — анимированный пузырь «думает» из пака
        this.showThinkBubble();
        break;
      case 'work':
      case 'task_done':
      case 'chat_npc':
        this.showIcon(status);
        break;
      case 'rest':
        // без иконки: Z зарезервирован для ночного сна (sleepOutside),
        // дневная передышка читается по самой sit-анимации
        this.hideEmote();
        break;
      default:
        this.hideEmote();
    }

    if (status === 'rest') {
      // отдых: люди присаживаются (sit-ряд), животные — idle
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

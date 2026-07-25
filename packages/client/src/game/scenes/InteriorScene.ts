import Phaser from 'phaser';
import { AgentSprite } from '../agents/AgentSprite.js';
import { GameBridge } from '../GameBridge.js';
import { sceneRegistry } from '../SceneRegistry.js';
import { Pathfinder } from '../Pathfinder.js';
import { CAMERA_FOCUS, INTERIOR_CAMERA_ZOOM, INTERIOR_TILESET, NIGHT_SCHEDULE, SCENE_FADE_MS } from '../config.js';
import { attachCameraControls, onTap } from '../cameraControls.js';
import { ANIMATED_OBJECTS, getVariant } from '../assetManifest.js';
import { GameTime } from '../time.js';
import { isSleepTime } from '../dayNight.js';
import { consumePendingFocus } from '../navigation.js';
import type { SyncedAgent } from '../../hooks/useGameSync.js';
import type { AgentLocation } from '@botville/shared';

interface Seat {
  x: number;
  y: number;
  side: 'right' | 'left';
  kind: 'chair' | 'stool' | 'bed';
  occupiedBy: string | null;
}

interface TiledProps { [k: string]: string | number | boolean }

function propsOf(o: Phaser.Types.Tilemaps.TiledObject): TiledProps {
  const out: TiledProps = {};
  for (const p of (o.properties as Array<{ name: string; value: string | number | boolean }> | undefined) ?? []) {
    out[p.name] = p.value;
  }
  return out;
}

/**
 * Базовая сцена интерьера: комната из TMJ (scripts/build-interiors.mjs),
 * места с занятостью (два агента на один стул не сядут), заметная
 * дверь-выход (коврик с hover-подсветкой), анимированные объекты.
 *
 * ТЗ-16: сцена рисует ТОЛЬКО агентов, чей серверный location — это здание.
 * Пустая комната — нормально. Вход игрока на агентов больше не влияет.
 */
export class InteriorScene extends Phaser.Scene {
  protected agentSprites: Map<string, AgentSprite> = new Map();
  private seats: Seat[] = [];
  private pathfinder!: Pathfinder;
  private spawnPoint = { x: 160, y: 200 };
  /** агент -> место, к которому он идёт */
  private pendingSeat: Map<string, Seat> = new Map();
  /** агент в кровати -> личный час пробуждения (7:00-9:00). */
  private bedWakeHours: Map<string, number> = new Map();
  private roomW = 320;
  private roomH = 240;
  private transitioning = false;

  constructor(
    private sceneKey: string,
    private mapKey: string,
    /** Локация этого здания в терминах сервера (ТЗ-16): кто здесь — тех и рисуем. */
    private locationId: AgentLocation,
  ) {
    super({ key: sceneKey });
  }

  create() {
    sceneRegistry.register(this.sceneKey, this);
    this.transitioning = false;
    this.cameras.main.fadeIn(SCENE_FADE_MS, 0, 0, 0);

    const map = this.make.tilemap({ key: this.mapKey });
    const tileset = map.addTilesetImage(INTERIOR_TILESET, INTERIOR_TILESET)!;
    map.createLayer('ground', tileset, 0, 0)!.setDepth(0);
    this.roomW = map.widthInPixels;
    this.roomH = map.heightInPixels;

    // мебель (Y-sort по нижней кромке); коврик — с подсветкой выхода
    let doormat: Phaser.GameObjects.Image | null = null;
    for (const o of map.getObjectLayer('furniture')?.objects ?? []) {
      const img = this.add.image(o.x!, o.y!, o.name).setOrigin(0, 0);
      img.setDepth(propsOf(o).doormat ? 1 : o.y! + (o.height ?? img.height));
      if (propsOf(o).doormat) doormat = img;
    }

    // анимированные объекты
    for (const o of map.getObjectLayer('animated')?.objects ?? []) {
      const def = ANIMATED_OBJECTS[o.name];
      if (!def) continue;
      const spr = this.add.sprite(o.x!, o.y!, `anim-${o.name}`, 0).setOrigin(0, 0);
      spr.setDepth(o.y! + def.frameHeight);
      spr.play(`anim-${o.name}`);
    }

    // места
    this.seats = (map.getObjectLayer('seats')?.objects ?? []).map(o => {
      const p = propsOf(o);
      return {
        x: o.x!, y: o.y!,
        side: (p.side as 'right' | 'left') ?? 'right',
        kind: (p.kind as Seat['kind']) ?? 'chair',
        occupiedBy: null,
      };
    });

    // выход: зона над ковриком, hover подсвечивает коврик
    for (const o of map.getObjectLayer('doors')?.objects ?? []) {
      const p = propsOf(o);
      if (typeof p.targetScene !== 'string') continue;
      const target = p.targetScene;
      const zone = this.add.zone(o.x! + o.width! / 2, o.y! + o.height! / 2, o.width!, o.height!)
        .setInteractive({ useHandCursor: true });
      zone.on('pointerover', () => doormat?.setTint(0xaaffaa));
      zone.on('pointerout', () => doormat?.clearTint());
      onTap(zone, () => this.transitionTo(target));
    }

    // спавн и проходимость
    const sp = map.getObjectLayer('spawns')?.objects?.[0];
    if (sp) this.spawnPoint = { x: sp.x!, y: sp.y! };
    this.pathfinder = new Pathfinder(map.width, map.height);
    for (const o of map.getObjectLayer('collision')?.objects ?? []) {
      this.pathfinder.blockRect(o.x!, o.y!, o.width!, o.height!);
    }

    // камера: комната целиком по центру, зум по размеру вьюпорта
    const cam = this.cameras.main;
    const fitZoom = Math.min(this.scale.width / this.roomW, this.scale.height / this.roomH);
    cam.setZoom(Phaser.Math.Clamp(fitZoom, 1.5, INTERIOR_CAMERA_ZOOM + 1));
    cam.centerOn(this.roomW / 2, this.roomH / 2);
    cam.setBackgroundColor('#0a0a14');
    // на телефоне комната шире вьюпорта: пан/пинч (ТЗ-09); влезает целиком —
    // кламп держит её по центру и управление камеру просто не двигает
    attachCameraControls(this, {
      minZoom: cam.zoom,
      bounds: { width: this.roomW, height: this.roomH },
    });

    // клик по спящему в кровати будит его (профиль/чат при этом открываются)
    const onAgentClicked = ({ agentId }: { agentId: string }) => {
      const sprite = this.agentSprites.get(agentId);
      if (sprite?.isSeated && sprite.currentSeatKind === 'bed') this.wakeFromBed(agentId);
    };
    GameBridge.on('agent:clicked', onAgentClicked);

    // клик по агенту в HUD — камера наезжает на него и в интерьере (ТЗ-16)
    const onFocusAgent = ({ agentId }: { agentId: string }) => {
      const sprite = this.agentSprites.get(agentId);
      if (!sprite) return;
      this.cameras.main.pan(sprite.x, sprite.y, CAMERA_FOCUS.panMs, 'Sine.easeInOut');
    };
    GameBridge.on('agent:focus', onFocusAgent);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      GameBridge.off('agent:clicked', onAgentClicked);
      GameBridge.off('agent:focus', onFocusAgent);
      sceneRegistry.unregister(this.sceneKey);
      // уход из локации = все места свободны (спрайты уничтожаются сценой)
      this.agentSprites.clear();
      this.pendingSeat.clear();
      this.bedWakeHours.clear();
      this.seats.forEach(s => { s.occupiedBy = null; });
    });

    GameBridge.emit('scene:changed', { scene: this.sceneKey });
  }

  // ------- интерфейс проходимости для AgentSprite
  randomWalkableNear(x: number, y: number): { x: number; y: number } {
    return this.pathfinder.randomWalkableNear(x, y, 80);
  }

  findPath(fromX: number, fromY: number, toX: number, toY: number) {
    return this.pathfinder.findPath(fromX, fromY, toX, toY);
  }

  update(_time: number, delta: number) {
    const dt = delta / 1000;
    const hour = GameTime.hour;
    this.agentSprites.forEach(a => {
      a.update(dt);
      // дошёл до места — садится
      const seat = this.pendingSeat.get(a.agentId);
      if (seat && !a.isSeated) {
        const dist = Math.hypot(a.x - seat.x, a.y - seat.y);
        if (dist < 20 || !a.hasPath) {
          a.takeSeat(seat.x, seat.y, seat.side, seat.kind);
          this.pendingSeat.delete(a.agentId);
          if (seat.kind === 'bed') {
            this.bedWakeHours.set(a.agentId,
              NIGHT_SCHEDULE.wakeStart + Math.random() * (NIGHT_SCHEDULE.wakeEnd - NIGHT_SCHEDULE.wakeStart));
          }
        }
      }
      // утро: спящие в кроватях встают каждый в свой час
      if (a.isSeated && a.currentSeatKind === 'bed' && !isSleepTime(hour)) {
        const wakeAt = this.bedWakeHours.get(a.agentId) ?? NIGHT_SCHEDULE.wakeStart;
        if (hour >= wakeAt && hour < NIGHT_SCHEDULE.sleepStart) this.wakeFromBed(a.agentId);
      }
    });
  }

  /** Поднять агента из кровати: место освобождается, агент гуляет по комнате. */
  private wakeFromBed(agentId: string) {
    const sprite = this.agentSprites.get(agentId);
    if (!sprite) return;
    this.releaseSeatOf(agentId);
    this.bedWakeHours.delete(agentId);
    sprite.releaseSeat();
  }

  /** Переход в другую сцену с fade (дверь-коврик и agent:goto из HUD). */
  transitionTo(target: string) {
    if (this.transitioning) return;
    this.transitioning = true;
    this.cameras.main.fadeOut(SCENE_FADE_MS, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start(target);
      GameBridge.emit('scene:changed', { scene: target });
    });
  }

  syncAgents(fullList: SyncedAgent[]) {
    // ГЛАВНЫЙ ФИКС ТЗ-16: рисуем только тех, кто по серверу реально в этом
    // здании — а не всех агентов юзера в точке входа, как раньше.
    const agentList = fullList.filter(a => a.location === this.locationId);
    const incoming = new Set(agentList.map(a => a.id));
    this.agentSprites.forEach((sprite, id) => {
      if (!incoming.has(id)) {
        this.releaseSeatOf(id);
        this.pendingSeat.delete(id);
        sprite.destroy();
        this.agentSprites.delete(id);
      }
    });
    agentList.forEach((a, i) => {
      if (this.agentSprites.has(a.id)) return;
      const x = this.spawnPoint.x + (i % 3) * 14 - 14;
      const y = this.spawnPoint.y;
      const sprite = new AgentSprite(this, a.id, a.name, a.avatarVariant, x, y);
      this.agentSprites.set(a.id, sprite);
      // агент занимает свободное место; животные на кровати не забираются.
      // Люди ночью предпочитают кровати (кончились — кресла), днём — наоборот.
      const isAnimal = getVariant(a.avatarVariant).kind === 'animal';
      const wantBed = !isAnimal && isSleepTime(GameTime.hour);
      const preferred = this.seats.find(s => !s.occupiedBy
        && (isAnimal ? s.kind !== 'bed' : (wantBed ? s.kind === 'bed' : s.kind !== 'bed')));
      const seat = preferred
        ?? this.seats.find(s => !s.occupiedBy && (!isAnimal || s.kind !== 'bed'));
      if (seat) {
        seat.occupiedBy = a.id;
        this.pendingSeat.set(a.id, seat);
        sprite.walkTo(seat.x, seat.y);
      }
    });

    // сюда шли за конкретным агентом из HUD — навести камеру (ТЗ-16)
    consumePendingFocus(this.sceneKey, id => this.agentSprites.has(id));
  }

  private releaseSeatOf(agentId: string) {
    const seat = this.seats.find(s => s.occupiedBy === agentId);
    if (seat) seat.occupiedBy = null;
  }
}

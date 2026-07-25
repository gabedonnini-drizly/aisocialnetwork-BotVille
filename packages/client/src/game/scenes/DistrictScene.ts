import Phaser from 'phaser';
import { AgentSprite } from '../agents/AgentSprite.js';
import { GameBridge } from '../GameBridge.js';
import { sceneRegistry } from '../SceneRegistry.js';
import { Pathfinder } from '../Pathfinder.js';
import {
  AMBIENT_CAR, CAMERA, CAMERA_FOCUS, DISTRICT, GLOW_DEPTH, GLOW_KINDS,
  GLOW_TEXTURE, LEAVE_WALK_TIMEOUT_MS, LOCATION_SCENES, NIGHT_SCHEDULE,
  SCENE_FADE_MS, TINT_OVERLAY_DEPTH, WANDER_RADIUS, type GlowKind,
} from '../config.js';
import { attachCameraControls, onTap } from '../cameraControls.js';
import { GameTime } from '../time.js';
import { isSleepTime, nightIntensity, tintAt } from '../dayNight.js';
import { ensureGlowTexture } from '../glowTexture.js';
import { useUIStore } from '../../store/agentStore.js';
import { consumePendingFocus } from '../navigation.js';
import type { SyncedAgent } from '../../hooks/useGameSync.js';
import type { AgentLocation } from '@botville/shared';

/**
 * Ночная фаза агента в районе. С ТЗ-16 — ТОЛЬКО косметика животных (загон, Z,
 * пробуждение кликом): куда уходят люди ночью, решает сервер через location,
 * а их путь к двери дорма рисует механика leaving (см. syncAgents).
 */
interface NightState {
  mode: 'none' | 'toPen' | 'asleep';
  /** Личный час пробуждения из [wakeStart, wakeEnd). */
  wakeHour?: number;
  /** Разбужен кликом: не укладывать до этого часа (может быть >24). */
  snoozeUntil?: number;
  spot?: { x: number; y: number; occupiedBy: string | null };
}

/** Косметика ухода в здание: агент дошагивает до двери и «входит» (ТЗ-16). */
interface LeavingState {
  x: number;
  y: number;
  deadline: number;
}

interface TiledProps { [k: string]: string | number | boolean }

function propsOf(o: Phaser.Types.Tilemaps.TiledObject): TiledProps {
  const out: TiledProps = {};
  for (const p of (o.properties as Array<{ name: string; value: string | number | boolean }> | undefined) ?? []) {
    out[p.name] = p.value;
  }
  return out;
}

export class DistrictScene extends Phaser.Scene {
  private agentSprites: Map<string, AgentSprite> = new Map();
  private pathfinder!: Pathfinder;
  private spawnPoints: { x: number; y: number }[] = [];
  private buildingImages: Map<string, Phaser.GameObjects.Image> = new Map();
  private tintOverlay!: Phaser.GameObjects.Rectangle;
  private glowSprites: Phaser.GameObjects.Image[] = [];
  /** Точки у дверей зданий (стоянка перед входом), ключ — targetScene. */
  private doorPoints: Map<string, { x: number; y: number }> = new Map();
  private penSpots: { x: number; y: number; occupiedBy: string | null }[] = [];
  private nightStates: Map<string, NightState> = new Map();
  /** Агенты, дошагивающие до двери здания перед исчезновением (ТЗ-16). */
  private leaving: Map<string, LeavingState> = new Map();
  /** Последний известный location каждого агента — для спавна у нужной двери. */
  private lastLoc: Map<string, AgentLocation> = new Map();
  private nightAcc = 0;
  private transitioning = false;
  private cars: { obj: Phaser.GameObjects.Container; vx: number; vy: number; glows: Phaser.GameObjects.Image[]; h: number }[] = [];
  private carTimer = 0;

  constructor() { super({ key: 'DistrictScene' }); }

  create() {
    sceneRegistry.register('DistrictScene', this);
    this.transitioning = false;
    this.carTimer = AMBIENT_CAR.firstDelaySec + Math.random() * AMBIENT_CAR.firstDelaySec;
    this.cameras.main.fadeIn(SCENE_FADE_MS, 0, 0, 0);

    const map = this.make.tilemap({ key: DISTRICT.mapKey });
    const tileset = map.addTilesetImage(DISTRICT.tilesetName, DISTRICT.tilesetName)!;
    map.createLayer('ground', tileset, 0, 0)!.setDepth(0);
    map.createLayer('roads', tileset, 0, 0)!.setDepth(1);

    // --- объекты-декали под агентами (грядки, урожай)
    for (const o of map.getObjectLayer('props-below')?.objects ?? []) {
      this.add.image(o.x!, o.y!, o.name).setOrigin(0, 0).setDepth(2);
    }

    // --- здания: интерактивные фасады с hover-подсветкой
    for (const o of map.getObjectLayer('buildings')?.objects ?? []) {
      const p = propsOf(o);
      const img = this.add.image(o.x!, o.y!, o.name).setOrigin(0, 0);
      img.setDepth(o.y! + (o.height ?? img.height));
      this.buildingImages.set(o.name, img);
      if (typeof p.targetScene === 'string') {
        const target = p.targetScene;
        img.setData('targetScene', target);
        img.setInteractive({ useHandCursor: true });
        img.on('pointerover', () => img.setTint(0xbbccff));
        img.on('pointerout', () => img.clearTint());
        onTap(img, () => this.transitionTo(target));
      }
    }

    // --- пропсы поверх (деревья, фонари, машины...) — Y-sort по нижней кромке
    for (const o of map.getObjectLayer('props-above')?.objects ?? []) {
      const img = this.add.image(o.x!, o.y!, o.name).setOrigin(0, 0);
      img.setDepth(o.y! + (o.height ?? img.height));
    }

    // --- двери: зоны клика (дублируют клик по фасаду)
    for (const o of map.getObjectLayer('doors')?.objects ?? []) {
      const p = propsOf(o);
      if (typeof p.targetScene !== 'string') continue;
      const target = p.targetScene;
      const zone = this.add.zone(o.x! + o.width! / 2, o.y! + o.height! / 2, o.width!, o.height!)
        .setInteractive({ useHandCursor: true });
      const building = [...this.buildingImages.values()].find(b =>
        b.getData('targetScene') === target) ?? null;
      zone.on('pointerover', () => building?.setTint(0xbbccff));
      zone.on('pointerout', () => building?.clearTint());
      onTap(zone, () => this.transitionTo(target));
      this.doorPoints.set(target, { x: o.x! + o.width! / 2, y: o.y! + o.height! + 6 });
    }

    // --- точки ночёвки животных (загон фермы)
    this.penSpots = (map.getObjectLayer('night')?.objects ?? [])
      .filter(o => o.name === 'animal_sleep')
      .map(o => ({ x: o.x!, y: o.y!, occupiedBy: null }));

    // --- спавны
    this.spawnPoints = (map.getObjectLayer('spawns')?.objects ?? []).map(o => ({ x: o.x!, y: o.y! }));
    if (!this.spawnPoints.length) this.spawnPoints = [{ x: DISTRICT.widthPx / 2, y: DISTRICT.heightPx / 2 }];

    // --- коллизии -> сетка проходимости
    this.pathfinder = new Pathfinder(DISTRICT.widthTiles, DISTRICT.heightTiles);
    for (const o of map.getObjectLayer('collision')?.objects ?? []) {
      this.pathfinder.blockRect(o.x!, o.y!, o.width!, o.height!);
    }

    // --- камера
    const cam = this.cameras.main;
    cam.setBounds(0, 0, DISTRICT.widthPx, DISTRICT.heightPx);
    cam.setZoom(CAMERA.initialZoom);
    cam.centerOn(DISTRICT.widthPx / 2 - 24, DISTRICT.heightPx / 2 - 8);
    cam.setBackgroundColor('#2e4a35');

    attachCameraControls(this); // пан драгом/пальцем, pinch, wheel, +/- (ТЗ-09)

    // --- тонировка дня/ночи: overlay на весь мир с запасом по краям
    // (мировые координаты, а не scrollFactor 0 — корректно при любом зуме)
    this.tintOverlay = this.add.rectangle(
      -DISTRICT.widthPx, -DISTRICT.heightPx,
      DISTRICT.widthPx * 3, DISTRICT.heightPx * 3,
      0x000000, 0,
    ).setOrigin(0, 0).setDepth(TINT_OVERLAY_DEPTH);

    // --- ночные источники света: глоу-спрайты по слою glows карты
    ensureGlowTexture(this);
    for (const o of map.getObjectLayer('glows')?.objects ?? []) {
      const def = GLOW_KINDS[o.name as GlowKind];
      if (!def) continue;
      const img = this.add.image(o.x!, o.y!, GLOW_TEXTURE.key)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setTint(def.color)
        .setScale((def.radius * 2) / GLOW_TEXTURE.size)
        .setDepth(GLOW_DEPTH)
        .setAlpha(0);
      img.setData('maxAlpha', def.alpha);
      this.glowSprites.push(img);
    }

    // клик по агенту в HUD — камера плавно наезжает на него
    const onFocusAgent = ({ agentId }: { agentId: string }) => {
      const sprite = this.agentSprites.get(agentId);
      if (!sprite || sprite.isHiddenInside) return;
      cam.pan(sprite.x, sprite.y, CAMERA_FOCUS.panMs, 'Sine.easeInOut');
      if (cam.zoom < CAMERA_FOCUS.zoom) cam.zoomTo(CAMERA_FOCUS.zoom, CAMERA_FOCUS.panMs);
    };
    GameBridge.on('agent:focus', onFocusAgent);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      GameBridge.off('agent:focus', onFocusAgent);
      sceneRegistry.unregister('DistrictScene');
      this.agentSprites.clear();
      this.buildingImages.clear();
      this.glowSprites = [];
      this.nightStates.clear();
      this.leaving.clear();
      this.lastLoc.clear();
      this.doorPoints.clear();
      this.penSpots = [];
      this.cars = [];
    });

    GameBridge.emit('scene:changed', { scene: 'DistrictScene' });
  }

  /** Переход в интерьер с fade (клик по зданию/двери и agent:goto из HUD). */
  transitionTo(targetScene: string) {
    if (this.transitioning) return;
    this.transitioning = true;
    this.cameras.main.fadeOut(SCENE_FADE_MS, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start(targetScene);
      GameBridge.emit('scene:changed', { scene: targetScene });
    });
  }

  // ------- интерфейс для AgentSprite (хождение по карте)
  randomWalkableNear(x: number, y: number): { x: number; y: number } {
    return this.pathfinder.randomWalkableNear(x, y, WANDER_RADIUS);
  }

  findPath(fromX: number, fromY: number, toX: number, toY: number) {
    return this.pathfinder.findPath(fromX, fromY, toX, toY);
  }

  update(_time: number, delta: number) {
    const dt = delta / 1000;
    this.agentSprites.forEach(a => a.update(dt));

    // уход в здание (ТЗ-16): дошёл до двери (или застрял) — «входит» и исчезает
    for (const [id, lv] of this.leaving) {
      const sprite = this.agentSprites.get(id);
      if (!sprite) { this.leaving.delete(id); continue; }
      const arrived = Math.hypot(sprite.x - lv.x, sprite.y - lv.y) < 14;
      if (arrived || !sprite.hasPath || this.time.now > lv.deadline) this.removeSprite(id);
    }

    const hour = GameTime.hour;
    const tint = tintAt(hour);
    this.tintOverlay.setFillStyle(tint.color, tint.alpha);

    const night = nightIntensity(hour);
    for (const g of this.glowSprites) {
      g.setAlpha(night * (g.getData('maxAlpha') as number));
    }

    this.nightAcc += dt;
    if (this.nightAcc >= 0.25) {
      this.nightAcc = 0;
      this.updateNightBehavior(hour);
    }

    this.updateCars(dt, night);
  }

  // ------------------------------------------------- амбиент: машины

  /** Раз в 30-45 сек по дороге проезжает машина; ночью — с глоу-фарами. */
  private spawnCar() {
    const goingDown = Math.random() < 0.5;
    const tex = goingDown
      ? (Math.random() < 0.5 ? 'car_down_1' : 'car_down_2')
      : (Math.random() < 0.5 ? 'car_right_1' : 'car_right_2');
    const img = this.add.image(0, 0, tex).setOrigin(0, 0);
    const w = img.width;
    const h = img.height;
    // фары на переднем крае по ходу движения
    const glowAt: [number, number][] = goingDown
      ? [[w * 0.28, h + 2], [w * 0.72, h + 2]]
      : [[w + 4, h * 0.52], [w + 4, h * 0.74]];
    const glows = glowAt.map(([gx, gy]) => this.add.image(gx, gy, GLOW_TEXTURE.key)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(GLOW_KINDS.headlight.color)
      .setScale((GLOW_KINDS.headlight.radius * 2) / GLOW_TEXTURE.size)
      .setAlpha(0));
    const cont = this.add.container(
      goingDown ? AMBIENT_CAR.downLaneX : -w - 8,
      goingDown ? -h - 8 : AMBIENT_CAR.rightLaneY,
      [img, ...glows],
    );
    this.cars.push({
      obj: cont,
      vx: goingDown ? 0 : AMBIENT_CAR.speed,
      vy: goingDown ? AMBIENT_CAR.speed : 0,
      glows,
      h,
    });
  }

  private updateCars(dt: number, night: number) {
    this.carTimer -= dt;
    if (this.carTimer <= 0) {
      this.spawnCar();
      this.carTimer = AMBIENT_CAR.minIntervalSec
        + Math.random() * (AMBIENT_CAR.maxIntervalSec - AMBIENT_CAR.minIntervalSec);
    }
    for (let i = this.cars.length - 1; i >= 0; i--) {
      const c = this.cars[i];
      c.obj.x += c.vx * dt;
      c.obj.y += c.vy * dt;
      c.obj.setDepth(c.obj.y + c.h); // Y-sort: под агентами южнее, над дорогой
      for (const g of c.glows) g.setAlpha(night * GLOW_KINDS.headlight.alpha);
      if (c.obj.x > DISTRICT.widthPx + 16 || c.obj.y > DISTRICT.heightPx + 16) {
        c.obj.destroy();
        this.cars.splice(i, 1);
      }
    }
  }

  // ---------------------------------------------- ночной распорядок агентов

  /** Агента нельзя укладывать: активная задача/работа или открытый чат с ним. */
  private isBusy(sprite: AgentSprite): boolean {
    const s = sprite.currentStatus;
    if (s === 'task_running' || s === 'task_done' || s === 'work' || s === 'chat_npc') return true;
    const ui = useUIStore.getState(); // только чтение UI-состояния (открыт ли чат)
    return ui.chatOpen && ui.selectedAgentId === sprite.agentId;
  }

  private releaseNightState(id: string, st: NightState) {
    if (st.spot) st.spot.occupiedBy = null;
    st.spot = undefined;
    st.mode = 'none';
  }

  private updateNightBehavior(hour: number) {
    const { wakeStart, wakeEnd, snoozeHours } = NIGHT_SCHEDULE;
    const sleepy = isSleepTime(hour);

    for (const [id, sprite] of this.agentSprites) {
      // ТЗ-16: ночная косметика района — только животные. Люди ночью уходят
      // в дорм по серверному location (leaving-механика доводит их до двери).
      if (!sprite.isAnimal || this.leaving.has(id)) continue;

      let st = this.nightStates.get(id);
      if (!st) { st = { mode: 'none' }; this.nightStates.set(id, st); }

      // разбужен кликом во сне в загоне — бодрствует до snoozeUntil
      if (st.mode === 'asleep' && !sprite.isAsleep) {
        this.releaseNightState(id, st);
        st.snoozeUntil = hour + snoozeHours;
      }

      if (sleepy) {
        if (this.isBusy(sprite)) {
          if (st.mode === 'toPen') this.releaseNightState(id, st);
          continue;
        }
        if (st.snoozeUntil !== undefined) {
          // час считаем без разрыва в полночь, как в nightIntensity
          const h = hour >= NIGHT_SCHEDULE.sleepStart ? hour : hour + 24;
          const until = st.snoozeUntil >= NIGHT_SCHEDULE.sleepStart ? st.snoozeUntil : st.snoozeUntil + 24;
          if (h < until) continue;
          st.snoozeUntil = undefined;
        }

        switch (st.mode) {
          case 'none': {
            const spot = this.penSpots.find(s => !s.occupiedBy);
            if (!spot) break; // мест в загоне нет — останется гулять
            spot.occupiedBy = id;
            st.spot = spot;
            st.mode = 'toPen';
            sprite.walkTo(spot.x, spot.y);
            break;
          }
          case 'toPen': {
            if (!st.spot) { st.mode = 'none'; break; }
            const d = Math.hypot(sprite.x - st.spot.x, sprite.y - st.spot.y);
            if (d < 14) {
              sprite.sleepOutside();
              st.mode = 'asleep';
              st.wakeHour = wakeStart + Math.random() * (wakeEnd - wakeStart);
            } else if (!sprite.hasPath) {
              sprite.walkTo(st.spot.x, st.spot.y);
            }
            break;
          }
          case 'asleep':
            break; // спит до утра
        }
      } else {
        // утро/день
        st.snoozeUntil = undefined;
        switch (st.mode) {
          case 'toPen':
            if (!sprite.hasPath) this.releaseNightState(id, st);
            break;
          case 'asleep': {
            if (hour >= (st.wakeHour ?? wakeStart)) {
              sprite.wakeUp();
              this.releaseNightState(id, st); // животные дальше гуляют у фермы
            }
            break;
          }
          case 'none':
            break;
        }
      }
    }
  }

  /** Убрать спрайт агента из района со всеми хвостами состояния. */
  private removeSprite(id: string) {
    const st = this.nightStates.get(id);
    if (st) this.releaseNightState(id, st);
    this.nightStates.delete(id);
    this.leaving.delete(id);
    const sprite = this.agentSprites.get(id);
    sprite?.destroy();
    this.agentSprites.delete(id);
  }

  syncAgents(fullList: SyncedAgent[]) {
    // ГЛАВНЫЙ ФИКС ТЗ-16: район рисует только тех, кто по серверу на улице
    // или у фермы. Вход/выход игрока на местоположение агентов не влияет.
    const present = fullList.filter(a => a.location === 'district' || a.location === 'farm');
    const incoming = new Set(present.map(a => a.id));
    const locOf = new Map(fullList.map(a => [a.id, a.location]));

    this.agentSprites.forEach((sprite, id) => {
      if (incoming.has(id)) {
        // вернулся, не успев дойти до двери — уход отменяется
        if (this.leaving.delete(id)) sprite.cancelGoal();
        return;
      }
      const newLoc = locOf.get(id);
      if (!newLoc) { this.removeSprite(id); return; } // агент удалён совсем
      if (this.leaving.has(id)) return; // уже дошагивает до двери
      // косметика: ушёл в здание — дойти до его двери и «войти» (в т.ч. ночью
      // в дорм — это и есть прежняя картинка отхода ко сну)
      const door = this.doorPoints.get(LOCATION_SCENES[newLoc]);
      if (door && !sprite.isAsleep && !sprite.isHiddenInside) {
        const st = this.nightStates.get(id);
        if (st) this.releaseNightState(id, st);
        this.leaving.set(id, { x: door.x, y: door.y, deadline: this.time.now + LEAVE_WALK_TIMEOUT_MS });
        sprite.walkTo(door.x, door.y);
      } else {
        this.removeSprite(id); // спит/скрыт или дверь не нашлась — без прохода
      }
    });

    present.forEach((a) => {
      if (this.agentSprites.has(a.id)) return;
      // пришёл из здания — появляется у его двери, иначе — спавн-точка
      const from = this.lastLoc.get(a.id);
      const door = from && LOCATION_SCENES[from] !== 'DistrictScene'
        ? this.doorPoints.get(LOCATION_SCENES[from])
        : undefined;
      const base = door ?? this.spawnPoints[this.agentSprites.size % this.spawnPoints.length];
      const x = base.x + (Math.random() - 0.5) * 16;
      const y = base.y + (door ? 8 + Math.random() * 8 : (Math.random() - 0.5) * 8);
      const sprite = new AgentSprite(this, a.id, a.name, a.avatarVariant, x, y);
      this.agentSprites.set(a.id, sprite);
    });

    // запомнить «кто где» для следующего синка; подчистить удалённых
    this.lastLoc.clear();
    fullList.forEach(a => this.lastLoc.set(a.id, a.location));

    // сюда шли за конкретным агентом из HUD — навести камеру (ТЗ-16)
    consumePendingFocus('DistrictScene', id => this.agentSprites.has(id));
  }
}

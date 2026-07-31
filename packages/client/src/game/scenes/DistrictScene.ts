import Phaser from 'phaser';
import { AgentSprite } from '../agents/AgentSprite.js';
import { GameBridge } from '../GameBridge.js';
import { sceneRegistry } from '../SceneRegistry.js';
import { Pathfinder } from '../Pathfinder.js';
import {
  AMBIENT_CAR, CAMERA, CAMERA_FOCUS, DISTRICT, GLOW_DEPTH, GLOW_KINDS,
  GLOW_TEXTURE, LEAVE_WALK_TIMEOUT_MS, NIGHT_SCHEDULE,
  SCENE_FADE_MS, TINT_OVERLAY_DEPTH, WANDER_RADIUS, type GlowKind,
} from '../config.js';
import { attachCameraControls, onTap } from '../cameraControls.js';
import { sceneKeyFor } from '../venueRegistry.js';
import { GameTime } from '../time.js';
import { isSleepTime, nightIntensity, tintAt } from '../dayNight.js';
import { ensureGlowTexture } from '../glowTexture.js';
import { useUIStore } from '../../store/agentStore.js';
import { consumePendingFocus } from '../navigation.js';
import { hasGroundArt } from '../tilesetGuard.js';
import type { SyncedAgent } from '../../hooks/useGameSync.js';

/**
 * An agent's night phase in the district. Since TZ-16 — ONLY animal cosmetics (the pen, Z icon,
 * waking on click): where people go at night is decided by the server via location,
 * and their walk to the dorm door is drawn by the leaving mechanic (see syncAgents).
 */
interface NightState {
  mode: 'none' | 'toPen' | 'asleep';
  /** Personal wake-up hour from [wakeStart, wakeEnd). */
  wakeHour?: number;
  /** Woken by a click: don't put back to sleep until this hour (may be >24). */
  snoozeUntil?: number;
  spot?: { x: number; y: number; occupiedBy: string | null };
}

/** Cosmetic building exit: the agent walks up to the door and "enters" (TZ-16). */
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
  /** Points by building doors (waiting spot in front of the entrance), keyed by targetScene. */
  private doorPoints: Map<string, { x: number; y: number }> = new Map();
  private penSpots: { x: number; y: number; occupiedBy: string | null }[] = [];
  private nightStates: Map<string, NightState> = new Map();
  /** Agents walking to a building door before disappearing (TZ-16). */
  private leaving: Map<string, LeavingState> = new Map();
  /** Last known location of each agent — used to spawn them at the right door.
   *  F-3: a venue id (string); see game/presence.ts for the "known" authority. */
  private lastLoc: Map<string, string> = new Map();
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
    // I-12: an art-free clone has no tileset texture (the pack dirs are gitignored) —
    // render the layout without ground art rather than crash on createLayer(null).
    const tileset = map.addTilesetImage(DISTRICT.tilesetName, DISTRICT.tilesetName);
    if (hasGroundArt(tileset)) {
      map.createLayer('ground', tileset, 0, 0)?.setDepth(0);
      map.createLayer('roads', tileset, 0, 0)?.setDepth(1);
    }

    // --- decal objects beneath agents (garden beds, crops)
    for (const o of map.getObjectLayer('props-below')?.objects ?? []) {
      this.add.image(o.x!, o.y!, o.name).setOrigin(0, 0).setDepth(2);
    }

    // --- buildings: interactive facades with hover highlight
    for (const o of map.getObjectLayer('buildings')?.objects ?? []) {
      const p = propsOf(o);
      const img = this.add.image(o.x!, o.y!, o.name).setOrigin(0, 0);
      img.setDepth(o.y! + (o.height ?? img.height));
      this.buildingImages.set(o.name, img);
      if (typeof p.targetVenue === 'string') {
        const target = sceneKeyFor(p.targetVenue);
        img.setData('targetScene', target);
        img.setInteractive({ useHandCursor: true });
        img.on('pointerover', () => img.setTint(0xbbccff));
        img.on('pointerout', () => img.clearTint());
        onTap(img, () => this.transitionTo(target));
      }
    }

    // --- props on top (trees, street lamps, cars...) — Y-sorted by bottom edge
    for (const o of map.getObjectLayer('props-above')?.objects ?? []) {
      const img = this.add.image(o.x!, o.y!, o.name).setOrigin(0, 0);
      img.setDepth(o.y! + (o.height ?? img.height));
    }

    // --- doors: click zones (duplicate clicking the facade)
    for (const o of map.getObjectLayer('doors')?.objects ?? []) {
      const p = propsOf(o);
      if (typeof p.targetVenue !== 'string') continue;
      const target = sceneKeyFor(p.targetVenue);
      const zone = this.add.zone(o.x! + o.width! / 2, o.y! + o.height! / 2, o.width!, o.height!)
        .setInteractive({ useHandCursor: true });
      const building = [...this.buildingImages.values()].find(b =>
        b.getData('targetScene') === target) ?? null;
      zone.on('pointerover', () => building?.setTint(0xbbccff));
      zone.on('pointerout', () => building?.clearTint());
      onTap(zone, () => this.transitionTo(target));
      this.doorPoints.set(target, { x: o.x! + o.width! / 2, y: o.y! + o.height! + 6 });
    }

    // --- animal sleeping spots (the farm pen)
    this.penSpots = (map.getObjectLayer('night')?.objects ?? [])
      .filter(o => o.name === 'animal_sleep')
      .map(o => ({ x: o.x!, y: o.y!, occupiedBy: null }));

    // --- spawns
    this.spawnPoints = (map.getObjectLayer('spawns')?.objects ?? []).map(o => ({ x: o.x!, y: o.y! }));
    if (!this.spawnPoints.length) this.spawnPoints = [{ x: DISTRICT.widthPx / 2, y: DISTRICT.heightPx / 2 }];

    // --- collisions -> walkability grid
    this.pathfinder = new Pathfinder(DISTRICT.widthTiles, DISTRICT.heightTiles);
    for (const o of map.getObjectLayer('collision')?.objects ?? []) {
      this.pathfinder.blockRect(o.x!, o.y!, o.width!, o.height!);
    }

    // --- camera
    const cam = this.cameras.main;
    cam.setBounds(0, 0, DISTRICT.widthPx, DISTRICT.heightPx);
    cam.setZoom(CAMERA.initialZoom);
    cam.centerOn(DISTRICT.widthPx / 2 - 24, DISTRICT.heightPx / 2 - 8);
    cam.setBackgroundColor('#2e4a35');

    attachCameraControls(this); // drag/finger pan, pinch, wheel, +/- (TZ-09)

    // --- day/night tinting: an overlay covering the whole world with margin at the edges
    // (world coordinates, not scrollFactor 0 — correct at any zoom level)
    this.tintOverlay = this.add.rectangle(
      -DISTRICT.widthPx, -DISTRICT.heightPx,
      DISTRICT.widthPx * 3, DISTRICT.heightPx * 3,
      0x000000, 0,
    ).setOrigin(0, 0).setDepth(TINT_OVERLAY_DEPTH);

    // --- night light sources: glow sprites from the map's glows layer
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

    // clicking an agent in the HUD — the camera smoothly pans onto them
    const onFocusAgent = ({ agentId }: { agentId: string }) => {
      const sprite = this.agentSprites.get(agentId);
      if (!sprite) return;
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

  /** Transition into an interior with fade (building/door click and agent:goto from the HUD). */
  transitionTo(targetScene: string) {
    if (this.transitioning) return;
    this.transitioning = true;
    this.cameras.main.fadeOut(SCENE_FADE_MS, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start(targetScene);
      GameBridge.emit('scene:changed', { scene: targetScene });
    });
  }

  // ------- interface for AgentSprite (walking around the map)
  randomWalkableNear(x: number, y: number): { x: number; y: number } {
    return this.pathfinder.randomWalkableNear(x, y, WANDER_RADIUS);
  }

  findPath(fromX: number, fromY: number, toX: number, toY: number) {
    return this.pathfinder.findPath(fromX, fromY, toX, toY);
  }

  update(_time: number, delta: number) {
    const dt = delta / 1000;
    this.agentSprites.forEach(a => a.update(dt));

    // building exit (TZ-16): reached the door (or got stuck) — "enters" and disappears
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

  // ------------------------------------------------- ambience: cars

  /** Every 30-45 sec a car drives down the road; at night — with glowing headlights. */
  private spawnCar() {
    const goingDown = Math.random() < 0.5;
    const tex = goingDown
      ? (Math.random() < 0.5 ? 'car_down_1' : 'car_down_2')
      : (Math.random() < 0.5 ? 'car_right_1' : 'car_right_2');
    const img = this.add.image(0, 0, tex).setOrigin(0, 0);
    const w = img.width;
    const h = img.height;
    // headlights on the leading edge in the direction of travel
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
      c.obj.setDepth(c.obj.y + c.h); // Y-sort: below agents further south, above the road
      for (const g of c.glows) g.setAlpha(night * GLOW_KINDS.headlight.alpha);
      if (c.obj.x > DISTRICT.widthPx + 16 || c.obj.y > DISTRICT.heightPx + 16) {
        c.obj.destroy();
        this.cars.splice(i, 1);
      }
    }
  }

  // ---------------------------------------------- agents' night routine

  /** The agent must not be put to bed: active task/work, or a chat with them is open. */
  private isBusy(sprite: AgentSprite): boolean {
    const s = sprite.currentStatus;
    if (s === 'task_running' || s === 'task_done' || s === 'work' || s === 'chat_npc') return true;
    const ui = useUIStore.getState(); // read-only peek at UI state (is a chat open)
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
      // TZ-16: the district's night cosmetics are animals only. People leave at night
      // for the dorm per server location (the leaving mechanic walks them to the door).
      if (!sprite.isAnimal || this.leaving.has(id)) continue;

      let st = this.nightStates.get(id);
      if (!st) { st = { mode: 'none' }; this.nightStates.set(id, st); }

      // woken by a click while asleep in the pen — stays awake until snoozeUntil
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
          // compute the hour without the midnight wraparound, same as nightIntensity
          const h = hour >= NIGHT_SCHEDULE.sleepStart ? hour : hour + 24;
          const until = st.snoozeUntil >= NIGHT_SCHEDULE.sleepStart ? st.snoozeUntil : st.snoozeUntil + 24;
          if (h < until) continue;
          st.snoozeUntil = undefined;
        }

        switch (st.mode) {
          case 'none': {
            const spot = this.penSpots.find(s => !s.occupiedBy);
            if (!spot) break; // no free spots in the pen — keeps wandering
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
            break; // sleeps until morning
        }
      } else {
        // morning/day
        st.snoozeUntil = undefined;
        switch (st.mode) {
          case 'toPen':
            if (!sprite.hasPath) this.releaseNightState(id, st);
            break;
          case 'asleep': {
            if (hour >= (st.wakeHour ?? wakeStart)) {
              sprite.wakeUp();
              this.releaseNightState(id, st); // animals go back to wandering near the farm
            }
            break;
          }
          case 'none':
            break;
        }
      }
    }
  }

  /** Remove an agent's sprite from the district along with all trailing state. */
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
    // THE KEY FIX of TZ-16: the district draws only those the server says are outside
    // or at the farm. The player entering/leaving has no effect on agent locations.
    const present = fullList.filter(a => a.location === 'district' || a.location === 'farm');
    const incoming = new Set(present.map(a => a.id));
    const locOf = new Map(fullList.map(a => [a.id, a.location]));
    const activityOf = new Map(present.map(a => [a.id, a.activity]));

    this.agentSprites.forEach((sprite, id) => {
      if (incoming.has(id)) {
        // came back before reaching the door — the departure is cancelled
        if (this.leaving.delete(id)) sprite.cancelGoal();
        sprite.setActivity(activityOf.get(id));
        return;
      }
      const newLoc = locOf.get(id);
      if (!newLoc) { this.removeSprite(id); return; } // agent deleted entirely
      if (this.leaving.has(id)) return; // already walking to the door
      // cosmetics: went into a building — walk to its door and "enter" (incl. at night
      // to the dorm — that is exactly the old going-to-bed visual)
      const door = newLoc !== 'farm' ? this.doorPoints.get(sceneKeyFor(newLoc)) : undefined;
      if (door && !sprite.isAsleep) {
        const st = this.nightStates.get(id);
        if (st) this.releaseNightState(id, st);
        this.leaving.set(id, { x: door.x, y: door.y, deadline: this.time.now + LEAVE_WALK_TIMEOUT_MS });
        sprite.walkTo(door.x, door.y);
      } else {
        this.removeSprite(id); // asleep or no door found (incl. an unknown/absent new location) — no walk-out
      }
    });

    present.forEach((a) => {
      if (this.agentSprites.has(a.id)) return;
      // came out of a building — appears at its door; otherwise at a spawn point
      const from = this.lastLoc.get(a.id);
      const door = from && from !== 'district' && from !== 'farm'
        ? this.doorPoints.get(sceneKeyFor(from))
        : undefined;
      const base = door ?? this.spawnPoints[this.agentSprites.size % this.spawnPoints.length];
      const x = base.x + (Math.random() - 0.5) * 16;
      const y = base.y + (door ? 8 + Math.random() * 8 : (Math.random() - 0.5) * 8);
      const sprite = new AgentSprite(this, a.id, a.name, a.avatarVariant, x, y,
        a.spriteSeed !== undefined ? { spriteSeed: a.spriteSeed, gender: '' } : undefined);
      sprite.setActivity(a.activity);
      this.agentSprites.set(a.id, sprite);
    });

    // remember "who is where" for the next sync; clean up deleted agents
    this.lastLoc.clear();
    fullList.forEach(a => this.lastLoc.set(a.id, a.location));

    // we came here for a specific agent from the HUD — aim the camera (TZ-16)
    consumePendingFocus('DistrictScene', id => this.agentSprites.has(id));
  }
}

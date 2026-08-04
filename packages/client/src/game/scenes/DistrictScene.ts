import Phaser from 'phaser';
import { AgentSprite } from '../agents/AgentSprite.js';
import { GameBridge } from '../GameBridge.js';
import { sceneRegistry } from '../SceneRegistry.js';
import { Pathfinder } from '../Pathfinder.js';
import {
  AMBIENT_CAR, CAMERA, CAMERA_FOCUS, cameraBounds, carCullBounds, districtGeometry,
  districtViewCentre, GLOW_DEPTH, GLOW_KINDS,
  GLOW_TEXTURE, LEAVE_WALK_TIMEOUT_MS, NIGHT_SCHEDULE,
  SCENE_FADE_MS, TILE_SIZE, TINT_OVERLAY_DEPTH, tintOverlayRect, WANDER_RADIUS,
  type DistrictGeometry, type GlowKind,
} from '../config.js';
import { plotRegistry } from '../plotRegistry.js';
import { onPlotStatesChanged, plotStatus } from '../plotState.js';
import { buildingRegistry } from '../buildingRegistry.js';
import { PLOT_STATES_KEY, VARIANT_POOLS_KEY } from '../plotAssets.js';
import {
  campSlotTile, composePlot,
  type Occupant, type Placement, type PlotStatesDoc, type VariantPoolsDoc,
} from '../plotComposition.js';
import { attachCameraControls, onTap } from '../cameraControls.js';
import {
  DISTRICT_SCENE_KEY, sceneTargetFor, startingDistrict, venueRegistry,
} from '../venueRegistry.js';
import { planSync } from '../districtPresence.js';
import { GameTime } from '../time.js';
import { isSleepTime, nightIntensity, tintAt } from '../dayNight.js';
import { ensureGlowTexture } from '../glowTexture.js';
import { useUIStore } from '../../store/agentStore.js';
import { consumePendingFocus, consumePendingFollow } from '../navigation.js';
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
  /**
   * Points by building doors (waiting spot in front of the entrance), keyed by
   * TARGET VENUE ID. Not by scene key: every district shares one scene key, so
   * keying by it would make two districts' doors collide the moment a door led
   * from one district to another.
   */
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

  /** Which district this scene is drawing — from scene data, never a literal. */
  private districtId!: string;
  private geo!: DistrictGeometry;

  /** Everything drawn for the parcels — destroyed and rebuilt on a state change. */
  private plotObjects: Phaser.GameObjects.GameObject[] = [];
  /** Who is camped where, as of the last sync. Composition input, so a change redraws. */
  private plotOccupants: Map<string, Occupant[]> = new Map();
  private offPlotStates: (() => void) | null = null;

  constructor() { super({ key: DISTRICT_SCENE_KEY }); }

  /**
   * ONE scene, N districts (D-62). `scene.start(DISTRICT_SCENE_KEY, data)`
   * says which one; no data means the district the game boots into. An id
   * that is not an outdoor venue throws rather than quietly drawing the wrong
   * town — I-2: an unresolved name fails loudly, it never renders as nothing.
   */
  init(data?: { districtId?: string }) {
    const requested = data?.districtId;
    const venue = requested === undefined ? startingDistrict() : venueRegistry.get(requested);
    if (!venue || venue.indoor) {
      throw new Error(`DistrictScene: '${requested}' is not an outdoor venue`);
    }
    this.districtId = venue.id;
    this.geo = districtGeometry(venue);
  }

  create() {
    sceneRegistry.register(DISTRICT_SCENE_KEY, this);
    this.transitioning = false;
    this.carTimer = AMBIENT_CAR.firstDelaySec + Math.random() * AMBIENT_CAR.firstDelaySec;
    this.cameras.main.fadeIn(SCENE_FADE_MS, 0, 0, 0);

    const map = this.make.tilemap({ key: this.geo.mapKey });
    // I-12: an art-free clone has no tileset texture (the pack dirs are gitignored) —
    // render the layout without ground art rather than crash on createLayer(null).
    const tileset = map.addTilesetImage(this.geo.tilesetName, this.geo.tilesetName);
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
        const target = p.targetVenue;
        img.setData('targetVenue', target);
        img.setInteractive({ useHandCursor: true });
        img.on('pointerover', () => img.setTint(0xbbccff));
        img.on('pointerout', () => img.clearTint());
        onTap(img, () => this.transitionToVenue(target));
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
      const target = p.targetVenue;
      const zone = this.add.zone(o.x! + o.width! / 2, o.y! + o.height! / 2, o.width!, o.height!)
        .setInteractive({ useHandCursor: true });
      const building = [...this.buildingImages.values()].find(b =>
        b.getData('targetVenue') === target) ?? null;
      zone.on('pointerover', () => building?.setTint(0xbbccff));
      zone.on('pointerout', () => building?.clearTint());
      onTap(zone, () => this.transitionToVenue(target));
      this.doorPoints.set(target, { x: o.x! + o.width! / 2, y: o.y! + o.height! + 6 });
    }

    // --- the land: one parcel per plot, composed from plot_states.json
    this.renderPlots();
    this.offPlotStates = onPlotStatesChanged(() => this.renderPlots());

    // --- animal sleeping spots (the farm pen)
    this.penSpots = (map.getObjectLayer('night')?.objects ?? [])
      .filter(o => o.name === 'animal_sleep')
      .map(o => ({ x: o.x!, y: o.y!, occupiedBy: null }));

    // --- spawns
    this.spawnPoints = (map.getObjectLayer('spawns')?.objects ?? []).map(o => ({ x: o.x!, y: o.y! }));
    if (!this.spawnPoints.length) this.spawnPoints = [{ x: this.geo.widthPx / 2, y: this.geo.heightPx / 2 }];

    // --- collisions -> walkability grid
    this.pathfinder = new Pathfinder(this.geo.widthTiles, this.geo.heightTiles);
    for (const o of map.getObjectLayer('collision')?.objects ?? []) {
      this.pathfinder.blockRect(o.x!, o.y!, o.width!, o.height!);
    }

    // --- camera. Bounds and opening centre both come from config.ts, which
    // derives them from the descriptor and the map's own spawn points — see
    // districtViewCentre for why "map centre" stopped being "town centre" at
    // 92x92 (F-1).
    const cam = this.cameras.main;
    const bounds = cameraBounds(this.geo);
    cam.setBounds(bounds.x, bounds.y, bounds.width, bounds.height);
    cam.setZoom(CAMERA.initialZoom);
    const centre = districtViewCentre(this.geo, this.spawnPoints);
    cam.centerOn(centre.x, centre.y);
    cam.setBackgroundColor('#2e4a35');

    attachCameraControls(this); // drag/finger pan, pinch, wheel, +/- (TZ-09)

    // --- day/night tinting: an overlay covering the whole world with margin at the edges
    // (world coordinates, not scrollFactor 0 — correct at any zoom level)
    const tint = tintOverlayRect(this.geo);
    this.tintOverlay = this.add.rectangle(tint.x, tint.y, tint.width, tint.height, 0x000000, 0)
      .setOrigin(0, 0).setDepth(TINT_OVERLAY_DEPTH);

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
      sprite.pulseLabel(); // visible confirmation of WHO the camera went to
    };
    GameBridge.on('agent:focus', onFocusAgent);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      GameBridge.off('agent:focus', onFocusAgent);
      this.offPlotStates?.();
      this.offPlotStates = null;
      this.plotObjects = [];
      this.plotOccupants.clear();
      sceneRegistry.unregister(DISTRICT_SCENE_KEY);
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

    GameBridge.emit('scene:changed', { scene: DISTRICT_SCENE_KEY, districtId: this.districtId });
  }

  /**
   * Transition with fade (building/door click, agent:goto from the HUD).
   * `data` carries the district id when the target is an outdoor scene —
   * without it, "go to district B" would restart whichever district is
   * already drawn.
   */
  transitionTo(targetScene: string, data?: { districtId: string }) {
    if (this.transitioning) return;
    this.transitioning = true;
    this.cameras.main.fadeOut(SCENE_FADE_MS, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start(targetScene, data);
      GameBridge.emit('scene:changed', { scene: targetScene, ...data });
    });
  }

  /** Where a click on a building or door goes — resolved from the registry. */
  private transitionToVenue(venueId: string) {
    const target = sceneTargetFor(venueId);
    this.transitionTo(target.key, target.data);
  }

  // ------------------------------------------------------ the land (Task 2)

  /**
   * Draw every parcel this district contains, from its CURRENT state.
   *
   * The whole method is an effects carrier, exactly like syncAgents: what to
   * draw is `composePlot`'s answer (a pure module over plot_states.json), and
   * the only things decided here are which cache the documents come from and
   * how a tile point plus an alignment becomes a pixel origin — which needs
   * the loaded texture's size and therefore cannot be pure.
   *
   * Rebuilt wholesale rather than diffed. A parcel changes state a handful of
   * times in the life of a town (D-36: buildings appear at dawn), so a diff
   * would be a cache to keep correct in exchange for nothing.
   */
  private renderPlots() {
    for (const o of this.plotObjects) o.destroy();
    this.plotObjects = [];

    const states = this.cache.json.get(PLOT_STATES_KEY) as PlotStatesDoc | undefined;
    const pools = this.cache.json.get(VARIANT_POOLS_KEY) as VariantPoolsDoc | undefined;
    if (!states || !pools) {
      // The bake writes both beside the artifact; missing means a broken
      // deployment, not a state of the world. Say so once, draw no land, and
      // leave everything else working.
      console.warn('[plots] plot_states.json / variant_pools.json not loaded — the land is not drawn');
      return;
    }

    for (const plot of plotRegistry.inDistrict(this.districtId)) {
      const status = plotStatus(plot.id);
      const placements = composePlot({
        plot,
        state: status.state,
        states,
        pools,
        occupants: this.plotOccupants.get(plot.id) ?? [],
        ...(status.archetype ? { exterior: buildingRegistry.exteriorFor(status.archetype) } : {}),
      });
      for (const p of placements) this.placePlotProp(p);
    }
  }

  /** One composed placement -> one image, on the layer and depth the map uses. */
  private placePlotProp(p: Placement) {
    if (!this.textures.exists(p.name)) {
      // I-2's runtime half. plot_states.json is loaded rather than bundled, so
      // an unresolved name reaches here instead of the build; it must be loud
      // and it must not draw Phaser's green "missing" square on the town.
      console.error(`[plots] '${p.name}' is not a loaded texture — nothing drawn`);
      return;
    }
    const img = this.add.image(p.tile[0] * TILE_SIZE, p.tile[1] * TILE_SIZE, p.name).setOrigin(0, 0);
    if (p.align === 'centre-bottom') img.setPosition(img.x - img.width / 2, img.y - img.height);
    img.setDepth(p.layer === 'props-below' ? 2 : img.y + img.height);
    this.plotObjects.push(img);
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
    const cull = carCullBounds(this.geo);
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
      if (c.obj.x > cull.maxX || c.obj.y > cull.maxY) {
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

  /**
   * Recompute "who is camped on which parcel" from the roster. Returns true
   * only if the answer moved, so the caller can skip a redraw.
   */
  private updateCampOccupancy(present: readonly SyncedAgent[]): boolean {
    const next = new Map<string, Occupant[]>();
    for (const a of present) {
      if (!plotRegistry.has(a.location)) continue;
      const list = next.get(a.location) ?? [];
      // spriteSeed is the platform identity the pick is defined on (D-25).
      // Fixture agents carry none; their own id is the stable stand-in, and
      // it is stable for exactly as long as the agent is.
      list.push({ id: a.id, spriteSeed: a.spriteSeed ?? a.id });
      next.set(a.location, list);
    }
    const key = (m: Map<string, Occupant[]>) => JSON.stringify(
      [...m.entries()].sort(([x], [y]) => x.localeCompare(y))
        .map(([id, os]) => [id, [...os].sort((p, q) => p.id.localeCompare(q.id))]),
    );
    if (key(next) === key(this.plotOccupants)) return false;
    this.plotOccupants = next;
    return true;
  }

  /** The pixel spot of an agent's own camp slot, if they are on a parcel here. */
  private campSpotFor(agentId: string, location: string): { x: number; y: number } | undefined {
    const plot = plotRegistry.get(location);
    if (!plot || plot.districtId !== this.districtId) return undefined;
    const occupants = this.plotOccupants.get(location) ?? [];
    const index = [...occupants].sort((a, b) => a.id.localeCompare(b.id))
      .findIndex(o => o.id === agentId);
    const [tx, ty] = campSlotTile(plot, index < 0 ? 0 : index);
    return { x: tx * TILE_SIZE, y: ty * TILE_SIZE };
  }

  syncAgents(fullList: SyncedAgent[]) {
    // THE KEY FIX of TZ-16: the district draws only those the server says are
    // outside or at the farm, and the player entering/leaving has no effect on
    // agent locations. WHO that is, and what happens to everyone else, is
    // decided by game/districtPresence.ts — a pure module, so the decision is
    // testable without Phaser and pinned by test/golden/district-render.json.
    // This method is the EFFECTS half: it only carries the decision out.
    const plan = planSync({
      districtId: this.districtId,
      fullList,
      drawnIds: [...this.agentSprites.keys()],
      lastLoc: this.lastLoc,
      hasDoorFor: (venueId) => this.doorPoints.has(venueId),
      isAsleep: (id) => this.agentSprites.get(id)?.isAsleep ?? false,
      isLeaving: (id) => this.leaving.has(id),
    });
    const activityOf = new Map(plan.present.map(a => [a.id, a.activity]));
    // Who is camped where. A tent belongs to an AGENT (D-75's per-spriteSeed
    // pick), so the camp's composition moves when the roster does — recompose
    // only when the answer actually changed, or every 15s poll redraws 23
    // parcels for nothing.
    if (this.updateCampOccupancy(plan.present)) this.renderPlots();

    for (const [id, decision] of plan.drawn) {
      const sprite = this.agentSprites.get(id);
      if (!sprite) continue;
      switch (decision.kind) {
        case 'stay':
          // came back before reaching the door — the departure is cancelled
          if (decision.cancelLeaving) { this.leaving.delete(id); sprite.cancelGoal(); }
          sprite.setActivity(activityOf.get(id));
          break;
        case 'leaving':
          break; // already walking to the door
        case 'walk-to-door': {
          const door = this.doorPoints.get(decision.venueId)!;
          const st = this.nightStates.get(id);
          if (st) this.releaseNightState(id, st);
          this.leaving.set(id, { x: door.x, y: door.y, deadline: this.time.now + LEAVE_WALK_TIMEOUT_MS });
          sprite.walkTo(door.x, door.y);
          break;
        }
        case 'remove':
          this.removeSprite(id);
          break;
      }
    }

    plan.present.forEach((a) => {
      const spawn = plan.spawn.get(a.id);
      if (!spawn) return; // already drawn
      const door = spawn.atDoorOf !== undefined
        ? this.doorPoints.get(spawn.atDoorOf)
        : undefined;
      // Somebody the api put in Camp 7 appears AT Camp 7, beside their own
      // tent — the same slot `composePlot` pitched it on, from the same
      // function, so a sprite can never stand across town from its shelter.
      const camp = door ? undefined : this.campSpotFor(a.id, a.location);
      const base = door ?? camp ?? this.spawnPoints[this.agentSprites.size % this.spawnPoints.length];
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
    consumePendingFocus(DISTRICT_SCENE_KEY, id => this.agentSprites.has(id));
    // ?follow= deep-link: the first sync containing the agent goes to them (Plan 03 Task 3)
    consumePendingFollow(fullList);
  }
}

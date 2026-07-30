import Phaser from 'phaser';
import { AgentSprite } from '../agents/AgentSprite.js';
import { GameBridge } from '../GameBridge.js';
import { sceneRegistry } from '../SceneRegistry.js';
import { Pathfinder } from '../Pathfinder.js';
import { CAMERA, CAMERA_FOCUS, INTERIOR_TILESET, NIGHT_SCHEDULE, SCENE_FADE_MS, snapZoom } from '../config.js';
import { sceneKeyFor } from '../venueRegistry.js';
import { attachCameraControls, onTap } from '../cameraControls.js';
import { ANIMATED_OBJECTS, getVariant } from '../assetManifest.js';
import { GameTime } from '../time.js';
import { isSleepTime } from '../dayNight.js';
import { consumePendingFocus } from '../navigation.js';
import { hasGroundArt } from '../tilesetGuard.js';
import { assignSlots, displacedSlot, isOverCapacity } from '../venueSlots.js';
import type { FootprintRect, Slot } from '../venueSlots.js';
import type { SyncedAgent } from '../../hooks/useGameSync.js';
import type { VenueDescriptor } from '@botville/shared';

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
 * Base interior scene: a room from a TMJ (scripts/world-bake.mjs),
 * seats with occupancy (two agents will not take the same chair), a prominent
 * exit door (a doormat with hover highlight), animated objects.
 *
 * TZ-16: the scene draws ONLY agents whose server-side location is this building.
 * An empty room is fine. The player entering no longer affects agents.
 */
export class VenueScene extends Phaser.Scene {
  protected agentSprites: Map<string, AgentSprite> = new Map();
  private seats: Seat[] = [];
  private pathfinder!: Pathfinder;
  private spawnPoint = { x: 160, y: 200 };
  /** agent -> the seat they are walking to */
  private pendingSeat: Map<string, Seat> = new Map();
  /** agent in bed -> personal wake-up hour (7:00-9:00). */
  private bedWakeHours: Map<string, number> = new Map();
  /** The collision layer's rectangles — the F-14 input for venueSlots. */
  private furnitureFootprints: FootprintRect[] = [];
  /**
   * agent -> the slot they were last reconciled to. assignSlots recomputes the
   * WHOLE roster's arrangement from scratch every call (it is a pure function
   * of ids + venue + footprints) — this is what lets syncAgents tell "rank
   * shifted, re-seat them" apart from "nothing changed, leave them be" without
   * ever trusting stale occupancy as the source of truth.
   */
  private assignedSlot: Map<string, Slot> = new Map();
  private roomW = 320;
  private roomH = 240;
  private transitioning = false;

  /**
   * An explicit field, not a parameter property: `node --test` strips types
   * but cannot generate the assignment (ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX).
   * There is no Phaser and no node testing here — but this constructor is
   * what gets copied from.
   */
  private readonly venue: VenueDescriptor;

  constructor(venue: VenueDescriptor) {
    super({ key: sceneKeyFor(venue.id) });
    this.venue = venue;
  }

  /** Map key = venue id; the .tmj is baked by scripts/world-bake.mjs. */
  private get mapKey() { return this.venue.id; }
  /** This venue's location in server terms: whoever is here is whom we draw. */
  private get locationId() { return this.venue.id; }
  private get sceneKey() { return sceneKeyFor(this.venue.id); }

  create() {
    sceneRegistry.register(this.sceneKey, this);
    this.transitioning = false;
    this.cameras.main.fadeIn(SCENE_FADE_MS, 0, 0, 0);

    const map = this.make.tilemap({ key: this.mapKey });
    // I-12: an art-free clone has no tileset texture (the pack dirs are gitignored) —
    // render the layout without ground art rather than crash on createLayer(null).
    const tileset = map.addTilesetImage(INTERIOR_TILESET, INTERIOR_TILESET);
    if (hasGroundArt(tileset)) map.createLayer('ground', tileset, 0, 0)?.setDepth(0);
    this.roomW = map.widthInPixels;
    this.roomH = map.heightInPixels;

    // furniture (Y-sorted by bottom edge); the doormat gets the exit highlight
    let doormat: Phaser.GameObjects.Image | null = null;
    for (const o of map.getObjectLayer('furniture')?.objects ?? []) {
      const img = this.add.image(o.x!, o.y!, o.name).setOrigin(0, 0);
      img.setDepth(propsOf(o).doormat ? 1 : o.y! + (o.height ?? img.height));
      if (propsOf(o).doormat) doormat = img;
    }

    // animated objects
    for (const o of map.getObjectLayer('animated')?.objects ?? []) {
      const def = ANIMATED_OBJECTS[o.name];
      if (!def) continue;
      const spr = this.add.sprite(o.x!, o.y!, `anim-${o.name}`, 0).setOrigin(0, 0);
      spr.setDepth(o.y! + def.frameHeight);
      spr.play(`anim-${o.name}`);
    }

    // seats
    this.seats = (map.getObjectLayer('seats')?.objects ?? []).map(o => {
      const p = propsOf(o);
      return {
        x: o.x!, y: o.y!,
        side: (p.side as 'right' | 'left') ?? 'right',
        kind: (p.kind as Seat['kind']) ?? 'chair',
        occupiedBy: null,
      };
    });

    // F-14: standing agents route around furniture. The collision layer was
    // derived at bake time from exactly those footprints (Plan 2 Task 15) — read it from the map.
    this.furnitureFootprints = (map.getObjectLayer('collision')?.objects ?? [])
      .map(o => ({ x: o.x ?? 0, y: o.y ?? 0, w: o.width ?? 0, h: o.height ?? 0 }));

    // exit: a zone over the doormat, hover highlights the doormat
    for (const o of map.getObjectLayer('doors')?.objects ?? []) {
      const p = propsOf(o);
      if (typeof p.targetVenue !== 'string') continue;
      const target = sceneKeyFor(p.targetVenue);
      const zone = this.add.zone(o.x! + o.width! / 2, o.y! + o.height! / 2, o.width!, o.height!)
        .setInteractive({ useHandCursor: true });
      zone.on('pointerover', () => doormat?.setTint(0xaaffaa));
      zone.on('pointerout', () => doormat?.clearTint());
      onTap(zone, () => this.transitionTo(target));
    }

    // spawn and walkability
    const sp = map.getObjectLayer('spawns')?.objects?.[0];
    if (sp) this.spawnPoint = { x: sp.x!, y: sp.y! };
    this.pathfinder = new Pathfinder(map.width, map.height);
    for (const o of map.getObjectLayer('collision')?.objects ?? []) {
      this.pathfinder.blockRect(o.x!, o.y!, o.width!, o.height!);
    }

    // camera: the whole room centered, zoom sized to the viewport
    const cam = this.cameras.main;
    const fitZoom = Math.min(this.scale.width / this.roomW, this.scale.height / this.roomH);
    cam.setZoom(snapZoom(Phaser.Math.Clamp(fitZoom, CAMERA.minZoom, CAMERA.maxZoom)));
    cam.centerOn(this.roomW / 2, this.roomH / 2);
    cam.setBackgroundColor('#0a0a14');
    // on a phone the room is wider than the viewport: pan/pinch (TZ-09); if it fits
    // entirely — the clamp keeps it centered and camera controls simply do nothing
    attachCameraControls(this, {
      minZoom: cam.zoom,
      bounds: { width: this.roomW, height: this.roomH },
    });

    // clicking someone asleep in bed wakes them (profile/chat still opens)
    const onAgentClicked = ({ agentId }: { agentId: string }) => {
      const sprite = this.agentSprites.get(agentId);
      if (sprite?.isSeated && sprite.currentSeatKind === 'bed') this.wakeFromBed(agentId);
    };
    GameBridge.on('agent:clicked', onAgentClicked);

    // clicking an agent in the HUD — the camera pans onto them in interiors too (TZ-16)
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
      // leaving the location = all seats free (sprites are destroyed by the scene)
      this.agentSprites.clear();
      this.pendingSeat.clear();
      this.bedWakeHours.clear();
      this.assignedSlot.clear();
      this.seats.forEach(s => { s.occupiedBy = null; });
    });

    GameBridge.emit('scene:changed', { scene: this.sceneKey });
  }

  // ------- walkability interface for AgentSprite
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
      // reached the seat — sits down
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
      // morning: sleepers in beds get up, each at their own hour
      if (a.isSeated && a.currentSeatKind === 'bed' && !isSleepTime(hour)) {
        const wakeAt = this.bedWakeHours.get(a.agentId) ?? NIGHT_SCHEDULE.wakeStart;
        if (hour >= wakeAt && hour < NIGHT_SCHEDULE.sleepStart) this.wakeFromBed(a.agentId);
      }
    });
  }

  /** Get an agent out of bed: the seat is freed, the agent wanders around the room. */
  private wakeFromBed(agentId: string) {
    const sprite = this.agentSprites.get(agentId);
    if (!sprite) return;
    this.releaseSeatOf(agentId);
    this.bedWakeHours.delete(agentId);
    sprite.releaseSeat();
  }

  /** Transition to another scene with fade (the doormat door and agent:goto from the HUD). */
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
    // THE KEY FIX of TZ-16: draw only those who per the server are actually in this
    // building — not all of the user's agents at the entry point, as before.
    // TZ-16 + spec §8.1: venue id == server location. F-3: an unknown/absent id never
    // reaches this point at all — useGameSync partitions the roster through
    // PresenceModel (game/presence.ts) before any scene sees it, so `fullList` here
    // is already everyone PresenceModel placed "somewhere" (any venue, or farm). This
    // filter picks out just this venue's occupants from that already-honest set.
    const agentList = fullList.filter(a => a.location === this.locationId);
    const incoming = new Set(agentList.map(a => a.id));
    this.agentSprites.forEach((sprite, id) => {
      if (!incoming.has(id)) {
        this.releaseSeatOf(id);
        this.pendingSeat.delete(id);
        this.assignedSlot.delete(id);
        sprite.destroy();
        this.agentSprites.delete(id);
      }
    });
    // Deterministic layout: chairs fill before anyone stands, and the same agent
    // sits in the same place after a reload. assignSlots recomputes the WHOLE
    // roster's arrangement from scratch every call — it is a pure function of
    // ids + venue + footprints, not an incremental patch — so a newcomer's rank
    // can shift an already-present agent's rank too (any id whose hash sorts
    // after the newcomer's moves up one). Furniture footprints exclude the
    // occupied cells (F-14).
    const slots = assignSlots(this.venue, agentList.map(a => a.id), this.furnitureFootprints);
    if (isOverCapacity(this.venue, agentList.length)) {
      // R-3: the over-capacity UX is deferred; we record the fact so it stays visible
      console.debug(`[${this.venue.id}] over capacity: ${agentList.length}/${this.venue.capacity}`);
    }

    const standingCount = Math.max(0, agentList.length - this.seats.length);
    const hour = GameTime.hour;

    agentList.forEach(a => {
      const slot = slots.get(a.id)!;
      let sprite = this.agentSprites.get(a.id);
      if (!sprite) {
        sprite = new AgentSprite(this, a.id, a.name, a.avatarVariant, this.spawnPoint.x, this.spawnPoint.y);
        this.agentSprites.set(a.id, sprite);
      }

      // A ranked seat can be off-limits to THIS agent right now:
      //  - animals do not climb onto beds, ever (I-13: currently unreachable —
      //    no agent is assigned an animal appearance — but harmless to keep);
      //  - nobody does, outside sleep hours: O-3 puts sleepers in beds at
      //    night, but a bed taken by day would be immediately vacated by the
      //    existing same-tick wake-from-bed check in update() below, producing
      //    an invisible sit/stand glitch. Treating a daytime bed as
      //    unavailable — exactly like the animal case — routes both through
      //    the same collision-free floor fallback (venueSlots.displacedSlot).
      const isAnimal = getVariant(a.avatarVariant).kind === 'animal';
      const seat = slot.seatIndex !== null ? this.seats[slot.seatIndex] : undefined;
      const bedBlocked = seat?.kind === 'bed' && (isAnimal || !isSleepTime(hour));
      const seatAllowed = !!seat && !bedBlocked;

      const target: Slot = seatAllowed
        ? { x: seat!.x, y: seat!.y, seatIndex: slot.seatIndex }
        : seat
          ? { ...displacedSlot(this.venue, a.id, slot.seatIndex!, standingCount, this.furnitureFootprints), seatIndex: null }
          : slot;

      // Reconcile, don't patch: if this agent's target hasn't changed since we
      // last reconciled them, they are either already there or already walking
      // there — nothing to do. This is what makes the deterministic mapping
      // above safe to recompute on every call (including polling ticks where
      // the roster didn't actually change) without constantly restarting
      // already-settled agents' walk/sit animation.
      const previous = this.assignedSlot.get(a.id);
      if (previous && previous.seatIndex === target.seatIndex
        && previous.x === target.x && previous.y === target.y) return;
      this.assignedSlot.set(a.id, target);

      // Vacate whatever seat this agent previously held (a no-op if they
      // weren't seated, or if some other agent already reconciled into it —
      // matching by id, never by index, so this can't clobber someone else's
      // claim). The seat this agent is moving INTO is claimed fresh below,
      // which is what makes double-seating structurally impossible: at the
      // end of this loop every seat's occupiedBy matches exactly the one
      // agent whose rank points at it, regardless of iteration order.
      this.releaseSeatOf(a.id);
      this.pendingSeat.delete(a.id);

      if (seatAllowed) {
        seat!.occupiedBy = a.id;
        this.pendingSeat.set(a.id, seat!);
      }
      sprite.walkTo(target.x, target.y);
    });

    // we came here for a specific agent from the HUD — aim the camera (TZ-16)
    consumePendingFocus(this.sceneKey, id => this.agentSprites.has(id));
  }

  private releaseSeatOf(agentId: string) {
    const seat = this.seats.find(s => s.occupiedBy === agentId);
    if (seat) seat.occupiedBy = null;
  }
}

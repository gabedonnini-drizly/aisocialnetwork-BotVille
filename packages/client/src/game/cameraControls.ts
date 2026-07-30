import Phaser from 'phaser';
import { CAMERA, CAMERA_DRAG, nextZoom, snapZoom } from './config.js';

/**
 * Shared camera controls (TZ-09), one implementation for all scenes:
 *  - pan with a normal left drag / single-finger drag (middle button and Shift+drag
 *    work as before — those are "drags" too);
 *  - two-finger pinch — zoom with panning by the gesture midpoint;
 *  - wheel zoom and the +/- keys;
 *  - pan inertia after release.
 * Click and pan are separated by the CAMERA_DRAG.tapPx threshold: attach object clicks
 * via onTap (fires on pointerup if the pointer didn't travel), not
 * via pointerdown.
 */

// Pinch is global (one gesture per game): a guard so that lifting the second finger
// over an agent/building isn't counted as a tap.
let pinchActive = false;
let pinchEndedAt = 0;

/** Click/tap on an interactive object with a movement threshold (a click ≠ the start of a pan). */
export function onTap(
  obj: Phaser.GameObjects.GameObject,
  handler: (p: Phaser.Input.Pointer) => void,
): void {
  obj.on('pointerup', (p: Phaser.Input.Pointer) => {
    if (pinchActive || Date.now() - pinchEndedAt < CAMERA_DRAG.pinchTapGuardMs) return;
    if (p.getDistance() <= CAMERA_DRAG.tapPx) handler(p);
  });
}

export interface CameraControlOptions {
  /** Zoom clamp; defaults to CAMERA.min/maxZoom. */
  minZoom?: number;
  maxZoom?: number;
  /**
   * Soft scroll clamp based on world size: an axis where the world is narrower than
   * the viewport is kept centered (for interiors). Without bounds the clamp stays on
   * the scene's cam.setBounds (the district).
   */
  bounds?: { width: number; height: number };
}

export function attachCameraControls(scene: Phaser.Scene, opts: CameraControlOptions = {}): void {
  const cam = scene.cameras.main;
  const minZoom = opts.minZoom ?? CAMERA.minZoom;
  const maxZoom = opts.maxZoom ?? CAMERA.maxZoom;

  const clampScroll = () => {
    if (!opts.bounds) return;
    const { width: bw, height: bh } = opts.bounds;
    const dw = cam.displayWidth;
    const dh = cam.displayHeight;
    cam.scrollX = dw >= bw
      ? (bw - cam.width) / 2
      : Phaser.Math.Clamp(cam.scrollX, (dw - cam.width) / 2, bw - (dw + cam.width) / 2);
    cam.scrollY = dh >= bh
      ? (bh - cam.height) / 2
      : Phaser.Math.Clamp(cam.scrollY, (dh - cam.height) / 2, bh - (dh + cam.height) / 2);
  };

  const setZoom = (z: number) => {
    cam.setZoom(Phaser.Math.Clamp(z, minZoom, maxZoom));
    clampScroll();
  };

  // dx/dy — pointer movement in screen px
  const applyPan = (dx: number, dy: number) => {
    cam.panEffect.reset(); // a manual drag overrides the agent:focus auto-pan
    cam.scrollX -= dx / cam.zoom;
    cam.scrollY -= dy / cam.zoom;
    clampScroll();
  };

  let panning = false;
  let inertiaOn = false;
  let vx = 0; // smoothed pan speed, screen px/sec
  let vy = 0;
  let lastMoveAt = 0;
  let pinch: { dist: number; midX: number; midY: number } | null = null;

  const endPinch = () => {
    setZoom(snapZoom(cam.zoom));
    pinch = null;
    pinchActive = false;
    pinchEndedAt = Date.now();
  };

  scene.input.keyboard?.on('keydown-EQUAL', () =>
    cam.zoomTo(nextZoom(cam.zoom, 1), 300));
  scene.input.keyboard?.on('keydown-MINUS', () =>
    cam.zoomTo(nextZoom(cam.zoom, -1), 300));
  scene.input.on('wheel', (_p: unknown, _go: unknown, _dx: number, dy: number) => {
    if (dy !== 0) setZoom(nextZoom(cam.zoom, dy < 0 ? 1 : -1));
  });

  scene.input.on('pointerdown', () => {
    inertiaOn = false;
    vx = vy = 0;
  });

  scene.input.on('pointermove', (p: Phaser.Input.Pointer) => {
    const p1 = scene.input.manager.pointers[1];
    const p2 = scene.input.manager.pointers[2];
    if (p1?.isDown && p2?.isDown) {
      // pinch: zoom by the change in finger distance, pan by the midpoint shift
      pinchActive = true;
      panning = false;
      const dist = Phaser.Math.Distance.Between(p1.x, p1.y, p2.x, p2.y);
      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;
      if (pinch) {
        if (pinch.dist > 0) setZoom(cam.zoom * (dist / pinch.dist));
        applyPan(midX - pinch.midX, midY - pinch.midY);
      }
      pinch = { dist, midX, midY };
      return;
    }
    if (pinch) endPinch();
    if (!p.isDown || p.rightButtonDown()) return;
    if (!panning && p.getDistance() < CAMERA_DRAG.tapPx) return;
    panning = true;
    const dx = p.x - p.prevPosition.x;
    const dy = p.y - p.prevPosition.y;
    applyPan(dx, dy);
    const now = Date.now();
    const dt = Phaser.Math.Clamp((now - lastMoveAt) / 1000, 0.001, 0.05);
    lastMoveAt = now;
    vx = 0.8 * (dx / dt) + 0.2 * vx;
    vy = 0.8 * (dy / dt) + 0.2 * vy;
  });

  scene.input.on('pointerup', (p: Phaser.Input.Pointer) => {
    const p1 = scene.input.manager.pointers[1];
    const p2 = scene.input.manager.pointers[2];
    if (pinch && !(p1?.isDown && p2?.isDown)) endPinch();
    if (!panning) return;
    panning = false;
    // released while moving — the camera coasts on inertia
    if (Date.now() - lastMoveAt < 100 && Math.hypot(vx, vy) > CAMERA_DRAG.inertiaMinSpeed) {
      inertiaOn = true;
    }
    void p;
  });

  const onUpdate = (_t: number, dms: number) => {
    if (!inertiaOn) return;
    const dt = dms / 1000;
    applyPan(vx * dt, vy * dt);
    const decay = Math.exp(-dt / CAMERA_DRAG.inertiaTauSec);
    vx *= decay;
    vy *= decay;
    if (Math.hypot(vx, vy) < CAMERA_DRAG.inertiaMinSpeed) inertiaOn = false;
  };
  scene.events.on(Phaser.Scenes.Events.UPDATE, onUpdate);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.events.off(Phaser.Scenes.Events.UPDATE, onUpdate);
    if (pinch) endPinch();
  });

  clampScroll();
}

import Phaser from 'phaser';
import { CAMERA, CAMERA_DRAG } from './config.js';

/**
 * Общее управление камерой (ТЗ-09), одно на все сцены:
 *  - пан обычным левым драгом / однопальцевым драгом (middle и Shift+драг
 *    работают как раньше — это тоже «драг»);
 *  - pinch двумя пальцами — зум с паном по середине жеста;
 *  - wheel-зум и клавиши +/-;
 *  - инерция пана после отпускания.
 * Клик и пан разводятся порогом CAMERA_DRAG.tapPx: клики по объектам вешать
 * через onTap (срабатывает на pointerup, если указатель не уехал), а не
 * через pointerdown.
 */

// Pinch глобален (жест один на игру): guard, чтобы отпускание второго пальца
// над агентом/зданием не считалось tap'ом.
let pinchActive = false;
let pinchEndedAt = 0;

/** Клик/тап по интерактивному объекту с порогом сдвига (клик ≠ начало пана). */
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
  /** Кламп зума; по умолчанию CAMERA.min/maxZoom. */
  minZoom?: number;
  maxZoom?: number;
  /**
   * Мягкий кламп скролла по размеру мира: ось, где мир уже вьюпорта,
   * держится по центру (для интерьеров). Без bounds кламп остаётся на
   * cam.setBounds сцены (район).
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

  // dx/dy — сдвиг указателя в px экрана
  const applyPan = (dx: number, dy: number) => {
    cam.panEffect.reset(); // ручной драг перебивает автопан agent:focus
    cam.scrollX -= dx / cam.zoom;
    cam.scrollY -= dy / cam.zoom;
    clampScroll();
  };

  let panning = false;
  let inertiaOn = false;
  let vx = 0; // сглаженная скорость пана, px экрана/сек
  let vy = 0;
  let lastMoveAt = 0;
  let pinch: { dist: number; midX: number; midY: number } | null = null;

  const endPinch = () => {
    pinch = null;
    pinchActive = false;
    pinchEndedAt = Date.now();
  };

  scene.input.keyboard?.on('keydown-EQUAL', () =>
    cam.zoomTo(Phaser.Math.Clamp(cam.zoom * CAMERA.zoomStep, minZoom, maxZoom), 300));
  scene.input.keyboard?.on('keydown-MINUS', () =>
    cam.zoomTo(Phaser.Math.Clamp(cam.zoom / CAMERA.zoomStep, minZoom, maxZoom), 300));
  scene.input.on('wheel', (_p: unknown, _go: unknown, _dx: number, dy: number) => {
    setZoom(cam.zoom - dy * 0.001);
  });

  scene.input.on('pointerdown', () => {
    inertiaOn = false;
    vx = vy = 0;
  });

  scene.input.on('pointermove', (p: Phaser.Input.Pointer) => {
    const p1 = scene.input.manager.pointers[1];
    const p2 = scene.input.manager.pointers[2];
    if (p1?.isDown && p2?.isDown) {
      // pinch: зум по изменению дистанции пальцев, пан — по сдвигу середины
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
    // отпустили в движении — камера докатывается по инерции
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

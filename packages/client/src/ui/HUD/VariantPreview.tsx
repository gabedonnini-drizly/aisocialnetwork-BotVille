import { useEffect, useRef } from 'react';
import { type AvatarVariantDef, animStartFrame } from '../../game/assetManifest.js';

/** Sheet cache: one Image per file, shared by all previews. */
const sheetCache = new Map<string, Promise<HTMLImageElement>>();

function loadSheet(src: string): Promise<HTMLImageElement> {
  let p = sheetCache.get(src);
  if (!p) {
    p = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
    sheetCache.set(src, p);
  }
  return p;
}

/** Integer preview scale by frame height (don't blur the pixel art). */
const SCALE_BY_FRAME_H: Record<number, number> = { 16: 3, 32: 2, 48: 1 };

const PREVIEW_FPS = 5;

interface Props {
  variant: AvatarVariantDef;
}

/** Live variant preview: a looped idle animation facing the viewer. */
export function VariantPreview({ variant }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const scale = SCALE_BY_FRAME_H[variant.frameHeight] ?? 1;
  const w = variant.frameWidth * scale;
  const h = variant.frameHeight * scale;

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;

    loadSheet('/' + variant.file).then((sheet) => {
      if (cancelled) return;
      const ctx = canvasRef.current?.getContext('2d');
      if (!ctx) return;
      ctx.imageSmoothingEnabled = false;

      const start = animStartFrame(variant, 'idle', 'down');
      let step = 0;
      const draw = () => {
        const frame = start + (step % variant.framesPerDirection);
        const sx = (frame % variant.sheetColumns) * variant.frameWidth;
        const sy = Math.floor(frame / variant.sheetColumns) * variant.frameHeight;
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(sheet, sx, sy, variant.frameWidth, variant.frameHeight, 0, 0, w, h);
        step++;
      };
      draw();
      timer = setInterval(draw, 1000 / PREVIEW_FPS);
    }).catch(() => { /* no assets — leave the cell empty */ });

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [variant, w, h]);

  return <canvas ref={canvasRef} width={w} height={h} style={{ width: w, height: h }} />;
}

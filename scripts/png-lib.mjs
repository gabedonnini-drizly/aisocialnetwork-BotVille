/**
 * Мини-библиотека PNG без зависимостей: decode (non-interlaced, 8-bit),
 * encode (RGBA), blit. Используется инструментами разведки ассетов и
 * генератором карт/атласов.
 */
import { readFileSync } from 'node:fs';
import { inflateSync, deflateSync, crc32 } from 'node:zlib';

/** @returns {{w:number,h:number,px:(x:number,y:number)=>[number,number,number,number]}} */
export function decodePng(file) {
  const buf = readFileSync(file);
  let pos = 8;
  const idat = [];
  let w = 0, h = 0, bitDepth = 8, colorType = 6, palette = null, trns = null;
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4);
      bitDepth = data[8]; colorType = data[9];
      if (data[12] !== 0) throw new Error(`interlaced PNG not supported: ${file}`);
    } else if (type === 'PLTE') palette = data;
    else if (type === 'tRNS') trns = data;
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  if (bitDepth !== 8) throw new Error(`bitDepth ${bitDepth} not supported: ${file}`);
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType];
  const raw = inflateSync(Buffer.concat(idat));
  const stride = w * channels;
  const out = Buffer.alloc(h * stride);
  let rp = 0;
  for (let y = 0; y < h; y++) {
    const filter = raw[rp++];
    const row = out.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const rv = raw[rp + x];
      const a = x >= channels ? row[x - channels] : 0;
      const b = prev ? prev[x] : 0;
      const c = x >= channels && prev ? prev[x - channels] : 0;
      let v;
      switch (filter) {
        case 0: v = rv; break;
        case 1: v = rv + a; break;
        case 2: v = rv + b; break;
        case 3: v = rv + ((a + b) >> 1); break;
        case 4: {
          const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
          v = rv + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
          break;
        }
        default: throw new Error(`bad filter ${filter} in ${file}`);
      }
      row[x] = v & 0xff;
    }
    rp += stride;
  }
  const px = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return [0, 0, 0, 0];
    const i = y * stride + x * channels;
    switch (colorType) {
      case 6: return [out[i], out[i + 1], out[i + 2], out[i + 3]];
      case 2: return [out[i], out[i + 1], out[i + 2], 255];
      case 4: return [out[i], out[i], out[i], out[i + 1]];
      case 0: return [out[i], out[i], out[i], 255];
      case 3: {
        const idx = out[i];
        const a = trns && idx < trns.length ? trns[idx] : 255;
        return [palette[idx * 3], palette[idx * 3 + 1], palette[idx * 3 + 2], a];
      }
    }
  };
  return { w, h, px };
}

/** Изменяемый RGBA-холст. */
export function createCanvas(w, h) {
  const data = Buffer.alloc(w * h * 4);
  return {
    w, h, data,
    set(x, y, [r, g, b, a]) {
      if (x < 0 || y < 0 || x >= w || y >= h) return;
      const i = (y * w + x) * 4;
      data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = a;
    },
    /** Копирует регион из декодированного PNG (альфа поверх — простой over). */
    blit(src, sx, sy, sw, sh, dx, dy) {
      for (let y = 0; y < sh; y++) {
        for (let x = 0; x < sw; x++) {
          const p = src.px(sx + x, sy + y);
          if (p[3] === 0) continue;
          this.set(dx + x, dy + y, p);
        }
      }
    },
  };
}

export function encodePng(canvas) {
  const { w, h, data } = canvas;
  const stride = w * 4;
  const raw = Buffer.alloc(h * (stride + 1));
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0;
    data.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const mk = (type, payload) => {
    const b = Buffer.alloc(12 + payload.length);
    b.writeUInt32BE(payload.length, 0);
    b.write(type, 4);
    payload.copy(b, 8);
    b.writeUInt32BE(crc32(b.subarray(4, 8 + payload.length)) >>> 0, 8 + payload.length);
    return b;
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    mk('IHDR', ihdr),
    mk('IDAT', deflateSync(raw, { level: 9 })),
    mk('IEND', Buffer.alloc(0)),
  ]);
}

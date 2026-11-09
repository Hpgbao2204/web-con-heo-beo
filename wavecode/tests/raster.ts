// Tiện ích test: render SVG → raster (resvg), rồi làm "bẩn" ảnh như ảnh chụp thật.

import { Resvg } from '@resvg/resvg-js';
import type { RgbaImage } from '../src/scanner/binarize';

export interface Distort {
  scale: number;
  rotateDeg: number;
  blurSigma: number;
  noiseSigma: number;
  /** biên độ gradient ánh sáng (0..1) */
  lighting: number;
  /** khoảng nền thêm quanh mã (theo tỉ lệ kích thước mã) */
  margin: number;
  /** ảnh nền ngoài mã */
  surround?: string;
}

/** đặt SVG mã vào khung lớn hơn, xoay + scale quanh tâm, rồi raster */
export function rasterize(codeSvg: string, d: Pick<Distort, 'scale' | 'rotateDeg' | 'margin' | 'surround'>): RgbaImage {
  const m = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(codeSvg)!;
  const cw = parseFloat(m[1]);
  const ch = parseFloat(m[2]);
  const W = Math.ceil(cw * d.scale * (1 + d.margin));
  const H = Math.ceil(Math.max(ch * d.scale * (1 + d.margin), cw * d.scale * 0.45));
  const inner = codeSvg.replace(/^<svg /, `<svg x="0" y="0" `);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<rect width="100%" height="100%" fill="${d.surround ?? '#9a9a9a'}"/>` +
    `<g transform="translate(${W / 2} ${H / 2}) rotate(${d.rotateDeg}) scale(${d.scale}) translate(${-cw / 2} ${-ch / 2})">` +
    inner +
    `</g></svg>`;
  const r = new Resvg(svg, { background: 'rgba(0,0,0,0)' }).render();
  return { width: r.width, height: r.height, data: new Uint8Array(r.pixels) };
}

function gaussKernel(sigma: number): Float32Array {
  const r = Math.max(1, Math.ceil(sigma * 3));
  const k = new Float32Array(2 * r + 1);
  let s = 0;
  for (let i = -r; i <= r; i++) s += k[i + r] = Math.exp(-(i * i) / (2 * sigma * sigma));
  for (let i = 0; i < k.length; i++) k[i] /= s;
  return k;
}

/** blur Gauss tách trục, trên 3 kênh RGB */
export function blur(img: RgbaImage, sigma: number): RgbaImage {
  if (sigma <= 0.05) return img;
  const { width: W, height: H } = img;
  const k = gaussKernel(sigma);
  const r = (k.length - 1) / 2;
  const src = Float32Array.from(img.data);
  const tmp = new Float32Array(src.length);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      for (let ch = 0; ch < 3; ch++) {
        let s = 0;
        for (let i = -r; i <= r; i++) {
          const xx = Math.min(W - 1, Math.max(0, x + i));
          s += src[(y * W + xx) * 4 + ch] * k[i + r];
        }
        tmp[(y * W + x) * 4 + ch] = s;
      }
  const out = new Uint8Array(img.data.length);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      for (let ch = 0; ch < 3; ch++) {
        let s = 0;
        for (let i = -r; i <= r; i++) {
          const yy = Math.min(H - 1, Math.max(0, y + i));
          s += tmp[(yy * W + x) * 4 + ch] * k[i + r];
        }
        out[(y * W + x) * 4 + ch] = Math.round(s);
      }
      out[(y * W + x) * 4 + 3] = 255;
    }
  return { width: W, height: H, data: out };
}

/** nhiễu Gauss + gradient ánh sáng chéo */
export function noiseAndLight(img: RgbaImage, sigma: number, lighting: number, gauss: () => number, rnd: () => number): RgbaImage {
  const { width: W, height: H } = img;
  const out = new Uint8Array(img.data.length);
  const ang = rnd() * Math.PI * 2;
  const gx = Math.cos(ang);
  const gy = Math.sin(ang);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const t = ((x / W - 0.5) * gx + (y / H - 0.5) * gy) * 2; // -1..1
      const gain = 1 - lighting * (0.5 + 0.5 * t);
      const n = gauss() * sigma;
      for (let ch = 0; ch < 3; ch++) out[i + ch] = Math.max(0, Math.min(255, img.data[i + ch] * gain + n));
      out[i + 3] = 255;
    }
  return { width: W, height: H, data: out };
}

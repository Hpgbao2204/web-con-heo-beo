import { describe, it, expect } from 'vitest';
import QRCode from 'qrcode';
import { renderIdSvg, type QrMatrix } from '../shared/wavecode/encode';
import { scanImage } from '../src/scanner/pipeline';
import { rasterize, blur, noiseAndLight } from './raster';
import { rng } from './helpers';

function qrMatrix(text: string): QrMatrix {
  const q = QRCode.create(text, { errorCorrectionLevel: 'M' });
  return { size: q.modules.size, get: (r, c) => !!q.modules.data[r * q.modules.size + c] };
}

const PALETTES = [
  { fg: '#111111', bg: '#ffffff' },
  { fg: '#1e1b4b', bg: '#fef3c7' },
  { fg: '#ffffff', bg: '#101828' }, // thanh sáng trên nền tối
  { fg: '#0f766e', bg: '#f0fdfa' },
];

describe('Scanner pipeline trên ảnh raster', () => {
  it('ảnh sạch, đúng kích thước → đọc đúng (có/không QR, cả hai chiều)', () => {
    const R = rng(100);
    for (let t = 0; t < 12; t++) {
      const id = R.u32();
      const qr = t % 2 ? qrMatrix('https://192.168.1.10:5173/scan') : null;
      const svg = renderIdSvg(id, { qr });
      const img = rasterize(svg, { scale: 1, rotateDeg: t % 3 === 0 ? 180 : 0, margin: 0.1 });
      expect(scanImage(img)?.id).toBe(id);
    }
  });

  it('nhiễu + blur + xoay ±8° + scale 50–150% → đọc đúng ≥ 95%', () => {
    const R = rng(2024);
    const N = 240;
    let ok = 0;
    const fails: string[] = [];
    for (let t = 0; t < N; t++) {
      const id = R.u32();
      const pal = PALETTES[t % PALETTES.length];
      const withQr = R.next() < 0.5;
      const svg = renderIdSvg(id, { ...pal, qr: withQr ? qrMatrix(`https://192.168.1.10:5173/p/${id.toString(16)}`) : null });
      const d = {
        scale: R.range(0.5, 1.5),
        rotateDeg: R.range(-8, 8) + (R.next() < 0.15 ? 180 : 0),
        blurSigma: R.range(0.3, 1.3),
        noiseSigma: R.range(4, 18),
        lighting: R.range(0, 0.35),
        margin: R.range(0.05, 0.4),
        surround: R.next() < 0.5 ? '#8a8a8a' : '#d0d0d0',
      };
      let img = rasterize(svg, d);
      img = blur(img, d.blurSigma * Math.max(0.6, d.scale));
      img = noiseAndLight(img, d.noiseSigma, d.lighting, R.gauss, R.next);
      const res = scanImage(img);
      if (res?.id === id) ok++;
      else
        fails.push(
          `id=${id.toString(16)} got=${res?.idHex ?? 'null'} s=${d.scale.toFixed(2)} rot=${d.rotateDeg.toFixed(1)} blur=${d.blurSigma.toFixed(2)} noise=${d.noiseSigma.toFixed(0)} qr=${withQr} pal=${pal.fg}`,
        );
      // không bao giờ được đọc ra ID SAI
      if (res) expect(res.id).toBe(id);
    }
    const rate = ok / N;
    console.log(`raster: ${ok}/${N} = ${(rate * 100).toFixed(1)}%`);
    if (fails.length) console.log(fails.slice(0, 10).join('\n'));
    expect(rate).toBeGreaterThanOrEqual(0.95);
  }, 120_000);

  it('ảnh không có mã → null', () => {
    const R = rng(5);
    const blank = { width: 400, height: 200, data: new Uint8Array(400 * 200 * 4).fill(255) };
    expect(scanImage(noiseAndLight(blank, 20, 0.3, R.gauss, R.next))).toBeNull();
    // chỉ có QR, không có sóng
    const svg = renderIdSvg(1, { qr: qrMatrix('https://x/scan'), variant: 'qr' });
    expect(scanImage(rasterize(svg, { scale: 1, rotateDeg: 0, margin: 0.2 }))).toBeNull();
  });
});

import { describe, it, expect } from 'vitest';
import jsQR from 'jsqr';
import { Resvg } from '@resvg/resvg-js';
import { renderCode } from '../api/_lib/code';

// dontInvert: giống camera gốc không hỗ trợ QR đảo màu
function readQr(svg: string, zoom: number) {
  const r = new Resvg(svg, { fitTo: { mode: 'zoom', value: zoom } }).render();
  return jsQR(new Uint8ClampedArray(r.pixels), r.width, r.height, { inversionAttempts: 'dontInvert' })?.data ?? null;
}

const base = 'https://wavecode-demo.vercel.app';

describe('QR nhỏ trong hình tròn', () => {
  it('chế độ scanner → mở /scan (biến thể combo và chỉ QR)', () => {
    for (const variant of ['combo', 'qr'] as const)
      for (const zoom of [1, 2, 3])
        expect(readQr(renderCode('0a1b2c3d', { base, qr: 'scanner', variant }).svg, zoom)).toBe(`${base}/scan?src=qr`);
  });
  it('chế độ direct → mở thẳng trang phát', () => {
    expect(readQr(renderCode('0a1b2c3d', { base, qr: 'direct' }).svg, 2)).toBe(`${base}/p/0a1b2c3d?src=qr`);
  });
  it('màu tuỳ chỉnh (thanh sáng, nền tối) vẫn đọc được QR không đảo màu', () => {
    const { svg } = renderCode('0a1b2c3d', { base, qr: 'scanner', fg: '#ffffff', bg: '#0b0b12' });
    expect(readQr(svg, 2)).toBe(`${base}/scan?src=qr`);
  });
  it('chế độ none → không có QR', () => {
    const { svg, qrUrl } = renderCode('0a1b2c3d', { base, qr: 'none' });
    expect(qrUrl).toBeNull();
    expect(svg).not.toContain('wc-qr');
  });
});

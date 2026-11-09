import { describe, it, expect } from 'vitest';
import {
  DATA_BARS,
  encodeLevels,
  encodeCodeword,
  codewordToLevels,
  levelsToCodeword,
  decodeLevels,
  decodeHeights,
  decodeRatios,
  levelToRatio,
  grayEncode,
  grayDecode,
  renderIdSvg,
  layout,
  idToHex,
  contrastRatio,
  sanitizeColors,
} from '../shared/wavecode';
import { rng } from './helpers';

describe('Gray code', () => {
  it('encode/decode là nghịch đảo của nhau', () => {
    for (let v = 0; v < 8; v++) expect(grayDecode(grayEncode(v))).toBe(v);
  });
  it('hai mức kề nhau khác đúng 1 bit', () => {
    for (let l = 0; l < 7; l++) {
      const x = grayDecode(l) ^ grayDecode(l + 1);
      expect(x & (x - 1)).toBe(0);
      expect(x).not.toBe(0);
    }
  });
});

describe('WaveCode v1 encode/decode', () => {
  it('24 mức, mỗi mức trong 0..7; bits ↔ mức là song ánh', () => {
    const lv = encodeLevels(0x12345678);
    expect(lv).toHaveLength(DATA_BARS);
    expect(lv.every((l) => l >= 0 && l <= 7)).toBe(true);
    const cw = encodeCodeword(0x12345678);
    expect(Array.from(levelsToCodeword(codewordToLevels(cw)))).toEqual(Array.from(cw));
  });

  it('round-trip 10.000 ID ngẫu nhiên', () => {
    const R = rng(42);
    const ids = [0, 1, 0xffffffff, 0x80000000, ...Array.from({ length: 10000 }, () => R.u32())];
    for (const id of ids) {
      const d = decodeLevels(encodeLevels(id));
      expect(d).not.toBeNull();
      expect(d!.id).toBe(id >>> 0);
      expect(d!.idHex).toBe(idToHex(id));
      expect(d!.corrected).toBe(0);
    }
  });

  it('lệch ±1 mức ở 1 thanh bất kỳ vẫn giải đúng (vét cạn)', () => {
    const R = rng(7);
    for (let t = 0; t < 300; t++) {
      const id = R.u32();
      const lv = encodeLevels(id);
      for (let i = 0; i < DATA_BARS; i++) {
        for (const delta of [-1, 1]) {
          const nl = lv[i] + delta;
          if (nl < 0 || nl > 7) continue;
          const bad = lv.slice();
          bad[i] = nl;
          expect(decodeLevels(bad)?.id).toBe(id);
        }
      }
    }
  });

  it('lệch ±1 mức ở 2 thanh bất kỳ vẫn giải đúng', () => {
    const R = rng(8);
    for (let t = 0; t < 20000; t++) {
      const id = R.u32();
      const lv = encodeLevels(id);
      const i = R.int(DATA_BARS);
      let j = R.int(DATA_BARS);
      while (j === i) j = R.int(DATA_BARS);
      const bad = lv.slice();
      for (const k of [i, j]) bad[k] = bad[k] === 0 ? 1 : bad[k] === 7 ? 6 : bad[k] + (R.next() < 0.5 ? -1 : 1);
      expect(decodeLevels(bad)?.id).toBe(id);
    }
  });

  it('giải từ chiều cao (có START/END, scale bất kỳ, nhiễu nhỏ)', () => {
    const R = rng(9);
    for (let t = 0; t < 2000; t++) {
      const id = R.u32();
      const H = R.range(20, 400);
      const heights = [H, ...encodeLevels(id).map((l) => H * levelToRatio(l) * (1 + R.gauss() * 0.01)), H];
      expect(decodeHeights(heights)?.id).toBe(id);
    }
  });

  it('decodeRatios cứu được 3 thanh lệch nhờ thử mức kề cho thanh lưỡng lự', () => {
    const R = rng(10);
    let ok = 0;
    for (let t = 0; t < 500; t++) {
      const id = R.u32();
      const lv = encodeLevels(id);
      const ratios = lv.map(levelToRatio);
      // 3 thanh bị đọc lệch gần nửa mức sang phía sai → lỗi cứng 3 thanh
      const picks = new Set<number>();
      while (picks.size < 3) picks.add(R.int(DATA_BARS));
      for (const k of picks) {
        const dir = lv[k] === 7 ? -1 : lv[k] === 0 ? 1 : R.next() < 0.5 ? -1 : 1;
        ratios[k] += dir * (0.75 / 7) * 0.55;
      }
      if (decodeRatios(ratios)?.id === id) ok++;
    }
    expect(ok / 500).toBeGreaterThan(0.95);
  });

  it('sai version → từ chối', () => {
    // dựng codeword version 0x02 hợp lệ RS
    const cw = encodeCodeword(0xabcdef01, 0x02);
    expect(decodeLevels(codewordToLevels(cw))).toBeNull();
  });

  it('mảng ngẫu nhiên hầu như không bị nhận nhầm', () => {
    const R = rng(11);
    let falsePos = 0;
    for (let t = 0; t < 50000; t++) {
      const lv = Array.from({ length: DATA_BARS }, () => R.int(8));
      if (decodeLevels(lv)) falsePos++;
    }
    expect(falsePos).toBeLessThan(5);
  });
});

describe('Bố cục & SVG', () => {
  it('26 thanh + chấm, START/END cao tối đa, quiet zone 4w', () => {
    const L = layout(encodeLevels(123), { w: 8, H: 120 });
    expect(L.bars).toHaveLength(26);
    expect(L.bars[0].height).toBe(120);
    expect(L.bars[25].height).toBe(120);
    expect(L.bars[0].x).toBe(32);
    expect(L.dot!.cx - L.dot!.r - (L.bars[25].x + 8)).toBe(16); // cách END 2w
    expect(L.width - (L.dot!.cx + L.dot!.r)).toBe(32);
    for (const b of L.bars) expect(b.y + b.height / 2).toBeCloseTo(L.axisY); // đối xứng quanh trục
  });

  it('có QR: hình tròn bên trái, cách START ≥ 6w', () => {
    const qr = { size: 25, get: () => true };
    const L = layout(encodeLevels(123), { qr });
    expect(L.qr).not.toBeNull();
    expect(L.bars[0].x - (L.qr!.cx + L.qr!.r)).toBeGreaterThanOrEqual(6 * 8);
  });

  it('SVG từ chối màu không hợp lệ (chống injection)', () => {
    expect(() => renderIdSvg(1, { fg: 'red"/><script>' })).toThrow();
    const svg = renderIdSvg(1, { fg: '#123456', bg: '#fff', title: '<b>&' });
    expect(svg).toContain('&lt;b&gt;&amp;');
    expect(svg.startsWith('<svg')).toBe(true);
  });

  it('kiểm tra tương phản', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21);
    expect(sanitizeColors('#777777', '#888888').forced).toBe(true);
    expect(sanitizeColors('#ffffff', '#101828')).toEqual({ fg: '#ffffff', bg: '#101828', forced: false });
  });
});

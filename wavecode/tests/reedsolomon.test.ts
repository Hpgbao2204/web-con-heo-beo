import { describe, it, expect } from 'vitest';
import { rsEncode, rsDecode, syndromes, generatorPoly } from '../shared/wavecode/reedsolomon';
import { polyEval, pow2 } from '../shared/wavecode/gf256';
import { rng } from './helpers';

describe('Reed–Solomon GF(256), 4 parity', () => {
  it('đa thức sinh có nghiệm α^0..α^3 và monic', () => {
    const g = generatorPoly(4);
    expect(g.length).toBe(5);
    expect(g[4]).toBe(1);
    for (let i = 0; i < 4; i++) expect(polyEval(g, pow2(i))).toBe(0);
  });

  it('codeword hợp lệ có syndrome = 0 và giữ nguyên message', () => {
    const R = rng(1);
    for (let t = 0; t < 2000; t++) {
      const msg = Array.from({ length: 5 }, () => R.int(256));
      const cw = rsEncode(msg, 4);
      expect(Array.from(cw.slice(0, 5))).toEqual(msg);
      expect(syndromes(cw, 4).every((s) => s === 0)).toBe(true);
      const d = rsDecode(cw, 4)!;
      expect(Array.from(d.message)).toEqual(msg);
      expect(d.corrected).toEqual([]);
    }
  });

  it('sửa được mọi lỗi 1 byte (vét cạn vị trí × giá trị)', () => {
    const msg = [0x01, 0xde, 0xad, 0xbe, 0xef];
    const cw = rsEncode(msg, 4);
    for (let pos = 0; pos < 9; pos++) {
      for (let e = 1; e < 256; e++) {
        const bad = cw.slice();
        bad[pos] ^= e;
        const d = rsDecode(bad, 4);
        expect(d).not.toBeNull();
        expect(Array.from(d!.codeword)).toEqual(Array.from(cw));
        expect(d!.corrected).toEqual([pos]);
      }
    }
  });

  it('sửa được 2 byte lỗi ngẫu nhiên', () => {
    const R = rng(2);
    for (let t = 0; t < 20000; t++) {
      const msg = Array.from({ length: 5 }, () => R.int(256));
      const cw = rsEncode(msg, 4);
      const bad = cw.slice();
      const p1 = R.int(9);
      let p2 = R.int(9);
      while (p2 === p1) p2 = R.int(9);
      bad[p1] ^= 1 + R.int(255);
      bad[p2] ^= 1 + R.int(255);
      const d = rsDecode(bad, 4);
      expect(d).not.toBeNull();
      expect(Array.from(d!.message)).toEqual(msg);
    }
  });

  it('3 byte lỗi: không bao giờ trả về sai mà vẫn báo "đúng" message gốc khi nhận', () => {
    // RS 4 parity không sửa được 3 lỗi; decoder phải trả null hoặc một codeword hợp lệ khác
    const R = rng(3);
    let nulls = 0;
    for (let t = 0; t < 5000; t++) {
      const msg = Array.from({ length: 5 }, () => R.int(256));
      const cw = rsEncode(msg, 4);
      const bad = cw.slice();
      const pos = new Set<number>();
      while (pos.size < 3) pos.add(R.int(9));
      for (const p of pos) bad[p] ^= 1 + R.int(255);
      const d = rsDecode(bad, 4);
      if (!d) nulls++;
      else expect(syndromes(d.codeword, 4).every((s) => s === 0)).toBe(true);
    }
    expect(nulls).toBeGreaterThan(4000);
  });
});

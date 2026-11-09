import { describe, it, expect } from 'vitest';
import { EXP, LOG, mul, div, inv, pow, polyEval, polyMul } from '../shared/wavecode/gf256';

describe('GF(256) / 0x11D', () => {
  it('bảng EXP/LOG là song ánh trên 255 phần tử khác 0', () => {
    const seen = new Set<number>();
    for (let i = 0; i < 255; i++) seen.add(EXP[i]);
    expect(seen.size).toBe(255);
    expect(seen.has(0)).toBe(false);
    for (let x = 1; x < 256; x++) expect(EXP[LOG[x]]).toBe(x);
  });

  it('giá trị đã biết', () => {
    expect(EXP[8]).toBe(0x1d); // α^8 = x^4+x^3+x^2+1
    expect(mul(2, 0x80)).toBe(0x1d);
    expect(mul(0x53, 0xca)).toBe(mul(0xca, 0x53));
  });

  it('mul/div/inv nhất quán với mọi cặp', () => {
    for (let a = 0; a < 256; a++) {
      expect(mul(a, 0)).toBe(0);
      expect(mul(a, 1)).toBe(a);
      if (a === 0) continue;
      expect(mul(a, inv(a))).toBe(1);
      for (let b = 1; b < 256; b += 7) {
        const p = mul(a, b);
        expect(div(p, b)).toBe(a);
        expect(div(p, a)).toBe(b);
      }
    }
  });

  it('phân phối: a(b+c) = ab + ac', () => {
    for (let a = 0; a < 256; a += 3)
      for (let b = 0; b < 256; b += 5)
        for (let c = 0; c < 256; c += 11) expect(mul(a, b ^ c)).toBe(mul(a, b) ^ mul(a, c));
  });

  it('pow và chia cho 0', () => {
    expect(pow(2, 255)).toBe(1);
    expect(pow(3, 0)).toBe(1);
    expect(() => div(1, 0)).toThrow();
    expect(() => inv(0)).toThrow();
  });

  it('đa thức: polyEval(p·q) = polyEval(p)·polyEval(q)', () => {
    const p = [3, 0, 7, 1];
    const q = [5, 9];
    for (let x = 0; x < 256; x += 13) expect(polyEval(polyMul(p, q), x)).toBe(mul(polyEval(p, x), polyEval(q, x)));
  });
});

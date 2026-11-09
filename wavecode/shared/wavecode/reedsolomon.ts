// Reed–Solomon trên GF(256), mã hệ thống (systematic).
// Codeword = message || parity. Phần tử codeword[k] là hệ số bậc (n − 1 − k).
// Đa thức sinh g(x) = ∏_{i=0}^{nsym−1} (x − α^i)  (first consecutive root = 0).
// Giải mã: syndrome → Berlekamp–Massey → Chien search → Forney.

import { mul, div, pow2, polyEval, polyMul } from './gf256.js';

const generatorCache = new Map<number, number[]>();

/** g(x), hệ số bậc thấp trước, monic (hệ số bậc cao nhất = 1) */
export function generatorPoly(nsym: number): number[] {
  let g = generatorCache.get(nsym);
  if (!g) {
    g = [1];
    for (let i = 0; i < nsym; i++) g = polyMul(g, [pow2(i), 1]); // (x + α^i)
    generatorCache.set(nsym, g);
  }
  return g;
}

/** Trả về codeword = msg || parity (độ dài msg.length + nsym) */
export function rsEncode(msg: ArrayLike<number>, nsym: number): Uint8Array {
  const n = msg.length + nsym;
  if (n > 255) throw new RangeError('RS: codeword dài quá 255');
  const g = generatorPoly(nsym); // g[nsym] = 1
  // chia dài msg(x)·x^nsym cho g(x), làm việc theo thứ tự bậc cao → thấp
  const rem = new Uint8Array(nsym);
  for (let i = 0; i < msg.length; i++) {
    const factor = (msg[i] ^ rem[0]) & 0xff;
    // dịch trái
    for (let j = 0; j < nsym - 1; j++) rem[j] = rem[j + 1];
    rem[nsym - 1] = 0;
    if (factor !== 0) {
      // rem[j] tương ứng bậc (nsym − 1 − j); trừ factor·(g − x^nsym)
      for (let j = 0; j < nsym; j++) rem[j] ^= mul(factor, g[nsym - 1 - j]);
    }
  }
  const out = new Uint8Array(n);
  out.set(Array.from(msg), 0);
  out.set(rem, msg.length);
  return out;
}

/** S_j = c(α^j), j = 0..nsym−1 */
export function syndromes(cw: ArrayLike<number>, nsym: number): number[] {
  const s = new Array<number>(nsym);
  for (let j = 0; j < nsym; j++) {
    const x = pow2(j);
    let y = 0;
    for (let k = 0; k < cw.length; k++) y = mul(y, x) ^ cw[k]; // Horner, bậc cao trước
    s[j] = y;
  }
  return s;
}

export interface RsDecodeResult {
  /** codeword đã sửa */
  codeword: Uint8Array;
  /** phần message (bỏ parity) */
  message: Uint8Array;
  /** vị trí (index trong codeword) đã sửa */
  corrected: number[];
}

/** Berlekamp–Massey: trả về đa thức định vị lỗi Λ(x) (bậc thấp trước, Λ(0)=1) */
function berlekampMassey(s: number[]): number[] {
  let C = [1];
  let B = [1];
  let L = 0;
  let m = 1;
  let b = 1;
  for (let n = 0; n < s.length; n++) {
    let d = s[n];
    for (let i = 1; i <= L; i++) d ^= mul(C[i] ?? 0, s[n - i]);
    if (d === 0) {
      m++;
      continue;
    }
    const coef = div(d, b);
    const next = C.slice();
    const need = B.length + m;
    while (next.length < need) next.push(0);
    for (let i = 0; i < B.length; i++) next[i + m] ^= mul(coef, B[i]);
    if (2 * L <= n) {
      L = n + 1 - L;
      B = C;
      b = d;
      m = 1;
    } else {
      m++;
    }
    C = next;
  }
  // cắt hệ số 0 ở bậc cao; nếu bậc ≠ L thì Chien search sẽ không tìm đủ nghiệm → caller trả null
  while (C.length > 1 && C[C.length - 1] === 0) C.pop();
  return C;
}

/**
 * Giải mã, sửa tối đa floor(nsym/2) byte lỗi.
 * Trả về null nếu không sửa được (lỗi quá nhiều / không nhất quán).
 */
export function rsDecode(input: ArrayLike<number>, nsym: number): RsDecodeResult | null {
  const n = input.length;
  const cw = Uint8Array.from(Array.from(input));
  const k = n - nsym;
  const s = syndromes(cw, nsym);
  if (s.every((v) => v === 0)) {
    return { codeword: cw, message: cw.slice(0, k), corrected: [] };
  }

  const lambda = berlekampMassey(s);
  const nErr = lambda.length - 1;
  if (nErr === 0 || 2 * nErr > nsym) return null;

  // Ω(x) = S(x)·Λ(x) mod x^nsym
  const omega = polyMul(s, lambda).slice(0, nsym);
  // Λ'(x): đạo hàm hình thức, trong GF(2^m) chỉ còn các hạng tử bậc lẻ
  const dLambda: number[] = [];
  for (let i = 1; i < lambda.length; i++) dLambda.push(i % 2 === 1 ? lambda[i] : 0);

  // Chien search trên các vị trí hợp lệ của codeword (rút gọn)
  const positions: number[] = [];
  for (let idx = 0; idx < n; idx++) {
    const p = n - 1 - idx; // bậc của vị trí
    const xInv = pow2(-p);
    if (polyEval(lambda, xInv) === 0) positions.push(idx);
  }
  if (positions.length !== nErr) return null;

  // Forney (fcr = 0): e = X · Ω(X⁻¹) / Λ'(X⁻¹)
  for (const idx of positions) {
    const p = n - 1 - idx;
    const X = pow2(p);
    const xInv = pow2(-p);
    const denom = polyEval(dLambda, xInv);
    if (denom === 0) return null;
    const e = mul(X, div(polyEval(omega, xInv), denom));
    cw[idx] ^= e;
  }

  // kiểm tra lại
  if (!syndromes(cw, nsym).every((v) => v === 0)) return null;
  return { codeword: cw, message: cw.slice(0, k), corrected: positions };
}

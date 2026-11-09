// Số học trên trường GF(2^8) với đa thức sinh x^8 + x^4 + x^3 + x^2 + 1 (0x11D), phần tử sinh α = 2.

export const PRIMITIVE_POLY = 0x11d;

export const EXP = new Uint8Array(512);
export const LOG = new Uint8Array(256);

(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= PRIMITIVE_POLY;
  }
  // nhân đôi bảng để khỏi phải mod 255 khi cộng log
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();

export const add = (a: number, b: number): number => a ^ b;
export const sub = add;

export function mul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return EXP[LOG[a] + LOG[b]];
}

export function div(a: number, b: number): number {
  if (b === 0) throw new RangeError('GF256: chia cho 0');
  if (a === 0) return 0;
  return EXP[(LOG[a] + 255 - LOG[b]) % 255];
}

export function inv(a: number): number {
  if (a === 0) throw new RangeError('GF256: 0 không có nghịch đảo');
  return EXP[255 - LOG[a]];
}

/** α^n, n có thể âm */
export function pow2(n: number): number {
  return EXP[((n % 255) + 255) % 255];
}

export function pow(a: number, n: number): number {
  if (n === 0) return 1;
  if (a === 0) return 0;
  return EXP[(((LOG[a] * n) % 255) + 255) % 255];
}

// ---- Đa thức: mảng hệ số, chỉ số = bậc (hệ số bậc thấp đứng trước) ----

export function polyEval(p: ArrayLike<number>, x: number): number {
  let y = 0;
  for (let i = p.length - 1; i >= 0; i--) y = mul(y, x) ^ p[i];
  return y;
}

export function polyMul(p: ArrayLike<number>, q: ArrayLike<number>): number[] {
  const r = new Array<number>(p.length + q.length - 1).fill(0);
  for (let i = 0; i < p.length; i++) {
    if (p[i] === 0) continue;
    for (let j = 0; j < q.length; j++) r[i + j] ^= mul(p[i], q[j]);
  }
  return r;
}

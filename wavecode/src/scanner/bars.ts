// Tìm thanh sóng âm trong ảnh nhị phân: connected components → lọc theo hình dạng →
// xâu chuỗi 26 thanh cách đều trên một đường thẳng → tìm chấm định hướng → đo chiều cao.

import { TOTAL_BARS } from '../../shared/wavecode/constants';

export interface Component {
  label: number;
  area: number;
  cx: number;
  cy: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  /** độ dài trục chính / phụ, quy đổi như hình chữ nhật (√(12λ)) */
  major: number;
  minor: number;
  /** góc trục chính (rad) */
  angle: number;
}

export interface Labeled {
  width: number;
  height: number;
  labels: Int32Array;
  comps: Component[];
}

/** Gán nhãn 4-liên thông (two-pass + union-find) và tính moment bậc 2 */
export function labelComponents(mask: Uint8Array, W: number, H: number, minArea = 4): Labeled {
  const labels = new Int32Array(W * H);
  const parent: number[] = [0];
  const find = (a: number) => {
    while (parent[a] !== a) {
      parent[a] = parent[parent[a]];
      a = parent[a];
    }
    return a;
  };
  let next = 1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!mask[i]) continue;
      const left = x > 0 ? labels[i - 1] : 0;
      const up = y > 0 ? labels[i - W] : 0;
      if (!left && !up) {
        parent.push(next);
        labels[i] = next++;
      } else if (left && up) {
        const a = find(left);
        const b = find(up);
        labels[i] = Math.min(a, b);
        if (a !== b) parent[Math.max(a, b)] = Math.min(a, b);
      } else {
        labels[i] = left || up;
      }
    }
  }

  // gom nhãn + thống kê
  const remap = new Int32Array(next);
  const st: { n: number; sx: number; sy: number; sxx: number; syy: number; sxy: number; x0: number; x1: number; y0: number; y1: number }[] = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const l = labels[i];
      if (!l) continue;
      const root = find(l);
      let k = remap[root];
      if (!k) {
        st.push({ n: 0, sx: 0, sy: 0, sxx: 0, syy: 0, sxy: 0, x0: x, x1: x, y0: y, y1: y });
        k = remap[root] = st.length;
      }
      labels[i] = k;
      const s = st[k - 1];
      s.n++;
      s.sx += x;
      s.sy += y;
      s.sxx += x * x;
      s.syy += y * y;
      s.sxy += x * y;
      if (x < s.x0) s.x0 = x;
      if (x > s.x1) s.x1 = x;
      if (y < s.y0) s.y0 = y;
      if (y > s.y1) s.y1 = y;
    }
  }

  const comps: Component[] = [];
  st.forEach((s, idx) => {
    if (s.n < minArea) return;
    const cx = s.sx / s.n;
    const cy = s.sy / s.n;
    // +1/12: phương sai của một pixel vuông đơn vị
    const a = s.sxx / s.n - cx * cx + 1 / 12;
    const c = s.syy / s.n - cy * cy + 1 / 12;
    const b = s.sxy / s.n - cx * cy;
    const tr = (a + c) / 2;
    const disc = Math.sqrt(((a - c) / 2) ** 2 + b * b);
    const l1 = tr + disc;
    const l2 = Math.max(1e-6, tr - disc);
    comps.push({
      label: idx + 1,
      area: s.n,
      cx,
      cy,
      minX: s.x0,
      maxX: s.x1,
      minY: s.y0,
      maxY: s.y1,
      major: Math.sqrt(12 * l1),
      minor: Math.sqrt(12 * l2),
      angle: 0.5 * Math.atan2(2 * b, a - c),
    });
  });
  return { width: W, height: H, labels, comps };
}

/** độ dài hình chiếu của thành phần lên phương (nx, ny) */
export function extentAlong(L: Labeled, c: Component, nx: number, ny: number): number {
  let lo = Infinity;
  let hi = -Infinity;
  const { labels, width } = L;
  for (let y = c.minY; y <= c.maxY; y++) {
    const row = y * width;
    for (let x = c.minX; x <= c.maxX; x++) {
      if (labels[row + x] !== c.label) continue;
      const t = (x - c.cx) * nx + (y - c.cy) * ny;
      if (t < lo) lo = t;
      if (t > hi) hi = t;
    }
  }
  // +|n|_1 ≈ bề dày một pixel theo phương chiếu
  return hi - lo + Math.abs(nx) + Math.abs(ny);
}

export interface BarChain {
  /** 26 thanh theo thứ tự đọc START → END */
  bars: Component[];
  dot: Component;
  /** hướng đọc (đơn vị) */
  ux: number;
  uy: number;
}

const median = (xs: number[]) => {
  const s = xs.slice().sort((a, b) => a - b);
  return s[s.length >> 1];
};

/** Tìm tất cả chuỗi 26 thanh + chấm hợp lệ (thường chỉ có 1) */
export function findChains(L: Labeled): BarChain[] {
  const elong = L.comps.filter((c) => c.minor >= 1 && c.major / c.minor >= 1.9);
  const dots = L.comps.filter((c) => {
    if (c.major / c.minor > 1.7) return false;
    const bw = c.maxX - c.minX + 1;
    const bh = c.maxY - c.minY + 1;
    return c.area / (bw * bh) >= 0.5;
  });
  const chains: BarChain[] = [];
  const used = new Set<number>();

  // thanh START: dài (tỉ lệ ≥ ~3)
  const starts = elong.filter((c) => c.major / c.minor >= 2.6).sort((a, b) => a.cx - b.cx);

  for (const s of starts) {
    if (used.has(s.label)) continue;
    const chain = growChain(s, elong);
    if (!chain) continue;
    const ok = validateAndOrient(chain, dots);
    if (!ok) continue;
    chain.forEach((c) => used.add(c.label));
    chains.push(ok);
  }
  return chains;
}

function similarBar(ref: Component, c: Component): boolean {
  const r = c.minor / ref.minor;
  return r > 0.55 && r < 1.8 && c.area >= 1.6 * ref.minor * ref.minor * 0.55;
}

/** từ thanh s, xâu chuỗi các thanh tiếp theo dựa trên vị trí dự đoán (vận tốc không đổi) */
function growChain(s: Component, cands: Component[]): Component[] | null {
  // trục chính của thanh ⟂ hướng đọc → hướng đọc ≈ (cos(angle+90°), sin(angle+90°)), chọn phía x tăng
  let ux = -Math.sin(s.angle);
  let uy = Math.cos(s.angle);
  if (ux < 0) {
    ux = -ux;
    uy = -uy;
  }
  // thanh thứ 2: gần nhất về phía trước, cùng bề rộng
  let best: Component | null = null;
  let bestD = Infinity;
  for (const c of cands) {
    if (c === s || !similarBar(s, c)) continue;
    const dx = c.cx - s.cx;
    const dy = c.cy - s.cy;
    const along = dx * ux + dy * uy;
    const across = Math.abs(-dx * uy + dy * ux);
    if (along < s.minor * 1.1 || along > s.minor * 4.5) continue;
    if (across > Math.max(2, along * 0.35)) continue;
    const d = Math.hypot(dx, dy);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  if (!best) return null;
  const chain = [s, best];
  for (let k = 2; k < TOTAL_BARS; k++) {
    const a = chain[k - 2];
    const b = chain[k - 1];
    const px = 2 * b.cx - a.cx;
    const py = 2 * b.cy - a.cy;
    const step = Math.hypot(b.cx - a.cx, b.cy - a.cy);
    const tol = Math.max(1.5, step * 0.3);
    let nb: Component | null = null;
    let nd = Infinity;
    for (const c of cands) {
      if (c === b || c === a || !similarBar(s, c)) continue;
      const d = Math.hypot(c.cx - px, c.cy - py);
      if (d < tol && d < nd) {
        nd = d;
        nb = c;
      }
    }
    if (!nb) return null;
    chain.push(nb);
  }
  return chain;
}

function validateAndOrient(chain: Component[], dots: Component[]): BarChain | null {
  const first = chain[0];
  const last = chain[TOTAL_BARS - 1];
  const len = Math.hypot(last.cx - first.cx, last.cy - first.cy);
  if (len <= 0) return null;
  const ux = (last.cx - first.cx) / len;
  const uy = (last.cy - first.cy) / len;
  const step = len / (TOTAL_BARS - 1);

  // bề rộng đồng đều
  const wMed = median(chain.map((c) => c.minor));
  if (chain.some((c) => c.minor < wMed * 0.55 || c.minor > wMed * 1.8)) return null;
  // khoảng cách ≈ 2w
  if (step / wMed < 1.3 || step / wMed > 3.5) return null;
  // thẳng hàng
  for (const c of chain) {
    const across = Math.abs(-(c.cx - first.cx) * uy + (c.cy - first.cy) * ux);
    if (across > Math.max(1.5, wMed * 0.8)) return null;
  }
  // cách đều
  for (let k = 1; k < TOTAL_BARS; k++) {
    const d = Math.hypot(chain[k].cx - chain[k - 1].cx, chain[k].cy - chain[k - 1].cy);
    if (d < step * 0.65 || d > step * 1.35) return null;
  }

  // chấm định hướng: cách tâm thanh cuối ~1.5 step về phía ngoài
  const findDot = (end: Component, sx: number, sy: number) => {
    const px = end.cx + sx * step * 1.5;
    const py = end.cy + sy * step * 1.5;
    let best: Component | null = null;
    let bd = Infinity;
    for (const d of dots) {
      const diam = Math.sqrt((4 * d.area) / Math.PI);
      if (diam < wMed * 0.4 || diam > wMed * 2) continue;
      const dist = Math.hypot(d.cx - px, d.cy - py);
      if (dist < step * 0.55 && dist < bd) {
        bd = dist;
        best = d;
      }
    }
    return best;
  };
  const dotEnd = findDot(last, ux, uy);
  const dotStart = findDot(first, -ux, -uy);
  if (!!dotEnd === !!dotStart) return null; // không có chấm, hoặc mơ hồ
  if (dotEnd) return { bars: chain, dot: dotEnd, ux, uy };
  return { bars: chain.slice().reverse(), dot: dotStart!, ux: -ux, uy: -uy };
}

/**
 * Đo chiều cao 26 thanh theo phương vuông góc với đường START→END,
 * chuẩn hoá theo Href nội suy tuyến tính giữa START và END (bù phối cảnh nhẹ).
 * Trả về 24 tỉ lệ r của thanh dữ liệu.
 */
export function measureRatios(L: Labeled, chain: BarChain): { ratios: number[]; heights: number[] } {
  const nx = -chain.uy;
  const ny = chain.ux;
  const heights = chain.bars.map((c) => extentAlong(L, c, nx, ny));
  const s0 = chain.bars[0];
  const pos = chain.bars.map((c) => (c.cx - s0.cx) * chain.ux + (c.cy - s0.cy) * chain.uy);
  const hStart = heights[0];
  const hEnd = heights[TOTAL_BARS - 1];
  const span = pos[TOTAL_BARS - 1] || 1;
  const ratios: number[] = [];
  for (let k = 1; k < TOTAL_BARS - 1; k++) {
    const href = hStart + ((hEnd - hStart) * pos[k]) / span;
    ratios.push(heights[k] / href);
  }
  return { ratios, heights };
}

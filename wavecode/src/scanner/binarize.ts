// Ảnh RGBA → grayscale → nhị phân (Otsu, có thêm adaptive threshold làm phương án dự phòng).
// Thuần TypeScript (không đụng DOM) để chạy được cả trong trình duyệt lẫn test Node.

export interface RgbaImage {
  width: number;
  height: number;
  data: Uint8ClampedArray | Uint8Array;
}

export interface GrayImage {
  width: number;
  height: number;
  data: Uint8Array;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Cắt vùng `crop` (mặc định cả ảnh) và thu nhỏ (trung bình theo ô) sao cho chiều rộng ≤ maxWidth.
 */
export function toGray(img: RgbaImage, crop?: Rect, maxWidth = 900): GrayImage {
  const cx = Math.max(0, Math.floor(crop?.x ?? 0));
  const cy = Math.max(0, Math.floor(crop?.y ?? 0));
  const cw = Math.min(img.width - cx, Math.floor(crop?.w ?? img.width));
  const ch = Math.min(img.height - cy, Math.floor(crop?.h ?? img.height));
  const scale = Math.max(1, cw / maxWidth);
  const W = Math.max(1, Math.floor(cw / scale));
  const H = Math.max(1, Math.floor(ch / scale));
  const out = new Uint8Array(W * H);
  const src = img.data;
  const sw = img.width;

  if (scale === 1) {
    for (let y = 0; y < H; y++) {
      let si = ((cy + y) * sw + cx) * 4;
      let di = y * W;
      for (let x = 0; x < W; x++, si += 4) {
        out[di++] = (src[si] * 77 + src[si + 1] * 150 + src[si + 2] * 29) >> 8;
      }
    }
    return { width: W, height: H, data: out };
  }

  for (let y = 0; y < H; y++) {
    const y0 = cy + Math.floor(y * scale);
    const y1 = Math.max(y0 + 1, cy + Math.floor((y + 1) * scale));
    for (let x = 0; x < W; x++) {
      const x0 = cx + Math.floor(x * scale);
      const x1 = Math.max(x0 + 1, cx + Math.floor((x + 1) * scale));
      let sum = 0;
      let n = 0;
      for (let yy = y0; yy < y1; yy++) {
        let si = (yy * sw + x0) * 4;
        for (let xx = x0; xx < x1; xx++, si += 4) {
          sum += src[si] * 77 + src[si + 1] * 150 + src[si + 2] * 29;
          n++;
        }
      }
      out[y * W + x] = (sum / n) >> 8;
    }
  }
  return { width: W, height: H, data: out };
}

/** Ngưỡng Otsu trên histogram 256 mức */
export function otsu(g: GrayImage): number {
  const hist = new Float64Array(256);
  const d = g.data;
  for (let i = 0; i < d.length; i++) hist[d[i]]++;
  const total = d.length;
  let sumAll = 0;
  for (let i = 0; i < 256; i++) sumAll += i * hist[i];
  let wB = 0;
  let sumB = 0;
  let best = 0;
  let bestT = 127;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sumAll - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > best) {
      best = between;
      bestT = t;
    }
  }
  return bestT;
}

/** mask[i] = 1 nếu pixel thuộc "mực" (tối hơn ngưỡng nếu darkInk, sáng hơn nếu không) */
export function thresholdGlobal(g: GrayImage, t: number, darkInk: boolean): Uint8Array {
  const m = new Uint8Array(g.data.length);
  const d = g.data;
  if (darkInk) for (let i = 0; i < d.length; i++) m[i] = d[i] <= t ? 1 : 0;
  else for (let i = 0; i < d.length; i++) m[i] = d[i] > t ? 1 : 0;
  return m;
}

/**
 * Adaptive threshold (trung bình cục bộ qua integral image) — chống ánh sáng không đều.
 * window: cạnh cửa sổ (px), offset: độ lệch so với trung bình.
 */
export function thresholdAdaptive(g: GrayImage, darkInk: boolean, window?: number, offset = 8): Uint8Array {
  const { width: W, height: H, data } = g;
  const win = Math.max(15, Math.floor(window ?? Math.min(W, H) / 2)) | 1;
  const r = win >> 1;
  const integ = new Float64Array((W + 1) * (H + 1));
  for (let y = 0; y < H; y++) {
    let row = 0;
    for (let x = 0; x < W; x++) {
      row += data[y * W + x];
      integ[(y + 1) * (W + 1) + x + 1] = integ[y * (W + 1) + x + 1] + row;
    }
  }
  const m = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    const y0 = Math.max(0, y - r);
    const y1 = Math.min(H, y + r + 1);
    for (let x = 0; x < W; x++) {
      const x0 = Math.max(0, x - r);
      const x1 = Math.min(W, x + r + 1);
      const s =
        integ[y1 * (W + 1) + x1] - integ[y0 * (W + 1) + x1] - integ[y1 * (W + 1) + x0] + integ[y0 * (W + 1) + x0];
      const mean = s / ((x1 - x0) * (y1 - y0));
      const v = data[y * W + x];
      m[y * W + x] = darkInk ? (v < mean - offset ? 1 : 0) : v > mean + offset ? 1 : 0;
    }
  }
  return m;
}

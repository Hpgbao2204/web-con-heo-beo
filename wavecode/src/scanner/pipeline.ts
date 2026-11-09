// Pipeline quét: RGBA → gray → nhị phân → tìm thanh → đo → giải mã. Dùng chung cho camera và ảnh tĩnh.

import { toGray, otsu, thresholdGlobal, thresholdAdaptive, type RgbaImage, type Rect, type GrayImage } from './binarize';
import { labelComponents, findChains, measureRatios } from './bars';
import { decodeRatios, type DecodeResult } from '../../shared/wavecode/decode';

export interface ScanOptions {
  crop?: Rect;
  /** thu nhỏ khung trước khi xử lý (px) */
  maxWidth?: number;
  /** thử thêm adaptive threshold khi Otsu thất bại */
  adaptive?: boolean;
}

export interface ScanStats {
  /** số thành phần tìm thấy ở lần thử cuối */
  components: number;
  /** có thấy chuỗi 26 thanh + chấm không (dù giải mã thất bại) */
  sawCode: boolean;
}

function tryMask(g: GrayImage, mask: Uint8Array, stats: ScanStats): DecodeResult | null {
  const L = labelComponents(mask, g.width, g.height);
  stats.components = L.comps.length;
  for (const chain of findChains(L)) {
    stats.sawCode = true;
    const { ratios } = measureRatios(L, chain);
    const r = decodeRatios(ratios);
    if (r) return r;
  }
  return null;
}

export function scanGray(g: GrayImage, opts: ScanOptions = {}, stats: ScanStats = { components: 0, sawCode: false }) {
  const t = otsu(g);
  // thử cả hai cực tính: thanh tối trên nền sáng và ngược lại
  for (const dark of [true, false]) {
    const r = tryMask(g, thresholdGlobal(g, t, dark), stats);
    if (r) return r;
  }
  if (opts.adaptive !== false) {
    for (const dark of [true, false]) {
      const r = tryMask(g, thresholdAdaptive(g, dark), stats);
      if (r) return r;
    }
  }
  return null;
}

export function scanImage(img: RgbaImage, opts: ScanOptions = {}, stats?: ScanStats): DecodeResult | null {
  const g = toGray(img, opts.crop, opts.maxWidth ?? 900);
  return scanGray(g, opts, stats);
}

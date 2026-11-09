// chiều cao thanh → mức → bits → RS decode → id.

import {
  VERSION,
  PAYLOAD_BYTES,
  PARITY_BYTES,
  CODEWORD_BYTES,
  BITS_PER_BAR,
  DATA_BARS,
  MAX_LEVEL,
  MIN_RATIO,
  TOTAL_BARS,
} from './constants.js';
import { rsDecode } from './reedsolomon.js';
import { grayDecode } from './gray.js';
import { idToHex } from './encode.js';

export interface DecodeResult {
  id: number;
  idHex: string;
  version: number;
  /** số byte RS đã sửa */
  corrected: number;
  levels: number[];
}

/** tỉ lệ r = h / Href → mức thực (chưa làm tròn) */
export function ratioToLevelFloat(r: number): number {
  return ((r - MIN_RATIO) / (1 - MIN_RATIO)) * MAX_LEVEL;
}

export function ratioToLevel(r: number): number {
  return Math.min(MAX_LEVEL, Math.max(0, Math.round(ratioToLevelFloat(r))));
}

export function levelsToCodeword(levels: ArrayLike<number>): Uint8Array {
  const cw = new Uint8Array(CODEWORD_BYTES);
  for (let bar = 0; bar < DATA_BARS; bar++) {
    const v = grayDecode(levels[bar] & 7);
    for (let b = 0; b < BITS_PER_BAR; b++) {
      const bit = bar * BITS_PER_BAR + b;
      if ((v >> (BITS_PER_BAR - 1 - b)) & 1) cw[bit >> 3] |= 1 << (7 - (bit & 7));
    }
  }
  return cw;
}

/** 24 mức → id (hoặc null nếu RS không sửa được / sai version) */
export function decodeLevels(levels: ArrayLike<number>): DecodeResult | null {
  if (levels.length !== DATA_BARS) return null;
  const res = rsDecode(levelsToCodeword(levels), PARITY_BYTES);
  if (!res) return null;
  const p = res.message;
  if (p.length !== PAYLOAD_BYTES || p[0] !== VERSION) return null;
  const id = ((p[1] << 24) | (p[2] << 16) | (p[3] << 8) | p[4]) >>> 0;
  return { id, idHex: idToHex(id), version: p[0], corrected: res.corrected.length, levels: Array.from(levels) };
}

/**
 * Giải từ 24 tỉ lệ r (đã chuẩn hoá theo thanh START/END).
 * Nếu giải cứng thất bại, thử đổi 1–2 thanh "lưỡng lự" nhất (phần lẻ gần .5) sang mức kề.
 */
export function decodeRatios(ratios: ArrayLike<number>, maxAlternatives = 2): DecodeResult | null {
  if (ratios.length !== DATA_BARS) return null;
  const f = Array.from(ratios, ratioToLevelFloat);
  const hard = f.map((x) => Math.min(MAX_LEVEL, Math.max(0, Math.round(x))));
  const direct = decodeLevels(hard);
  if (direct || maxAlternatives <= 0) return direct;

  // độ lưỡng lự: khoảng cách tới mức kề thứ hai
  const amb = f
    .map((x, i) => {
      const c = Math.min(MAX_LEVEL, Math.max(0, x));
      const alt = c - hard[i] >= 0 ? hard[i] + 1 : hard[i] - 1;
      return { i, alt, cost: Math.abs(c - alt) };
    })
    .filter((a) => a.alt >= 0 && a.alt <= MAX_LEVEL)
    .sort((a, b) => a.cost - b.cost)
    .slice(0, 4);

  const tries: number[][] = [];
  for (const a of amb) tries.push([a.i]);
  if (maxAlternatives >= 2) {
    for (let x = 0; x < amb.length; x++) for (let y = x + 1; y < amb.length; y++) tries.push([amb[x].i, amb[y].i]);
  }
  for (const t of tries) {
    const lv = hard.slice();
    for (const i of t) lv[i] = amb.find((a) => a.i === i)!.alt;
    const r = decodeLevels(lv);
    if (r) return r;
  }
  return null;
}

/** 26 chiều cao (START, 24 data, END) → id. Href = trung bình START/END. */
export function decodeHeights(heights: ArrayLike<number>): DecodeResult | null {
  if (heights.length !== TOTAL_BARS) return null;
  const href = (heights[0] + heights[TOTAL_BARS - 1]) / 2;
  if (!(href > 0)) return null;
  const ratios: number[] = [];
  for (let i = 1; i <= DATA_BARS; i++) ratios.push(heights[i] / href);
  return decodeRatios(ratios);
}

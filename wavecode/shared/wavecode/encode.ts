// id → payload → codeword RS → 24 mức chiều cao → SVG.

import {
  VERSION,
  PARITY_BYTES,
  BITS_PER_BAR,
  DATA_BARS,
  MAX_LEVEL,
  MIN_RATIO,
  DEFAULT_W,
  DEFAULT_H,
  QUIET_W,
  DOT_GAP_W,
  QR_GAP_W,
} from './constants.js';
import { rsEncode } from './reedsolomon.js';
import { grayEncode } from './gray.js';

export function idToHex(id: number): string {
  return (id >>> 0).toString(16).padStart(8, '0');
}

export function hexToId(hex: string): number {
  return parseInt(hex, 16) >>> 0;
}

export function buildPayload(id: number, version = VERSION): Uint8Array {
  const u = id >>> 0;
  return Uint8Array.of(version & 0xff, (u >>> 24) & 0xff, (u >>> 16) & 0xff, (u >>> 8) & 0xff, u & 0xff);
}

export function encodeCodeword(id: number, version = VERSION): Uint8Array {
  return rsEncode(buildPayload(id, version), PARITY_BYTES);
}

/** 72 bit (MSB byte 0 trước) → 24 nhóm 3 bit → Gray → mức 0..7 */
export function codewordToLevels(cw: ArrayLike<number>): number[] {
  const levels: number[] = [];
  for (let bar = 0; bar < DATA_BARS; bar++) {
    let v = 0;
    for (let b = 0; b < BITS_PER_BAR; b++) {
      const bit = bar * BITS_PER_BAR + b;
      v = (v << 1) | ((cw[bit >> 3] >> (7 - (bit & 7))) & 1);
    }
    levels.push(grayEncode(v));
  }
  return levels;
}

export function encodeLevels(id: number): number[] {
  return codewordToLevels(encodeCodeword(id));
}

export function levelToRatio(level: number): number {
  return MIN_RATIO + ((1 - MIN_RATIO) * level) / MAX_LEVEL;
}

// ---------------------------------------------------------------- bố cục

export interface QrMatrix {
  size: number;
  /** size*size, true = module tối */
  get(row: number, col: number): boolean;
}

export interface LayoutOptions {
  w?: number;
  H?: number;
  /** ma trận QR (nếu muốn vẽ QR cạnh sóng) */
  qr?: QrMatrix | null;
  /** 'wave' = chỉ sóng (+QR nếu có), 'qr' = chỉ QR */
  variant?: 'wave' | 'qr';
}

export interface BarRect {
  x: number;
  y: number;
  width: number;
  height: number;
  /** -1 = START/END */
  level: number;
}

export interface Layout {
  width: number;
  height: number;
  axisY: number;
  w: number;
  H: number;
  bars: BarRect[];
  dot: { cx: number; cy: number; r: number } | null;
  qr: { cx: number; cy: number; r: number; square: number } | null;
}

/** đường kính hình tròn chứa QR */
export function qrCircleDiameter(w: number, H: number): number {
  return H + 2 * w;
}

export function layout(levels: number[], opts: LayoutOptions = {}): Layout {
  const w = opts.w ?? DEFAULT_W;
  const H = opts.H ?? DEFAULT_H;
  const withQr = !!opts.qr;
  const onlyQr = opts.variant === 'qr';
  const D = qrCircleDiameter(w, H);
  const contentH = withQr ? Math.max(H, D) : H;
  const height = contentH + 2 * QUIET_W * w;
  const axisY = height / 2;

  let x = QUIET_W * w;
  let qr: Layout['qr'] = null;
  if (withQr) {
    qr = { cx: x + D / 2, cy: axisY, r: D / 2, square: D * 0.7 };
    x += D;
    if (onlyQr) {
      return { width: x + QUIET_W * w, height, axisY, w, H, bars: [], dot: null, qr };
    }
    x += QR_GAP_W * w;
  }

  const bars: BarRect[] = [];
  const all = [-1, ...levels, -1];
  all.forEach((lv, i) => {
    const h = lv < 0 ? H : H * levelToRatio(lv);
    bars.push({ x, y: axisY - h / 2, width: w, height: h, level: lv });
    x += w;
    if (i < all.length - 1) x += w; // khoảng cách giữa các thanh = w
  });
  x += DOT_GAP_W * w;
  const dot = { cx: x + w / 2, cy: axisY, r: w / 2 };
  x += w;
  return { width: x + QUIET_W * w, height, axisY, w, H, bars, dot, qr };
}

// ---------------------------------------------------------------- SVG

const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function isHexColor(c: string): boolean {
  return HEX_COLOR.test(c);
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export interface SvgOptions extends LayoutOptions {
  fg?: string;
  bg?: string;
  /** nhãn hiển thị cho trình đọc màn hình */
  title?: string;
}

function escapeXml(s: string): string {
  return s.replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]!);
}

export function renderSvg(levels: number[], opts: SvgOptions = {}): string {
  const fg = opts.fg ?? '#111111';
  const bg = opts.bg ?? '#ffffff';
  // chặn SVG injection: màu phải là mã hex
  if (!isHexColor(fg) || !isHexColor(bg)) throw new Error('fg/bg phải là mã màu hex');
  const L = layout(levels, opts);
  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${r2(L.width)}" height="${r2(L.height)}" viewBox="0 0 ${r2(L.width)} ${r2(L.height)}" role="img">`,
  );
  parts.push(`<title>${escapeXml(opts.title ?? 'WaveCode')}</title>`);
  parts.push(`<rect width="100%" height="100%" fill="${bg}"/>`);

  if (L.qr && opts.qr) {
    const { cx, cy, r, square } = L.qr;
    const m = opts.qr;
    const quiet = 2; // quiet zone riêng của QR (module)
    const cell = square / (m.size + quiet * 2);
    const x0 = cx - square / 2;
    const y0 = cy - square / 2;
    // QR luôn là module tối trên nền sáng — camera gốc của nhiều máy không đọc QR đảo màu
    const fgDarker = relativeLuminance(fg) <= relativeLuminance(bg);
    const qrDark = fgDarker ? fg : bg;
    const qrLight = fgDarker ? bg : fg;
    parts.push(`<g class="wc-qr">`);
    parts.push(`<circle cx="${r2(cx)}" cy="${r2(cy)}" r="${r2(r)}" fill="${fg}"/>`);
    parts.push(
      `<rect x="${r2(x0)}" y="${r2(y0)}" width="${r2(square)}" height="${r2(square)}" rx="${r2(cell * 1.5)}" fill="${qrLight}"/>`,
    );
    let d = '';
    for (let row = 0; row < m.size; row++) {
      for (let col = 0; col < m.size; col++) {
        if (!m.get(row, col)) continue;
        const px = x0 + (col + quiet) * cell;
        const py = y0 + (row + quiet) * cell;
        // nới 0.02 để các ô liền nhau không hở viền khi raster
        d += `M${r2(px)} ${r2(py)}h${r2(cell + 0.02)}v${r2(cell + 0.02)}h${r2(-cell - 0.02)}z`;
      }
    }
    parts.push(`<path d="${d}" fill="${qrDark}"/>`);
    parts.push(`</g>`);
  }

  if (L.bars.length) {
    parts.push(`<g class="wc-wave" fill="${fg}">`);
    for (const b of L.bars) {
      parts.push(
        `<rect x="${r2(b.x)}" y="${r2(b.y)}" width="${r2(b.width)}" height="${r2(b.height)}" rx="${r2(b.width / 2)}"/>`,
      );
    }
    if (L.dot) parts.push(`<circle cx="${r2(L.dot.cx)}" cy="${r2(L.dot.cy)}" r="${r2(L.dot.r)}"/>`);
    parts.push(`</g>`);
  }
  parts.push(`</svg>`);
  return parts.join('');
}

export function renderIdSvg(id: number, opts: SvgOptions = {}): string {
  return renderSvg(encodeLevels(id), opts);
}

// ---------------------------------------------------------------- màu

function hexToRgb(c: string): [number, number, number] {
  let h = c.slice(1);
  if (h.length === 3) h = h.replace(/./g, (x) => x + x);
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

export function relativeLuminance(c: string): number {
  const [r, g, b] = hexToRgb(c).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export const MIN_CONTRAST = 4.5;

/** Màu hợp lệ & đủ tương phản → giữ nguyên; ngược lại ép về đen/trắng */
export function sanitizeColors(fg?: string, bg?: string): { fg: string; bg: string; forced: boolean } {
  const f = fg && isHexColor(fg) ? fg : null;
  const b = bg && isHexColor(bg) ? bg : null;
  if (f && b && contrastRatio(f, b) >= MIN_CONTRAST) return { fg: f, bg: b, forced: false };
  const forced = !!(fg || bg);
  return { fg: '#111111', bg: '#ffffff', forced };
}

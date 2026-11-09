// Sinh SVG mã sóng âm (kèm QR tuỳ chế độ).

import QRCode from 'qrcode';
import { renderIdSvg, hexToId, sanitizeColors, type QrMatrix } from '../../shared/wavecode/encode.js';

export type QrMode = 'scanner' | 'direct' | 'none';
export type Variant = 'wave' | 'combo' | 'qr';

/** ?src=qr để bộ đếm biết lượt truy cập đến từ QR */
export function qrUrl(base: string, mode: QrMode, idHex: string): string | null {
  if (mode === 'scanner') return `${base}/scan?src=qr`;
  if (mode === 'direct') return `${base}/p/${idHex}?src=qr`;
  return null;
}

export function qrMatrix(text: string): QrMatrix {
  const qr = QRCode.create(text, { errorCorrectionLevel: 'M' });
  const { size, data } = qr.modules;
  return { size, get: (r, c) => !!data[r * size + c] };
}

export interface CodeOptions {
  base: string;
  qr?: QrMode;
  variant?: Variant;
  fg?: string;
  bg?: string;
}

export function renderCode(idHex: string, opts: CodeOptions) {
  const colors = sanitizeColors(opts.fg, opts.bg);
  let mode: QrMode = opts.qr ?? 'scanner';
  const variant: Variant = opts.variant ?? (mode === 'none' ? 'wave' : 'combo');
  if (variant === 'wave') mode = 'none';
  if (variant === 'qr' && mode === 'none') mode = 'scanner';
  const url = qrUrl(opts.base, mode, idHex);
  const svg = renderIdSvg(hexToId(idHex), {
    fg: colors.fg,
    bg: colors.bg,
    qr: url ? qrMatrix(url) : null,
    variant: variant === 'qr' ? 'qr' : 'wave',
    title: `WaveCode ${idHex}`,
  });
  return { svg, colorsForced: colors.forced, qrUrl: url };
}

// GET /api/tracks/:idHex/code.svg  (rewrite → /api/code?id=)
// Mã chỉ phụ thuộc ID + tham số → không cần đọc storage, cache CDN lâu.
import { error, publicBaseUrl, ID_HEX_RE } from './_lib/http.js';
import { renderCode, type QrMode, type Variant } from './_lib/code.js';

export function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const id = q.get('id') ?? '';
  if (!ID_HEX_RE.test(id)) return error(400, 'idHex không hợp lệ');
  const qrRaw = q.get('qr');
  const varRaw = q.get('variant');
  const qr = (['scanner', 'direct', 'none'] as const).find((m) => m === qrRaw) as QrMode | undefined;
  const variant = (['wave', 'combo', 'qr'] as const).find((v) => v === varRaw) as Variant | undefined;
  if (qrRaw !== null && !qr) return error(400, 'qr phải là scanner|direct|none');
  if (varRaw !== null && !variant) return error(400, 'variant phải là wave|combo|qr');
  const color = (v: string | null) => (v ? (v.startsWith('#') ? v : `#${v}`) : undefined);

  const { svg, colorsForced, qrUrl } = renderCode(id, {
    base: publicBaseUrl(req),
    qr,
    variant,
    fg: color(q.get('fg')),
    bg: color(q.get('bg')),
  });
  const headers: Record<string, string> = {
    'Content-Type': 'image/svg+xml; charset=utf-8',
    'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'",
  };
  if (colorsForced) headers['X-WaveCode-Colors-Forced'] = '1';
  if (qrUrl) headers['X-WaveCode-QR-URL'] = qrUrl;
  return new Response(svg, { headers });
}

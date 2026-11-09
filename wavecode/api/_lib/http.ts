import { timingSafeEqual } from 'node:crypto';

export const ID_HEX_RE = /^[0-9a-f]{8}$/;
export const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB) || 20;

export function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
  });
}

export const error = (status: number, message: string, headers: Record<string, string> = {}) =>
  json({ error: message }, status, headers);

/** URL công khai của app (nhúng vào QR) */
export function publicBaseUrl(req?: Request): string {
  const env = process.env.PUBLIC_BASE_URL?.trim();
  if (env) return env.replace(/\/+$/, '');
  const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (prod) return `https://${prod}`;
  if (req) return new URL(req.url).origin;
  return 'http://localhost:3000';
}

function same(expected: string, got: string): boolean {
  if (!expected || !got) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(got);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Khoá admin (upload, thư viện) — chỉ nhận qua header x-admin-key. Không đặt ADMIN_KEY → khoá luôn. */
export function isAdmin(req: Request): boolean {
  return same(process.env.ADMIN_KEY ?? '', req.headers.get('x-admin-key') ?? '');
}

/** Khoá xem số liệu — nhận ?key= trên URL (để mở thẳng bằng trình duyệt) hoặc khoá admin */
export function canReadStats(req: Request): boolean {
  return isAdmin(req) || same(process.env.STATS_KEY ?? '', new URL(req.url).searchParams.get('key') ?? '');
}

export async function readJson<T = any>(req: Request, maxBytes = 8 * 1024): Promise<T | null> {
  const text = await req.text();
  if (text.length > maxBytes) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export function cleanText(v: unknown): string {
  if (typeof v !== 'string') return '';
  return v.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
}

import { upload } from '@vercel/blob/client';

export interface Track {
  idHex: string;
  title: string;
  artist: string;
  audioUrl: string;
  playUrl: string;
  createdAt: string;
}

export type QrMode = 'scanner' | 'direct' | 'none';
export type Variant = 'combo' | 'wave' | 'qr';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function json<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, body?.error || `Lỗi ${res.status}`);
  return body as T;
}

// ---------------------------------------------------------------- khoá admin (lưu trên máy admin)

const KEY = 'wc-admin-key';
export function getAdminKey(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}
export function setAdminKey(k: string | null) {
  try {
    if (k) localStorage.setItem(KEY, k);
    else localStorage.removeItem(KEY);
  } catch {}
}
const adminHeaders = (): Record<string, string> => ({ 'x-admin-key': getAdminKey() ?? '' });

export async function checkAdminKey(k: string): Promise<boolean> {
  const r = await fetch('/api/auth', { method: 'POST', headers: { 'x-admin-key': k } });
  if (r.status === 503) throw new ApiError(503, 'Server chưa đặt ADMIN_KEY');
  return r.ok;
}

// ---------------------------------------------------------------- API

export const getConfig = () =>
  fetch('/api/config').then((r) => json<{ publicBaseUrl: string; maxUploadMb: number }>(r));

export const listTracks = () => fetch('/api/tracks', { headers: adminHeaders() }).then((r) => json<Track[]>(r));

export const getTrack = (idHex: string) => fetch(`/api/tracks/${idHex}`).then((r) => json<Track>(r));

const CONTENT_TYPE: Record<string, string> = { mp3: 'audio/mpeg', wav: 'audio/wav', m4a: 'audio/mp4', ogg: 'audio/ogg' };

function randomIdHex(): string {
  const b = crypto.getRandomValues(new Uint8Array(4));
  const hex = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return hex === '00000000' ? randomIdHex() : hex;
}

/** Upload thẳng lên Vercel Blob (token do /api/upload cấp), rồi báo server lưu metadata */
export async function uploadTrack(
  file: File,
  meta: { title: string; artist: string },
  onProgress?: (p: number) => void,
): Promise<Track> {
  const ext = /\.([a-z0-9]+)$/i.exec(file.name)?.[1].toLowerCase() ?? '';
  if (!CONTENT_TYPE[ext]) throw new ApiError(415, 'Chỉ nhận .mp3, .wav, .m4a, .ogg');
  // ID ngẫu nhiên 32-bit; trùng thì Blob từ chối ghi đè → thử ID khác
  for (let attempt = 0; attempt < 3; attempt++) {
    const idHex = randomIdHex();
    try {
      await upload(`audio/${idHex}.${ext}`, file, {
        access: 'public',
        handleUploadUrl: '/api/upload',
        headers: adminHeaders(),
        contentType: CONTENT_TYPE[ext],
        multipart: file.size > 8 * 1024 * 1024,
        onUploadProgress: (e) => onProgress?.(e.percentage / 100),
      });
    } catch (e: any) {
      if (/already exists/i.test(e?.message ?? '')) continue;
      throw new ApiError(400, e?.message?.replace(/^Vercel Blob: /, '') || 'Upload thất bại');
    }
    const res = await fetch('/api/tracks', {
      method: 'POST',
      headers: { ...adminHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ idHex, ext, title: meta.title || file.name.replace(/\.[^.]+$/, '').slice(0, 100), artist: meta.artist }),
    });
    if (res.status === 409) continue;
    return json<Track>(res);
  }
  throw new ApiError(500, 'Không cấp được ID, thử lại');
}

export function codeUrl(idHex: string, o: { qr?: QrMode; variant?: Variant; fg?: string; bg?: string } = {}) {
  const p = new URLSearchParams();
  if (o.qr) p.set('qr', o.qr);
  if (o.variant) p.set('variant', o.variant);
  if (o.fg) p.set('fg', o.fg.replace('#', ''));
  if (o.bg) p.set('bg', o.bg.replace('#', ''));
  const q = p.toString();
  return `/api/tracks/${idHex}/code.svg${q ? `?${q}` : ''}`;
}

// Metadata bài hát lưu trong Vercel Blob: tracks/<idHex>.json ; file nhạc: audio/<idHex>.<ext>

import { head, put, list, BlobNotFoundError } from '@vercel/blob';
import type { AudioExt } from './audio.js';

export interface Track {
  idHex: string;
  title: string;
  artist: string;
  ext: AudioExt;
  audioUrl: string;
  size: number;
  createdAt: string;
}

export const metaPath = (idHex: string) => `tracks/${idHex}.json`;
export const audioPath = (idHex: string, ext: string) => `audio/${idHex}.${ext}`;

/** cache trong bộ nhớ instance (metadata không bao giờ đổi) */
const memo = new Map<string, Track>();

export async function getTrack(idHex: string): Promise<Track | null> {
  const hit = memo.get(idHex);
  if (hit) return hit;
  try {
    const h = await head(metaPath(idHex));
    const res = await fetch(h.url);
    if (!res.ok) return null;
    const t = (await res.json()) as Track;
    memo.set(idHex, t);
    return t;
  } catch (e) {
    if (e instanceof BlobNotFoundError) return null;
    throw e;
  }
}

export async function exists(pathname: string): Promise<{ url: string; size: number } | null> {
  try {
    const h = await head(pathname);
    return { url: h.url, size: h.size };
  } catch (e) {
    if (e instanceof BlobNotFoundError) return null;
    throw e;
  }
}

export async function saveTrack(t: Track): Promise<void> {
  await put(metaPath(t.idHex), JSON.stringify(t), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: false,
    cacheControlMaxAge: 3600,
  });
  memo.set(t.idHex, t);
}

export async function listTracks(): Promise<Track[]> {
  const out: Track[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix: 'tracks/', cursor, limit: 1000 });
    const items = await Promise.all(
      page.blobs.map(async (b) => {
        const id = b.pathname.slice(7, 15);
        if (memo.has(id)) return memo.get(id)!;
        const r = await fetch(b.url);
        if (!r.ok) return null;
        const t = (await r.json()) as Track;
        memo.set(id, t);
        return t;
      }),
    );
    for (const t of items) if (t) out.push(t);
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function publicTrack(t: Track, base: string) {
  return {
    idHex: t.idHex,
    title: t.title,
    artist: t.artist,
    audioUrl: t.audioUrl,
    playUrl: `${base}/p/${t.idHex}`,
    createdAt: t.createdAt,
  };
}

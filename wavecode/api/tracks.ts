// GET  /api/tracks  → danh sách (admin)
// POST /api/tracks  → hoàn tất upload: kiểm tra magic bytes rồi lưu metadata (admin)
import { del } from '@vercel/blob';
import { json, error, isAdmin, readJson, cleanText, publicBaseUrl, ID_HEX_RE } from './_lib/http.js';
import { isAudioExt, sniff } from './_lib/audio.js';
import { audioPath, exists, getTrack, listTracks, publicTrack, saveTrack } from './_lib/tracks.js';

export async function GET(req: Request) {
  if (!isAdmin(req)) return error(401, 'Sai mật khẩu');
  const base = publicBaseUrl(req);
  return json((await listTracks()).map((t) => publicTrack(t, base)));
}

export async function POST(req: Request) {
  if (!isAdmin(req)) return error(401, 'Sai mật khẩu');
  const b = await readJson(req);
  const idHex = String(b?.idHex ?? '');
  const ext = b?.ext;
  if (!ID_HEX_RE.test(idHex) || idHex === '00000000') return error(400, 'idHex không hợp lệ');
  if (!isAudioExt(ext)) return error(415, 'Chỉ nhận .mp3, .wav, .m4a, .ogg');
  const title = cleanText(b?.title);
  const artist = cleanText(b?.artist);
  if (title.length > 100 || artist.length > 100) return error(400, 'title/artist tối đa 100 ký tự');

  if (await getTrack(idHex)) return error(409, 'ID đã tồn tại');
  const blob = await exists(audioPath(idHex, ext));
  if (!blob) return error(400, 'Chưa thấy file đã upload');

  // magic bytes: đọc 16 byte đầu
  const head = await fetch(blob.url, { headers: { Range: 'bytes=0-15' } });
  const bytes = new Uint8Array(await head.arrayBuffer()).subarray(0, 16);
  if (sniff(bytes) !== ext) {
    await del(blob.url).catch(() => {});
    return error(415, 'Nội dung file không phải âm thanh hợp lệ (magic bytes)');
  }

  const track = {
    idHex,
    title: title || 'Không tên',
    artist,
    ext,
    audioUrl: blob.url,
    size: blob.size,
    createdAt: new Date().toISOString(),
  };
  await saveTrack(track);
  return json(publicTrack(track, publicBaseUrl(req)), 201);
}

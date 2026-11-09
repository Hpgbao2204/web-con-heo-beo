// GET /api/tracks/:idHex  (rewrite → /api/track?id=)  — công khai, cache ở CDN
import { json, error, publicBaseUrl, ID_HEX_RE } from './_lib/http.js';
import { getTrack, publicTrack } from './_lib/tracks.js';

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get('id') ?? '';
  if (!ID_HEX_RE.test(id)) return error(400, 'idHex không hợp lệ');
  const t = await getTrack(id);
  if (!t) return error(404, 'Không tìm thấy bài', { 'Cache-Control': 'public, s-maxage=10' });
  return json(publicTrack(t, publicBaseUrl(req)), 200, {
    'Cache-Control': 'public, max-age=300, s-maxage=86400, stale-while-revalidate=604800',
  });
}

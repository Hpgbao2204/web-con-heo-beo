// GET /api/stats?key=<ADMIN_KEY>  — đọc số liệu truy cập / quét (JSON)
import { json, error, canReadStats } from './_lib/http.js';
import { pipeline, redisEnabled } from './_lib/redis.js';
import { listTracks } from './_lib/tracks.js';

const P = 'wc:';

function hashToObj(arr: any): Record<string, number> {
  const o: Record<string, number> = {};
  if (Array.isArray(arr)) for (let i = 0; i + 1 < arr.length; i += 2) o[arr[i]] = Number(arr[i + 1]);
  return o;
}
const sortDesc = (o: Record<string, number>) => Object.fromEntries(Object.entries(o).sort((a, b) => b[1] - a[1]));
const sortKey = (o: Record<string, number>) => Object.fromEntries(Object.entries(o).sort((a, b) => a[0].localeCompare(b[0])));

export async function GET(req: Request) {
  if (!canReadStats(req)) return error(401, 'Sai khoá');
  if (!redisEnabled()) return error(503, 'Chưa kết nối Upstash Redis nên chưa có bộ đếm');

  const r = (await pipeline([
    ['GET', `${P}visits`],
    ['PFCOUNT', `${P}visitors`],
    ['GET', `${P}visits:qr`],
    ['HGETALL', `${P}visits:page`],
    ['GET', `${P}scans`],
    ['PFCOUNT', `${P}scanners`],
    ['HGETALL', `${P}scans:method`],
    ['HGETALL', `${P}scans:track`],
    ['GET', `${P}plays`],
    ['HGETALL', `${P}plays:track`],
    ['HGETALL', `${P}hourly:visits`],
    ['HGETALL', `${P}hourly:scans`],
  ]))!;

  const titles: Record<string, string> = {};
  try {
    for (const t of await listTracks()) titles[t.idHex] = t.title;
  } catch {}
  const named = (o: Record<string, number>) =>
    Object.fromEntries(Object.entries(sortDesc(o)).map(([id, n]) => [`${id} ${titles[id] ?? ''}`.trim(), n]));

  return json(
    {
      luotTruyCap: Number(r[0] ?? 0),
      nguoiTruyCapUocTinh: Number(r[1] ?? 0),
      luotVaoTuQR: Number(r[2] ?? 0),
      truyCapTheoTrang: hashToObj(r[3]),
      luotQuetThanhCong: Number(r[4] ?? 0),
      nguoiQuetUocTinh: Number(r[5] ?? 0),
      quetTheoCach: hashToObj(r[6]),
      quetTheoBai: named(hashToObj(r[7])),
      luotPhatNhac: Number(r[8] ?? 0),
      phatTheoBai: named(hashToObj(r[9])),
      truyCapTheoGio: sortKey(hashToObj(r[10])),
      quetTheoGio: sortKey(hashToObj(r[11])),
      ghiChu: 'Giờ theo múi Asia/Ho_Chi_Minh. "Ước tính" = đếm thiết bị khác nhau bằng HyperLogLog (sai số ~1%).',
    },
    200,
  );
}

// POST /api/hit  { type: 'visit'|'scan'|'play', vid, src?, id?, method? } — ghi bộ đếm vào Redis
import { ID_HEX_RE } from './_lib/http.js';
import { pipeline, hourBucket, redisEnabled } from './_lib/redis.js';

const P = 'wc:';
const VID_RE = /^[0-9a-z]{8,32}$/;
const noContent = () => new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });

export async function POST(req: Request) {
  if (!redisEnabled()) return noContent();
  const text = await req.text();
  if (text.length > 1024) return noContent();
  let b: any;
  try {
    b = JSON.parse(text);
  } catch {
    return noContent();
  }
  const vid = VID_RE.test(b?.vid) ? b.vid : null;
  const id = ID_HEX_RE.test(b?.id) ? b.id : null;
  const hour = hourBucket();
  const cmds: (string | number)[][] = [];

  switch (b?.type) {
    case 'visit':
      cmds.push(['INCR', `${P}visits`], ['HINCRBY', `${P}hourly:visits`, hour, 1]);
      if (b.src === 'qr') cmds.push(['INCR', `${P}visits:qr`]);
      if (typeof b.page === 'string' && /^(home|scan|player|show|library)$/.test(b.page))
        cmds.push(['HINCRBY', `${P}visits:page`, b.page, 1]);
      if (vid) cmds.push(['PFADD', `${P}visitors`, vid]);
      break;
    case 'scan':
      if (!id) return noContent();
      cmds.push(
        ['INCR', `${P}scans`],
        ['HINCRBY', `${P}scans:track`, id, 1],
        ['HINCRBY', `${P}scans:method`, b.method === 'photo' ? 'photo' : 'camera', 1],
        ['HINCRBY', `${P}hourly:scans`, hour, 1],
      );
      if (vid) cmds.push(['PFADD', `${P}scanners`, vid]);
      break;
    case 'play':
      if (!id) return noContent();
      cmds.push(['INCR', `${P}plays`], ['HINCRBY', `${P}plays:track`, id, 1]);
      break;
    default:
      return noContent();
  }
  try {
    await pipeline(cmds);
  } catch (e) {
    console.error('[hit]', e);
  }
  return noContent();
}

// Bộ đếm qua Upstash Redis REST API (không cần thư viện). Không cấu hình → bỏ qua lặng lẽ.

const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '';
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';

export const redisEnabled = () => !!(URL_ && TOKEN);

export async function pipeline(cmds: (string | number)[][]): Promise<any[] | null> {
  if (!redisEnabled() || cmds.length === 0) return null;
  const res = await fetch(`${URL_.replace(/\/+$/, '')}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmds),
  });
  if (!res.ok) throw new Error(`Redis ${res.status}: ${await res.text()}`);
  const out = (await res.json()) as { result?: any; error?: string }[];
  return out.map((r) => (r.error ? null : r.result));
}

/** "YYYY-MM-DD HH" theo giờ Việt Nam */
export function hourBucket(d = new Date()): string {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hour12: false,
    })
      .formatToParts(d)
      .map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day} ${p.hour === '24' ? '00' : p.hour}`;
}

// Chạy các Vercel Function trong api/ ở local (thay cho `vercel dev`, vốn lỗi symlink trên Windows).
// Đọc biến môi trường từ .env.local (tạo bằng `vercel env pull .env.local`).
import fs from 'node:fs';
import http from 'node:http';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
// .env.dev.local (nếu có) ghi đè cho riêng máy local, vd. mật khẩu thử
for (const f of ['.env.dev.local', '.env.local', '.env']) {
  const p = path.join(root, f);
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^"(.*)"$/, '$1');
  }
}

// cùng rewrite với vercel.json
function route(pathname: string): { file: string; query?: Record<string, string> } | null {
  let m = /^\/api\/tracks\/([^/]+)\/code\.svg$/.exec(pathname);
  if (m) return { file: 'code', query: { id: m[1] } };
  m = /^\/api\/tracks\/([^/]+)$/.exec(pathname);
  if (m) return { file: 'track', query: { id: m[1] } };
  m = /^\/api\/([a-z]+)$/.exec(pathname);
  if (m && !m[1].startsWith('_')) return { file: m[1] };
  return null;
}

const PORT = Number(process.env.API_PORT) || 3301;
http
  .createServer(async (req, res) => {
    try {
      const url = new URL(req.url!, `http://${req.headers.host}`);
      const r = route(url.pathname);
      const file = r && path.join(root, 'api', `${r.file}.ts`);
      if (!r || !file || !fs.existsSync(file)) {
        res.writeHead(404, { 'Content-Type': 'application/json' }).end('{"error":"Not found"}');
        return;
      }
      for (const [k, v] of Object.entries(r.query ?? {})) url.searchParams.set(k, v);
      const mod = await import(pathToFileURL(file).href);
      const handler = mod[req.method ?? 'GET'];
      if (!handler) {
        res.writeHead(405).end();
        return;
      }
      const chunks: Buffer[] = [];
      for await (const c of req) chunks.push(c as Buffer);
      const headers = new Headers();
      for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
      const request = new Request(url, {
        method: req.method,
        headers,
        body: chunks.length && req.method !== 'GET' && req.method !== 'HEAD' ? Buffer.concat(chunks) : undefined,
      });
      const out: Response = await handler(request);
      res.writeHead(out.status, Object.fromEntries(out.headers));
      res.end(Buffer.from(await out.arrayBuffer()));
    } catch (e) {
      console.error(e);
      res.writeHead(500, { 'Content-Type': 'application/json' }).end('{"error":"Lỗi server"}');
    }
  })
  .listen(PORT, () => console.log(`[api] http://localhost:${PORT}`));

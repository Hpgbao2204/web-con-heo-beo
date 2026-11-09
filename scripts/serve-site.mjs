// Xem thử dist/ ở máy (giống cách Vercel phục vụ): node scripts/serve-site.mjs
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const PORT = Number(process.env.PORT) || 3400;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.mp3': 'audio/mpeg', '.json': 'application/json' };
const vercel = JSON.parse(fs.readFileSync(path.join(DIST, '..', 'vercel.json'), 'utf8'));

function resolve(p) {
  const f = path.join(DIST, p);
  if (fs.existsSync(f) && fs.statSync(f).isFile()) return f;
  if (fs.existsSync(path.join(f, 'index.html'))) return path.join(f, 'index.html');
  if (fs.existsSync(f + '.html')) return f + '.html';
  return null;
}

http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let file = resolve(p);
  if (!file) {
    for (const r of vercel.rewrites || []) {
      const re = new RegExp('^' + r.source.replace(/:\w+/g, '[^/]+') + '$');
      if (re.test(p)) { file = resolve(r.destination); break; }
    }
  }
  if (!file) { res.writeHead(404); return res.end('404'); }
  const stat = fs.statSync(file);
  const type = TYPES[path.extname(file)] || 'application/octet-stream';
  const range = req.headers.range && /bytes=(\d*)-(\d*)/.exec(req.headers.range);
  if (range) {
    const start = range[1] ? +range[1] : 0;
    const end = range[2] ? +range[2] : stat.size - 1;
    res.writeHead(206, { 'Content-Type': type, 'Accept-Ranges': 'bytes',
      'Content-Range': `bytes ${start}-${end}/${stat.size}`, 'Content-Length': end - start + 1 });
    return fs.createReadStream(file, { start, end }).pipe(res);
  }
  res.writeHead(200, { 'Content-Type': type, 'Content-Length': stat.size, 'Accept-Ranges': 'bytes' });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, () => console.log(`http://localhost:${PORT}`));

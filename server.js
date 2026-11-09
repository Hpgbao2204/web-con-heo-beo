import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(ROOT, 'data');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const DB_FILE = path.join(DATA_DIR, 'signatures.json');
const PORT = Number(process.env.PORT) || 3000;

const EXT = { 'image/webp': 'webp', 'image/png': 'png' };

await fs.mkdir(UPLOAD_DIR, { recursive: true });

let signatures = [];
try {
  signatures = JSON.parse(await fs.readFile(DB_FILE, 'utf8'));
} catch {
  signatures = [];
}

// Ghi file JSON tuần tự để tránh hai request ghi đè lên nhau
let saveQueue = Promise.resolve();
function saveDb() {
  saveQueue = saveQueue.then(() => fs.writeFile(DB_FILE, JSON.stringify(signatures, null, 2)));
  return saveQueue;
}

// Danh sách màn hình TV đang mở (Server-Sent Events)
const clients = new Set();
function broadcast(event, data) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) res.write(msg);
}

const app = express();

app.use(express.static(path.join(ROOT, 'public')));
app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '1y', immutable: true }));
app.use('/vendor/three', express.static(path.join(ROOT, 'node_modules/three/build')));
app.use('/vendor/pdfjs', express.static(path.join(ROOT, 'node_modules/pdfjs-dist/build')));

app.get('/api/signatures', (req, res) => {
  res.json(signatures);
});

app.post('/api/signatures', express.raw({ type: Object.keys(EXT), limit: '5mb' }), async (req, res) => {
  const ext = EXT[req.headers['content-type']];
  if (!ext || !req.body?.length) {
    return res.status(400).json({ error: 'Chỉ nhận ảnh webp/png đã xử lý' });
  }
  const id = crypto.randomUUID();
  const file = `${id}.${ext}`;
  await fs.writeFile(path.join(UPLOAD_DIR, file), req.body);

  const sig = {
    id,
    url: `/uploads/${file}`,
    width: Number(req.headers['x-width']) || 0,
    height: Number(req.headers['x-height']) || 0,
    createdAt: Date.now(),
  };
  signatures.push(sig);
  await saveDb();
  broadcast('added', sig);
  res.status(201).json(sig);
});

app.delete('/api/signatures/:id', async (req, res) => {
  const idx = signatures.findIndex((s) => s.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Không tìm thấy' });
  const [sig] = signatures.splice(idx, 1);
  await saveDb();
  await fs.rm(path.join(UPLOAD_DIR, path.basename(sig.url)), { force: true });
  broadcast('removed', { id: sig.id });
  res.json({ ok: true });
});

app.get('/api/events', (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  res.flushHeaders();
  res.write('retry: 2000\n\n');
  clients.add(res);
  const ping = setInterval(() => res.write(': ping\n\n'), 25000);
  req.on('close', () => {
    clearInterval(ping);
    clients.delete(res);
  });
});

const server = app.listen(PORT, () => {
  console.log(`Admin:   http://localhost:${PORT}/admin.html`);
  console.log(`Màn TV:  http://localhost:${PORT}/display.html`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Cổng ${PORT} đang bị chiếm (có thể server đang chạy ở cửa sổ khác).`);
    console.error(`Tắt cái đang chạy, hoặc dùng cổng khác: $env:PORT=3001; npm start`);
    process.exit(1);
  }
  throw err;
});

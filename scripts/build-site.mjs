// Gom các web tĩnh vào dist/ để deploy lên Vercel. Mỗi tính năng = một đường dẫn:
//   /            -> hub/            (trang mục lục)
//   /nhac/<bài>  -> NFC/nhac/       (trang nghe nhạc cho chip NFC)
// Thêm web mới: thêm một dòng vào SITES.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'dist');

export const SITES = [
  { from: 'hub', to: '' },
  { from: 'NFC/nhac', to: 'nhac' },
];

fs.rmSync(OUT, { recursive: true, force: true });
for (const s of SITES) {
  fs.cpSync(path.join(ROOT, s.from), path.join(OUT, s.to), { recursive: true });
  console.log(`  ${s.from} -> dist/${s.to}`);
}

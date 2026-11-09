// Sinh icon PWA (PNG) + favicon.svg vào public/.
import fs from 'node:fs';
import path from 'node:path';
import { Resvg } from '@resvg/resvg-js';

const OUT = path.resolve('public');
fs.mkdirSync(path.join(OUT, 'icons'), { recursive: true });

const heights = [0.35, 0.6, 0.9, 0.55, 1, 0.7, 0.4];
function iconSvg(size: number, pad: number, rounded: boolean) {
  const inner = size - pad * 2;
  const n = heights.length;
  const bw = inner / (n * 2 - 1);
  const bars = heights
    .map((h, i) => {
      const bh = inner * 0.62 * h;
      const x = pad + i * bw * 2;
      return `<rect x="${x}" y="${size / 2 - bh / 2}" width="${bw}" height="${bh}" rx="${bw / 2}" fill="url(#g)"/>`;
    })
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#a78bfa"/><stop offset="1" stop-color="#22d3ee"/></linearGradient></defs>
<rect width="${size}" height="${size}" rx="${rounded ? size * 0.22 : 0}" fill="#0b0b12"/>${bars}</svg>`;
}

const png = (svg: string) => new Resvg(svg).render().asPng();
fs.writeFileSync(path.join(OUT, 'favicon.svg'), iconSvg(64, 10, true));
fs.writeFileSync(path.join(OUT, 'icons/icon-192.png'), png(iconSvg(192, 34, true)));
fs.writeFileSync(path.join(OUT, 'icons/icon-512.png'), png(iconSvg(512, 90, true)));
// maskable: nền tràn viền, nội dung nằm trong vùng an toàn 80%
fs.writeFileSync(path.join(OUT, 'icons/maskable-512.png'), png(iconSvg(512, 130, false)));
fs.writeFileSync(path.join(OUT, 'apple-touch-icon.png'), png(iconSvg(180, 32, false)));
console.log('Đã sinh icon trong public/');

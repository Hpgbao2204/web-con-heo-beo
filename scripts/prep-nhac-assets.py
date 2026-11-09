"""Chuẩn bị asset web từ file thiết kế gốc trong NFC/WEB NHẠC.

- Mây / nốt nhạc: xuất thành ảnh WebP trong suốt, cắt khít hình. (Không dùng SVG cắt khung
  vì các lớp mask trong file gốc làm trình duyệt điện thoại cắt mất một phần hình.)
- Nút bấm: SVG cắt khung (dùng làm favicon).
- Hình nền SVG (5MB, chứa ảnh PNG nhúng) -> WebP rộng 1080.
- Chép file nhạc.

Chạy: python scripts/prep-nhac-assets.py <thư-mục-png>
(<thư-mục-png>: các SVG gốc đã render ra PNG bằng resvg, rộng 2160 — khung gốc, không cắt)
"""
import re, shutil, sys
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'NFC' / 'WEB NHẠC'
OUT = ROOT / 'NFC' / 'nhac'
render = Path(sys.argv[1])

ELEMENTS = {
    'mây 1': 'cloud-1', 'mây 2': 'cloud-2',
    'nốt nhạc 1': 'note-1', 'nốt nhạc 2': 'note-2', 'nốt nhạc 3': 'note-3',
    'nốt nhạc 4': 'note-4', 'nốt nhạc 5': 'note-5', 'Nút bấm': 'play',
}
(OUT / 'assets').mkdir(parents=True, exist_ok=True)
TARGET = {'cloud': ('w', 900), 'note': ('h', 220)}
for src, dst in ELEMENTS.items():
    im = Image.open(render / f'{src}.png').convert('RGBA')
    x0, y0, x1, y1 = im.getbbox()
    K = 810 / im.width  # px -> đơn vị viewBox gốc
    if dst == 'play':
        vb = f'{x0*K:.2f} {y0*K:.2f} {(x1-x0)*K:.2f} {(y1-y0)*K:.2f}'
        svg = (SRC / 'Tư liệu' / f'{src}.svg').read_text(encoding='utf-8')
        head_end = svg.index('>') + 1
        head = re.sub(r'viewBox="[^"]*"', f'viewBox="{vb}"', svg[:head_end])
        head = re.sub(r'\swidth="[^"]*"', ' width="512"', head)
        head = re.sub(r'\sheight="[^"]*"', ' height="512"', head)
        (OUT / 'assets' / 'play.svg').write_text(head + svg[head_end:], encoding='utf-8')
        continue
    crop = im.crop((x0, y0, x1, y1))
    axis, n = TARGET[dst.split('-')[0]]
    size = (n, round(n * crop.height / crop.width)) if axis == 'w' else (round(n * crop.width / crop.height), n)
    crop.resize(size, Image.LANCZOS).save(OUT / 'assets' / f'{dst}.webp', 'WEBP', quality=90, method=6)
    old = OUT / 'assets' / f'{dst}.svg'
    if old.exists():
        old.unlink()
    print(dst, size, f'ratio={crop.width/crop.height:.4f}')

song = OUT / 'media' / 'ho-to-loi'
song.mkdir(parents=True, exist_ok=True)
for sz in ('1920', '2400'):
    im = Image.open(render / f'Hình nền web 1080.{sz}.png').convert('RGB')
    im = im.resize((1080, round(1080 * im.height / im.width)), Image.LANCZOS)
    im.save(song / f'bg-{sz}.webp', 'WEBP', quality=82, method=6)
    # bản nhỏ, mờ làm nền phía sau (desktop / màn hình lệch tỉ lệ)
    im.resize((54, int(54 * im.height / im.width))).save(song / f'bg-{sz}-blur.webp', 'WEBP', quality=60)
shutil.copyfile(SRC / 'Giọng hò nghệ nhân Kim Nhụy - trích từ phim Nổi Gió.mp3', song / 'audio.mp3')
for f in sorted(song.iterdir()):
    print(f.name, f.stat().st_size // 1024, 'KB')

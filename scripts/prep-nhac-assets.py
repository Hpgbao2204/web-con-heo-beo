"""Chuẩn bị asset web từ file thiết kế gốc trong NFC/WEB NHẠC.

- Cắt khung (viewBox) các SVG mây / nốt nhạc / nút cho vừa khít hình.
- Xuất hình nền SVG (5MB, chứa ảnh PNG nhúng) thành WebP nhẹ.
- Chép file nhạc.

Chạy: python scripts/prep-nhac-assets.py <thư-mục-png-render-1080>
(thư mục PNG do resvg render từ các SVG gốc ở chiều rộng 1080, dùng để đo khung hình)
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
K = 810 / 1080  # px (render 1080) -> đơn vị viewBox
(OUT / 'assets').mkdir(parents=True, exist_ok=True)
for src, dst in ELEMENTS.items():
    x0, y0, x1, y1 = Image.open(render / f'{src}.png').getbbox()
    vb = f'{x0*K:.2f} {y0*K:.2f} {(x1-x0)*K:.2f} {(y1-y0)*K:.2f}'
    svg = (SRC / 'Tư liệu' / f'{src}.svg').read_text(encoding='utf-8')
    head_end = svg.index('>') + 1
    head = svg[:head_end]
    head = re.sub(r'viewBox="[^"]*"', f'viewBox="{vb}"', head)
    head = re.sub(r'\swidth="[^"]*"', f' width="{x1-x0}"', head)
    head = re.sub(r'\sheight="[^"]*"', f' height="{y1-y0}"', head)
    if dst.startswith('note-'):  # cho phép kéo giãn nhẹ đúng như bản mẫu
        head = head.replace('preserveAspectRatio="xMidYMid meet"', 'preserveAspectRatio="none"')
    (OUT / 'assets' / f'{dst}.svg').write_text(head + svg[head_end:], encoding='utf-8')
    print(dst, vb, f'ratio={(x1-x0)/(y1-y0):.4f}')

song = OUT / 'media' / 'ho-to-loi'
song.mkdir(parents=True, exist_ok=True)
for sz in ('1920', '2400'):
    im = Image.open(render / f'Hình nền web 1080.{sz}.png').convert('RGB')
    im.save(song / f'bg-{sz}.webp', 'WEBP', quality=82, method=6)
    # bản nhỏ, mờ làm nền phía sau (desktop / màn hình lệch tỉ lệ)
    im.resize((54, int(54 * im.height / im.width))).save(song / f'bg-{sz}-blur.webp', 'WEBP', quality=60)
shutil.copyfile(SRC / 'Giọng hò nghệ nhân Kim Nhụy - trích từ phim Nổi Gió.mp3', song / 'audio.mp3')
for f in sorted(song.iterdir()):
    print(f.name, f.stat().st_size // 1024, 'KB')

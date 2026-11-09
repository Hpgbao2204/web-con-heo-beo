# WaveCode — mã sóng âm quét ra file nhạc

Upload một bài nhạc → nhận một **hình sóng âm** (kèm QR nhỏ) để in ra hoặc chiếu lên màn hình. Người tham dự mở web trên điện thoại, đưa camera vào hình là nghe được bài đó.

**Production:** https://wavecode-iota.vercel.app (Vercel, gói Hobby miễn phí)

## Luồng sự kiện

1. **Ban tổ chức** vào `/` (cần mật khẩu `ADMIN_KEY`) → upload nhạc → tải mã **SVG/PNG để in**, hoặc bấm **Trình chiếu** (`/show/<id>`: mã thật to, bấm vào màn hình để toàn màn hình).
2. **Người tham dự** quét **QR tròn** bằng camera gốc → mở `/scan` → đưa camera vào **sóng âm** → trang phát nhạc.
   Hoặc gõ thẳng `wavecode-iota.vercel.app/scan`.
3. Xem số liệu: `https://wavecode-iota.vercel.app/api/stats?key=<STATS_KEY>`

Khách chỉ thấy nút **Quét**. Menu Tạo mã / Thư viện chỉ hiện trên máy đã nhập mật khẩu.

## Mật khẩu & khoá

Mật khẩu nằm trong `.env.local` trên máy này (tải về bằng `vercel env pull .env.local`) và trong Vercel → Project *wavecode* → Settings → Environment Variables:

| Biến | Dùng để |
|---|---|
| `ADMIN_KEY` | mật khẩu trang Tạo mã / Thư viện |
| `STATS_KEY` | xem `/api/stats?key=…`. Tách riêng nên lỡ lộ link số liệu cũng không ai upload được |
| `BLOB_READ_WRITE_TOKEN` | Vercel tự thêm khi kết nối kho Blob `wavecode-audio` |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Vercel tự thêm khi kết nối Upstash Redis (bộ đếm). Thiếu thì app vẫn chạy, chỉ không đếm |
| `MAX_UPLOAD_MB` | mặc định 20 |
| `PUBLIC_BASE_URL` | bỏ trống = domain production của Vercel (URL nhúng vào QR) |

Đổi biến trên Vercel xong phải **deploy lại** thì mới có hiệu lực.

## Số liệu (`/api/stats`)

| Trường | Ý nghĩa |
|---|---|
| `luotTruyCap` | số lần mở web (mỗi lần tải trang tính 1) |
| `nguoiTruyCapUocTinh` | số điện thoại khác nhau (HyperLogLog, sai số ~1%) |
| `luotVaoTuQR` | lượt mở web từ QR in/chiếu (`?src=qr`) |
| `luotQuetThanhCong`, `nguoiQuetUocTinh` | số lần quét sóng âm ra bài, số máy đã quét |
| `quetTheoCach` | `camera` hay `photo` (chọn ảnh) |
| `quetTheoBai`, `phatTheoBai`, `luotPhatNhac` | theo từng bài |
| `truyCapTheoGio`, `quetTheoGio` | theo giờ Việt Nam |

Bộ đếm lưu trong Upstash Redis, **không** lưu trong Blob: gói Hobby của Blob chỉ cho 2.000 lượt ghi/tháng.

## Hạn mức free cần biết (Hobby)

- **Blob:** 1 GB lưu trữ, 10 GB băng thông/tháng (≈ 2.000 lượt nghe một bài 5 MB), 2.000 lượt ghi/tháng (chỉ tốn khi upload).
- **Functions:** 1 triệu lượt gọi/tháng. Metadata bài và hình mã được cache ở CDN nên rất ít khi gọi tới.
- **Upstash Redis free:** khoảng 500K lệnh/tháng. Mỗi sự kiện tốn khoảng 3–5 lệnh.

## Deploy

```bash
cd wavecode
npm install
npx vercel@latest login          # một lần
npm run deploy                   # = vercel deploy --prod
```

## Chạy local

`vercel dev` lỗi symlink trên Windows, nên dự án có dev server riêng (`scripts/dev-api.ts`) chạy trực tiếp các handler trong `api/`:

```bash
npx vercel@latest env pull .env.local   # lấy BLOB_READ_WRITE_TOKEN…
npm run dev                              # web http://localhost:3300, API :3301
```

`.env.dev.local` (nếu có) ghi đè biến cho riêng máy local, ví dụ mật khẩu thử. Lưu ý: chạy local vẫn upload vào **kho Blob thật**.

`npm test` chạy unit test thư viện mã, test raster decoder và test QR.

## Kiến trúc

```
shared/wavecode/   GF(256), Reed–Solomon, Gray, encode (→ SVG), decode — dùng chung client & server
src/scanner/       decoder thuần (Otsu/adaptive → components → chuỗi 26 thanh → RS) + camera
src/pages/         Upload, Scan, Player, Library, Show (trình chiếu)
api/               Vercel Functions: config, auth, upload (token Blob), tracks, track, code (SVG), hit, stats
api/_lib/          http, audio (magic bytes), code (QR), tracks (Blob), redis (Upstash REST)
vercel.json        rewrite /api/tracks/:id[/code.svg] + SPA fallback
```

- **Upload:** trình duyệt upload thẳng lên Blob bằng token ngắn hạn do `/api/upload` cấp (chỉ cấp khi đúng `ADMIN_KEY`, chỉ nhận `audio/<id>.<ext>`, ≤ `MAX_UPLOAD_MB`, không ghi đè). Sau đó `/api/tracks` kiểm tra **magic bytes** (đọc 16 byte đầu). Sai định dạng thì xoá file, đúng thì lưu `tracks/<id>.json`.
- **Định dạng mã v1:** `[0x01][id 4 byte]` + RS 4 parity → 72 bit → 24 thanh × 3 bit (Gray, 8 mức). QR mức M trong hình tròn bên trái, luôn vẽ module tối trên nền sáng.
- **Decoder:** test raster (xoay ±8°, scale 50–150%, blur, nhiễu, 4 bảng màu) đọc đúng 240/240, không lần nào đọc ra ID sai. Khoảng 3 ms/ảnh.

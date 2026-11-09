// Danh sách bài nhạc cho trang NFC.
// Mỗi bài có một đường dẫn riêng: /nhac/<slug>  (đây là link ghi vào chip NFC).
//
// Thêm bài mới:
//   1. Tạo thư mục media/<slug>/ gồm: bg-1920.webp, bg-2400.webp (hình nền đã có ảnh + tên bài),
//      bg-1920-blur.webp, bg-2400-blur.webp (bản thu nhỏ để làm nền mờ) và audio.mp3.
//      Có thể dùng scripts/prep-nhac-assets.py làm mẫu để xuất từ file thiết kế SVG.
//   2. Thêm một mục vào SONGS bên dưới. Nếu nền mới đặt nút / sóng âm ở vị trí khác,
//      ghi đè bằng `layout` (cùng dạng với LAYOUTS trong app.js).
window.SONGS = {
  'ho-to-loi': {
    title: 'Giọng hò của Cố nghệ sĩ Kim Nhụy',
    subtitle: 'Talkshow Hò Tỏ Lời — Một tiếng hò xưa, mội miền thương nhớ',
    artist: 'Nghệ nhân Kim Nhụy',
    source: 'Trích từ phim Nổi Gió',
    audio: '/nhac/media/ho-to-loi/audio.mp3',
    bg: {
      1920: '/nhac/media/ho-to-loi/bg-1920.webp',
      2400: '/nhac/media/ho-to-loi/bg-2400.webp',
    },
    bgBlur: {
      1920: '/nhac/media/ho-to-loi/bg-1920-blur.webp',
      2400: '/nhac/media/ho-to-loi/bg-2400-blur.webp',
    },
  },
};

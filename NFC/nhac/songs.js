// Danh sách bài nhạc cho trang NFC.
// Mỗi bài có một đường dẫn riêng: /nhac/<slug>  (đây là link ghi vào chip NFC — đừng đổi slug sau khi đã ghi chip).
//
// Thêm bài mới:
//   1. Tạo thư mục media/<slug>/ và chép file nhạc vào (audio.mp3 hoặc audio.m4a).
//   2. Thêm một mục vào SONGS bên dưới. Bài cùng thiết kế thì dùng lại nền KIM_NHUY.
//      Nền khác: thêm bg-1920.webp, bg-2400.webp (+ bản -blur) vào media/<slug>/
//      (xuất từ file thiết kế SVG bằng scripts/prep-nhac-assets.py).
//      Nếu nền mới đặt nút / sóng âm ở vị trí khác, ghi đè bằng `layout` (cùng dạng LAYOUTS trong app.js).

// Nền "Giọng hò của Cố nghệ sĩ Kim Nhụy" (ảnh + chữ đã có sẵn trong hình)
const KIM_NHUY = {
  bg: {
    1920: '/nhac/media/ho-to-loi/bg-1920.webp',
    2400: '/nhac/media/ho-to-loi/bg-2400.webp',
  },
  bgBlur: {
    1920: '/nhac/media/ho-to-loi/bg-1920-blur.webp',
    2400: '/nhac/media/ho-to-loi/bg-2400-blur.webp',
  },
  artist: 'Nghệ sĩ Kim Nhụy',
};

window.SONGS = {
  'ho-to-loi': {
    ...KIM_NHUY,
    title: 'Giọng hò của Cố nghệ sĩ Kim Nhụy',
    source: 'Trích từ phim Nổi Gió',
    audio: '/nhac/media/ho-to-loi/audio.mp3',
  },
  'cau-ho-bong-sen': {
    ...KIM_NHUY,
    title: 'Câu hò Bông Sen',
    audio: '/nhac/media/cau-ho-bong-sen/audio.m4a',
  },
  'cau-ho-co-ngay-xua': {
    ...KIM_NHUY,
    title: 'Câu hò cổ ngày xưa',
    audio: '/nhac/media/cau-ho-co-ngay-xua/audio.m4a',
  },
  'cau-ho-doi-dap-cua-nam': {
    ...KIM_NHUY,
    title: 'Câu hò đối đáp của Nam',
    audio: '/nhac/media/cau-ho-doi-dap-cua-nam/audio.m4a',
  },
};

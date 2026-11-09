// Camera + vòng quét: lấy frame mỗi ~150 ms trong vùng khung hướng dẫn, giải mã,
// chỉ chấp nhận khi 3 frame liên tiếp ra cùng ID.

import { scanImage, type ScanStats } from './pipeline';
import type { DecodeResult } from '../../shared/wavecode/decode';

export async function openCamera(video: HTMLVideoElement): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error(
      window.isSecureContext
        ? 'Trình duyệt không hỗ trợ camera.'
        : 'Camera chỉ chạy trên HTTPS (hoặc localhost). Hãy mở bằng https://…',
    );
  }
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
  });
  video.srcObject = stream;
  video.muted = true;
  video.playsInline = true;
  await video.play();
  // lấy nét liên tục nếu hỗ trợ
  const track = stream.getVideoTracks()[0];
  const caps = (track.getCapabilities?.() ?? {}) as any;
  if (caps.focusMode?.includes?.('continuous')) {
    track.applyConstraints({ advanced: [{ focusMode: 'continuous' } as any] }).catch(() => {});
  }
  return stream;
}

export function stopCamera(stream: MediaStream | null) {
  stream?.getTracks().forEach((t) => t.stop());
}

/**
 * Quy đổi khung hướng dẫn (toạ độ CSS trong phần tử video, object-fit: cover)
 * sang toạ độ pixel của video gốc.
 */
export function guideToVideoRect(video: HTMLVideoElement, guide: DOMRect, padding = 0.12) {
  const vr = video.getBoundingClientRect();
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const scale = Math.max(vr.width / vw, vr.height / vh); // cover
  const dispW = vw * scale;
  const dispH = vh * scale;
  const offX = (vr.width - dispW) / 2;
  const offY = (vr.height - dispH) / 2;
  const padX = guide.width * padding;
  const padY = guide.height * padding;
  let x = (guide.left - vr.left - padX - offX) / scale;
  let y = (guide.top - vr.top - padY - offY) / scale;
  let w = (guide.width + 2 * padX) / scale;
  let h = (guide.height + 2 * padY) / scale;
  x = Math.max(0, x);
  y = Math.max(0, y);
  w = Math.min(vw - x, w);
  h = Math.min(vh - y, h);
  return { x, y, w, h };
}

export type ScanStatus = 'idle' | 'searching' | 'reading' | 'found';

export interface ScanLoopOptions {
  video: HTMLVideoElement;
  getGuide: () => DOMRect | null;
  onStatus: (s: ScanStatus) => void;
  onResult: (r: DecodeResult) => void;
  intervalMs?: number;
  /** số frame liên tiếp cùng ID cần để chấp nhận */
  stableFrames?: number;
}

export function startScanLoop(o: ScanLoopOptions) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const interval = o.intervalMs ?? 150;
  const need = o.stableFrames ?? 3;
  let timer = 0;
  let stopped = false;
  let streakId: string | null = null;
  let streak = 0;
  let lastHit = 0;
  let paused = false;

  const tick = () => {
    if (stopped) return;
    timer = window.setTimeout(tick, interval);
    if (paused || o.video.readyState < 2 || !o.video.videoWidth) return;
    const guide = o.getGuide();
    if (!guide) return;
    const r = guideToVideoRect(o.video, guide);
    // thu nhỏ vùng cắt về tối đa 960 px ngang
    const s = Math.min(1, 960 / r.w);
    canvas.width = Math.max(1, Math.round(r.w * s));
    canvas.height = Math.max(1, Math.round(r.h * s));
    ctx.drawImage(o.video, r.x, r.y, r.w, r.h, 0, 0, canvas.width, canvas.height);
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const stats: ScanStats = { components: 0, sawCode: false };
    const res = scanImage(img, { maxWidth: 960 }, stats);
    const now = performance.now();

    if (res) {
      // khác ID, hoặc quá lâu không đọc được → đếm lại
      if (res.idHex !== streakId || now - lastHit > 1500) {
        streakId = res.idHex;
        streak = 0;
      }
      streak++;
      lastHit = now;
      if (streak >= need) {
        o.onStatus('found');
        paused = true;
        streak = 0;
        streakId = null;
        o.onResult(res);
        return;
      }
      o.onStatus('reading');
    } else {
      o.onStatus(stats.sawCode || now - lastHit < 600 ? 'reading' : 'searching');
    }
  };
  tick();

  return {
    stop() {
      stopped = true;
      clearTimeout(timer);
    },
    resume() {
      paused = false;
    },
  };
}

/** Fallback: giải mã từ ảnh tĩnh người dùng chọn */
export async function scanFile(file: File): Promise<DecodeResult | null> {
  const bmp = await createImageBitmap(file).catch(async () => {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return img;
    } finally {
      URL.revokeObjectURL(url);
    }
  });
  const W = 'naturalWidth' in bmp ? bmp.naturalWidth : bmp.width;
  const H = 'naturalHeight' in bmp ? bmp.naturalHeight : bmp.height;
  // thử vài độ phân giải: mã có thể chiếm phần nhỏ của ảnh lớn
  for (const maxW of [1600, 1000, 2400]) {
    const s = Math.min(1, maxW / W);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(W * s);
    canvas.height = Math.round(H * s);
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const res = scanImage(ctx.getImageData(0, 0, canvas.width, canvas.height), { maxWidth: maxW });
    if (res) return res;
  }
  return null;
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { openCamera, stopCamera, startScanLoop, scanFile, type ScanStatus } from '../scanner/camera';
import { getTrack, ApiError } from '../lib/api';
import { isIos, isStandalone, useInstallPrompt } from '../lib/install';
import type { DecodeResult } from '../../shared/wavecode/decode';
import { hit } from '../lib/track';

type UiStatus = ScanStatus | 'notfound' | 'error' | 'starting';

const LABEL: Record<UiStatus, string> = {
  starting: 'Đang mở camera…',
  idle: 'Đưa sóng âm vào khung',
  searching: 'Đưa sóng âm vào khung',
  reading: 'Đang đọc…',
  found: 'Đã nhận!',
  notfound: 'Không tìm thấy bài',
  error: 'Không mở được camera',
};

export default function Scan() {
  const nav = useNavigate();
  const video = useRef<HTMLVideoElement>(null);
  const guide = useRef<HTMLDivElement>(null);
  const loop = useRef<ReturnType<typeof startScanLoop> | null>(null);
  const [status, setStatus] = useState<UiStatus>('starting');
  const [camError, setCamError] = useState<string | null>(null);
  const [fileMsg, setFileMsg] = useState<string | null>(null);
  const [lastId, setLastId] = useState<string | null>(null);
  const install = useInstallPrompt();
  const [hideHint, setHideHint] = useState(() => {
    try {
      return localStorage.getItem('wc-hide-install') === '1';
    } catch {
      return false;
    }
  });

  const handleResult = useCallback(
    async (r: DecodeResult, method: 'camera' | 'photo', resume?: () => void) => {
      setLastId(r.idHex);
      try {
        navigator.vibrate?.(60);
      } catch {}
      setStatus('found');
      try {
        await getTrack(r.idHex);
        hit({ type: 'scan', id: r.idHex, method });
        nav(`/p/${r.idHex}`, { state: { fromScan: true } });
      } catch (e) {
        setStatus(e instanceof ApiError && e.status === 404 ? 'notfound' : 'error');
        if (!(e instanceof ApiError && e.status === 404)) setCamError((e as Error).message);
        setTimeout(() => {
          setStatus('searching');
          resume?.();
        }, 2200);
      }
    },
    [nav],
  );

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;
    (async () => {
      try {
        const v = video.current!;
        stream = await openCamera(v);
        if (cancelled) return stopCamera(stream);
        setStatus('searching');
        const l = startScanLoop({
          video: v,
          getGuide: () => guide.current?.getBoundingClientRect() ?? null,
          onStatus: (s) => setStatus((prev) => (prev === 'notfound' || prev === 'found' ? prev : s)),
          onResult: (r) => handleResult(r, 'camera', () => l.resume()),
        });
        loop.current = l;
      } catch (e: any) {
        if (cancelled) return;
        setStatus('error');
        setCamError(
          e?.name === 'NotAllowedError'
            ? 'Bạn đã chặn quyền camera. Cho phép lại trong cài đặt trình duyệt, hoặc dùng "Chọn ảnh".'
            : e?.name === 'NotFoundError'
              ? 'Không tìm thấy camera trên thiết bị này.'
              : e?.message || String(e),
        );
      }
    })();
    return () => {
      cancelled = true;
      loop.current?.stop();
      stopCamera(stream);
    };
  }, [handleResult]);

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setFileMsg('Đang đọc ảnh…');
    const r = await scanFile(f).catch(() => null);
    if (!r) return setFileMsg('Không thấy mã sóng âm trong ảnh. Chụp thẳng, rõ nét, đủ sáng nhé.');
    setFileMsg(null);
    handleResult(r, 'photo');
  };

  const showInstall = !hideHint && !isStandalone() && (install.canPrompt || isIos());
  const dismissHint = () => {
    setHideHint(true);
    try {
      localStorage.setItem('wc-hide-install', '1');
    } catch {}
  };

  const tone =
    status === 'found'
      ? 'border-emerald-400 shadow-[0_0_0_9999px_rgba(0,0,0,0.55),0_0_30px_rgba(52,211,153,0.6)]'
      : status === 'notfound'
        ? 'border-amber-400 shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]'
        : status === 'reading'
          ? 'border-accent2 shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]'
          : 'border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]';

  return (
    <div className="fixed inset-0 flex flex-col bg-black pb-[calc(56px+env(safe-area-inset-bottom))]">
      <div className="relative flex-1 overflow-hidden">
        <video ref={video} className="absolute inset-0 h-full w-full object-cover" playsInline muted autoPlay />

        {/* khung hướng dẫn 4:1 */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div ref={guide} className={`relative aspect-[4/1] w-[90%] max-w-2xl rounded-2xl border-2 transition-colors ${tone}`}>
            {status === 'reading' && (
              <div className="absolute inset-0 overflow-hidden rounded-2xl">
                <div className="scanline h-full w-1/3 bg-gradient-to-r from-transparent via-accent2/30 to-transparent" />
              </div>
            )}
          </div>
        </div>

        <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4 pt-[max(1rem,env(safe-area-inset-top))]">
          <Link to="/" className="rounded-full bg-black/50 px-3 py-1.5 text-sm text-white/80 backdrop-blur">
            ← WaveCode
          </Link>
        </div>

        <div className="absolute inset-x-0 bottom-[18%] text-center">
          <span
            className={`inline-block rounded-full px-4 py-2 text-sm font-medium backdrop-blur ${
              status === 'found' ? 'bg-emerald-500/90 text-white' : status === 'notfound' ? 'bg-amber-500/90 text-ink' : 'bg-black/60 text-white'
            }`}
          >
            {LABEL[status]}
            {status === 'notfound' && lastId ? ` (${lastId})` : ''}
          </span>
          {camError && <p className="mx-auto mt-2 max-w-xs text-xs text-red-300">{camError}</p>}
          {fileMsg && <p className="mx-auto mt-2 max-w-xs text-xs text-white/80">{fileMsg}</p>}
        </div>
      </div>

      <div className="space-y-2 bg-ink p-3">
        {showInstall && (
          <div className="flex items-center gap-2 rounded-xl border border-line bg-panel px-3 py-2 text-xs">
            <span className="flex-1 text-white/70">
              {install.canPrompt ? 'Cài WaveCode lên màn hình chính để mở nhanh như app.' : 'Thêm vào màn hình chính: bấm Chia sẻ ⎋ → "Thêm vào MH chính".'}
            </span>
            {install.canPrompt && (
              <button className="btn-primary px-3 py-1.5 text-xs" onClick={() => install.prompt()}>
                Cài app
              </button>
            )}
            <button className="px-1 text-white/40" onClick={dismissHint} aria-label="Ẩn">
              ✕
            </button>
          </div>
        )}
        <label className="btn-ghost w-full cursor-pointer">
          <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
          Chọn ảnh có mã
        </label>
      </div>
    </div>
  );
}

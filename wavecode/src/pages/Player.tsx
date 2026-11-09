import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { getTrack, ApiError, type Track } from '../lib/api';
import CodeView from '../components/CodeView';
import { hit } from '../lib/track';

export default function Player() {
  const { idHex = '' } = useParams();
  const loc = useLocation();
  const fromScan = (loc.state as any)?.fromScan === true;
  const [track, setTrack] = useState<Track | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needTap, setNeedTap] = useState(false);
  const audio = useRef<HTMLAudioElement>(null);
  const played = useRef(false);

  useEffect(() => {
    setTrack(null);
    setError(null);
    if (!/^[0-9a-f]{8}$/.test(idHex)) return setError('Mã bài không hợp lệ');
    getTrack(idHex)
      .then((t) => {
        setTrack(t);
        document.title = `${t.title} · WaveCode`;
      })
      .catch((e) => setError(e instanceof ApiError && e.status === 404 ? 'Không tìm thấy bài' : e.message));
    return () => {
      document.title = 'WaveCode';
    };
  }, [idHex]);

  // thử tự phát; trình duyệt có thể chặn autoplay → hiện nút phát to
  useEffect(() => {
    if (!track || !audio.current) return;
    audio.current.play().then(
      () => setNeedTap(false),
      () => setNeedTap(true),
    );
  }, [track]);

  if (error)
    return (
      <div className="py-16 text-center">
        <p className="text-lg">{error}</p>
        <Link to="/scan" className="btn-ghost mt-4">
          Quét lại
        </Link>
      </div>
    );

  if (!track) return <p className="py-20 text-center text-white/40">Đang tải…</p>;

  return (
    <section className="space-y-5">
      {fromScan && <p className="text-center text-xs text-emerald-400">✓ Đã nhận diện sóng âm</p>}
      <div className="card overflow-hidden">
        <div className="relative flex aspect-[2/1] items-center justify-center bg-gradient-to-br from-accent/30 via-ink to-accent2/20">
          <Bars playing={!needTap} />
          {needTap && (
            <button
              onClick={() => audio.current?.play().then(() => setNeedTap(false))}
              className="absolute flex h-20 w-20 items-center justify-center rounded-full bg-white text-ink shadow-xl transition active:scale-95"
              aria-label="Phát"
            >
              <svg viewBox="0 0 24 24" className="ml-1 h-9 w-9" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            </button>
          )}
        </div>
        <div className="space-y-3 p-4">
          <div>
            <h1 className="text-2xl font-semibold leading-tight">{track.title}</h1>
            <p className="text-white/55">{track.artist || 'Không rõ nghệ sĩ'}</p>
          </div>
          <audio
            ref={audio}
            src={track.audioUrl}
            controls
            preload="auto"
            className="w-full"
            onPlay={() => {
              setNeedTap(false);
              if (!played.current) {
                played.current = true;
                hit({ type: 'play', id: track.idHex });
              }
            }}
            onPause={() => setNeedTap(true)}
          />
        </div>
      </div>
      <div className="card p-4">
        <p className="mb-2 text-xs text-white/45">Mã của bài này — chia sẻ để người khác quét</p>
        <CodeView idHex={track.idHex} title={track.title} tools />
      </div>
      <Link to="/scan" className="btn-ghost w-full">
        Quét bài khác
      </Link>
    </section>
  );
}

function Bars({ playing }: { playing: boolean }) {
  const hs = [0.3, 0.6, 0.9, 0.5, 1, 0.7, 0.4, 0.8, 0.55, 0.35, 0.75, 0.5, 0.95, 0.6, 0.3];
  return (
    <div className="flex h-1/2 items-center gap-1.5">
      {hs.map((h, i) => (
        <span
          key={i}
          className="w-2 rounded-full bg-white/80"
          style={{
            height: `${h * 100}%`,
            animation: playing ? `pulse-bar ${0.6 + (i % 5) * 0.12}s ease-in-out ${i * 0.05}s infinite alternate` : undefined,
            opacity: playing ? 1 : 0.35,
          }}
        />
      ))}
      <style>{`@keyframes pulse-bar{from{transform:scaleY(.35)}to{transform:scaleY(1)}}`}</style>
    </div>
  );
}

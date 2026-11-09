// Trang trình chiếu: mã thật to cho màn chiếu. Bấm vào màn hình để bật/tắt toàn màn hình.
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { codeUrl, getConfig, getTrack, type Track } from '../lib/api';

export default function Show() {
  const { idHex = '' } = useParams();
  const [track, setTrack] = useState<Track | null>(null);
  const [base, setBase] = useState('');
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    getTrack(idHex).then(setTrack, (e) => setErr(e.message));
    getConfig().then((c) => setBase(c.publicBaseUrl), () => setBase(location.origin));
  }, [idHex]);

  const toggleFs = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else document.documentElement.requestFullscreen?.().catch(() => {});
  };

  if (err) return <p className="py-20 text-center text-white/60">{err}</p>;
  const host = base.replace(/^https?:\/\//, '');

  return (
    <div onClick={toggleFs} className="fixed inset-0 z-30 flex cursor-pointer flex-col items-center justify-center gap-[4vh] bg-white p-[4vw] text-neutral-900">
      {track && (
        <div className="text-center">
          <h1 className="text-[clamp(1.5rem,4.5vw,4rem)] font-bold leading-tight">{track.title}</h1>
          {track.artist && <p className="text-[clamp(1rem,2.2vw,2rem)] text-neutral-500">{track.artist}</p>}
        </div>
      )}
      <img src={codeUrl(idHex, { qr: 'scanner', variant: 'combo' })} alt="Mã sóng âm" className="max-h-[55vh] w-[min(92vw,160vh)] object-contain" />
      <div className="text-center text-[clamp(1rem,2.2vw,2.2rem)] leading-snug">
        <p>
          <b>1.</b> Mở camera, quét <b>QR tròn</b> &nbsp;·&nbsp; hoặc vào <b className="whitespace-nowrap">{host}/scan</b>
        </p>
        <p>
          <b>2.</b> Đưa camera vào <b>hình sóng âm</b> để nghe nhạc
        </p>
      </div>
    </div>
  );
}

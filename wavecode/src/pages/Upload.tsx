import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { getConfig, setAdminKey, uploadTrack, type QrMode, type Track } from '../lib/api';
import { contrastRatio, MIN_CONTRAST } from '../../shared/wavecode/encode';
import CodeView from '../components/CodeView';

const ACCEPT = '.mp3,.wav,.m4a,.ogg,audio/mpeg,audio/wav,audio/mp4,audio/ogg';
const EXT_OK = /\.(mp3|wav|m4a|ogg)$/i;

const PRESETS = [
  { fg: '#111111', bg: '#ffffff', name: 'Đen/trắng' },
  { fg: '#ffffff', bg: '#0b0b12', name: 'Đêm' },
  { fg: '#4c1d95', bg: '#f5f3ff', name: 'Tím' },
  { fg: '#134e4a', bg: '#ecfeff', name: 'Ngọc' },
];

export default function Upload() {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [qr, setQr] = useState<QrMode>('scanner');
  const [fg, setFg] = useState('#111111');
  const [bg, setBg] = useState('#ffffff');
  const [drag, setDrag] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [track, setTrack] = useState<Track | null>(null);
  const [cfg, setCfg] = useState<{ publicBaseUrl: string; maxUploadMb: number } | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getConfig().then(setCfg).catch(() => {});
  }, []);

  const contrast = contrastRatio(fg, bg);
  const contrastOk = contrast >= MIN_CONTRAST;

  const pick = (f: File | undefined | null) => {
    setError(null);
    if (!f) return;
    if (!EXT_OK.test(f.name)) return setError('Chỉ nhận file .mp3, .wav, .m4a, .ogg');
    const max = cfg?.maxUploadMb ?? 20;
    if (f.size > max * 1024 * 1024) return setError(`File vượt quá ${max} MB`);
    setFile(f);
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, '').slice(0, 100));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return setError('Chọn một file âm thanh trước đã');
    setError(null);
    setProgress(0);
    try {
      const t = await uploadTrack(file, { title: title.trim(), artist: artist.trim() }, setProgress);
      setTrack(t);
    } catch (err: any) {
      if (err?.status === 401) {
        setAdminKey(null);
        location.reload();
      }
      setError(err?.message ?? 'Upload thất bại');
    } finally {
      setProgress(null);
    }
  };

  const reset = () => {
    setTrack(null);
    setFile(null);
    setTitle('');
    setArtist('');
  };

  if (track) {
    return (
      <section className="space-y-4">
        <div>
          <p className="text-sm text-white/50">Đã tạo mã cho</p>
          <h1 className="text-2xl font-semibold">{track.title}</h1>
          {track.artist && <p className="text-white/60">{track.artist}</p>}
        </div>
        <div className="card p-4">
          <CodeView idHex={track.idHex} title={track.title} qr={qr} fg={contrastOk ? fg : undefined} bg={contrastOk ? bg : undefined} tools />
        </div>
        <div className="card space-y-2 p-4 text-sm">
          <Row k="ID" v={<code className="text-accent2">{track.idHex}</code>} />
          <Row
            k="Trang phát"
            v={
              <Link to={`/p/${track.idHex}`} className="break-all text-accent underline-offset-2 hover:underline">
                {track.playUrl}
              </Link>
            }
          />
          {qr !== 'none' && (
            <Row k="QR mở" v={<span className="break-all text-white/70">{qr === 'scanner' ? `${cfg?.publicBaseUrl}/scan?src=qr` : `${track.playUrl}?src=qr`}</span>} />
          )}
        </div>
        <div className="flex gap-2">
          <Link to={`/show/${track.idHex}`} className="btn-primary flex-1">
            Trình chiếu
          </Link>
          <Link to={`/p/${track.idHex}`} className="btn-ghost flex-1">
            Trang phát
          </Link>
          <button className="btn-ghost flex-1" onClick={reset}>
            Tạo mã khác
          </button>
        </div>
      </section>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Biến bài nhạc thành <span className="grad-text">sóng âm quét được</span>
        </h1>
        <p className="mt-1 text-sm text-white/55">Upload file, nhận hình sóng âm. Ai quét hình bằng /scan sẽ nghe được bài.</p>
      </div>

      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          pick(e.dataTransfer.files?.[0]);
        }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-10 text-center transition ${
          drag ? 'border-accent bg-accent/10' : 'border-line bg-panel hover:border-white/25'
        }`}
      >
        <input ref={input} type="file" accept={ACCEPT} className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
        <svg viewBox="0 0 24 24" className="h-9 w-9 text-accent" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round">
          <path d="M3 12h2M7 8v8M11 5v14M15 9v6M19 11v2M21 12h0" />
        </svg>
        {file ? (
          <>
            <span className="font-medium">{file.name}</span>
            <span className="text-xs text-white/45">{(file.size / 1024 / 1024).toFixed(2)} MB · bấm để đổi file</span>
          </>
        ) : (
          <>
            <span className="font-medium">Kéo thả file nhạc vào đây</span>
            <span className="text-xs text-white/45">hoặc bấm để chọn · mp3, wav, m4a, ogg · tối đa {cfg?.maxUploadMb ?? 20} MB</span>
          </>
        )}
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1">
          <span className="text-xs text-white/55">Tiêu đề</span>
          <input className="field" value={title} maxLength={100} onChange={(e) => setTitle(e.target.value)} placeholder="Mặc định lấy tên file" />
        </label>
        <label className="space-y-1">
          <span className="text-xs text-white/55">Nghệ sĩ</span>
          <input className="field" value={artist} maxLength={100} onChange={(e) => setArtist(e.target.value)} placeholder="Không bắt buộc" />
        </label>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-xs text-white/55">QR nhỏ kèm theo (để camera gốc của điện thoại mở web)</legend>
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              ['scanner', 'Mở /scan', 'Mặc định'],
              ['direct', 'Mở thẳng bài', 'Bỏ qua sóng'],
              ['none', 'Không QR', 'Chỉ sóng'],
            ] as const
          ).map(([v, label, hint]) => (
            <button
              key={v}
              type="button"
              onClick={() => setQr(v)}
              className={`rounded-xl border px-2 py-2.5 text-left text-sm transition ${qr === v ? 'border-accent bg-accent/10' : 'border-line bg-panel'}`}
            >
              <div className="font-medium">{label}</div>
              <div className="text-xs text-white/45">{hint}</div>
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-xs text-white/55">Màu mã</legend>
        <div className="flex flex-wrap items-center gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.name}
              type="button"
              title={p.name}
              onClick={() => {
                setFg(p.fg);
                setBg(p.bg);
              }}
              className={`flex h-9 items-center gap-1 rounded-xl border px-2 ${fg === p.fg && bg === p.bg ? 'border-accent' : 'border-line'}`}
              style={{ background: p.bg }}
            >
              {[0.5, 1, 0.7].map((h, i) => (
                <span key={i} className="w-1.5 rounded-full" style={{ height: `${h * 20}px`, background: p.fg }} />
              ))}
            </button>
          ))}
          <label className="flex items-center gap-1.5 text-xs text-white/55">
            Thanh <input type="color" value={fg} onChange={(e) => setFg(e.target.value)} className="h-8 w-9 cursor-pointer rounded bg-transparent" />
          </label>
          <label className="flex items-center gap-1.5 text-xs text-white/55">
            Nền <input type="color" value={bg} onChange={(e) => setBg(e.target.value)} className="h-8 w-9 cursor-pointer rounded bg-transparent" />
          </label>
          <span className={`text-xs ${contrastOk ? 'text-emerald-400' : 'text-amber-400'}`}>
            Tương phản {contrast.toFixed(1)}:1 {contrastOk ? '✓' : `< ${MIN_CONTRAST} → sẽ dùng đen/trắng`}
          </span>
        </div>
      </fieldset>

      {error && <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}

      <button type="submit" className="btn-primary w-full py-3 text-base" disabled={!file || progress !== null}>
        {progress !== null ? `Đang upload… ${Math.round(progress * 100)}%` : 'Tạo mã sóng âm'}
      </button>
    </form>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="w-24 shrink-0 text-white/45">{k}</span>
      <span className="min-w-0">{v}</span>
    </div>
  );
}

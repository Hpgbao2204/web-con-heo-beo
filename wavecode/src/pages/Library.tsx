import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listTracks, setAdminKey, type Track } from '../lib/api';
import CodeView from '../components/CodeView';

export default function Library() {
  const [tracks, setTracks] = useState<Track[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listTracks()
      .then(setTracks)
      .catch((e) => {
        if (e?.status === 401) {
          setAdminKey(null);
          location.reload();
        }
        setError(e.message);
      });
  }, []);

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between">
        <h1 className="text-2xl font-semibold">Thư viện</h1>
        {tracks && <span className="text-sm text-white/45">{tracks.length} bài</span>}
      </div>
      {error && <p className="text-red-400">{error}</p>}
      {!tracks && !error && <p className="text-white/40">Đang tải…</p>}
      {tracks?.length === 0 && (
        <div className="card p-8 text-center text-white/55">
          Chưa có bài nào.{' '}
          <Link to="/" className="text-accent hover:underline">
            Tạo mã đầu tiên
          </Link>
        </div>
      )}
      <ul className="grid gap-3 sm:grid-cols-2">
        {tracks?.map((t) => (
          <li key={t.idHex} className="card overflow-hidden">
            <CodeView idHex={t.idHex} title={t.title} qr="none" className="p-2" />
            <div className="flex items-center gap-3 border-t border-line p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{t.title}</p>
                <p className="truncate text-xs text-white/45">
                  {t.artist || '—'} · <code>{t.idHex}</code> · {new Date(t.createdAt).toLocaleDateString('vi-VN')}
                </p>
              </div>
              <Link to={`/show/${t.idHex}`} className="btn-ghost shrink-0 px-3 py-2">
                Trình chiếu
              </Link>
              <Link to={`/p/${t.idHex}`} className="btn-ghost shrink-0 px-3 py-2">
                Nghe
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

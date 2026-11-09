import { useState } from 'react';
import { checkAdminKey, getAdminKey, setAdminKey } from '../lib/api';

/** Chặn trang quản trị (Tạo mã, Thư viện) bằng mật khẩu ADMIN_KEY */
export default function AdminGate({ children }: { children: React.ReactNode }) {
  const [ok, setOk] = useState(() => !!getAdminKey());
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (ok) return <>{children}</>;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      if (await checkAdminKey(key.trim())) {
        setAdminKey(key.trim());
        setOk(true);
      } else setErr('Sai mật khẩu');
    } catch (e: any) {
      setErr(e?.message ?? 'Lỗi kết nối');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="mx-auto mt-16 max-w-sm space-y-3">
      <h1 className="text-xl font-semibold">Khu vực ban tổ chức</h1>
      <p className="text-sm text-white/55">Nhập mật khẩu để tạo mã. Người tham dự chỉ cần vào trang Quét.</p>
      <input
        className="field"
        type="password"
        autoComplete="current-password"
        placeholder="Mật khẩu"
        value={key}
        onChange={(e) => setKey(e.target.value)}
      />
      {err && <p className="text-sm text-red-400">{err}</p>}
      <button className="btn-primary w-full" disabled={!key || busy}>
        {busy ? 'Đang kiểm tra…' : 'Vào'}
      </button>
      <a href="/scan" className="block text-center text-sm text-white/50 hover:text-white">
        Tôi muốn quét mã →
      </a>
    </form>
  );
}

/** nếu API trả 401 (đổi mật khẩu) → xoá khoá đã lưu */
export function forgetAdmin() {
  setAdminKey(null);
}

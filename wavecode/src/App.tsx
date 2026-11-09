import { useEffect } from 'react';
import { NavLink, Route, Routes, useLocation } from 'react-router-dom';
import Upload from './pages/Upload';
import Scan from './pages/Scan';
import Player from './pages/Player';
import Library from './pages/Library';
import Show from './pages/Show';
import AdminGate from './components/AdminGate';
import { getAdminKey } from './lib/api';
import { hitVisitOnce } from './lib/track';

function Nav() {
  // khách chỉ thấy nút Quét; menu quản trị chỉ hiện trên máy đã nhập mật khẩu
  const admin = !!getAdminKey();
  const item = (to: string, label: string, icon: React.ReactNode) => (
    <NavLink
      to={to}
      end
      className={({ isActive }) =>
        `flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] transition sm:flex-none sm:flex-row sm:gap-2 sm:px-3 sm:text-sm ${
          isActive ? 'text-white' : 'text-white/45 hover:text-white/80'
        }`
      }
    >
      {icon}
      {label}
    </NavLink>
  );
  const svg = (d: string) => (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-ink/90 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:pb-0">
      <div className="mx-auto flex max-w-md sm:max-w-none sm:gap-1">
        {admin && item('/', 'Tạo mã', svg('M12 16V4m0 0-4 4m4-4 4 4M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2'))}
        {item('/scan', 'Quét', svg('M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2M7 12h.01M10 10v4M13 8v8M16 11v2'))}
        {admin && item('/library', 'Thư viện', svg('M9 18V5l12-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm12-2a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z'))}
      </div>
    </nav>
  );
}

export default function App() {
  const loc = useLocation();
  useEffect(() => hitVisitOnce(loc.pathname, loc.search), []); // eslint-disable-line react-hooks/exhaustive-deps
  if (loc.pathname.startsWith('/show/'))
    return (
      <Routes>
        <Route path="/show/:idHex" element={<Show />} />
      </Routes>
    );
  const fullBleed = loc.pathname === '/scan';
  return (
    <div className="min-h-dvh">
      {!fullBleed && (
        <header className="mx-auto flex max-w-3xl items-center justify-between px-4 pt-4 sm:pt-6">
          <NavLink to="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <img src="/favicon.svg" alt="" className="h-7 w-7" />
            <span>
              Wave<span className="grad-text">Code</span>
            </span>
          </NavLink>
          <div className="hidden sm:block">
            <Nav />
          </div>
        </header>
      )}
      <main className={fullBleed ? '' : 'mx-auto max-w-3xl px-4 pb-28 pt-4 sm:pb-12'}>
        <Routes>
          <Route path="/" element={<AdminGate><Upload /></AdminGate>} />
          <Route path="/scan" element={<Scan />} />
          <Route path="/p/:idHex" element={<Player />} />
          <Route path="/library" element={<AdminGate><Library /></AdminGate>} />
          <Route path="*" element={<p className="py-20 text-center text-white/50">Không có trang này.</p>} />
        </Routes>
      </main>
      <div className={fullBleed ? '' : 'sm:hidden'}>
        <Nav />
      </div>
    </div>
  );
}

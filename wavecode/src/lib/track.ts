// Gửi bộ đếm (truy cập / quét / phát) lên /api/hit. Không bao giờ làm hỏng trang nếu lỗi.

type Hit =
  | { type: 'visit'; page: string; src?: string }
  | { type: 'scan'; id: string; method: 'camera' | 'photo' }
  | { type: 'play'; id: string };

function visitorId(): string {
  try {
    let v = localStorage.getItem('wc-vid');
    if (!v) {
      v = Array.from(crypto.getRandomValues(new Uint8Array(10)), (b) => (b % 36).toString(36)).join('');
      localStorage.setItem('wc-vid', v);
    }
    return v;
  } catch {
    return '';
  }
}

export function hit(h: Hit) {
  try {
    const body = JSON.stringify({ ...h, vid: visitorId() });
    const blob = new Blob([body], { type: 'application/json' });
    if (!navigator.sendBeacon?.('/api/hit', blob)) {
      fetch('/api/hit', { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'application/json' } }).catch(() => {});
    }
  } catch {}
}

/** Đếm 1 lượt truy cập cho mỗi lần mở trang (tải lại trang = lượt mới) */
let visited = false;
export function hitVisitOnce(pathname: string, search: string) {
  if (visited) return;
  visited = true;
  const page = pathname === '/' ? 'home' : pathname.startsWith('/p/') ? 'player' : pathname.slice(1).split('/')[0];
  const src = new URLSearchParams(search).get('src') ?? undefined;
  hit({ type: 'visit', page, src });
}

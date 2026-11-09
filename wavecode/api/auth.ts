// Kiểm tra khoá admin (trang Tạo mã / Thư viện)
import { json, error, isAdmin } from './_lib/http.js';

export function POST(req: Request) {
  if (!process.env.ADMIN_KEY) return error(503, 'Server chưa đặt ADMIN_KEY');
  return isAdmin(req) ? json({ ok: true }) : error(401, 'Sai mật khẩu');
}

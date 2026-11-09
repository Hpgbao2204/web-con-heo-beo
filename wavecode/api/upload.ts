// Cấp token để trình duyệt upload file nhạc thẳng lên Vercel Blob (vượt giới hạn 4.5 MB body của Functions).
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { error, isAdmin, json, MAX_UPLOAD_MB } from './_lib/http.js';

const PATH_RE = /^audio\/[0-9a-f]{8}\.(mp3|wav|m4a|ogg)$/;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as HandleUploadBody | null;
  if (!body) return error(400, 'Body không hợp lệ');
  // chỉ admin được xin token; sự kiện upload-completed do Vercel Blob gửi (đã ký) thì cho qua
  if (body.type === 'blob.generate-client-token' && !isAdmin(req)) return error(401, 'Sai mật khẩu');
  try {
    const out = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname) => {
        if (!PATH_RE.test(pathname)) throw new Error('Tên file không hợp lệ');
        return {
          allowedContentTypes: ['audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/ogg'],
          maximumSizeInBytes: MAX_UPLOAD_MB * 1024 * 1024,
          addRandomSuffix: false,
          allowOverwrite: false,
          cacheControlMaxAge: 31536000,
        };
      },
    });
    return json(out);
  } catch (e: any) {
    return error(400, e?.message ?? 'Upload lỗi');
  }
}

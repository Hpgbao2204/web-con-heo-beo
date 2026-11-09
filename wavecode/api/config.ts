import { json, publicBaseUrl, MAX_UPLOAD_MB } from './_lib/http.js';

export function GET(req: Request) {
  return json({ publicBaseUrl: publicBaseUrl(req), maxUploadMb: MAX_UPLOAD_MB });
}

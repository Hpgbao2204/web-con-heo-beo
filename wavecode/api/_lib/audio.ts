// Kiểm tra file âm thanh: extension + magic bytes.

export type AudioExt = 'mp3' | 'wav' | 'm4a' | 'ogg';
export const ALLOWED_EXT: AudioExt[] = ['mp3', 'wav', 'm4a', 'ogg'];

/** Content-Type chuẩn khi lưu/phục vụ file */
export const CONTENT_TYPE: Record<AudioExt, string> = {
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  m4a: 'audio/mp4',
  ogg: 'audio/ogg',
};

export const isAudioExt = (x: unknown): x is AudioExt => typeof x === 'string' && (ALLOWED_EXT as string[]).includes(x);

function ascii(b: Uint8Array, start: number, len: number) {
  return String.fromCharCode(...b.subarray(start, start + len));
}

/** định dạng thật theo magic bytes */
export function sniff(b: Uint8Array): AudioExt | null {
  if (b.length < 12) return null;
  if (ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 4) === 'WAVE') return 'wav';
  if (ascii(b, 0, 4) === 'OggS') return 'ogg';
  if (ascii(b, 4, 4) === 'ftyp') return 'm4a';
  if (ascii(b, 0, 3) === 'ID3') return 'mp3';
  if (b[0] === 0xff && (b[1] & 0xe0) === 0xe0 && (b[1] & 0x06) !== 0) return 'mp3';
  return null;
}

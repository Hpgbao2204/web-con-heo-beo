import { useState } from 'react';
import { codeUrl, type QrMode, type Variant } from '../lib/api';
import { downloadPng, downloadSvg } from '../lib/download';

interface Props {
  idHex: string;
  title?: string;
  qr?: QrMode;
  fg?: string;
  bg?: string;
  /** hiện các nút chọn biến thể + tải về */
  tools?: boolean;
  className?: string;
}

const VARIANTS: { v: Variant; label: string }[] = [
  { v: 'combo', label: 'Sóng + QR' },
  { v: 'wave', label: 'Chỉ sóng' },
  { v: 'qr', label: 'Chỉ QR' },
];

function safeName(s: string) {
  return (s || 'wavecode').replace(/[^\p{L}\p{N}_-]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'wavecode';
}

export default function CodeView({ idHex, title, qr = 'scanner', fg, bg, tools = false, className = '' }: Props) {
  const [variant, setVariant] = useState<Variant>(qr === 'none' ? 'wave' : 'combo');
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const effective: Variant = qr === 'none' ? 'wave' : variant;
  const src = codeUrl(idHex, { qr: qr === 'none' ? undefined : qr, variant: effective, fg, bg });
  const name = `${safeName(title ?? '')}-${idHex}-${effective}`;

  const run = (kind: string, fn: () => Promise<void>) => async () => {
    setBusy(kind);
    setErr(null);
    try {
      await fn();
    } catch (e: any) {
      setErr(e?.message ?? 'Lỗi tải về');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className={className}>
      <div className="overflow-hidden rounded-xl bg-white/5 p-2">
        <img src={src} alt={`Mã sóng âm ${title ?? idHex}`} className="mx-auto block h-auto max-h-64 w-full object-contain" />
      </div>
      {tools && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {qr !== 'none' && (
            <div className="flex rounded-xl border border-line p-0.5 text-xs">
              {VARIANTS.map(({ v, label }) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setVariant(v)}
                  className={`rounded-lg px-2.5 py-1.5 transition ${variant === v ? 'bg-white/10 text-white' : 'text-white/50'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          <div className="ml-auto flex gap-2">
            <button type="button" className="btn-ghost" disabled={!!busy} onClick={run('svg', () => downloadSvg(src, `${name}.svg`))}>
              {busy === 'svg' ? 'Đang tải…' : 'Tải SVG'}
            </button>
            <button type="button" className="btn-ghost" disabled={!!busy} onClick={run('png', () => downloadPng(src, `${name}.png`))}>
              {busy === 'png' ? 'Đang tải…' : 'Tải PNG'}
            </button>
          </div>
        </div>
      )}
      {err && <p className="mt-2 text-sm text-red-400">{err}</p>}
    </div>
  );
}

function save(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export async function downloadSvg(src: string, filename: string) {
  const text = await fetch(src).then((r) => r.text());
  save(new Blob([text], { type: 'image/svg+xml' }), filename);
}

/** Render SVG lên canvas (scale lần) → PNG */
export async function svgToPngBlob(src: string, scale = 3): Promise<Blob> {
  const text = await fetch(src).then((r) => r.text());
  const m = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(text);
  const w = m ? parseFloat(m[1]) : 600;
  const h = m ? parseFloat(m[2]) : 200;
  const url = URL.createObjectURL(new Blob([text], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    img.decoding = 'async';
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error('Không render được SVG'));
      img.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((res, rej) =>
      canvas.toBlob((b) => (b ? res(b) : rej(new Error('toBlob thất bại'))), 'image/png'),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function downloadPng(src: string, filename: string, scale = 3) {
  save(await svgToPngBlob(src, scale), filename);
}

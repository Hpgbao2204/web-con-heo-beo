(() => {
  'use strict';

  // Vị trí các thành phần, tính theo pixel của file thiết kế (rộng 1080).
  // Đo từ "Mẫu web" so với "Hình nền web" trong NFC/WEB NHẠC.
  const LAYOUTS = {
    1920: {
      clouds: [
        { src: 'cloud-1', from: 'l', x: -105, y: 274, h: 156, ratio: 2.4205 },
        { src: 'cloud-2', from: 'r', x: 838, y: 28, h: 96, ratio: 3.1696 },
      ],
      notes: [
        { src: 'note-1', from: 'l', x: 38, y: 744, w: 28, h: 44 },
        { src: 'note-2', from: 'l', x: 114, y: 761, w: 24, h: 51 },
        { src: 'note-4', from: 'l', x: 184, y: 674, w: 25, h: 64 },
        { src: 'note-3', from: 'l', cx: 282, cy: 696.5, w: 15.5, h: 29, rot: 10 },
        { src: 'note-4', from: 'r', x: 848, y: 649, w: 25, h: 63 },
        { src: 'note-5', from: 'r', x: 900, y: 738, w: 49, h: 44 },
        { src: 'note-1', from: 'r', cx: 1018.5, cy: 714, w: 23.4, h: 38, rot: 15 },
      ],
      play: { cx: 540, cy: 1220, d: 70 },
      back: { cx: 464, cy: 1220 },
      fwd: { cx: 615.5, cy: 1220 },
      wave: { x0: 316, x1: 764, cy: 1315, h: 82, barW: 9 },
    },
    2400: {
      clouds: [
        { src: 'cloud-1', from: 'l', x: -87, y: 267, h: 175, ratio: 2.4205 },
        { src: 'cloud-2', from: 'r', x: 782, y: 23, h: 109, ratio: 3.1696 },
      ],
      notes: [
        { src: 'note-1', from: 'l', x: 38, y: 744, w: 28, h: 44 },
        { src: 'note-2', from: 'l', x: 114, y: 760, w: 24, h: 52 },
        { src: 'note-4', from: 'l', x: 184, y: 674, w: 25, h: 64 },
        { src: 'note-3', from: 'l', cx: 282, cy: 733.5, w: 15.5, h: 29, rot: 10 },
        { src: 'note-4', from: 'r', x: 832, y: 691, w: 26, h: 63 },
        { src: 'note-5', from: 'r', x: 900, y: 738, w: 49, h: 44 },
        { src: 'note-1', from: 'r', cx: 1018.5, cy: 714, w: 23.4, h: 38, rot: 15 },
      ],
      play: { cx: 540, cy: 1351.5, d: 80 },
      back: { cx: 454.5, cy: 1351.5 },
      fwd: { cx: 625.5, cy: 1351.5 },
      wave: { x0: 287, x1: 793, cy: 1458, h: 93, barW: 10 },
    },
  };

  // Hình dáng sóng âm lúc đứng yên (giống bản thiết kế), tỉ lệ so với chiều cao tối đa.
  const IDLE = [0.3, 0.42, 0.3, 0.78, 0.32, 0.66, 0.5, 0.46, 1, 0.52, 0.3, 0.82, 0.36, 0.3,
    0.46, 0.46, 0.86, 0.56, 0.8, 0.96, 0.6, 0.34];
  const N_BARS = IDLE.length;
  // Dải tần nào điều khiển cột nào (xáo trộn để sóng trông tự nhiên, không dốc một phía).
  const BAND_OF_BAR = [6, 12, 3, 9, 15, 1, 7, 18, 10, 4, 13, 0, 8, 16, 5, 11, 2, 14, 19, 21, 17, 20];

  const $ = (id) => document.getElementById(id);
  const stage = $('stage');
  const audio = $('audio');
  const playBtn = $('playBtn');
  const waveEl = $('wave');

  // ---------- Chọn bài theo đường dẫn /nhac/<slug> ----------
  const songs = window.SONGS || {};
  const parts = location.pathname.replace(/\/+$/, '').split('/').filter(Boolean);
  let slug = decodeURIComponent(parts[parts.length - 1] || '');
  if (slug === 'nhac' || slug === 'index.html') slug = '';
  const params = new URLSearchParams(location.search);
  if (params.get('bai')) slug = params.get('bai');
  if (!slug && Object.keys(songs).length === 1) slug = Object.keys(songs)[0];
  const song = songs[slug];

  if (!song) {
    $('viewport').hidden = true;
    $('missing').hidden = false;
    const list = $('songList');
    for (const [key, s] of Object.entries(songs)) {
      const li = document.createElement('li');
      li.innerHTML = `<a href="/nhac/${key}"></a>`;
      li.firstChild.textContent = s.title;
      list.appendChild(li);
    }
    return;
  }

  document.title = `${song.title} · Hò Tỏ Lời`;

  // ---------- Chọn khổ nền & co giãn sân khấu ----------
  let variant = null;
  let L = null;

  function chooseVariant(vw, vh) {
    const r = vh / vw;
    const opts = Object.keys(LAYOUTS).filter((k) => song.bg[k]).map(Number);
    opts.sort((a, b) => Math.abs(Math.log(a / 1080 / r)) - Math.abs(Math.log(b / 1080 / r)));
    return opts[0];
  }

  function fit() {
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    if (!vw || !vh) return void setTimeout(fit, 150); // trang chưa có kích thước (tab nền)
    const v = chooseVariant(vw, vh);
    if (v !== variant) build(v);
    const W = 1080;
    const H = v;
    // "cover" nếu chỉ phải cắt rất ít, ngược lại "contain" (laptop / màn hình lạ)
    let s = Math.max(vw / W, vh / H);
    const cropX = 1 - vw / (W * s);
    const cropY = 1 - vh / (H * s);
    if (cropX > 0.06 || cropY > 0.12) s = Math.min(vw / W, vh / H);
    const left = (vw - W * s) / 2;
    const extraY = vh - H * s;
    const top = extraY >= 0 ? extraY / 2 : extraY * 0.35; // cắt đáy nhiều hơn đỉnh
    stage.style.transform = `translate(${left}px, ${top}px) scale(${s})`;
  }

  // ---------- Dựng các thành phần ----------
  let bars = [];

  function px(el, x, y, w, h) {
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.width = `${w}px`;
    el.style.height = `${h}px`;
  }

  function build(v) {
    variant = v;
    L = LAYOUTS[v];
    stage.style.height = `${v}px`;
    $('backdrop').style.backgroundImage = `url("${song.bgBlur?.[v] || song.bg[v]}")`;

    const bg = $('bg');
    stage.classList.remove('ready');
    bg.onload = () => setTimeout(() => stage.classList.add('ready'), 30);
    bg.src = song.bg[v];
    if (bg.complete && bg.naturalWidth) bg.onload();

    const decor = $('decor');
    decor.textContent = '';
    for (const c of L.clouds) {
      const el = document.createElement('div');
      el.className = `cloud cloud-${c.from}`;
      px(el, c.x, c.y, c.h * c.ratio, c.h);
      el.innerHTML = `<div class="fly"><div class="drift"><img src="/nhac/assets/${c.src}.svg" alt="" draggable="false"></div></div>`;
      decor.appendChild(el);
    }
    L.notes.forEach((n, i) => {
      const el = document.createElement('div');
      el.className = `note from-${n.from}`;
      const x = n.cx != null ? n.cx - n.w / 2 : n.x;
      const y = n.cy != null ? n.cy - n.h / 2 : n.y;
      px(el, x, y, n.w, n.h);
      if (n.rot) el.style.transform = `rotate(${n.rot}deg)`;
      el.style.setProperty('--delay', `${0.5 + i * 0.13}s`);
      el.style.setProperty('--sway', `${1.5 + ((i * 7) % 5) * 0.18}s`);
      el.innerHTML = `<div class="fly"><div class="sway"><img src="/nhac/assets/${n.src}.svg" alt="" draggable="false"></div></div>`;
      decor.appendChild(el);
    });

    // Nút: vùng chạm lớn hơn hình để dễ bấm trên điện thoại
    const P = L.play;
    const hit = P.d * 2;
    px(playBtn, P.cx - hit / 2, P.cy - hit / 2, hit, hit);
    playBtn.style.setProperty('--d', `${P.d}px`);
    for (const [btn, b] of [[$('backBtn'), L.back], [$('fwdBtn'), L.fwd]]) {
      px(btn, b.cx - 50, b.cy - 50, 100, 100);
    }

    // Sóng âm
    const Wv = L.wave;
    const padY = 30;
    px(waveEl, Wv.x0 - 12, Wv.cy - Wv.h / 2 - padY, Wv.x1 - Wv.x0 + 24, Wv.h + padY * 2);
    waveEl.textContent = '';
    const step = (Wv.x1 - Wv.x0 - Wv.barW) / (N_BARS - 1);
    bars = [];
    for (let i = 0; i < N_BARS; i++) {
      const s = document.createElement('span');
      s.style.left = `${12 + i * step}px`;
      s.style.width = `${Wv.barW}px`;
      waveEl.appendChild(s);
      bars.push({ el: s, h: IDLE[i], shown: -1 });
    }
    drawBars(true);
  }

  // ---------- Phân tích âm thanh (không đi qua Web Audio khi phát, để iPhone
  // ở chế độ im lặng vẫn nghe được và tắt màn hình vẫn phát tiếp) ----------
  const FPS = 40;
  let env = null; // Float32Array [frame * N_BARS + band], 0..1

  function fft(re, im) {
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) {
      let bit = n >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) {
        [re[i], re[j]] = [re[j], re[i]];
        [im[i], im[j]] = [im[j], im[i]];
      }
    }
    for (let len = 2; len <= n; len <<= 1) {
      const ang = (-2 * Math.PI) / len;
      const wr = Math.cos(ang);
      const wi = Math.sin(ang);
      for (let i = 0; i < n; i += len) {
        let cr = 1;
        let ci = 0;
        for (let k = 0; k < len / 2; k++) {
          const a = i + k;
          const b = a + len / 2;
          const tr = re[b] * cr - im[b] * ci;
          const ti = re[b] * ci + im[b] * cr;
          re[b] = re[a] - tr;
          im[b] = im[a] - ti;
          re[a] += tr;
          im[a] += ti;
          const ncr = cr * wr - ci * wi;
          ci = cr * wi + ci * wr;
          cr = ncr;
        }
      }
    }
  }

  async function analyse() {
    const res = await fetch(song.audio);
    const buf = await res.arrayBuffer();
    const AC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    const ac = new AC(1, 44100, 44100);
    const decoded = await new Promise((ok, fail) => {
      const p = ac.decodeAudioData(buf, ok, fail);
      if (p && p.then) p.then(ok, fail);
    });
    const sr = decoded.sampleRate;
    const ch0 = decoded.getChannelData(0);
    const ch1 = decoded.numberOfChannels > 1 ? decoded.getChannelData(1) : null;
    const N = 1024;
    const hop = sr / FPS;
    const frames = Math.floor(ch0.length / hop);
    const B = N_BARS;
    // các dải tần chia theo thang log từ 90Hz đến 7kHz (vùng giọng hát)
    const edges = [];
    for (let b = 0; b <= B; b++) edges.push(Math.round((90 * Math.pow(7000 / 90, b / B) * N) / sr));
    const win = new Float32Array(N).map((_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1)));
    const out = new Float32Array(frames * B);
    const re = new Float32Array(N);
    const im = new Float32Array(N);
    for (let f = 0; f < frames; f++) {
      const start = Math.floor(f * hop);
      for (let i = 0; i < N; i++) {
        const k = start + i;
        const s = k < ch0.length ? (ch1 ? (ch0[k] + ch1[k]) / 2 : ch0[k]) : 0;
        re[i] = s * win[i];
        im[i] = 0;
      }
      fft(re, im);
      for (let b = 0; b < B; b++) {
        const lo = edges[b];
        const hi = Math.max(edges[b + 1], lo + 1);
        let e = 0;
        for (let k = lo; k < hi; k++) e += re[k] * re[k] + im[k] * im[k];
        out[f * B + b] = Math.log10(1 + e / (hi - lo));
      }
      if (f % 400 === 399) await new Promise((r) => setTimeout(r)); // nhường luồng chính
    }
    // chuẩn hoá từng dải theo mức cao (phân vị 97) để cột nào cũng nhảy
    for (let b = 0; b < B; b++) {
      const vals = [];
      for (let f = 0; f < frames; f++) vals.push(out[f * B + b]);
      vals.sort((a, c) => a - c);
      const hiV = vals[Math.floor(frames * 0.97)] || 1;
      const loV = vals[Math.floor(frames * 0.15)] || 0;
      for (let f = 0; f < frames; f++) {
        const v = (out[f * B + b] - loV) / (hiV - loV || 1);
        out[f * B + b] = Math.min(1, Math.max(0, v));
      }
    }
    env = out;
  }

  // ---------- Vẽ sóng ----------
  let started = false;
  let lastT = 0;

  function levelAt(i, t, now) {
    if (env) {
      const frames = env.length / N_BARS;
      const fpos = Math.min(frames - 1, t * FPS);
      const f0 = Math.floor(fpos);
      const f1 = Math.min(frames - 1, f0 + 1);
      const k = fpos - f0;
      const b = BAND_OF_BAR[i];
      return env[f0 * N_BARS + b] * (1 - k) + env[f1 * N_BARS + b] * k;
    }
    // dự phòng khi chưa phân tích xong: dao động giả
    const p = i * 1.7;
    return 0.5 + 0.25 * Math.sin(now / 180 + p) + 0.25 * Math.sin(now / 97 + p * 2.3);
  }

  function drawBars(force) {
    const now = performance.now();
    const dt = Math.min(0.1, (now - lastT) / 1000 || 0.016);
    lastT = now;
    const playing = !audio.paused && !audio.ended;
    const t = audio.currentTime || 0;
    const dur = audio.duration || 0;
    const progress = dur ? t / dur : 0;
    const maxH = L.wave.h;
    for (let i = 0; i < bars.length; i++) {
      const bar = bars[i];
      let target;
      if (playing) {
        const lv = levelAt(i, t, now);
        target = 0.16 + 0.84 * lv * (0.7 + 0.3 * IDLE[i]);
      } else {
        target = IDLE[i];
      }
      if (force) bar.h = target;
      else {
        const rate = target > bar.h ? 28 : 9; // lên nhanh, xuống chậm
        bar.h += (target - bar.h) * Math.min(1, rate * dt);
      }
      const hpx = Math.max(L.wave.barW, Math.round(bar.h * maxH * 2) / 2);
      if (hpx !== bar.shown) {
        bar.el.style.height = `${hpx}px`;
        bar.shown = hpx;
      }
      const ahead = started && (i + 0.5) / bars.length > progress;
      bar.el.classList.toggle('ahead', ahead);
    }
    waveEl.setAttribute('aria-valuenow', String(Math.round(progress * 100)));
  }

  let raf = 0;
  function loop() {
    drawBars(false);
    const settling = bars.some((b, i) => Math.abs(b.h - IDLE[i]) > 0.003);
    if (!audio.paused || settling) raf = requestAnimationFrame(loop);
    else raf = 0;
  }
  function kick() {
    if (!raf) {
      lastT = performance.now();
      raf = requestAnimationFrame(loop);
    }
  }

  // ---------- Điều khiển ----------
  audio.src = song.audio;
  let analysing = null;
  function startAnalysis() {
    if (!analysing) analysing = analyse().catch((e) => console.warn('Không phân tích được âm thanh:', e));
  }
  // phân tích sớm khi rảnh, để lúc bấm phát sóng âm khớp ngay
  (window.requestIdleCallback || ((f) => setTimeout(f, 1200)))(startAnalysis);

  function setPlayingUI() {
    const playing = !audio.paused && !audio.ended;
    stage.classList.toggle('playing', playing);
    playBtn.setAttribute('aria-label', playing ? 'Tạm dừng' : 'Phát');
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = playing ? 'playing' : 'paused';
  }

  function toggle() {
    if (audio.paused || audio.ended) {
      started = true;
      stage.classList.add('started');
      startAnalysis();
      const p = audio.play();
      if (p && p.catch) p.catch((e) => console.warn(e));
    } else {
      audio.pause();
    }
  }
  function skip(sec) {
    if (!audio.duration) return;
    audio.currentTime = Math.min(audio.duration - 0.05, Math.max(0, audio.currentTime + sec));
    started = true;
    stage.classList.add('started');
    kick();
  }

  playBtn.addEventListener('click', toggle);
  $('backBtn').addEventListener('click', () => skip(-10));
  $('fwdBtn').addEventListener('click', () => skip(10));
  for (const ev of ['play', 'playing', 'pause', 'ended']) {
    audio.addEventListener(ev, () => {
      setPlayingUI();
      kick();
    });
  }
  audio.addEventListener('timeupdate', () => audio.paused && kick());
  audio.addEventListener('ended', () => {
    audio.currentTime = 0;
  });

  // chạm / kéo trên sóng âm để tua
  let dragging = false;
  function seekFrom(e) {
    if (!audio.duration) return;
    const r = waveEl.getBoundingClientRect();
    const pad = (12 / waveEl.offsetWidth) * r.width;
    const ratio = Math.min(1, Math.max(0, (e.clientX - r.left - pad) / (r.width - pad * 2)));
    audio.currentTime = ratio * audio.duration;
    started = true;
    stage.classList.add('started');
    drawBars(false);
  }
  waveEl.addEventListener('pointerdown', (e) => {
    dragging = true;
    waveEl.setPointerCapture(e.pointerId);
    seekFrom(e);
  });
  waveEl.addEventListener('pointermove', (e) => dragging && seekFrom(e));
  waveEl.addEventListener('pointerup', () => (dragging = false));
  waveEl.addEventListener('pointercancel', () => (dragging = false));
  waveEl.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') skip(-5);
    if (e.key === 'ArrowRight') skip(5);
  });
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && e.target === document.body) {
      e.preventDefault();
      toggle();
    }
  });

  if ('mediaSession' in navigator && window.MediaMetadata) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: song.title,
      artist: song.artist || '',
      album: 'Hò Tỏ Lời',
      artwork: [{ src: song.bg[1920], sizes: '1080x1920', type: 'image/webp' }],
    });
    const ms = navigator.mediaSession;
    const set = (a, f) => {
      try { ms.setActionHandler(a, f); } catch { /* không hỗ trợ */ }
    };
    set('play', () => audio.paused && toggle());
    set('pause', () => !audio.paused && toggle());
    set('seekbackward', () => skip(-10));
    set('seekforward', () => skip(10));
  }

  // để kiểm tra từ console
  window.__nhac = { audio, get analysed() { return !!env; }, draw: () => drawBars(false), get variant() { return variant; } };

  window.addEventListener('resize', fit);
  window.addEventListener('orientationchange', () => setTimeout(fit, 200));
  fit();
})();

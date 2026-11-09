// Sinh vài file WAV ngắn (giai điệu sine) vào samples/ để test upload.
import fs from 'node:fs';
import path from 'node:path';

const RATE = 22050;
function wav(notes: [number, number][], file: string) {
  const samples: number[] = [];
  for (const [freq, dur] of notes) {
    const n = Math.round(dur * RATE);
    for (let i = 0; i < n; i++) {
      const env = Math.min(1, i / 400, (n - i) / 800);
      const t = i / RATE;
      const s = freq ? 0.45 * Math.sin(2 * Math.PI * freq * t) + 0.12 * Math.sin(4 * Math.PI * freq * t) : 0;
      samples.push(s * env);
    }
  }
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((s, i) => data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, s)) * 32767), i * 2));
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(RATE, 24); h.writeUInt32LE(RATE * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(data.length, 40);
  fs.writeFileSync(path.join('samples', file), Buffer.concat([h, data]));
  console.log('samples/' + file);
}
const C4 = 261.63, D4 = 293.66, E4 = 329.63, F4 = 349.23, G4 = 392, A4 = 440, B4 = 493.88, C5 = 523.25;
wav([[C4,.4],[D4,.4],[E4,.4],[C4,.4],[C4,.4],[D4,.4],[E4,.4],[C4,.4],[E4,.4],[F4,.4],[G4,.8]], 'frere-jacques.wav');
wav([[C4,.3],[C4,.3],[G4,.3],[G4,.3],[A4,.3],[A4,.3],[G4,.6],[F4,.3],[F4,.3],[E4,.3],[E4,.3],[D4,.3],[D4,.3],[C4,.6]], 'twinkle.wav');
wav([[C5,.2],[B4,.2],[A4,.2],[G4,.2],[F4,.2],[E4,.2],[D4,.2],[C4,.6],[0,.2],[C4,.2],[E4,.2],[G4,.2],[C5,.6]], 'scale.wav');

// Unit tests for e01s10 (and s11 later): pure recording DSP in audio-dsp.js.
// Run: npm test
const test = require('node:test');
const assert = require('node:assert/strict');
const dsp = require('../js/audio-dsp.js');

test('encodeWav: RIFF/WAVE header fields and byte length', () => {
  const n = 480;
  const buf = dsp.encodeWav(new Float32Array(n), 48000);
  const v = new DataView(buf);
  const str = (o, len) => String.fromCharCode(...new Uint8Array(buf, o, len));
  assert.equal(buf.byteLength, 44 + 2 * n);
  assert.equal(str(0, 4), 'RIFF');
  assert.equal(v.getUint32(4, true), 36 + 2 * n);
  assert.equal(str(8, 4), 'WAVE');
  assert.equal(str(12, 4), 'fmt ');
  assert.equal(v.getUint16(20, true), 1, 'PCM');
  assert.equal(v.getUint16(22, true), 1, 'mono');
  assert.equal(v.getUint32(24, true), 48000);
  assert.equal(v.getUint32(28, true), 96000, 'byte rate');
  assert.equal(v.getUint16(34, true), 16, 'bits');
  assert.equal(str(36, 4), 'data');
  assert.equal(v.getUint32(40, true), 2 * n);
});

test('encodeWav: clamps out-of-range samples to full scale', () => {
  const v = new DataView(dsp.encodeWav(new Float32Array([1.5, -1.5, 0, 0.5]), 8000));
  assert.equal(v.getInt16(44, true), 32767);
  assert.equal(v.getInt16(46, true), -32768);
  assert.equal(v.getInt16(48, true), 0);
  assert.equal(v.getInt16(50, true), 16384);
});

test('encodeWav: 10 s at 48 kHz fits the 2 MB upload cap', () => {
  const bytes = 44 + 2 * 48000 * 10;
  assert.ok(bytes < 2 * 1024 * 1024, `${bytes} bytes`);
});

test('toMono averages channels and copies a single channel', () => {
  const m = dsp.toMono([new Float32Array([1, 0, -1]), new Float32Array([0, 0, 1])]);
  assert.deepEqual(Array.from(m), [0.5, 0, 0]);
  const src = new Float32Array([0.25, -0.25]);
  const one = dsp.toMono([src]);
  assert.deepEqual(Array.from(one), [0.25, -0.25]);
  assert.notEqual(one, src, 'returns a copy, never the input');
  assert.equal(dsp.toMono([]).length, 0);
});

test('peaks: bucket count and per-bucket min/max', () => {
  const s = new Float32Array([0.1, -0.5, 0.9, -0.2, 0, 0, 0.3, -0.7]);
  const p = dsp.peaks(s, 4);
  assert.equal(p.min.length, 4);
  assert.equal(p.max.length, 4);
  assert.deepEqual(Array.from(p.max).map((x) => +x.toFixed(2)), [0.1, 0.9, 0, 0.3]);
  assert.deepEqual(Array.from(p.min).map((x) => +x.toFixed(2)), [-0.5, -0.2, 0, -0.7]);
  assert.equal(dsp.peaks(new Float32Array(3), 10).max.length, 10, 'more buckets than samples is fine');
});

test('peakAbs and dbToGain', () => {
  assert.equal(dsp.peakAbs(new Float32Array([0.2, -0.8, 0.5])), 0.800000011920929);
  assert.ok(Math.abs(dsp.dbToGain(-6) - 0.501) < 0.001);
  assert.equal(dsp.dbToGain(0), 1);
});

// ---- e01s11: trim / clean-up tools -------------------------------------------------
const SR = 48000;
// silence (1 s) + square-wave tone (0.5 s, ±0.5) + silence (0.5 s): exact tone edges.
function silenceToneSilence() {
  const s = new Float32Array(SR * 2);
  for (let i = SR; i < SR * 1.5; i++) s[i] = (Math.floor(i / 50) % 2 ? 0.5 : -0.5);
  return { s, toneStart: SR, toneEnd: SR * 1.5 };
}

test('findSoundBounds: tone edges widened by 30 ms each side (to the sample)', () => {
  const { s, toneStart, toneEnd } = silenceToneSilence();
  const pad = Math.round(0.03 * SR);
  const b = dsp.findSoundBounds(s, SR, { thresholdDb: -40, padMs: 30 });
  assert.ok(Math.abs(b.start - (toneStart - pad)) <= 1, `start ${b.start}`);
  assert.ok(Math.abs(b.end - (toneEnd + pad)) <= 1, `end ${b.end}`);
  assert.ok((b.start - 0) / SR > 0.95, 'leading silence cut to < 50 ms');
});

test('findSoundBounds: silent clip keeps everything; bounds clamp at the ends', () => {
  assert.deepEqual(dsp.findSoundBounds(new Float32Array(1000), SR), { start: 0, end: 1000 });
  const s = new Float32Array(100).fill(0.5);
  assert.deepEqual(dsp.findSoundBounds(s, SR), { start: 0, end: 100 });
});

test('crop: length and content, input untouched, clamps bad ranges', () => {
  const s = Float32Array.from([0, 1, 2, 3, 4, 5]);
  assert.deepEqual(Array.from(dsp.crop(s, 2, 5)), [2, 3, 4]);
  assert.equal(dsp.crop(s, -5, 99).length, 6);
  assert.equal(dsp.crop(s, 4, 2).length, 0);
  assert.equal(s[2], 2);
});

test('normalize: peak lands on -1 dBFS; silence stays silent', () => {
  const quiet = Float32Array.from([0.01, -0.05, 0.02]);
  const out = dsp.normalize(quiet, -1);
  assert.ok(Math.abs(dsp.peakAbs(out) - Math.pow(10, -1 / 20)) < 1e-4);
  assert.ok(Math.abs(20 * Math.log10(dsp.peakAbs(out)) + 1) < 0.1, 'within 0.1 dB of -1 dBFS');
  assert.equal(quiet[1], Math.fround(-0.05), 'input untouched');
  assert.equal(dsp.peakAbs(dsp.normalize(new Float32Array(10))), 0);
});

test('fade in/out: endpoint is exactly 0, sample at the fade length is untouched', () => {
  const s = new Float32Array(SR).fill(0.8);
  const n = Math.round(0.06 * SR);
  const fin = dsp.fade(s, SR, 'in', 60);
  assert.equal(fin[0], 0);
  assert.ok(Math.abs(fin[n] - 0.8) < 1e-6);
  assert.ok(fin[n / 2] > 0.39 && fin[n / 2] < 0.41, 'linear half-way');
  const fout = dsp.fade(s, SR, 'out', 60);
  assert.equal(fout[fout.length - 1], 0);
  assert.ok(Math.abs(fout[fout.length - 1 - n] - 0.8) < 1e-6);
  assert.equal(s[0], Math.fround(0.8), 'input untouched');
});

test('highpass 90 Hz removes DC (desk rumble) but passes 1 kHz', () => {
  const dc = new Float32Array(SR / 2).fill(0.5);
  const out = dsp.highpass(dc, SR, 90);
  const tail = out.slice(out.length - SR / 10);
  const mean = tail.reduce((a, b) => a + b, 0) / tail.length;
  assert.ok(Math.abs(mean) < 0.01, `mean ${mean}`);
  const tone = Float32Array.from({ length: SR / 2 }, (_, i) => 0.5 * Math.sin((2 * Math.PI * 1000 * i) / SR));
  const pk = dsp.peakAbs(dsp.highpass(tone, SR, 90).slice(SR / 10));
  assert.ok(pk > 0.48 && pk < 0.52, `1 kHz peak ${pk}`);
});

test('undo/reset model: operations never mutate earlier states', () => {
  const original = Float32Array.from([0.1, 0.2, 0.3, 0.4]);
  const history = [original];
  history.push(dsp.normalize(history[history.length - 1]));
  history.push(dsp.fade(history[history.length - 1], 4, 'in', 500));
  history.push(dsp.crop(history[history.length - 1], 1, 3));
  assert.deepEqual(Array.from(history[0]), Array.from(original), 'original exact');
  history.pop();
  assert.equal(history[history.length - 1].length, 4, 'undo restores the previous state');
});

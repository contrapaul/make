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

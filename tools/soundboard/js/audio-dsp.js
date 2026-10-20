/* Soundboard DSP — pure sample maths for recordings (e01s10; s11 adds trim/clean-up).
 * No DOM, no Web Audio: plain Float32Arrays in, new arrays out (inputs are never
 * modified). Dual-mode: window.SoundBoard.dsp in the browser, module.exports in Node.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') module.exports = api;
  if (root) {
    root.SoundBoard = root.SoundBoard || {};
    root.SoundBoard.dsp = api;
  }
})(
  typeof self !== 'undefined' ? self : typeof globalThis !== 'undefined' ? globalThis : this,
  function () {
    'use strict';

    // Average any number of channels into one.
    function toMono(channels) {
      if (!channels || !channels.length) return new Float32Array(0);
      if (channels.length === 1) return new Float32Array(channels[0]);
      var n = channels[0].length, out = new Float32Array(n), k = channels.length;
      for (var i = 0; i < n; i++) {
        var s = 0;
        for (var c = 0; c < k; c++) s += channels[c][i];
        out[i] = s / k;
      }
      return out;
    }

    // Mono 16-bit PCM WAV (44-byte RIFF header). Samples are clamped to -1..1.
    function encodeWav(samples, sampleRate) {
      var n = samples.length, bytes = n * 2;
      var buf = new ArrayBuffer(44 + bytes), v = new DataView(buf);
      function str(off, s) { for (var i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i)); }
      str(0, 'RIFF'); v.setUint32(4, 36 + bytes, true); str(8, 'WAVE');
      str(12, 'fmt '); v.setUint32(16, 16, true);  // fmt chunk size
      v.setUint16(20, 1, true);                     // PCM
      v.setUint16(22, 1, true);                     // mono
      v.setUint32(24, sampleRate, true);
      v.setUint32(28, sampleRate * 2, true);        // byte rate
      v.setUint16(32, 2, true);                     // block align
      v.setUint16(34, 16, true);                    // bits per sample
      str(36, 'data'); v.setUint32(40, bytes, true);
      for (var i = 0; i < n; i++) {
        var s = Math.max(-1, Math.min(1, samples[i]));
        v.setInt16(44 + i * 2, s < 0 ? Math.round(s * 32768) : Math.round(s * 32767), true);
      }
      return buf;
    }

    // Min/max per bucket, for drawing a waveform `buckets` pixels wide.
    function peaks(samples, buckets) {
      buckets = Math.max(1, buckets | 0);
      var min = new Float32Array(buckets), max = new Float32Array(buckets);
      var per = samples.length / buckets;
      for (var b = 0; b < buckets; b++) {
        var from = Math.floor(b * per), to = Math.max(from + 1, Math.floor((b + 1) * per));
        var lo = 0, hi = 0;
        for (var i = from; i < to && i < samples.length; i++) {
          if (samples[i] < lo) lo = samples[i];
          if (samples[i] > hi) hi = samples[i];
        }
        min[b] = lo; max[b] = hi;
      }
      return { min: min, max: max };
    }

    // Largest absolute sample (0..1+).
    function peakAbs(samples) {
      var p = 0;
      for (var i = 0; i < samples.length; i++) { var a = Math.abs(samples[i]); if (a > p) p = a; }
      return p;
    }

    function dbToGain(db) { return Math.pow(10, db / 20); }

    return { toMono: toMono, encodeWav: encodeWav, peaks: peaks, peakAbs: peakAbs, dbToGain: dbToGain };
  }
);

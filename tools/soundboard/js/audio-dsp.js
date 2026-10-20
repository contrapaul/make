/* Soundboard DSP — pure sample maths for recordings (e01s10) and their trim/clean-up
 * tools (e01s11).
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

    // ---- clean-up tools (e01s11). Each returns a NEW array. ----------------------

    // Keep samples [start, end).
    function crop(samples, start, end) {
      var a = Math.max(0, Math.min(samples.length, start | 0));
      var b = Math.max(a, Math.min(samples.length, end | 0));
      return samples.slice(a, b);
    }

    // Where the sound is: first/last sample at or above thresholdDb, widened by padMs
    // each side. All-silent input -> the whole clip (nothing to trim).
    function findSoundBounds(samples, sampleRate, opts) {
      var o = opts || {};
      var t = dbToGain(o.thresholdDb == null ? -40 : o.thresholdDb);
      var pad = Math.round(((o.padMs == null ? 30 : o.padMs) * sampleRate) / 1000);
      var first = -1, last = -1;
      for (var i = 0; i < samples.length; i++) if (Math.abs(samples[i]) >= t) { first = i; break; }
      if (first < 0) return { start: 0, end: samples.length };
      for (var j = samples.length - 1; j >= first; j--) if (Math.abs(samples[j]) >= t) { last = j; break; }
      return { start: Math.max(0, first - pad), end: Math.min(samples.length, last + 1 + pad) };
    }

    // Scale so the loudest sample sits at peakDb (default -1 dBFS). Silence stays silent.
    function normalize(samples, peakDb) {
      var p = peakAbs(samples);
      var out = new Float32Array(samples);
      if (!p) return out;
      var g = dbToGain(peakDb == null ? -1 : peakDb) / p;
      for (var i = 0; i < out.length; i++) out[i] *= g;
      return out;
    }

    // Linear fade over `ms` at the start ('in': first sample 0) or end ('out': last
    // sample 0). Sample index n (n = fade length) is untouched.
    function fade(samples, sampleRate, dir, ms) {
      var out = new Float32Array(samples);
      var n = Math.min(out.length, Math.round((ms * sampleRate) / 1000));
      for (var i = 0; i < n; i++) {
        var g = i / n;
        if (dir === 'in') out[i] *= g;
        else out[out.length - 1 - i] *= g;
      }
      return out;
    }

    // 2nd-order high-pass (RBJ cookbook biquad), e.g. 90 Hz to take out desk rumble.
    function highpass(samples, sampleRate, freq, q) {
      q = q || Math.SQRT1_2;
      var w0 = (2 * Math.PI * freq) / sampleRate, cos = Math.cos(w0), alpha = Math.sin(w0) / (2 * q);
      var a0 = 1 + alpha;
      var b0 = (1 + cos) / 2 / a0, b1 = -(1 + cos) / a0, b2 = (1 + cos) / 2 / a0;
      var a1 = (-2 * cos) / a0, a2 = (1 - alpha) / a0;
      var out = new Float32Array(samples.length);
      var x1 = 0, x2 = 0, y1 = 0, y2 = 0;
      for (var i = 0; i < samples.length; i++) {
        var x = samples[i];
        var y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
        out[i] = y;
        x2 = x1; x1 = x; y2 = y1; y1 = y;
      }
      return out;
    }

    return {
      toMono: toMono, encodeWav: encodeWav, peaks: peaks, peakAbs: peakAbs, dbToGain: dbToGain,
      crop: crop, findSoundBounds: findSoundBounds, normalize: normalize, fade: fade, highpass: highpass,
    };
  }
);

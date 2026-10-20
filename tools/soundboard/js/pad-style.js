/* Soundboard pad style — pure data + colour maths for per-pad fonts and colours
 * (e01s09). No DOM. Dual-mode like soundboard-core.js: window.SoundBoard.padStyle in
 * the browser, module.exports in Node. Loaded BEFORE soundboard-core.js, which uses
 * it to give new and loaded pads valid style fields.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') module.exports = api;
  if (root) {
    root.SoundBoard = root.SoundBoard || {};
    root.SoundBoard.padStyle = api;
  }
})(
  typeof self !== 'undefined' ? self : typeof globalThis !== 'undefined' ? globalThis : this,
  function () {
    'use strict';

    var INK = '#1E2240';
    var WHITE = '#FFFFFF';

    // Vendored in tools/soundboard/fonts/ (see fonts/README.md for licences).
    var FONTS = {
      fredoka:  { label: 'Fredoka', family: '"Fredoka", system-ui, sans-serif' },
      nunito:   { label: 'Nunito', family: '"Nunito", system-ui, sans-serif' },
      baloo:    { label: 'Baloo 2', family: '"Baloo 2", system-ui, sans-serif' },
      atkinson: { label: 'Atkinson (easy read)', family: '"Atkinson Hyperlegible", system-ui, sans-serif' },
      bungee:   { label: 'Bungee', family: '"Bungee", system-ui, sans-serif' },
      marker:   { label: 'Marker', family: '"Permanent Marker", cursive' },
      pixel:    { label: 'Pixel', family: '"Press Start 2P", monospace' },
      system:   { label: 'System', family: 'system-ui, sans-serif' },
    };
    var SIZES = ['auto', 's', 'm', 'l', 'xl'];
    // Neutrals offered after the pad palette.
    var EXTRA_SWATCHES = ['#FFFFFF', '#F2F2F2', '#BDBDBD', '#4A4F75', '#1E2240', '#000000'];
    // What "Apply style to all pads" copies (colour stays per pad).
    var SHARED_KEYS = ['textColor', 'font', 'fontSize', 'bold', 'caps'];

    function defaults() {
      return { textColor: 'auto', font: 'fredoka', fontSize: 'auto', bold: true, caps: false };
    }

    // '#abc' / 'aabbcc' / '#AABBCC' -> '#AABBCC'; anything else -> null.
    function normHex(v) {
      var m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(v == null ? '' : v).trim());
      if (!m) return null;
      var h = m[1];
      if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
      return '#' + h.toUpperCase();
    }

    // Valid style fields from any input; bad or missing values fall back to defaults.
    function normalize(raw) {
      var r = raw && typeof raw === 'object' ? raw : {};
      var d = defaults();
      return {
        textColor: r.textColor === 'auto' ? 'auto' : (normHex(r.textColor) || d.textColor),
        font: Object.prototype.hasOwnProperty.call(FONTS, r.font) ? r.font : d.font,
        fontSize: SIZES.indexOf(r.fontSize) >= 0 ? r.fontSize : d.fontSize,
        bold: typeof r.bold === 'boolean' ? r.bold : d.bold,
        caps: typeof r.caps === 'boolean' ? r.caps : d.caps,
      };
    }

    // ---- colour maths -------------------------------------------------------
    function rgb(hex) {
      var n = parseInt(normHex(hex).slice(1), 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }
    // WCAG relative luminance.
    function luminance(hex) {
      var c = rgb(hex).map(function (v) {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    }
    function contrast(a, b) {
      var la = luminance(a), lb = luminance(b);
      return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
    }
    // Ink or white, whichever reads better on the background.
    function readableText(bg) {
      if (!normHex(bg)) return INK;
      return contrast(bg, INK) >= contrast(bg, WHITE) ? INK : WHITE;
    }
    function textColorFor(pad) {
      return pad.textColor && pad.textColor !== 'auto' ? pad.textColor : readableText(pad.color);
    }

    // h 0-360, s and l 0-100 -> '#RRGGBB'.
    function hslToHex(h, s, l) {
      h = ((Number(h) % 360) + 360) % 360; s = Math.min(100, Math.max(0, s)) / 100; l = Math.min(100, Math.max(0, l)) / 100;
      var c = (1 - Math.abs(2 * l - 1)) * s;
      var x = c * (1 - Math.abs(((h / 60) % 2) - 1));
      var m = l - c / 2;
      var p = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
      return '#' + p.map(function (v) {
        var n = Math.round((v + m) * 255);
        return (n < 16 ? '0' : '') + n.toString(16);
      }).join('').toUpperCase();
    }
    // '#RRGGBB' -> { h, s, l } (0-360, 0-100, 0-100), rounded.
    function hexToHsl(hex) {
      var c = rgb(hex).map(function (v) { return v / 255; });
      var max = Math.max.apply(null, c), min = Math.min.apply(null, c), d = max - min;
      var l = (max + min) / 2, h = 0, s = 0;
      if (d) {
        s = d / (1 - Math.abs(2 * l - 1));
        h = max === c[0] ? ((c[1] - c[2]) / d) % 6 : max === c[1] ? (c[2] - c[0]) / d + 2 : (c[0] - c[1]) / d + 4;
        h = (h * 60 + 360) % 360;
      }
      return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
    }

    // Custom colours already used on this board (not in the swatch grid), newest
    // last, at most `max` — the "Recent colours" row needs no extra storage.
    function recentColors(board, swatches, max) {
      var known = {};
      swatches.forEach(function (c) { known[c.toUpperCase()] = true; });
      var out = [];
      board.pads.forEach(function (p) {
        var c = normHex(p.color);
        if (c && !known[c] && out.indexOf(c) < 0) out.push(c);
      });
      return out.slice(-(max || 6));
    }

    return {
      FONTS: FONTS,
      SIZES: SIZES,
      EXTRA_SWATCHES: EXTRA_SWATCHES,
      SHARED_KEYS: SHARED_KEYS,
      defaults: defaults,
      normalize: normalize,
      normHex: normHex,
      contrast: contrast,
      readableText: readableText,
      textColorFor: textColorFor,
      hslToHex: hslToHex,
      hexToHsl: hexToHsl,
      recentColors: recentColors,
    };
  }
);

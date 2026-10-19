/* Soundboard core — pure, framework-free logic shared by the audio engine, the
 * board model, and (later) the vitest suite. Dual-mode: attaches to
 * window.SoundBoard.core in the browser and to module.exports in Node.
 *
 * No DOM, no AudioContext here — everything in this file is plain data + math so it
 * can run in a unit test with zero browser.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    module.exports = api; // Node / vitest
  }
  if (root) {
    root.SoundBoard = root.SoundBoard || {};
    root.SoundBoard.core = api;
  }
})(
  typeof self !== 'undefined'
    ? self
    : typeof globalThis !== 'undefined'
      ? globalThis
      : this,
  function () {
    'use strict';

    // ---- tiny helpers -------------------------------------------------------
    function clamp(v, lo, hi) {
      var n = Number(v);
      if (!isFinite(n)) n = lo;
      return Math.min(hi, Math.max(lo, n));
    }
    function num(v, def) {
      var n = Number(v);
      return isFinite(n) ? n : def;
    }
    var _seq = 0;
    function uid(prefix) {
      _seq += 1;
      return (prefix || 'id_') + Date.now().toString(36) + (_seq.toString(36) + Math.random().toString(36).slice(2, 6));
    }

    // ---- audio math (pure, testable) --------------------------------------
    // Standard waveshaper soft-clip curve. amount 0 => near-linear, 1 => heavy.
    function makeDistortionCurve(amount) {
      var k = clamp(amount, 0, 1) * 100;
      var n = 1024;
      var curve = new Float32Array(n);
      for (var i = 0; i < n; i++) {
        var x = (i * 2) / n - 1;
        curve[i] = ((3 + k) * x * 20 * (Math.PI / 180)) / (Math.PI + k * Math.abs(x));
      }
      return curve;
    }

    // Synthesized reverb impulse response. `rng` is injectable for deterministic tests.
    function makeImpulseSamples(opts) {
      var o = opts || {};
      var seconds = num(o.seconds, 2.0);
      var decay = num(o.decay, 2.5);
      var sampleRate = num(o.sampleRate, 44100);
      var rng = typeof o.rng === 'function' ? o.rng : Math.random;
      var len = Math.max(1, Math.floor(seconds * sampleRate));
      var buf = new Float32Array(len);
      for (var i = 0; i < len; i++) {
        var t = i / len;
        buf[i] = (rng() * 2 - 1) * Math.pow(1 - t, decay);
      }
      return buf;
    }

    // ---- effect metadata (single source of truth) -------------------------
    // Adding a new effect = add one entry here (for UI + tests) and one builder in
    // audio-engine.js. This is the "easily add more effects" seam (blueprint Q7).
    var EFFECTS = [
      { id: 'gain', label: 'Volume', sliders: [{ key: 'gain', label: 'Level', min: 0, max: 2, step: 0.01, def: 1, unit: '' }] },
      { id: 'pitch', label: 'Pitch / Speed', sliders: [{ key: 'playbackRate', label: 'Rate', min: 0.25, max: 4, step: 0.01, def: 1, unit: '\u00d7' }] },
      {
        id: 'filter',
        label: 'Filter',
        select: { key: 'filterType', label: 'Type', def: 'lowpass', options: ['lowpass', 'highpass', 'bandpass', 'lowshelf', 'highshelf'] },
        sliders: [
          { key: 'filterFreq', label: 'Cutoff', min: 60, max: 18000, step: 1, def: 12000, unit: 'Hz' },
          { key: 'filterQ', label: 'Resonance', min: 0.1, max: 12, step: 0.1, def: 1, unit: 'Q' },
        ],
      },
      {
        id: 'echo',
        label: 'Echo',
        sliders: [
          { key: 'echoTime', label: 'Time', min: 0.01, max: 1, step: 0.01, def: 0.25, unit: 's' },
          { key: 'echoFeedback', label: 'Feedback', min: 0, max: 0.9, step: 0.01, def: 0.35, unit: '' },
          { key: 'echoWet', label: 'Mix', min: 0, max: 1, step: 0.01, def: 0.25, unit: '' },
        ],
      },
      { id: 'reverb', label: 'Reverb', sliders: [{ key: 'reverbWet', label: 'Mix', min: 0, max: 1, step: 0.01, def: 0.2, unit: '' }] },
      { id: 'distortion', label: 'Distortion', sliders: [{ key: 'distortion', label: 'Drive', min: 0, max: 1, step: 0.01, def: 0, unit: '' }] },
    ];

    function defaultEffects() {
      var e = {};
      EFFECTS.forEach(function (fx) {
        fx.sliders.forEach(function (s) { e[s.key] = s.def; });
        if (fx.select) e[fx.select.key] = fx.select.def;
      });
      return e;
    }

    var PALETTE = ['#ff8a1e', '#22d3ee', '#f45bb0', '#a3e635', '#ff5a4d', '#38f2a6', '#ffd23f', '#7aa2ff'];

    // ---- board model (pure) ------------------------------------------------
    function defaultBoard() {
      var board = {
        name: 'Untitled Board',
        isPublic: false,
        master: { gain: 1 },
        layout: { cols: 9, rows: 6 }, // 6x9, per blueprint Q6 (9 across x 6 down)
        pads: [],
      };
      addPad(board, { w: 1, h: 1, x: 0, y: 0, label: 'P1', color: PALETTE[0] });
      addPad(board, { w: 2, h: 1, x: 1, y: 0, label: 'P2', color: PALETTE[1] });
      addPad(board, { w: 1, h: 2, x: 0, y: 1, label: 'P3', color: PALETTE[2] });
      return board;
    }

    function padAt(board, x, y) {
      for (var i = 0; i < board.pads.length; i++) {
        var p = board.pads[i];
        if (x >= p.x && x < p.x + p.w && y >= p.y && y < p.y + p.h) return p;
      }
      return null;
    }

    // Does a w x h rect at (x,y) fit inside bounds and not overlap other pads?
    function fits(board, x, y, w, h, ignoreId) {
      var cols = board.layout.cols, rows = board.layout.rows;
      if (x < 0 || y < 0 || x + w > cols || y + h > rows) return false;
      for (var cy = y; cy < y + h; cy++) {
        for (var cx = x; cx < x + w; cx++) {
          var hit = padAt(board, cx, cy);
          if (hit && hit.id !== ignoreId) return false;
        }
      }
      return true;
    }

    // First free cell (scan order) where a w x h pad fits, or null.
    function findFreeCell(board, w, h) {
      var cols = board.layout.cols, rows = board.layout.rows;
      for (var y = 0; y <= rows - h; y++) {
        for (var x = 0; x <= cols - w; x++) {
          if (fits(board, x, y, w, h)) return { x: x, y: y };
        }
      }
      return null;
    }

    function addPad(board, opts) {
      var o = opts || {};
      var w = clamp(o.w || 1, 1, board.layout.cols);
      var h = clamp(o.h || 1, 1, board.layout.rows);
      var pos =
        o.x != null && o.y != null && fits(board, o.x, o.y, w, h)
          ? { x: o.x, y: o.y }
          : findFreeCell(board, w, h);
      if (!pos) throw new Error('no free cell for a ' + w + 'x' + h + ' pad');
      var pad = {
        id: uid('p_'),
        label: o.label || 'P' + (board.pads.length + 1),
        color: o.color || PALETTE[board.pads.length % PALETTE.length],
        emoji: o.emoji || '',
        sound: null,
        loop: false,
        x: pos.x,
        y: pos.y,
        w: w,
        h: h,
        effects: defaultEffects(),
      };
      board.pads.push(pad);
      return pad;
    }

    function removePad(board, id) {
      for (var i = 0; i < board.pads.length; i++) {
        if (board.pads[i].id === id) { board.pads.splice(i, 1); return true; }
      }
      return false;
    }

    function movePad(board, id, x, y) {
      var pad = null;
      for (var i = 0; i < board.pads.length; i++) if (board.pads[i].id === id) pad = board.pads[i];
      if (!pad) return false;
      if (!fits(board, x, y, pad.w, pad.h, id)) return false;
      pad.x = x;
      pad.y = y;
      return true;
    }

    function resizePad(board, id, w, h) {
      var pad = null;
      for (var i = 0; i < board.pads.length; i++) if (board.pads[i].id === id) pad = board.pads[i];
      if (!pad) return false;
      w = clamp(w, 1, board.layout.cols);
      h = clamp(h, 1, board.layout.rows);
      if (!fits(board, pad.x, pad.y, w, h, id)) return false;
      pad.w = w;
      pad.h = h;
      return true;
    }

    function setLayout(board, cols, rows) {
      cols = clamp(cols, 3, 12);
      rows = clamp(rows, 3, 12);
      board.layout.cols = cols;
      board.layout.rows = rows;
      board.pads.forEach(function (p) {
        p.w = clamp(p.w, 1, cols);
        p.h = clamp(p.h, 1, rows);
        if (p.x + p.w > cols) p.x = Math.max(0, cols - p.w);
        if (p.y + p.h > rows) p.y = Math.max(0, rows - p.h);
      });
    }

    // Defensive parse: fills defaults, clamps geometry, drops nothing silently —
    // returns { board, errors } so the caller can surface what it had to fix.
    function validateBoard(data) {
      var errors = [];
      var d = data && typeof data === 'object' ? data : {};
      var board = {
        name: typeof d.name === 'string' && d.name ? d.name : 'Untitled Board',
        isPublic: !!d.isPublic,
        master: { gain: clamp(num(d.master && d.master.gain, 1), 0, 2) },
        layout: { cols: clamp(num(d.layout && d.layout.cols, 9), 3, 12), rows: clamp(num(d.layout && d.layout.rows, 6), 3, 12) },
        pads: [],
      };
      var pads = Array.isArray(d.pads) ? d.pads : [];
      pads.forEach(function (raw) {
        try {
          var r = raw && typeof raw === 'object' ? raw : {};
          board.pads.push({
            id: typeof r.id === 'string' && r.id ? r.id : uid('p_'),
            label: typeof r.label === 'string' ? r.label : 'Pad',
            color: typeof r.color === 'string' ? r.color : PALETTE[0],
            emoji: typeof r.emoji === 'string' ? r.emoji : '',
            sound: r.sound && typeof r.sound === 'object' ? r.sound : null,
            loop: !!r.loop,
            x: clamp(num(r.x, 0), 0, board.layout.cols - 1),
            y: clamp(num(r.y, 0), 0, board.layout.rows - 1),
            w: clamp(num(r.w, 1), 1, board.layout.cols),
            h: clamp(num(r.h, 1), 1, board.layout.rows),
            effects: Object.assign(defaultEffects(), r.effects || {}),
          });
        } catch (e) {
          errors.push('pad: ' + (e && e.message));
        }
      });
      return { board: board, errors: errors };
    }

    return {
      clamp: clamp,
      num: num,
      uid: uid,
      makeDistortionCurve: makeDistortionCurve,
      makeImpulseSamples: makeImpulseSamples,
      EFFECTS: EFFECTS,
      PALETTE: PALETTE,
      defaultEffects: defaultEffects,
      defaultBoard: defaultBoard,
      addPad: addPad,
      removePad: removePad,
      movePad: movePad,
      resizePad: resizePad,
      setLayout: setLayout,
      padAt: padAt,
      fits: fits,
      findFreeCell: findFreeCell,
      validateBoard: validateBoard,
    };
  }
);

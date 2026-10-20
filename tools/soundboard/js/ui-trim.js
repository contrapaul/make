/* Soundboard UI — trim & clean-up editor for a recording (e01s11). Mounted by the
 * recorder's review step (ui-recorder.js); a small, fixed toolset, not an editor:
 *
 *   waveform + start/end handles (44px touch targets) · ▶ Play (the selection, with
 *   a playhead) · ✂ Trim · Auto-trim · Louder · Fade in / out (Short/Medium/Long) ·
 *   Less rumble · ↶ Undo (10 steps) · Reset
 *
 * Every tool works on a mono Float32Array and returns a new one (audio-dsp.js), so
 * Undo and Reset restore earlier states exactly. Auto-trim runs once when a take
 * arrives (undoable). "Use recording" saves what ▶ Play plays: the selection.
 */
(function (root) {
  'use strict';

  var S = root.SoundBoard;
  var engine = S.engine;
  var dsp = S.dsp;
  var make = S.dom.make;

  var MIN_SEL_MS = 50;
  var MAX_UNDO = 10;
  var FADES = [['Short', 10], ['Medium', 60], ['Long', 250]];
  var RUMBLE_HZ = 90;
  var QUIET_DB = -50;

  var ed = null; // { host, sr, original, cur, history, a, b, fadeMs, opts, preview, ... }

  // ---- mount / unmount -----------------------------------------------------
  // opts: { samples, sampleRate, onUse(samples), onRerecord(), onCancel() }
  function mount(host, opts) {
    unmount();
    ed = {
      host: host, opts: opts, sr: opts.sampleRate,
      original: opts.samples, cur: opts.samples, history: [],
      a: 0, b: opts.samples.length, fadeMs: FADES[1][1], preview: null, raf: 0,
      recordedSec: opts.samples.length / opts.sampleRate,
    };
    build();
    autoTrim(true);
  }

  function unmount() {
    if (!ed) return;
    stopPreview();
    if (ed.ro) ed.ro.disconnect();
    ed = null;
  }

  // ---- state changes ---------------------------------------------------------
  function apply(next, label, keepSelection) {
    ed.history.push(ed.cur);
    if (ed.history.length > MAX_UNDO) ed.history.shift();
    ed.cur = next;
    if (!keepSelection || ed.b > next.length) { ed.a = 0; ed.b = next.length; }
    stopPreview();
    refresh(label);
  }

  function autoTrim(first) {
    var bounds = dsp.findSoundBounds(ed.cur, ed.sr, { thresholdDb: -40, padMs: 30 });
    if (bounds.start === 0 && bounds.end === ed.cur.length) { refresh(first ? '' : 'Nothing to trim'); return; }
    apply(dsp.crop(ed.cur, bounds.start, bounds.end), first ? 'Silence trimmed automatically · ↶ Undo brings it back' : 'Silence trimmed');
  }

  var TOOLS = {
    trim: function () {
      if (ed.a === 0 && ed.b === ed.cur.length) { refresh('Drag the handles first, then ✂ Trim'); return; }
      apply(dsp.crop(ed.cur, ed.a, ed.b), 'Trimmed');
    },
    auto: function () { autoTrim(false); },
    louder: function () { apply(dsp.normalize(ed.cur, -1), 'Louder (peak −1 dB)', true); },
    fadeIn: function () { apply(dsp.fade(ed.cur, ed.sr, 'in', ed.fadeMs), 'Faded in', true); },
    fadeOut: function () { apply(dsp.fade(ed.cur, ed.sr, 'out', ed.fadeMs), 'Faded out', true); },
    rumble: function () { apply(dsp.highpass(ed.cur, ed.sr, RUMBLE_HZ), 'Rumble reduced', true); },
    undo: function () {
      if (!ed.history.length) return;
      ed.cur = ed.history.pop();
      ed.a = 0; ed.b = ed.cur.length;
      stopPreview();
      refresh('Undone');
    },
    reset: function () {
      if (ed.cur === ed.original) return;
      ed.history.push(ed.cur);
      if (ed.history.length > MAX_UNDO) ed.history.shift();
      ed.cur = ed.original;
      ed.a = 0; ed.b = ed.cur.length;
      stopPreview();
      refresh('Back to the original take');
    },
  };

  // ---- DOM -------------------------------------------------------------------
  function toolBtn(key, text, label) {
    var b = make('button', { type: 'button', class: 'sb-btn sb-trim__tool', 'data-tool': key, text: text, 'aria-label': label || null });
    b.addEventListener('click', function () { if (ed) TOOLS[key](); });
    return b;
  }

  function build() {
    var canvas = make('canvas', { class: 'sb-rec__wave', role: 'img' });
    var shadeL = make('div', { class: 'sb-trim__shade sb-trim__shade--l' });
    var shadeR = make('div', { class: 'sb-trim__shade sb-trim__shade--r' });
    var head = make('div', { class: 'sb-trim__playhead', 'aria-hidden': 'true' });
    var hA = handle('start', 'Start of the part to keep');
    var hB = handle('end', 'End of the part to keep');
    var wave = make('div', { class: 'sb-trim__wave' }, [canvas, shadeL, shadeR, head, hA, hB]);
    var status = make('p', { class: 'sb-rec__status', role: 'status', 'data-recorded': ed.recordedSec.toFixed(2) });
    var info = make('p', { class: 'sb-trim__info' });
    var play = make('button', { type: 'button', class: 'sb-btn', text: '▶ Play' });
    play.addEventListener('click', togglePreview);

    var fades = make('div', { class: 'sb-segmented', role: 'group', 'aria-label': 'Fade length' });
    FADES.forEach(function (f) {
      var b = make('button', { type: 'button', class: 'sb-seg', text: f[0], 'aria-pressed': f[1] === ed.fadeMs ? 'true' : 'false' });
      b.addEventListener('click', function () {
        ed.fadeMs = f[1];
        fades.querySelectorAll('.sb-seg').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
      });
      fades.appendChild(b);
    });

    var undo = toolBtn('undo', '↶ Undo');
    var reset = toolBtn('reset', 'Reset');
    var use = make('button', { type: 'button', class: 'sb-btn sb-btn--primary', text: 'Use recording' });
    use.addEventListener('click', function () {
      var keep = dsp.crop(ed.cur, ed.a, ed.b);
      var cb = ed.opts.onUse;
      unmount();
      cb(keep);
    });

    ed.host.append(
      wave, info, status,
      make('div', { class: 'sb-row sb-rec__actions' }, [play, toolBtn('trim', '✂ Trim', 'Trim to the selection'), toolBtn('auto', 'Auto-trim', 'Cut silence at both ends')]),
      make('div', { class: 'sb-row sb-rec__actions' }, [toolBtn('louder', 'Louder'), toolBtn('rumble', 'Less rumble')]),
      make('div', { class: 'sb-row sb-rec__actions' }, [toolBtn('fadeIn', 'Fade in'), toolBtn('fadeOut', 'Fade out'), fades]),
      make('div', { class: 'sb-row sb-rec__actions' }, [undo, reset]),
      make('div', { class: 'sb-row sb-rec__actions' }, [
        use,
        make('button', { type: 'button', class: 'sb-btn', text: '↺ Re-record', onclick: function () { var cb = ed.opts.onRerecord; unmount(); cb(); } }),
        make('button', { type: 'button', class: 'sb-btn', text: 'Cancel', onclick: function () { var cb = ed.opts.onCancel; unmount(); cb(); } }),
      ]),
    );
    ed.el = { canvas: canvas, wave: wave, shadeL: shadeL, shadeR: shadeR, head: head, hA: hA, hB: hB, status: status, info: info, play: play, undo: undo, reset: reset };
    if (root.ResizeObserver) {
      ed.ro = new ResizeObserver(function () { if (ed) draw(); });
      ed.ro.observe(canvas);
    }
  }

  // A drag handle: a bar with a 44px-wide invisible touch target. Pointer Events +
  // capture (the handle never re-renders mid-drag); touch-action none = no page scroll.
  function handle(side, label) {
    var h = make('div', { class: 'sb-trim__handle sb-trim__handle--' + side, role: 'slider', tabindex: '0', 'aria-label': label });
    h.addEventListener('pointerdown', function (e) {
      if (!ed || !e.isPrimary) return;
      e.preventDefault();
      try { h.setPointerCapture(e.pointerId); } catch (_) {}
      var move = function (ev) { if (ed) setEdge(side, sampleAt(ev.clientX)); };
      var up = function () { h.removeEventListener('pointermove', move); h.removeEventListener('pointerup', up); h.removeEventListener('pointercancel', up); };
      h.addEventListener('pointermove', move);
      h.addEventListener('pointerup', up);
      h.addEventListener('pointercancel', up);
    });
    h.addEventListener('keydown', function (e) { // arrows nudge by 10 ms (100 ms with Shift)
      if (!ed || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
      e.preventDefault();
      var step = Math.round(ed.sr * (e.shiftKey ? 0.1 : 0.01)) * (e.key === 'ArrowLeft' ? -1 : 1);
      setEdge(side, (side === 'start' ? ed.a : ed.b) + step);
    });
    return h;
  }

  function sampleAt(clientX) {
    var r = ed.el.canvas.getBoundingClientRect();
    var f = Math.max(0, Math.min(1, (clientX - r.left) / Math.max(1, r.width)));
    return Math.round(f * ed.cur.length);
  }

  // Move one edge; the two handles never cross and keep at least 50 ms between them.
  function setEdge(side, sample) {
    var min = Math.round((MIN_SEL_MS / 1000) * ed.sr);
    if (side === 'start') ed.a = Math.max(0, Math.min(sample, ed.b - min));
    else ed.b = Math.min(ed.cur.length, Math.max(sample, ed.a + min));
    stopPreview();
    place();
  }

  // ---- drawing ---------------------------------------------------------------
  function refresh(message) {
    if (!ed) return;
    draw();
    var quiet = dsp.peakAbs(ed.cur) < dsp.dbToGain(QUIET_DB);
    ed.el.status.textContent = quiet ? 'That was very quiet. Check the mic and try again.' : (message || '');
    ed.el.status.classList.toggle('is-error', quiet);
    ed.el.undo.disabled = !ed.history.length;
    ed.el.reset.disabled = ed.cur === ed.original;
  }

  function draw() {
    var c = ed.el.canvas;
    var dpr = root.devicePixelRatio || 1;
    var w = Math.max(1, Math.round(c.clientWidth * dpr)), h = Math.max(1, Math.round(c.clientHeight * dpr));
    c.width = w; c.height = h;
    var g = c.getContext('2d');
    g.clearRect(0, 0, w, h);
    g.fillStyle = getComputedStyle(c).getPropertyValue('--wave').trim() || '#5B6CFF';
    var p = dsp.peaks(ed.cur, w), mid = h / 2;
    for (var x = 0; x < w; x++) {
      var top = mid - p.max[x] * mid, bottom = mid - p.min[x] * mid;
      g.fillRect(x, top, 1, Math.max(1, bottom - top));
    }
    c.setAttribute('aria-label', 'Waveform, ' + (ed.cur.length / ed.sr).toFixed(1) + ' seconds');
    place();
  }

  function pct(sample) { return (100 * sample / Math.max(1, ed.cur.length)) + '%'; }

  function place() {
    var e = ed.el;
    e.hA.style.left = pct(ed.a);
    e.hB.style.left = pct(ed.b);
    e.shadeL.style.width = pct(ed.a);
    e.shadeR.style.left = pct(ed.b);
    var secs = function (n) { return (n / ed.sr).toFixed(2); };
    e.hA.setAttribute('aria-valuetext', secs(ed.a) + ' s');
    e.hB.setAttribute('aria-valuetext', secs(ed.b) + ' s');
    var whole = ed.a === 0 && ed.b === ed.cur.length;
    e.info.textContent = (ed.cur.length / ed.sr).toFixed(1) + ' s' + (whole ? '' : ' · keeping ' + ((ed.b - ed.a) / ed.sr).toFixed(1) + ' s');
  }

  // ---- preview (plays the selection, with a moving playhead) ---------------------
  function togglePreview() {
    if (!ed) return;
    if (ed.preview) { stopPreview(); return; }
    var ctx = engine.ensure();
    var part = dsp.crop(ed.cur, ed.a, ed.b);
    var buf = ctx.createBuffer(1, Math.max(1, part.length), ed.sr);
    buf.copyToChannel(part, 0);
    var t0 = ctx.currentTime, a = ed.a, len = part.length;
    ed.preview = engine.play(buf, { id: '__preview', effects: {} }, {
      onEnded: function (h, wasCurrent) { if (ed && wasCurrent) stopPreview(); },
    });
    ed.el.play.textContent = '■ Stop';
    ed.el.head.style.display = 'block';
    var tick = function () {
      if (!ed || !ed.preview) return;
      var done = Math.min(len, (ctx.currentTime - t0) * ed.sr);
      ed.el.head.style.left = pct(a + done);
      ed.raf = root.requestAnimationFrame(tick);
    };
    tick();
  }

  function stopPreview() {
    if (!ed) return;
    if (ed.preview) { engine.stop(ed.preview); ed.preview = null; }
    if (ed.raf) { root.cancelAnimationFrame(ed.raf); ed.raf = 0; }
    if (ed.el) { ed.el.play.textContent = '▶ Play'; ed.el.head.style.display = 'none'; }
  }

  // What "Use recording" would save right now (the selection), without closing.
  function selection() { return ed ? dsp.crop(ed.cur, ed.a, ed.b) : null; }

  root.SoundBoard.trimUI = { mount: mount, unmount: unmount, selection: selection, isOpen: function () { return !!ed; } };
})(typeof self !== 'undefined' ? self : this);

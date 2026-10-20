/* Soundboard UI — inline recorder (e01s10). Opens in place of the Sound block (or at
 * the top of the Library), never as a modal:
 *
 *   ready      big red ● Record, input meter, 3-2-1 count-in toggle, Cancel
 *   counting   3 · 2 · 1
 *   recording  ■ Stop inside a ring that empties over 10 s, seconds left, meter
 *   review     waveform, ▶ Play, ↺ Re-record, Use recording, Cancel   (s11 adds tools)
 *
 * "Use recording" encodes a mono 16-bit WAV and hands it to the normal file path
 * (ui-library onFile): signed in -> uploaded to the account; signed out -> local.
 */
(function (root) {
  'use strict';

  var S = root.SoundBoard;
  var model = S.model;
  var engine = S.engine;
  var rec = S.recorder;
  var dsp = S.dsp;
  var make = S.dom.make;

  var MAX_SECONDS = 10;
  var QUIET_DB = -50;     // a take whose peak is below this is probably a dead mic
  var RING_R = 52;        // svg units; circumference drives the countdown ring
  var RING_C = 2 * Math.PI * RING_R;
  var COUNTIN_KEY = 'soundboard:countin';
  var takeNo = 0;         // "Recording N.wav", counting up within the session

  var host = null;        // element the recorder is drawn into
  var take = null;        // AudioBuffer under review
  var preview = null;     // engine handle while ▶ Play is sounding
  var gen = 0;            // bumped per attempt/open/close; async callbacks from an
                          // older attempt (e.g. a count-in timer after Cancel) bail out

  function lcdMsg(t) { S.ui.lcdMsg(t); }

  function countInOn() {
    try { return localStorage.getItem(COUNTIN_KEY) !== 'off'; } catch (_) { return true; }
  }

  // ---- entry ---------------------------------------------------------------
  function openIn(el) {
    close(false);
    gen++;
    host = el;
    host.classList.add('sb-rec-host');
    host.textContent = '';
    showReady();
  }

  // Leave the recorder: release the mic, stop any preview, redraw the panel.
  function close(rerender) {
    gen++;
    rec.cancel();
    stopPreview();
    take = null;
    if (host) host.classList.remove('sb-rec-host');
    host = null;
    if (rerender !== false) S.ui.render();
  }

  // The panel re-renders often (selecting a pad, etc.). If our host left the page,
  // drop the session so the mic is never left open behind the user's back.
  function alive() {
    if (host && document.body.contains(host)) return true;
    rec.cancel(); stopPreview(); host = null; take = null;
    return false;
  }
  // Still the attempt that scheduled this callback, and still on the page?
  function live(g) { return g === gen && alive(); }

  function frame(children) {
    host.textContent = '';
    host.appendChild(make('div', { class: 'sb-rec' }, [make('div', { class: 'sb-subhead', text: 'Record a sound (up to ' + MAX_SECONDS + ' s)' })].concat(children)));
  }

  function meter() {
    var bar = make('span', { class: 'sb-rec__meter-fill' });
    var m = make('div', { class: 'sb-rec__meter', role: 'meter', 'aria-label': 'Microphone level', 'aria-valuemin': '0', 'aria-valuemax': '100' }, [bar]);
    m.set = function (rms) {
      // rms -> 0..100 on a dB scale (-60 dB .. 0 dB)
      var db = 20 * Math.log10(Math.max(rms, 1e-6));
      var pct = Math.max(0, Math.min(100, (db + 60) / 60 * 100));
      bar.style.width = pct + '%';
      m.setAttribute('aria-valuenow', String(Math.round(pct)));
    };
    return m;
  }

  function bigButton(kind, label, onClick, inner) {
    var b = make('button', { type: 'button', class: 'sb-rec__big sb-rec__big--' + kind, 'aria-label': label }, inner || []);
    b.addEventListener('click', onClick);
    return b;
  }

  function ring(child) {
    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 120 120');
    svg.setAttribute('class', 'sb-rec__ring');
    svg.setAttribute('aria-hidden', 'true');
    var track = document.createElementNS(ns, 'circle');
    var arc = document.createElementNS(ns, 'circle');
    [track, arc].forEach(function (c) { c.setAttribute('cx', '60'); c.setAttribute('cy', '60'); c.setAttribute('r', String(RING_R)); });
    track.setAttribute('class', 'sb-rec__ring-track');
    arc.setAttribute('class', 'sb-rec__ring-arc');
    arc.setAttribute('stroke-dasharray', String(RING_C));
    arc.setAttribute('stroke-dashoffset', '0');
    svg.append(track, arc);
    var wrap = make('div', { class: 'sb-rec__ringwrap' }, [child]);
    wrap.insertBefore(svg, child);
    wrap.setLeft = function (left) { arc.setAttribute('stroke-dashoffset', String(RING_C * (1 - left / MAX_SECONDS))); };
    return wrap;
  }

  // ---- states --------------------------------------------------------------
  function showReady(errorText) {
    var m = meter();
    var status = make('p', { class: 'sb-rec__status', role: 'status', text: errorText || 'Press the red button and speak.' });
    if (errorText) status.classList.add('is-error');
    var countIn = make('input', { type: 'checkbox' });
    countIn.checked = countInOn();
    countIn.addEventListener('change', function () { try { localStorage.setItem(COUNTIN_KEY, countIn.checked ? 'on' : 'off'); } catch (_) {} });
    var go = bigButton('rec', 'Record', function () { begin(countIn.checked, m, status, go); }, [make('span', { class: 'sb-rec__dot', 'aria-hidden': 'true' })]);
    frame([
      make('div', { class: 'sb-rec__stage' }, [ring(go), m]),
      status,
      make('label', { class: 'sb-check' }, [countIn, make('span', { text: 'Count in 3-2-1' })]),
      make('div', { class: 'sb-row' }, [make('button', { type: 'button', class: 'sb-btn', text: 'Cancel', onclick: function () { close(); } })]),
    ]);
    if (!rec.supported()) {
      go.disabled = true;
      status.textContent = root.isSecureContext
        ? 'Recording isn’t available in this browser. Try Safari, Chrome or Edge.'
        : 'Recording needs a secure (https) page.';
      status.classList.add('is-error');
    }
  }

  function begin(countIn, m, status, btn) {
    btn.disabled = true;
    status.classList.remove('is-error');
    status.textContent = 'Asking for the microphone…';
    var g = ++gen;
    rec.open({ onLevel: function (r) { if (live(g)) m.set(r); } })
      .then(function () {
        if (!live(g)) { rec.cancel(); return; }
        if (countIn) showCountIn(3, m, g);
        else startRecording(m, g);
      })
      .catch(function (e) { if (e && e.name === 'AbortError') return; if (live(g)) showReady(errorMessage(e)); });
  }

  function showCountIn(n, m, g) {
    if (!live(g)) return;
    if (n === 0) { startRecording(m, g); return; }
    frame([
      make('div', { class: 'sb-rec__stage' }, [make('div', { class: 'sb-rec__count', 'aria-live': 'assertive', text: String(n) }), m]),
      make('p', { class: 'sb-rec__status', text: 'Get ready…' }),
      make('div', { class: 'sb-row' }, [make('button', { type: 'button', class: 'sb-btn', text: 'Cancel', onclick: function () { close(); } })]),
    ]);
    setTimeout(function () { showCountIn(n - 1, m, g); }, 700);
  }

  function startRecording(m, g) {
    var secs = make('span', { class: 'sb-rec__secs', text: String(MAX_SECONDS) });
    var stopBtn = bigButton('stop', 'Stop recording', function () {
      stopBtn.disabled = true;
      rec.stop().then(function (b) { review(b, g); }, function (e) { if (live(g)) showReady(errorMessage(e)); });
    }, [make('span', { class: 'sb-rec__square', 'aria-hidden': 'true' })]);
    var r = ring(stopBtn);
    frame([
      make('div', { class: 'sb-rec__stage' }, [r, m]),
      make('p', { class: 'sb-rec__status', role: 'status' }, [make('span', { text: 'Recording… ' }), secs, make('span', { text: ' s left' })]),
      make('div', { class: 'sb-row' }, [make('button', { type: 'button', class: 'sb-btn', text: 'Cancel', onclick: function () { close(); } })]),
    ]);
    rec.record({
      maxSeconds: MAX_SECONDS,
      onTick: function (left) {
        if (!live(g)) return;
        r.setLeft(left);
        secs.textContent = String(Math.ceil(left));
      },
      onAutoStop: function (buffer, err) {
        if (!live(g)) return;
        if (buffer) review(buffer, g); else showReady(errorMessage(err));
      },
    });
  }

  function review(buffer, g) {
    if (!live(g) || !buffer) return;
    take = buffer;
    var mono = dsp.toMono(channelsOf(buffer));
    var quiet = dsp.peakAbs(mono) < dsp.dbToGain(QUIET_DB);
    var canvas = make('canvas', { class: 'sb-rec__wave', role: 'img', 'aria-label': 'Waveform of the recording, ' + buffer.duration.toFixed(1) + ' seconds' });
    var play = make('button', { type: 'button', class: 'sb-btn', text: '▶ Play' });
    play.addEventListener('click', function () { togglePreview(play); });
    frame([
      canvas,
      make('p', { class: 'sb-rec__status' + (quiet ? ' is-error' : ''), role: 'status', text: quiet
        ? 'That was very quiet. Check the mic and try again.'
        : buffer.duration.toFixed(1) + ' s recorded.' }),
      make('div', { class: 'sb-row sb-rec__actions' }, [
        play,
        make('button', { type: 'button', class: 'sb-btn', text: '↺ Re-record', onclick: function () { stopPreview(); take = null; showReady(); } }),
      ]),
      make('div', { class: 'sb-row sb-rec__actions' }, [
        make('button', { type: 'button', class: 'sb-btn sb-btn--primary', text: 'Use recording', onclick: useRecording }),
        make('button', { type: 'button', class: 'sb-btn', text: 'Cancel', onclick: function () { close(); } }),
      ]),
    ]);
    drawWave(canvas, mono);
    if (root.ResizeObserver) {
      var ro = new ResizeObserver(function () { if (!document.body.contains(canvas)) { ro.disconnect(); return; } drawWave(canvas, mono); });
      ro.observe(canvas);
    }
  }

  function channelsOf(buffer) {
    var out = [];
    for (var c = 0; c < buffer.numberOfChannels; c++) out.push(buffer.getChannelData(c));
    return out;
  }

  function drawWave(canvas, mono) {
    var dpr = root.devicePixelRatio || 1;
    var w = Math.max(1, Math.round(canvas.clientWidth * dpr)), h = Math.max(1, Math.round(canvas.clientHeight * dpr));
    canvas.width = w; canvas.height = h;
    var g = canvas.getContext('2d');
    var css = getComputedStyle(canvas);
    g.clearRect(0, 0, w, h);
    g.fillStyle = css.getPropertyValue('--wave').trim() || '#5B6CFF';
    var p = dsp.peaks(mono, w), mid = h / 2;
    for (var x = 0; x < w; x++) {
      var top = mid - p.max[x] * mid, bottom = mid - p.min[x] * mid;
      g.fillRect(x, top, 1, Math.max(1, bottom - top));
    }
  }

  function togglePreview(btn) {
    if (preview) { stopPreview(); btn.textContent = '▶ Play'; return; }
    preview = engine.play(take, { id: '__preview', effects: {} }, { onEnded: function () { preview = null; btn.textContent = '▶ Play'; } });
    btn.textContent = '■ Stop';
  }
  function stopPreview() { if (preview) { engine.stop(preview); preview = null; } }

  function useRecording() {
    if (!take) return;
    stopPreview();
    var mono = dsp.toMono(channelsOf(take));
    var wav = dsp.encodeWav(mono, take.sampleRate);
    takeNo += 1;
    var file = new File([wav], 'Recording ' + takeNo + '.wav', { type: 'audio/wav' });
    var target = model.getPad(model.selectedId);
    close();
    S.library.onFile([file]); // same path as a picked file: upload or keep local, assign to pad
    if (!target) lcdMsg('Recording ' + takeNo + ' added to the library');
  }

  function errorMessage(e) {
    var name = e && e.name;
    if (name === 'NotAllowedError' || name === 'SecurityError') return 'Microphone access was blocked. Allow the microphone for this site in your browser settings, then try again.';
    if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'No microphone found.';
    if (name === 'InsecureContextError') return 'Recording needs a secure (https) page.';
    if (name === 'NotSupportedError') return 'Recording isn’t available in this browser. Try Safari, Chrome or Edge.';
    if (name === 'NotReadableError') return 'The microphone is busy in another app. Close it and try again.';
    return 'Recording failed' + (e && e.message ? ': ' + e.message : '') + '.';
  }

  // "● Record" button for the Sound block and the Library header.
  function recordButton(getHost) {
    return make('button', { type: 'button', class: 'sb-btn sb-btn--rec', text: '● Record', onclick: function () { openIn(getHost()); } });
  }

  root.SoundBoard.recorderUI = { openIn: openIn, close: close, recordButton: recordButton, isOpen: function () { return !!host; } };
})(typeof self !== 'undefined' ? self : this);

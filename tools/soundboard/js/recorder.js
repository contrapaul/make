/* Soundboard recorder — microphone capture for e01s10 (no DOM).
 *
 *   recorder.supported()                      -> boolean
 *   recorder.open({ onLevel(rms) })           -> Promise  (asks for the mic; meter runs)
 *   recorder.record({ maxSeconds, onTick(left), onAutoStop })  starts capturing
 *   recorder.stop()                           -> Promise<AudioBuffer>  (also after auto-stop)
 *   recorder.cancel()                         discard; mic released
 *
 * open() is separate from record() so the UI can show a live level meter and a 3-2-1
 * count-in before capture begins. Time is measured on the AudioContext clock, not
 * setTimeout, and the decoded take is trimmed to maxSeconds in case the encoder
 * overshoots. The mic is ALWAYS released on stop, cancel, error and page hide, so the
 * browser's recording indicator goes off.
 */
(function (root) {
  'use strict';

  var S = root.SoundBoard;
  var engine = S.engine;

  var TICK_MS = 50;
  var MIME_PREFS = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus'];

  var s = null; // the open session: { stream, ctx, src, analyser, rec, chunks, timer, ... }
  var openSeq = 0; // bumped by every open() and cancel(): a mic grant that arrives for a
                   // superseded/cancelled open is stopped at once, never left running

  function supported() {
    return !!(root.isSecureContext && root.navigator && navigator.mediaDevices &&
      navigator.mediaDevices.getUserMedia && root.MediaRecorder);
  }

  function pickMime() {
    if (!root.MediaRecorder || typeof MediaRecorder.isTypeSupported !== 'function') return '';
    for (var i = 0; i < MIME_PREFS.length; i++) if (MediaRecorder.isTypeSupported(MIME_PREFS[i])) return MIME_PREFS[i];
    return ''; // browser default
  }

  function rmsOf(analyser, buf) {
    analyser.getFloatTimeDomainData(buf);
    var sum = 0;
    for (var i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
    return Math.sqrt(sum / buf.length);
  }

  function open(opts) {
    opts = opts || {};
    if (s) cancel();
    var my = ++openSeq;
    if (!supported()) return Promise.reject(Object.assign(new Error('unsupported'), { name: root.isSecureContext ? 'NotSupportedError' : 'InsecureContextError' }));
    return navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: true, autoGainControl: true },
    }).then(function (stream) {
      if (my !== openSeq) {
        stream.getTracks().forEach(function (t) { t.stop(); });
        throw Object.assign(new Error('superseded'), { name: 'AbortError' });
      }
      var ctx = engine.ensure();
      if (ctx.state === 'suspended') ctx.resume();
      var src = ctx.createMediaStreamSource(stream);
      var analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      src.connect(analyser); // meter only — never routed to the speakers (no feedback)
      var buf = new Float32Array(analyser.fftSize);
      s = { stream: stream, ctx: ctx, src: src, analyser: analyser, rec: null, chunks: [], startedAt: 0, max: 10 };
      s.timer = setInterval(function () { tick(opts.onLevel, buf); }, TICK_MS);
      root.addEventListener('pagehide', cancel);
    });
  }

  function tick(onLevel, buf) {
    if (!s) return;
    if (onLevel) onLevel(rmsOf(s.analyser, buf));
    // onLevel may have cancelled the session (the UI left the page), so check again.
    if (!s || !s.rec || s.rec.state !== 'recording') return;
    var left = Math.max(0, s.max - (s.ctx.currentTime - s.startedAt));
    if (s.onTick) s.onTick(left);
    if (left <= 0 && !s.autoStopped) {
      s.autoStopped = true;
      var auto = s.onAutoStop;
      stop().then(function (buffer) { if (auto) auto(buffer); }, function (e) { if (auto) auto(null, e); });
    }
  }

  function record(opts) {
    opts = opts || {};
    if (!s) throw new Error('recorder.record: call open() first');
    var mime = pickMime();
    s.rec = mime ? new MediaRecorder(s.stream, { mimeType: mime }) : new MediaRecorder(s.stream);
    s.chunks = [];
    s.max = opts.maxSeconds || 10;
    s.onTick = opts.onTick;
    s.onAutoStop = opts.onAutoStop;
    s.autoStopped = false;
    var sess = s;
    s.rec.ondataavailable = function (e) { if (e.data && e.data.size) sess.chunks.push(e.data); };
    s.startedAt = s.ctx.currentTime;
    s.rec.start(100);
  }

  // Finish the take: release the mic first, then decode and trim to maxSeconds.
  function stop() {
    if (!s || !s.rec) return Promise.reject(new Error('not recording'));
    var sess = s;
    if (sess.stopping) return sess.stopping;
    sess.stopping = new Promise(function (resolve, reject) {
      sess.rec.onstop = function () {
        var blob = new Blob(sess.chunks, { type: sess.rec.mimeType || 'audio/webm' });
        release();
        engine.decode(blob).then(function (buffer) { resolve(trimTo(buffer, sess.max)); }, reject);
      };
      try { sess.rec.stop(); } catch (e) { release(); reject(e); }
    });
    return sess.stopping;
  }

  function cancel() {
    openSeq++; // also void any open() still waiting for the permission prompt
    if (!s) return;
    var sess = s;
    if (sess.rec && sess.rec.state !== 'inactive') {
      sess.rec.onstop = null;
      try { sess.rec.stop(); } catch (_) {}
    }
    release();
  }

  function release() {
    if (!s) return;
    clearInterval(s.timer);
    try { s.src.disconnect(); } catch (_) {}
    s.stream.getTracks().forEach(function (t) { t.stop(); });
    root.removeEventListener('pagehide', cancel);
    s = null;
  }

  function trimTo(buffer, seconds) {
    var max = Math.floor(seconds * buffer.sampleRate);
    if (buffer.length <= max) return buffer;
    var out = engine.ensure().createBuffer(buffer.numberOfChannels, max, buffer.sampleRate);
    for (var c = 0; c < buffer.numberOfChannels; c++) out.copyToChannel(buffer.getChannelData(c).subarray(0, max), c);
    return out;
  }

  function isOpen() { return !!s; }
  function isRecording() { return !!(s && s.rec && s.rec.state === 'recording'); }

  root.SoundBoard.recorder = {
    supported: supported, open: open, record: record, stop: stop, cancel: cancel,
    isOpen: isOpen, isRecording: isRecording,
  };
})(typeof self !== 'undefined' ? self : this);

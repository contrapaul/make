/* Soundboard audio engine — Web Audio graph.
 *
 * One AudioContext for the page, shared master chain (master gain -> compressor ->
 * destination). Every pad trigger builds a FRESH effect chain from the shared
 * EFFECTS registry (window.SoundBoard.core) in canonical order, so params are
 * always current and pads can layer freely. Pitch lives on the source (playbackRate);
 * everything else is a node in the chain.
 *
 * Effect builders read the FLAT per-pad `effects` object (see core.defaultEffects).
 * Adding an effect = add a builder here + a registry entry in core. That's the seam.
 */
(function (root) {
  'use strict';

  var core = (root.SoundBoard && root.SoundBoard.core) || {};
  var clamp = core.clamp || function (v, lo, hi) { return Math.min(hi, Math.max(lo, Number(v) || lo)); };
  var num = core.num || function (v, d) { var n = Number(v); return isFinite(n) ? n : d; };

  var ctx = null;
  var master = null; // master GainNode — pads connect here
  var assets = {}; // shared nodes (reverb impulse)
  var voices = core.voiceTable(); // one current voice per pad; re-tap chokes (D25)
  var CHOKE_FADE = 0.008;   // seconds: fast enough to feel instant, slow enough not to click

  function AC() { return root.AudioContext || root.webkitAudioContext; }

  function ensure() {
    if (ctx) return ctx;
    var Ctor = AC();
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = 1;
    var comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.knee.value = 12;
    comp.ratio.value = 4;
    comp.attack.value = 0.003;
    comp.release.value = 0.25;
    master.connect(comp);
    comp.connect(ctx.destination);
    return ctx;
  }

  // Lazily synthesize a stereo reverb impulse (shared across all triggers).
  function reverbIR() {
    if (assets.reverb) return assets.reverb;
    var c = ensure();
    var samples = core.makeImpulseSamples({ seconds: 2.2, decay: 2.6, sampleRate: c.sampleRate });
    var buf = c.createBuffer(2, samples.length, c.sampleRate);
    for (var ch = 0; ch < 2; ch++) buf.copyToChannel(samples, ch);
    assets.reverb = buf;
    return buf;
  }


  // Each builder returns { input, output }. `e` is the flat pad.effects object.
  var BUILDERS = {
    gain: function (e) {
      var n = ctx.createGain();
      n.gain.value = clamp(num(e.gain, 1), 0, 2);
      return { input: n, output: n };
    },
    filter: function (e) {
      var n = ctx.createBiquadFilter();
      n.type = e.filterType || 'lowpass';
      n.frequency.value = clamp(num(e.filterFreq, 12000), 20, 20000);
      n.Q.value = clamp(num(e.filterQ, 1), 0.1, 20);
      return { input: n, output: n };
    },
    echo: function (e) {
      var time = clamp(num(e.echoTime, 0.25), 0.01, 2);
      var fb = clamp(num(e.echoFeedback, 0.35), 0, 0.95);
      var wet = clamp(num(e.echoWet, 0.25), 0, 1);
      var input = ctx.createGain();
      var dry = ctx.createGain();
      dry.gain.value = wet > 0 ? 1 - wet * 0.5 : 1;
      var delay = ctx.createDelay(2.0);
      delay.delayTime.value = time;
      var feedback = ctx.createGain();
      feedback.gain.value = fb;
      var wetGain = ctx.createGain();
      wetGain.gain.value = wet;
      var output = ctx.createGain();
      input.connect(dry); dry.connect(output);
      input.connect(delay); delay.connect(wetGain); wetGain.connect(output);
      delay.connect(feedback); feedback.connect(delay);
      return { input: input, output: output };
    },
    reverb: function (e) {
      var wet = clamp(num(e.reverbWet, 0.2), 0, 1);
      if (wet <= 0.0001) { var p = ctx.createGain(); return { input: p, output: p }; }
      var conv = ctx.createConvolver();
      conv.buffer = reverbIR();
      var input = ctx.createGain();
      var dry = ctx.createGain();
      dry.gain.value = 1;
      var wetGain = ctx.createGain();
      wetGain.gain.value = wet;
      var output = ctx.createGain();
      input.connect(dry); dry.connect(output);
      input.connect(conv); conv.connect(wetGain); wetGain.connect(output);
      return { input: input, output: output };
    },
    distortion: function (e) {
      var amount = clamp(num(e.distortion, 0), 0, 1);
      if (amount <= 0.0001) { var p = ctx.createGain(); return { input: p, output: p }; }
      var input = ctx.createGain();
      var shaper = ctx.createWaveShaper();
      shaper.curve = core.makeDistortionCurve(amount);
      shaper.oversample = '2x';
      var trim = ctx.createGain();
      trim.gain.value = 0.6;
      var output = ctx.createGain();
      input.connect(shaper); shaper.connect(trim); trim.connect(output);
      return { input: input, output: output };
    },
  };

  // e01s06 (D24): only wire the effects the pad has switched on. core.activeEffectIds
  // returns canonical order: always 'gain', then each toggled effect with its *On flag.
  // A brand-new or v1-migrated pad therefore plays source -> gain -> master only.
  function buildChain(e, out) {
    var head = ctx.createGain();
    var tail = head;
    var ids = core.activeEffectIds ? core.activeEffectIds(e) : ['gain'];
    ids.forEach(function (id) {
      var b = BUILDERS[id];
      if (!b) return;
      var built = b(e);
      tail.connect(built.input);
      tail = built.output;
    });
    tail.connect(out);
    return head;
  }

  // Decode a File/Blob into an AudioBuffer.
  function decode(blob) {
    var c = ensure();
    var p;
    if (blob && typeof blob.arrayBuffer === 'function') p = blob.arrayBuffer();
    else if (blob && blob instanceof ArrayBuffer) p = Promise.resolve(blob);
    else throw new Error('decode: not a decodable source');
    return p.then(function (buf) { return c.decodeAudioData(buf); });
  }

  // Play a pad now. Graph: source -> effect chain -> voiceGain -> master. Fading
  // voiceGain silences the voice including its echo/reverb tail.
  // Same pad re-tapped while sounding: the previous voice is choked (8 ms fade) and
  // the clip restarts from 0 — the radio-stutter "Co-Co-Come on down!". Other pads'
  // voices are never touched. opts.onEnded(handle, wasCurrent) fires once the voice
  // is fully gone (after its tail); wasCurrent is false for a choked voice.
  function play(buffer, pad, opts) {
    if (!buffer) return null;
    var c = ensure();
    if (c.state === 'suspended') c.resume();
    var e = (pad && pad.effects) || {};
    var src = c.createBufferSource();
    src.buffer = buffer;
    src.loop = !!(pad && pad.loop);
    src.playbackRate.value = clamp(num(e.playbackRate, 1), 0.05, 8);
    var voiceGain = c.createGain();
    voiceGain.connect(master);
    var head = buildChain(e, voiceGain);
    src.connect(head);
    var handle = {
      padId: (pad && pad.id) || '__anon',
      source: src, head: head, voiceGain: voiceGain,
      startedAt: c.currentTime, releasing: false,
      onEnded: opts && opts.onEnded,
    };
    var prev = voices.register(handle.padId, handle);
    if (prev) choke(prev);
    var tail = core.tailSeconds(e);
    src.onended = function () { release(handle, tail); }; // no-op if already choked (sooner deadline)
    src.start(c.currentTime);
    return handle;
  }

  // Fast stop with a short fade so there is no click.
  function choke(h) {
    var t = ctx.currentTime;
    var g = h.voiceGain.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(0, t + CHOKE_FADE);
    try { h.source.stop(t + CHOKE_FADE + 0.002); } catch (_) {}
    release(h, 0.05);
  }

  // Disconnect a voice once its tail has rung out. Calling it again only ever brings
  // the deadline forward: a choke during a long echo tail finishes in 50 ms, and a
  // choked voice's own late onended is ignored.
  function release(h, afterSeconds) {
    var ms = Math.max(0, afterSeconds) * 1000;
    var due = Date.now() + ms;
    if (h.releaseTimer) {
      if (due >= h.releaseDue) return;
      clearTimeout(h.releaseTimer);
    }
    h.releasing = true;
    h.releaseDue = due;
    h.releaseTimer = setTimeout(function () {
      try { h.source.disconnect(); } catch (_) {}
      try { h.head.disconnect(); } catch (_) {}
      try { h.voiceGain.disconnect(); } catch (_) {}
      var wasCurrent = voices.release(h);
      if (typeof h.onEnded === 'function') h.onEnded(h, wasCurrent);
    }, ms);
  }

  // Always fades, even a voice already releasing: STOP must also silence echo tails.
  function stop(handle) {
    if (handle) choke(handle);
  }
  function stopAll() {
    voices.forEach(stop);
  }
  function setMaster(g) {
    var c = ensure();
    master.gain.value = clamp(num(g, 1), 0, 2);
  }
  function activeCount() { return voices.size(); }
  function running() { return !!(ctx && (ctx.state === 'running')); }

  root.SoundBoard = root.SoundBoard || {};
  root.SoundBoard.engine = {
    ensure: ensure,
    decode: decode,
    play: play,
    stop: stop,
    stopAll: stopAll,
    setMaster: setMaster,
    activeCount: activeCount,
    running: running,
    _voices: voices,
  };
})(typeof self !== 'undefined' ? self : this);

---
story: e01s07
title: Re-tapping a pad restarts it; other pads are unaffected
owner: Claude
wave: 2
depends_on: [e01s01, e01s06]
files:
  - tools/soundboard/js/audio-engine.js (play, stop, stopAll, voice bookkeeping)
  - tools/soundboard/js/soundboard-core.js (pure voice-table helpers + tailSeconds)
  - tools/soundboard/js/ui-stage.js (trigger + live-state handling)
  - tools/soundboard/test/voices.test.js (new)
---

# s07 — Retrigger (choke) per pad

## Why

Today every tap makes a new `AudioBufferSourceNode`, and nothing stops the previous one.
Tapping a pad three times plays three overlapping copies, so the classic radio stutter
("Co-Co-Come on down!") is impossible. Wanted behaviour:

- **Same pad tapped again while it's playing → the old playback stops at once and the
  clip starts again from the beginning.** (Samplers call this "choke" or "mono retrigger".)
- **Different pads never affect each other.** Pad 1 keeps playing while pad 2 is tapped.

## Two v1 bugs fixed by this story

- **Stale live highlight:** `trigger()` stores the end callback on the *pad*
  (`pad._onended`), so each tap overwrites the last one. With retrigger, the first
  voice's `onended` would fire after the second voice starts and clear the "playing"
  highlight while sound is still coming out.
- **Cut-off tails:** `play()` disconnects the effect chain in `src.onended`, the moment
  the clip ends, which cuts off echo and reverb tails.

## Engine design

1. **One output gain per voice.** Chain: source → effect chain → **voiceGain** → master.
   Fading `voiceGain` silences the voice *including* its echo/reverb tail.
2. **Voice table:** `voicesByPad: Map<padId, handle>` (keep the `voices` Set for
   `activeCount`). A handle is `{ id, padId, source, head, voiceGain, ended: false }`.
3. **`play(buffer, pad, opts)`** with `opts = { onEnded(handle) }`:
   1. `ensure()` and resume the context (as today).
   2. If `voicesByPad.get(pad.id)` exists → **choke it**: `choke(old)`.
   3. Build the new source + chain + voiceGain, register it in both tables, and call
      `source.start(ctx.currentTime)`.
   4. Return the handle.
4. **`choke(h)`** (fast stop, no click):
   ```js
   var t = ctx.currentTime;
   h.voiceGain.gain.cancelScheduledValues(t);
   h.voiceGain.gain.setValueAtTime(h.voiceGain.gain.value, t);
   h.voiceGain.gain.linearRampToValueAtTime(0, t + 0.008);   // 8 ms fade
   try { h.source.stop(t + 0.01); } catch (_) {}
   release(h, 0.05);
   ```
5. **Natural end:** `source.onended` must **not** disconnect right away. It calls
   `release(h, tail)`, where `tail = core.tailSeconds(pad.effects)`:
   - echo on: `min(4, echoTime * ceil(log(0.001) / log(max(echoFeedback, 0.01))))`
   - reverb on: `2.4` (the impulse length plus a margin)
   - take the larger value, or `0` when both are off.
6. **`release(h, afterSeconds)`** is idempotent (guard with `h.ended`). After
   `afterSeconds` (`setTimeout`), it disconnects source/head/voiceGain, removes the
   handle from `voices`, removes it from `voicesByPad` **only if it is still the current
   voice for that pad**, and then calls `opts.onEnded(h, wasCurrent)`.
7. **`stopAll()`** chokes every voice. `stop(handle)` chokes one.
9. **Loop pads** follow the same rule: a re-tap restarts the loop from the start, and STOP
   ends it. (Decision D25. Tap-to-toggle loops were considered and left out, because they
   break the "a tap always plays" model kids learn.)

## Pure helpers (in `soundboard-core.js`, unit-tested)

- `tailSeconds(effects)` as defined above.
- `voiceTable()` → `{ register(padId, h) → previous|null, release(h) → wasCurrent,
  current(padId), size() }`. The engine uses this instead of a bare Map, so the
  choke/release rules can be tested without Web Audio.

## UI (`ui-stage.js` `trigger`)

- Call `engine.play(buf, pad, { onEnded: function (h, wasCurrent) { if (wasCurrent) clearLive(pad.id); } })`.
  In plain terms: clear the "playing" highlight only when the voice that ended is the
  pad's current voice; a choked older voice ending must not clear it.
- On retrigger, restart the press animation: remove the `is-live` class, force a reflow,
  then add it back, so every tap shows.
- Delete `pad._onended`. Nothing hangs off the pad object any more, so nothing
  temporary can leak into `serialize()`.

## Latency

Keep triggering on `pointerdown` (not `click`). Don't `await` anything between the pointer
event and `source.start`.

## Done when

- Tapping pad A three times quickly, about 150ms apart, sounds like "Co-Co-Come…": each tap
  restarts from 0 and there is only ever **one** voice for A.
- Pad A playing, then pad B tapped → A carries on to its end, untouched.
- Echo/reverb tails ring out after the clip ends, unless the pad is re-tapped or STOP is
  pressed.
- No clicks on retrigger.

## Verify

```bash
npm test
```

`test/voices.test.js` must cover:

- Registering twice for the same pad returns the first handle as `previous`.
- Releasing an old handle after a newer one was registered returns `wasCurrent: false` and
  leaves the current one alone.
- Two pads are independent.
- `tailSeconds` is 0 when both effects are off, and capped at 4 s.

Manual check: open the dev console. Tap one pad five times quickly →
`SoundBoard.engine._voices.size` must never be above 1 for that pad, plus at most a couple
of voices still fading out within 50ms. Then hold one long clip and tap others.

## Notes (as built, 2026-10-20)

- `release(h, after)` only ever brings a voice's deadline **forward**. Without this,
  STOP or a re-tap during a long echo tail silenced the audio but left the voice
  counted for up to 4 s. `stop()` always fades, so STOP silences tails too.
- `src.start(ctx.currentTime)` always plays from offset 0, so each re-tap restarts
  the clip.
- **Browser check** (headless Edge, an analyser spliced onto `ctx.destination`): 15/15
  passed. Three taps 150 ms apart gave 3 starts and 2 stops, with at most 1 voice
  counted; tapping B left A playing (no stop logged for A); the echo tail was audible
  after the clip ended (RMS 0.33); STOP brought the output to RMS 0 within 120 ms; a
  re-tap during a tail left 1 current voice; no page errors.
- `soundboard-core.js` is now 355 lines, over the ~300 guideline (it was already 309
  after s06). **s08 should move the geometry helpers to their own file** rather than add
  to core.


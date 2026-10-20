---
story: e01s10
title: Record a sound (up to 10 seconds) straight onto a pad
owner: Claude
wave: 4
depends_on: [e01s04, e01s07]
files:
  - tools/soundboard/js/recorder.js (new — mic capture, no DOM)
  - tools/soundboard/js/audio-dsp.js (new — pure: WAV encode, peaks)
  - tools/soundboard/js/ui-recorder.js (new — inline recorder panel)
  - tools/soundboard/js/ui-panel.js + ui-library.js (add the "● Record" entry points only)
  - tools/soundboard/index.html (script tags)
  - tools/soundboard/css/soundboard.css (/* ==== recorder ==== */ section only)
  - tools/soundboard/test/dsp.test.js (new)
---

# s10 — Record up to 10 s

## Why

In a classroom, the fastest way to make a pad is to record it: a word, a clap, a
classmate's voice. No file hunting, no uploads from another device.

## Flow

1. **Entry points:** a **"● Record"** button next to "Load sound" in the selected pad's
   Sound block, and another in the Library section header.
2. **Inline recorder panel:** this replaces the Sound block contents in place. **Not a
   modal.** It contains:
   - A big round red **Record** button (72px, white ● icon, ink outline).
   - A **countdown ring** around the button showing seconds left (10 → 0), with the
     digits in the middle.
   - A live **input level meter** (horizontal bar, green → yellow → red), fed from an
     `AnalyserNode` on the mic stream, updated with `requestAnimationFrame`.
   - **Cancel** (discard and close).
3. **Recording:** press Record → a 3-2-1 count-in (optional toggle, **on** by default for
   classrooms) → record. The button turns into a square **Stop**. Recording **auto-stops at
   exactly 10.0 s**.
4. **After stop:** the mic tracks stop at once (the browser's mic indicator goes off). The
   take is decoded to an `AudioBuffer` and handed to the trim editor (s11). **Until s11
   lands**, show the waveform, plus "▶ Play", "↺ Re-record" and **"Use recording"**.
5. **Use recording:**
   - Mix down to mono and encode **16-bit PCM WAV** at the context sample rate. At
     48 kHz, 10 s is about 960 KB, safely under the 2 MB upload cap.
   - Name it `Recording N.wav`, where N counts up within the session.
   - Wrap it in a `File` and send it through the **existing** `onFile` path, so a
     signed-in user uploads to R2 and a signed-out user keeps it local, with the same
     messages.
   - Assign it to the selected pad, if there is one.

## `recorder.js` → `window.SoundBoard.recorder`

```js
recorder.supported()            // -> boolean (mediaDevices + MediaRecorder + secure context)
recorder.start({ maxSeconds: 10, onLevel(rms), onTick(secondsLeft) })  // -> Promise<void>
recorder.stop()                 // -> Promise<AudioBuffer>   (also resolves on auto-stop)
recorder.cancel()
```

- `getUserMedia({ audio: { echoCancellation: false, noiseSuppression: true, autoGainControl: true } })`.
- Pick the MIME type with `MediaRecorder.isTypeSupported`, in this order:
  `audio/webm;codecs=opus`, `audio/mp4`, `audio/ogg;codecs=opus`, then the browser
  default. iPad Safari gives `audio/mp4`. The blob is always decoded with
  `engine.decode`, so the container format doesn't matter.
- Measure time with `AudioContext.currentTime`, not `setTimeout`, and stop at 10 s.
  Also trim the decoded buffer to at most 10.0 s, in case the encoder overshoots.
- Always release the stream (`track.stop()`) on stop, cancel, error and page hide.

## `audio-dsp.js` → `window.SoundBoard.dsp` + `module.exports` (pure, same dual-export as core)

- `toMono(channels: Float32Array[]) -> Float32Array`
- `encodeWav(samples: Float32Array, sampleRate) -> ArrayBuffer` (44-byte RIFF header,
  PCM 16-bit, mono, clamped to −1..1)
- `peaks(samples, buckets) -> { min: Float32Array, max: Float32Array }` (for drawing the
  waveform)

## Errors (shown inline in the recorder panel, in plain words)

| Case | Message |
|---|---|
| `!recorder.supported()` | "Recording isn't available in this browser. Try Safari, Chrome or Edge." |
| Insecure context | "Recording needs a secure (https) page." |
| `NotAllowedError` | "Microphone access was blocked. Allow the microphone for this site in your browser settings, then try again." |
| `NotFoundError` | "No microphone found." |
| Silent take (peak < −50 dBFS) | "That was very quiet. Check the mic and try again." (still allow Use) |

## Done when

- Record → speak → Stop gives a playable clip on the pad, both signed in (row appears in
  D1 `sounds`, object in R2) and signed out (local).
- It works on iPad Safari (`audio/mp4`) and desktop Chrome/Edge (`audio/webm`).
- Recording stops by itself at 10 s, and the uploaded file is under 2 MB.
- After a stop or cancel, the browser's mic indicator turns off.

## Verify

```bash
npm test
```

`test/dsp.test.js` checks the `encodeWav` header bytes (`RIFF`, `WAVE`, `fmt `, `data`,
sample rate, byte length = 44 + 2·n), clipping of ±1.5 to ±32767, `toMono` averaging, and
the shape of `peaks`.

Manual check on `localhost` (which counts as a secure context): record for 12 s and
confirm it stops at 10; check the size of the uploaded WAV in the network tab. Real-iPad
Safari testing has to happen after deploy (https). List it as **needs a real-device check** in the
hand-back if no device is available.

## Notes (as built, 2026-10-20)

- **API differs slightly from the plan above:** `recorder.open({ onLevel })` (asks for the
  mic; the meter runs) is separate from `recorder.record({ maxSeconds, onTick, onAutoStop })`,
  so the 3-2-1 count-in happens with the mic already open and the meter live.
  `stop()` → `Promise<AudioBuffer>`; `cancel()` releases everything.
- **Files:** `audio-dsp.js` (pure: `toMono`, `encodeWav`, `peaks`, `peakAbs`, `dbToGain`;
  6 unit tests), `recorder.js` (capture), `ui-recorder.js` (inline panel; **277 lines, so s11
  should put the trim editor in its own `ui-trim.js`**). Entry points: "● Record" in the
  Sound block (`ui-panel.js`) and the Library (`ui-library.js`).
- Cancel is available in every state: ready, count-in, recording and review.
- **Mic is never left open.** Three bugs were found and fixed while testing:
  1. A panel re-render mid-take made the meter callback cancel the session, and the next
     timer tick then dereferenced the null session.
  2. A count-in timer from a cancelled attempt could fire after the recorder was reopened
     and "start recording" without a mic. Fixed with a per-attempt `gen` guard.
  3. Closing the recorder while the browser was still asking for permission left the
     late-arriving stream running. `open()` is now voided by `cancel()`/a newer `open()`,
     and a superseded grant is stopped immediately.
- **Verified** with Edge's fake microphone on `wrangler pages dev` (`rec.mjs`): 28/28
  checks pass.
  - Inline (no dialog); count-in ~2.1 s; meter moves (peak 87); ring empties; stop leads to
    review with a drawn waveform; mic released.
  - ▶ Play previews; Use recording gives the pad `Recording 1.wav` (`audio/wav`, playable).
  - Library entry point; count-in off; **auto-stop at 10.0 s** (measured 10005 ms); the 10 s
    take is 956 KB, under 2 MB.
  - Re-render mid-take, Cancel during count-in, Cancel while recording, and cancel during a
    slow permission prompt all release the mic. A blocked mic shows the plain-words message.
  - Signed in: `POST /api/sounds` `audio/wav` → 200; the pad points at the server UUID; D1
    row `Recording 1.wav`, `audio/wav`, 144044 bytes. No page errors.
  - 46/46 unit tests; the s04/s07/s08/s09 suites still pass.
- **Needs a real-device check:** iPad Safari (`audio/mp4` capture) and a real microphone
  over https. Headless testing used Chromium's fake mic only.


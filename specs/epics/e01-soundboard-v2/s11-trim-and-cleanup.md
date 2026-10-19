---
story: e01s11
title: Trim and clean up a recording before using it
owner: Claude
wave: 4
depends_on: [e01s10]
files:
  - tools/soundboard/js/audio-dsp.js (add the pure edit operations)
  - tools/soundboard/js/ui-recorder.js (trim editor view)
  - tools/soundboard/css/soundboard.css (/* ==== recorder ==== */ section only)
  - tools/soundboard/test/dsp.test.js (extend)
---

# s11 — Trim and clean-up tools

## Why

Raw classroom recordings start with a gap, end with a fumble, and are often too quiet or
have desk rumble. A **small, fixed** set of tools fixes most of that. This is not a full
audio editor.

## The editor (inline, in the same panel s10 opened)

- **Waveform** on a `<canvas>`: full width, 120px tall, drawn from `dsp.peaks`, and redrawn
  on resize using `devicePixelRatio`.
- **Start and end handles:** two vertical bars, each with a 44px-wide touch target,
  dragged with Pointer Events. The area outside the selection is shaded. Dragging a handle
  past the other one is not allowed (minimum selection 50 ms).
- **▶ Play selection** with a moving playhead; press again to stop. Plays through
  `engine.play` with a temporary pad id `'__preview'`, so the s07 retrigger rules apply.
- **Tools** (chunky buttons, in one wrapping row):

| Tool | What it does | Pure function |
|---|---|---|
| **✂ Trim** | Keep only the selection | `crop(s, startIdx, endIdx)` |
| **Auto-trim** | Cut silence at both ends (threshold −40 dBFS, keep 30 ms before and after) and move the handles to match | `findSoundBounds(s, sr, { thresholdDb: -40, padMs: 30 }) -> {start, end}` |
| **Louder** (normalize) | Scale so the peak is −1 dBFS | `normalize(s, -1)` |
| **Fade in / Fade out** | Linear fade, length chosen by a small `Short · Medium · Long` toggle (10 / 60 / 250 ms) | `fade(s, sr, 'in'\|'out', ms)` |
| **Less rumble** | 2nd-order high-pass at 90 Hz (RBJ biquad, Q 0.707), applied in JS | `highpass(s, sr, 90)` |
| **↶ Undo** | Step back (keeps up to 10 states) | — (array of Float32Array) |
| **Reset** | Back to the original take | — |

- Every operation returns a **new** `Float32Array`; the original take is never modified.
  The operations run on the mono samples from `dsp.toMono`.
- Run **Auto-trim once automatically** when a take arrives. Teachers almost always want
  it, and Undo brings the original back.
- The bottom row is **"Use recording"** (encode with `dsp.encodeWav`, then the s10 save
  path), **"↺ Re-record"** and **Cancel**.
- **Stretch goal (only if time allows, as a separate commit):** a "✂ Trim" button on
  any pad that already has a sound, which opens the same editor on that buffer and saves
  the result as a **new** sound. The original stays in the library.

## Done when

- A take with 1 s of silence at the start comes out of Auto-trim with less than 50 ms of
  silence at the start.
- Louder brings a quiet take's peak to −1 dBFS ± 0.1 dB.
- Fades start/end at exactly 0, and Undo/Reset restore the previous/original samples
  exactly.
- All tools work by touch on an iPad-sized viewport (820×1180), with no page scroll while
  dragging the handles.

## Verify

```bash
npm test
```

Extend `test/dsp.test.js` with:

- `findSoundBounds` on silence + 440 Hz tone + silence → bounds within 30 ms ± 1 sample of
  the tone edges.
- `normalize` peak = 10^(−1/20) ± 1e-4.
- `fade('in')` first sample = 0 and the sample at `ms` = the original.
- `highpass` removes DC: mean of a constant 0.5 input after 0.5 s is < 0.01.
- `crop` length.

Manual check: record "Come on down!" with a pause before it → Auto-trim → Louder → Use →
tap the pad three times quickly, and you should hear the stutter from s07.

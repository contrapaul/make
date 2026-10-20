---
story: e01s11
title: Trim and clean up a recording before using it
owner: Claude
wave: 4
depends_on: [e01s10]
files:
  - tools/soundboard/js/audio-dsp.js (add the pure edit operations)
  - tools/soundboard/js/ui-trim.js (new — trim editor view; ui-recorder.js is already 277 lines, so it only hands the take over)
  - tools/soundboard/js/ui-recorder.js (call the trim editor from the review state only)
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

## Notes (as built, 2026-10-20)

- **Files:** `audio-dsp.js` gains `crop`, `findSoundBounds`, `normalize`, `fade` and
  `highpass` (RBJ biquad, 90 Hz, Q 0.707); 7 more unit tests. The new **`ui-trim.js`**
  (`SoundBoard.trimUI.mount(host, { samples, sampleRate, onUse, onRerecord, onCancel })`) is
  the editor. `ui-recorder.js`'s review step now just mounts it, which shrank that file from
  277 to 238 lines because its own waveform/preview code went.
- **"Use recording" saves the selection**, so what ▶ Play plays is what you get. Press
  ✂ Trim to make the selection permanent before more edits.
  `trimUI.selection()` returns those samples without closing (used by the tests).
- Louder, fades and Less rumble apply to the whole clip and keep the handles where they are.
  Trim and Auto-trim reset the handles to the new clip.
- Handles: Pointer Events + capture, 44px touch targets, `touch-action: none`. Arrow keys
  nudge 10 ms (100 ms with Shift). The two handles never cross and keep ≥ 50 ms selected.
- Undo keeps 10 steps; Reset itself can be undone.
- Auto-trim runs once on arrival and says so: "Silence trimmed automatically · ↶ Undo brings
  it back".
- **Stretch goal not done:** "✂ Trim" for an existing pad sound (it would save a new sound).
  `trimUI.mount` takes any mono samples, so this is a small follow-up when wanted.
- **Verified** in headless Edge (`trim.mjs`): 20/20 checks pass.
  - Synthetic take: auto-trim leaves 30 ms of leading silence and 1.06 s total. Undo
    restores the take sample-exactly. Louder peaks at −1.0000 dB. Fades end at exactly 0.
    Less rumble takes the DC mean to 8e-11. Reset works. Undo is capped at 10.
  - Real touch-drag on the handles selects 40–80% without scrolling. Play shows a playhead,
    which hides at the end. Trim gives exactly 1.0 s. The handles can't cross.
  - Real fake-mic take: the editor opens, Louder, then Use puts the edited clip on the pad.
    The mic is released and there are no errors.
  - 53/53 unit tests. The recorder suite was updated for the new review step.


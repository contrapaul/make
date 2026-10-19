---
story: e01s06
title: Pads start with no effects; each effect has an on/off switch
owner: Local AI
wave: 2
depends_on: [e01s01]
must_finish_before: [e01s07]   # both edit audio-engine.js
files:
  - tools/soundboard/js/soundboard-core.js (EFFECTS, defaultEffects, validateBoard, new activeEffectIds)
  - tools/soundboard/js/audio-engine.js (buildChain only)
  - tools/soundboard/js/ui-panel.js (effectsControls, sliderRow)
  - tools/soundboard/test/effects.test.js (new)
---

# s06 — No effects by default

## Why (root cause found in v1)

Every new pad gets `defaultEffects()`, which sets **echo mix 0.25** (`echoWet`), **reverb
mix 0.2** (`reverbWet`) and a 12 kHz low-pass filter. `buildChain()` in `audio-engine.js`
wires **every** effect in for every trigger, so all pads sound washed out from the start.
Pads should sound exactly like the clip until someone turns an effect on.

## What to change

1. **Per-effect on/off flags.** In `core.EFFECTS`, give `filter`, `echo`, `reverb` and
   `distortion` the property `toggle: true`. `gain` (Volume) and `pitch` (Pitch/Speed)
   have no toggle: they are always applied and are neutral at 1.0.
2. `defaultEffects()` adds `filterOn: false, echoOn: false, reverbOn: false,
   distortionOn: false`. Keep the existing slider defaults; they become the starting
   values **once the effect is switched on**. Exception: change the `distortion` default
   from `0` to `0.3`, so switching it on is audible.
3. Add a pure helper `core.activeEffectIds(effects)`. It returns the chain ids, in
   canonical order, that should be wired: always `'gain'`, plus each toggled effect whose
   flag is `true`. Export it.
4. `audio-engine.js` `buildChain(e)` iterates `core.activeEffectIds(e)` instead of the
   fixed `CHAIN_ORDER`. (Don't touch `play()`; s07 rewrites it.)
5. **Existing saved boards:** in `validateBoard`, a pad that has no `*On` flags gets them
   all set to `false`. Its slider values are kept, so turning an effect back on restores
   the old setting. This deliberately removes the reverb/echo every v1 pad got by mistake.
6. **Panel UI** (`effectsControls`):
   - Each toggled effect's block header gets a switch: `<button role="switch"
     aria-checked>` showing "On"/"Off", at least 44×28px, styled as a pill toggle.
   - When an effect is off, collapse its sliders and dim its label. When it is on, show
     the sliders.
   - Put a **"Reset effects"** button under the effects. It sets
     `pad.effects = core.defaultEffects()`, re-renders the panel and persists.
   - **Fix a v1 bug while here:** the filter-type `<select>` `change` handler never calls
     `persist()`. Add the call.
   - Every effect change calls `persist()`.

## Done when

- A new pad, or a pad from a v1 board, plays the raw clip: the only nodes are source →
  gain → master.
- Switching an effect on makes it audible right away on the next tap; switching it off
  removes it.

## Verify

```bash
npm test
```

`test/effects.test.js` must cover:

- `defaultEffects()` has all four `*On` flags set to `false`.
- `activeEffectIds(defaultEffects())` deep-equals `['gain']`.
- With `echoOn` and `reverbOn` on → `['gain','echo','reverb']`, in canonical order.
- `validateBoard` on a v1 pad (with `echoWet: 0.25` and no flags) → `echoOn === false`
  and `echoWet === 0.25`.

Manual check: load a clip and tap it, which should sound dry. Turn on Echo and you should
hear echo. Turn it off, then refresh, and it should still be off.

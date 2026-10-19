---
story: e01s01
title: Split ui.js into modules and add a Node test runner
owner: Claude
wave: 1
depends_on: []
files:
  - tools/soundboard/js/ui.js
  - tools/soundboard/js/ui-stage.js (new)
  - tools/soundboard/js/ui-panel.js (new)
  - tools/soundboard/js/ui-library.js (new — added during build, see Notes)
  - tools/soundboard/js/ui-account.js (new)
  - tools/soundboard/js/ui-dom.js (new)
  - tools/soundboard/index.html (script tags only)
  - tools/soundboard/test/core.test.js (new)
  - package.json (scripts only)
---

# s01 — Split `ui.js` and add a test runner

## Why

`js/ui.js` is 642 lines and holds the grid, the whole edit panel, the account form, boot
logic and playback. Almost every e01 story changes it, so agents working in parallel would
constantly collide. Splitting it first lets s03/s05/s06/s07/s08/s09 each own a file.
CONVENTIONS.md also wants files under ~300 lines and runnable tests.

## What to do

**This is a move-only refactor. Behaviour must not change.**

1. Create `js/ui-dom.js` → `window.SoundBoard.dom` with the shared helpers now at the top of
   `ui.js`: `$`, `make`, `hexToRgba`, `fmtVal`, `numSafe`, `hintBox`, `section`.
2. Create `js/ui-stage.js` → `window.SoundBoard.stage` with `renderStage`, `padNode`,
   `trigger`, the `livePads` set, and a `stopAll()` that clears live state.
3. Create `js/ui-panel.js` → `window.SoundBoard.panel` with `renderRack` and every section
   builder **except** the account one: board, boards list, selected pad, geometry, sound,
   effects, slider row, library, `onFile`, `assignToPad`, `padSoundAssign`, `hydrateSounds`.
4. Create `js/ui-account.js` → `window.SoundBoard.account` with `accountSection()` moved
   as-is. (s03 rewrites it into a header chip later.)
5. `js/ui.js` keeps: status LCD (`lcdMsg`, `lcdError`, `renderLCD`), `persist`, `render`,
   `paint`, `select`, `setMode`, `init`, and all `boot*` functions. It exposes
   `window.SoundBoard.ui = { init, setMode, render, paint, persist, select, lcdMsg, lcdError, getMode }`
   so the other modules call back through it instead of importing each other in circles.
6. **Style hook for s09:** at the end of `padNode`, add
   `if (root.SoundBoard.applyPadStyle) root.SoundBoard.applyPadStyle(b, pad);` so s09 can
   style pads without editing `ui-stage.js` (s08 owns that file). This is the only
   behaviour-neutral addition allowed in this story.
7. `index.html` load order: core → engine → api → model → ui-dom → ui-stage → ui-panel →
   ui-account → ui → shell.
8. Test runner: add `"test": "node --test 'tools/soundboard/test/*.test.js'"` to `package.json`
   `scripts`. **No new dependencies.** `soundboard-core.js` already exports through
   `module.exports`, so tests can `require('../js/soundboard-core.js')`.
9. Write `test/core.test.js` covering what exists today: `fits`, `findFreeCell`, `addPad`
   throwing on a full board, `movePad`/`resizePad` rejecting overlaps, `setLayout`
   clamping, `validateBoard` filling defaults from junk input, `makeDistortionCurve`
   length + monotonic, `makeImpulseSamples` with a fixed `rng`.

## Decision

Use Node's built-in `node --test` instead of vitest (BLUEPRINT D14 said vitest). Node 24 is
already installed and this adds zero dependencies, which follows the Token Economy rule in
CLAUDE.md. Recorded as BLUEPRINT D23.

## Done when

- Every new file is under ~300 lines; `ui.js` is under ~250.
- The page behaves exactly as before (same buttons, same LCD messages).
- `npm test` passes.

## Verify

```bash
npm test   # node --test 'tools/soundboard/test/*.test.js'
wc -l tools/soundboard/js/*.js
npx wrangler pages dev --port 8788
```

Manual smoke test at `http://localhost:8788/tools/soundboard/`, signed out: add a pad, load
a local file, assign it, play it, switch modes, refresh (the board comes back from
localStorage), press STOP. The browser console must show no errors.

## Notes (as built, 2026-10-19)

- **Extra module `ui-library.js`** (`window.SoundBoard.library`): library section, file
  load/upload (`onFile`, `isAudioFile`, size cap), `assignToPad`, `padSoundAssign`,
  `openFilePicker`, `hydrateSounds`. Without it `ui-panel.js` would have been about 360
  lines. Owner for later stories: **s10** (recording entry point in the Library header).
- Modules call each other through late-bound wrappers (`function render() { S.ui.render(); }`),
  so load order only matters for the top-level `S.stage.livePads` reference.
- **Test command:** `node --test` given a bare directory fails on Node 24, so the script is
  `node --test 'tools/soundboard/test/*.test.js'` (run it with `npm test`).
- **Proof that behaviour is unchanged:** a headless-Edge scenario ran against the old and new
  code (boot, add pad, load a WAV, press pad, toggle mode, STOP, relabel, reload). The two
  traces of LCD text, pad classes and panel sections were identical, with zero console
  errors. A signed-in run on `wrangler pages dev` (new board, upload, reload by `?board=`,
  sign out) also had zero errors.


# e01 — Soundboard v2 (classroom-friendly overhaul)

**Site:** `/tools/soundboard/` (live at make.contrapaul.com/tools/soundboard/)
**Status:** planned 2026-10-19 · nothing built yet
**Source of truth for decisions:** this file + `tools/soundboard/BLUEPRINT.md` §16 (Phase E)

## Why

The v1 board works, but it is built like a dark "hardware unit" for one adult user. The
real audiences are **primary-school music classrooms, media production, and live use at
classes and events**. That means: a bright, friendly, light UI; big rounded touch targets;
a layout that fits an iPad held either way; pads that behave like a real sampler; and a
way to make sounds without a file (recording).

## Requested changes → stories

| # | What the user asked for | Story | Owner |
|---|---|---|---|
| 0 | (enabler) split `ui.js` so several agents can work in parallel; add a test runner | [s01](s01-split-ui-and-test-harness.md) | Claude |
| 1 | Friendlier **light** theme: rounder buttons, brighter colours, thicker outlines | [s02](s02-light-friendly-theme.md) | Local AI |
| 2 | Account lives in the **header**, small and out of the way | [s03](s03-header-account-chip.md) | Local AI |
| 3 | Page must not waste space on iPad / tall windows | [s04](s04-viewport-fit-layout.md) | Claude |
| 4 | Rename modes to **"Edit soundboard"** / **"Save edits"** | [s05](s05-mode-rename-and-save.md) | Local AI |
| 5 | New pads start with **no effects** | [s06](s06-effects-off-by-default.md) | Local AI |
| 6 | Re-tapping a pad **restarts** it (stutter / "Co-Co-Come on down!"); other pads unaffected | [s07](s07-retrigger-voices.md) | Claude |
| 7 | **Drag and resize** pads by mouse or touch, snapping to the grid; edit mode shows the grid | [s08](s08-edit-grid-drag-resize.md) | Claude |
| 8 | Far more **font and colour** options, with **no pop-up** colour picker | [s09](s09-pad-style-fonts-colours.md) | Local AI |
| 9 | **Record** up to 10 s | [s10](s10-record-up-to-10s.md) | Claude |
| 10 | A small set of **trim and clean-up** tools for recordings | [s11](s11-trim-and-cleanup.md) | Claude |
| — | Bugs found while reviewing the v1 code | [s12](s12-v1-bug-fixes.md) | split (see story) |

## Owner split — why

- **Local AI** gets stories that are mostly CSS/markup or small, well-bounded JS changes
  with a clear before/after, where a wrong guess is cheap to see and fix.
- **Claude** gets stories with timing-sensitive audio code, pointer-gesture maths, DSP,
  and cross-module refactors, where subtle bugs (clicks, stuck voices, touch conflicts)
  are easy to introduce and hard to see.

Either agent may take any story; the owner column is a recommendation.

## Order of work (waves)

Stories in the same wave can run at the same time **because they touch different files**
(see the file-ownership table). Do not start a wave until the one before it is merged.

| Wave | Stories | Notes |
|---|---|---|
| 1 | s01 (Claude) ∥ s02 (Local AI) | s01 touches only JS; s02 touches only CSS + `index.html` `<head>` + `fonts/` |
| 2 | Local AI: **s06 first**, then s05, then s03 · Claude: s04, then s07 once s06 is merged | s06 and s07 both edit `audio-engine.js`; s04 owns the layout CSS section, s03 only the `account` section |
| 3 | s09 (Local AI) ∥ s08 (Claude) | s08 owns `ui-stage.js`; s09 owns `ui-style.js` |
| 4 | s10 → s11 (Claude) ∥ s12 local-AI items | s11 builds on s10's inline recorder panel |

## File ownership (after s01)

Only the owning story edits a file. If you need a change in a file you don't own, write it
down in your story's "Notes for other stories" and leave the change to the owning story.

| File | Owner(s) | Contents |
|---|---|---|
| `js/soundboard-core.js` | s06, s08, s09 — **one at a time, never in parallel** | pure board/effect/geometry/colour logic |
| `js/audio-dsp.js` (new) | s10, s11 | pure DSP: WAV encode, trim, normalise, fade, high-pass |
| `js/audio-engine.js` | s06 (chain skip), s07 (voices) — s06 first | Web Audio graph |
| `js/board-model.js` | s12-B1 | state + persistence |
| `js/ui.js` | s01 creates, then s05 | init, boot, `setMode`, render orchestration |
| `js/ui-stage.js` (new) | s07 (trigger hookup), s08 | pad grid render + pointer handling |
| `js/ui-panel.js` (new) | s06 (effect toggles), s08 (grid steppers), s09 (swap colour block) | edit panel: board, boards list, pad, geometry, sound, effects |
| `js/ui-library.js` (new) | s10 (Record entry point) | library list, file load/upload, assign, hydrate |
| `js/ui-sheet.js` (new, s04) | s04 | edit-panel bottom sheet (peek/half/full) |
| `js/ui-dom.js` (new) | s01 only (add helpers sparingly) | `$`, `make`, `section`, `hintBox`, `fmtVal`, … |
| `js/ui-style.js` (new) | s09 | inline colour/font controls |
| `js/ui-account.js` (new) | s03 | header account chip + popover |
| `js/recorder.js`, `js/ui-recorder.js` (new) | s10, s11 | mic capture + recorder/trim panel |
| `css/soundboard.css` | s02 rewrites; then each story edits **only its own marked section** | see s02 for section markers |
| `index.html` | s02 (head/fonts), s03 (header slot), s04 (layout wrappers), s10 (script tags) | |
| `test/*.test.js` (new) | each story adds its own test file | `node --test` |

## Rules for every story (both agents)

1. Read this README, your story file, and `CONVENTIONS.md` first.
2. Touch only the files your story lists. No new npm dependencies.
3. Keep the existing code style: browser JS is ES5-style IIFEs that hang off
   `window.SoundBoard.*`; no bundler, no build step, no frameworks.
4. User text goes in with `textContent`, never `innerHTML`.
5. Pure logic (maths, data shaping) goes in `soundboard-core.js` or `audio-dsp.js` so it
   can be unit-tested in Node; DOM/Web Audio code stays in the other files.
6. Run the story's **Verify** steps and paste the output (or screenshot paths) into the PR
   or hand-back message. "Should work" is not done.
7. Commits: Conventional Commits, scope `soundboard`, e.g.
   `feat(soundboard): restart pad on re-tap (e01s07)`.
8. Don't touch `functions/`, `wrangler.toml`, or `db/` — no story here needs server
   changes.

## Shared verification setup

- **Run locally:** `npx wrangler pages dev --port 8788` from the repo root, then open
  `http://localhost:8788/tools/soundboard/`.
- **Unit tests (after s01):** `npm test` (= `node --test 'tools/soundboard/test/*.test.js'`)
- **Screens to check** (any story that changes layout or looks):
  phone 390×844, iPad portrait 820×1180, iPad landscape 1180×820, desktop 1440×900.
  Headless Edge over CDP works for screenshots and touch input on this machine (the
  in-app browser pane is hidden).
- **Sample audio:** any short mp3/wav under 2 MB. For s07, use a spoken clip that
  starts with a hard consonant ("Come on down!") so stutter is easy to hear.

## Out of scope for e01

- Server changes.
- Real-time collaboration, MIDI, sequencing, recordings longer than 10 s.
- Baking effects into files (effects stay live and non-destructive, D3).

## Handing a story to an agent

Paste this (fill in the story id) as the whole prompt. It works the same for the local
model and for Claude Code:

> Implement story **e01sNN** of the soundboard. Read, in order:
> `specs/epics/e01-soundboard-v2/README.md`, `specs/epics/e01-soundboard-v2/sNN-*.md`,
> `CONVENTIONS.md`, then the files the story lists. Edit only those files. When finished,
> run every command under **Verify**, set `e01sNN: review` in `specs/execution-status.yaml`,
> and reply with: what changed, the verify output, screenshots taken, and anything you
> could not verify. Do not commit unless asked.

When a story is accepted, set it to `done` in `specs/execution-status.yaml` and deploy by
pushing to `main` (Cloudflare Pages builds automatically).


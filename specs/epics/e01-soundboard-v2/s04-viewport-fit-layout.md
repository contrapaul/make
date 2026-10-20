---
story: e01s04
title: Layout that fits the screen on iPad, phone and desktop
owner: Claude
wave: 2
depends_on: [e01s01, e01s02]
files:
  - tools/soundboard/index.html (layout wrappers)
  - tools/soundboard/css/soundboard.css (/* ==== header ==== */, /* ==== layout ==== */, /* ==== stage ==== */ sections)
  - tools/soundboard/js/ui.js (panel open/close state only)
---

# s04 — Layout that fits the screen

## Why

At 940px wide and below, the 340px side panel drops **below** the stage, and the stage
switches to `aspect-ratio: auto; min-height: 320px`. On an iPad in portrait, or in any
window taller than it is wide, the page becomes a long scroll and the pads end up a small
part of it. A soundboard has to show **every pad without scrolling**.

## Layout spec

- **App shell:** `#sb-app` is a full-height column (`height: 100dvh`, with `100vh` as the
  fallback): header → workspace → status. **The page never scrolls in play mode.**
- **Header:** one row, at most 64px tall (56px below 600px), never wraps. Left: ← tools
  link (icon only below 600px) and the board name (ellipsis-truncated). Right: STOP, mode
  button, account chip (s03). Below 400px, STOP shows as an icon (■) with
  `aria-label="Stop all"`.
- **Workspace:** fills the remaining height. Inside it:
  - **Stage wrapper** `.sb-stage-wrap`, with `container-type: size`, takes all the space
    the panel doesn't use.
  - **Stage** (pad grid), centred in the wrapper and as large as possible while keeping
    square cells:
    ```css
    .sb-stage {
      --cell-ratio: calc(var(--cols) / var(--rows));
      width:  min(100cqw, 100cqh * var(--cell-ratio));
      height: min(100cqh, 100cqw / var(--cell-ratio));
    }
    ```
    Delete the old `aspect-ratio`, `min-height` and 940px media-query overrides.
    Gap = `clamp(6px, 1.2cqmin, 14px)`.
- **Edit panel** (`#sb-rack`, edit mode only; play mode hides it as it does today):
  - **Landscape** (`@media (min-aspect-ratio: 1/1) and (min-width: 900px)`): a 360px column
    on the right that scrolls internally (`overflow-y: auto`). The stage shrinks to make
    room.
  - **Portrait or narrow** (anything else): a **bottom sheet** inside the workspace,
    full width, with a grab bar at the top and three heights:
    `peek` (64px: grab bar + selected pad name), `half` (45% of workspace, default), and
    `full` (85%). Tapping the grab bar cycles peek → half → full → peek, and dragging it
    snaps to the nearest height. The stage always sits **above** the sheet (no overlap),
    so pads stay tappable and draggable for s08.
  - Store the sheet height on `#sb-app` as `data-sheet="peek|half|full"` and remember it in
    `localStorage` (inside try/catch).
- **Status line:** at most 32px, in the bottom row of the shell. Hidden in play mode unless
  an error is showing (errors still need to be seen).
- **Safe areas:** pad the shell with `env(safe-area-inset-*)` for iPad/iPhone home bars.
  Add `viewport-fit=cover` to the viewport meta.

## Done when (hard requirements)

At each size below, **play mode** shows every pad of the default 9×6 grid with no
scrolling, and the header is no taller than stated:

| Viewport | Header max | Stage must be at least |
|---|---|---|
| 390×844 phone portrait | 56px | 358px wide |
| 820×1180 iPad portrait | 64px | 780px wide |
| 1180×820 iPad landscape | 64px | 700px tall |
| 1440×900 desktop | 64px | 780px tall |

In **edit mode**, the stage stays visible and usable at every size (the sheet sits at
`half` on portrait).

## Verify

`npx wrangler pages dev --port 8788`. Take headless Edge screenshots at the four sizes
(play + edit). At each size, run this in the console:
`document.scrollingElement.scrollHeight <= innerHeight`. It must be `true` in play mode.
Report `#sb-stage` `getBoundingClientRect()` for each size against the table.

## Notes (as built, 2026-10-20)

- New wrappers: `.sb-stage-wrap` (`container-type: size`) around `#sb-stage`, and an
  `.sb-sheet` card around `#sb-rack` with a grab button (`#sb-grab`). The panel card
  styling moved from `.sb-rack` to `.sb-sheet`, and `#sb-rack` is now just the scroller.
- Sheet logic lives in a new **`js/ui-sheet.js`** (`SoundBoard.sheet`), not `ui.js`, to keep
  `ui.js` under 250 lines. The state is stored as `data-sheet` on `#sb-app` and in
  `localStorage['soundboard:sheet']`.
- The header shows the board name (`#sb-title`, kept current by `ui.renderChrome()`). Below
  600px the back link, the "Soundboard" wordmark and the extra word in the mode label
  ("soundboard"/"edits") hide via `.sb-wide`. Below 400px, STOP shows as ■ and the
  power LED hides.
- **Verified** in headless Edge (`layout.mjs`): 27/27 checks pass. Header is 52px on
  phone and 60px elsewhere. Stage measures 358w (phone), 788w (iPad portrait),
  724h (iPad landscape) and 804h (desktop). No page scroll and every pad on screen in play
  mode at all four sizes. Sheet taps cycle half → full → peek; dragging down snaps to
  peek; the state is remembered across reloads. The s07 retrigger checks and the
  mode/save flow still pass.
- On a phone a 9×6 grid gives ~34px cells. That follows from the grid size, and s08's
  Columns/Rows steppers address it.


---
story: e01s08
title: Visible edit grid; drag and resize pads by mouse or touch, snapping to cells
owner: Claude
wave: 3
depends_on: [e01s04, e01s07]
files:
  - tools/soundboard/js/ui-stage.js
  - tools/soundboard/js/board-geometry.js (new — pure geometry helpers; core is already over 300 lines)
  - tools/soundboard/js/ui-panel.js (remove X/Y/W/H inputs; add grid-size steppers)
  - tools/soundboard/css/soundboard.css (/* ==== edit-grid ==== */ section only)
  - tools/soundboard/test/geometry.test.js (new)
---

# s08 — Edit grid, drag and resize

## Why

In v1 you place and size pads by typing X/Y/W/H numbers into the panel. That's slow, it
needs the panel open (which is a problem on iPad), and children can't use it. The grid is
also invisible, so you can't see where pads can go.

## Behaviour

**Play mode (no change):** a tap fires the pad. No drag. `touch-action: manipulation` so
several fingers can play at once.

**Edit mode:**

1. **Visible grid.** Draw one `.sb-cell` per grid cell behind the pads (same CSS grid
   lines). Each cell gets a 2px dashed `--grid-line` outline and `--r-sm` corners. Pads sit
   on top. The stage gets the class `is-editing` and `touch-action: none` (so drags don't
   scroll the page).
2. **Empty cell:** shows a faint "+" on hover/focus. **Tapping an empty cell adds a 1×1
   pad there** and selects it.
3. **Tap a pad = select it, no sound.** (In edit mode, a tap that might start a drag must
   not fire audio.) The panel gets a **▶ Preview** button for the selected pad.
4. **Selection frame.** The selected pad shows a 4px solid `--accent` frame with
   **8 handles**: 4 corners + 4 edge midpoints. Handles are drawn as 16px white circles
   with a 3px ink outline, and each has a **44×44px** invisible hit area (`::before`).
5. **Move:** press on the selected pad's body and drag more than 6px → move mode. A ghost
   outline follows the pointer, **snapped to whole cells**: it moves one cell each time
   the pointer passes the midpoint of the next cell.
6. **Resize:** drag a handle → the matching edge(s) move, snapped to cell boundaries.
   Dragging a left or top edge changes `x`/`y` as well as `w`/`h`. The minimum size is 1×1.
   The pad can't be dragged past the grid bounds; it stops at the edge.
7. **Validity while dragging:** the ghost is green (`--ok`) where the rect fits
   (`core.fits` ignoring the pad itself), and red (`--danger`) with a 🚫 cursor where it
   doesn't. **On release:** valid → commit through `model.movePad` / `model.resizePad`,
   re-render, `persist()`; invalid → snap back with a short shake (skip the shake under
   `prefers-reduced-motion`). No swapping or pushing other pads in v1 (D26).
8. **A drag on an unselected pad** selects it *and* starts a move in the same gesture, so
   one press-and-drag works.
9. **Keyboard** (selected pad focused): arrow keys move by one cell, Shift+arrow resizes
   from the bottom-right, Delete/Backspace asks to delete it, Escape deselects.
10. **Grid size:** the Board section in the panel gets **Columns** and **Rows** steppers
    (− / value / +, range 3–12, using `core.setLayout`). Delete the X/Y/W/H number inputs
    (`geoControls`). Size is now set by dragging and by the keyboard.
11. **Pointer handling:** use Pointer Events only (`pointerdown/move/up/cancel`) with
    `setPointerCapture`. This covers mouse, pen and touch. Ignore second pointers during a
    drag. `pointercancel` reverts the drag.

## Pure geometry (in `soundboard-core.js`, unit-tested)

```js
// metrics = { left, top, width, height, cols, rows, gap, pad }  (stage content box, px)
cellFromPoint(px, py, metrics)            -> { x, y }   // clamped to the grid
dragRect(start, edge, dCols, dRows, layout) -> { x, y, w, h }
//   start = pad rect; edge in ['move','n','s','e','w','ne','nw','se','sw'];
//   result always clamped to bounds and min 1x1
deltaCells(dxPx, dyPx, metrics)           -> { dCols, dRows } // rounds at half-cell
```

The UI reads `metrics` from `stage.getBoundingClientRect()` and the computed gap/padding
when a drag starts.

## Done when

- With a mouse **and** with touch emulation (or a real iPad), you can move a pad across the
  grid, resize it from each of the 8 handles, and every result lands exactly on cells.
- An overlapping drop snaps back, and the board is unchanged after a refresh.
- Play mode still fires multi-touch with no drag behaviour.

## Verify

```bash
npm test
```

`test/geometry.test.js` must cover: `cellFromPoint` at cell centres, gaps and outside the
stage; `deltaCells` rounding at exactly half a cell; `dragRect` for each edge, including
clamping at the grid edge and the 1×1 minimum.

Manual check in headless Edge with touch emulation at 820×1180: drag a 1×1 pad from (0,0)
to (4,3); resize it with the `se` handle to 3×2; try to drop it onto another pad and see it
revert. Screenshot the edit grid with a pad selected.

## Notes (as built, 2026-10-20)

- **Files:** `board-geometry.js` (pure: `cellFromPoint`, `deltaCells`, `dragRect`,
  `sameRect`, `setPadRect`, `layoutFits`; Node-testable), `ui-grid-edit.js` (cells, frame,
  ghost, pointer and keyboard gestures), and small hooks in `ui-stage.js`. `fits`, `padAt`
  and `findFreeCell` stay in core, because `addPad`/`movePad` use them. Moving them was
  churn with no gain.
- **`ui-boards.js`** (new): the server boards list moved out of `ui-panel.js`, which would
  otherwise have been 329 lines. s12-B1 works there.
- Gestures use **window-level** pointer listeners, not pointer capture. Selecting a pad
  re-renders the stage and replaces the node the press started on. A new primary pointer
  cancels a stale gesture, for example when the mouse is released outside the window.
- Combined left/top resizes go through `setPadRect`, which checks the whole new rect in one
  step. Calling `movePad` then `resizePad` could fail half-way.
- The grid-size steppers **refuse** to shrink past a pad ("Move or shrink the pads in the
  last column first") instead of letting `core.setLayout` pull pads on top of each other.
- Extras done here: pads now fill with the **full-strength** colour (`--pad-color`), so the
  edit grid no longer shows through them (s02 left this note for s08). The selection ring
  only shows in edit mode. With a pad selected, the panel shows that pad's section first
  (on a phone the sheet only shows the top).
- **Verified** with real CDP mouse and touch input (`drag.mjs`, 22/22): 54 cells; click
  selects with 8 handles and no sound; mouse move to (4,3); `se` resize to 3×2; an
  overlapping drop reverts with shake + error; touch `w`-handle resize; touch body move; no
  page scroll; tap an empty cell to add; arrow and Shift+arrow keys; column shrink allowed,
  then refused; rows + redraws; play mode has no grid and fires two pads with two fingers;
  layout survives reload; no errors. 33/33 unit tests. The s04 layout, s07 retrigger and
  s05 flow suites still pass.


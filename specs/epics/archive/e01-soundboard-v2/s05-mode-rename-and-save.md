---
story: e01s05
title: Rename modes to "Edit soundboard" / "Save edits"
owner: Local AI
wave: 2
depends_on: [e01s01]
files:
  - tools/soundboard/js/ui.js (setMode, boot*, LCD strings)
  - tools/soundboard/js/ui-panel.js (hint strings only)
  - tools/soundboard/index.html (initial button text)
---

# s05 — Clearer mode names

## Why

"PLAY MODE" / "EDIT MODE" toggle labels are confusing: it is unclear whether the label
shows where you are or where you'll go. The button should say **what pressing it does**.

## What to change

1. **Single mode button** (`#sb-mode`), whose label is the action:
   - In play mode: **"✎ Edit soundboard"** (secondary button style).
   - In edit mode: **"✓ Save edits"** (primary button style; add/remove an
     `sb-btn--primary` class).
   - Drop `aria-pressed`. Set `aria-label` to the visible text.
2. **"Save edits" really saves.** On click:
   - Cancel the pending debounce timer in `persist()`, then `await model.save()`.
   - While saving, show the label "Saving…" and disable the button.
   - On success, switch to play mode and show "Saved" in the status line (for a signed-out
     user, show "Saved on this device · sign in to keep it").
   - On failure, **stay in edit mode** and show the error. Don't lose the user's edits.
   - Keep the existing 150ms autosave while editing (it protects work if a tab closes).
     The button is the explicit "I'm done".
3. **Starting mode on load:**
   - A public/read-only board → play mode, and the mode button is **hidden** (not just
     disabled).
   - The board has at least one pad with a sound → **play** mode.
   - Otherwise (new or empty board) → **edit** mode.
   (Today it always boots into edit.)
4. **Strings:** replace every user-facing "PLAY MODE", "EDIT MODE", "Switch to EDIT" and
   "re-attach it in EDIT" with wording based on the new names, e.g.
   "Tap ✎ Edit soundboard to change pads" and "re-attach it in Edit soundboard".
   Keep the internal `mode` values `'play'`/`'edit'` unchanged.
5. **Keyboard:** Escape in edit mode does **not** save; Ctrl/⌘+S in edit mode acts like
   "Save edits" (`preventDefault` the browser save dialog).

## Done when

- `grep -rn "PLAY MODE\|EDIT MODE" tools/soundboard/` returns nothing.
- A failed save (stop the dev server, then press Save edits while signed in) leaves you in
  edit mode with an error showing.

## Verify

`npx wrangler pages dev --port 8788`. Check: a fresh empty board opens in edit mode → add
a pad with a sound → Save edits → you're in play mode with "Saved" → refresh → it opens in
play mode. Then open a public board link and confirm the mode button is gone.

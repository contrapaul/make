---
story: e01s12
title: v1 bugs found during the e01 review
owner: split per item
wave: B1/B2 any time after s01
depends_on: [e01s01]
---

# s12 — v1 bug fixes

Found by reading the v1 code on 2026-10-19. Each item is one commit:
`fix(soundboard): … (e01s12-Bn)`. All are logged in `specs/bugs/registry.yaml`.

## B1 — Signed-in users never open their saved board (Claude) — FIXED

**Where:** `ui.js` `bootCloud()`. With no `?board=` in the URL, it calls
`model.loadFromStorage()` and leaves `serverId = null`. A signed-in user who opens
`/tools/soundboard/` therefore gets the **localStorage** board, and edits keep saving to
localStorage, not the server, until they press "+ New board" or load one from the list.

**Fix (in `board-model.js` + `ui.js` boot only):**
1. Signed in, no `?board=` → `listBoards()`. If any exist, `loadBoard(boards[0].id)` (the
   most recently updated) and put `?board=<id>` in the URL with `history.replaceState`.
2. No server boards → `createBoard()`. If the localStorage board has at least one pad,
   copy its layout and pads into the new server board once and save. Sounds that are only
   local (`s_…` ids) become pads that need re-attaching. Then `clearStorage()`.
3. Loading or switching boards also updates `?board=`.

**Verify:** sign in on a fresh profile, make pads, refresh → the same board comes back
from the server (network: `GET /api/soundboards/<id>`), and `localStorage['soundboard:v1']`
is gone.

**Done 2026-10-20 (as built).** There is one deliberate change from the plan above: local
work is moved into a **new** server board even when the user already has boards. It is
never merged into, or allowed to overwrite, an existing board, so nothing is lost.

- `board-model.js`:
  - `hasLocalWork()` compares the saved local board with the untouched default board,
    ignoring pad ids, so a board that was only auto-saved is not imported.
  - `importLocal()`: clips still decoded in memory are re-uploaded as mono WAV (≤ 2 MB);
    others become "re-attach" pads. It then creates a new board, saves it to the server and
    clears the local copy.
  - `openLatestOrNew()` opens `listBoards()[0]` (the most recently updated board) or
    creates one.
- `ui.js` `bootCloud()` uses these when there's no `?board=`, and `ui.setBoardParam(id)`
  keeps `?board=` in step. It is called on boot, New board, Load, and sign-out (which
  removes the parameter so the account's board isn't reopened signed out).
- **Verified** on `wrangler pages dev` (`b1.mjs`): 15/15 checks pass.
  - A fresh account gets a new server board plus `?board=`, the local copy is cleared,
    edits `PUT` to the server, and a refresh reopens the same board.
  - With several boards, the most recent opens. Load and New board update the URL.
  - Sign-out clears `?board=` with no error.
  - Signing in with local work in the same session imports it into a new board ("Class
    3B"); its clip is uploaded (server UUID) and still plays, and the board survives a
    refresh.
  - Local work whose clip is gone after a refresh is imported with "1 sound to re-attach".
  - An untouched default board is not imported. No page errors.

## B2 — Filter type change isn't saved — FIXED in s06 (c7c6e84)

**Where:** `effectsControls` in `ui-panel.js`: the `<select>` `change` handler sets
`pad.effects[...]` but never calls `persist()`. **This is fixed inside s06** (same lines).
If s06 is already merged, close B2 as done.

## B3 — Echo/reverb tails cut off; stale "playing" highlight — FIXED in s07 (8db20ab)

**Fixed inside s07** (`onended` disconnects immediately; `pad._onended` gets overwritten).
Nothing extra to do. Close it when s07 merges.

## B4 — Shared/public board links don't load — FIXED (d453ab5)

The client calls `GET /api/public/soundboards/<id>`. That route was missing when this plan
was first drafted. `functions/api/public/soundboards/[id].ts` was added in commit `d453ab5`
("Soundboard polish pass"), so this is resolved. Remaining check: open a public board's
share link signed out on the live site and play it.

## B5 — Blueprint drift (done in this planning pass)

The blueprint said `wrangler d1 migrations apply` (the repo actually uses
`d1 execute --file`). Corrected in `BLUEPRINT.md`.

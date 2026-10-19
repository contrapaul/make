---
story: e01s12
title: v1 bugs found during the e01 review
owner: split per item
wave: B1/B2 any time after s01; B4 is its own task
depends_on: [e01s01]
---

# s12 — v1 bug fixes

Found by reading the v1 code on 2026-10-19. Each item is one commit:
`fix(soundboard): … (e01s12-Bn)`. All are logged in `specs/bugs/registry.yaml`.

## B1 — Signed-in users never open their saved board (Claude)

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

## B2 — Filter type change isn't saved (Local AI)

**Where:** `effectsControls` in `ui-panel.js`: the `<select>` `change` handler sets
`pad.effects[...]` but never calls `persist()`. **This is fixed inside s06** (same lines).
If s06 is already merged, close B2 as done.

## B3 — Echo/reverb tails cut off; stale "playing" highlight (Claude)

**Fixed inside s07** (`onended` disconnects immediately; `pad._onended` gets overwritten).
Nothing extra to do. Close it when s07 merges.

## B4 — Shared/public board links don't load (separate task)

**Where:** the client calls `GET /api/public/soundboards/<id>` (`api.js`
`loadPublicBoard`), but **that route doesn't exist**. Only `functions/api/public/teams`
does. BLUEPRINT D20 describes it as built, but it was never written. A signed-out visitor
opening a share link always falls back to a local board with "Board not found or not
public".

**Fix:** this is a server change, tracked as its own Claude Code task ("Soundboard:
public read route for shared boards", already proposed). It is independent of e01's UI
work and can land any time.

## B5 — Blueprint drift (done in this planning pass)

The blueprint said `wrangler d1 migrations apply` (the repo actually uses
`d1 execute --file`) and claimed D20 was built. Corrected in `BLUEPRINT.md`.

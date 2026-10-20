---
story: e01s03
title: Account moves into the header as a small chip
owner: Claude (reassigned 2026-10-20)
wave: 2
depends_on: [e01s01, e01s02]
files:
  - tools/soundboard/js/ui-account.js
  - tools/soundboard/js/ui-panel.js (remove the account section call + reword hints only)
  - tools/soundboard/index.html (add the header slot)
  - tools/soundboard/css/soundboard.css (/* ==== account ==== */ section only)
---

# s03 — Header account chip

## Why

Today the sign-in form is the first block of the side panel. On iPad, or in any window
taller than it is wide, the panel drops below the grid and the account form takes up a
large part of the screen. Account is a rare action, so it should be one small control in
the header.

## What to build

1. **Header slot:** in `index.html`, add `<div id="sb-account" class="sb-account"></div>` as
   the last item in `.sb-top__right`, after the mode button.
2. **Signed out:** the slot shows one secondary pill button, **"Sign in"**.
3. **Signed in:** the slot shows a chip: a 32px circle with the user's initial (first letter
   of the username, upper-cased, on `--accent`) and the username next to it. Below 600px
   viewport width, show only the circle.
4. **Popover** (opens when the button or chip is clicked):
   - A small card anchored under the chip, right-aligned, `width: min(320px, 100vw - 32px)`,
     with `position: absolute` inside a `position: relative` `.sb-account`. **Not a modal:**
     no backdrop, no page dimming, no focus trap.
   - Closes on: Escape, a click or tap anywhere outside it, clicking the chip again, and
     after a successful sign-in or sign-out.
   - Signed out it holds: Email, Password, a **Sign in** button, inline error text (not the
     LCD), and the link "New here? Create an account" → `/bloodbowl/account/` (the site's
     existing sign-up page; same login everywhere).
   - Signed in it holds: "Signed in as **name**", "Boards save to your account", and a
     **Sign out** button.
   - Enter in the password field submits.
   - Only one popover at a time; render it on open and remove it on close.
5. **Accessibility:** the trigger has `aria-haspopup="dialog"` and `aria-expanded`; the
   popover has `role="dialog"` and `aria-label="Account"`. Focus the email field on open,
   and return focus to the trigger on close.
6. **Remove** `accountSection()` from the panel (`renderRack` in `ui-panel.js`). Reword any
   hint that says "Sign in above" to "Sign in (top right)".
7. `ui-account.js` exports `window.SoundBoard.account = { render() }`. `ui.js` calls
   `account.render()` from `render()`/`paint()` and on `sb:auth-changed`.

Keep the existing `api.login` / `api.logout` calls and their success behaviour
(`model.clearBuffers(); model.reset();` on sign-out, plus the LCD message).

## Done when

- Header height does not change between signed-in and signed-out states.
- At 820×1180 and 390×844 the account takes up no vertical space outside the header.
- Sign in, sign out and a wrong-password error all work from the popover.

## Verify

`npx wrangler pages dev --port 8788`. For a signed-in test, use a test user you create in
the **local** D1 only. Screenshots at 390×844 and 820×1180: signed out (popover closed),
signed out (popover open), signed in (closed). Then check that Escape, an outside tap and
a successful sign-in each close the popover.

## Notes (as built, 2026-10-20 — done by Claude at the user's request)

- `ui-account.js` now exports `{ render, close }`. `ui.renderChrome()` calls
  `account.render()`, which rebuilds the chip **only when the signed-in user changes**, so an
  open popover survives the app's frequent re-renders.
- Sign-in is a real `<form>`: Enter submits, errors show inline (`.sb-popover__err`), and the
  `email` / `current-password` autocomplete hints let password managers fill it.
- Below 600px the chip shows only the initial. The logo dot and the "·" separator hide so the
  board name gets the space.
- **Verified** on `wrangler pages dev` with a temporary local test user (`account.mjs`):
  17/17 checks pass. Covered: Sign in button; no account block in the panel; open, email
  focused, `aria-expanded`; no backdrop; sign-up link; Escape, outside tap and a second
  trigger click all close it (Escape returns focus); a wrong password shows "Incorrect email
  or password." inline; the popover survives a re-render; signed-in chip "S | sbtest"; header
  60px in both states; reachable in play mode; sign out; phone header 52px on one row; phone
  popover fully on screen; no page errors.


# Game Bench: build plan

Location: `make/fun/gametools/` (URL: `make.contrapaul.com/fun/gametools/`)
Brainstorm and rationale: `brainstorm.md`. This file is the working plan; update
the checkboxes and the status line as work lands, so a new session can pick up
from here without re-reading the conversation.

**Status:** Phases 0 and 1 built and verified locally, committed, not yet pushed. Phase 2 next. Last updated 2026-09-16.

---

## How this file is used

- Each phase ends in something usable and deployed. Never leave `main` with a
  half-wired shell.
- Each tool has a short acceptance list. A tool is done when every line is true
  in a browser on a phone and on a laptop, not when the code is written.
- When a phase finishes, tick it, bump the status line, and note anything the
  next phase needs to know under **Handoff notes** at the bottom.
- Scope creep goes to `brainstorm.md`, not into the current phase.

---

## Architecture (fixed, decided in brainstorm)

Plain HTML/CSS/JS, no build step, no external requests, Cloudflare Pages serves
the directory as is. One shell, one JS file per tool, one shared store.

### Files

| File | Purpose |
|---|---|
| `index.html` | Shell: header, tool nav, one `<main>` the active tool renders into, footer. No tool markup lives here. |
| `bench.css` | Everything visual. Design tokens at the top, tool-specific sections below, print rules at the end. |
| `bench.js` | Shell logic: tool registry, hash routing (`#dice`, `#odds`…), store, export helpers, reduced-motion flag. |
| `dicemath.js` | `Bench.dice`: parse a roll, roll it, exact distribution. Shared by Dice and Odds. |
| `tools/<name>.js` | One per tool. Calls `Bench.register({ id, mount, unmount })`. |
| `data/cards.js` | Pre-baked card layout configs. |
| `data/demos.js` | Simplification demo content (case study copy and tables). |
| `fonts/` | Self-hosted woff2: Lexend 400/500/600/700/900, JetBrains Mono 400/700. |
| `media/` | Images for demos and layout examples. |
| `mood.html` | The approved look, as a single page. Reference only; not linked. |
| `brainstorm.md`, `plan.md` | This. |

### Store

A single object in `localStorage` under `gamebench.v1`. Every tool reads and
writes through `store.get(key)` / `store.set(key, value)`; nothing touches
`localStorage` directly. Shape:

```js
{
  rolls:     [ { t, spec: "2d6", faces: [3,5], total: 8, label } ],   // dice history, all of it
  manifest:  [ { id, name, type, count, start, owner, w, h, d } ],    // components
  session:   { players, turns, secTurn, setup, teach, pack },         // estimator inputs
  cards:     { types: [ { name, layoutId, colour } ] },               // locked layouts
  playtests: [ { t, laps: {setup,teach,play,pack}, tallies: {...}, questions: [...] } ],
  prefs:     { theme, reducedMotion }
}
```

`store.export()` downloads the whole thing as JSON; `store.import(file)` replaces
it; `store.clear()` wipes it, behind a confirm. All three live in the shell
header so every tool gets them for free.

### Export helpers (in `bench.js`, used by every tool)

- `downloadCSV(rows, filename)`
- `downloadPNG(canvasOrSvg, filename)`
- `downloadJSON(obj, filename)`
- `printSection(el)` — clones into a print frame so only that tool prints.

### Tool contract

Plain scripts, not ES modules, so the bench also runs from `file://`. Each tool
file is an IIFE that ends with:

```js
Bench.register({
  id: 'dice',                       // must match an entry in ROSTER in bench.js
  mount: function (el, store) {},   // render into el, subscribe with store.on()
  unmount: function () {}           // unsubscribe, clear timers, drop DOM refs
});
```

`ROSTER` in `bench.js` lists every tool the bench will have, in nav order, with
title and blurb. A roster entry with no registered module renders as a greyed
"Soon" tile, so the grid tells the whole story from day one. Add the
`<script src="tools/x.js">` line to `index.html` when a tool lands.

The shell exposes `Bench.store`, `Bench.downloadCSV/JSON/PNG`,
`Bench.printSection`, `Bench.esc`, `Bench.el`, `Bench.rand(n)` (crypto-backed,
1..n) and `Bench.reducedMotion()`.

Tools never reach into each other. If dice needs to tell odds something, it
writes to the store and odds reads the store.

---

## Phase 0: Look and shell

Goal: the bench exists, has its own feel, and can host tools. Deploy with one
placeholder tool so the routing is proven.

- [x] **Mood sheet.** `mood.html`, approved 2026-09-16. Palette: baize green
      felt table, ivory paper panels, berry `#c4204f` for actions, brass
      `#d9a23a` for highlights. Light by default, dark mode. Tiles: icon inline
      with title, two text sizes, lift shadow kept inside the 12px tile gap.
- [x] **Fonts.** Lexend (body and display, Black for the wordmark) and
      JetBrains Mono (numbers, kickers). Vendored to `fonts/`.
- [x] **Design tokens** in `bench.css`.
- [x] **Shell**: wordmark, tool tiles, Data menu (download JSON / load / clear),
      theme toggle. Footer links to make. (Link to the unit page deliberately
      left out: the bench doesn't point at coursework.)
- [x] **Routing**: `#toolid` mounts, back button works, unknown hash goes home.
- [x] **Store** with the API above, persisted under `gamebench.v1`.
- [x] **Reduced motion** from the OS setting; `prefs.motion` = `reduce` |
      `full` overrides. No UI for the override yet.
- [x] **Placeholder tool**: `tools/dice.js` is a real single d6 with the CSS
      cube tumble, skip-on-second-click, history to `store.rolls`, CSV export.
      Phase 1 grows it in place.
- [x] Works at 375 px wide with no horizontal scroll; nav becomes a swipe row.
- [x] Card added to `fun/index.html` as WIP (image `images/fun/gamebench.png`
      not yet made; the card hides a missing image).
- [ ] Deployed (commit and push; Cloudflare Pages serves the directory).

---

## Phase 1: Numbers

Goal: the two tools the whole thing was started for, plus the deck lab because
it shares the machinery.

### Dice (`tools/dice.js`)
- [x] Standard dice d4–d100 as quick picks, any dN typed, coin as a built-in
      custom die.
- [x] Pool syntax: `3d6`, `2d20kh1`, `4d6dl1`, `2d6+1d4-1`. Errors inline.
      Caps: 20 dice, 1000 sides. Subtracting dice is refused.
- [x] Custom faces: name and faces, saved to `store.dice.custom`, rolled ×1–10
      with a flicker; results go to history as strings (`custom: true`,
      `total: null`).
- [x] Animated roll ~0.8 s, click again to skip. CSS cube for d6, clip-path
      polyhedra with a slowing number flicker for everything else. Dropped
      dice dim and strike through in the breakdown. Reduced motion lands
      instantly.
- [x] History, last 50 shown, all written to `store.rolls`.
- [x] Space rolls again (outside inputs). Enter in the roll box rolls.
- [x] Export history CSV.

### Odds (`tools/odds.js`, the probability lab)
- [x] Same parser as Dice. Last spec and labels persist in `store.odds`.
- [x] Label ranges with a colour each; unlabelled values are outlined bars.
- [x] Run 10 / 100 / 1,000 / 10,000. Cap stated in the UI with the reason.
- [x] 10 and 100 fill live over ~1.2 s via rAF; 1,000 and 10,000 snap.
- [x] Exact distribution as a dashed brass step line, always on. (Toggle
      dropped: it's the point of the chart.) Keep/drop rolls enumerate up to
      2M combos, otherwise estimate from 200k samples and say so.
- [x] Per-game expectation column from a "rolls per game" input.
- [x] "Use my N rolls" loads matching non-custom rolls from history.
- [x] Export chart PNG (SVG rasterised at 2×, colours resolved from CSS vars
      at draw time), table + per-value CSV.
- [ ] Setup JSON export. Not needed: the whole bench exports from the Data
      menu.

### Deck (`tools/deck.js`)
- [x] Card kinds with name, slider and number; capped at 200 cards.
- [x] Draw a hand of N with cards dealing in.
- [x] "At least K of X in a hand of N": hypergeometric exact beside 1,000
      simulated shuffles. Table per kind: share, expected in hand, P(≥1),
      P(none).
- [x] Sliders update the odds live.
- [x] Export CSV.

Phase 1 done: a student can label `1 = backfire`, run 100 and 1,000, see
the bars settle onto the outline, and download the chart. Verified 2026-09-16.

---

## Phase 2: Time and stuff

Goal: the tools that answer "will this fit in a recess".

### Manifest (`tools/manifest.js`)
The shared component list. Not a tool in its own right on the nav; it's an
editable table that Setup, Owners and Box all embed.
- [ ] Add / edit / delete rows: name, type (card, token, board, die, other),
      count, starts where (table, reserve, dealt, bag), owner, size mm.
- [ ] Writes to `store.manifest`.
- [ ] Export CSV and print.

### Setup (`tools/setup.js`)
- [ ] Reads manifest. Per-placement time costs (documented in the file, editable
      in an "advanced" fold).
- [ ] Setup minutes, pack-away minutes, pieces-on-table count.
- [ ] Warnings at 60 and 120 pieces on table.
- [ ] Shows which component type eats the most time.

### Session (`tools/session.js`)
- [ ] Inputs per brainstorm. Setup and pack-away prefilled from Setup if present.
- [ ] 0–30 min stacked bar, phases coloured, overflow shown in red beyond 30.
- [ ] "To fit" suggestions when over.
- [ ] Prefills turn time from the latest playtest if there is one.
- [ ] Export PNG of the bar.

### Playtest (`tools/playtest.js`)
Phone-first.
- [ ] Stopwatch with lap buttons Setup / Teach / Play / Pack.
- [ ] Named tally counters, big tap targets, add your own.
- [ ] Question log: text field + timestamp, listed by time.
- [ ] Saves a session to `store.playtests` on stop.
- [ ] Export session CSV; print a blank tally sheet.

Phase 2 done when: a team can enter their components, see setup time, run a
timed playtest on a phone, and watch the session bar update from real numbers.

---

## Phase 3: Layout and print

### Card layouts (`tools/cards.js`, `data/cards.js`)
- [ ] Card sizes preset and custom; trim / bleed / safe overlay, dimensioned.
- [ ] True-size preview with calibration note.
- [ ] Eight pre-baked configs from the brainstorm, each with a one-line "why".
- [ ] Shuffle button remixes zones from the config pool.
- [ ] Card types: name them, lock a layout to each, shared conventions enforced
      (corners, type sizes, icon row) with colour band per type.
- [ ] Zone hover / tap shows what goes there and minimum size.
- [ ] Export dimensioned template PNG / print, blank print sheet per type, JSON.

### Print sheet (`tools/sheet.js`)
- [ ] N-up on A4 / Letter with crop marks; mirrored backs.
- [ ] Token grids, circles and squares at chosen mm.

### Small graphic checks (can be one tool, `tools/checks.js`)
- [ ] Type at distance: distance in → point size out, rendered sample.
- [ ] Colour-blind simulation of a palette and contrast ratio.
- [ ] Grid paper: hex / square / offset / triangle, cell mm, print.

Phase 3 done when: a student can lock three card types, print a sheet of nine,
and the bleed is right when cut.

---

## Phase 4: Simplify

### Demos (`tools/simplify.js`, `data/demos.js`)
Micro first, macro second. Each demo is a section on one scrolling page, with an
index at the top.
- [ ] Roll-and-move vs choose-and-move, playable side by side.
- [ ] Exceptions counter (paste text).
- [ ] Three currencies vs one.
- [ ] Twelve types vs five.
- [ ] Cut-half exercise.
- [ ] D&D → archetypes, with the timed build-a-character both ways.
- [ ] Risk → campaign chunks, with the clickable campaign map.
- [ ] Monopoly, Catan, Magic, Pandemic as copy plus kept / cut / cost tables.
- [ ] "Shrink your own" worksheet, exports CSV / print.

### Rules budget (`tools/rules.js`)
- [ ] Paste text → words, pages at chosen type size, reading time, exception
      count.
- [ ] Structure skeleton (Setup / Turn / Actions / Winning / Reference) with
      target lengths.
- [ ] Cold-read checklist, printable.

---

## Phase 5: Team and extras

### Roles (`tools/roles.js`)
- [ ] Four roles mapped to the four skill tracks; 3-person pairings.
- [ ] Two-track minimum enforced on each card.
- [ ] Reads manifest owners to show the ownership board.
- [ ] Randomiser with one swap.
- [ ] Print role cards and ownership board.

### Box (`tools/box.js`)
- [ ] Reads manifest sizes → inner box dimensions, printable net, tray dims.

### Extras, each small, in this order as time allows
- [ ] Spinner
- [ ] Random table builder (rolls with Dice)
- [ ] Score pad
- [ ] Turn tracker with 30 s buzz
- [ ] Race simulator
- [ ] Point-cost balancer

### If the campaign demo earns it
- [ ] Campaign map as a real tool: named regions, session log, persistent state,
      export.

---

## Cross-cutting checklist (run at the end of every phase)

- [ ] Every tool has at least one export or print.
- [ ] Every tool does something on open, with sensible defaults.
- [ ] No text says strand, criterion, rubric, submit.
- [ ] 375 px wide, no horizontal scroll, tap targets ≥ 44 px.
- [ ] Keyboard: every control reachable, Escape closes anything modal.
- [ ] `prefers-reduced-motion` respected.
- [ ] Dark mode has no unreadable pairs.
- [ ] No console errors on load or on any tool switch.
- [ ] Nothing fetched from outside the directory.
- [ ] `fun/index.html` card updated (WIP → LIVE at Phase 2).

---

## Order of work

0. Mood sheet → approval → shell → deploy.
1. Dice → Odds → Deck → deploy.
2. Manifest → Setup → Session → Playtest → deploy, flip to LIVE.
3. Cards → Sheet → Checks → deploy.
4. Simplify micro → Rules → Simplify macro → deploy.
5. Roles → Box → extras → deploy.

Link from the unit page (`edu/curriculum/myp/g9-game-design.html`) after step 2,
when there's enough to be worth a student's click.

---

## Handoff notes

_(Append here at the end of each session: what landed, what's half done, what
surprised you. Newest at the top.)_

- 2026-09-16 (Phase 1): Dice, Odds, Deck built and verified at desktop and
  375px, light and dark. Committed locally, not pushed. For Phase 2:
  - `Bench.pct(p)` formats probabilities (keeps a decimal near 0% and 100%).
    Use it anywhere a percentage is shown.
  - Series colours for anything multi-coloured: `--berry --brass --felt
    --slate --plum --rust`, in that order. Both Odds and Deck use the same
    `SWATCH` list; if a third tool needs it, lift it into `bench.js`.
  - `.sw` is the small colour swatch; `table.sheet` the data table; `.seg`
    the segmented control. `.tool-grid` is the two-column panel layout and
    collapses on its own.
  - Odds resets its sample when the spec changes but keeps labels, so a
    label can sit outside the new range (shows 0%). Deliberate.
  - The Dice cube sits at `rotateX(-10) rotateY(12)` for a hint of 3D;
    `showCubeFace` composes the face rotation after that.
  - No `media/` yet and no `images/fun/gamebench.png` for the fun card.

- 2026-09-16 (later): Phase 0 built. Shell, store, routing, theme, seed Dice
  tool, all verified in the browser at desktop and 375px, light and dark, no
  console errors. Not yet committed or pushed. Local preview: `.claude/launch.json`
  has a `gamebench` entry (python http.server on 8791, serve repo root, open
  `/fun/gametools/`). Things to know for Phase 1:
  - The d6 face rotations are in `FACE_ROT` in `tools/dice.js`; faces are
    positioned in `bench.css` (`.f1`–`.f6`). Adding d4/d8/d20 needs a different
    object (a number wheel per the brainstorm), not more cube faces.
  - `Bench.rand(n)` uses `crypto.getRandomValues` with rejection sampling.
    Odds should use it too, 10,000 calls is nothing.
  - The tool panel uses `.panel`, `.kicker`, `.btn`, `.field`, `.input`,
    `.seg`, `.badge`, `table.sheet` from `bench.css` section 3. Reuse before
    adding.
  - Browser caching bit during testing: python's server sends no cache headers
    and the browser held old JS. Hard reload or `?v=` when a change seems to
    do nothing.
- 2026-09-16: Brainstorm and plan written. No code yet. Mood sheet is the first
  thing to make.

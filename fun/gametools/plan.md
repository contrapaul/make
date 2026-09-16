# Game Bench: build plan

Location: `make/fun/gametools/` (URL: `make.contrapaul.com/fun/gametools/`)
Brainstorm and rationale: `brainstorm.md`. This file is the working plan; update
the checkboxes and the status line as work lands, so a new session can pick up
from here without re-reading the conversation.

**Status:** All five phases built and verified. Phase 5 committed, not yet pushed. Fourteen tools live. Last updated 2026-09-16.

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
| `data/cards.js` | Card sizes, zone descriptions, and the eight pre-baked layouts (rows of cells). |
| `data/demos.js` | The six case studies: big / small / lesson and the kept / cut / cost lists. Edit copy here. |
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
The shared component list. Not on the nav; `Bench.manifest.mount(el, store,
{owners})` embeds it and returns an unmount. Setup embeds it now; Owners and
Box will.
- [x] Add / edit / delete rows: name, kind (card, token, board, die, tile,
      other), count, starts where (table, reserve, dealt, bag). Owner column
      only when `{owners: true}`. Size in mm deferred to Box (Phase 5).
- [x] Writes to `store.manifest`; seeds an example on first open with a
      "this is an example" note.
- [x] Export CSV and print.

### Setup (`tools/setup.js`)
- [x] Reads manifest. Seconds-per-piece by kind × start in `DEFAULT_COST`,
      editable in the Assumptions panel, saved to `store.setup.cost`.
      Shuffle 20 s per deck. Pack-away 60% / 15%.
- [x] Setup, pack-away, pieces on the table.
- [x] Warnings at 60 and 120 pieces on the table.
- [x] "Where the time goes" bars by kind.
- [x] `Bench.setupEstimate(store)` for Session.

### Session (`tools/session.js`)
- [x] Players, turns each, seconds a turn, set up, teach, pack away. Target
      20 / 25 / 30.
- [x] Stacked bar SVG, target as a dashed line, overflow hatched.
- [x] "Any one of these fits it": fewer turns, shorter turns, shorter teach
      or setup, one fewer player, each computed to fit alone.
- [x] "Use Setup's estimate" and "Use my last playtest" buttons (the latter
      derives seconds a turn from play time ÷ players × turns).
- [x] Export PNG of the bar.

### Playtest (`tools/playtest.js`)
Phone-first.
- [x] Stopwatch with Set up / Teach / Play / Pack away phase buttons, pause,
      finish, discard. Time is Date.now() deltas, so it survives the screen
      sleeping; the live session persists in `store.playtestLive` across
      reloads.
- [x] Tally counters with 56 px tap targets, rename in place, add your own.
      Counts update in place so renaming isn't interrupted.
- [x] Question log with elapsed time and phase.
- [x] Finish saves to `store.playtests`; counter names carry over to the next
      session.
- [x] CSV per session, CSV of all sessions (one row each), printable blank
      sheet with the current counter names.

Phase 2 done: a team can enter their components, see setup time, run a timed
playtest on a phone, and watch the session bar update from real numbers.
Verified 2026-09-16. Fun card flipped to LIVE.

---

## Phase 3: Layout and print

### Card layouts (`tools/cards.js`, `data/cards.js`)
- [x] Sizes poker / bridge / mini / tarot / square / custom; trim, 3 mm bleed
      and 3 mm safe drawn and dimensioned. One SVG renderer in mm
      (`Bench.cards.render`) serves preview, PNG, thumbnails and the sheet.
- [x] True-size toggle with a 96 dpi note.
- [x] Eight layouts as rows of cells: trading, deckbuilder, action, role,
      event, reference, resource, story. Each names the games it borrows
      from and says why it works.
- [x] Shuffle: random base plus 1–3 mutations (flip a row, swap adjacent
      rows, resize art, change band, move a small row to the other end) and
      a sentence saying what it did.
- [x] Card kinds: name, colour, lock the current layout. All kinds share the
      size. (Per-zone convention enforcement beyond that is not built; the
      shared size plus the kind list does most of the job.)
- [x] Zone hover / tap shows what goes there and the minimum point size.
- [x] Export dimensioned template PNG, layouts JSON, link to Sheet.

### Print sheet (`tools/sheet.js`)
- [x] A4 / Letter. Cards share bleed (neighbours overlap by one bleed width)
      so poker is 3 × 3 on A4; cut ticks in the margins at every trim line.
      Mirrored back sheet option. Safe-guide toggle for final prints.
- [x] Tokens: circle / square / hex at chosen mm, centre dots, 5 mm gutter.
- [x] Print via `printSection` with an inline `@page` size; first page PNG.

### Checks (`tools/checks.js`)
- [x] Type at distance: slider 30–150 cm → minimum and comfortable point
      sizes, rendered at screen scale, with an 85.6 mm calibration bar.
- [x] Palette under protanopia / deuteranopia / tritanopia (Machado 2009),
      WCAG contrast on paper and ink, and warnings for pairs that collapse.
- [x] Grid paper: square / hex / offset / triangle, cell mm, print and PNG.

Phase 3 done: a student can lock card kinds, print a sheet of nine with
cut guides, and check type and colour. Verified 2026-09-16.

---

## Phase 4: Simplify

### Demos (`tools/simplify.js`, `data/demos.js`)
One scrolling page, index chips at the top, five micro demos, six case
studies, one worksheet.
- [x] Roll-and-move vs roll-and-choose: two 12-space tracks, the right one
      offers Road (move N) or Tunnel (move N+2, two visible traps send you
      back 3). Counts rolls and decisions per side.
- [x] Three currencies vs one: same shop, counts the sums done in your head.
- [x] Twelve kinds vs five: ten-second look, then tick what you could
      explain.
- [x] Exceptions: paste a rule, the *unless / except / cannot* words light up
      (uses `Bench.rules.analyse`).
- [x] Cut it in half: list mechanics, cut half, answer the meaningful-choice
      question, cut half again. Persists; CSV of what survived.
- [x] D&D → archetypes: build a character the long way (three selects, roll
      six scores, two skills, a pack) and the archetype way (a card, a move,
      a flaw), each timed, best times kept.
- [x] Risk → campaign chunks: six-hex map, click a region, 3d6-high skirmish,
      the map and a dated log persist. Four regions wins the war.
- [x] Monopoly, Catan, Magic, Pandemic: big / small / lesson plus the kept /
      cut / cost table.
- [x] Shrink your own: name, three columns, "the one thing", CSV and print.

### Rules (`tools/rules.js`)
- [x] Paste text → words, pages at 9–12 pt, reading time at 150 wpm, a gauge
      against the 4-page cap, exception list with snippets, count of
      "rules to hold in your head".
- [x] Six-part skeleton with target lengths and a copy button.
- [x] Ten-question cold-read checklist, ticks persist, printable.

---

## Phase 5: Team and extras

### Roles (`tools/roles.js`)
- [x] Rules, Art, Fab, Build leads, each carrying two skill tracks (the
      second is the natural neighbour: rules→graphic, art→systems,
      fab→hand, build→digital). Team of 3 doubles up a pair that shares a
      track.
- [x] Every card shows both tracks, what it owns, a "by session 4"
      checkpoint, and four skills to evidence.
- [x] Embeds the manifest with the owner column; pieces-by-owner bars with
      warnings for >50% and for unowned pieces.
- [x] Randomise, then one swap (typed as two role ids), then it stands.
- [x] Print role cards; print the ownership board with a done column.

### Box (`tools/box.js`)
- [x] Per-component W/H/thickness in mm (stored on the manifest rows,
      defaults by kind, board folds once). Inner and outer box size, volume,
      3D-printed tray dimensions, and cross nets for base and lid as SVG,
      printable and PNG. Says when the net is bigger than A4.

### Extras (`tools/extras.js`, one tile, six sections)
- [x] Spinner with weighted wedges, real spin, pointer lands in the wedge.
- [x] Random tables: name, d4–d20, one line per result, roll with a flicker,
      print.
- [x] Score pad: names, rounds, totals, leader highlighted, CSV.
- [x] Turn tracker: whose turn, round, countdown with a beep and flash at
      20/30/45/60 s or none.
- [x] Race: 2–8 players, track length, roll-again-on-6, 1,000 races → rounds
      per race, first-seat win rate against fair, wins by seat.
- [x] Balance: price per stat point, units priced, anything >25% from the
      median flagged.

### Not built
- Campaign map as a real tool. The Simplify demo persists a six-region map
  and log already; if a team wants one for their own game, promote that
  code into `tools/campaign.js` with named regions.

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
- [x] `fun/index.html` card updated (WIP → LIVE at Phase 2).

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

- 2026-09-16 (Phase 5, done): Roles, Box, Extras built and verified at
  desktop and 375px. `README.md` added for the directory. Fourteen tiles.
  Things that would be worth doing next, none of them blocking:
  - A screenshot for `images/fun/gamebench.png` (the fun card hides the
    missing image).
  - Link from the unit page in `edu/curriculum/myp/g9-game-design.html`.
  - Rewrite `data/demos.js` in the teacher's voice if wanted.
  - A "Table" mode for Playtest + Turn tracker + Score pad on one phone
    screen, if teams turn out to use all three at once.
  - The manifest now carries `w`, `h`, `d` from Box; Setup ignores them.

- 2026-09-16 (Phase 4): Rules and Simplify built and verified at desktop
  and 375px. Committed locally. Eleven tools on the nav now; nothing is
  "Soon". For Phase 5:
  - **Shell fix worth knowing:** each tool now mounts into a fresh
    `div.tool-root` inside `<main>`, discarded on route change. Before this,
    Sheet and Checks hung delegated listeners on `<main>` itself and kept
    firing after unmount. Attach to `el` freely now; it dies with the tool.
  - `Bench.rules.analyse(text)` returns words, sentences, exceptions
    (with offsets) and hold-in-your-head sentences.
  - Simplify keeps its own state under `store.simplify`: `cut`, `campaign`,
    `own`, `dnd` (best times). The campaign map is the seed for a real
    campaign tracker if Phase 5 wants it.
  - Case-study copy is mine; the teacher may want to rewrite `data/demos.js`
    in their own voice. Nothing else depends on the wording.
- 2026-09-16 (Phase 3): Cards, Sheet, Checks built and verified at desktop
  and 375px. Two tools (Sheet, Checks) were added to the roster, so the nav
  is now ten tiles. Committed locally, not pushed. For Phase 4:
  - `Bench.cards.render(layout, size, {colour, dims, scale, labels, guides,
    back, name})` returns an SVG string in mm. Nested inside a page SVG by
    stripping the outer tag. The `#art` gradient id repeats per card, which
    browsers tolerate.
  - Cards, Sheet and Checks use `B.store` directly (not the mount argument)
    so their state is readable from other tools before they mount.
  - `[hidden] { display: none !important }` is now global; use the
    attribute rather than inline styles to hide.
  - The bench's own palette fails the colour-blind check (berry vs felt).
    Charts in Odds and Deck are labelled by text too, so it's tolerable, but
    the case-study copy in Simplify shouldn't rely on colour alone.
- 2026-09-16 (Phase 2): Manifest, Setup, Session, Playtest built and
  verified at desktop and 375px. Committed locally, not pushed. For Phase 3:
  - `Bench.printSection(el)` clones a node into a hidden iframe with
    `bench.css` (resolved against the page URL) and prints once the CSS
    loads. Body class `print-only` strips chrome. Card sheets should use it.
  - The manifest table keeps focus on keystrokes by setting `quiet` around
    its own `store.set`; other tools that embed an editable list want the
    same trick.
  - Playtest and Session share the phase list and colours (setup brass,
    teach slate, play berry, pack felt). Keep that mapping if anything else
    shows phases.
  - Still to do outside this repo: link Game Bench from the unit page in
    `edu/curriculum/myp/g9-game-design.html` once pushed.
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

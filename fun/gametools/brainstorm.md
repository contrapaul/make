# Game Bench — brainstorm

Working notes for a set of small browser tools for people designing a tabletop
game. Built for the G9 MYP Design unit (`edu/curriculum/myp/g9-game-design.html`,
plan at `edu/curriculum/myp/Plans/G9/tabletop-unit-plan.md`) but not owned by it:
it should be usable by anyone making a game, and it should feel like a workbench
you try things on, not an assessment. Lives at `make/fun/gametools/`.

## Principles

- **A bench, not a rubric.** Nothing on the page says "strand", "criterion" or
  "submit". Tools invite poking: defaults are pre-filled with something
  interesting, every tool does something the moment it opens, and "reset" is
  always one click away. The unit page links in; this page doesn't link out to
  coursework.
- **Data gets out.** Anything a tool computes can leave as a file or a print:
  CSV for tables, PNG for charts, JSON for whole-tool state, `@media print` for
  sheets. A student should be able to paste a probability histogram or a
  manifest table straight into a report without retyping. Exports are the only
  place assessment shows up, and there they're just "download".
- **Tools talk to each other.** One shell, shared state. The dice roller's
  history feeds the probability lab; the manifest feeds the setup calculator,
  the ownership board and the box calculator; the playtest timer feeds the
  session estimator.

## What the unit actually constrains

Every tool should push on at least one of these. If it doesn't, cut it.

| Constraint | Where it bites |
|---|---|
| Session is 20 to 30 minutes, setup to pack away | Playtime, setup, rules length |
| Rulebook is 4 pages max, learnable in one recess | Rules tools |
| Teams of 3 or 4, one game, individual evidence | Roles, component ownership |
| Meaningful choices are non-negotiable | Simplification demos, balance |
| Bi specs must be measurable and testable | Anything that produces a number |
| Cii needs 3 skills at depth across 2 of 4 tracks | Layout, fabrication, rules |
| Biv production pack: manifest, card template with bleed, board to scale | Layout tools |
| Di/Dii: playtime needs a stopwatch, clarity needs misplay counts | Playtest tools |

**Already being built on the edu side, don't duplicate:** meaningful choice
checker, research budget planner, spec builder, build planner with critical path,
change log, progress tracker. Also the mechanics catalog at
`edu/tools/mechanics/` (link to it, don't rebuild it).

The line: **edu tools are about the coursework, gametools are about the game.**
A student opens gametools when they're at the table with dice and cards, not when
they're writing up a strand.

---

## Tools, grouped

### 1. Numbers (randomness, probability, balance)

**Dice roller**
- d4, d6, d8, d10, d12, d20, d100, custom dN, and a "two-sided" coin.
- Pools: `3d6`, `2d20 keep highest`, `4d6 drop lowest`, `+2` modifiers.
- Animated roll, not click-to-number. Physics-lite is enough: a tumble on a CSS
  3D die for d6, a spinning number wheel for everything else. Roll takes ~0.8s and
  can be skipped with a second click. The delay matters: it's what makes students
  *feel* the frequency in the probability lab.
- Roll history in a side column so they can eyeball streaks. Keep last 50 on
  screen, all of them in the store: the probability lab reads this history, so a
  class of hand-rolling shows up as a sample against the exact curve.
- Custom faces: a d6 where faces are "Miss / Miss / Hit / Hit / Crit / Backfire".
  This is the bridge to the next tool.

**Probability lab**
- Student defines the roll (say `1d6` or `2d6 sum`) and labels outcomes:
  `1 = spell backfires`, `2–4 = nothing`, `5–6 = hit`. Labels can cover ranges.
- Run it 10 / 100 / 1,000 / 10,000 times. Live histogram fills in as it runs;
  bars animate for the 10 and 100 runs, snap for larger so the point lands: small
  samples wobble, big samples settle.
- Overlay the exact distribution as a ghost outline. For `1d6` that's flat; for
  `2d6` it's the triangle. The gap between the bars and the outline *is* the
  lesson. Exact distribution by convolution, trivial for anything a student will
  type.
- Translate to the game: "In a 30 minute game you'll roll this about N times.
  Expect the backfire ~N/6 times per game." Student enters N.
- Export: histogram as PNG, results table as CSV, the whole setup as JSON.
- **On the cost question:** there is no burden. 10,000 rolls of `10d20` is 100k
  calls to `Math.random`, under 5 ms in any browser. The cap is pedagogical, not
  technical. Cap at 10,000 rolls and 20 dice per roll, say so plainly in the UI
  ("10,000 is plenty; the shape stops changing"), no sleight of hand needed. If a
  student wants a million, the exact distribution overlay already answers them.

**Deck lab**
- Build a deck: 12 × Attack, 6 × Heal, 2 × Wild. Draw a hand of 5.
- "What's the chance my opening hand has at least one Wild?" Hypergeometric,
  shown two ways: the formula answer, and 1,000 simulated shuffles.
- Deck tuner: drag the counts, watch the odds move. This is where students
  discover that 2 Wilds in 20 cards means a third of players never see one.

**Spinner builder**
- Custom wedges, custom widths, spin animation. Same lab hooks as dice.
- Useful because many G6-targeted games end up with a spinner, and weighted
  wedges are the easiest way to teach that "random" and "fair" aren't synonyms.

**Point-cost balancer**
- For games with units or cards that have stats. Student assigns a cost per stat
  point (attack 2, health 1, range 3), tool prices every card and flags outliers.
  Crude, but crude is the right level. It makes "balance with numbers" (a Cii
  systems skill) concrete.

**Tug-of-war / race simulator**
- Two or more players with simple rules (move 1d6, on a 6 move again) raced 1,000
  times. Shows average game length in turns and first-player win rate. Answers
  "does going first matter?" and "how long does this take?" before a prototype
  exists. Feeds the session estimator below.

### 2. Layout and print

**Card layout generator** (not a designer)
- Pick a size (poker 63×88, bridge 57×89, mini 44×63, tarot 70×120, square 63×63)
  or enter custom mm. Trim, bleed (3 mm) and safe area (3 mm in) drawn as a
  dimensioned overlay on everything. Live preview at true size (screen DPI trick,
  with "hold a real card up to check").
- **Pre-baked layouts modelled on popular games.** Each is a config: zones,
  their positions, what goes in them, why. A dozen or so to start, e.g.
  - *Trading-card style* (Magic, Pokémon): title bar, cost corner, big art,
    type line, rules box, stats corner. "Art sells the card, the rules box is
    read second."
  - *Deckbuilder* (Dominion): name top, art, cost bottom-left, effect text
    centred, coloured band by type. "Cost where the hand fans."
  - *Action card* (Exploding Kittens, Uno): one huge icon, one word, colour
    field. "Read from across the table."
  - *Character / role card* (Werewolf, Coup): portrait, name, one-line power,
    reminder icons.
  - *Event / encounter* (Pandemic, Betrayal): title, flavour line, then a
    numbered effect list.
  - *Reference / cheat card*: no art, tabular, the turn sequence.
  - *Resource / currency* (Catan): one icon, one number, nothing else.
  - *Tarot-size story card* (Arkham, Gloomhaven): narrative block, choice
    A / B at the bottom.
- **Shuffle button.** Each press mixes a new layout from the config pool:
  swaps zone positions, corner conventions, art ratio, band placement. The
  point is to show there are many valid answers and to get past the first idea.
- **Lock per card type.** A game has several card kinds. Student names them
  (Attack, Item, Event), locks a layout to each, and the tool keeps them
  consistent: same corners, same type sizes, same icon row, different colour
  band. Locked layouts are what export.
- **Suggestions in place.** Hovering or tapping a zone says what belongs there
  and what size: "Cost. 14 pt minimum, top-left, where a fanned hand shows it."
  Includes reading-distance advice from the type checker below.
- Export: dimensioned template PNG/print for the production pack, a blank print
  sheet per card type, and the layout as JSON so a team can share it.

**Print sheet**
- Lays cards out N-up on A4 / Letter with crop marks. 9 poker cards per A4.
  Double-sided option mirrors the back sheet. Print via CSS, no PDF library.
- Also does tokens: a grid of circles or squares at chosen mm, ready to cut.

**Type-at-distance checker**
- Enter reading distance (across a table, ~60–80 cm) and it shows what point size
  a Grade 6 can read. Renders sample text at that size on screen with a "hold your
  phone at arm's length" calibration. Cii graphic track: "typography for audience
  and table distance".

**Colour-blind and contrast check**
- Paste the palette (or pick from the card template). Shows it under
  deuteranopia / protanopia / tritanopia, gives contrast ratio for text-on-bg.
  Flags "your red and green suits are the same colour to 8% of boys". Named
  explicitly in the Cii graphic track.

**Board and grid paper**
- Hex, square, offset square, triangle. Set cell size in mm, page size, print.
  Also useful as a to-scale board drawing background for Biv.

**Icon sheet**
- Not an icon editor. A grid where the student drops or draws each icon at its
  final size (say 8 mm) next to its meaning, and prints. Biv "iconography sheet".
  Optional: a small library of open-licence game icons (game-icons.net is CC BY)
  so they don't waste a class drawing a sword.

**Box and insert calculator**
- Enter component stacks (cards: 54 × 0.3 mm; tokens: 30 × 2 mm; board folded to
  X × Y). Returns minimum inner box size and a net (flat pattern) to print, or
  dimensions for a 3D-printed tray. Ties to the digital fab track and the "box or
  storage solution" requirement in Ciii.

### 3. Time and scope

**Session estimator**
- Inputs: players, turns per player per game (or rounds), seconds per turn, setup
  minutes, teach minutes, pack-away minutes.
- Output: a bar from 0 to 30 minutes with each phase coloured. If it overflows,
  it says what to cut to fit and by how much ("drop 2 rounds or shave 15 s per
  turn"). Students always underestimate turn time; a note says "time three real
  turns with the playtest timer before trusting this".

**Setup calculator** (the one you described)
- Component manifest as input: type, count, where it starts (on table / in a
  reserve pile / dealt to players / in a bag).
- Each placement type has a per-item time cost (deal a card 1.5 s, place a token
  1 s, sort a shuffled deck 20 s, unfold a board 10 s). Estimates setup and
  pack-away in minutes, shows which component type is eating the time.
- Big "stuff" number: total pieces on the table at once. Beyond ~60 it warns
  about table space; beyond ~120 it warns about losing pieces at recess.
- Also produces the Biv component manifest table as a CSV/print, since students
  have to enter the same data anyway.

**Rules budget**
- Paste rules text. Returns word count, estimated pages at a chosen type size,
  reading time at Grade 6 speed (~150 wpm), and a count of "rules you have to
  hold in your head" (heuristic: sentences with must / cannot / only / unless).
- OnePageRules-shaped structure template: Setup / Turn / Actions / Winning /
  Reference, with a line telling them what belongs in each and how long it should
  be. Not a text editor, just a skeleton they copy.
- Cold-read checklist, one screen, printed: the questions a stranger asks first
  (who goes first? what happens on a tie? can I do nothing?).

**Simplification demos**
Two kinds. *Micro* demos are one screen, interactive, before-and-after, and
show a single principle. *Macro* demos are case studies: take a game everyone
knows is too big for a recess and show one way to shrink it while keeping the
part that makes it good. Both end with the same question: "what did you lose,
and did it matter?"

Micro:
  1. **Roll-and-move vs choose-and-move.** Same board, left side you roll and go,
     right side you roll and pick one of two paths. Play three turns of each.
     "Which side did you make a decision on?" First to build.
  2. **Three currencies vs one.** Same shop, first with gold/wood/stone, then with
     just points. Count the arithmetic per turn.
  3. **Twelve card types vs five.** Show the twelve, hide them, ask what each did.
     Show the five, same test.
  4. **Exceptions counter.** Every "except when" and "unless" costs a point. A
     game learnable in one recess has a small number.
  5. **The cut-half exercise.** List your mechanics; delete half; "is there still
     a meaningful choice?" It doesn't judge, it just forces the pass.

Macro (case studies, each a scrolling page with a small interactive at the top):
  6. **D&D character creation → archetypes.** Full 5e creation is an hour of
     tables. Show the pre-built archetype card instead: Knight, Rogue, Mage,
     Healer, each with two or three choices left open (a signature move, a
     starting item, a flaw). The interactive lets you build a character both
     ways and times it. The lesson: investment comes from *a* choice, not from
     *every* choice. Pairs with the character card layout above.
  7. **Risk / Axis & Allies → campaign chunks.** A 4-hour map game becomes a
     20-minute skirmish over one region, with the outcome recorded on a campaign
     map that persists between sessions. The interactive is a tiny campaign map:
     click a region, "play" a skirmish (a dice-off), record the result, see the
     map change. Shows that a game may span many sessions (a unit rule) without
     any one session being long. Also the fix for "our game takes an hour".
  8. **Monopoly → the trading part.** Strip the lap-and-collect, keep the
     auctions and trades, cap at 8 rounds. What survives is the part people
     argue about at Christmas, which is the part that was ever good.
  9. **Catan → a single island of nine hexes.** Fewer resources, no
     development cards, first to 5 points. The catch-up and blocking still
     happen; the two hours don't.
  10. **Magic → a 20-card fixed deck duel.** No deckbuilding, two pre-built
      decks, five-minute games. The template for any "we want a card battler"
      team.
  11. **Pandemic → one city.** Co-op on a 12-node graph, three turns each. The
      "we lose together" feeling is intact.

Each macro demo ends with a table: *what we kept / what we cut / what it cost
us*. That table is the model for the student's own cut. A **"shrink your own"**
worksheet at the end of the section walks a team through the same three
columns for their game, and exports.

### 4. Team

**Role cards for 3 or 4**
- Roles mapped to the four Cii tracks so the roles produce assessable evidence:
  Rules lead (systems), Art lead (graphic), Fab lead (digital), Build lead (hand).
  For a team of 3, one person carries two tracks and the tool says which pairings
  work (Rules + Graphic is natural; Digital + Hand is natural).
- Each role has a component list it owns, a "what you must have by build class
  4" checkpoint, and the two-track minimum enforced: nobody's card is 100% one
  track.
- Randomiser for teams that can't agree, with a "swap once" rule.

**Component ownership board**
- The manifest from the setup calculator, with an owner column, rendered as a
  board the team can print and stick on the wall. Shows at a glance if one person
  owns everything. This is the "named owner" device from the unit plan.

**Planning** — the edu side already has the Gantt/critical path build planner.
Don't build a second one here. Role cards carry a light "by session 4 you
should have…" checkpoint and that's it.

### 5. Playtest

**Playtest timer and tally sheet**
- Stopwatch with lap buttons: Setup / Teach / Play / Pack away. Feeds real
  numbers into the session estimator and Di ("playtime needs a stopwatch").
- Tally counters students name themselves: "rule looked up", "asked a question",
  "misplay", "player disengaged". One tap each. Exports a row per session.
- This is the Di observation sheet, made so a phone can do it at the table.

**Question log**
- During a cold read, one text field, one button: log the question a tester asked
  with a timestamp. Afterwards the list is sorted by time so students can see
  that most questions came in the first three minutes (setup) or at a specific
  rule. Ciii evidence.

### 6. Random extras (low priority, fun, cheap)

- **Random table builder:** d6 / d20 lookup tables for events, encounters, loot.
  Roll on it with the dice roller. Students love these and they're a mechanic.
- **Name and theme prompt:** two-word theme prompts ("haunted bakery", "polar
  post office") for the Bii forced-range exercise. Only if the catalog draw
  doesn't already cover it.
- **Score pad:** configurable columns, per-player, for games that need scoring.
  Handy at playtest, trivial to build.
- **Turn tracker:** whose turn, round counter, optional per-turn timer that
  buzzes at 30 s. Also a training tool for keeping turns short.

---

## Priority

**Tier 1, build first** (each is small and each is used at the table):
1. Dice roller with animation and custom faces
2. Probability lab
3. Session estimator
4. Setup calculator + manifest
5. Playtest timer and tally

**Tier 2:**
6. Card template + print sheet
7. Rules budget + cold-read checklist
8. Role cards
9. Simplification demos (start with roll-and-move vs choose, and exceptions counter)
10. Deck lab

**Tier 3:** everything else. Colour-blind check and type-at-distance are cheap and
high value for the graphic track; box calculator and grid paper are cheap;
spinner, balancer, race sim, extras as time allows.

---

## Technical notes

- Same approach as the mechanics catalog: plain HTML/CSS/JS, no build step, one
  directory, Cloudflare Pages serves it.
- **Its own look.** Not the edu style, and not a straight copy of make's dark
  industrial either. Wants to feel like a workshop bench: warm, tactile, a bit
  playful. Ideas: a wood or felt table surface behind the tools, dice and cards
  drawn as objects with shadows, chunky buttons that depress, a hand-lettered
  or slab display face for tool names, body type that's plain and readable.
  Light by default (it's used at a table, in daylight, on phones), with a dark
  mode. Decide the palette early, everything else follows.
- One `index.html` shell with a tool switcher, one JS file per tool. Shared
  state lives in one place (a small store object, persisted) so tools can read
  each other's data.
- Persistence: `localStorage`, keyed per tool, with an export/import JSON button
  so a team can move their manifest between devices. No accounts. Offer a "clear
  everything" button because shared school devices.
- Phone-first for the playtest tools (they're used at the table), desktop-first
  for layout tools. Everything works at 375 px.
- Print via `@media print` throughout. Card sheets, grid paper, role cards,
  manifest, checklist all print.
- No external requests. Self-host any fonts. Icons library (if used) vendored.
- Animation: CSS transforms, `prefers-reduced-motion` respected, and a skip.

## Decisions (2026-09-16)

| Question | Decision |
|---|---|
| Title | **Game Bench** |
| Audience | Beyond the unit. Own style, promotes trying things, never feels like an assessment. Exports carry the assessment weight. |
| Structure | One shell, tool switcher, shared state. |
| Card tooling | Not a designer. Pre-baked layouts modelled on popular games, a shuffle button that remixes them, lock-in per card type, in-place suggestions for what goes where. |
| Dice → probability | Roller history feeds the lab. Everything computed can be exported for a report. |
| Simplification | Roll-and-move first. Broad case studies too: D&D creation → archetypes with a couple of choices; Risk / Axis & Allies → recess-sized skirmishes recorded on a persistent campaign map. |

## Still open

1. Palette and type for the bench look. Worth a quick mood sheet before code.
2. Which pre-baked card layouts ship first. The trading-card, action-card and
   character-card configs cover most student games.
3. Whether the campaign-map demo grows into a real tool (a persistent campaign
   tracker teams can use for their own multi-session game). It probably should,
   but after the demo proves the idea.

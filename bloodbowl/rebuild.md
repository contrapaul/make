# Blood Bowl Companion: Rebuild Plan

Status: **plan only, no build started.** Drafted 2026-09-30 from the owner's brief (§0), a review of the
current code in `bloodbowl/`, `functions/api/`, `workers/bb-live/` and `db/migrations/`, a click-through
of the running site (desktop and 375px), and the older feedback notes in `BB skills.txt`.
**Revision 2 (2026-09-30):** updated after the owner's first answers (§0.1) and a review of the rules
source in `bloodbowl/BB2025data/` (§1.4).
**Revision 4 (2026-09-30):** Q17–Q20 answered: the trapdoor fix, the interception rule, a web-first build
with platform-aware UI (§5.7), and in-app tournament rosters (§7.5).
**Revision 3 (2026-09-30):** owner's answers to Q3–Q16 folded in (§0.1). Adds installable apps and a
"third screen" (§12), cost guardrails (§7.7), and offline play as a core feature (§9.3).

Open questions are collected in §11. The next conversation covers the updated UI, further questions, and the
remaining open items.

---

## 0. Owner's brief (original text, unedited)

This site was produced using older models that were less capable. Pages appear to load in multiple steps, every time- not just initial load It leaves the site feeling clunky and half-baked. (Can be seen in many site elements, titles and flavor text, rosters, frames, and more.) 

Ultimately, I think it is highly likely starting over with a fresh site, using the collected data and functions from the current repo will be best. The site does allow players to work through an entire game of blood bowl, calls up details from tables, understands the rules, and allows for functions like tournaments, custom teams, accounts, and more. In essence, the bones are good, but the UI has been patched, reshaped, and reworked too many times. Before deciding this was the best direction, I started documenting issues- which are included below. 

A few additional notes before the problems:

Newer projects like make/localai use tabs on a page for things that we’ve used multiple pages for. We should plan to follow that model as much as possible. Skills, teams, and tables that can be accessed during a game, without requiring a new tab or refresh would be ideal. 

A stronger emphasis on “your own” interaction with the site is a goal. Users should be able to see a record of games played, stats for specific players, and more. 

We’ll need to build in Blitz rules, which are completely absent at the moment. This will need to become an option when setting up a new game, and the ruleset will apply to all parts of the game experience. Note that this can come after the rebuild, but we’ll need to ensure it can fit in flawlessly. 

Uniformity is key. As much as possible, options should be in the same place, buttons in the same place, and information should be displayed in the same places. This will apply across functions/action types. 

The issues I noted before deciding it would be better to build fresh:

When clicking ‘new game’ we go to the play page. Choosing teams for home and away shows the lineup on this page, but the choice isn’t carried to the ‘new game’ wizard, and we have to choose again. The choice on page needs to be carried into the wizard. An ‘Other teams’ button can display the full selection of teams, with a player’s own teams at the top of the list. If players *don’t* choose, then the wizard defaults to showing the ‘Other teams’ list. 

The pass wizard, block wizard, and foul wizard have little continuity, and older attempts to fix the pass wizard were not successful. The roll and details part of the wizard cut off under the bottom frame, and there’s a lot of unused space above it. 

The site doesn’t work well on iPhone/Android, and this is a major focus of a new and improved build. 
 
We need to build out settings for the games, and a full ‘learn to play’ experience. 

Going through ‘new game’ should clear any existing data in bloodbowl/game- instead it returns you to a game in progress. We will need to add strategically add a ‘return to game/continue game’ button elsewhere on the site. 

We will need to simulate a full tournament, with 16 teams. A test environment will be needed, and I’ll walk through the tournament with players to assign and matches to record.

### 0.1 Owner decisions (2026-09-30)

| Topic | Decision |
|---|---|
| Rules edition | **Blood Bowl 2025 (Third Season Edition)**, including the May 2026 Designer's Commentary. The source is `bloodbowl/BB2025data/` (gitignored). |
| "Blitz" | The owner meant **Blood Bowl Sevens** (Spike! Journal 22). No Blitz work. Sevens can still follow the rebuild, but it must fit cleanly (§8). |
| Live two-device games | **Early, and a major consideration from the start.** Not bolted on after single-device play works, as happened on the current site (§7). |
| Production data | **Accounts are ported.** Teams, players, games, tournaments, photos and live-game rows do not need to be kept. |
| Tournaments (Q3) | **The organizer sets the format and the scoring parameters.** The owner is gathering details from an organizer friend. |
| Build location (Q5) | **Alongside** in `bloodbowl-next/`. The live site stays until the replacement is clearly better. |
| Phone pitch (Q6) | **A rotated pitch is fine.** The goal is an app that feels built *for* phones. The owner also wants installable iOS/Android apps and a "third screen" explored (§12). |
| Stack (Q7) | Plain ES modules, no build step, **as long as it's fast and costs nothing beyond the existing $5/month Cloudflare plan** (§7.7). |
| Offline (Q8) | **Yes, in the first release.** Offline local play is *the* core feature; without it the site is a calculator. |
| Card art (Q10) | Cards get a **full, uniform rework**. The owner will make placeholder art per team (no official product images). Later, players upload their own images and customise card looks (§5.6). |
| Physical dice (Q11) | **No acknowledgement, and entering dice is optional.** Tapping "8" should resolve the armour or injury automatically, but skipping straight to picking the result is fine too (§5.2). |
| Interceptions (Q12) | The ruler is about 70mm, which the app treats as **2 squares wide**: a player can intercept **within 1 square (35mm) either side of the pass line** (§4.2). |
| Deploy (Q13) | Whatever is best. Checked with wrangler: the `make` Pages project **already deploys through Git integration**, so gitignored files never reach the site. |
| Guests (Q14) | **Yes, via short code or invite link.** A guest can use the host's teams or the default teams. |
| Sevens pitch (Q15) | **20×11 including end zones confirmed.** Trapdoors are at **(6,10) and (15,2)**, counting x along the length and y up the width from (1,1) in the lower-left end zone. The pitch is point-symmetric (Q17). |
| Game types (Q16) | **New Game is Exhibition only.** **Tournament games are created and reached from the tournament**: the organizer sets the matchups, and both coaches start and end the game. **League play is a future feature** with its own team tracking, because league teams (deaths, big upgrades) aren't suitable for standard play. |

---

## 1. What the review found

### 1.1 The rebuild is the right call

The brief's instinct holds up. The problems are structural, so patching won't fix them:

- **The rules logic is locked inside the UI.** Pass, block, foul, throw-team-mate and kickoff logic lives in
  closures inside `initPassWizard()`, `initBlockWizard()` and similar functions (`js/wizards.js` 2,301 lines,
  `js/pass-wizard.js` 994, `js/throw-wizard.js` 716, `js/drive-wizard.js` 941). Each wizard has its own
  `hasSk()`, `resultPanel()`, `renderSeq()`, `stepMath()`, `armRoll()` and so on. They are near-copies that
  have drifted apart. That drift is the "little continuity" in the brief. None of it can be tested without a
  browser, which is why fixes kept regressing (see the "2 steps forward, 1 back" note in `BB skills.txt`).
- **The site is 14 separate pages.** Every page reloads the header, fonts, 5–35 CSS/JS files and the JSON
  data. `game/` and `play/` each pull in about 800 KB of CSS+JS (`REFACTOR-PLAN.md` §1.4). This is where
  the "loads in multiple steps, every time" feeling comes from. The August refactor already cut out the
  worst of the flicker. What's left is built into the multi-page design.
- **There are two competing CSS implementations of the same components.** `.pwiz-*`, `.result-*` and
  `.pwiz3-roll-btn` are each defined differently in two stylesheets, and which one wins depends on `<link>`
  order (`REFACTOR-PLAN.md`, "New finding"). There are 306 hardcoded font declarations that ignore the token
  system.
- **Game state is thin.** Per-match state is a debounced `localStorage` snapshot (`persistGameState` in
  `js/state.js`). There is no game identity, no event history and no record after the game ends, except for
  cloud games, which write a single score row (see §1.3).

### 1.2 Bugs confirmed in this review (beyond the brief)

| # | Finding | Where seen |
|---|---|---|
| R1 | **Reloading `game/` increments the drive counter.** Drive 1 becomes Drive 2, then Drive 3, on plain reloads with no play in between. | `/game/` fielding screen, three reloads |
| R2 | **The team-picker grid shifts while you click.** The chooser animates in, and a click aimed at "Orc" picked "Old World Alliance". | `/play/` → Choose Home Team |
| R3 | The team-picker grid clips its 4th column at 800px wide. | `/play/` chooser |
| R4 | Fielding cards overlap each other on desktop. At 375px both teams sit side by side at about 90px per card, which is unreadable. | `/game/` fielding wizard |
| R5 | Kickoff wizard buttons read "He kick / They kick". The coin-flip label overflows its box. | `/game/` kickoff |
| R6 | Only **cloud** games are ever recorded. Local games vanish when the next one starts. | `functions/api/games.ts` reads `live_games` only |
| R7 | `data/teams/full/*.json` gives every player `"fact": "Placeholder text."` and duplicates `data/teams/*.json` with the positions expanded. | data folder |
| R8 | Tournament entries are keyed `(tournament_id, user_id)`. Each coach needs an account and can enter only one team, so a 16-team test would need 16 accounts. | `db/migrations/0003_tournaments.sql` |

### 1.3 What's worth keeping

| Keep as-is (or nearly) | Keep the idea, rewrite the code | Drop |
|---|---|---|
| `functions/api/**` (auth, sessions, teams, photos, tournaments, feed). It's clean, small (about 1,300 lines total) and typed. | Every wizard. The rules become a tested engine (§4); the UI becomes a single action-sheet template (§5). | Multi-page shell, `_shell/` and the `tools/build-shell.mjs` machinery |
| D1 schema `0001`–`0004` (extended in §6, not replaced) | Trading card (`js/player-card.js`: container-query card, team accent). Good concept, re-implement in the new component set. | `script.js` / `style.css` monoliths, `panels.css`/`wizards.css`/`pitch.css`/`pass-v3.css` |
| `workers/bb-live` Durable Object (reworked to relay game events, §7) | Pitch (`js/pitch.js`), rebuilt as the shared pitch component in §5.4 | Runtime quip swapping (`title-quips.js`). Keep the quips, render them statically. |
| `box-teams.json` (starter lineups) and the per-team colours in `teams.json`. All other data is **regenerated from `BB2025data/`** (§4.1) and diffed against the old files. | Dice animations (`js/dice.js`, `js/physical-dice.js`): keep the look, inject the timing (§9) | `data/teams/full/` (R7) |
| Self-hosted fonts, Nuffle faces, `css/tokens.css` palette, team colours | Title quips, the News/feed idea, the coach profile | `HANDOFF-wizard-revision.md`, `REFACTOR-PLAN.md` (archive them once the rebuild ships) |
| The owner's pass-zone table and the pass-wizard spec in `BB skills.txt` | The Settings and tutorial stubs (`js/settings.js` 63 lines, `js/tutorial.js` 70 lines) | |

### 1.4 Rules source review (`BB2025data/`)

**What it is.** 112 pages saved from bloodbowlbase.ru's `/bb2025/` section (about 50 MB with assets):

- the core rulebook chapters (Rules and Regulations, Game Essentials, The Game of Blood Bowl, Drafting,
  League, Matched and Exhibition Play, Skills & Traits, Inducements, The Teams);
- the official Cheat Sheet;
- the May 2026 FAQ, errata and tiers;
- Spike! Journals 19–22;
- all 30 team pages;
- 63 star-player pages.

(The site's header says "BB2020", but that's only the site's logo. The URLs and the content are the 2025
edition.)

**The pages are well structured.** They can be machine-read reliably:

- Team rosters are real HTML tables. Each position carries its **keywords** (for example
  `Goblin Lineman (Lineman, Goblin)`), its **Primary/Secondary skill access** (`A D` / `G P S`), its
  quantity and its cost.
- Skill links carry their type in the anchor (`#dodge-active`, `#stunty-passive`). Mandatory skills are
  marked `*`. **Elite skills** are marked with an image: Dodge, Block, Guard and Mighty Blow.
- **Errata are marked inline** as `<del>old</del> <span style="color: darkmagenta">new</span>`. The pages
  already have the May 2026 errata applied, so an importer must drop the `<del>` value.
- Each team page lists its tier, league(s), special rules, staff costs, eligible star players and
  inducements. Star-player pages list "Plays For" leagues and teams.

**The current site's data is mostly 2025 already, but incomplete and slightly wrong:**

| Finding | Detail |
|---|---|
| Stat errors | Orc **Goblin Lineman PA 3+ → 4+** (May 2026 errata). **Wood Elf Lineman PA 4+ → 3+**. OWA **Halfling Hopeful 0-5 → 0-3** (errata). OWA Altern Forest Treeman gains Loner (4+) (errata). Chaos Renegade Ogre: Loner (3+) plus Mighty Blow (errata). |
| Missing fields | Position **keywords** (Sevens needs them for its "max 4 non-Lineman" rule). **Primary/Secondary categories** (needed for advancement and Matched Play skill buying). Active/Passive, mandatory and Elite flags on skills. Team tiers, leagues and special rules as data. Shared Big Guy limits (the `*` footnotes, for example "a Chaos Renegade team may have up to three Big Guys"). Star-player "Plays For". |
| Naming drift | Position names differ from the rules in 14 places (for example "Black Orc Blocker" → "Black Orc", "Rotter Lineman" → "Rotter", "Bull Centaur Blitzer" → "Bull Centaur"). |
| Rules text | Descriptions in `skills.json` and the tables are close to the source wording, sometimes embellished. See the copyright note in §4.1. |

**Rules the engine must model that the current site mostly doesn't:**

- the **Secure the Ball** action;
- the **Distracted** status, plus the conditions Eye Gouge, Rooted, Chomped and Dodgy Snack, and the
  Blitz token;
- **Stalling** ("the Crowd Takes Action");
- Extra Time, Getting Even, and Injury by the Crowd (a Stunned result goes to Reserves);
- the separate **Stunty Injury Table**;
- the **D16 Casualty Table** plus the Lasting Injury table;
- Argue the Call and Bribes;
- Kick Team-mate, and the Special Actions from traits;
- the FAQ rule that **modified results can go below 1**, while a D6 can never be modified above 6.

**Interception eligibility uses the Range Ruler's width, not just the line.** The ruler is laid from
thrower to landing square, and any Standing opponent whose square it overlaps may intercept. The owner's
14×14 range table (§4.2) settles the range bands. **Owner ruling:** the ruler counts as 2 squares wide,
so a Standing opponent may intercept if **any part** of their square falls within 1 square either side
of the pass line (Q18, §4.2).

**Matched Play is the tournament ruleset and should drive tournament roster checks:**

- budgets of 1.1–1.2M, with all gold spent;
- Skill Points by tier (6/8/9/10);
- Secondary Skill limits by tier;
- star players cost 2 SP, Mega-stars 4 (Griff, Hakflem, H'thark, Ivan, Morg);
- at most 4 of each Elite skill;
- no SPP, and a full recovery between games.

**Spike! Journals 19–21** are themed event packs (Bretonnian, Tomb Kings, High Elf). Each has alternate
Weather and Kick-off tables, a themed pitch, special rules and achievements. They aren't needed for the
rebuild. Because tables are data per ruleset (§4), they could later be offered as optional "event packs"
for tournaments.

**Deploy safety.** `BB2025data/` is gitignored, and the `make` Pages project deploys through Git
integration (checked with `wrangler pages project list`). Only committed files are published, so the rules
source never reaches the site. **Never run `wrangler pages deploy .` from this folder**: a direct upload
ignores `.gitignore`. Git integration is also the right choice going forward: push to deploy, with a free
preview branch for the test environment (§7.6).

---

## 2. Principles (the rules every phase is checked against)

1. **One page, many tabs.** Follow the `localai` model: one `index.html`, a hash router (`#/play`,
   `#/teams/orc`, `#/skills/dodge`), ES modules, and no page reloads after first load. Deep links still work
   and can be shared.
2. **Reference is never a navigation.** Skills, teams, star players, tables and rules open in a
   **Reference drawer** that sits over whatever you're doing, including mid-action, and closes back to exactly
   where you were.
3. **Phone first.** Every screen is designed at 375×667 first, then widened. Touch targets are at least
   44px. The layout respects the notch and home-bar safe areas (`env(safe-area-inset-*)`) and uses `svh`
   units, not `vh`. Nothing depends on hover.
4. **Same place, every time.** One layout for every action sheet, one set of button positions and one dice
   widget (§5.2). A new action type fills the same frame; it doesn't bring its own layout.
5. **Fixed frames.** Panels never grow or shrink as options appear. Space is reserved up front, and content
   scrolls inside the frame (a `BB skills.txt` requirement).
6. **The rules live in the engine, not the UI.** All rules math sits in DOM-free modules with Node tests.
   The UI only renders what the engine returns.
7. **The ruleset is a parameter from day one.** No `16`, `11`, `26×15`, turn counts or team sizes are
   hardcoded outside a ruleset definition. This is what lets Sevens drop in later (§8).
8. **Every outcome ends somewhere.** Every roll path finishes on a terminal button. The engine's resolver
   tests enforce this (§4.3).
9. **Offline first.** A local game never needs the network (§9.3).
10. **Two devices is the normal case.** Every decision has an owning coach, and every screen has a
   "waiting for the other coach" state. Live play is part of the core from the start, not added later
   (§7).
11. **No placeholder-then-swap.** Nothing renders as one string and then changes to another. Fonts are
   preloaded, and space for late content is reserved.

---

## 3. Architecture

```
bloodbowl/               (the new site: see §10 for how it replaces the old one)
  index.html             single app shell: header, tab strip, <main>, drawer, sheet host
  js/
    app.js               router + boot
    store/               game store (event log → derived state), settings, session
    engine/              DOM-free rules: dice, modifiers, skills, actions, kickoff, injury, rulesets
    data/                typed loaders + validators for data/*.json
    ui/                  components: sheet, tabs, card, dice, pitch, roster, picker, drawer, toast
    tabs/                home, play, game, teams, reference, tournaments, you, learn, settings
    api.js               (kept from the old site)
  css/  tokens.css · base.css · components.css · one file per tab
  data/ JSON generated from BB2025data by tools/import-rules.mjs (§4.1)
  test/ engine.test.mjs · store.test.mjs · ui.test.mjs  (plain Node, as in localai)
  dev/  design-system.html (every component in every state, as in localai)
```

- **The engine is shared with the worker.** `js/engine/` is imported by `workers/bb-live` so the Durable
  Object referees live games with the same code (§7.1).
- **No framework and no bundler.** Plain ES modules, like `localai`, which the owner already maintains.
  Cloudflare Pages serves it as-is, and `python -m http.server` still works locally. Owner-approved (Q7), within the cost limit in §7.7.
- **Load once.** Data files are fetched once and cached in memory (plus a service-worker cache, §9.3).
  Switching tabs costs no network requests.
- **Top-level tabs:** Home · Play · Teams · Reference · Tournaments · You (account, history, stats) ·
  Settings. The game itself is a full-screen mode inside Play, not a separate page. Learn to Play is reached
  from Home and Play.

### 3.1 The game store (event-sourced)

The biggest structural change. Instead of mutating a snapshot, a game is an **append-only list of events**:

```js
{ id, gameId, seq, at, type: 'block', actor: {side:'home', playerId}, target: {...},
  dice: [{kind:'block', faces:['POW','PUSH'], source:'digital'|'physical'}], chosen: 'POW',
  rerolls: [{kind:'team'}], outcome: {...} }
```

Current state (score, turn, half, player statuses, re-rolls left, SPP earned) is **derived** by replaying
the events. What this gets us:

- **Reload-safe by construction.** Replaying the same log always gives the same state, which fixes R1 and
  the whole class of bugs like it.
- **Undo.** Drop the last event and replay.
- **"Your own" records for free.** A finished game's log *is* the match record, and per-player stats
  (TDs, CAS, completions, SPP, MVP) are queries over it (§6).
- **Live games get simpler.** Two devices exchange events, not UI state (§7).
- **Testing.** A game can be written as a list of events and asserted on.

Every game has an id. **New Game always creates a new game.** If one is already in progress, you're asked to
*Resume* it, *Save and start new* (unfinished games stay in history as "abandoned"), or *Discard*. That's
the brief's "New game should clear existing data", made safe. A persistent **Continue game** pill appears
in the header on every tab while a game is active (the "strategic" placement the brief asks for), and on
the Home and Play tabs as a card.

---

## 4. Rules engine

### 4.1 Data: generated from the rules source

The rules data is **generated, not hand-maintained**. `tools/import-rules.mjs` reads `BB2025data/` and
writes `data/*.json`. The generated JSON is committed; the source pages stay gitignored. Re-running it after
a new FAQ or Spike! Journal is how rules updates get in.

- **Teams:** one file per team with tier, leagues, special rules, re-roll cost, apothecary allowed, staff
  costs, eligible star players and inducements. Each position has qty, name, **keywords**, stats,
  skills (with parameters, such as Loner 4+), **primary/secondary categories** and cost. Shared limits
  (the `*` Big Guy footnotes) are stored as data. Team colours and starter lineups (`box-teams.json`)
  carry over from the old site. `data/teams/full/` is deleted (R7).
- **Skills:** name, category (A/D/G/M/P/S/Trait), Active or Passive, mandatory (`*`), Elite, parameter
  (X / X+), and the position in the random-skill table. Every skill that changes a roll gets a
  **machine-readable effect** added by hand next to the imported data, for example
  `Accurate: { mods: [{ roll: 'pass', range: ['quick','short'], value: +1 }] }`. Skills that are purely
  descriptive stay prose-only, and the UI shows them as reminders instead of applying them.
- **Star players:** stats, skills, special rule, cost, Mega-star flag, "Plays For" leagues and teams, and
  pairs (Dribl & Drull, Grak & Crumbleberry, the Swift Twins).
- **Tables:** weather, kick-off events, injury, stunty injury, casualty (D16), lasting injury, prayers
  (D16), argue the call, expensive mistakes, advancement costs and the random-skill table. Each table
  belongs to a ruleset, so Sevens can replace any of them.
- **Tiers and Matched Play:** tiers (standard and Sevens), Mega-stars, skill points and limits.
- **Checks.** A schema test validates every generated file: stat ranges, qty strings, every skill name
  resolves, costs. A **diff report** against the old site's data is produced once and reviewed by the
  owner (§1.4 already lists the known differences).
- **Copyright.** The source site reproduces Games Workshop's rules text. The app ships **numbers, names and
  short paraphrased summaries**, not verbatim rules text. The importer keeps full text only in a local,
  gitignored cache, used to write and check the summaries. The fan-project disclaimer stays.

### 4.2 Engine modules

| Module | Responsibility |
|---|---|
| `rulesets.js` | **`standard` and `sevens`** (§8), defined from day one even though Sevens play ships later. Covers pitch geometry, players on the pitch, turns per half, setup rules, roster limits, budgets, which tables apply, kick-off deviation and throw-in dice, and the injury flow |
| `dice.js` | D3/D6/D8/D16/2D6/block dice; injectable RNG; physical-entry path; **dice source recorded on every roll** (digital, physical or server) |
| `modifiers.js` | Builds a **roll plan**: base target, then an ordered list of `{value, source, reason}` (skill, marking players, weather, range, and so on), then the final target. Follows the FAQ rule that a result can go below 1 but a D6 is never modified above 6. This is the "exciting math problem" from the old notes. |
| `skills.js` | Resolves which skills apply to a roll, which are optional ("Use Pro?"), which are blocked (Active skills while Distracted), and which re-rolls are available and in what order, given player, action, turn state and ruleset |
| `status.js` | Standing, Prone, Stunned, **Distracted**; conditions (Eye Gouge, Rooted, Chomped, Dodgy Snack, Blitz token); dugout boxes (Reserves, KO, Casualty, Sent-off) |
| `actions/*.js` | Move (Dodge, Jump, Rush, Stand up), **Secure the Ball**, Block, Blitz, Pass, Hand-off, Foul, Throw Team-mate, **Kick Team-mate**, Pick-up, Catch, Interception, Armour/Injury/Casualty, Scatter/Bounce/Throw-in, Kick deviation, Special Actions (Stab, Chainsaw, Projectile Vomit, Bomb, Hypnotic Gaze, Breathe Fire and so on) |
| `sequences.js` | Pre-game (Fans, Weather, Journeymen, Inducements, Kicking team), Start of drive (Set-up, Kick-off, Kick-off event), End of drive (Secret Weapons, End-of-drive effects, KO recovery), Stalling checks, half-time, Extra Time, end of game, Argue the Call and Bribes |
| `pitch-geometry.js` | Squares, zones (end zones, wide zones, line of scrimmage, Sevens No Man's Land and trapdoors), **pass range from the owner's 14×14 table** (not an equation), **interception band**: a rectangle 2 squares wide, centred on the line from the thrower's square centre to the landing square's centre. A Standing opponent can intercept if **any part** of their square overlaps it, excluding the thrower's and landing squares (Q18). Edge-only contact (zero overlap area) doesn't count; tests pin the boundary cases, tackle zones and marking, assists |
| `roster.js` | Team building and validation for league, Matched Play and Sevens: budgets, qty and shared limits, keyword limits, skill points, elite limits, star players, inducements |

### 4.3 The resolver contract (what makes uniformity possible)

Every action resolver has the same shape:

```js
resolve(action, state, ruleset) → {
  steps: [ { key:'pass', label:'Pass', owner:'home', plan: RollPlan, dice:'d6', optionalSkills:[...], rerolls:[...] }, ... ],
  next(stepKey, roll) → { outcome, branches: [ {label, owner, event, nextStep | terminal:true} ] }
}
```

`owner` says which coach makes that roll or choice (§7.2). The action sheet (§5.2) renders any resolver
without knowing which action it is. Tests walk every branch
of every resolver and assert each path ends in `terminal:true`. That enforces principle 8 in CI instead of
relying on manual testing.

**Engine success criteria:** at least 95% of skills with roll effects are covered by table-driven tests; the
owner's pass-zone table round-trips square by square; every resolver branch terminates; no DOM imports under
`engine/`.

---

## 5. UI system

### 5.1 In-game layout (phone portrait, the baseline)

```
┌───────────────────────────────┐
│ HOME 1 – 0 AWAY   H1 · T4 ⟲3 ⟲2 │  scoreboard bar: fixed, always visible
├───────────────────────────────┤
│  [Home ▾] [Away]   roster /    │  main area: roster list (default) or pitch
│  pitch toggle                   │  scrolls inside itself
│  …                              │
├───────────────────────────────┤
│ Block Blitz Pass Hand-off Foul …│  action bar: fixed, thumb zone, scrolls sideways
│ [📖 Reference]     [End Turn ▶] │  End Turn always bottom-right, always
└───────────────────────────────┘
```

Tablet and desktop use the same regions. The rosters sit side by side, and the action sheet docks to the
right instead of covering the screen.

### 5.2 The action sheet: one template for every action

Block, Pass, Foul and the rest all use the same frame, with zones always in the same order and position:

1. **Header.** Action name, acting team's colour, minimise, close. Minimising keeps every choice; only
   Close, Complete, or opening a different action clears it (from `BB skills.txt`).
2. **Participants.** Actor on the left, target on the right, shown as compact trading cards. Tapping one
   opens a picker sheet listing players sorted for the action (PA for throwers, AG for catchers), with the
   relevant skills highlighted. A player chosen on one side is greyed out on the other.
3. **Context (optional, fixed height).** The pitch for Pass, TTM, scatter and deviation; the block-dice
   count and assists for Block; the foul assists for Foul. Actions without context keep the zone collapsed
   to a known height, so the zones below it never move.
4. **Math.** The target number and modifier chips (`+1 Accurate`, `−1 Tackle zone`, `−1 Rain`). Every chip
   can be tapped to open the skill in the Reference drawer.
5. **Dice.** One dice widget everywhere, with three equal ways in:
   - **Roll:** digital dice.
   - **Enter:** tap the physical total, for example "8" for an armour roll. The engine applies modifiers and
     resolves the outcome.
   - **Pick result:** skip the dice and tap the outcome ("Armour broken → KO").

   No confirmation from the opponent is needed. A **Lock result** button covers the owner's mixed
   physical/digital requirement. Re-roll offers (team re-roll, Pro, Sure Hands and so on) appear here, in
   engine order.
6. **Footer.** The primary action is always in the bottom-right slot (Roll → Confirm → Next step →
   Complete), secondary on the left. The footer is pinned and never pushed below the frame, which fixes the
   brief's "cut off under the bottom frame".

On a phone the sheet is full height with a scrollable body between the pinned header and footer. On tablet
and desktop it's a docked panel of fixed size.

### 5.3 Reference drawer

The same components as the Reference tab, rendered in a drawer: Skills (searchable, filtered by category),
Teams, Star Players, Tables (kickoff, weather, injury, casualty, prayers, block dice, scatter), and Rules
(sequence of play, actions summary). Opening it mid-action keeps the action sheet exactly as it was.

### 5.4 Pitch component

A standalone pitch built from the spec in `BB skills.txt`: 26×15 plus end zones, thick lines at the
half-way line, the side-zone boundaries and the end-zone lines, and AWAY and HOME end-zone colours.
Pinch-zoom and pan are **anchored at the pinch point or cursor** (a past complaint). Pieces can be dragged
and snap to squares, or placed in two steps (pick, then tap a square). There's a zones overlay from the
pass table, and a pass line with interception detection.

- **Portrait phones: the pitch rotates vertical** (15 wide × 28 tall), giving about 25px squares at 375px.
  Landscape keeps it horizontal. Owner-approved (Q6).
- Reused for: Pass, TTM, kick deviation, bounce, throw-in, **saved kickoff formations** (an old feature
  request), and Learn to Play diagrams.

### 5.5 Loading and polish (answering "loads in multiple steps")

- One app load. After that, tabs switch instantly, from data already in memory.
- The five or six above-the-fold fonts are preloaded. Nuffle uses `font-display: block`, and the other faces
  use metric-matched fallbacks.
- Skeletons are sized exactly like the content they stand in for, so there's zero layout shift. Quips and
  titles are rendered statically.
- Motion stays short (≤200ms) and respects `prefers-reduced-motion`.
- **Budget:** first load ≤150 KB compressed CSS+JS+data; cumulative layout shift 0; no network requests on
  tab switch. Checked by a script in CI and by Lighthouse on a mid-range Android profile.

### 5.6 Player cards

One card component, used everywhere a player appears, in **four sizes that share one design**:

| Size | Where |
|---|---|
| **Full** | Card modal, team builder |
| **Compact** | Action-sheet participants, pickers |
| **Row** | Rosters, fielding |
| **Chip** | Pitch tokens, timeline entries |

- **Art:** the owner makes one placeholder image per team (no official product images). Cards look
  finished without art too, using team colours, position, number and keywords.
- **Later:** player-uploaded images (stored in R2 with size and count limits, §7.7) and per-team card
  customisation (frame, colours, accent). The data model reserves these fields from the start, so adding
  them doesn't reshape the card.
- The old container-query idea (all internals scale with card width) carries over, because it's what lets
  one design work at four sizes.

### 5.7 Platform-aware UI (web-first, ready to scale)

The build is **web-first** (Q19). From the start, the UI adapts to each platform, so it feels native as a
home-screen app now and as a packaged app later (§12.1).

| Platform | What changes |
|---|---|
| **iPhone** | Bottom sheets and a bottom action bar; safe areas (notch, home indicator); a swipe-down gesture closes sheets; no hover. Standalone (home-screen) mode is detected and hides web-only prompts. |
| **Android** | The **system Back button/gesture closes the top sheet or drawer before leaving a screen**, because every sheet is a history entry in the hash router; Material-style ripple on buttons; the same layout otherwise. |
| **iPad / tablet** | Two panes: rosters or the pitch on one side, the action sheet docked on the other. Both teams' rosters are visible side by side. Works in split view and slide-over (the layout responds to window width, not device type). |
| **Desktop / laptop** | Same two-pane layout, plus hover previews on skills and **keyboard shortcuts** (B block, P pass, E end turn, R roll). |
| **Third screen** (§12.2) | Display layouts: large type, no controls, landscape-first |

- The layout is chosen from **window width and input type** (`pointer: coarse/fine`, `hover`), not user
  agent. There are three layout tiers: phone, tablet and desktop.
- Every component in `dev/design-system.html` is shown in all three tiers. Phase 2 sign-off includes
  screenshots on an iPhone, an Android phone and an iPad.
- Haptics, share and camera go through `platform.js` (§12.1). On the web they fall back to the vibration
  API, the Web Share API and a file input.

---

## 6. "Your own" site: records and stats

| Surface | Contents |
|---|---|
| **You → History** | Every game you played (local or live): date, teams, opponent, score, result, ruleset (Standard or Sevens), game type (Exhibition, League or Matched). Opens a match page with the timeline (TDs, casualties, turnovers). Abandoned games are listed, and can be resumed or deleted. |
| **You → Teams** | Your teams with a record (W-D-L, TD for/against, CAS) and the team's game list. |
| **Player page** | Per player on a saved team: games, TDs, completions, interceptions, CAS inflicted/suffered, MVPs, SPP, advancements, lasting injuries. |
| **Coach profile** (public, existing) | Extended with a record and favourite teams. |

**Backend.** Because only accounts are being kept (§0.1), the schema can be redesigned cleanly rather than
patched:

- `games`: every game (local or live). It holds the owner, the two sides (team snapshot, coach user id
  or guest name), ruleset, game type, scores, status, timestamps, and the **event log**.
- `player_game_stats`: written server-side from the event log when a game is saved, so profile and
  player pages are simple queries rather than log replays.
- Signed-out users keep history locally (IndexedDB). On sign-in they're offered an upload.

**No SPP or advancement in the rebuild.** Exhibition and Matched Play games don't earn SPP (§1.4), and
league play is a future feature (§10). History still records the **stats** from every game (TDs,
completions, interceptions, CAS, MVP), which is what "stats for specific players" needs. SPP, advancement
and lasting injuries arrive with leagues, on league teams kept separate from standard teams.

**Constraint to note:** per-player stats only follow a player across games on a **saved team**. Default
teams ("Orc", "Human") have no persistent players, so those games record team-level results only. That's
consistent with how Blood Bowl leagues work, and the UI should say so.

---

## 7. Live two-device play: designed in from the start

The current site added live play after single-device play worked, and it shows: the Durable Object mirrors
UI state. In the rebuild, **a game is the same thing whether it's on one device or two.** Only the
transport differs.

### 7.1 One protocol, two transports

- The game session talks to a **transport**. `LocalTransport` appends events to IndexedDB.
  `LiveTransport` sends them over a WebSocket to the game's Durable Object. The UI, the store and the engine
  never know which one they're using.
- **The engine is isomorphic.** It's plain JavaScript with no DOM, so the Durable Object runs the **same
  engine modules** as the browser (wrangler bundles them into the worker). The DO checks every submitted
  event against the rules and the current state before appending it. The two devices can't drift apart,
  because there's one ordered log and one referee.
- **Dice authority:** in live games, digital dice are rolled **by the Durable Object**, so a device can't
  quietly re-roll. Physical entries (a total, or a picked result) come from the owning coach's device and
  are simply shown to the opponent. **No acknowledgement is needed** (Q11).

### 7.2 Every decision has an owner

This is the rule that makes two devices work, and it has to be in the engine from Phase 1. Blood Bowl asks
the *inactive* coach to decide things all the time:

- the defender picks the block die when stronger;
- the opposing coach makes Armour, Injury and Casualty rolls;
- Apothecary use;
- which player attempts an Interception;
- Dump-off, Diving Tackle, Shadowing and Stand Firm;
- Argue the Call and Bribes;
- the kicking team sets up first;
- random player selection for Pitch Invasion or Sweltering Heat.

The resolver contract (§4.3) therefore gives every prompt an **`owner: 'home' | 'away'`**.

- **One device:** the prompt appears in the sheet in the owner's team colour ("Orc coach decides").
- **Two devices:** it appears on the owner's device, and the other shows "Waiting for the Orc coach…" in
  the same slot. Layout never changes between the two modes (principle 4).

### 7.3 Session features

- Create a game and invite by **code, link or QR**; join from Play.
- Presence indicators and turn control, which alternates as today but is driven by the event owner.
- **Reconnect** replays the log.
- **Undo** in a live game needs the opponent's approval.
- **Spectators** get read-only replay.
- If a connection is lost for good, either coach can **"Continue on this device"**, which pulls the log and
  switches to local play.
- **Guests (Q14):** the second coach can join **without an account** via short code or invite link. They
  pick from the **host's teams** or the default teams. The game is saved to the host's history. If the
  guest signs up later on the same device, they're offered the chance to claim it.
- **Testing:** every phase from 5 onward has a **two-client test**. The store tests run two sessions
  against an in-memory relay. The browser smoke pass drives two tabs.

### 7.4 Accounts and data migration

- **Accounts are ported.** `users` (with password hashes and email-verified state) carries over unchanged,
  so everyone keeps their login. Active sessions can be kept or expired: expiring is simpler and costs one
  re-login.
- **Everything else is dropped:** teams, photos (including the R2 objects), tournaments and live-game rows.
  New tables are created for the rebuilt features. Old `localStorage` teams are not migrated.
- The auth endpoints (`functions/api/auth/*`, `_lib/*`) are kept as-is. Other endpoints are rewritten to
  the new schema.

### 7.5 Tournaments

Extended for the 16-team requirement, and built on the **Matched Play** rules (§1.4):

- **Organizer-managed entries:** an entry is a team with a coach, where the coach can be a site user *or a
  guest name*. This removes the one-account-per-entry limit (R8).
- **Rosters are entirely in-app (Q20).** When entering, a coach either picks an existing team or builds a
  new one.
  - **"Prepare for this tournament"** makes a **tournament copy** of the team. The coach revises the copy
    to fit the event's rules (budget, skill points, star players, inducements), and the original team is
    never changed.
  - The builder checks the copy **live against the tournament's rules**, showing every problem inline
    ("2 Secondary skills over the Tier 1 limit").
  - The coach submits the roster. The organizer can review it and approve it or send it back.
  - At the registration deadline the roster **locks**. Every tournament game uses the locked roster.
  - Guest-coached entries are built by the organizer or the guest's host.
- **Roster checks** against the event's settings: budget (1.1M, 1.15M, 1.2M or custom), tier skill points,
  Secondary and Elite limits, star players and Mega-stars, and allowed inducements. Settings are per
  tournament, with Games Workshop defaults. The same check module (`roster.js`) runs in the builder and on
  the server at submission.
- **The organizer configures everything (Q3):**
  - format: Swiss, round-robin, single elimination, groups into knockout, or manual pairing;
  - points for W/D/L;
  - bonus points (for example per TD or CAS threshold);
  - the order of tie-breakers;
  - the ruleset (Standard, or Sevens once available);
  - roster rules.

  Built as settings with sensible presets, not hardcoded formats. **Pending:** the owner's organizer
  friend's input on what real events use.
- **Tournament games live in the tournament.** They are not started from New Game.
  - The organizer publishes a round's pairings.
  - Each pairing creates a **locked game** with the two registered teams and the tournament's rules.
  - The coaches start it together from the tournament page (live or on one device), and **both confirm the
    final result**, which then posts to standings.
  - The organizer can override or enter a result by hand, for example when a game was played on paper.
- Standings, round view, bracket, and the photo wall (kept).
- Sevens tournaments use the Sevens Matched Play rules (600k, 1–4 skill points, one Secondary skill,
  Sevens tiers).

### 7.6 Test environment

- A **separate D1 database** (`bloodbowl-db-test`), R2 bucket and Durable Object namespace, bound to a
  Cloudflare Pages **preview branch** (`test`), so nothing touches production data.
- `npm run seed:test` creates:
  - a test organizer;
  - 16 Matched Play-legal teams (a spread of tiers), some owned by test accounts and some guest-coached;
  - an empty tournament ready to start.
- `npm run reset:test` wipes and reseeds.
- The owner then walks the tournament by hand: assigns players, pairs rounds, records matches. A scripted
  **simulated run** (random results through every round to completion) is also provided, so standings,
  tie-breaks and byes can be checked before the manual walk-through.

### 7.7 Cost guardrails (target: nothing beyond the $5/month Workers plan)

A handful of users sits far inside every included allowance. The risks are runaway loops and abuse, so the
design guards against those:

- **Static app with offline-first play.** Pages hosting and requests to static assets are free and
  unmetered. Local games never touch the backend.
- **Durable Objects** only run for live games and use the **WebSocket Hibernation API**, so idle games cost
  nothing while connected. There's one object per game, and finished games are closed.
- **D1:** small rows; the event log is written in batches (per turn, not per tap); indexed queries only.
- **R2 (photos and card images):** client-side resize before upload, a per-user count and size cap, and a
  per-account upload rate limit. The free R2 allowance covers far more than this.
- **Rate limits** on auth, join-by-code and uploads, reusing the existing `rate_limits` table.
- A monthly usage check (the Cloudflare dashboard, or a small scheduled report) as an early warning.
- **App stores (§12) are the only real cost exposure.** Apple's developer programme is $99/year. That's a
  decision to make, not something the plan assumes.

---

## 8. Sevens: built into the model now, playable after the rebuild

Sevens (Spike! Journal 22) follows the core rules with the differences below. The **`sevens` ruleset is
defined in Phase 1** alongside `standard`, so every engine function, the pitch, the team builder and
tournaments take it into account from the start. Sevens *play* is switched on after the rebuild (Phase
11). Until then it shows as a greyed-out "Coming soon" option in New Game.

| Area | Standard | Sevens |
|---|---|---|
| Pitch | 26×15 plus end zones | **20×11 including end zones** (owner-confirmed): wide zones 2 squares, centre 7, two Lines of Scrimmage with a 6-square **No Man's Land**, and **Trapdoors at (6,10) and (15,2)** with (1,1) in the lower-left end zone (Q17) |
| Players on pitch | 11 | **7**; at least 3 in the centre on the LoS, at most 1 per wide zone, none in No Man's Land. Can Concede Without Penalty if under 3 are available. |
| Turns and re-rolls | 8 per half | **6 per half**, re-roll track to 6 |
| Roster | 11–16, 1M | **7–11**, **600k**, **≤4 players without the Lineman keyword**, re-rolls 100k, Assistant Coaches and Cheerleaders 20k (max 3), Apothecary 80k, Dedicated Fans 1–5 (+20k each) |
| Veteran | none | One Lineman is the Veteran: −1 MA, one re-roll per game on a failed pick-up, catch, pass or own-block knockdown |
| Kick-off | deviation D6 | deviation **2D6, use the lower**. Landing in No Man's Land is not a touchback. |
| Kick-off events | standard table | Sevens table (Alert Defence, D3+1 players, and so on) |
| Injuries | Injury then Casualty (D16) | Own **Injury and Stunty Injury tables** with **no Casualty roll** and no lasting injuries |
| Throw-ins | 2D6 | **D6+2** |
| Argue the Call | standard | "Amateur Referees" D6 table |
| Prayers | D16 | **D8** Sevens table (includes Trapdoor) |
| Inducements | standard | shorter list and costs, plus **Desperate Measures** (D8) |
| League | SPP and advancement | no SPP: one random skill per game; Drafted Players; Emergency Call-ups; Re-draft cap 750k |
| Matched Play | tier SP 6/8/9/10 | tier SP 1/2/3/4, one Secondary skill total, max 2 Elite, **Sevens tier list** |

A **stub-ruleset test** (a full scripted game under `sevens` geometry, turns and setup) runs in CI from
Phase 1, so a hardcoded 11, 16 or 26×15 fails long before Sevens ships.

---

## 9. Quality: testing, devices, performance

### 9.1 Testing

- `node test/engine.test.mjs`: table-driven rules tests (the bulk of the tests), run under both rulesets.
- `node test/store.test.mjs`: event replay, undo, persistence round-trip, reload idempotence (R1 as a
  regression test), and **two sessions against an in-memory relay** (§7.3).
- `node test/ui.test.mjs`: component logic against DOM stubs, as in `localai`.
- `node test/import.test.mjs`: the rules importer against fixed samples. This includes errata `<del>`
  handling, keyword parsing and the shared Big Guy limits.
- **Dice timing is injected** (`raf`/`now`/RNG passed in, as `localai` does). The old code's dice
  animations hung the headless preview and blocked every wizard click-through. This fixes that, so full
  action flows can be driven and screenshotted automatically.
- Lesson from `localai`'s handoff (all UI tests passed while the page was dead in a browser): every phase
  also gets a **real-browser smoke pass** (open, click through, console clean, screenshot at 375 and
  1280), with **two tabs** for anything that touches a game.

### 9.2 Devices

Target: iPhone SE (375) through Pro Max, mid-range Android (Chrome), iPad portrait and landscape, desktop.
Every phase's sign-off includes screenshots at 375×667, 390×844, 768×1024 and 1280×800.

### 9.3 Offline (core, first release)

Offline local play is the heart of the app (Q8). Games are played in basements and game stores with poor
signal.

- A **service worker** precaches the app shell, fonts and all rules data at install. A version bump swaps
  the cache in one step, so a half-updated app never runs.
- **Local games, teams, settings and history live in IndexedDB.** The app calls
  `navigator.storage.persist()` so the browser doesn't evict them. This matters on iOS, where Safari can
  clear data for websites that haven't been used for a while.
- **Sync when back online** (signed-in users): teams and finished games upload, conflicts resolve by
  last-write per team, and game logs are append-only so they never conflict.
- Live games need a connection. If it drops, a coach can "Continue on this device" (§7.3).
- **Test:** an airplane-mode run (a full local game with the network disabled in the browser) is part of
  Phase 5's and Phase 6's sign-off.

---

## 10. Phases

Each phase ends with something the owner can click through and sign off. Nothing replaces the live site
until Phase 10. **From Phase 5 on, every "done when" includes working on two devices.**

**Where the new site is built:** in `bloodbowl-next/` alongside the current site, served at
`/bloodbowl-next/` (unlinked). At cutover, `bloodbowl-next/` becomes `bloodbowl/`, and old deep links
(`/bloodbowl/skills/`, `/bloodbowl/game/` and so on) redirect to the new hash routes via `_redirects`.
Owner-approved (Q5).

| # | Phase | Delivers | Done when |
|---|---|---|---|
| 0 | **Decisions and foundations** | Answers to §11; repo skeleton; test runners; local dev with `wrangler pages dev` + local D1/DO; test environment (§7.6) provisioned | Skeleton serves at `/bloodbowl-next/`; `npm test` runs; test D1 seeded |
| 1 | **Rules data and engine core** | `tools/import-rules.mjs` + generated data; diff report vs old data; `rulesets` (standard **and** sevens), `dice`, `modifiers`, `skills`, `status`, `pitch-geometry`, `roster`; the resolver contract **with prompt owners** | Import and schema tests green; owner reviews the diff report; pass-zone table test green; Sevens stub-ruleset test green |
| 2 | **Shell, offline and design system** | App shell, router, tabs, tokens, fonts; **service worker and IndexedDB** (§9.3); web app manifest (installable, §12.1); every component in `dev/design-system.html` (sheet, drawer, **card in all four sizes**, dice widget with Roll/Enter/Pick, picker, roster row, "waiting for opponent" state, buttons) | Owner reviews the design-system page on phone and desktop; CLS 0; the app installs to the home screen and opens in airplane mode |
| 3 | **Reference** | Skills, Teams, Star Players, Tables, Rules as a tab **and** as the drawer | All 2025 reference content is reachable; search works; drawer opens over a dummy sheet without losing state |
| 4 | **Accounts and Teams** | New schema with `users` carried over; auth kept; My Teams; team builder (league and Matched Play validation); cloud sync; public browse | Existing accounts log in on the new site; a team round-trips to the cloud; builder usable one-handed at 375 |
| 5 | **Game sessions (local and live)** | Event store, transports, DO event relay running the engine, DO dice; New Game flow (carries the lineup selection; own teams first; "Other teams"; defaults to Other teams if nothing chosen); invite/join by code, link or QR; Resume/Save/Discard; Continue pill; reconnect; spectate; game Settings | Brief's New Game and Continue issues pass as written; reload never changes state (R1 test); the same scripted game replays identically on a local and a live transport |
| 6 | **Play core** | Scoreboard, turn engine, pre-game sequence, set-up (readable at 375), kick-off sequence, statuses and conditions, re-roll tracking, stalling, half-time, extra time, end of game, pitch component | A full game can be played start to finish **on one device and on two phones**, using status changes and score only |
| 7 | **Action sheets** | The single template; Block first, then Pass (full `BB skills.txt` spec), Foul, Blitz, Hand-off, Secure the Ball, TTM/KTM, Dodge/Rush/Jump/Pick-up, special actions; opponent prompts | Every resolver branch terminates (test); owner signs off Block, Pass and Foul side by side for uniformity, on one and two devices |
| 8 | **Records and You** | History, match page, team records, player stat pages, MVP; offline history syncing on sign-in (no SPP or advancement: that's League, Phase 12) | A finished local game and a finished live game both appear in History for both coaches, with correct player stats |
| 9 | **Tournaments** | Organizer settings (format, scoring, tie-breakers, roster rules); guest entries; Matched Play roster checks; pairings; **locked tournament games** started and confirmed by both coaches; organizer overrides; 16-team simulation | Scripted 16-team run completes; **owner's manual walk-through on the test env** passes |
| 10 | **Learn to Play and cutover** | Learn to Play (§10.1); redirects; retire the old site; archive old docs | Every old URL resolves; no references to old files remain |
| 11 | **Sevens** (after rebuild) | Enable the `sevens` ruleset: Sevens pitch, set-up rules, tables, Veteran, Desperate Measures, Sevens team building, Sevens Matched Play | A full Sevens game (one and two devices), a Sevens team build, and a Sevens tournament all work |

**Future work after the rebuild** (order to be decided, not scheduled):

| Item | Notes |
|---|---|
| **League play** | Commissioner-run leagues. League teams are **kept separate from standard teams**. Adds SPP, advancement, lasting injuries, deaths, the post-game sequence, journeymen, re-drafting, and Sevens league rules. Reuses the tournament machinery for fixtures and standings. |
| **Third screen** | Scoreboard, turn tracker and tournament board displays (§12.2). |
| **Packaged apps** | iOS/iPadOS and Android wrappers (§12.1). |
| **Card customisation** | Uploaded player images and card styling (§5.6). |
| **Event packs** | Optional themed tables and pitches from Spike! Journals 19–21 for tournaments (§1.4). |

### 10.1 Learn to Play

Three layers, all reusing the real components:

1. **Primer:** a short guided page covering what Blood Bowl is, the sequence of play, the turnover rule,
   and the core actions, with pitch diagrams from the pitch component.
2. **Guided first drive:** a scripted game (fixed teams, fixed dice) played in the real game UI, with
   coach-mark prompts ("Tap Block. Your Blitzer has ST 3 against their Lineman's ST 3, so you roll one die.
   Tap Roll."). It uses a "tutorial" flag and never records to History.
3. **Tips inside real games (toggle in Settings):** the first time each action is used, a one-line
   explanation, plus a "Why this number?" link on every math chip.

### 10.2 Settings

- **Game:** default dice mode (digital, physical or ask each roll), confirm before End Turn, auto-apply
  weather, show optional-skill prompts, tips on/off.
- **Display:** reduced motion, pitch orientation lock, text size.
- **Rules:** default ruleset (Standard, or Sevens once available).
- Stored per device; mirrored to the account when signed in.

---

## 11. Open questions

### Answered (2026-09-30)

Q1, Q2, Q4 and Q9 (revision 2); Q3, Q5–Q8 and Q10–Q16 (revision 3); Q17–Q19 (revision 4). The answers are
recorded in §0.1 and the table below. Q3/Q20 are partly open: the owner is gathering real-event scoring
details from an organizer friend.

| Q | Answer |
|---|---|
| Q17 Trapdoors | (6,10) and (15,2), point-symmetric |
| Q18 Interceptions | Any part of the square inside the 2-square band counts |
| Q19 App stores | The fee would be acceptable. **Build web-first**, stay hyper-aware of scaling to packaged apps, and give each platform an appropriate UI (§5.7) |
| Q20 Rosters | Entirely in-app. Existing teams can be revised as tournament copies, or new teams built for the event (§7.5) |

### Still open

**Q20 (partly).** Formats, bonus-point rules and tie-breakers from the owner's organizer friend. Rosters
are settled: entirely in-app (§7.5).

---

## 12. Beyond the browser

### 12.1 Installable apps (iPhone, iPad, Android)

The same code can reach app-like use in three steps, each building on the last. Nothing in the rebuild has
to change for steps 2 or 3, provided the rules below are followed from Phase 2.

**Decision (Q19): web-first.** Steps 2–3 happen when wanted; the fee is acceptable then.

1. **Installable web app (PWA), part of the rebuild, free.** A manifest, icons, a splash screen, standalone
   display (no browser bars), a service worker, and orientation handling.
   - On iPhone and iPad: "Add to Home Screen" gives a full-screen icon app that works offline.
   - On Android: Chrome offers "Install app".
   - This covers "use it outside the browser" for most purposes, at no cost.
2. **Packaged apps with Capacitor** (after the rebuild). Capacitor wraps the same `bloodbowl` folder in a
   native iOS and Android shell, with no rewrite. It adds App Store and Play Store distribution, sturdier
   storage, native haptics (dice rolls), share sheets, and a camera for card photos.
   - Cost: Apple Developer Program **$99/year** (needed even for TestFlight on your own devices beyond
     7-day sideloads); Google Play **$25 once**.
   - Build: iOS builds need Xcode on a Mac, which you have.
3. **Store release** if you want others to install it. App review mostly asks for privacy details and
   working account deletion, which should be added anyway.

**Rules for the rebuild that keep step 2 free of rework:**

- All asset and route paths are **relative** (no reliance on `/bloodbowl/` at the root).
- The API client supports **token auth** as well as cookies. A packaged app runs from its own origin
  (`capacitor://localhost`), where cookie sessions to `make.contrapaul.com` are unreliable, so the API
  needs CORS for the app origin plus bearer tokens.
- There's a **"delete my account"** endpoint (Apple requires it for apps with accounts).
- Hardware features (haptics, camera, share) are called through one small `platform.js` module that
  falls back to web APIs.

### 12.2 The "third screen"

The event-log design makes this almost free. A third screen is just **another client of a game or
tournament**, with a display layout instead of controls:

| Display | Shows |
|---|---|
| **Scoreboard** | Teams, score, half, turn for each team, re-rolls left, weather, the last event ("TD! Orc Blitzer #6"). Big type for a tablet or laptop at the table. |
| **Turn tracker** | Active team, turn number, a turn timer if the table wants one, blitz/pass/foul used this turn |
| **Dugouts** | Reserves, KO and casualty boxes for both teams |
| **Tournament board** | Round pairings, table numbers, live scores of games in progress, standings. Suits a TV at an event. |

- **How it connects:** open `#/display/<code>` on any device, or scan a QR shown in the game menu. It
  joins as a read-only spectator (the protocol from §7.3) and needs no account.
- **Local games** stay offline-first. A local game can optionally **mirror** its events to the relay when
  online, so a display can follow it. If there's no connection, the display just waits.
- **Cost:** one extra WebSocket per display on an existing game object. Negligible.
- **When:** after the rebuild. The only rebuild requirement is that spectator mode (Phase 5) is a clean,
  read-only client, which it already is.

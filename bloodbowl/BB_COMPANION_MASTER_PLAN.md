# Blood Bowl Companion — Master Plan
**Version 1.1 — Step 0 Planning Document**
**For use with Claude Code as iterative build instructions**

---

## Project overview

A web-based Blood Bowl 2025 match companion. Target: iPad-primary, desktop-friendly, mobile-acceptable. Deployed as a static site on Cloudflare Pages via GitHub. Real-time multiplayer via Supabase. Local persistence via localStorage.

**Core mission**: eliminate the slow, tedious parts of playing Blood Bowl — looking up tables, calculating modifiers, resolving multi-step sequences — without getting in the way of players who already know what they're doing.

**Repository**: existing repo with `bloodbowl/` subdirectory
**Live URL**: make.contrapaul.com/bloodbowl (current), future dedicated subdomain
**Rules reference**: https://bloodbowlbase.ru/bb2025/core_rules/
**Existing codebase**: bloodbowl/ with working foundations

---

## Confirmed decisions

| Question | Decision |
|---|---|
| URL / location | `make.contrapaul.com/bloodbowl` for now. Keep existing site-header/footer shell. |
| Default dice mode | Digital. Physical is the toggle. |
| Pitch tracking scope | Distance-grid for pass/throw wizards only. No full 22-player pitch tracking. |
| Supabase | Deferred to Sprint 8. No setup needed until then. |
| Typography | JetBrains Mono only, full weight/style range. No display font. |
| Tap count target | 3 taps for simple actions (block, injury). Complex actions (throw team-mate, pass) are allowed more steps — the value is seeing the probability and outcome, not speed. |
| Weather modifiers | Must appear automatically in every action where they are mechanically relevant. Not opt-in. Not hidden. |

---

## Design principles (binding)

**1. Context is king.** If the app knows something (who has the ball, what the weather is, which players are KO'd), it uses that information automatically. The player should never re-enter what the app already knows.

**2. Complexity earns its steps.** A block is 3 taps. A Throw Team-Mate with Always Hungry + scatter + landing is 8–10 taps — that's correct, because you're seeing things you'd otherwise have to look up. The experience is "I understand what's happening" not "this is fast."

**3. Weather is never invisible.** Any wizard step where weather applies shows a persistent weather chip (e.g. "🌧 Pouring Rain: −1 to catch"). It's automatic, not opt-in. This is the most commonly forgotten modifier in the game.

**4. Results teach.** Every dice result — especially in Beginner mode — explains what it means mechanically. A "Both Down" result says what happens to each player and mentions Block skill. A "Casualty" result shows the full cascade. The app is a rulebook you never have to open.

**5. Physical dice are first-class.** Toggling to physical mode is not a concession — it's a valid primary workflow. Some players will roll physical for all in-game actions and only use digital for start-of-drive sequences. Some will do the reverse. Per-wizard defaults in settings respect this.

**6. Never block the table.** Any full-screen element (wizards, results) must be dismissible. Players need to see the physical board. Long results scroll rather than expanding. Wizards can be minimised to a floating summary pill.

---

## What is working (do not break)

- `dice.js`: D6/D8 pip rendering, roll animation, `Dice.rollDieElement()`, `Dice.roll2D6()`. Solid — keep it.
- `state.js`: GamePhase state machine, TIMELINE_STEPS, PlayerStatus enum, STATUS_META, player status cycle/menu system, `getPlayerStatus/setPlayerStatus`, `getPlayerList`. Architecture is correct — rebuild UI around it, don't touch internals.
- `data/` directory: All JSON is correct and complete. Do not modify unless adding fields.
- `script.js`: Team loading, roster card rendering, skill tooltip system, trading card modal. Keep skill lookup logic; card styling will evolve.
- CSS `--tc-*` theming system: keep the pattern.

## What is broken or missing

- **Weather**: rolls dice but result display is empty/broken
- **Kickoff events**: rolls but result doesn't render
- **Prayers to Nuffle**: result display broken
- **Re-roll**: no re-roll button exists anywhere — critical missing feature
- **Block wizard**: player selection unreliable; dice tray sometimes wrong count
- **Pass wizard**: no pitch distance grid; player selection awkward; modifier cascade incomplete
- **Foul wizard**: player selection doesn't populate; target filtering not working
- **Injury cascade**: armour → injury → casualty doesn't always complete; result display sometimes blank
- **Timeline**: exists but passive — doesn't drive anything
- **Module dimming**: confusing — unclear what's currently usable
- **UI overall**: dashboard aesthetic, not game companion aesthetic

---

## File structure

```
bloodbowl/
  index.html
  style.css
  script.js
  css/
    game-bar.css          (existing — keep)
    panels.css            (existing — rebuild content)
    dice.css              (existing — keep)
    wizards.css           (existing — extend)
    pitch.css             NEW: pass distance grid
    team-builder.css      NEW: team builder UI
  js/
    dice.js               (existing — keep)
    state.js              (existing — extend only)
    panels.js             (existing — fix + extend)
    wizards.js            (existing — major rebuild)
    pitch.js              NEW: distance grid component
    team-builder.js       NEW: team builder + localStorage
    sync.js               NEW (Sprint 8): Supabase layer
    settings.js           NEW (Sprint 5): preferences
  data/
    (all existing JSON — do not modify)
  WEB/
    css/
      jetbrains-mono.css  (existing — local font file, keep)
```

---

## Extended GameState (add to state.js in Sprint 1)

Do not replace the existing GameState object. Add these fields:

```js
// Additions to GameState in state.js
Object.assign(GameState, {
  scores:            { home: 0, away: 0 },
  rerolls:           { home: 0, away: 0 },
  rerollsTotal:      { home: 0, away: 0 },
  rerollUsedThisTurn: false,   // reset at start of each team turn
  ballCarrier:       { side: null, playerIdx: null },
  weather:           null,     // full weather result object from weather.json
  kickoffEvent:      null,     // full kickoff event result object
  kickingTeam:       null,     // 'home' | 'away'
  gameMode:          'veteran',  // 'beginner' | 'veteran' | 'pro'
  diceMode:          'digital',  // global default
  diceModeOverrides: {},         // per-wizard overrides: { 'block': 'physical', ... }
  syncEnabled:       false,
  roomCode:          null,
  playerSide:        null,     // which side this client controls in multiplayer
});
```

---

## Dice mode system

Each wizard reads its effective mode from a single function:

```js
function getWizardDiceMode(wizardKey) {
  return GameState.diceModeOverrides[wizardKey] ?? GameState.diceMode;
}
```

`wizardKey` values (one per rollable action):
`'block'`, `'pass'`, `'catch'`, `'intercept'`, `'pickup'`, `'injury-armour'`, `'injury-roll'`, `'injury-casualty'`, `'foul'`, `'throw-teammate'`, `'throw-landing'`, `'scatter'`, `'bounce'`, `'throwin'`, `'weather'`, `'kickoff'`, `'prayers'`, `'ko-recovery'`, `'always-hungry'`, `'dauntless'`, `'pro'`

**Digital mode**: animated dice + Roll button. Existing behaviour.

**Physical mode**: dice tray and Roll button replaced by result-tap buttons. Tapping any button immediately calls the same `resolveResult(value)` function that the digital path uses after rolling. The consequence logic is identical — only the input method differs.

Physical buttons are always labelled with both the die value and the mechanical consequence in context. A "9" on an armour roll doesn't just say "9" — it says "9 — KO'd" for injury context, or "9 — Miss (AV9+)" for armour context. The label is computed from the loaded data, not hardcoded.

---

## Weather modifier system (cross-wizard)

Weather affects these actions mechanically:
- **Very Sunny (3)**: −1 to all Passing Ability tests
- **Pouring Rain (11)**: −1 to Pick Up, Catch, and Intercept
- **Blizzard (12)**: −1 to Rush; only Quick/Short passes allowed (Long and Long Bomb auto-fumble)
- **Sweltering Heat (2)**: end-of-drive effect only (no in-action modifier)
- **Perfect Conditions (4–10)**: no modifier

Implementation: `getWeatherModifiers()` function in `panels.js` returns an object:
```js
{
  pass: -1,       // modifier to PA test (0 if no effect)
  catch: -1,      // modifier to catch/intercept/pickup
  rushPenalty: true,  // if true, Rush has additional -1
  longPassBlocked: true  // if true, Long and Long Bomb auto-fumble
}
```

Every wizard that touches a roll affected by weather must:
1. Call `getWeatherModifiers()` at initialisation
2. Automatically apply the relevant modifier
3. Show a weather chip in the modifier area: `🌧 Pouring Rain: −1 to catch`
4. The chip is always visible while the modifier is active. It is not a toggle — it cannot be disabled by the user unless the weather itself changes.

---

## Re-roll system

**Rule**: one re-roll per roll attempt per team per turn. Using a team re-roll sets `GameState.rerollUsedThisTurn = true`. This resets at turn change.

Every result display must show a re-roll section below the result, containing whichever of these apply:

**Team re-roll button** — shown if:
- `GameState.rerolls[activeSide] > 0`
- `GameState.rerollUsedThisTurn === false`
- The roll type is re-rollable with a team re-roll (most are; Armour/Injury/Casualty are NOT re-rollable with team re-rolls)
- Label: `↺ Team Re-roll (N left)`
- If player has Loner: `↺ Team Re-roll — Loner: roll X+ first`

**Skill re-roll buttons** — shown based on relevant player's skills:
- Block skill active: `↺ Block: cancel Both Down` (only on Both Down result)
- Pass skill active: `↺ Pass: re-roll failed PA test`
- Catch skill active: `↺ Catch: re-roll failed catch`
- Sure Hands: `↺ Sure Hands: re-roll failed pick-up`
- Sure Feet: `↺ Sure Feet: re-roll failed rush`
- Dauntless: shown in block setup, not result
- Pro: `↺ Pro: roll 3+ to re-roll any die`

Behaviour: tapping any re-roll button re-executes the roll (digital: re-animates dice; physical: shows result buttons again). Result display updates in-place with a `↺ Re-rolled` label. Re-roll button disappears after use.

In physical mode re-roll: the result buttons reappear. Player taps the new result. Same consequence logic runs.

---

## Throw Team-Mate wizard — full sequence spec

This is the most complex wizard. It earns its steps because the sequence has genuine decisions and the probabilities are non-obvious. Expected tap count: 8–12 depending on outcome.

```
Step 1: Select thrower (list from loaded roster, filtered to players with Throw Team-Mate trait)
        → Auto-populate Strength value
        → If Always Hungry trait present: show warning chip

Step 2: Select thrown player (list filtered to players with Right Stuff trait)
        → Auto-populate player's relevant stats

Step 3: Select throw range
        [Short — up to 3sq] [Long — 4-6sq]
        → Updates throw target (4+ or 5+)
        → Strong Arm: auto-applies +1 if thrower has the skill

Step 4: Trait checks (shown only if applicable)
        [a] Always Hungry check (if applicable):
            Roll D6 — need 2+. If 1: teammate eaten, sequence ends with
            "Badly Hurt — no Casualty roll" result and flavour text.
        [b] Hail Mary Pass toggle (if thrower has skill):
            Enables any range; forces Inaccurate result regardless of roll.

Step 5: Throw roll
        Digital: D6 animation → result
        Physical: 6 labelled buttons:
          [1 — Fumble: teammate dropped] [2 — Miss (Short 4+)] [3 — Miss]
          [4 — Hit! (Short)] [5 — Hit! (Long 4+)] [6 — Superb!]
        Computed against throw target. Shows: result label + what happens next.
        Superb throw with Bullseye skill: teammate lands exactly on target.

Step 6: Scatter (if Inaccurate or Fumble)
        Shows D8 compass. Either animate or tap direction.
        Fumble: teammate placed in thrower's square instead.

Step 7: Landing roll
        The thrown player must roll 4+ to land safely.
        Modifier chips shown: [−1 per tackle zone] [+1 Landing skill]
        Weather: Pouring Rain / Blizzard shown if relevant (no direct modifier but noted).
        Roll D6 → if 4+: "Safe landing!" → if <4: "Crash! Knocked Down in square [X]"

Step 8 (if crash landing): Armour roll
        Pre-populated with the thrown player's AV.
        Runs full injury cascade if armour breaks.

At every step: show a persistent summary strip at the top:
  "[Thrower name] → [Target name] | [Range] | Throw: [result] | Landing: [result]"
  This summary persists even when scrolled, so players always know the current state.
```

---

## Pass wizard — full sequence spec

```
Step 1: Select thrower
        List from loaded roster. If ball carrier is tracked in GameState,
        pre-select that player automatically.
        Shows: PA stat, relevant skills (Accurate, Cannoneer, Cloud Burster,
        Nerves of Steel, Dump-Off, Safe Pass, Hail Mary Pass).

Step 2: Select catcher
        List from loaded roster (any player on same side).
        Shows: AG stat, relevant skills (Catch, Diving Catch, Nerves of Steel).

Step 3: Set distance on range grid
        13×13 grid. Thrower defaults to centre.
        Tap a square for catcher position.
        Grid zones colour-coded: green (Quick 1–3), yellow (Short 4–6),
        orange (Long 7–10), red (Long Bomb 11–13).
        Adjacent square: shows "Hand-off — use Hand-off wizard" note.
        Chebyshev distance calculated and displayed.
        Hail Mary Pass: if skill present, shows toggle to bypass range.
        Blizzard: if active, Long/Long Bomb squares shown with ✕ overlay
        ("Auto-fumble in Blizzard — Quick/Short only").

Step 4: Modifier chips (auto-applied, always visible)
        ┌─────────────────────────────────────────────────────┐
        │ Weather: [chip, auto]                               │
        │ Thrower TZ: [0] [tap + to add]                     │
        │ Accurate skill: +1 on Quick/Short [auto if present] │
        │ Cannoneer skill: +1 on Long/LB [auto if present]   │
        │ Nerves of Steel: ignores TZ [auto if present]      │
        └─────────────────────────────────────────────────────┘
        Summary bar: "Need [X]+ to pass"

Step 5: Intercept check toggle (Veteran/Pro only — shown as optional)
        "Any opposition players in the passing lane?" → Yes shows intercept
        step between throw and catch. Default: No (skip).

Step 6: Throw roll (D6 or 6 physical buttons labelled in context of PA target)
        Result types: Fumble (natural 1), Inaccurate, Accurate.
        Dump-Off: if declared as reaction, fires here instead of normal timing.
        Cloud Burster: note "No interception possible" if skill present.
        Safe Pass: "Natural 1 is not a Fumble" note if skill present.

Step 7: If Inaccurate — scatter step
        3× D8 scatters from target square. Show direction each time.
        If ball lands on a player: catch check fires next.

Step 8: Catch roll
        Catcher pre-selected. AG + modifiers pre-loaded.
        Weather modifier auto-applied.
        Modifier chips: [TZ on catcher −1 each] [Diving Catch: catch from TZ]
        [Nerves of Steel: ignores TZ]
        Result: Caught / Dropped (ball bounces once).

At every step: persistent summary strip showing thrower, catcher, range, and roll results so far.
```

---

## Weather modifier display spec

In every wizard, the weather chip must appear as part of the modifier row, not as an afterthought. Appearance:

```
🌧 Pouring Rain        −1 catch / pickup / intercept
☀️ Very Sunny          −1 to pass
❄️ Blizzard            −1 rush · Long/Long Bomb: ✕
☀️🔥 Sweltering Heat   End-of-drive: lose D3 players
⛅ Perfect Conditions  No effect
```

- Chip is always gold-bordered for active weather (not Perfect Conditions).
- Chip is tappable: opens a popover with the full weather rule description (from weather.json).
- If the current wizard is unaffected by weather (e.g. block — weather has no mechanical effect on blocks), the chip is still shown but with muted styling and "No effect on this action" label.
- Weather chip is shown even before weather has been set (shows "No weather set" in amber as a reminder).

---

## Physical dice button spec (detailed)

### Block dice (6 face buttons, 2×3 grid)
Each button: large (min 80×80px), icon + face name + one-line consequence.
```
[💀 Attacker Down — You fall!]        [⚡ Both Down — Both fall*]
[→ Push Back — Defender pushed]       [→ Push Back — Defender pushed]
[↗ Stumble — Falls unless Dodge]      [★ Defender Down — They fall!]
```
*Both Down button: shows "Block skill cancels" hint if attacker has Block.

Colour: Attacker Down = red background. Both Down = amber. Push = neutral. Stumble = amber. Defender Down = green.

### 2D6 physical buttons (totals 2–12)
Used for: weather, kickoff events, armour rolls, injury rolls, foul armour, KO recovery.
Shown as a row of pill buttons. Each pill has the number large, and below it a 2-line contextual label computed from the relevant data table.

For armour (AV8+):
```
[2][3][4][5][6][7] = Armour Holds   [8][9][10][11][12] = Armour Breaks!
```
The boundary shifts dynamically based on selected AV. Numbers below the threshold are visually muted ("Holds"). Numbers at/above are gold/red ("Breaks!").

For injury:
```
[2–7] = Stunned  [8–9] = KO'd  [10–12] = Casualty!
```
Individual buttons are coloured by band even though they show individual numbers.

For weather/kickoff: each button labelled with the event name from the JSON data.

### D6 physical buttons (1–6)
Used for: pass, catch, intercept, pickup, KO recovery, Loner check, Pro check, etc.
Each button: large number + contextual outcome label.
For pass (PA4+, no modifier):
```
[1 — Fumble!] [2 — Miss] [3 — Miss] [4 — Hit!] [5 — Hit!] [6 — Hit!]
```
Label boundaries shift live as PA target and modifiers change. If a modifier makes 3+ succeed, the [3] button updates to show "Hit!" not "Miss".

### D8 physical buttons (1–8)
Used for: scatter direction, bounce direction, throw-in direction.
Show as a 3×3 compass grid with centre empty. Each position labelled with its arrow direction. Tapping any direction immediately shows the compass highlight and resolves the direction.

### D16 physical buttons (1–16, prayers)
4×4 grid. Each cell: number (large) + prayer name (tiny). Tapping opens the full prayer description in the result area.

---

## Build sequence (8 sprints)

Each sprint = one Claude Code session. Each produces deployable, testable code.

---

### Sprint 1 — Fix everything that's broken
**No new features. Every existing feature works correctly before we add anything.**

Tasks:
1. Fix `rangeLookup` in `panels.js` — verify field names match `weather.json` (`rollMin`/`rollMax`) and `injury.json` (`min`/`max`). Add console.error if data is null at lookup time.
2. Fix weather result HTML — must show emoji, name, effect chip, full description.
3. Fix kickoff event result HTML — must show event name, team-affected chip, full description. Verify `exactLookup` against `kickoff-events.json` (field is `roll`, integer).
4. Fix prayers result HTML — must show D16 value, prayer name, full description.
5. Fix injury cascade — rewrite as explicit async sequence: armour check → if broken, auto-delay 400ms → injury roll → if Casualty!, auto-delay 400ms → D16 casualty roll. Each step's result stays visible above the next. Never hides a previous result.
6. Add re-roll button to all result displays. Button reads `↺ Re-roll` and re-runs the exact same roll. For injury, re-roll is only shown for armour and injury rolls (not casualty — that cannot be re-rolled with a team re-roll). Button disappears after use.
7. Fix block wizard player selection: rewrite `buildWizardPlayerList` using event delegation on the container (not per-button listeners). Verify `getPlayerList()` returns data when roster is loaded.
8. Fix block dice count: verify `calcBlock()` is called after every stepper change and the dice tray re-renders correctly.
9. Fix foul wizard player selection: same event delegation fix. Target list must filter to `PlayerStatus.PRONE` and `PlayerStatus.STUNNED` only.
10. Add `GameState.rerolls` and `GameState.rerollsTotal` to `state.js`. Wire re-roll pip UI in game bar to this state (currently it's in `gbState` inside `panels.js` — migrate to `GameState`).

Test checklist:
- [ ] Roll weather → emoji + name + effect chip + description all visible
- [ ] Roll kickoff event → name + team chip + description visible
- [ ] Roll prayers → prayer name + description visible
- [ ] Roll armour (break it) → injury roll fires after delay → if Casualty!, D16 fires after delay → all three results visible on screen simultaneously
- [ ] Re-roll button appears after any roll → tapping it re-runs the roll → button disappears
- [ ] Load a team, open block wizard, tap a player in the list → ST stepper auto-updates
- [ ] Change ST steppers → dice count in the bar and dice tray both update to correct count
- [ ] Load a team, set a player to Prone, open foul wizard → they appear in target list

---

### Sprint 2 — Dice mode toggle + physical result buttons
**Goal**: every wizard supports both digital and physical dice. Mode persists. Per-wizard overrides work.**

Tasks:
1. Create `settings.js`. Exports: `getSettings()`, `saveSetting(key, value)`, `getWizardDiceMode(wizardKey)`. Reads/writes `localStorage` key `bb_settings`. Default: `{ diceMode: 'digital', diceModeOverrides: {}, mode: 'veteran' }`.
2. Add dice mode toggle pill to every wizard panel header: `⚄ Digital  /  🎲 Physical`. Tapping switches mode for that wizard and saves override to settings.
3. Build `PhysicalDice` component (in `panels.js` or new `physical-dice.js`). Function signature: `showPhysicalButtons(container, config)` where config defines the button set (block faces, D6, D8, 2D6, D16) and a `onSelect(value)` callback.
4. Implement physical mode for each wizard using `PhysicalDice`:
   - Weather: 11 buttons (totals 2–12), labelled from weather.json data
   - Kickoff: 11 buttons (totals 2–12), labelled from kickoff-events.json data
   - Prayers: 16 buttons, labelled from prayers.json data
   - Injury (armour step): 11 buttons (2–12), boundary shifts per selected AV
   - Injury (injury roll step): 11 buttons, colour-banded by outcome
   - Injury (casualty step): 16 buttons from casualty data
   - Block: 6 face buttons, colour-coded by severity
   - Pass (throw step): 6 buttons, labels computed from PA target + modifiers
   - Pass (catch step): 6 buttons, labels computed from AG target + modifiers
5. Scatter/bounce/throw-in: 8 compass buttons (3×3 grid, centre empty) for D8.
6. Add weather chip to every wizard that has a relevant modifier (see weather modifier spec). Auto-applies the modifier. Chip is always visible when weather is set.

Test checklist:
- [ ] Open any wizard → toggle to physical → mode saves → reopen wizard → still physical
- [ ] Physical block: 6 face buttons shown, coloured correctly
- [ ] Tap "Defender Down" → same outcome as rolling a 6 digitally
- [ ] Physical armour with AV9+: buttons 2–8 show "Holds" (muted), 9–12 show "Breaks!" (red)
- [ ] Physical weather: all 11 buttons labelled with weather name from JSON
- [ ] Tap "8" on physical kickoff → "Changing Weather" event shown correctly
- [ ] Active weather set → weather chip appears in pass wizard, injury wizard, foul wizard
- [ ] Weather chip tappable → shows full rule description

---

### Sprint 3 — Pass wizard rebuild
**Goal**: pass wizard is the most complete and useful wizard in the app.**

Tasks:
1. Create `pitch.js`. Exports `PitchGrid` class. Constructor takes a container element. Methods: `setThrower(col, row)`, `setCatcher(col, row)`, `clear()`, `getDistance()`. Renders a 13×13 CSS grid, colour-coded by range zone. Chebyshev distance calculation. Thrower shown as a filled token, catcher as an outlined token with line between them.
2. Create `css/pitch.css`. Grid squares: 28×28px minimum, border, hover highlight. Range zone backgrounds: green/yellow/orange/red with low opacity so the grid is readable. Thrower token: gold filled circle. Catcher token: gold outlined circle. Line between them: dashed gold.
3. Rebuild pass wizard in `wizards.js` as a 8-step sequence with persistent summary strip.
4. Step 1 (thrower selection): reads from loaded home/away roster. If `GameState.ballCarrier` is set, pre-selects that player. Shows PA stat, highlights relevant skills.
5. Step 2 (catcher selection): reads roster. Shows AG stat, highlights relevant skills.
6. Step 3 (range grid): renders PitchGrid. Tap to set catcher position. Range auto-calculated. Blizzard overlay on Long/Long Bomb squares if weather is Blizzard. Hail Mary toggle if skill present.
7. Step 4 (modifiers): weather chip (auto), TZ counter (tappable +/−), skill chips auto-detected from selected players. Computed pass target shown live.
8. Step 5 (optional intercept toggle): Veteran/Pro only. Default off.
9. Step 6 (throw roll): digital or physical per settings.
10. Step 7 (scatter, if needed): D8 direction + D6 distance using physical compass or animated dice.
11. Step 8 (catch): catcher pre-selected, AG pre-loaded, weather auto-applied.
12. Persistent summary strip at wizard top: "[Thrower] → [Catcher] | [Range] | [running result]"

Test checklist:
- [ ] Open pass wizard with roster loaded → thrower list populated
- [ ] Ball carrier tracked → thrower pre-selected
- [ ] Select thrower + catcher → their stats shown
- [ ] Tap grid square 5 squares from centre → "Short Pass (−1)" shown
- [ ] Blizzard active → Long/Long Bomb squares show ✕ overlay
- [ ] Accurate skill on thrower → +1 chip auto-appears for Quick/Short
- [ ] Very Sunny active → −1 pass chip auto-applied → target adjusts
- [ ] After accurate pass → catch step auto-appears with catcher AG pre-set
- [ ] After inaccurate → 3 scatter steps fire

---

### Sprint 4 — Throw Team-Mate wizard rebuild
**Goal**: most satisfying wizard to use. Complex sequence, each step teaches the rule.**

Tasks:
1. Rebuild throw team-mate wizard as a 8-step sequencer with persistent summary strip.
2. Thrower selection: filter to players with "Throw Team-Mate" trait. Show ST and relevant skills.
3. Thrown player selection: filter to players with "Right Stuff" trait. Show stats.
4. Range selector: two buttons — Short (4+) / Long (5+). Strong Arm auto-applies +1. Hail Mary toggle.
5. Always Hungry check: if trait present, fires before throw. D6 ≥ 2 to proceed. Natural 1 = teammate eaten (Badly Hurt result, full flavour, sequence ends).
6. Throw roll: D6 vs target. Physical: 6 buttons labelled in context of current target. Superb / Accurate / Inaccurate / Fumble outcomes.
7. Scatter (if Inaccurate): D8 direction. 3 scatters for inaccurate, 1 for Hail Mary.
8. Landing roll: D6 ≥ 4 (modified by TZ, Landing skill). Physical: 6 buttons labelled "Land safely" / "Crash!".
9. If crash: auto-trigger armour roll with thrown player's AV pre-loaded.
10. Bullseye skill: if Superb result, show "Lands exactly on target — no landing roll needed."
11. Landing in occupied square: show note "Target square occupied — both players roll Armour."
12. Persistent summary strip throughout.

Test checklist:
- [ ] Open wizard → only Throw Team-Mate players appear in thrower list
- [ ] Always Hungry: step appears before throw roll, 1 = eaten result shown
- [ ] Superb with Bullseye: no landing roll step
- [ ] Crash landing: armour roll fires with correct AV
- [ ] All 8+ steps navigable forward and back

---

### Sprint 5 — Drive wizard + game modes + settings panel
**Goal**: structured start-of-drive flow for any mode; settings panel works.**

Drive wizard tasks:
1. Build DriveWizard component: bottom-sheet on mobile, centred modal on desktop. Step dots at top. Back/Next navigation. Can be minimised to a floating "Drive: Step 3/7" pill.
2. Half-start steps (once per half): Weather roll → Kicking team → Prayers check.
3. Drive-start steps (each drive): Setup reminder → Kick deviation → Kickoff event → Drive summary card ("Ready to play →").
4. Drive-end steps (after TD or turnover ends drive): Secret weapon check → End-of-drive effects reminder → KO recovery rolls.
5. KO recovery: shows each KO'd player by name (from `PlayerStatus.KO` filter). For each: roll D6 (digital or physical). 4+ = returned to Reserves (updates status). 1–3 = stays KO'd.
6. In Beginner mode: wizard auto-opens at phase transitions. Cannot be skipped.
7. In Veteran mode: "▸ Start Drive" button on timeline opens wizard. Skippable.
8. In Pro mode: wizard available via button only, not prompted.

Settings panel tasks:
9. Gear icon top-right of game bar opens slide-in settings drawer.
10. Play mode section: Beginner / Veteran / Pro selector with one-line descriptions.
11. Dice defaults section: global default toggle + per-wizard overrides list.
12. Saved to `localStorage` via `settings.js`. Applied immediately on change.

Game mode implementation:
13. Beginner: hide module grid, show only contextual action button + drive wizard.
14. Pro: collapse timeline to single line, no tips, no dimming.
15. Mode change takes effect immediately without page reload.

Test checklist:
- [ ] Drive wizard opens → weather step → kicking team → prayers → setup → deviation → kickoff → "Ready to play"
- [ ] Complete drive wizard → game bar shows current weather
- [ ] KO'd player → end of drive → recovery roll shown per player
- [ ] Settings gear → drawer opens → switch to Beginner → module grid hides
- [ ] Switch to Pro → timeline collapses → all modules shown undimmed
- [ ] Dice override: set block to physical in settings → block wizard opens in physical mode

---

### Sprint 6 — Team builder
**Goal**: players can build, save, load, and share custom teams.**

Tasks:
1. Create `team-builder.js`. Manages `localStorage` key `bb_teams` (array of team objects per schema below).
2. Team builder screen: separate full-page view, accessible from home screen "My Teams" button.
3. New team: select base race → choose roster players (respects qty limits from roster JSON) → set team name → set player names/numbers → buy rerolls/staff (treasury tracking).
4. Team schema in localStorage:
```json
{
  "id": "uuid",
  "name": "My Skaven",
  "baseTeamId": "skaven",
  "treasury": 1000000,
  "rerolls": 3,
  "fanFactor": 1,
  "assistantCoaches": 0,
  "cheerleaders": 0,
  "apothecary": false,
  "players": [
    {
      "id": "uuid",
      "rosterSlotId": 1,
      "name": "Squeakums",
      "jerseyNumber": 7,
      "spp": 0,
      "learnedSkills": [],
      "nigglingInjuries": 0,
      "missingNextGame": false,
      "dead": false,
      "statModifiers": {}
    }
  ]
}
```
5. Export: JSON download of team object.
6. Import: file picker (JSON). Validates structure before loading.
7. My Teams list: thumbnails on home screen, tap to load into game.
8. In-game team loading: "Load from My Teams" button alongside existing "Select a team" dropdown.
9. Rerolls from saved team auto-populate `GameState.rerolls` when team is loaded.

Test checklist:
- [ ] Create Skaven team with 11 players, 3 rerolls → save → appears in My Teams
- [ ] Export → JSON file downloads, structure is valid
- [ ] Import JSON → team appears in My Teams
- [ ] Load custom team into game → roster shows custom names, rerolls show in game bar
- [ ] Treasury shows remaining gold after purchases

---

### Sprint 7 — SPP, post-game, league records
**Goal**: games have consequences; teams evolve over a league.**

Tasks:
1. SPP events logged during game. After TD: prompt "Who scored? Who passed?" — tap player names → SPP awarded (+3 scorer, +1 passer if pass in same turn, +1 catcher).
2. After CAS: prompt "Log casualty SPP?" → tap injuring player → +2 SPP.
3. After KO: prompt "Log KO SPP?" → tap injuring player → +1 SPP.
4. End-of-game screen: full SPP summary, injuries sustained, final score. Option to save updated teams.
5. Level-up: when a player crosses SPP threshold (6, 16, 31, 51, 76), level-up prompt appears. Skill picker: shows all skills available to that position's skill categories. Random skill option (roll D6×2 for random from primary).
6. Apply MNG / lasting injury / death to saved team on export.
7. Saved team JSON updated: SPP, skills, injuries all reflected.
8. MNG players shown with strikethrough in next game's roster.

Test checklist:
- [ ] Score TD → SPP log prompt → tap scorer → +3 shown
- [ ] Player reaches 6 SPP → level-up modal → select skill → saved to team
- [ ] End of game → export → JSON shows updated SPP and injuries
- [ ] Reload updated team → MNG player shown correctly

---

### Sprint 8 — Supabase multiplayer
**Goal**: two players share a live game from separate devices.**

Supabase one-time setup (developer does this once):
```sql
create table bb_games (
  room_code text primary key,
  state jsonb not null default '{}',
  home_team jsonb,
  away_team jsonb,
  last_action jsonb,
  updated_at timestamptz default now()
);
alter table bb_games enable row level security;
create policy "Anyone can read/write by room code"
  on bb_games for all using (true);
```
Enable Realtime on `bb_games` in the Supabase dashboard.

App tasks:
1. Create `sync.js`. Constants: `SUPABASE_URL`, `SUPABASE_ANON_KEY` (public, safe). Exports: `hostGame()`, `joinGame(code)`, `broadcastAction(action)`, `onRemoteAction(callback)`.
2. Host Game flow: generate 6-char alphanumeric room code → insert row → show code on screen → QR code option.
3. Join Game flow: enter code → subscribe to row changes → load opponent team from `home_team` column.
4. State sync: any change to `GameState` triggers a debounced write (300ms) to Supabase `state` column. Both clients subscribed, apply incoming changes.
5. What syncs: scores, turns, player statuses, ball carrier, phase, weather, kickoff event result, last roll result.
6. Opponent action toast: small non-blocking toast bottom-right when opponent resolves something: "Opponent: Block resolved — #7 is KO'd".
7. Soft lock during wizard: while any wizard is open mid-sequence, incoming state updates are queued and applied when wizard closes.
8. What doesn't sync: UI state, dice animations, settings/preferences.

Test checklist:
- [ ] Device A hosts → 6-char code shown
- [ ] Device B joins → both devices show same game bar state
- [ ] Device A injures Device B's player → Device B sees status update without touching their device
- [ ] Device A scores → Device B's score updates
- [ ] Device A's wizard open → Device B's state change is queued, not applied mid-sequence

---

## Claude Code session template

Paste this at the start of each Claude Code sprint session:

```
You are working on the Blood Bowl 2025 match companion web app.

REPOSITORY: [path to bloodbowl/ directory]
CURRENT SPRINT: Sprint [N] — [sprint name]
GOAL: [single sentence goal from sprint spec]

CONTEXT:
- Static site on Cloudflare Pages via GitHub. No build step, no npm, no frameworks.
- Vanilla JS ES6+, 'use strict' throughout.
- CSS uses custom properties; no preprocessor.
- External CDN is allowed for the Supabase client only (Sprint 8).
- Global APIs: window.Dice, window.Panels, window.GameState, window.getPlayerList, window.PlayerStatus, window.STATUS_META
- All data loaded at runtime from /data/*.json files.
- Typography: JetBrains Mono only, all weights/styles. Local font via WEB/css/jetbrains-mono.css.
- Target device: iPad primary, desktop secondary, mobile acceptable.
- Minimum touch target: 48×48px for any tappable element.

DO NOT MODIFY:
- data/*.json files
- The Dice API (window.Dice) — extend only
- The PlayerStatus enum and STATUS_META in state.js
- The --tc-* CSS custom property theming system
- WEB/css/jetbrains-mono.css

SPRINT TASKS:
[paste numbered task list from relevant sprint section above]

PROCEDURE:
1. For each task: read the relevant file first. State what you see before changing it.
2. Make targeted edits. Rewrite a whole file only if the sprint spec says "rebuild".
3. After each task: describe what changed and what the expected DOM/console behaviour is.
4. Flag any task that has a dependency on another (e.g. "Task 3 requires Task 1's re-roll button to exist").
5. If you encounter something unexpected in the existing code, stop and describe it before proceeding.

START: Read [most relevant file for this sprint] and tell me what you see.
```

---

## Open questions resolved

| Question | Answer |
|---|---|
| URL | make.contrapaul.com/bloodbowl — keep site header/footer shell |
| Default dice mode | Digital is default. Physical is the toggle. |
| Pitch tracking | Distance grid for pass/throw only. No full 22-player tracking. |
| Supabase | Deferred to Sprint 8 |
| Typography | JetBrains Mono only, full weight/style range from local files |
| Tap count target | 3 taps for simple (block, basic injury). Complex actions (Throw Team-Mate) earn their steps — the value is transparency on probability and outcome. |
| Weather visibility | Auto-applied and always visible in every wizard where relevant. Not opt-in. |

## Remaining open questions (resolve before relevant sprint)

1. **Sprint 6 — Team value cap**: Does the team builder enforce the 1,000,000 gp starting treasury cap, or is it uncapped for exhibition? (Affects whether treasury tracking shows a warning or a hard block.)
2. **Sprint 7 — SPP prompting**: After a CAS, should the app always prompt to log SPP, or only in League mode? (Affects whether the prompt appears in exhibition games.)
3. **Sprint 8 — Room persistence**: Should rooms expire (e.g. after 24 hours), or persist indefinitely? (Affects the Supabase cleanup policy.)


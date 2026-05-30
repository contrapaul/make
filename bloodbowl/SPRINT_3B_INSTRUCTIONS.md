# Sprint 3b — Pass Wizard & Pitch Component Rebuild
## Claude Code Instructions

**REPOSITORY**: bloodbowl/ directory
**SPRINT**: 3b — Pass Wizard + Reusable Pitch Grid
**GOAL**: A full Blood Bowl pitch component that is reusable across contexts, and a completely rebuilt pass wizard that uses it.

---

## Context

- Static site, Cloudflare Pages. Vanilla JS ES6+, `'use strict'`. No build step, no npm.
- New files: `js/pitch.js`, `css/pitch.css`
- The pitch component must be built as a standalone, reusable class — NOT embedded in the pass wizard
- Touch target minimum: 44×44px for buttons; pitch squares can be smaller (see sizing spec)
- Typography: JetBrains Mono throughout

## DO NOT MODIFY
- `data/*.json` files
- `window.Dice` interface
- `PlayerStatus`, `STATUS_META`, `--tc-*` theming

---

## PART 1: THE PITCH COMPONENT (`js/pitch.js` + `css/pitch.css`)

This is the most important part of this sprint. Build it correctly and it powers the pass wizard, future formation saving, block adjacency, and anything else that needs spatial reference.

### Pitch dimensions

```
Total grid: 28 columns × 15 rows
  Column 1:        Away endzone
  Columns 2–14:    Away half (13 columns)
  Columns 15–27:   Home half (13 columns)
  Column 28:       Home endzone

Row thicker-border separations (these are visual only — thick lines, not extra rows):
  Between rows 4 and 5
  Between rows 11 and 12
  (These mark the wide zone / side zone boundary)

Other thick lines:
  Outer border (entire pitch)
  Between column 1 and 2 (away endzone boundary)
  Between column 14 and 15 (halfway line)
  Between column 27 and 28 (home endzone boundary)
```

### Square sizing

Default square size: 28px × 28px. This fits the full 28×15 pitch at approximately 784px × 420px — workable on iPad landscape and desktop.

The component must support a `scale` option (default 1.0). At scale 0.6 the squares are 16.8px × 16.8px, giving a 470px × 252px pitch. Use 1.0 as default; allow the caller to override.

The pitch must also support pinch-to-zoom and scroll on touch devices. Use `touch-action: none` on the pitch container and implement basic pinch-zoom via pointer events. Clamp zoom between 0.4× and 2.5×.

### Pitch appearance

Endzone columns:
- Away endzone (col 1): background `#1a3a8a` (blue), vertical text "AWAY" in white with red accent stripe
- Home endzone (col 28): background `#8a1a1a` (red), vertical text "HOME" in white with blue accent stripe

Playing field (cols 2–27): background `#1a3d1a` (dark green). Grid lines white at 0.5px opacity 0.4. The field should look like grass — use a subtle repeating linear-gradient to suggest turf direction:
```css
background-image: repeating-linear-gradient(
  0deg,
  rgba(255,255,255,0.025) 0px,
  rgba(255,255,255,0.025) 1px,
  transparent 1px,
  transparent 28px  /* match square height */
);
```

Thick border lines (2px white, opacity 0.7):
- Outer border of entire pitch
- Right edge of column 1 (away endzone boundary)
- Right edge of column 14 (halfway)
- Right edge of column 27 (home endzone boundary)
- Bottom edge of row 4 (top wide zone line — does not extend into endzones)
- Bottom edge of row 11 (bottom wide zone line — does not extend into endzones)

### The `BloodBowlPitch` class

```js
class BloodBowlPitch {
  constructor(containerEl, options = {}) {
    // options: { scale: 1.0, homeTeamRight: true, interactive: true }
  }

  // Place a player token on a square
  // playerData: { id, label, jerseyNumber, side: 'home'|'away', color }
  placePlayer(col, row, playerData) {}

  // Remove a player token from a square
  removePlayer(col, row) {}

  // Move player to new square (animate)
  movePlayer(fromCol, fromRow, toCol, toRow) {}

  // Highlight a player token (glow effect)
  highlightPlayer(col, row, on = true) {}

  // Show pass range zones centred on a square
  // zones: { quick: true, short: true, long: true, longBomb: true }
  showPassZones(centreCol, centreRow, zones = {}) {}

  // Hide pass zones
  hidePassZones() {}

  // Draw animated dashed line between two squares
  drawPassLine(fromCol, fromRow, toCol, toRow) {}

  // Remove the pass line
  clearPassLine() {}

  // Get Chebyshev distance between two squares
  // Returns { distance, rangeLabel, rangeKey }
  getPassRange(fromCol, fromRow, toCol, toRow) {}

  // Set a callback for square taps
  // callback(col, row, existingPlayer|null)
  onSquareTap(callback) {}

  // Clear all tokens and overlays
  clear() {}

  // Zoom to a scale value (animates)
  setScale(scale) {}
}
```

### Pass zone colours (concentric rings from thrower)

Applied as square background overlays, not border changes. Low opacity (0.35) so the grid remains readable.

```
Chebyshev distance 1–3:  rgba(40, 180, 40, 0.35)   — Quick Pass (green)
Chebyshev distance 4–6:  rgba(200, 200, 40, 0.35)  — Short Pass (yellow)
Chebyshev distance 7–10: rgba(220, 140, 20, 0.35)  — Long Pass (orange)
Chebyshev distance 11+:  rgba(200, 40, 40, 0.35)   — Long Bomb (red)
```

When Blizzard weather is active (`GameState.weather?.name === 'Blizzard'`), Long and Long Bomb zones show a ✕ overlay and a tooltip "Auto-fumble in Blizzard".

### Player tokens

Player tokens are circles centred in their square. Diameter: square size minus 4px.

Home team token: red fill (`#8a1a1a`), white text for jersey number or initials.
Away team token: blue fill (`#1a3a8a`), white text.

Selected/highlighted token: gold border (3px), gold glow `box-shadow: 0 0 8px rgba(212,175,55,0.7)`.

When a token is placed, clicking/tapping it:
1. Highlights it with glow
2. Fires the `onSquareTap` callback with `{ col, row, player: playerData }`

### The pass line

A dashed animated line between two squares. Implement as an SVG overlay on top of the pitch grid, absolutely positioned. The line:
- Is dashed: `stroke-dasharray: 6 4`
- Animates the dash offset (marching ants): CSS animation `stroke-dashoffset` from 0 to 20, 0.6s linear infinite
- Colour: `rgba(212, 175, 55, 0.85)` (gold)
- Width: 2px
- Arrowhead at the catcher end: SVG `<marker>` with a small gold triangle

---

## PART 2: THE PASS WIZARD REBUILD (`js/wizards.js` — rewrite `initPassWizard()`)

The pass wizard is a single-screen tool, not a step-by-step wizard. Everything is visible at once. As players make selections, the right side of the panel updates live.

### Layout

The pass panel is wider than other panels. Add class `bb-panel--wide` and style it:
```css
.bb-panel--wide {
  max-width: 900px;
  width: calc(100vw - 2rem);
}

@media (max-width: 900px) {
  .bb-panel--wide {
    max-width: 100%;
  }
}
```

Internal layout is a two-column grid:
```
┌──────────────────────┬──────────────────────────────────┐
│  LEFT COLUMN         │  RIGHT COLUMN                    │
│  (player selection   │  (pitch + live requirements)     │
│   + modifiers)       │                                  │
│                      │                                  │
│  THROWER LIST        │  [Pitch grid]                    │
│  (sorted by PA)      │                                  │
│                      │  [Pass requirements summary]     │
│  CATCHER LIST        │  [Roll section]                  │
│  (sorted by AG)      │                                  │
│                      │                                  │
│  [Modifier chips]    │                                  │
└──────────────────────┴──────────────────────────────────┘
```

On mobile (< 600px): stack vertically. Pitch goes full width at top, lists below.

### Thrower list (left column, top)

- Label: `THROWER — PA`
- Load from the team currently selected as the active side (home by default; a small toggle lets the user switch to away if throwing from the other team — but defaults to the team that is expected to have the ball)
- Sort players by PA value ascending (2+ first, then 3+, etc.). Players with no PA (`—` or `6+`) sort last.
- Each row: `[jersey#] [name or position] [PA: 2+]`
- PA stat is highlighted in gold — it is the primary stat here
- Tapping a row selects that player as thrower:
  - Row gets gold border
  - Player token appears on pitch at default position (col 8, row 8 for home; col 21, row 8 for away)
  - Same player is greyed out in the catcher list (visually dimmed, not removed, still shows stats)
  - If ball carrier is tracked in `GameState.ballCarrier`, that player is pre-selected

### Catcher list (left column, bottom)

- Label: `CATCHER — AG`
- Same team as thrower (not the opposing team — do not allow cross-team selection)
- Sort by AG ascending (2+ first)
- Each row: `[jersey#] [name or position] [AG: 3+]`
- AG stat highlighted in gold
- Tapping selects catcher:
  - Row gets gold border
  - Player token appears on pitch at default position (col 14, row 5 for home; col 15, row 11 for away)
  - Same player is greyed out in the thrower list

### Deselecting

Tapping a selected player in either list deselects them:
- Token is removed from pitch
- Pass line is removed
- Requirements summary clears

### Modifier section (left column, between lists or below catcher list)

Always visible. Updates live as weather/skills change.

```
[Weather chip — auto, always shown]
[Thrower TZ: 0  −  +]   ← tap − or + to adjust; each = −1 modifier
[Catcher TZ: 0  −  +]   ← same
[Accurate skill]         ← auto-shown if thrower has Accurate; +1 on Quick/Short
[Cannoneer skill]        ← auto-shown if thrower has Cannoneer; +1 on Long/LB
[Nerves of Steel]        ← auto-shown; "Thrower ignores TZ penalty"
[Cloud Burster]          ← auto-shown; "No interception possible"
[Interception toggle]    ← manual toggle; default off; shows interception step in roll sequence
```

Skill chips appear automatically based on the selected thrower's skills. They are informational — they don't need to be toggled, they auto-apply to the modifier calculation.

### Pitch (right column)

- `BloodBowlPitch` instance rendered here
- "Show Zones" toggle button above the pitch: off by default
  - When on: calls `pitch.showPassZones(throwerCol, throwerRow)` — zones update if thrower is moved
  - When off: calls `pitch.hidePassZones()`
- Thrower and catcher tokens placed at defaults when selected
- Tokens are draggable to any square (home side only for home team tokens — optionally enforce this in Beginner mode, not in Pro)
- When both tokens are placed: `pitch.drawPassLine()` is called
- Distance calculated with `pitch.getPassRange()` → updates requirements summary

### Requirements summary (right column, below pitch)

This section updates live whenever: thrower changes, catcher changes, distance changes, modifiers change.

```
┌────────────────────────────────────────────────┐
│  PASS: Short (4–6 sq)    Need: 3+  (PA3+ −1)  │
│  CATCH: Need: 3+  (AG3+, no modifiers)         │
│                                                 │
│  🌧 Pouring Rain: −1 to catch                  │
│  Thrower TZ: −1                                 │
└────────────────────────────────────────────────┘
```

If Blizzard is active and Long/LB is selected:
```
│  ⚠ BLIZZARD: Long/Long Bomb auto-fumble!       │
```

Show each modifier that is active as a line item. Show the final computed target prominently.

### Roll section (right column, below requirements)

Only appears after thrower AND catcher are both selected.

```
[⚄ Digital / 🎲 Physical toggle]

[Roll Pass →]

--- after throw ---

Result: [outcome chip]
[↺ Re-roll options if applicable]

[Roll Catch →]   (or [Roll Scatter →] if inaccurate)

--- after catch ---

Result: [outcome chip]
[✓ Complete Pass] or [→ Scatter]
```

Each roll step reveals the next step only after completion. Steps do not hide previous results.

### Interception (when toggle is on)

Between the throw result (if not fumble) and the catch roll, an interception step is inserted:

```
INTERCEPTION CHECK
Intercepting player AG: [2+][3+][4+][5+][6+]
Modifiers: [TZ on interceptor] [Very Long Legs: +2]
Need: [computed target]+
[Roll Intercept]
```

If intercept succeeds: pass is intercepted — sequence ends with "Intercepted!" result. No catch roll.
If intercept fails: proceed to catch roll.

### Completion

After catch is resolved (caught or dropped):
- If caught: `[✓ Complete — Close]` button. Pressing it updates `GameState.ballCarrier` to the catcher.
- If dropped: `[→ Ball Scatters]` button. Opens scatter roll in the same panel (bounce tab, D8 direction).
- Results remain visible after either button until the panel is manually closed.

---

## PART 3: PLAYER SORTING UTILITY

Add this utility function (in `script.js` or a shared utilities section):

```js
/**
 * Parse a Blood Bowl stat string like "2+", "3+", "5+", "-" into a sort value.
 * Lower number = better. "-" sorts last.
 */
function parseStatForSort(statStr) {
  if (!statStr || statStr === '-' || statStr === '—') return 99;
  const n = parseInt(statStr);
  return isNaN(n) ? 99 : n;
}

/**
 * Get players from a loaded roster side, sorted by a stat.
 * side: 'left' | 'right'
 * statKey: 'pa' | 'ag' | 'st' | 'ma'
 * excludeIdx: player index to exclude (e.g. selected thrower excluded from catcher list)
 */
function getSortedPlayersByStat(side, statKey, excludeIdx = null) {
  const players = window.getPlayerList(side) ?? [];
  return players
    .filter(p => p.idx !== excludeIdx)
    .sort((a, b) => {
      const aVal = parseStatForSort(a[statKey] ?? a.statsText?.match(new RegExp(statKey.toUpperCase() + '\\s*([\\d+\\-]+)', 'i'))?.[1]);
      const bVal = parseStatForSort(b[statKey] ?? b.statsText?.match(new RegExp(statKey.toUpperCase() + '\\s*([\\d+\\-]+)', 'i'))?.[1]);
      return aVal - bVal;
    });
}
```

Note: `getPlayerList()` returns players with a `statsText` string. The stat values need to be parsed from this string OR read directly from the loaded team data. Prefer reading from loaded team data if available in `state[side].players`.

---

## PART 4: PITCH COMPONENT USAGE IN OTHER CONTEXTS

The pitch component must be exportable for use in future features. Add to `window`:

```js
window.BloodBowlPitch = BloodBowlPitch;
```

Document the intended future uses as comments in `pitch.js`:
```js
// Future use contexts:
// 1. Pass wizard (current) — thrower/catcher placement, range zones, pass line
// 2. Formation editor — save/load kickoff formations to localStorage
// 3. Block adjacency — place all players, auto-highlight adjacent players for block assists
// 4. Drive overview — optional full-pitch view of current player positions
```

These are NOT to be implemented in this sprint. Just note them and build the component in a way that doesn't prevent them.

---

## TEST CHECKLIST

### Pitch component
- [ ] Pitch renders at correct dimensions (28 columns × 15 rows)
- [ ] Endzones visually distinct (blue left, red right)
- [ ] Thick lines at: outer border, col 1/2, col 14/15, col 27/28, row 4/5, row 11/12
- [ ] Row 4/5 and 11/12 thick lines do NOT extend into endzones (cols 1 and 28)
- [ ] Squares are ~28px at scale 1.0
- [ ] Pinch to zoom works on touch devices
- [ ] Placing a player token: circle appears with correct colour and number
- [ ] Tapping token: glow effect appears
- [ ] Show zones: correct colours at correct distances around centre square
- [ ] Blizzard weather: Long/LB zone squares show ✕

### Pass wizard
- [ ] Panel opens wider than other panels
- [ ] Thrower list loads from active team, sorted by PA (2+ first)
- [ ] Catcher list loads from same team, sorted by AG (2+ first)
- [ ] Tapping thrower → gold border on row → token on pitch → player greyed out in catcher list
- [ ] Tapping catcher → gold border on row → token on pitch → player greyed out in thrower list
- [ ] Tapping already-selected player deselects them
- [ ] Both selected → animated dashed line connects them on pitch
- [ ] Distance auto-calculated → range label shown (Quick / Short / Long / Long Bomb)
- [ ] Weather chip shown automatically, applies correct modifier
- [ ] Skill chips appear for relevant skills on selected thrower
- [ ] Requirements summary updates live as selections change
- [ ] Roll section appears after both players selected
- [ ] Throw roll → result shown (fumble / inaccurate / accurate)
- [ ] Accurate → catch roll step appears
- [ ] Inaccurate → scatter step appears (D8 compass)
- [ ] Catch caught → "Complete" button → `GameState.ballCarrier` updated
- [ ] Catch dropped → "Ball Scatters" → D8 bounce roll shown
- [ ] Cannot select opponent's player as catcher
- [ ] Show Zones toggle → zones appear/disappear on pitch
- [ ] Moving thrower token → zones update position
- [ ] Physical dice mode → result buttons shown with lock-in confirmation

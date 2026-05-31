# Pass Wizard Revision — Sprint Plan

**Goal:** Fix and rebuild the pass wizard in focused, small sprints to avoid context drift and regression.
Each sprint has a single clear objective and a narrow scope. No sprint should touch more than ~3 files.

---

## Sprint 1 — Passing Zone Lookup Table
**Files:** `js/pass-wizard.js`
**Goal:** Replace equation-based zone calculation with a static lookup table derived from the rulebook's 14×14 grid.

The grid below represents the **lower-right quadrant** (thrower at origin, positive X = right, positive Y = up). Mirror horizontally for left, vertically for back, and diagonally for all four quadrants.

```
dx →  0    1    2    3    4    5    6    7    8    9   10   11   12   13
dy
 0  Thrower  Q    Q    Q    S    S    S    L    L    L    L   LB   LB   LB
 1    Q    Q    Q    S    S    S    L    L    L    L   LB   LB   LB
 2    Q    Q    Q    Q    S    S    S    L    L    L    L   LB   LB   LB
 3    Q    Q    S    S    S    S    S    L    L    L   LB   LB   LB
 4    S    S    S    S    S    L    L    L    L   LB   LB   LB
 5    S    S    S    S    S    S    L    L    L    L   LB   LB   LB
 6    S    S    S    S    L    L    L    L    L   LB   LB   LB
 7    S    S    S    S    L    L    L    L    L   LB   LB   LB
 8    L    L    L    L    L    L    L    L   LB   LB   LB
 9    L    L    L    L    L   LB   LB   LB   LB   LB
10    L    L    L   LB   LB   LB   LB   LB   LB
11    L    L    L    L    L   LB   LB   LB   LB   LB   LB
12   LB   LB   LB   LB   LB   LB   LB
13   LB   LB   LB   LB   LB
```

**Acceptance:** Clicking a square highlights the correct zone label. Unit-test by placing thrower at several grid positions and verifying known cells.

---

## Sprint 2 — Pass Roll Modifiers (Core)
**Files:** `js/pass-wizard.js`
**Goal:** Ensure ALL official modifiers are calculated and stored in state. No UI yet — just correct numbers.

Modifiers to implement/verify:
- Base difficulty by zone (Q=2+, S=3+, L=4+, LB=5+)
- +1 per Tackle Zone on thrower
- Weather effects (e.g. Blizzard, Pouring Rain)
- Accurate skill (−1 difficulty)
- Strong Arm skill (treat S as Q, L as S, LB as L)
- Pass skill (re-roll on fail — flag only, not yet UI)
- On a natural 1, always fumble regardless of modifiers

**Acceptance:** `console.log` the modifier breakdown from a test pass; values match rulebook.

---

## Sprint 3 — Pass Roll Modifiers (UI Display)
**Files:** `js/pass-wizard.js`, `css/wizards.css`
**Goal:** Show the full modifier breakdown beneath the pass success roll target number.

- List each factor contributing to difficulty (e.g. "Long Pass: 4+ base", "1 Tackle Zone: +1", "Accurate: −1", "Final: 4+")
- Skills appear inline here, not in a separate left column
- Each skill name is a hoverable chip that shows its rules description on hover/click

**Acceptance:** All modifiers visible; hovering a skill chip shows description from `data/skills.json`.

---

## Sprint 4 — Consummate Professional & Missing Skills
**Files:** `js/pass-wizard.js`, `data/skills.json`
**Goal:** Implement all passing-relevant skills that were absent. Priority list:

- `Pass` — re-roll on failed pass roll
- `Consummate Professional` (Griff Oberwald) — may use team re-roll even after using a player skill re-roll; never roll Argue the Call
- `Accurate` — already detected but broken; wire fully
- `Strong Arm` — already partially present; verify correctness
- `Nerves of Steel` — ignore tackle zones for passing
- `Hail Mary Pass` — ignore range, always scatter; flag for scatter path

Verify each skill is present and keyed correctly in `data/skills.json`.

**Acceptance:** Griff Oberwald pass wizard shows Consummate Professional factored in. Pass skill re-roll option appears on fail.

---

## Sprint 5 — Team Re-Rolls in Wizard
**Files:** `js/pass-wizard.js`, `js/state.js`
**Goal:** Wire team re-roll count from game state into the pass wizard.

- Read current team re-rolls from `state`
- Show remaining re-rolls as a count in the wizard
- "Use Team Re-Roll" button is enabled only when count > 0 and no player skill re-roll was already used this action
- Decrement count when used; reflect immediately in the right-panel re-roll display (Sprint 14)

**Acceptance:** Re-roll count decrements; button disables at 0; Consummate Professional exception works.

---

## Sprint 6 — Scatter Outcome Completion
**Files:** `js/pass-wizard.js`
**Goal:** Every outcome path in the wizard must have a Close/Complete action.

- When ball scatters from thrower (fumble): show scatter result, then offer "Complete Turn" button
- When no re-rolls remain at any step: "Complete Turn" is the only available action
- Audit every branch of the wizard state machine for dead ends; add completion actions to each

**Acceptance:** Tester can reach "Complete" from every possible wizard state, including fumble with 0 re-rolls.

---

## Sprint 7 — Wizard State Persistence (No Auto-Clear)
**Files:** `js/pass-wizard.js`, `js/wizards.js` (or equivalent orchestrator)
**Goal:** Opening another panel or clicking elsewhere must not reset pass wizard state.

- Wizard state clears only on: explicit Close button, Complete button, or opening a *different* wizard
- Identify where the clear/reset is currently triggered and guard it
- Add a "are you sure?" guard if user opens a different wizard while pass wizard has state

**Acceptance:** Click the pitch, open team panel, click away — wizard state is unchanged on return.

---

## Sprint 8 — Fixed Window Size
**Files:** `css/wizards.css`, `js/pass-wizard.js`
**Goal:** The wizard window must not resize as options expand or collapse.

- Set a fixed min-height and min-width on the wizard container; content scrolls internally if needed
- Audit every conditional section that currently adds/removes height
- Buttons must not shift position as content changes

**Acceptance:** Show/hide any section of the wizard — outer dimensions stay constant.

---

## Sprint 9 — Pitch Zoom Centered on Cursor / Pinch Origin
**Files:** `js/pitch.js`, `css/pitch.css` (if applicable)
**Goal:** Zoom must be anchored to the cursor position (wheel) or pinch midpoint (touch).

- For wheel zoom: compute cursor position relative to pitch canvas, adjust translate so that point stays fixed
- For pinch zoom: track midpoint of two touch points; keep midpoint visually fixed
- Remove current top-left anchor behavior

**Acceptance:** Zoom in on the center of the pitch — it stays centered. Zoom in on a corner — the corner stays fixed.

---

## Sprint 10 — Player Drag Smoothness on Pitch
**Files:** `js/pitch.js`
**Goal:** Moving players on the pitch feels smooth and responsive.

- Identify source of jank (likely re-render on every mousemove, or transform vs. position approach)
- Use `requestAnimationFrame` for drag updates if not already
- Ensure drag offset is calculated correctly so player snaps to finger/cursor, not to top-left of token

**Acceptance:** Drag a player token — movement follows cursor smoothly with no stutter or jump.

---

## Sprint 11 — UI Layout v2 (Console TV Layout, 5 Variants)
**Files:** `css/wizards.css`, `js/pass-wizard.js` (layout restructure)
**Goal:** Design and implement a new large-format layout for the pass wizard with 5 selectable variants.

Layout rules for all variants:
- Pitch at ~200% current size, centered
- Left panel: toggles, "Add Opposing Players" button
- Below pitch: "Choose Thrower" (left), "Choose Catcher" (right)
- Right panel: Team re-rolls count, weather, other useful info
- Remove "Change Thrower" / "Change Catcher" buttons (X on token is sufficient)
- Style guide: modern console game UI (large text, high contrast, controller-friendly hit targets)
- Target: readable from 3 meters on a TV; comfortable on iPad

Add 5 numbered buttons at the top of the wizard to switch between variants (for comparison purposes).

**Acceptance:** All 5 variants render without overflow; pitch is larger; layout panels are populated.

---

## Sprint 12 — Player Chooser Cards
**Files:** `js/pass-wizard.js`, `css/wizards.css`
**Goal:** "Choose Thrower" and "Choose Catcher" open a card/overlay listing available players.

- Card shows all eligible players with name, position, key stats
- Relevant skills highlighted (bolded or colored chips)
- Clicking a player selects them and closes the card
- Card is dismissed by clicking away or pressing Escape

**Acceptance:** Open chooser, see all players with skills highlighted, select one — card closes and thrower/catcher is set.

---

## Sprint 13 — Skill Tooltips (Global)
**Files:** `js/pass-wizard.js`, `css/wizards.css`
**Goal:** Any skill name displayed anywhere in the pass wizard is hoverable/tappable to show its description.

- Single reusable tooltip component (or CSS-only title approach if simpler)
- Pulls description from `data/skills.json` by skill key
- Works on both desktop (hover) and tablet (tap)

**Acceptance:** Tap "Accurate" on iPad — tooltip appears with rule text. Hover on desktop — same.

---

## Sprint 14 — Right Panel: Re-Rolls, Weather, Game Info
**Files:** `js/pass-wizard.js`, `css/wizards.css`
**Goal:** Populate the right-side info panel introduced in Sprint 11.

- Team re-rolls: large number display, updates live as re-rolls are spent
- Weather: icon + label from `data/weather.json`
- Turn number, half (if available in state)
- Any active prayer/kickoff effect relevant to passing

**Acceptance:** Right panel shows correct re-roll count; weather shows current condition; count updates after Sprint 5 logic spends a re-roll.

---

## Sprint Overview Table

| # | Title | Scope | Depends On |
|---|-------|-------|------------|
| 1 | Passing Zone Lookup Table | pass-wizard.js | — |
| 2 | Pass Roll Modifiers (Core) | pass-wizard.js | 1 |
| 3 | Pass Roll Modifiers (UI) | pass-wizard.js, wizards.css | 2 |
| 4 | Consummate Professional & Missing Skills | pass-wizard.js, skills.json | 2 |
| 5 | Team Re-Rolls in Wizard | pass-wizard.js, state.js | — |
| 6 | Scatter Outcome Completion | pass-wizard.js | — |
| 7 | Wizard State Persistence | pass-wizard.js, wizards.js | — |
| 8 | Fixed Window Size | wizards.css, pass-wizard.js | — |
| 9 | Pitch Zoom Centered on Cursor | pitch.js | — |
| 10 | Player Drag Smoothness | pitch.js | — |
| 11 | UI Layout v2 (5 Variants) | wizards.css, pass-wizard.js | 8 |
| 12 | Player Chooser Cards | pass-wizard.js, wizards.css | 11 |
| 13 | Skill Tooltips (Global) | pass-wizard.js, wizards.css | 3 |
| 14 | Right Panel Info | pass-wizard.js, wizards.css | 11, 5 |

**Recommended execution order:** 1 → 2 → 3 → 4 (logic chain), then 5, 6, 7, 8 independently, then 9, 10 independently, then 11 → 12 → 13 → 14 (UI chain).

# Sprint 1b — Fix Foundations
## Claude Code Instructions

You are working on the Blood Bowl 2025 match companion web app.

**REPOSITORY**: bloodbowl/ directory
**SPRINT**: 1b — Fix Foundations (pre-Supabase quality gate)
**GOAL**: Every existing wizard and drive sequence shows real results when dice are rolled. No silent failures. No dead ends. Mobile layout is usable.

---

## Context

- Static site, Cloudflare Pages via GitHub. No build step, no npm, no frameworks.
- Vanilla JS ES6+, `'use strict'` throughout.
- Global APIs: `window.Dice`, `window.Panels`, `window.GameState`, `window.getPlayerList`, `window.PlayerStatus`, `window.STATUS_META`
- All reference data loaded at runtime from `/data/*.json`
- Typography: JetBrains Mono only (local font, `WEB/css/jetbrains-mono.css`)
- Target: iPad primary, desktop secondary — mobile must be usable (not perfect)

---

## DO NOT MODIFY

- `data/*.json` files — all data is correct
- The `Dice` API (`window.Dice`) — do not change its interface
- The `PlayerStatus` enum and `STATUS_META` in `state.js`
- The `--tc-*` CSS theming system
- `WEB/css/jetbrains-mono.css`

---

## PROCEDURE FOR EVERY TASK

1. **Read the file first.** State what you find before changing anything.
2. **Make targeted edits.** Do not rewrite a whole file unless explicitly instructed.
3. **After each task**: describe what changed and what the expected behaviour is.
4. **Flag dependencies**: if a task depends on a previous one, say so explicitly.
5. **If you find something unexpected**: stop and describe it before proceeding.

---

## TASKS

---

### TASK 1 — Diagnose and fix the data loading failure

**Problem**: `DATA.weather`, `DATA.kickoff`, `DATA.prayers`, `DATA.injury` appear to be `undefined` or empty when roll handlers fire, causing silent failures and empty result displays.

**Read first**: `js/panels.js` — find `loadModuleData()` and every place `DATA` is used.

**Fix**:
1. Add a defensive check at the top of every roll handler (kickoff, weather, prayers, injury, scatter) that tests whether its data is loaded. If not, show a visible error in the result element: `"⚠ Data not loaded — check console"` and `console.error('[BB] DATA.weather is null — loadModuleData may have failed')`.
2. Find `loadModuleData()`. Verify it is called with `await` before any module init. If it is called inside `DOMContentLoaded` without proper await sequencing, fix that.
3. Add `console.log('[BB] Data loaded:', Object.keys(DATA))` after `loadModuleData()` completes so we can confirm in the console what loaded.
4. Verify the fetch paths. The app is at `/bloodbowl/` — if fetch paths are relative (e.g. `'data/weather.json'`) and the page is served from a subdirectory, this may fail. The correct path depends on how the server resolves it. Check: does `fetch('data/weather.json')` work from `make.contrapaul.com/bloodbowl/`? If not, paths may need to be `'./data/weather.json'` or an absolute path. Fix paths if needed.
5. After fix: rolling weather must log `DATA.weather` to console and show a result. If it shows the error message instead of a result, the data load is still failing — that is a separate path/CORS issue to investigate next.

**Expected outcome**: opening the browser console and rolling weather shows `[BB] Data loaded: ['kickoff', 'weather', 'prayers', 'injury']` and no errors.

---

### TASK 2 — Fix weather result display

**Read first**: `js/panels.js` — find `initWeatherModule()` and the weather roll handler.

**Fix**:
1. The result HTML must render all four elements: emoji, name, effect chip, full description. Here is the exact required structure — implement this precisely:

```js
// After rolling, `w` is the matched weather entry from DATA.weather
// w has fields: rollMin, rollMax, name, emoji, effect, desc

const isPerfect = !w.effect || w.effect === 'No effect';
const effectHtml = isPerfect
  ? `<span class="result-chip result-chip-ok">✓ No effect</span>`
  : `<span class="result-chip result-chip-warn">⚠ ${esc(w.effect)}</span>`;

resultEl.innerHTML = `
  <div class="result-emoji">${w.emoji}</div>
  <div class="result-roll-num">${total}</div>
  <div class="result-roll-breakdown">${d1} + ${d2}</div>
  <div class="result-name">${esc(w.name)}</div>
  ${effectHtml}
  <hr class="result-divider">
  <p class="result-desc">${esc(w.desc)}</p>
`;
resultEl.removeAttribute('hidden');
```

2. After showing result: store the result in `GameState.weather = w` so other wizards can read it.
3. Verify `esc()` function exists in scope. It is defined in `panels.js` — confirm it is accessible where used.
4. The "roll again" button must appear after any weather result. A re-roll is valid for weather (no team re-roll cost). Button label: `↺ Roll Again`. Tapping it repeats the roll. This is NOT a re-roll in the game sense — it's for testing or if the wrong result was rolled.

**Expected outcome**: rolling weather shows the emoji, a large total, the weather name, an effect chip, a horizontal rule, and the full description text. Nothing is hidden or empty.

---

### TASK 3 — Fix kickoff event result display

**Read first**: `js/panels.js` — find `initKickoffModule()`.

**Fix**:
1. `exactLookup(DATA.kickoff, total)` — confirm `DATA.kickoff` entries have a field named exactly `roll` (integer). Open `data/kickoff-events.json` mentally — each entry is `{ "roll": 2, "name": "...", "desc": "..." }`. The lookup must use `e.roll === roll` (strict equality, both are integers).
2. The result HTML must render: total, breakdown, event name, team-affected chip, full description. Required structure:

```js
// ev = matched kickoff event entry
// affects = KICKOFF_AFFECTS[total] ?? 'both'

const affectsHtml = {
  'kicking':   `<span class="result-chip result-chip-warn">⚽ Kicking team</span>`,
  'receiving': `<span class="result-chip result-chip-ok">🏆 Receiving team</span>`,
  'both':      `<span class="result-chip result-chip-info">⚖️ Both teams</span>`,
}[affects] ?? `<span class="result-chip result-chip-info">⚖️ Both teams</span>`;

resultEl.innerHTML = `
  <div class="result-roll-num">${total}</div>
  <div class="result-roll-breakdown">${d1} + ${d2}</div>
  <div class="result-name">${esc(ev.name)}</div>
  ${affectsHtml}
  <hr class="result-divider">
  <p class="result-desc">${esc(ev.desc)}</p>
`;
resultEl.removeAttribute('hidden');
```

3. Store result: `GameState.kickoffEvent = ev`.
4. After result shows, make the "Next" or "Continue" button in the drive wizard visible if the wizard is active. If no drive wizard is present, show a `↺ Roll Again` button.

**Expected outcome**: rolling kickoff event shows a large number, the event name, who is affected, and the full rule text.

---

### TASK 4 — Fix Prayers to Nuffle result display

**Read first**: `js/panels.js` — find `initPrayersModule()`.

**Fix**:
1. `exactLookup(DATA.prayers, val)` — confirm entries have field `roll` (integer 1–16). The D16 die element should have `data-sides="16"`.
2. Result must show: rolled value, prayer name (with ✦ prefix), full description. Required structure:

```js
resultEl.innerHTML = `
  <div class="result-roll-num">${val}</div>
  <div class="result-name">✦ ${esc(prayer.name)}</div>
  <hr class="result-divider">
  <p class="result-desc">${esc(prayer.desc)}</p>
`;
resultEl.removeAttribute('hidden');
```

3. Add `↺ Roll Again` button after result.

---

### TASK 5 — Fix injury cascade (armour → injury → casualty)

**Read first**: `js/panels.js` — find `initInjuryModule()`.

**The cascade must work as follows — rewrite this function if necessary**:

```
Step 1: Armour roll (2D6)
  modded = total + armourModifier
  if modded < selectedAV:
    show "Armour Holds" result → STOP
  else:
    show "Armour Broken!" → after 500ms delay → auto-trigger Step 2

Step 2: Injury roll (2D6, same dice elements)
  injModded = Math.min(12, injTotal + injModifier)
  look up in injury table (or stunty table if flag set)
  show injury result
  if result === 'Casualty!': after 500ms delay → auto-trigger Step 3

Step 3: Casualty roll (D16)
  look up in casualty table
  show casualty result
  DONE
```

**Critical**: each step's result must STAY VISIBLE. Do not clear earlier results when showing later ones. The page should scroll to show all three results stacked. Use `append` or insert below, never replace.

**Mighty Blow / Dirty Player**: these apply to EITHER the armour roll OR the injury roll — the player chooses after seeing the armour roll. Implement as: when armour breaks, show a small secondary prompt "Apply Mighty Blow modifier to: [Armour ✓] [Injury]". Whichever is tapped gets the +1. Default to having already applied it to armour (the common choice). If the player wants to apply to injury instead, they tap "Injury" and the injury roll gets +1 instead.

**Expected outcome**: breaking armour automatically triggers injury roll, which automatically triggers casualty roll if needed. All three results are simultaneously visible on screen.

---

### TASK 6 — Fix the kicking team determination step

**Read first**: find wherever "who is kicking" is implemented — likely in a drive wizard JS file or in `panels.js`.

**Fix**: The kicking team determination must offer three options:
1. **We kick** — button for the home team coach to tap
2. **They kick** — button for the home team coach to tap  
3. **Coin flip** — rolls a single D6. 1–3 = home kicks, 4–6 = away kicks. Shows the die animation, then reveals who kicks with a large result: "⚽ [Team name] kicks off!"

All three options set `GameState.kickingTeam`. After any option is chosen, the wizard advances to the next step automatically.

The coin flip option must show:
```
[Animated D6 die face]
Result: 5
→ Away team kicks off!
```

Then after 1.5 seconds (or immediately if player taps "Continue"), advance to the setup step.

---

### TASK 7 — Fix drive wizard step advancement

**Read first**: find the drive wizard step sequencer — wherever `advanceDriveStep()` or equivalent is called.

**Problem**: after rolling in a wizard step, the "Next step" button either doesn't appear or doesn't work.

**Fix**:
1. Each drive wizard step that requires a roll must have a "Next" button that is HIDDEN until the roll produces a result.
2. When `resultEl.removeAttribute('hidden')` fires (after a successful roll result is displayed), the "Next" button must become visible.
3. The "Next" button advances the drive wizard to the next step. It must NOT be the same button as the roll button.
4. Steps that don't require a roll (e.g. the setup reminder, the "ready to play" card) must show a "Continue →" button immediately.
5. The drive wizard must never be in a state where there is no visible action to take.

Implement this pattern in every drive wizard step:

```js
function showDriveStepResult(content, onNext) {
  resultEl.innerHTML = content;
  resultEl.removeAttribute('hidden');
  
  // Show the next button
  const nextBtn = document.getElementById('drive-step-next');
  if (nextBtn) {
    nextBtn.removeAttribute('hidden');
    nextBtn.onclick = () => {
      nextBtn.setAttribute('hidden', '');
      onNext();
    };
  }
}
```

---

### TASK 8 — Add re-roll buttons to all result displays

**Read first**: `js/panels.js` and `js/wizards.js` — find all places where `resultEl.innerHTML = ...` and `resultEl.removeAttribute('hidden')` are called.

**Fix**: After every result display, append a re-roll section. Create a helper function:

```js
function appendRerollSection(resultEl, rollFn, context) {
  // context = { side: 'home'|'away', skillRerolls: ['Pass', 'Catch', etc.] }
  const section = document.createElement('div');
  section.className = 'reroll-section';

  // Team re-roll button (if applicable)
  const canTeamReroll = !['injury-roll', 'casualty', 'armour'].includes(context.type);
  const rerollsLeft = GameState.rerolls?.[context.side] ?? 0;
  
  if (canTeamReroll && rerollsLeft > 0 && !GameState.rerollUsedThisTurn) {
    const btn = document.createElement('button');
    btn.className = 'reroll-btn';
    btn.textContent = `↺ Team Re-roll (${rerollsLeft} left)`;
    btn.addEventListener('click', () => {
      GameState.rerolls[context.side]--;
      GameState.rerollUsedThisTurn = true;
      btn.disabled = true;
      btn.textContent = '↺ Re-rolling…';
      rollFn(); // re-executes the roll
    });
    section.appendChild(btn);
  }

  // Skill re-roll buttons
  (context.skillRerolls ?? []).forEach(skillName => {
    const btn = document.createElement('button');
    btn.className = 'reroll-btn reroll-btn-skill';
    btn.textContent = `↺ ${skillName}`;
    btn.addEventListener('click', () => {
      btn.disabled = true;
      rollFn();
    });
    section.appendChild(btn);
  });

  resultEl.appendChild(section);
}
```

Add `.reroll-section` and `.reroll-btn` CSS:
```css
.reroll-section {
  margin-top: 0.75rem;
  padding-top: 0.65rem;
  border-top: 1px solid rgba(80, 130, 255, 0.15);
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.reroll-btn {
  font-family: 'JetBrains Mono', monospace;
  font-weight: 700;
  font-size: 0.7rem;
  padding: 0.35rem 0.75rem;
  background: rgba(212, 175, 55, 0.1);
  border: 1px solid rgba(212, 175, 55, 0.35);
  border-radius: 4px;
  color: var(--bb-gold, #D4AF37);
  cursor: pointer;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  transition: background 0.13s;
}

.reroll-btn:hover { background: rgba(212, 175, 55, 0.22); }
.reroll-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.reroll-btn-skill {
  background: rgba(80, 130, 255, 0.08);
  border-color: rgba(80, 130, 255, 0.3);
  color: rgba(160, 200, 255, 0.85);
}
```

At minimum, add re-roll buttons to: weather (↺ Roll Again, no cost), kickoff (↺ Roll Again), prayers (↺ Roll Again), injury armour roll (team re-roll), pass throw roll (team re-roll + Pass skill), pass catch roll (team re-roll + Catch skill), block roll (team re-roll + Block skill on Both Down).

---

### TASK 9 — Mobile layout fixes

**Read first**: `css/game-bar.css`, `css/panels.css`, `style.css` — find all `@media` queries.

**Fixes**:

**Game bar on mobile** (< 480px): The 3-column grid collapses badly. Fix:
```css
@media (max-width: 479px) {
  .game-bar {
    grid-template-columns: 1fr 1fr;
    grid-template-rows: auto auto;
    min-height: auto;
  }
  .gb-center {
    grid-column: 1 / -1;
    grid-row: 2;
    border-top: 1px solid rgba(70, 110, 220, 0.2);
    padding: 0.4rem 0.75rem;
    flex-direction: row;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 0.3rem;
  }
  .gb-score { font-size: 1.2rem; }
  .gb-rr-label { display: none; }
  .gb-select { font-size: 0.62rem; padding: 0.22rem 1.4rem 0.22rem 0.4rem; }
}
```

**Panels on mobile**: panels must be full-width bottom sheets on screens < 600px:
```css
@media (max-width: 599px) {
  .bb-panel {
    position: fixed;
    top: auto;
    bottom: 0;
    left: 0;
    right: 0;
    transform: none !important;
    width: 100%;
    max-width: 100%;
    max-height: 80vh;
    border-radius: 16px 16px 0 0;
    border-left: none;
    border-right: none;
    border-bottom: none;
  }

  @keyframes panelOpen {
    from { opacity: 0; transform: translateY(100%); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .bb-panel.panel-closing {
    animation: panelClose 0.16s ease-in both;
  }

  @keyframes panelClose {
    from { opacity: 1; transform: translateY(0); }
    to   { opacity: 0; transform: translateY(100%); }
  }
}
```

**Module grid on mobile**: reduce button size:
```css
@media (max-width: 479px) {
  .module-grid {
    grid-template-columns: repeat(auto-fill, minmax(64px, 1fr));
    gap: 0.3rem;
  }
  .module-btn {
    padding: 0.45rem 0.2rem 0.4rem;
  }
  .module-icon svg { width: 20px; height: 20px; }
  .module-label { font-size: 0.48rem; }
}
```

**Player cards on mobile**: single column, smaller text:
```css
@media (max-width: 479px) {
  .player-card {
    padding: 0.22rem 0.5rem;
    gap: 0.25rem;
    font-size: 0.75rem;
  }
  .card-stats { display: none; }  /* hide stats row on mobile — visible on card */
}
```

**Roster section on mobile**: already has a fix but verify it stacks to single column correctly.

**Touch targets**: scan for any button with a computed height < 44px at 480px viewport width. Add `min-height: 44px` where missing.

---

### TASK 10 — Verify the scatter/ball module results

**Read first**: `js/panels.js` — find `initScatterModule()` and `bindScatterRoll()`.

**Fix**:
1. Deviation roll (D6 + D8): result must show: "Deviates N squares [direction arrow]". Direction arrow must be a large Unicode arrow character, not just a number. Direction mapping: `{1:'↖', 2:'↑', 3:'↗', 4:'←', 5:'→', 6:'↙', 7:'↓', 8:'↘'}`.
2. Bounce roll (D8): result must show direction arrow AND update the compass grid (highlight the active direction cell).
3. Throw-in roll (D6 + D8): result must show: "Thrown in N squares [direction arrow]".
4. All three must show `↺ Roll Again` button after result.
5. The compass grid must exist in the HTML for the bounce tab. If it's missing or broken, re-render it as a 3×3 CSS grid:

```html
<div class="compass" id="bounce-compass" aria-label="Bounce direction">
  <span class="compass-dir" data-dir="1">↖</span>
  <span class="compass-dir" data-dir="2">↑</span>
  <span class="compass-dir" data-dir="3">↗</span>
  <span class="compass-dir" data-dir="4">←</span>
  <span class="compass-center">●</span>
  <span class="compass-dir" data-dir="5">→</span>
  <span class="compass-dir" data-dir="6">↙</span>
  <span class="compass-dir" data-dir="7">↓</span>
  <span class="compass-dir" data-dir="8">↘</span>
</div>
```

The `highlightCompass(compassId, activeDir)` function should add class `active` to the matching `data-dir` cell and remove it from all others.

---

## Test checklist (run through all of these before marking sprint complete)

### Data loading
- [ ] Open browser console, load page → `[BB] Data loaded: ['kickoff', 'weather', 'prayers', 'injury']` appears
- [ ] No 404 errors for JSON files in the Network tab

### Weather
- [ ] Open Weather module → roll → large number appears, emoji appears, name appears, effect chip appears, full description appears
- [ ] `↺ Roll Again` button appears → tapping it rolls again
- [ ] GameState.weather is set (check in console: `GameState.weather`)

### Kickoff Events
- [ ] Open Kickoff module → roll → event name appears, team chip appears, full description appears
- [ ] `↺ Roll Again` button appears

### Prayers
- [ ] Open Prayers module → roll D16 → prayer name appears, description appears
- [ ] `↺ Roll Again` button appears

### Injury cascade
- [ ] Open Injury module → select AV8+ → roll → if total < 8: "Armour Holds" appears
- [ ] Roll that breaks armour → "Armour Broken!" appears → 500ms later injury roll fires automatically
- [ ] Injury result shows → if "Casualty!" → 500ms later D16 casualty roll fires automatically
- [ ] All three results visible simultaneously on screen — earlier results not cleared
- [ ] `↺ Team Re-roll` button appears after armour roll step

### Kicking team
- [ ] Drive wizard kicking team step → three options visible: "We kick", "They kick", "Coin flip"
- [ ] Coin flip → D6 animates → result shows who kicks → wizard auto-advances after 1.5s

### Drive wizard advancement
- [ ] Complete weather step → Next button appears → tap it → advances to kicking team step
- [ ] Complete kickoff event step → Next button appears
- [ ] No step leaves the player with nothing to tap

### Re-rolls
- [ ] After any roll result, at least one re-roll option appears
- [ ] Tapping team re-roll → reroll count decrements → roll re-executes → new result shown

### Scatter
- [ ] Deviation roll → "Deviates N squares ↗" (or other arrow) shown
- [ ] Bounce roll → compass grid highlights correct direction cell
- [ ] Throw-in roll → shows direction and distance

### Mobile (test at 390px viewport width)
- [ ] Game bar is readable — no overflow, scores visible
- [ ] Module buttons are tappable (not too small)
- [ ] Opening a panel → slides up from bottom as a sheet
- [ ] Panel content is scrollable if tall
- [ ] No horizontal scroll on main page

---

## Notes

- If Task 1 reveals that data is loading correctly but the result HTML is still empty, the issue is in the result-rendering code path. Add `console.log('[BB] Rendering result:', w)` immediately before the `innerHTML =` assignment to confirm the data object is what you expect.
- If fetch paths are wrong (404s in Network tab), check whether `fetch('data/weather.json')` resolves correctly from the subdirectory. The correct relative path from `index.html` in `/bloodbowl/` is `'data/weather.json'` or `'./data/weather.json'`. Absolute paths like `/bloodbowl/data/weather.json` also work but are less portable.
- Do not attempt Sprint 8 (Supabase) until all items on this test checklist pass. The multiplayer layer requires a working, stable base.

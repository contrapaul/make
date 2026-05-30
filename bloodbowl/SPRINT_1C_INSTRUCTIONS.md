# Sprint 1c — Fix Broken Foundations (Again)
## Claude Code Instructions

**REPOSITORY**: bloodbowl/ directory
**SPRINT**: 1c — Broken result displays, wizard lock-up, physical dice lock-in
**GOAL**: Every dice roll in every panel shows a real result. The beginner drive wizard does not lock up. Physical dice mode has a lock-in button.

---

## Context

- Static site, Cloudflare Pages via GitHub. Vanilla JS ES6+, `'use strict'`.
- No build step, no npm, no frameworks.
- Global APIs: `window.Dice`, `window.Panels`, `window.GameState`, `window.getPlayerList`, `window.PlayerStatus`, `window.STATUS_META`
- Data files at `./data/*.json` (relative from index.html)
- Typography: JetBrains Mono only

## DO NOT MODIFY
- `data/*.json` files
- `window.Dice` API interface
- `PlayerStatus` enum and `STATUS_META` in `state.js`
- `--tc-*` CSS theming system
- `WEB/css/jetbrains-mono.css`

## PROCEDURE
1. Read each file before touching it. State what you see.
2. Make targeted edits only. Do not rewrite whole files unless instructed.
3. After each task, describe what changed and expected behaviour.
4. If something unexpected is found, stop and describe it before proceeding.

---

## ROOT CAUSE INVESTIGATION — DO THIS FIRST

Before any fixes, run this diagnostic sequence and report findings:

1. Open `js/panels.js`. Find `loadModuleData()`. Report:
   - Is it called with `await`?
   - Is the `DOMContentLoaded` handler itself `async`?
   - What does the function do if a fetch fails — does it throw, silently catch, or set the key to null?

2. Find the weather roll handler (`initWeatherModule` or equivalent). Report:
   - What is `DATA.weather` at the point the roll fires? Is it an array or undefined?
   - Does `rangeLookup` get called? With what arguments?
   - Does `resultEl.removeAttribute('hidden')` or `resultEl.hidden = false` get called?

3. Find the beginner drive wizard. Report:
   - After the weather roll result is shown, what condition gates the "Next" button becoming active?
   - Why are all options greyed out after rolling weather?

Report ALL of this before writing a single line of fix code.

---

## TASK 1 — Fix data loading and verify it

**The most likely root cause of all result display failures is that `DATA` is empty when roll handlers run.**

Fix `loadModuleData()` so that:

```js
async function loadModuleData() {
  const sources = {
    kickoff: './data/kickoff-events.json',
    weather: './data/weather.json',
    prayers: './data/prayers.json',
    injury:  './data/injury.json',
  };

  const results = await Promise.allSettled(
    Object.entries(sources).map(async ([key, path]) => {
      const res = await fetch(path);
      if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${path}`);
      DATA[key] = await res.json();
      console.log(`[BB] Loaded ${key}: ${DATA[key].length ?? Object.keys(DATA[key]).length} entries`);
    })
  );

  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      console.error(`[BB] FAILED to load data:`, r.reason);
    }
  });

  console.log('[BB] Data ready. Keys:', Object.keys(DATA));
}
```

Then verify the `DOMContentLoaded` handler is async and awaits `loadModuleData()`:

```js
document.addEventListener('DOMContentLoaded', async () => {
  await loadModuleData();   // ← MUST be awaited before any module init
  
  Dice.initAllDice();
  initPanels();
  initSubTabs();
  initAccordions();
  initGameBar();
  initKickoffModule();
  initWeatherModule();
  initPrayersModule();
  initScatterModule();
  initInjuryModule();
  // ... any other inits
});
```

After this fix, opening the browser console on page load must show lines like:
```
[BB] Loaded kickoff: 11 entries
[BB] Loaded weather: 5 entries
[BB] Loaded prayers: 16 entries
[BB] Loaded injury: object with injury/stunty/casualty keys
[BB] Data ready. Keys: ['kickoff', 'weather', 'prayers', 'injury']
```

If those lines do NOT appear, the fetches are failing. Check Network tab for 404s. The path `./data/weather.json` is correct for a page at `/bloodbowl/index.html`. Do not proceed with other tasks until data loading is confirmed working.

---

## TASK 2 — Fix weather result display

Find `initWeatherModule()`. The roll handler must:

1. After rolling 2D6, call `rangeLookup(DATA.weather, total, 'rollMin', 'rollMax')`.
2. If lookup returns null: show error `<div class="result-name" style="color:red">⚠ No weather data loaded — check console</div>` and return.
3. If lookup returns an entry `w`, render this HTML exactly:

```js
const isPerfect = !w.effect || w.effect === 'No effect';
resultEl.innerHTML = `
  <div class="result-emoji">${w.emoji ?? '⛅'}</div>
  <div class="result-roll-num">${total}</div>
  <div class="result-roll-breakdown">${d1} + ${d2}</div>
  <div class="result-name">${h(w.name)}</div>
  ${isPerfect
    ? `<span class="result-chip result-chip-ok">✓ No mechanical effect</span>`
    : `<span class="result-chip result-chip-warn">⚠ ${h(w.effect)}</span>`
  }
  <hr class="result-divider">
  <p class="result-desc">${h(w.desc)}</p>
`;
resultEl.removeAttribute('hidden');
```

4. Store: `GameState.weather = w;`
5. Show a "Noted — Continue" button (not the roll button) that advances the drive wizard step. This button must always appear after result display, regardless of mode.
6. Show a `↺ Roll Again` button for retesting (below the "Continue" button, smaller/muted).
7. Do NOT disable or grey out unrelated UI when a result is shown. The only thing that should grey out is the Roll button itself (to prevent double-rolling before choosing to re-roll).

---

## TASK 3 — Fix kickoff event result display

Find `initKickoffModule()`. Same pattern:

1. After rolling 2D6, call `exactLookup(DATA.kickoff, total)`. Verify `exactLookup` compares `e.roll === roll` where both are integers.
2. If null: show error, log to console.
3. Render result:

```js
const affects = KICKOFF_AFFECTS[total] ?? 'both';
const affectsChip = {
  kicking:   `<span class="result-chip result-chip-warn">⚽ Kicking team</span>`,
  receiving: `<span class="result-chip result-chip-ok">🏆 Receiving team</span>`,
  both:      `<span class="result-chip result-chip-info">⚖️ Both teams</span>`,
}[affects];

resultEl.innerHTML = `
  <div class="result-roll-num">${total}</div>
  <div class="result-roll-breakdown">${d1} + ${d2}</div>
  <div class="result-name">${h(ev.name)}</div>
  ${affectsChip}
  <hr class="result-divider">
  <p class="result-desc">${h(ev.desc)}</p>
`;
resultEl.removeAttribute('hidden');
```

4. Store: `GameState.kickoffEvent = ev;`
5. Show "Noted — Continue" button and `↺ Roll Again` button.
6. Do not grey out unrelated UI.

---

## TASK 4 — Fix Prayers to Nuffle: persist result to main screen

Two problems: (a) result may not display, (b) result is not shown on the main screen after panel closes.

Fix (a): same pattern as above — verify data loaded, render result with `removeAttribute('hidden')`.

Fix (b): After a prayer is rolled, store it AND display a persistent "active prayer" indicator on the main screen. Add a container to the main page (below the module grid or in the timeline area):

```html
<div id="active-prayer-banner" hidden class="active-prayer-banner">
  <span class="apb-icon">✦</span>
  <span class="apb-text" id="active-prayer-text"></span>
  <button class="apb-dismiss" id="active-prayer-dismiss" title="Dismiss (effect has ended)">✕</button>
</div>
```

CSS:
```css
.active-prayer-banner {
  background: rgba(212, 175, 55, 0.1);
  border: 1px solid rgba(212, 175, 55, 0.35);
  border-left: 3px solid var(--bb-gold, #D4AF37);
  padding: 0.5rem 0.75rem;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.75rem;
  color: rgba(220, 235, 255, 0.85);
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.active-prayer-banner[hidden] { display: none; }

.apb-icon { color: var(--bb-gold, #D4AF37); font-size: 1rem; flex-shrink: 0; }
.apb-text { flex: 1; }
.apb-dismiss {
  background: none;
  border: none;
  color: rgba(180, 200, 255, 0.4);
  cursor: pointer;
  font-size: 1rem;
  padding: 0.2rem;
  flex-shrink: 0;
}
.apb-dismiss:hover { color: rgba(255, 100, 100, 0.8); }
```

After rolling prayers, set:
```js
GameState.activePrayer = prayer;
const banner = document.getElementById('active-prayer-banner');
document.getElementById('active-prayer-text').textContent = `✦ ${prayer.name}: ${prayer.desc.substring(0, 80)}…`;
banner.removeAttribute('hidden');
document.getElementById('active-prayer-dismiss').onclick = () => {
  banner.setAttribute('hidden', '');
  GameState.activePrayer = null;
};
```

The banner stays visible until the dismiss button is tapped (indicating the effect has ended). Players can tap the banner text to open the full prayer detail if needed (open the prayers panel with the result still shown).

---

## TASK 5 — Fix beginner drive wizard lock-up

**Problem**: after rolling weather in the beginner wizard, all UI is greyed out and only minimize/step counter are tappable.

Find the beginner drive wizard step controller. The lock-up is caused by one of:
(a) An overlay or backdrop being shown that intercepts all clicks
(b) All module buttons having `disabled` or `pointer-events: none` applied globally
(c) The wizard step completion logic setting a state that dims everything

Fix:
1. Find what code runs after the weather result is displayed in the wizard. 
2. If a backdrop or overlay is being shown: it must NOT intercept clicks on the wizard itself or on the "Next" button.
3. The wizard's "Next" button must be inside the wizard, not behind the overlay.
4. After result is shown, the ONLY things that should be inactive are: the Roll button (prevent double-roll) and module buttons that are out-of-phase. The wizard itself, its Next button, and the minimize button must remain fully interactive.

Specific fix: ensure that after `resultEl.removeAttribute('hidden')` fires in the weather step, the step's Next button is shown and clickable:

```js
// Pattern to use in every wizard step that requires a roll
function completeWizardStep(stepEl, result) {
  // Show result
  const resultArea = stepEl.querySelector('.wizard-step-result');
  if (resultArea) {
    resultArea.innerHTML = result;
    resultArea.removeAttribute('hidden');
  }
  
  // Show and enable the Next button for this step
  const nextBtn = stepEl.querySelector('.wizard-step-next');
  if (nextBtn) {
    nextBtn.removeAttribute('hidden');
    nextBtn.removeAttribute('disabled');
  }
  
  // IMPORTANT: do not touch anything outside stepEl
}
```

---

## TASK 6 — Add physical dice "lock in result" button

**This is required for physical dice mode to be useful.** When in physical mode, the player taps a result button to choose their physical dice result. But there must also be a "Lock In" confirmation step, because players may accidentally tap the wrong result.

The flow in physical mode must be:

```
[Result buttons shown]
     ↓ player taps a result button
[Button highlights gold, shows "Tap again to confirm or choose another"]
     ↓ player taps same button again, OR taps "Lock In [Result Name]" button
[Consequence logic runs, same as digital]
```

Implement a two-tap confirmation for physical result buttons:

```js
function createPhysicalButton(value, label, consequence, onConfirm) {
  const btn = document.createElement('button');
  btn.className = 'physical-result-btn';
  btn.innerHTML = `<span class="prb-value">${value}</span><span class="prb-label">${label}</span>`;
  
  let pendingValue = null;
  
  btn.addEventListener('click', () => {
    if (pendingValue === value) {
      // Second tap = confirm
      btn.classList.add('confirmed');
      onConfirm(value);
    } else {
      // First tap = select
      document.querySelectorAll('.physical-result-btn').forEach(b => {
        b.classList.remove('selected');
        b.dataset.pending = '';
      });
      btn.classList.add('selected');
      pendingValue = value;
      
      // Show lock-in banner
      const lockBar = btn.closest('.physical-dice-container')?.querySelector('.physical-lock-bar');
      if (lockBar) {
        lockBar.querySelector('.plb-label').textContent = `Lock in: ${label}`;
        lockBar.removeAttribute('hidden');
        lockBar.querySelector('.plb-confirm').onclick = () => onConfirm(value);
        lockBar.querySelector('.plb-cancel').onclick = () => {
          btn.classList.remove('selected');
          pendingValue = null;
          lockBar.setAttribute('hidden', '');
        };
      }
    }
  });
  
  return btn;
}
```

Lock-in bar HTML (inside each wizard's physical dice container):
```html
<div class="physical-lock-bar" hidden>
  <span class="plb-label">Lock in: —</span>
  <button class="plb-confirm">✓ Confirm</button>
  <button class="plb-cancel">✕ Cancel</button>
</div>
```

CSS for physical result buttons:
```css
.physical-result-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-width: 72px;
  min-height: 72px;
  padding: 0.6rem 0.4rem;
  background: rgba(10, 22, 65, 0.65);
  border: 2px solid rgba(70, 110, 200, 0.35);
  border-radius: 8px;
  cursor: pointer;
  font-family: 'JetBrains Mono', monospace;
  color: rgba(180, 210, 255, 0.75);
  transition: background 0.12s, border-color 0.12s, transform 0.1s;
  gap: 0.2rem;
}

.physical-result-btn:hover {
  background: rgba(30, 60, 150, 0.5);
  border-color: rgba(100, 160, 255, 0.5);
  transform: translateY(-2px);
}

.physical-result-btn.selected {
  background: rgba(212, 175, 55, 0.2);
  border-color: var(--bb-gold, #D4AF37);
  color: var(--bb-gold, #D4AF37);
  transform: translateY(-2px);
  box-shadow: 0 0 12px rgba(212, 175, 55, 0.25);
}

.physical-result-btn.confirmed {
  background: rgba(40, 120, 40, 0.2);
  border-color: #2E7D32;
  color: #66EE88;
}

.prb-value {
  font-weight: 800;
  font-size: 1.4rem;
  line-height: 1;
}

.prb-label {
  font-weight: 500;
  font-size: 0.58rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  text-align: center;
  line-height: 1.3;
  color: inherit;
  opacity: 0.8;
}

.physical-lock-bar {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.5rem 0.75rem;
  background: rgba(212, 175, 55, 0.08);
  border: 1px solid rgba(212, 175, 55, 0.3);
  border-radius: 6px;
  margin-top: 0.5rem;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.75rem;
}

.physical-lock-bar[hidden] { display: none; }

.plb-label { flex: 1; color: rgba(220, 235, 255, 0.85); font-weight: 700; }

.plb-confirm {
  background: rgba(212, 175, 55, 0.18);
  border: 1px solid rgba(212, 175, 55, 0.5);
  color: var(--bb-gold, #D4AF37);
  font-family: 'JetBrains Mono', monospace;
  font-weight: 700;
  font-size: 0.72rem;
  padding: 0.3rem 0.7rem;
  border-radius: 4px;
  cursor: pointer;
}

.plb-cancel {
  background: none;
  border: 1px solid rgba(100, 100, 150, 0.3);
  color: rgba(150, 170, 220, 0.5);
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.72rem;
  padding: 0.3rem 0.5rem;
  border-radius: 4px;
  cursor: pointer;
}
```

This pattern must be used in ALL physical dice implementations — block faces, 2D6 total buttons, D6 buttons, D8 compass, D16 buttons.

---

## TASK 7 — Fix kick deviation to show direction + distance result

Find `initScatterModule()` and `bindScatterRoll()` for the deviation tab.

Currently deviation shows the dice but not a direction result like bounce does. Fix:

The direction mapping (same as bounce):
```js
const DIR_ARROWS = {1:'↖', 2:'↑', 3:'↗', 4:'←', 5:'→', 6:'↙', 7:'↓', 8:'↘'};
const DIR_NAMES  = {1:'Up-Left', 2:'Up', 3:'Up-Right', 4:'Left', 5:'Right', 6:'Down-Left', 7:'Down', 8:'Down-Right'};
```

After rolling deviation (D6 distance + D8 direction), show:

```js
deviationResultEl.innerHTML = `
  <div class="result-roll-num" style="font-size: 3rem;">${DIR_ARROWS[dir]}</div>
  <div class="result-name">${DIR_NAMES[dir]}</div>
  <div class="result-roll-breakdown">${dist} square${dist !== 1 ? 's' : ''}</div>
  <p class="result-desc">The ball deviates <strong>${dist}</strong> square${dist !== 1 ? 's' : ''} to the <strong>${DIR_NAMES[dir]}</strong>.</p>
`;
deviationResultEl.removeAttribute('hidden');
```

Also add a `↺ Roll Again` button after the result.

Add numbered labels to the bounce compass. Update the compass CSS and HTML so each direction cell shows both the arrow AND the reference number used in the Blood Bowl rulebook direction chart:

```
[↖ 1] [↑ 2] [↗ 3]
[← 4] [ ● ] [→ 5]
[↙ 6] [↓ 7] [↘ 8]
```

CSS update for compass cells — add a number below the arrow:
```css
.compass-dir {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  font-size: 1.1rem;
}

.compass-dir::after {
  content: attr(data-dir);
  font-size: 0.5rem;
  font-family: 'JetBrains Mono', monospace;
  font-weight: 700;
  opacity: 0.5;
  letter-spacing: 0;
}
```

---

## TASK 8 — Add physical dice toggle to drive wizard

The beginner drive wizard currently has no physical dice toggle. Each step that involves a dice roll must have a `⚄ Digital / 🎲 Physical` pill toggle at the top of that step's content area.

The toggle reads the global dice mode from `settings.js` (or `GameState.diceMode` if settings.js is not yet implemented) and saves the override for that specific roll type.

Add this to every roll-requiring step in the drive wizard:

```html
<div class="step-dice-toggle">
  <button class="dice-mode-pill" data-mode="digital" data-wizard="weather">⚄ Digital</button>
  <button class="dice-mode-pill" data-mode="physical" data-wizard="weather">🎲 Physical</button>
</div>
```

Wire with:
```js
container.querySelectorAll('.dice-mode-pill').forEach(pill => {
  const currentMode = getWizardDiceMode(pill.dataset.wizard);
  if (pill.dataset.mode === currentMode) pill.classList.add('active');
  
  pill.addEventListener('click', () => {
    const wizKey = pill.dataset.wizard;
    const mode = pill.dataset.mode;
    // Save override
    if (!GameState.diceModeOverrides) GameState.diceModeOverrides = {};
    GameState.diceModeOverrides[wizKey] = mode;
    // Update UI
    container.querySelectorAll('.dice-mode-pill').forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
    // Re-render the roll UI for this step
    renderRollUI(wizKey, mode);
  });
});
```

This toggle must function in ALL modes (beginner, veteran, pro).

---

## TEST CHECKLIST

Run all before marking sprint done.

### Data loading
- [ ] Browser console shows `[BB] Data ready. Keys: ['kickoff', 'weather', 'prayers', 'injury']` on page load
- [ ] No 404 errors in Network tab

### Weather
- [ ] Roll weather → emoji + large number + name + effect chip + full description all visible
- [ ] `GameState.weather` is set (check in console)
- [ ] "Noted — Continue" button appears and is clickable
- [ ] `↺ Roll Again` button appears

### Kickoff events  
- [ ] Roll kickoff → event name + team chip + full description visible
- [ ] `GameState.kickoffEvent` is set

### Prayers
- [ ] Roll prayers → prayer name + full description visible
- [ ] Active prayer banner appears on main screen below module grid
- [ ] Banner persists after panel is closed
- [ ] Dismiss button removes banner

### Beginner drive wizard
- [ ] Start Drive → weather step appears
- [ ] Roll weather → result shows → Next button appears and is clickable
- [ ] Next → kicking team step → three options (We kick / They kick / Coin flip)
- [ ] Coin flip → D6 animates → result shows who kicks → auto-advances
- [ ] At no point does the wizard lock up all UI

### Physical dice
- [ ] Physical mode toggle present in every wizard with a dice roll
- [ ] Tapping a result button → highlights it gold
- [ ] Tap same button again OR tap "✓ Confirm" → consequence logic runs
- [ ] "✕ Cancel" → deselects, lock-in bar hides

### Scatter/deviation
- [ ] Kick deviation roll → large direction arrow + direction name + distance shown
- [ ] Bounce compass shows numbers 1–8 in each cell
- [ ] `↺ Roll Again` on all three scatter types

### No lock-up
- [ ] In beginner mode: after rolling weather, wizard Next button is clickable
- [ ] In pro mode: rolling weather shows result and does not grey out other modules

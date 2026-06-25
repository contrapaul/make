# Handoff — Blood Bowl Companion: Wizard UI Revision (next session)

**Focus of the next session:** apply the UI refinement design language to the
**action wizards** (Block, Foul, Pass, Throw, Special) + the kickoff/Drive wizard.
A new **designer handoff package** will be provided (like the Phase-1 one). Read
that package's README first; this doc is the codebase-side context that complements it.

Repo: `make/bloodbowl` (git root is `make`, remote `contrapaul/make`, branch `main`).
It's a vanilla multi-page app: lobby `index.html` (menu + rosters) and `game/index.html`
(the live game, `<base href="../">`). Single shared CSS/JS; no build step.

---

## What's already done (Phase 1 — design language + rosters/card) — DON'T redo

Committed & pushed. Build the wizard revision **on top of** these:

- **Design tokens** — `css/tokens.css?v=2`. Colour/surface/glass tokens + type-role
  vars: `--bb-font-display` (Nuffle), `--bb-font-head` (Barlow Condensed),
  `--bb-font-body` (Barlow), `--bb-font-num` (JetBrains Mono — NUMBERS ONLY).
  Also `--bb-panel-bg/-border/-shadow`, `--bb-bar-bg/-blur`, `--bb-parchment`,
  `--bb-text/-muted/-faint`, `--bb-hairline`, `--bb-gold-grad`.
- **Fonts are SELF-HOSTED** — `@font-face` in `style.css`, files in `bloodbowl/fonts/`
  (Barlow + Barlow Condensed, woff2+woff). **NEVER use Google Fonts** — they break in
  China. JetBrains Mono + Nuffle were already self-hosted.
- **Unified trading card** — `js/player-card.js?v=2`. One container-query card (all
  internals in `cqw`), renders identically everywhere. Root frame on `.trading-card`
  is **px** (an element isn't its own query container, so cqw on the root resolves to
  the viewport — gotcha). Accent resolves as
  `var(--team-accent, var(--tc-primary, #3b6fe0))` — the existing per-team `--tc-primary`
  drives it. Do NOT default `--team-accent` in `:root` (it would shadow the team colour).
- **Roster rows** — `script.js?v=9` (`buildCard`) + `style.css?v=6` (`.player-card`/`.pr-*`):
  parchment row, team-accent edge bar, jersey chip, 116px 2-line name column, stat
  micro-cells, accent-tinted skill pills (`.pr-skill` = `.skill-link[data-skill]` → reuses
  the existing skill-reference tooltip system; `openSkillPopup` in script.js) capped at 5
  with a "+N" inline-expand chip, cost, gold star rows.
- **Card modal from roster rows** — works (user confirmed).
- The wizards **already embed the unified card** via `.bwiz-card-wrap` (now a **px**
  width, 200px — was an `em` width that drifted under FitScale; that was the "wizard vs
  teams inconsistency" fix) and `.bwiz-embedded-card`.

## In-flight / NOT done

- **Arena background** — only `images/arena.png` (committed, the lego sample) exists.
  The toggle/scrim/CSS/JS were **never wired** (`js/settings.js` has no arena code).
  Deferred — the designer's Phase-1 README §6 has the full spec (fixed image layer +
  scrim levels Lighter/Medium/Darker, Game Settings toggle, persisted in localStorage).
  Pick this up later if wanted; not the wizard focus.

---

## The wizards (what to revise)

**JS:**
- `js/wizards.js` — Block (`initBlockWizard`), Foul (`initFoulWizard`), Throw
  (`initThrowWizard`), Special (`initSpecialWizard`). Shared helpers: `buildWizardPlayerList`,
  `buildEmbeddedCard`, `onPanelOpen(panelId, fn)`, `attachSkillEvents`, `FitScale`.
- `js/pass-wizard.js` — Pass (rebuilt 8-step `initPassWizard`, its own pitch).
- `js/drive-wizard.js` — kickoff sequence (weather/kicking/prayers/deviation).
- `js/game-page.js` — turn engine + the per-drive **fielding wizard** (repurposed intro
  overlay; 3-col player grid, bench selection); `js/panels.js` — panel show/hide + dice pills.

**CSS:** `css/wizards.css?v=21`, `css/pass-v3.css?v=13`, `css/drive-wizard.css?v=3`,
`css/panels.css?v=4`, `css/game-page.css?v=7`.

**Panels (markup in BOTH index.html and game/index.html):** `#panel-block`, `#panel-foul`,
`#panel-pass`, `#panel-throw`, `#panel-special`, `#panel-kickoff`, `#panel-weather`,
`#panel-prayers`, plus `#panel-startgame`, `#panel-gamesettings`.

**Wizard mechanics already in place (don't regress):**
- Wizards scale via **FitScale** — a fixed `74em×46em .bwiz-scale-root` is transform-scaled
  to fit. (`em`-based internals are intentional inside the stage; the embedded card is the
  exception — it's px.)
- Pickers default to the **active team** (`window.activeRosterSide()` → 'left'/'right' from
  `GameState.activeTeam`; falls back to home outside the game).
- **Block wizard stays open** across a turn: terminal button is **"Confirm Result"** (blue,
  `roll-btn--confirm`) which dismisses the matchup and reopens the picker; when no one on the
  active team can still act, the Roll button becomes a green **"End Turn"**. Only End Turn is
  green; all Confirm Result buttons are blue.
- Roll button glow was tuned (don't let pulse box-shadow clip the frame; button is narrowed +
  centered).

## Phase 2 — Card Event Effects (likely part of the designer's wizard package)

The designer's Phase-1 README **Appendix A** documents the approved card event effects and
the outcome→effect mapping (Defender Down, Armour break→Stunned/Casualty, Dodge, Both Down,
Pass complete, Catch, Fumble, buff). Reference impl in the Phase-1 package:
`reference/fx-sequence.js` (framework-free `customElements` web component — portable) and
`reference/Card Effects Menu.dc.html`. There's also an exploratory gallery at
`bloodbowl/effects/index.html` (temporary, 28 candidate effects).
**These were NOT wired yet** — wiring them onto the embedded wizard cards (an absolutely-
positioned `pointer-events:none` overlay on the card, triggered on game events; sync anchor
`IMPACT = 235ms`) is the natural Phase-2 wizard task. Wait for the designer's wizard files
before implementing — they'll specify the final look.

---

## Gotchas / workflow (read before editing)

- **Cache-bust:** every JS/CSS file is loaded with `?v=N`. Bump the version in **BOTH**
  `index.html` AND `game/index.html` on every edit, or the browser serves stale files.
  Current: tokens.css v2, style.css v6, script.js v9, player-card.js v2, wizards.css v21,
  pass-v3.css v13, drive-wizard.css v3, panels.css v4, game-page.css v7, settings.js v2,
  state.js v12, pass-wizard.js v14.
- **NO Google Fonts** (China). Self-host into `bloodbowl/fonts/`.
- **Preview verification:** `preview_screenshot` **times out** on this app (a continuous CSS
  animation never settles) — verify via `preview_eval` DOM geometry / `getComputedStyle`
  instead. Dice rolls hang headless preview (rAF), so a full wizard click-through can't be
  screenshotted — verify each link individually (selectors, classes, computed styles).
- **Getting into the game env for testing:** the game page needs `localStorage['bb:activeMatch']`
  e.g. `{v:1,home:{kind:'default',id:'human'},away:{kind:'default',id:'dwarf'},gameMode:'seasoned',createdAt:Date.now()}`
  + `bb:selectedSides {left:{id:'human',kind:'default'},right:{id:'dwarf',kind:'default'}}`, then
  load `/game/`. To open a panel for inspection: `document.getElementById('panel-block').removeAttribute('hidden')`
  (the `onPanelOpen` MutationObserver fires on the hidden-attr change).
- **Preview server:** launch config `bloodbowl` serves `bloodbowl/` on :5501 (plain http.server,
  so the `?v` bumps matter). Use `preview_start` name `bloodbowl`.
- Skill categories/colours live in `script.js` (`SKILL_COLORS`/`SKILL_BADGE`, match the Skills
  page). Skill data in `state.skills` via `lookupSkill`.

## First steps for the new session
1. Read the designer's new wizard package README (high-fidelity values).
2. Re-read this doc + skim `css/wizards.css`, `js/wizards.js` (block wizard), `js/pass-wizard.js`.
3. Apply the glass/token/type language to the wizard panels + stage chrome; keep FitScale, the
   embedded unified card, the active-team pickers, and the Block "Confirm Result/End Turn" flow.
4. Then (if in the package) wire the Phase-2 card event effects onto the embedded cards.

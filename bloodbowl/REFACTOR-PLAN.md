# Refactor Plan — bloodbowl shell, payload, and paint stability

Status: **executed 2026-08-03**, see below. Phases 0–2 done in full. Phase 3
done except two items intentionally deferred (§3 notes why), plus one new
finding from the work itself.

## Execution status

**Done, verified in-browser (console-clean, screenshots, click-through):**
- Phase 0 — title-quips.js syntax bug fixed, COACH/JOIN GAME banks added,
  every "placeholder top/bottom" replaced with real copy.
- Phase 1 — `_shell/header.html` + `_shell/footer.html` + `_shell/preload.html`
  are now the only copies; `tools/build-shell.mjs` expands them into all 14
  pages and content-hashes every local `?v=`; `tools/check-pages.mjs` guards
  against regressions (missing assets, JS syntax, placeholder leaks, version
  drift, missing markers). `js/shell.js` replaces the 15 duplicated nav-toggle
  inline scripts; the `game/`/`play/` game-wiring IIFE no longer gates on
  header markup existing (§1.2's real bug).
- Phase 2 — Nuffle/Nuffle Italic/Nuffle Dice → `font-display: block`; 6
  above-the-fold font files preloaded per-page; `body` font-family fixed
  (was silently inheriting Space Grotesk/Helvetica from the parent site);
  `.bb-app`'s hardcoded `calc(100vh - 52px - 60px)` removed in favor of the
  flex-column shell the parent already provides (`main{flex:1 0 auto}`).
- Phase 3 (partial, see below) — `index copy.html` deleted; `effects/` moved
  to `_dev/effects/` (still in git — Cloudflare Pages with
  `pages_build_output_dir:"."` has no path-exclusion mechanism short of
  gitignoring it, which would drop it from version control; flagging that
  tradeoff rather than deciding it). Parent `../style.css` (26KB, used for
  ~10 lines' worth of rules, fought the rest of the way per its own
  comments) dropped from all 14 pages; replaced with bloodbowl-owned
  `css/shell.css` (reset + dark-theme body/main shell) plus a few properties
  migrated directly onto `.bb-site-header`/`.bb-footer-brand` that were
  quietly relying on the parent (header height/padding, footer-brand
  `text-transform:uppercase`). Verified pixel-identical via screenshot at
  desktop/700px/375px on 8+ pages plus a full `game/` fielding-wizard
  click-through.

**Deferred — not attempted, flagged for a dedicated follow-up:**
- **Step 14** (split `style.css` into shell/cards/skills/game files) — pure
  organizational payload work, no correctness payoff, large mechanical diff.
  Lower priority than it looked before Phase 3's investigation showed the
  parent-stylesheet removal already captures most of the payload win.
- **Step 15** (trim the wizard-only JS/CSS bundle out of `play/`) — real
  payload win (play/ loads wizards.js/pass-wizard.js/drive-wizard.js/
  throw-wizard.js/pitch.js/spp-tracker.js despite having no wizard panels),
  but `wizards.js` exposes globals (`FitScale`, `buildEmbeddedCard`) that
  other loaded scripts may depend on for the trading-card modal outside
  actual wizard panels — needs a real dependency trace across ~2300+ lines
  before it's safe to cut, not a same-session call.

**New finding — not fixed, needs live-game verification before touching:**
Investigating step 17 (cross-file selector collisions) found the collisions
are **not cosmetic duplicates — they're two full, different implementations
of the same components under the same class names**, both loaded on
`game/`/`play/`:
- `.result-roll-num`, `.result-desc`, `.result-chip(-ok|-warn|-bad)` —
  defined once in `css/panels.css`, differently in `css/wizards.css`.
- `.pwiz-mod-row`, `.pwiz-skill-chip`, `.pwiz-action-*` (9 selectors),
  `.chip-throw/-int/-catch/-scatter`, `.pwiz-reroll-counter`,
  `.pwiz-mod-breakdown/-label/-value`, `.pwiz-skill-tooltip` — defined once
  in `css/pitch.css` (rem-based), differently in `css/wizards.css` (em-based,
  scales with FitScale).
- `.pwiz3-roll-btn` — `css/pass-v3.css` vs `css/wizards.css`.

Load order on `game/`/`play/` is `wizards.css` → `pass-v3.css` → `pitch.css`,
so **`pitch.css`'s and `pass-v3.css`'s versions currently win** for every one
of these — meaning `wizards.css`'s corresponding rules are dead weight *if*
pitch.css's versions are the intended ones, or a live bug *if they're not*.
Given the codebase's own testing notes (`HANDOFF-wizard-revision.md`: dice
rolls hang headless preview, wizard click-throughs can't be screenshotted),
resolving which version is "correct" needs a live, interactive pass-wizard
session, not a blind rename. Flagging file:selector pairs above rather than
guessing.

---

Scope: the 14 shipped pages under `bloodbowl/` (plus the untracked-but-deployed
leftovers), their shared shell markup, the stylesheet/script loading, and the
loading-time visual instability. Game logic, wizards, rules data, and the API
are **out of scope** except where a file is loaded on a page that doesn't use it.

---

## 1. What's actually wrong (measured, not guessed)

Every claim here was verified against the working tree and a live local render
(`python -m http.server`, Chromium).

### 1.1 Live bugs, shipping right now

| # | Finding | Evidence |
|---|---|---|
| B1 | **`js/title-quips.js` does not parse.** Line 47 has an unescaped apostrophe inside a single-quoted string (`'YOU'LL FIND THAT IKEA…'`). The whole file throws `SyntaxError`, so `TITLE_QUIPS` is never defined and no page ever gets its subtitle. | `node --check js/title-quips.js` fails; in-browser `typeof TITLE_QUIPS === 'undefined'`. Introduced in the most recent commit `a348d40`. |
| B2 | **11 pages display the literal words "PLACEHOLDER TOP" / "PLACEHOLDER BOTTOM"** in Nuffle Italic, at full size, above and below the page title — a direct consequence of B1. | Screenshot of `/bloodbowl/skills/`. Same markup in about, account, browse, coach, join, rules, skills, starplayers, tables, teams, tournaments. |
| B3 | `TITLE_QUIPS` has **no bank for COACH, JOIN GAME, or PLAY**, so those pages would still show placeholders even after B1 is fixed. `play/` doesn't load `title-quips.js` at all and hardcodes the homepage's old title; `game/` has no title block. | `js/title-quips.js` keys vs. `bb-title-main` text per page. |
| B4 | **Body copy renders in Helvetica by accident.** `bloodbowl` never sets a `body` font, so it inherits `--font-body: 'Space Grotesk'` from the *parent site's* `../style.css`. Space Grotesk is not loaded anywhere in this project, so it falls through to Helvetica/Arial. | `getComputedStyle(document.body).fontFamily` → `"Space Grotesk", "Helvetica Neue", Arial`. Visible on the homepage: the News card's heading is Barlow Condensed, its paragraphs are Helvetica. |

B1 and B2 are a one-character fix and should land before any refactoring.

### 1.2 The duplication

- **The header is copy-pasted into 14 files** (~20 lines each), the footer into
  14 (~6 lines each), and the mobile-nav toggle IIFE into 15 (~15 lines each,
  including `index copy.html`).
- They have already drifted: the footer disclaimer uses an em-dash on `index.html`
  and a comma everywhere else; the home button reads "Main Menu" on `index.html`
  and "Return to Main Menu" on the other 13; `skills/` is the only page that marks
  its own nav link `.active`.
- On `game/` and `play/` the nav-toggle snippet was pasted into the *top* of the
  page's game-wiring IIFE, keeping its `if (!toggle || !nav) return;` guard. The
  toggle still works, but **every game button on those pages is now gated on the
  header markup existing** — change an id in the header and the game page silently
  stops responding, with no error.
- `game/index.html` and `play/index.html` share **267 identical lines** (roster
  section, trading-card modals, skill tooltip, chooseteam/myteams/gamesettings
  panels, two inline script blocks).

### 1.3 Cache-busting has broken apart

The `?v=N` convention documented in `HANDOFF-wizard-revision.md` ("bump in BOTH
index.html and game/index.html") stopped being maintainable once the site grew to
14 pages. Today the same files ship under different cache keys:

| File | index / game / play | the other 11 pages |
|---|---|---|
| `style.css` (52 KB) | `?v=9` | `?v=3` |
| `css/tokens.css` | `?v=2` | *(no query)* |
| `css/live.css` | `?v=2` | `?v=1` (join) |
| `js/player-card.js` | `?v=2` | *(no query)* (teams) |

Effect: navigating home → skills **re-downloads the 52 KB stylesheet and the
tokens file under fresh URLs** (confirmed in the network log), and a visitor who
has `?v=3` cached from an earlier visit gets a months-stale stylesheet on the
content pages. This is a plausible primary cause of the "it re-renders every time
I click something" feeling.

### 1.4 Payload

Uncompressed bytes of CSS + JS requested per page, and file count:

| Page | CSS | JS | Total | Files |
|---|---:|---:|---:|---:|
| `play/` | 301 KB | 476 KB | **777 KB** | 33 |
| `game/` | 314 KB | 491 KB | **805 KB** | 35 |
| `teams/` | 113 KB | 82 KB | 195 KB | 12 |
| `index.html` | 96 KB | 18 KB | 115 KB | 9 |
| `rules/`, `tables/`, `skills/`, `starplayers/`, `about/` | ~85 KB | ~6 KB | ~92 KB | 5–6 |

Two specific problems behind those numbers:

- **`play/` pays the full game-engine cost for panels it does not contain.** Its
  markup has only `#panel-startgame`, `#panel-chooseteam`, `#panel-myteams`,
  `#panel-gamesettings`, `#panel-backdrop` — no block/foul/pass/throw/special/
  kickoff/weather/prayers panels — yet it loads `wizards.js` (2301 lines),
  `pass-wizard.js` (994), `drive-wizard.js` (941), `throw-wizard.js` (716),
  `pitch.js` (953), `spp-tracker.js` (561) and their four stylesheets.
- **Every page loads the parent site's `../style.css` (26 KB)** for four things:
  the reset, `body{display:flex}`, `.site-header`/`.nav`, `.site-footer`. The
  other ~900 lines style the landing/`/fun`/`/tools` pages, which don't exist
  here. Worse, `bloodbowl/style.css` then spends a block fighting it — its own
  comments say so: *"The parent site styles `.site-header` as the flex row and
  has no `.header-inner` — …it must become the flex row itself or everything
  stacks in a block"* and *"Parent `.site-footer` is a flex ROW, which put the
  disclaimer beside the brand/about pair and crushed them together"*.

`bloodbowl/style.css` is 1627 lines in one file. A content page like `rules/`
loads all of it to use roughly 250 lines (shell + page title + header/footer).

### 1.5 The "unpolished" symptoms, traced to causes

| Symptom | Cause |
|---|---|
| Text appears in one font, then snaps to another | Six typefaces render on the homepage, all `font-display: swap`, none preloaded (Nuffle, Nuffle Italic, Nuffle Dice, Barlow, Barlow Condensed, JetBrains Mono). The Nuffle hero is `clamp(2.2rem, 7vw, 5.5rem)` — the Helvetica→Nuffle swap moves a 5.5rem headline and everything under it. |
| Text visibly *changes wording* on load | The placeholder-then-JS-swap pattern in `.bb-page-title` (§1.1 B2). Even fully working, this is a guaranteed flash of one string replaced by another. |
| Spaces sizing up and down | `.bb-app { min-height: calc(100vh - 52px - 60px) }` hardcodes a header of 52px and footer of 60px. The header actually measures **57px**, and the footer varies with disclaimer wrapping. On mobile, `100vh` also re-resolves when the URL bar hides/shows. |
| Inconsistent typography | The token system in `tokens.css` declares four type roles (Nuffle display / Barlow Condensed heads / Barlow body / **JetBrains Mono numbers only**). The CSS actually contains **306 hardcoded `font-family: 'JetBrains Mono', monospace`** declarations against 24 `var(--bb-font-body)` + 18 `var(--bb-font-head)` + 10 `var(--bb-font-num)`. Two competing type systems, migration abandoned partway. |
| Occasional "which rule wins?" bugs | 30 class selectors are defined in two stylesheets at once. `.pwiz-*` (16 selectors) in both `pitch.css` and `wizards.css`, `.result-*` (6) in both `panels.css` and `wizards.css`, `.pwiz3-roll-btn` in both `pass-v3.css` and `wizards.css` — all pairs loaded together on `game/`, so behaviour depends on `<link>` order. `.tb-section` / `.tb-section-title` mean different things in `tables.css` and `team-builder.css` (latent — no page loads both today). |

### 1.6 Dead weight

- **`index copy.html`** — 32 KB, tracked in git, served publicly at
  `/bloodbowl/index%20copy.html`. It is the pre-`df070f0` homepage, superseded by
  `play/index.html`. Has a UTF-8 BOM. Nothing links to it.
- **`effects/index.html`** — 242 lines, self-titled "(temp)", entirely
  self-styled, no header/footer, linked from nowhere. `HANDOFF-wizard-revision.md`
  cites it as a Phase-2 reference gallery, so it has a reason to exist — but not
  in the deploy path.
- `HANDOFF-wizard-revision.md`'s "Current: …" version list is stale on every entry.

---

## 2. Decisions I need from you

These three change the shape of the work. My recommendation is marked.

**D1 — How should the shared shell be single-sourced?**

- **(A) Build-time include — recommended.** A ~60-line Node script
  (`tools/build-shell.mjs`) expands `<!-- @shell:header -->…<!-- @shell:end -->`
  markers in each page from one partial file, and stamps every local CSS/JS URL
  with a content-hash `?v=`. Committed pages stay plain static HTML, so
  Cloudflare Pages (`pages_build_output_dir = "."`) and `python -m http.server`
  both keep working untouched, and there is **zero runtime cost and no flash**.
  Cost: one `npm run build` before commit (can be a pre-commit hook).
- (B) Runtime JS injection of the header/footer. No build discipline needed, but
  it introduces exactly the header-pops-in flash we're trying to remove. Rejected.
- (C) Cloudflare Pages Function + HTMLRewriter at the edge. Needs `_routes.json`
  to intercept HTML, adds per-request cost, and breaks the plain-http.server
  local workflow. Rejected.

A is the only option that makes the `?v=` drift (§1.3) *structurally impossible*
rather than a discipline problem, which is why I recommend it.

**D2 — How far to take the type-system migration?**

- **(a) Conservative — recommended for this pass.** Fix only the accidental
  Helvetica inheritance (B4): set `body { font-family: var(--bb-font-body) }`.
  Visible change: body copy on the homepage/news/feed/about switches from
  Helvetica to Barlow — which is what the design language already intended.
  Leave the 306 hardcoded JetBrains declarations alone.
- (b) Full migration: move all 306 to role tokens, restoring "JetBrains Mono =
  numbers only". This restyles nearly every surface on the site and needs a
  visual pass page by page. Better as its own phase with you reviewing screenshots.

**D3 — What gets deleted?**

- `index copy.html` — delete (recommended; it's recoverable from git and nothing
  links to it).
- `effects/index.html` — my recommendation is to keep the file but move it to
  `bloodbowl/_dev/effects/` and add an exclusion so it isn't deployed. Say if
  you'd rather delete it or leave it where it is.

---

## 3. The plan

Each phase is independently shippable and independently revertable. Verification
is listed per step because there is no test suite; the checks are concrete.

### Phase 0 — Stop the bleeding (no refactoring)

Small, obvious fixes that are shipping bugs today. Do these first so the refactor
starts from a working baseline.

1. Escape the apostrophe in `js/title-quips.js:47`.
   → verify: `node --check js/title-quips.js` exits 0; on `/bloodbowl/skills/`,
   `typeof TITLE_QUIPS !== 'undefined'` and the subtitle is no longer "PLACEHOLDER TOP".
2. Add quip banks for `COACH`, `JOIN GAME`, `PLAY`; load `title-quips.js` on
   `play/`.
   → verify: no page in the site renders the string "placeholder" (grep the
   rendered DOM of all 14 pages).
3. Replace every `<span class="bb-title-sub">placeholder top</span>` with a real
   default line from that page's bank, so a broken/slow script can never expose
   scaffolding again.
   → verify: `grep -ri placeholder bloodbowl/*.html bloodbowl/*/index.html` is empty.

*Estimated: ~30 minutes. Independent of D1–D3.*

### Phase 1 — Single-source the shell (needs D1)

4. Create `bloodbowl/_shell/header.html`, `_shell/footer.html`, `_shell/head.html`
   (the meta/stylesheet/script boilerplate), and `js/shell.js` holding the one
   copy of the nav-toggle IIFE.
5. Write `tools/build-shell.mjs`: expands the markers, marks the current page's
   nav link `.active`, sets the home button label ("Main Menu" on `/bloodbowl/`,
   "Return to Main Menu" elsewhere — the one intentional per-page difference), and
   stamps `?v=<content-hash>` on every local asset URL.
6. Run it across all 14 pages; delete the 15 inline nav IIFEs. On `game/` and
   `play/`, split the nav-toggle out of the game-wiring IIFE so the game buttons
   are no longer gated on `if (!toggle || !nav) return;` (§1.2).
   → verify: every page's rendered header/footer HTML is byte-identical apart from
   the two intentional differences; the mobile hamburger opens and closes on all
   14 pages at 375px; every game button on `game/` still fires with the header
   removed from the DOM.
7. Add `tools/check-pages.mjs` (~40 lines) run by the same npm script: asserts
   (a) every referenced local asset resolves on disk, (b) every `.js` passes
   `node --check`, (c) no page contains "placeholder", (d) every page's shell
   block matches the partial, (e) no asset is referenced under two different
   `?v=` values.
   → verify: it fails on the current tree (it would have caught B1 and §1.3) and
   passes after the phase.

*This is the phase that removes the "old headers and footers in each page"
problem at its root.*

### Phase 2 — Paint stability (the polish)

8. Preload the six above-the-fold font files (`Nuffle`, `Nuffle Italic`,
   `Barlow-Regular`, `BarlowCondensed-SemiBold`/`-Bold`, `JetBrainsMono-Regular`)
   via `<link rel="preload" as="font" type="font/woff2" crossorigin>` in the
   shared head partial.
9. Change the three Nuffle faces to `font-display: block`. They are 6–8 KB each;
   a brief invisible period is strictly better than a 5.5rem Helvetica headline
   reflowing to Nuffle. Keep `swap` on Barlow/JetBrains, but add metric-matched
   fallback faces (`local()` + `size-adjust`/`ascent-override`) so their swap
   causes no reflow.
   → verify: reload with a throttled network; the hero's `getBoundingClientRect()`
   height is identical before and after `document.fonts.ready`.
10. Set `body { font-family: var(--bb-font-body) }` (D2a).
    → verify: `getComputedStyle` on body no longer reports Space Grotesk anywhere.
11. Replace `.bb-app { min-height: calc(100vh - 52px - 60px) }` with a flex
    column shell (`body{min-height:100svh;display:flex;flex-direction:column}`,
    `main{flex:1}`), using `svh` so mobile URL-bar chrome doesn't resize the page.
    → verify: at 375×667 with and without simulated browser chrome, the footer
    sits at the bottom with no scroll and no jump; `.bb-app` computed
    `min-height` no longer contains a magic number.
12. Reserve height on `.bb-title-sub` so the quip swap can't reflow the page.
    → verify: cumulative layout shift on load is 0 for the title block.

### Phase 3 — Payload and cascade (needs D3)

13. Drop `../style.css` from all bloodbowl pages; move the ~40 lines actually used
    (reset, body flex, `.site-header`/`.nav`/`.site-footer` base) into a new
    `css/shell.css`, and delete the override-fighting block at
    `style.css:1279–1468` that only exists to undo the parent sheet.
    → verify: screenshot diff of all 14 pages before/after at 1280px and 375px;
    −26 KB per page.
14. Split `style.css` (1627 lines) along its existing section comments:
    `shell.css` (tokens, fonts, header/footer, page title, base) ·
    `cards.css` (player cards, trading cards, holographic) ·
    `skills.css` (skill cards + tooltip — already partly separate) ·
    `game.css` (status badges, action cards, wizard pickers). Content pages then
    load shell + at most one more.
    → verify: same screenshot diff; content pages drop from ~85 KB CSS to ~15 KB.
15. Audit and remove the wizard bundle from `play/` — it has no wizard panels
    (§1.4). Dependency direction checked: `wizards.js` consumes `script.js`'s
    `attachSkillEvents` behind a guard, not the reverse, so this looks safe, but
    each removal gets verified individually rather than dropped wholesale.
    → verify: on `play/`, full New Game (local *and* cloud) → team pick → My Teams
    → team builder → launch into `game/`, with a clean console.
16. Delete `index copy.html`; relocate `effects/` per D3.
17. Resolve the 30 cross-file selector collisions (§1.5), starting with the
    `.pwiz-*`/`.result-*` pairs that are actually loaded together on `game/`.
    → verify: the duplicate-selector scan reports zero collisions among
    stylesheets loaded on the same page.

### Phase 4 — Optional, only if you pick D2b

18. Migrate the 306 hardcoded `'JetBrains Mono'` declarations to role tokens,
    page group by page group, with a screenshot review at each step.

---

## 4. What this does *not* touch

Game logic, wizard behaviour, `state.js`, the API/Functions, rules data, and the
FitScale/embedded-card mechanics described in `HANDOFF-wizard-revision.md`. The
only files under `js/` that change are `title-quips.js` (one character),
`shell.js` (new), and the inline scripts on `game/`/`play/` (moved, not rewritten).

## 5. Sequencing note

Phases 0 and 2 deliver most of the *visible* polish. Phase 1 is what stops the
problem from growing back. Phase 3 is the largest diff and the one that most
needs the screenshot-diff discipline. They can be reviewed and merged separately.

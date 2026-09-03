# v100 Handoff — Phase 6 (Hardware Lab), M1 of 4

**Date:** 2026-09-03 · **Status: P4 SIGNED OFF by owner ("this site is looking ridiculously good"); JSON error CLOSED as external.** Owner picked **P6 (Hardware Lab)** over P5. **P6 M1 COMPLETE**: Lab shell + control rail bound two-way to the signed-off store; `test/ui.test.mjs` **40/40 green** · `test/engine.test.mjs` **62/62 green**; committed. Next: **M2 printouts rail**, then M3 simulation, M4 concurrency/offload teaching moments.

Project: `/home/paul/Documents/GitHub/make/tools/local/v100/` (NOT the Bionic workspace folder). Static multi-tab site, vanilla HTML/CSS/JS ES modules, no build step. Spec in `blueprint.md`, owner Q&A in `plans.md`. This file supersedes the session-9 handoff and completes its P4 kickoff + build.

---

## The task right now (owner's latest instructions)

Owner: *"Proceed with P6."* (after reviewing state; P4 was the last signed-off phase). Building **Phase 6 — Hardware Lab** per blueprint §6 Tab 3 in four sub-milestones, each tests-green + handoff-updated + committed:

| # | Scope | Status |
|---|---|---|
| **M1** | Lab shell (3-rail layout) + control rail bound two-way to the store: platform mode/AIO/GPU×count/RAM tier+capacity/CPU, model slider w/ anchor readout, quant segmented (+explainer slot), context/prompt-split/concurrency toggles | ✅ DONE 2026-09-03 — `test/ui.test.mjs` 40/40 (was 31) · engine 62/62 · committed |
| **M2** | Printouts rail: decode speed, TTFT, power, ¥/$ per M tokens, memory-fill bar w/ VRAM/RAM split + ok/warn/fail states, fit-state chip, doesn't-fit diagnosis (suggestions from engine), pulse-on-change (§8), quant explainer card content | ⏳ NEXT |
| **M3** | Run Inference simulation: idle→charging→running state machine on `.run-btn`, load bar → prefill beat → token conveyor at the engine's rate (displayed tok/s = engine value, ±5% acceptance by construction), gauge + 256-token progress, labeled time-compression for slow configs, reduced-motion path | ⏳ |
| **M4** | Concurrency teaching moment (per-request vs total throughput divergence, TTFT ×B queueing) + offload teaching moment (visible slowdown + one-sentence why), then full verification: both suites, `node --check`, live light+dark review, blueprint §11 P6 row flipped + verification log | ⏳ |

**Agent-decided so far in P6 (labeled in code):** first AIO switch seeds `platformId` with the first AIO (`mba-m5`) since DEFAULT_CONFIG has none · RAM tier switch clamps a stranded capacity to nearest offered value (192→128 on DDR4) and hides tier-exclusive chips · slider fill refresh via guarded `input` dispatch (no event loops; P3's `bindRangeFill` listener does the work).

## ✅ The JSON error (owner-reported) — CLOSED 2026-09-02

**RESOLVED:** owner supplied the exact message — **"Unterminated string in JSON at position 347 (line 1 column 348)"** — and confirmed it appeared **in harness stream/output, not on any v100 page**, with no file reference. That matches the audit below: there is no code path in v100 that throws a JSON error. **Closed as external to v100; owner said "no worries."**

Session-10 audit (kept for the record):

- **The v100 codebase cannot produce an uncaught JSON error.** Verified by full-project search + reading every JSON touchpoint:
  - `js/state/store.js` is the ONLY runtime JSON user. `loadPersisted()` wraps `JSON.parse` in try/catch → corrupt state falls back to defaults (a green test proves exactly this path); `persist()` wraps `JSON.stringify` in try/catch. Neither can throw.
  - Zero `fetch()` calls anywhere; no `.json` assets are loaded by the site; `package.json` is valid JSON and browsers ignore it anyway.
- Both suites were re-run green at session start (21/21 + 62/62) **before** any P4 code was written, so the error predates this build and isn't caused by it.
- **Conclusion: the error almost certainly came from OUTSIDE the v100 site** — most likely the Bionic/LM Studio app UI itself (attachment/session payload), a browser extension, or another tab.

**Status: closed — no further action.** If it recurs, note where it appears (app UI vs browser console); per the audit above there is no code path in v100 that throws a JSON error.

## What was built this session (P4 — Home tab)

| File | Change |
|---|---|
| `css/tabs.css` **NEW** (~200 lines) | Per-tab layout/motion per blueprint §2: full-viewport hero, floating glass panels (`translate`-property animation, hidden <900 px), pure-CSS token-glyph stream (two identical halves → seamless −50 % translate; `mask-image` edge fade), 3-beat story grid, bandwidth bars, local/cloud fork cards, explore grid + tab-card link styling. All colors via tokens; own reduced-motion block. |
| `js/tabs/home.js` **NEW** | Hero "Start exploring" CTA → smooth-scroll to `#story` (reduced-motion → instant). DI-friendly for Node tests. |
| `js/app.js` | **+ exploration tracker (blueprint §4)**: `TAB_TO_STORE` mapping (`how`↔`pipeline`), pure `trackerView()`/`unseenRouterTabs()`, `initTracker({doc, storage, store})` rendering nav dots + Home tab-card dots + progress ring (`--progress`, label n/4, aria-label) + Explorer badge; one-time celebration (`.is-once` restart pattern from the P3 harness) gated on localStorage flag **`v100-celebrated`** (agent-decided: separate key — signed-off P2 persisted shape untouched). `initRouter` now also returns `initial` (additive); `initApp` marks the load-time tab visited + wires hashchange → `markVisited`. |
| `index.html` | Home placeholder **replaced**: hero (eyebrow/H1/sub/CTA pair incl. "Skip to the Lab" ghost link) + 3 story beats (weights table · bandwidth bars 936 vs 96 GB/s · local/cloud fork at ¥0.65/kWh) + explore grid (ring `#explore-ring` + 3 tab cards with dots). Celebrate spans added next to `#explorer-badge`. `tabs.css` linked after base.css. |
| `test/ui.test.mjs` | **+10 checks → 31/31 green**: mapping, pure view fns (incl. foreign-id rejection), fresh-visitor render state, dot hiding + ring 1/4 on visit, no burst before 4/4, all-4 → badge+burst+flag, persistence round-trip through the real P2 store (`createStore({storage})`), one-time celebration across fresh instances (no re-fire on load or later updates), hero CTA scroll. |

**Test results this session:** `node test/ui.test.mjs` → **31/31 green** · `node test/engine.test.mjs` → **62/62 green** · `node --check` clean on new JS · all assets HTTP 200 on :8077.

## Design decisions — agent-decided this session (labeled in code, NOT yet owner-approved)

1. `TAB_TO_STORE = {home:'home', how:'pipeline', lab:'lab', compare:'compare'}` in app.js — URLs keep `#/how`; never compare raw ids across the two systems.
2. One-time celebration flag = separate localStorage key **`v100-celebrated`** owned by the tracker (P2 store shape is signed off; don't touch it).
3. "Start exploring" CTA = `<button>` + JS smooth-scroll to `#story` (NOT a hash link) so router URLs stay clean.
4. Token stream: pure-CSS keyframe loop, duplicated track for seamless −50 % translate, edge fade via `mask-image`; disabled under `prefers-reduced-motion`.
5. Floating hero panels: decorative glass cards, `aria-hidden`, animate the individual `translate` property (avoids transform clashes), hidden below ~900 px.
6. Beat copy as shipped: "A model is billions of numbers" (Qwen3-4B ≈ 4.2×10⁹) · "Speed is set by memory bandwidth" (RTX 3090 936 GB/s vs DDR5-6000 96 GB/s, blueprint §3.1) · "The fork: local or cloud?" (Shenzhen ¥0.65/kWh default vs $/M tokens).
7. A deep-link load counts as a visit (`initApp` marks `router.initial`) — so first-time visitors land at ring 1/4 with Home's dot already cleared; the other three tabs show dots in nav AND on the explore cards.

## Owner review checklist — COMPLETED 2026-09-02 ("this site is looking ridiculously good")

Light: `http://localhost:8077/index.html` · Dark: `http://localhost:8077/index.html#dark`

- **§6 acceptance:** first-time visitor reaches Tab 3 within ~60 s of scrolling (hero → 3 beats → explore grid; "Start exploring" smooth-scrolls); all beats reverse cleanly on scroll-up.
- **Tracker across tabs (§11 P4 gate):** dots visible on unvisited tabs (nav + cards) → visit How It Works / Lab / Compare and return to Home: dot clears, ring climbs 2/4→3/4→4/4; at 4/4 the Explorer badge appears in nav with a one-time spark burst. Reload → badge persists, **no** re-burst.
- Hero: floating panels + token stream (both decorative); light+dark contrast on glass chips/bars/cards.
- "Skip to the Lab" ghost link routes to `#/lab` and marks it visited.

## Immediate next steps (in order)

1. ~~Owner reviews per checklist~~ — **DONE 2026-09-02:** "this site is looking ridiculously good."
2. ~~On sign-off: flip `blueprint.md` + verification log + this handoff~~ — **DONE in session 11** (status line, §11 P4 row → SIGNED OFF, three new verification-log entries incl. JSON-error closure; writes verified by reading back).
3. ~~Owner picks P5 or P6~~ — **DONE 2026-09-03: owner picked P6.**
4. **Build P6 M2 (printouts rail)** per the table above → then M3, M4.
5. After P6 sign-off: P5 Pipeline tab, P7 Compare tab, P8 polish (blueprint §11).

## User preferences & constraints (all owner-approved)

- NEVER change formula shape — calibrate constants only (§5.4 rule).
- Audience: high school students + educators; **English only**; must pass muster with seasoned local-AI enthusiasts (labeled assumptions, footnoted sources); desktop-first; glassmorphism light+dark; zero image/video/font-file assets; plain static hosting; Shenzhen 0.65 RMB/kWh default @ FX 6.72; local cost = hardware + electricity ONLY; no custom hardware entry; semantic HTML only.
- Persist work to disk early/often (context limits have killed sessions before); keep this handoff current and **verify writes landed**.

## Key decisions — MINE vs OWNER-APPROVED

**Owner-approved:** all constraints above; P1 prices (Taobao listings [H7]); P2 KV-inclusive decode semantics + η=0.85; theme default = `prefers-color-scheme` with manual toggle persisted (§7); **P3 visual sign-off 2026-09-02 ("Looks fantastic")**; "links don't work" accepted as expected at P3 after test proof; proceed to Phase 4.

**Agent-decided (labeled in code):** theme precedence hash > stored > system (pure-system not persisted); `--i` stagger = ordinal among data-reveal siblings; no-JS reveal gating under `html.js`; scroll.js owns §8 micro-interactions; app.js minimal bootstrap; router safe no-op without `.tab-panel`s; gauge label outside masked ring. **P4 (session 10) — SIGNED OFF by owner 2026-09-02 with the phase:** the seven decisions listed above — mapping, celebration key, button-CTA, token stream, float panels, beat copy, deep-link counts as visit.

## Observations / gotchas

- **No headless browser on this box** — visual checks via `open_url_in_app_browser` + static server; ES modules fail over `file://`, always serve HTTP.
- Write access to the project folder is read-only by default in new sessions — re-request if edits are needed (granted again this session).
- Pre-paint theme snippets duplicate `resolveInitialTheme()` in both HTML files + `js/theme.js` — KEEP-IN-SYNC comments mark them; keep all three in sync.
- Dark tokens duplicated for no-JS fallback in `tokens.css` — keep both blocks in sync.
- **Store says `'pipeline'`, router/hash says `'how'`** — always go through `TAB_TO_STORE`; never compare raw ids across the two.
- Button class is `.btn--primary` (BEM double-dash), not `.btn-primary`.
- Static server on :8077 may be dead in a new session — restart from project dir before opening pages (`python3 -m http.server 8077 --bind 127.0.0.1`). It was alive this session (all assets 200).
- Store appends `visitedTabs` **in visit order** (not TAB_IDS order) — compare as a set in tests.
- Scratchpad progress note: `/home/paul/.lmstudio/scratchpads/wi/progress.md` (stale from session 9; flip to "P4 built, awaiting sign-off" if accessible).

## Important files & reference map

| File | Status / significance |
|---|---|
| `js/data/*`, `js/engine/perf.js`, `cost.js`, `js/state/store.js` | ✅ P1+P2 signed off; 62/62 green. Store = tracker's state source (`setActiveTab`, `subscribe`, `ui.visitedTabs`) — **do not modify** (signed off) |
| `css/tokens.css`, `css/base.css` | ✅ P3 signed off — all component primitives live here |
| `js/theme.js`, `js/motion/scroll.js` | ✅ built, unchanged this session |
| `js/app.js` | ✅ router + **P4 tracker** (this session); bootstrap wires theme/reveals/router/tracker/home |
| `index.html` | shell; **Home panel now real content**; nav dots/badge/celebrate slots wired |
| `css/tabs.css`, `js/tabs/home.js` | ✅ NEW this session — P4 deliverables per blueprint §3 layout |
| `dev/design-system.html` | P3 acceptance harness (signed off); ring/celebrate markup reference |
| `test/ui.test.mjs` | **31/31 green** incl. tracker block + home CTA |
| `blueprint.md` | ✅ flipped session 11: P4 SIGNED OFF + §11 row met + verification log (incl. JSON-error closure) |
| `HANDOFF.md` (on disk) | ✅ this document — updated session 11: P4 signed off, JSON error closed |

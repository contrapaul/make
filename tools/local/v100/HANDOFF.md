# v100 Handoff — P9 COPY REWRITE COMPLETE (every surface) · P5 M1–M3 · P6 M1–M4 awaiting sign-off

**Date:** 2026-09-05 · **Status:** P5 M1 (Pipeline shell + Stage 1 Tokenization) + P5 M2 (Stage 2 Model load) + P5 M3 (Stage 3 Prefill vs decode) built and committed. Stage 1 tokenizes against a **real subset of the Qwen3 vocabulary** (30,747 of 248,320 tokens) with real token ids, lazy-loaded. Stage 2 pours the current config's weights into a live memory bar bound to the shared store. Stage 3 shows the **two-speed contrast** — prompt chewed in one fast pass vs the answer dripping one token at a time — animated (DI `raf`/`now`, reduced-motion instant). P6 M1–M4 complete, then three real bugs found and fixed (`f21797b`); see the bug-fix pass below. Both suites green (ui **102/102**, engine **63/63**). **2026-09-05: the two open test gaps from the bug-fix pass are CLOSED** — see the section below; both new tests were regression-proven against the original defects. P6 still awaits owner sign-off.

> ⚠ **READ THIS FIRST (2026-09-04 bug-fix pass).** The page was **completely dead in a browser** through all of M1–M4 — a fatal `js/app.js` TDZ error meant no link on any tab did anything, while all 56 UI tests passed. Two of the three fixes touch files this document previously marked **“do not modify”**. See the section below before assuming any P6 milestone was ever visually verified.

## Home hero layout pass (2026-09-05, owner request)

Three changes, all in `css/tabs.css` plus one markup removal:

1. **The scrolling token marquee is gone.** Removed from `index.html`, and with it the now-orphaned `.token-stream` / `.token-track` / `.token-half` / `.glyph` / `.glyph--accent` rules and the `token-drift` keyframes. The reduced-motion block referenced `.token-track` and was updated too. That also removes one of the page's remaining infinite animations.
2. **The description matches the title width.** It was capped at `58ch`, visibly narrower than the h1. Rather than hard-coding a width on the paragraph, `.hero-inner` was narrowed from 780px to **700px**, which makes the content column equal the h1's single-line width at 48px type. Both elements now share identical edges: measured live at 387px left, 651px title against 652px description.
3. **The first story beat sits at the fold.** `.home-hero` min-height went from `100vh` to `82vh` (the marquee no longer needs the room) and `.home-story` top padding from `sp-7` to `sp-4`. At 1440x900 the "What an AI model actually is" heading is now visible without scrolling, with its top at 755px of a 900px viewport.

Verified by screenshot in a real browser at 1440x900.

> Note for the next session: judging hero layout in the agent browser pane requires injecting `.js [data-reveal]{opacity:1 !important}` first. The hidden pane never fires IntersectionObserver, so every revealed element sits at opacity 0 and the screenshot comes out looking blank. That is the same harness artifact already logged for `requestAnimationFrame` and for class-change restyling.

## P9 COPY REWRITE — FINISHED 2026-09-05 (second pass: How It Works, Hardware Lab, all runtime strings)

Every reader-facing surface now obeys `style-guide.md`. **Zero em dashes reach a reader**, verified both by the test suite and by reading `document.body.innerText` in a live browser on all five tabs, in the fast, offloading, does-not-fit and four-users-at-once states.

### The owner's own edits taught the guide four new rules

The owner committed the first pass with hand edits (`6c3d03b`). Those edits were the useful part, and `style-guide.md` §3 now carries them as rules 8 to 11:

* **Use contractions.** "You've probably used" beat "You have probably used".
* **Pick the everyday word.** "math", not "arithmetic".
* **No clever phrasing, even when accurate.** "the same idea with the location changed" and "with the network cable unplugged" were both replaced with direct statements.
* **Say it once.** "Electricity. No subscription, no per question charge." became just "Electricity." because the paragraph above already said it.

Apply these to any new copy. They are owner preferences, not agent taste.

### What was rewritten in this pass

| Surface | Notes |
|---|---|
| **How It Works** | Stage headings were jargon-first and are now plain: "Prefill vs decode" is **"Step 3. Reading your question, then writing the answer"**, "KV cache growth" is **"Step 4. Remembering the conversation"**, "Sampling" is **"Step 5. Choosing the next word"**. Step 4 now builds keys and values from scratch before naming the KV cache, per the guide's worked example. `aria-label`s were updated to match the new headings. |
| **Hardware Lab** | Control group labels: "Precision (quantization)" is now "How tightly the model is compressed", with a note defining it. Every results row is plain English: "Decode speed (per request)" is **"Writing speed, one user"**, "Time to first token" is **"Wait before the first word"**, "Cost / M output tokens" is **"Cost per million words written"**. The "How we estimate this" panel keeps every formula and every labeled assumption, rewritten so a student can follow the reasoning. |
| `js/tabs/lab.js` | 9 prose strings plus the memory captions, the fit chip, the offload teaching sentence (both branches), the concurrency queueing note and the finish line. |
| `js/tabs/pipeline.js` | 6 prose strings plus the offload caption. |
| **`js/data/quantization.js`** | See the warning below. |
| Explore grid + Compare placeholder | Card blurbs rewritten. The Compare tab no longer says "Phase 7 lands here", which meant nothing to a reader; it now explains what the page will do. |
| `test/ui.test.mjs` | ~20 copy-coupled assertions updated, plus a new runtime-copy guard. **102/102 green.** |

### ⚠ `js/data/quantization.js` was edited, and it is a P1 signed-off file

The quantization explainer prose lives in that data file, and the brief required rewriting it ("K-quant blocks with per-group scales" is exactly the failure the owner named). **Only the prose fields changed**: `qualityLabel` and the three `explainer` strings on all five levels. **Every number and id is untouched**, which was verified mechanically by diffing the `bytesPerParam` / `kvBytesPerElement` / `id:` lines before and after (identical), and `test/engine.test.mjs` stays 63/63. Same principle as the P2 `perf.js` unit fix: the signed-off thing is the value, not the sentence next to it.

### The "no value yet" placeholder changed

`'—'` was the placeholder for a missing value in both HTML and JS. It is now `'…'`, which also reads as "still waiting", which is what it actually means. It appears in `fmtTps`, `fmtMs`, `fmtWatts`, `fmtCost`, `memoryCaption`, `fitChipText`, `loadCaption` and the static HTML readouts. If you add a new formatter, use the ellipsis.

### The guard is now absolute

The em dash ratchet is gone because there is nothing left to ratchet:

* **All five panels must hold at zero**, plus a whole-file check on `index.html`.
* **A middot may never sit between two lowercase words** anywhere in the page. It remains legal in data labels such as `¥0.516 · $0.077`.
* **A new runtime-copy test** drives the real Lab and Pipeline functions across four hardware states (fast path, offloading, does not fit, four users at once) and asserts no em dash appears in anything they generate. This matters because most site prose lives in JavaScript template strings that no scan of `index.html` can reach.
* 31 marked-up glossary terms on the page, every one resolving to a real entry and linking to its own definition.

### What P9 did NOT cover

* The Compare tab (P7) is still a placeholder. Its real copy should be written to the guide from the start.
* Steps 4 and 5 of How It Works explain the concepts but their live visuals are still P5 M4 and M5.
* The glossary is 34 terms. Adding a term means adding it to `js/data/glossary.js` only; both the page and the hover cards pick it up automatically.

## P9 (NEW PHASE) — rewrite every word for a novice audience · 2026-09-05

Owner's brief: the page is for high school students and people who think ChatGPT is a magic box, and the current copy fails them. It reads like a TED talk, it uses terms it never defines, and its headers are catchy rather than informative. This is a new phase of work, not a milestone of an existing one.

### The governing document: `style-guide.md` (NEW, read it before writing any copy)

Codifies the whole brief: the audience, the **em dash ban** and what to write instead, the cadence rules that kill the TED-talk voice, textbook header rules, and the term-introduction rule. Every user-facing string on the site is governed by it, in `index.html` **and** in `js/tabs/*.js`. It carries before-and-after examples taken from the real page.

### Done in this pass

| Piece | State |
|---|---|
| `style-guide.md` | **NEW.** The rules, with worked examples. Start here. |
| `js/data/glossary.js` | **NEW.** 34 terms, each with `short` (hover card) and `full` (glossary page) definitions plus `see` cross references. Alphabetical by id; ids are stable because they are public URLs. |
| `js/tabs/glossary.js` | **NEW.** Renders the glossary page from that data, wires the hover cards by **delegated** document listeners (so terms rendered later by other tabs work with no re-init), and handles `#/glossary/<term>` deep links. |
| Tab 5 + hover card markup | `index.html`: nav link, glossary panel with `#glossary-list`, and one shared `#gloss-tip` card placed **outside `<main>`** so no overflow-clipped panel can cut it off. |
| `css/tabs.css` | New "Tab 5" section: `.gloss` inline term (dotted accent underline, help cursor), `.gloss-tip` card, `.gloss-entry` page entries with `scroll-margin-top: 96px` for deep links, `.is-target` highlight. |
| `js/app.js` | 5th router tab; deep-link sub-path preservation (see the trap below); `unseenRouterTabs` now skips untracked tabs. |
| **Home tab copy** | **Rewritten.** Hero subtitle, plus the three beats restructured as the owner specified. |
| `test/ui.test.mjs` | +21 checks (glossary module, router regression, and a mechanical style guard). **102/102 green.** |

### Owner decisions taken in this pass

1. **The glossary is a router tab but NOT a tracked one.** `'glossary'` is in `TABS` (js/app.js) and deliberately **absent from `TAB_IDS`** in `js/state/store.js`. So the Explorer badge still counts the original four tabs, the ring stays n/4, the glossary link never shows a "new" dot, and **the signed-off store needed no change at all**. Anything in `TABS` without a `TAB_TO_STORE` mapping is simply untracked. There is a test pinning this.
2. **The memory-bandwidth explanation moved from Home into How It Works.** Home is now pure orientation. The explanation was rewritten and placed after the pipeline stages, where the reader has already met decode, as `.bandwidth-card`. Nothing was dropped.

### Home restructure, as built

Beats are now: **"What an AI model actually is"**, **"You have probably used a cloud model"**, **"Defining local AI"**. The old "The fork: local or cloud?" and "Speed is set by memory bandwidth" beats are gone. The two new beats each carry a scannable `.flow-list` card instead of the old side-by-side fork cards; `.fork-grid` / `.fork-card` CSS was removed because this change is what orphaned it.

### ⚠ Trap for the next session: the router used to eat deep links

`initRouter` rewrote the hash to `#/<tab>` on load whenever it differed. That silently destroyed `#/glossary/kv-cache`, turning it into `#/glossary` **before** the glossary module could read the term. The fix keeps the rewrite but skips it when the hash already starts with `#/<tab>/`. There is a regression test. Do not "simplify" that condition back.

### Mechanical enforcement of the copy rules

The em dash ban rots without a guard, so `test/ui.test.mjs` now enforces it, counting only reader-facing text (HTML comments are stripped first, since the rule governs what a reader sees):

* **Rewritten panels hold at zero.** Currently `home` and `glossary`. **Add each panel to that list as its rewrite lands.**
* **Everything else has a budget that may only go DOWN:** `how` ≤ 15, `lab` ≤ 13. Lower these as you rewrite; a rise means new copy shipped in the old voice.
* Every `data-term` in the markup must resolve to a real glossary entry, and every marked term must link to its own definition.

### What remained after the first pass (ALL DONE in the second pass, see the section above)

1. **How It Works copy** (15 em dashes left). Stage names are still jargon-first: "Prefill vs decode" names two undefined terms in a header. Mark up terms as you go.
2. **Hardware Lab copy** (13 in the panel, 44 in `js/tabs/lab.js`). Worst offender for undefined jargon: `Q4_K_M (GGUF)`, "K-quant blocks with per-group scales", "GQA 8 KV heads". Note that **most Lab prose lives in JavaScript strings**, not HTML, and roughly 63 test assertions match that copy exactly, so budget for test churn.
3. **`js/tabs/pipeline.js`** (39). Same situation.
4. **Mark up glossary terms throughout.** Only 9 distinct terms are marked so far, all on Home and in the relocated bandwidth card. All 34 exist and are ready to use.
5. Consider whether the Compare tab (P7, not yet built) should be written to the guide from the start. It should.

## Scroll reveals made ONE-WAY (2026-09-05) — the looping/bouncing fix

Owner: *"animations can loop/bounce depending where the user stops scrolling"* — against the pi.dev reference feel, where things fade/move into place and then stay.

**Cause.** Reveals were deliberately **reversible**: `js/motion/scroll.js` stripped `.in-view` whenever an element left the IntersectionObserver band (`rootMargin: -10% 0px`). Stop scrolling with an element parked at that edge and the browser emits a burst of alternating intersect/unintersect events — each one replays the 400 ms opacity+translateY transition. Nothing was "animating" in the CSS sense; the class was being toggled underneath it.

**Fix.** One behaviour change in the observer callback: add `.in-view` on first entry, then `io.unobserve(el)` immediately, so no later event can reach that element. Reveals are transitions (`animation-name: none`), so once the class sticks there is no mechanism left to replay them.

⚠ **This reverses a P3 sign-off criterion** — "reveals reversible" was part of the P3 acceptance gate (blueprint §11 P3 row, signed off 2026-09-02). The owner reversed that decision on 2026-09-05. The §11 row is **annotated, not rewritten**, so the original record stands.

| File | Change |
|---|---|
| `js/motion/scroll.js` | Observer callback: reveal once + `unobserve()`; non-intersecting entries are ignored. Module header rewritten to say one-way and to record why (so nobody "restores" reversibility) |
| `css/base.css` | Section comment `(§8, reversible)` → `(§8, ONE-WAY)`, with a "do not add a rule that strips `.in-view`" note. **No rule changed** |
| `test/ui.test.mjs` | `motion/scroll.js` block rewritten. `IOStub` now models `unobserve()` faithfully (a `live` set + a `scroll()` helper that filters out unobserved targets, because a real observer stops delivering for them). New checks: revealed → unobserved immediately · leave + re-enter never re-animates · **8 alternating events at the band edge (the reported symptom) leave the reveal untouched** · below-the-fold elements stay hidden and stay watched. **81/81 green** (was 79) |
| `blueprint.md` | §11 P3 row annotated (reversibility superseded); new verification-log entry |
| `HANDOFF.md` | This document |

**Not changed — owner decision wanted.** Eight *ambient* infinite animations remain, confirmed live in the browser: four `.mesh .blob` drifts (44–60 s), three `.hero-float` bobs (9–13 s), the `.token-track` marquee (36 s). They are continuous background motion rather than scroll-triggered entrances, none replays an element's arrival, and all are killed under `prefers-reduced-motion`. If "never loop" is meant literally, these are what is left.

⚠ **The fix could NOT be scroll-verified in the agent browser pane** — do not read the earlier attempt as evidence either way. The pane reports `document.visibilityState: "hidden"`, and a hidden page never delivers IntersectionObserver callbacks (`innerHeight` was even 0 before an explicit resize). Instrumenting `.in-view` with a MutationObserver and scrolling the whole page produced **zero** class changes, every reveal stuck at `opacity: 0`. Same class of harness artifact as the documented `requestAnimationFrame` one — **not** a dead page: console clean, `html.js` set, correct panel active. **Owner: please confirm in a real browser window.**

## Test gaps CLOSED (2026-09-05) — tests + docs only, zero source changes

Both gaps the bug-fix pass left open are now covered. **Each new test was regression-proven**: the original defect was reintroduced, the test was watched to fail, and the source was restored (`git diff` clean).

| Gap | Where the test lives | What it does |
|---|---|---|
| **1. Nothing called `initApp()`** | `test/ui.test.mjs`, new `app.js — initApp() bootstrap` section (+3 checks) | `makeAppDoc()` composes the existing `makeLabDoc()` / `makePipeDoc()` / `makeTrackerDoc()` fixtures into one document, installs browser globals (`document`, `window`, `location` = `#/lab`, `addEventListener`, `localStorage`), then **imports a fresh copy of `app.js` through a cache-busting query string** so the module's own auto-bootstrap runs. Asserts: exactly one active panel and it is the deep-linked one · tracker ring 1/4 · theme toggle wired · Lab printouts painted · Pipeline Stage 3 painted · one `hashchange` listener — then fires that handler for real and checks it routes to `#/how` at 2/4. Globals are restored in a `finally`, so no later test sees them. |
| **2. No absolute TTFT magnitude** | `test/engine.test.mjs`, beside the existing floor check (+1 check) | `TTFT has a plausible absolute magnitude for the default rig (0.5–5 s)`, with the hand-check arithmetic in a comment. |

> ⚠ **Do not "simplify" gap 1 into a plain `initApp()` call.** That was the first attempt and it is worthless: a TDZ fault exists only *during module evaluation*, and by the time any test can call the exported `initApp()`, the `const` bindings are already initialized. Proven — with `defaultDoc`/`defaultHash` moved back to the foot of `app.js`, the direct-call version stayed **79/79 green** while the fresh-import version fails. The cache-busting query string is load-bearing.

Regression proofs, for the record:

* **TDZ:** moved `defaultDoc`/`defaultHash` back to the last two lines of `app.js` → `ui.test.mjs` fails at the `doesNotReject` on the fresh import. Restored → 79/79.
* **Unit bug:** deleted one `× 1e12` on `js/engine/perf.js:180` → the old floor check **still passed**, the new check failed with `got 1534082397003845.5 ms`. Restored → 63/63.

Also corrected in the same pass: `index.html`'s Tab 2 header comment still described Stages 3–5 as placeholders after M3 shipped (now Stages 4–5).

| File | Change |
|---|---|
| `test/ui.test.mjs` | `makeAppDoc()` + the bootstrap section (3 checks); `initApp` NOT imported — `TABS` is, for the panel fixtures; final log now "+ app.js bootstrap". **79/79 green** (was 76) |
| `test/engine.test.mjs` | +1 absolute-magnitude TTFT check. **63/63 green** (was 62). First change to this file since P2 sign-off — an added anchor, no engine behaviour touched |
| `index.html` | Tab 2 header comment: Stages 3–5 → Stages 4–5 placeholders (M3 is live) |
| `blueprint.md` | Status line: P5 M1–M3 built + current suite counts; §11 P5 row shows M1–M3 built / M4–M5 to build; §11 P6 row count refreshed (was stale at 56/56); new verification-log entry for the closed gaps; Last updated 2026-09-05 |
| `HANDOFF.md` | This document |

**Verification:** `node --check` OK on both test files · `test/ui.test.mjs` **79/79** · `test/engine.test.mjs` **63/63** · `git diff` clean on `js/app.js` and `js/engine/perf.js` after both regression proofs. **Zero changes to any `js/` source file.**

## What changed — P5 M3 (Stage 3 · Prefill vs decode, blueprint §6 Tab 2.3)

| File | Change |
|---|---|
| `js/tabs/pipeline.js` | **Stage 3 live.** Extended the `./lab.js` import to reuse the tested two-speed model (`simPlan`, `simPhase`, `tokensAt`, `stageText`, `fmtTps`) — the drip math is NOT re-derived (tVirtual is VIRTUAL SECONDS, the same units the Lab's run drives). New pure exports `prefillDecodeView(perf)` → `{promptTokens, targetTokens, tps, perTokenMs, ttftMs, prefillS, decodeS, speedup, realDurationS}` (reuses `simPlan`; adds the engine's real per-request TTFT as the honest "one fast pass" duration) + `prefillCaption` / `decodeCaption` / `speedNote` (the two halves + the labelled compression line). `runStage3Drip({doc,plan,raf,now,reduced})` animates the decode drip into the Lab's `.sim-conveyor` (chips appear via `tokensAt`, phase line via `stageText`), skipping the load beat (Stage 2's) and starting at the prefill; reduced-motion / no-raf paints the final state instantly. `initPipeline` gains `{raf, now, reduced}` DI (same shape as `initSim`) and paints Stage 3 on the **same** store subscription as Stage 2 (first paint animates, subsequent changes re-render to final state — no replay jitter); `api.destroy()` also cancels any in-flight drip. Stage 1 untouched; vocab.js still lazy dynamic-import only |
| `index.html` | Stage 3 placeholder card replaced: real card with a two-column contrast (Prefill · one gulp / Decode · a drip, each a big engine number + `.ctl-note`), a `#pipe-phase` line, a `.sim-conveyor#pipe-drip` chip stream (chips drip in), `#pipe-drip-label`, and `#pipe-speed-note` (compression labelled). Only existing CSS (`.card .chip .ctl-note` + the Lab's `.sim-conveyor` token stream) — **no new css/tabs.css rule** this milestone |
| `test/ui.test.mjs` | +6 P5 M3 blocks: `prefillDecodeView` on a fast config (engine prompt tokens + tok/s + TTFT-derived prefill, speedup 1) and a slow offloaded one (low tok/s, long drip, ×N compression labelled); the prefill half reports the engine's prompt-token count ("long" split → 8192) with compute-/bandwidth-bound copy; driving the injected `makeClock()` advances decode tokens 0→256 one-by-one to Done; reduced-motion paints the final 256 instantly without calling raf; a store config change re-renders Stage 3 live (decode tok/s moves, shared subscription). `makePipeDoc` extended with Stage 3 fakes (`pipe-prefill-*`, `pipe-decode-*`, `pipe-phase`, `pipe-drip`, `pipe-drip-label`, `pipe-speed-note`). Final log now "+ P5 M3 Prefill vs decode". **76/76 green** (was 70) |
| `HANDOFF.md` | This document |

**Verification (P5 M3):** `node --check` OK on `pipeline.js` + `test/ui.test.mjs` · `test/ui.test.mjs` **76/76 green** (was 70) · `test/engine.test.mjs` **62/62 unchanged** · `grep` confirms **no top-level vocab.js import** in `pipeline.js` (only the memoised dynamic `import()` inside `loadVocabModule`). Committed in `85780dc`. Zero changes to `js/data/*`, `js/engine/*`, `js/state/store.js`, or `test/engine.test.mjs`; **css/tabs.css NOT touched this milestone** (the M2 reduced-motion rule is unchanged).

## What changed — P5 M2 (Stage 2 · Model load, blueprint §6 Tab 2.2)

| File | Change |
|---|---|
| `js/tabs/pipeline.js` | **Stage 2 live.** Added `import { membarView } from './lab.js'` (reused the tested fill math — not re-derived) + pure exports `modelLoadView(perf)` → `{usedGB, availableGB, pct, state, gpuPct, cpuPct}` (used = weightsGB + kvTotalGB, the engine's fits-check demand; available = VRAM on the fast path, VRAM+RAM when it splits or overflows) and `loadCaption(perf, config)` (GB used vs available, memoryCaption voice; names the split when offloading). `initPipeline` now subscribes the store (when provided): first paint “pours” — `.seg` widths set to 0 then to target on the next frame(s), riding the existing `.membar .seg` width transition in base.css; `prefersReducedMotion()` (guarded matchMedia) paints the final state instantly instead. Offload/cpuOnly also reveal a `#pipe-load-layers` one-liner (`is-hidden` toggle). New `api.destroy()` unsubscribes cleanly. Stage 1 untouched; vocab.js still lazy dynamic-import only |
| `index.html` | Stage 2 placeholder card replaced: real card with `.membar#pipe-loadbar` (`.seg seg-gpu` / `.seg seg-cpu`, `--w` inline, same structure as `#lab-membar`), `#pipe-load-caption` (`.ctl-note`, aria-live), `#pipe-load-layers` (`.ctl-note is-hidden`); only existing CSS classes used |
| `css/tabs.css` | One new rule, in a small new “Tab 2” section: `@media (prefers-reduced-motion: reduce) { #pipe-loadbar .seg { transition: none !important; } }` — belt to the JS reduced-motion instant-paint suspenders (JS already skips the pour; this kills the width transition too) |
| `test/ui.test.mjs` | +5 P5 M2 blocks: `modelLoadView` fitting (8B/RTX 3090: 5.5 GB of 24 GB, state ok, segment math matches membarView); `modelLoadView` noFit (405B on 16 GB VRAM + 32 GB RAM: pct ≥1, state fail, “doesn't fit” caption); `loadCaption` offload (70B: names VRAM + RAM split); store binding (24 GB → 12 GB VRAM GPU swap re-renders the caption live via `store.setConfig`); `destroy()` unsubscribes (no further re-renders). `makePipeDoc` extended with `pipe-loadbar`/`pipe-load-caption`/`pipe-load-layers` fakes. Final log now “+ P5 M2 Model load”. **70/70 green** (was 65) |
| `HANDOFF.md` | This document |

**Verification (P5 M2):** `node --check` OK on `pipeline.js` + `test/ui.test.mjs` · `test/ui.test.mjs` **70/70 green** · `test/engine.test.mjs` **62/62 unchanged** · `grep` confirms the only top-level import in `pipeline.js` is `./lab.js` — **no top-level vocab.js import** (still the memoised dynamic `import()` inside `loadVocabModule`). Committed in `85780dc`. Zero changes to `js/data/*`, `js/engine/*`, `js/state/store.js`, `js/app.js`, or `test/engine.test.mjs`.

## What changed — P5 M1 tokenizer rewrite (real Qwen3 vocab subset)

## What changed — P5 M1 tokenizer rewrite (real Qwen3 vocab subset)

The owner rejected the original FNV-hash / regex tokenizer (it emitted every word as one token, undercounting tokens ~21% vs a real Qwen3 tokenizer). Stage 1 was rewritten to do **greedy longest-first matching against `js/data/vocab.js`** (a 30,747-entry subset of Qwen3's 248,320-token vocabulary, real token ids, genuine BPE leading-space convention).

| File | Change |
|---|---|
| `js/tabs/pipeline.js` | **Rewrote Stage 1.** Deleted the `tokenId()` FNV helper and the old regex `tokenize()`. Added pure, DI-friendly `tokenizeWith(vocab, text)` → `[{text, id, unknown}]` (greedy longest-first; unmatched char → `{id:null, unknown:true}`), and async convenience `tokenize(text)` that awaits a **memoised dynamic `import('../data/vocab.js')`** (no top-level static import — never loads on Home/Lab). `initPipeline` shows a brief accessible "loading vocabulary…" state in the chip area until the vocab resolves, then renders; empty input short-circuits with no vocab load; exposes `api.pending` so tests can await. Reuses `.chip` / `.chip .id` / `.ctl-note` only — no new CSS |
| `index.html` | Stage 1 labelled-assumption note rewritten: now states it uses a **real subset of the Qwen3 vocabulary (30,747 of 248,320 tokens) with real token ids**, and names the two honest limits (it's a subset — words outside it split into sub-pieces; matching is greedy longest-first, not true BPE merge-order). One short paragraph, high-school readable |
| `test/ui.test.mjs` | Dropped the `tokenId`/old `tokenize` tests; rewrote to `tokenizeWith(VOCAB, …)` (VOCAB imported directly from `js/data/vocab.js`). New checks: "Antidisestablishmentarianism" → **more than 3** tokens (6); digit run "936" → separate digit tokens; " world" → **ONE token, id 1814**; empty string → no tokens. DOM chip tests now `await api.pending` (async lazy load). Final log updated. **65/65 green** (was 62) |
| `HANDOFF.md` | This document |

**Verification (tokenizer rewrite):** `node --check` OK on `pipeline.js` + `test/ui.test.mjs` · `test/ui.test.mjs` **65/65 green** · `test/engine.test.mjs` **62/62 unchanged** · `grep` confirms **no top-level static import** of `vocab.js` in `pipeline.js` (only the memoised dynamic `import()` inside `loadVocabModule`). Committed in `85780dc`. Zero changes to `js/data/*` (vocab.js only read), `js/engine/*`, `js/state/store.js`, or `test/engine.test.mjs`.

Project: `/home/paul/Documents/GitHub/make/tools/local/v100/` (NOT the Bionic workspace folder). Static multi-tab site, vanilla HTML/CSS/JS ES modules, no build step. Spec in `blueprint.md`, owner Q&A in `plans.md`. Git repo root is `/home/paul/Documents/GitHub/make`; if a new session gets "No permission to write", re-request via `request_read_write_access`.

## What M4 was (owner's ask)

Concurrency teaching moment (per-request vs total throughput divergence, TTFT ×B queueing) + offload teaching moment (visible slowdown + one-sentence why), then full verification. Owner constraint: small bounded job only — GPU-fan noise around class time. It stayed small: **zero engine changes**, tests + docs + commit.

## What landed — P5 M1 (UNCOMMITTED, for owner review)

> ⚠ **Superseded:** the original M1 tokenizer below was a regex/FNV approximation and was **rejected by the owner** as unrealistic. See the **"What changed — P5 M1 tokenizer rewrite"** section above for the current implementation (real Qwen3 vocabulary subset, greedy longest-first, real token ids, lazy-loaded). The tab shell / DOM contract / `initPipeline` DI seam below are unchanged.

| File | Change |
|---|---|
| `js/tabs/pipeline.js` (new) | P5 M1 shell: `initPipeline({doc, store})` DI factory (store reserved for M2–M5 binding); renders `.chip` + `.chip .id` into `#pipe-token-chips`, count line in `#pipe-token-count`. **Tokenizer helpers now per the rewrite section above** (`tokenizeWith(vocab, text)` + async `tokenize(text)`; old FNV `tokenId` deleted) |
| `index.html` | "Phase 5 lands here" placeholder replaced with the horizontal 5-stage glass-card pipeline (existing utilities only: `.card`, `.chip`, `.ctl-note`; two inline flex wrappers stand in for a pipeline class — no new CSS files). Stage 1 live (prefilled "Hello, world!"); stages 2–5 placeholder cards with blueprint one-liners + "Lands in P5 M2/M3/M4/M5" notes |
| `js/app.js` | `initPipeline({ store })` wired in `initApp()` alongside `initLab({ store })` |
| `test/ui.test.mjs` | P5 M1 checks now exercise `tokenizeWith(VOCAB, …)` (real Qwen3 subset) — see rewrite section above. **65/65 green** (was 62) |
| `HANDOFF.md` | This document — status line + P5 M1 rows + Next steps flipped to P5 M2 |

**Verification (P5 M1):** `node --check` OK on `pipeline.js`, `app.js`, `test/ui.test.mjs` · `test/ui.test.mjs` **62/62 green** · `test/engine.test.mjs` **62/62 unchanged**. Nothing committed — left for owner review per instruction. Zero changes to `js/data/*`, `js/engine/*`, `js/state/store.js`.

## What landed — P6 M1–M4 (committed)

| File | Change |
|---|---|
| `js/tabs/lab.js` (624 lines) | M4 code: exported pure helpers `concTeaching(perf, config)` → null at B=1/no-perf, else `{total, perReq, ttftNote}`; `offloadNote(perf, config)` → null unless offload/cpuOnly, else one sentence naming real bandwidths + layer split; `renderPrintouts()` renders all three M4 rows (value set only when teaching, `.is-hidden` toggled, text cleared otherwise); `initSim.finish()` appends at B>1: "…tokens **per request** … · N requests at X tok/s each ≈ Y total" |
| `index.html` (478 lines) | Printouts rail: `<div class="printout is-hidden" id="po-tps-total">`; `<p class="ctl-note is-hidden" id="po-ttft-note">`; memblock: `<p class="ctl-note is-hidden" id="lab-offload-note">` after #lab-mem-caption |
| `test/ui.test.mjs` (988 lines) | +4 M4 test blocks (concTeaching pure · offloadNote pure · renderPrintouts show/hide lifecycle · run-finish Done line); byId stubs for the 3 new ids; imports extended; final log now "P6 M1–M4 Lab" |
| `blueprint.md` | Header status: P6 BUILT (M1–M4), awaiting sign-off; Last updated 2026-09-04; §11 P6 row marked built (NOT signed off); new verification-log entry "(P6, 2026-09-03→04)" covering M1–M4 + test counts |
| `HANDOFF.md` | This document — replaced on disk |

**Verification:** `node --check js/tabs/lab.js` OK · `test/ui.test.mjs` **56/56 green** (was 52) · `test/engine.test.mjs` **62/62 unchanged**. Commit: `v100 P6 M4: concurrency + offload teaching moments`.

## Bug-fix pass (2026-09-04, commit `f21797b`) — what changed and why it matters

Owner reported: *"Qwen tells me to try it out, but nothing happens on page when I use any links on page."* Diagnosed by serving the site over HTTP and reading the browser console. **This was NOT the P3-style false alarm** logged in `blueprint.md` (2026-09-02, "none of the links work" → correctly closed as placeholder panels). This time the page was genuinely dead.

| # | File | Defect | Fix |
|---|---|---|---|
| 1 | `js/app.js` | **Fatal TDZ — killed 100 % of page JS.** `const defaultDoc` / `defaultHash` sat on the last two lines of the module; the auto-bootstrap `initApp()` reaches them via `initRouter({ doc = defaultDoc() })` default params. `const` isn't hoisted → `Uncaught ReferenceError: Cannot access 'defaultDoc' before initialization`. Router, tracker, Home and Lab never wired up. | Both declarations moved directly under the imports (now lines 18–19). |
| 2 | `js/engine/perf.js` | **TFLOPS/FLOPs unit error — every TTFT 1e12 too large.** `flopsPerToken` is raw FLOPs; `tflopsFp32Dense` / `prefillTflopsEff` / `unifiedPrefillTflopsEstimate` are **tera**FLOPS. Default rig printed `1534082397003.85 s`. | `× 1e12` applied where the effective throughput is derived; locals renamed `tflopsEff`/`gpuTflopsEff`/`cpuTflopsEff` → `flopsEff`/`gpuFlopsEff`/`cpuFlopsEff` so names match units. Line 190 `prefillTflopsEff` **deliberately untouched** — it divides by `1e12` assuming `ttftS` is correct, so it self-corrected. Do **not** double-correct it. |
| 3 | `index.html` | Literal two-character `\n` escape between spark spans #5 and #6 inside `#explorer-celebrate`, rendering as visible text beside the theme toggle. | Replaced with a real newline. Only occurrence in the tree (verified by grep). |

**On the "do not modify" rule for `js/engine/perf.js`:** fix #2 is a restored **unit conversion**, not a formula change — the §5.4 rule ("never change formula shape, calibrate constants only") is intact. Decode-path anchors are untouched; `test/engine.test.mjs` remains **62/62 green**. TTFT was never anchored by any test, which is exactly why a 1e12 error survived four milestones.

**Live verification after the fixes** (served over HTTP — ES modules fail on `file://`): console clean · `#/lab` routes and paints · printouts `145.3 tok/s · 1.63 s · 415 W · ¥0.516 · $0.077 · 80B` · controls two-way live (128K ctx → 36.9 tok/s, caption `4.4 GB weights + 17.2 GB KV of 24 GB VRAM`) · Run Inference completes 256/256 tokens, 256 chips, gauge 36.9, `×1.0 time-compressed`. Hand-check of the new TTFT: 2048 × 1.6e10 ÷ (35.6 × 0.6 × 1e12) + 0.1 = **1.63 s**. ✅

**Two test gaps — both CLOSED 2026-09-05** (see the section at the top of this document; each was regression-proven against the original defect):

1. ~~**Nothing ever calls `initApp()`.**~~ **CLOSED.** Covered by importing a fresh copy of `app.js` against browser globals so its auto-bootstrap runs — a direct `initApp()` call does NOT reproduce a TDZ and was proven insufficient.
2. ~~**No absolute-magnitude assertion on TTFT.**~~ **CLOSED.** `test/engine.test.mjs` now pins the default rig to 0.5–5 s (real value 1.634 s).

## Agent-decided, NOT yet owner-approved (ships with P6 sign-off review)

- Placement of the three teaching rows: total-throughput row + TTFT queueing note in the printouts rail; offload sentence under the memory caption.
- Copy wording ("Why it's slow: …"; "×B queueing — prefills are serialized…").
- Finish-line phrasing "per request" + both rates at B>1.
- Rows hidden at B=1 / on fast path so they only appear when they teach.
- (Carried from M1–M3, already labeled in code: TAB_TO_STORE mapping, `v100-celebrated` key, button CTA, token stream, float panels, beat copy, deep-link counts as visit; first AIO seeds platformId, RAM-tier capacity clamp, 8 s sim budget + labeled compression, load = weightsGB/20 clamped [0.5,2] s, prefill 0.8 s virtual beat, gauge full ≥200 tok/s, click mid-run restarts, store change cancels run, reduced-motion instant path; warn threshold any pool ≥90 %.)

## Owner-approved (do not revisit)

- NEVER change formula shape — calibrate constants only (§5.4 rule). M4 added zero engine changes — it only surfaces P2-signed-off values (`decodeTpsTotal`, `ttftMs`/`ttftMsBase`).
- Audience: high school students + educators; English only; must pass muster with seasoned local-AI enthusiasts (labeled assumptions, footnoted sources); desktop-first; glassmorphism light+dark; zero image/video/font-file assets; plain static hosting; Shenzhen ¥0.65/kWh @ FX 6.72; local cost = hardware + electricity ONLY; no custom hardware entry; semantic HTML only.
- P1–P4 signed off (2026-09-02); owner picked P6 over P5; P6 M1+M2+M3 built 2026-09-03, committed (`e67fdde`, `50f4bbf`, `3e018a5`).
- Persist work to disk early/often (context limits have killed sessions before); keep HANDOFF.md current and **verify writes landed**. Owner is noise-sensitive around class time: prefer small, bounded agent runs.

## Next steps (in order)

1. **Owner reviews P5 M1 + M2 + M3 (committed, awaiting review)** — serve from project dir (`python3 -m http.server 8077 --bind 127.0.0.1`), open `http://localhost:8077/index.html#/how`. Eyeball: 5 horizontal glass cards; Stage 1 prefilled with “Hello, world!” → brief “loading vocabulary…” then 4 chips with **real Qwen3 ids** (“ world” = 1814); typing re-renders live; empty input clears; real-vocab-subset note (30,747 of 248,320 tokens; subset + greedy-longest-first limits) visible. **Stage 2:** memory bar pours in on load (instant under prefers-reduced-motion); caption shows real GB used vs available from the engine. **Stage 3 (the core lesson):** the two-speed contrast — on load the drip animates: a brief “Prefill — one fast pass over the N-token prompt…” beat, then decode chips (`.sim-conveyor`) trickle in one-by-one to 256; the two columns show the prefill gulp (prompt-token count + TTFT, compute-bound) vs the decode drip (engine tok/s + per-token ms, bandwidth-bound); the run line labels the real time + any ×N compression. Change hardware in the Lab (e.g. RTX 3060 12 GB + 70B offload → both halves slow down live, compression label appears) and Stage 3 re-renders on the same subscription as Stage 2. Confirm Home/Lab do **not** load the 381 KB vocab. Review the diff in `85780dc`.
2. **Owner reviews P6 in light + dark** — serve from project dir (`python3 -m http.server 8077 --bind 127.0.0.1`), open `http://localhost:8077/index.html` and `#dark`. Eyeball the new rows: concurrency ×4 → total row + TTFT note appear; RTX 3060 + DDR4 + 70B stop → offload sentence appears under the memory caption.
3. ~~Close the two open test gaps~~ — **DONE 2026-09-05** (ui 79/79, engine 63/63; both regression-proven).
4. **Owner sign-off** on P6 (incl. the agent-decided placement/copy list above) → flip blueprint §11 P6 row to SIGNED OFF with date.
5. **Next build step: P5 M4 (KV cache growth stage)** — blueprint §6 Tab 2.4: a bar that fills as context grows, with a live GB readout from the engine's §5 KV formulas for the current model/context window. Then M5 sampling (temperature/top-p + next-token probability bars).
6. Then P7 Compare tab / P8 polish per blueprint §11 order.

## Observations / gotchas

- `search_file_line` tool returned false "No matches found" on `test/ui.test.mjs` and `HANDOFF.md` for strings that demonstrably exist — **don't trust it there; read files directly** (shell grep is fine).
- No headless browser on this box; ES modules fail over `file://`, always serve HTTP :8077.
- **"Links don't work" has now had one false alarm (P3: placeholder panels) and one real cause (2026-09-04: fatal TDZ in `app.js`). Never close it from reasoning alone — serve the page and READ THE BROWSER CONSOLE first.** Green tests prove nothing about the bootstrap path.
- `requestAnimationFrame` does not fire in some embedded/hidden preview panes, so Run Inference will look frozen there. That is a harness artifact, not a bug — verify the sim via `initSim({raf, now})` DI, or use a real browser window.
- Store says `'pipeline'`, router/hash says `'how'` — always via `TAB_TO_STORE`. Button class is `.btn--primary`. Store appends `visitedTabs` in visit order (compare as sets).
- Engine facts used by M4 copy: RTX 3060 = 360 GB/s, DDR4-3200 = 51.2 GB/s (`hardware.js`); `decodeTpsTotal = perRequest × B` exactly; `ttftMs = ttftMsBase × B` (prefills serialized — labeled assumption in perf.js header).
- AIO configs can never be offload/cpuOnly (unified pool → gpu or noFit), so the offload note is rig-only by construction.

## Important files & reference map

| File | Status / significance |
|---|---|
| `js/data/*` (incl. new `vocab.js`), `js/engine/cost.js`, `js/state/store.js` | ✅ P1+P2 signed off; engine suite 63/63 green — **do not modify**. `vocab.js` is a generated 30,747-entry Qwen3 vocabulary subset (381 KB) — regenerate, don't hand-edit |
| `js/engine/perf.js` | ✅ P2 signed off, engine suite 63/63 green — **do not modify except**: prefill TFLOPS→FLOPs unit fix landed 2026-09-04 (`f21797b`, see bug-fix pass). Formula shape unchanged. |
| `css/tokens.css`, `base.css`, `tabs.css` | ✅ P3/P4 signed off; `.is-hidden` + `.ctl-note` utilities already exist (used by M4 rows) |
| `js/app.js` | ✅ built; **fatal TDZ fixed 2026-09-04, now covered by a bootstrap test** — `defaultDoc`/`defaultHash` must stay ABOVE `initApp()`, never at the file's end; also wires `initPipeline({store})` (P5 M1) |
| `js/theme.js`, `js/motion/scroll.js`, `js/tabs/home.js` | ✅ built, unchanged |
| `js/tabs/lab.js` | ✅ **M1–M4 complete** (624 lines); M4 helpers exported for tests |
| `js/tabs/pipeline.js` | 🆕 **P5 M1+M2+M3 (committed `85780dc`, REWORKED)** — `tokenizeWith(vocab, text)` (pure, greedy longest-first) + async `tokenize(text)` (lazy memoised `import('../data/vocab.js')`) + **P5 M2: `modelLoadView(perf)` / `loadCaption(perf, config)`** (Stage 2 memory bar + GB caption, reuses lab.js `membarView`) + **P5 M3: `prefillDecodeView(perf)` / `prefillCaption` / `decodeCaption` / `speedNote`** (Stage 3 two-speed contrast, reuses lab.js `simPlan`/`simPhase`/`tokensAt`/`stageText`) + `runStage3Drip` (DI raf/now, reduced-motion instant) + `initPipeline({doc,store,raf,now,reduced})` factory (ONE store subscription drives Stages 2+3, `api.pending`, `api.destroy()` cancels drip + unsubs); M4–M5 seam ready |
| `index.html` | ✅ Lab panel + 3 M4 elements; **How tab = P5 M1 shell + Stage 1 live + Stage 2 (Model load) live + Stage 3 (Prefill vs decode) live**; Stages 4–5 still placeholder; Compare still "Phase 7 lands here"; stray literal `\n` in `#explorer-celebrate` removed 2026-09-04 |
| `test/ui.test.mjs` | ✅ **79 checks green** (was 70; +6 P5 M3 blocks: prefillDecodeView fast/slow, prefill-half engine prompt-token count, clock-driven drip 0→256, reduced-motion instant, store-change re-render); plus the 2026-09-05 `app.js — initApp() bootstrap` section (+3); harness: `makeLabDoc()`, `makePrintout()`, `makeClock()`, `makePipeDoc()`, `makeAppDoc()` patterns in-file. ✅ **Both bug-fix-pass test gaps are now closed** |
| `blueprint.md` | ✅ §11 P6 row + verification log updated for M1–M4 **and the 2026-09-04 bug-fix pass**; awaiting sign-off flip |
| `HANDOFF.md` | ✅ this document — replace on disk when writing it |
| `dev/design-system.html` | P3 acceptance harness (signed off); unchanged |

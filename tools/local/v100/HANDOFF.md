# v100 Handoff — P5 M3 BUILT (uncommitted, awaiting owner review) · P6 (M1–M4) COMPLETE, awaiting owner sign-off

**Date:** 2026-09-04 · **Status: P5 M1 (Pipeline shell + Stage 1 Tokenization) + P5 M2 (Stage 2 Model load) + P5 M3 (Stage 3 Prefill vs decode) — on disk, UNCOMMITTED, awaiting owner review.** Stage 1 tokenizes against a **real subset of the Qwen3 vocabulary** (30,747 of 248,320 tokens) with real token ids, lazy-loaded. Stage 2 pours the current config's weights into a live memory bar bound to the shared store (Lab hardware changes re-render it). Stage 3 now shows the **two-speed contrast** — prompt chewed in one fast pass vs the answer dripping one token at a time at the engine's tok/s — animated (DI `raf`/`now`, reduced-motion instant) and live-bound to the same store subscription. Both suites green (ui **76/76**, engine 62/62). P6 M1–M4 remain committed + awaiting sign-off as before.

## What changed — P5 M3 (Stage 3 · Prefill vs decode, blueprint §6 Tab 2.3)

| File | Change |
|---|---|
| `js/tabs/pipeline.js` | **Stage 3 live.** Extended the `./lab.js` import to reuse the tested two-speed model (`simPlan`, `simPhase`, `tokensAt`, `stageText`, `fmtTps`) — the drip math is NOT re-derived (tVirtual is VIRTUAL SECONDS, the same units the Lab's run drives). New pure exports `prefillDecodeView(perf)` → `{promptTokens, targetTokens, tps, perTokenMs, ttftMs, prefillS, decodeS, speedup, realDurationS}` (reuses `simPlan`; adds the engine's real per-request TTFT as the honest "one fast pass" duration) + `prefillCaption` / `decodeCaption` / `speedNote` (the two halves + the labelled compression line). `runStage3Drip({doc,plan,raf,now,reduced})` animates the decode drip into the Lab's `.sim-conveyor` (chips appear via `tokensAt`, phase line via `stageText`), skipping the load beat (Stage 2's) and starting at the prefill; reduced-motion / no-raf paints the final state instantly. `initPipeline` gains `{raf, now, reduced}` DI (same shape as `initSim`) and paints Stage 3 on the **same** store subscription as Stage 2 (first paint animates, subsequent changes re-render to final state — no replay jitter); `api.destroy()` also cancels any in-flight drip. Stage 1 untouched; vocab.js still lazy dynamic-import only |
| `index.html` | Stage 3 placeholder card replaced: real card with a two-column contrast (Prefill · one gulp / Decode · a drip, each a big engine number + `.ctl-note`), a `#pipe-phase` line, a `.sim-conveyor#pipe-drip` chip stream (chips drip in), `#pipe-drip-label`, and `#pipe-speed-note` (compression labelled). Only existing CSS (`.card .chip .ctl-note` + the Lab's `.sim-conveyor` token stream) — **no new css/tabs.css rule** this milestone |
| `test/ui.test.mjs` | +6 P5 M3 blocks: `prefillDecodeView` on a fast config (engine prompt tokens + tok/s + TTFT-derived prefill, speedup 1) and a slow offloaded one (low tok/s, long drip, ×N compression labelled); the prefill half reports the engine's prompt-token count ("long" split → 8192) with compute-/bandwidth-bound copy; driving the injected `makeClock()` advances decode tokens 0→256 one-by-one to Done; reduced-motion paints the final 256 instantly without calling raf; a store config change re-renders Stage 3 live (decode tok/s moves, shared subscription). `makePipeDoc` extended with Stage 3 fakes (`pipe-prefill-*`, `pipe-decode-*`, `pipe-phase`, `pipe-drip`, `pipe-drip-label`, `pipe-speed-note`). Final log now "+ P5 M3 Prefill vs decode". **76/76 green** (was 70) |
| `HANDOFF.md` | This document |

**Verification (P5 M3):** `node --check` OK on `pipeline.js` + `test/ui.test.mjs` · `test/ui.test.mjs` **76/76 green** (was 70) · `test/engine.test.mjs` **62/62 unchanged** · `grep` confirms **no top-level vocab.js import** in `pipeline.js` (only the memoised dynamic `import()` inside `loadVocabModule`). Nothing committed. Zero changes to `js/data/*`, `js/engine/*`, `js/state/store.js`, or `test/engine.test.mjs`; **css/tabs.css NOT touched this milestone** (the pre-existing uncommitted M2 reduced-motion rule is unchanged).

## What changed — P5 M2 (Stage 2 · Model load, blueprint §6 Tab 2.2)

| File | Change |
|---|---|
| `js/tabs/pipeline.js` | **Stage 2 live.** Added `import { membarView } from './lab.js'` (reused the tested fill math — not re-derived) + pure exports `modelLoadView(perf)` → `{usedGB, availableGB, pct, state, gpuPct, cpuPct}` (used = weightsGB + kvTotalGB, the engine's fits-check demand; available = VRAM on the fast path, VRAM+RAM when it splits or overflows) and `loadCaption(perf, config)` (GB used vs available, memoryCaption voice; names the split when offloading). `initPipeline` now subscribes the store (when provided): first paint “pours” — `.seg` widths set to 0 then to target on the next frame(s), riding the existing `.membar .seg` width transition in base.css; `prefersReducedMotion()` (guarded matchMedia) paints the final state instantly instead. Offload/cpuOnly also reveal a `#pipe-load-layers` one-liner (`is-hidden` toggle). New `api.destroy()` unsubscribes cleanly. Stage 1 untouched; vocab.js still lazy dynamic-import only |
| `index.html` | Stage 2 placeholder card replaced: real card with `.membar#pipe-loadbar` (`.seg seg-gpu` / `.seg seg-cpu`, `--w` inline, same structure as `#lab-membar`), `#pipe-load-caption` (`.ctl-note`, aria-live), `#pipe-load-layers` (`.ctl-note is-hidden`); only existing CSS classes used |
| `css/tabs.css` | One new rule, in a small new “Tab 2” section: `@media (prefers-reduced-motion: reduce) { #pipe-loadbar .seg { transition: none !important; } }` — belt to the JS reduced-motion instant-paint suspenders (JS already skips the pour; this kills the width transition too) |
| `test/ui.test.mjs` | +5 P5 M2 blocks: `modelLoadView` fitting (8B/RTX 3090: 5.5 GB of 24 GB, state ok, segment math matches membarView); `modelLoadView` noFit (405B on 16 GB VRAM + 32 GB RAM: pct ≥1, state fail, “doesn't fit” caption); `loadCaption` offload (70B: names VRAM + RAM split); store binding (24 GB → 12 GB VRAM GPU swap re-renders the caption live via `store.setConfig`); `destroy()` unsubscribes (no further re-renders). `makePipeDoc` extended with `pipe-loadbar`/`pipe-load-caption`/`pipe-load-layers` fakes. Final log now “+ P5 M2 Model load”. **70/70 green** (was 65) |
| `HANDOFF.md` | This document |

**Verification (P5 M2):** `node --check` OK on `pipeline.js` + `test/ui.test.mjs` · `test/ui.test.mjs` **70/70 green** · `test/engine.test.mjs` **62/62 unchanged** · `grep` confirms the only top-level import in `pipeline.js` is `./lab.js` — **no top-level vocab.js import** (still the memoised dynamic `import()` inside `loadVocabModule`). Nothing committed. Zero changes to `js/data/*`, `js/engine/*`, `js/state/store.js`, `js/app.js`, or `test/engine.test.mjs`.

## What changed — P5 M1 tokenizer rewrite (real Qwen3 vocab subset)

## What changed — P5 M1 tokenizer rewrite (real Qwen3 vocab subset)

The owner rejected the original FNV-hash / regex tokenizer (it emitted every word as one token, undercounting tokens ~21% vs a real Qwen3 tokenizer). Stage 1 was rewritten to do **greedy longest-first matching against `js/data/vocab.js`** (a 30,747-entry subset of Qwen3's 248,320-token vocabulary, real token ids, genuine BPE leading-space convention).

| File | Change |
|---|---|
| `js/tabs/pipeline.js` | **Rewrote Stage 1.** Deleted the `tokenId()` FNV helper and the old regex `tokenize()`. Added pure, DI-friendly `tokenizeWith(vocab, text)` → `[{text, id, unknown}]` (greedy longest-first; unmatched char → `{id:null, unknown:true}`), and async convenience `tokenize(text)` that awaits a **memoised dynamic `import('../data/vocab.js')`** (no top-level static import — never loads on Home/Lab). `initPipeline` shows a brief accessible "loading vocabulary…" state in the chip area until the vocab resolves, then renders; empty input short-circuits with no vocab load; exposes `api.pending` so tests can await. Reuses `.chip` / `.chip .id` / `.ctl-note` only — no new CSS |
| `index.html` | Stage 1 labelled-assumption note rewritten: now states it uses a **real subset of the Qwen3 vocabulary (30,747 of 248,320 tokens) with real token ids**, and names the two honest limits (it's a subset — words outside it split into sub-pieces; matching is greedy longest-first, not true BPE merge-order). One short paragraph, high-school readable |
| `test/ui.test.mjs` | Dropped the `tokenId`/old `tokenize` tests; rewrote to `tokenizeWith(VOCAB, …)` (VOCAB imported directly from `js/data/vocab.js`). New checks: "Antidisestablishmentarianism" → **more than 3** tokens (6); digit run "936" → separate digit tokens; " world" → **ONE token, id 1814**; empty string → no tokens. DOM chip tests now `await api.pending` (async lazy load). Final log updated. **65/65 green** (was 62) |
| `HANDOFF.md` | This document |

**Verification (tokenizer rewrite):** `node --check` OK on `pipeline.js` + `test/ui.test.mjs` · `test/ui.test.mjs` **65/65 green** · `test/engine.test.mjs` **62/62 unchanged** · `grep` confirms **no top-level static import** of `vocab.js` in `pipeline.js` (only the memoised dynamic `import()` inside `loadVocabModule`). Nothing committed. Zero changes to `js/data/*` (vocab.js only read), `js/engine/*`, `js/state/store.js`, or `test/engine.test.mjs`.

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

1. **Owner reviews P5 M1 + M2 + M3 (all uncommitted)** — serve from project dir (`python3 -m http.server 8077 --bind 127.0.0.1`), open `http://localhost:8077/index.html#/how`. Eyeball: 5 horizontal glass cards; Stage 1 prefilled with “Hello, world!” → brief “loading vocabulary…” then 4 chips with **real Qwen3 ids** (“ world” = 1814); typing re-renders live; empty input clears; real-vocab-subset note (30,747 of 248,320 tokens; subset + greedy-longest-first limits) visible. **Stage 2:** memory bar pours in on load (instant under prefers-reduced-motion); caption shows real GB used vs available from the engine. **Stage 3 (the core lesson):** the two-speed contrast — on load the drip animates: a brief “Prefill — one fast pass over the N-token prompt…” beat, then decode chips (`.sim-conveyor`) trickle in one-by-one to 256; the two columns show the prefill gulp (prompt-token count + TTFT, compute-bound) vs the decode drip (engine tok/s + per-token ms, bandwidth-bound); the run line labels the real time + any ×N compression. Change hardware in the Lab (e.g. RTX 3060 12 GB + 70B offload → both halves slow down live, compression label appears) and Stage 3 re-renders on the same subscription as Stage 2. Confirm Home/Lab do **not** load the 381 KB vocab. Review the **uncommitted** diff (owner asked for no commit).
2. **Owner sign-off P5 M1+M2+M3 → P5 M4 (KV cache growth stage)** — blueprint §6 Tab 2.4: a bar that fills as context grows, with a live GB readout from the engine's §5 KV formulas for the current model/context window. Then M5 sampling (temperature/top-p + next-token probability bars).
3. Owner reviews P6 in light + dark (unchanged): concurrency ×4 → total row + TTFT note; RTX 3060 + DDR4 + 70B stop → offload sentence under the memory caption.
4. **Owner sign-off** on P6 (incl. the agent-decided placement/copy list above) → flip blueprint §11 P6 row to SIGNED OFF with date.
5. Then P7 Compare tab / P8 polish per blueprint §11 order.

## Observations / gotchas

- `search_file_line` tool returned false "No matches found" on `test/ui.test.mjs` and `HANDOFF.md` for strings that demonstrably exist — **don't trust it there; read files directly** (shell grep is fine).
- No headless browser on this box; ES modules fail over `file://`, always serve HTTP :8077.
- Store says `'pipeline'`, router/hash says `'how'` — always via `TAB_TO_STORE`. Button class is `.btn--primary`. Store appends `visitedTabs` in visit order (compare as sets).
- Engine facts used by M4 copy: RTX 3060 = 360 GB/s, DDR4-3200 = 51.2 GB/s (`hardware.js`); `decodeTpsTotal = perRequest × B` exactly; `ttftMs = ttftMsBase × B` (prefills serialized — labeled assumption in perf.js header).
- AIO configs can never be offload/cpuOnly (unified pool → gpu or noFit), so the offload note is rig-only by construction.

## Important files & reference map

| File | Status / significance |
|---|---|
| `js/data/*` (incl. new `vocab.js`), `js/engine/perf.js`+`cost.js`, `js/state/store.js` | ✅ P1+P2 signed off; 62/62 green — **do not modify** (M4 deliberately didn't). `js/data/vocab.js` (new, ~381 KB, 30,747-entry real Qwen3 token subset) is **read-only** — pipeline.js lazy-imports it, tests read `VOCAB` directly |
| `css/tokens.css`, `base.css`, `tabs.css` | ✅ P3/P4 signed off; `.is-hidden` + `.ctl-note` utilities already exist (used by M4 rows) |
| `js/app.js`, `js/theme.js`, `js/motion/scroll.js`, `js/tabs/home.js` | ✅ built; `app.js` now also wires `initPipeline({store})` (P5 M1, uncommitted) |
| `js/tabs/lab.js` | ✅ **M1–M4 complete** (624 lines); M4 helpers exported for tests |
| `js/tabs/pipeline.js` | 🆕 **P5 M1+M2+M3 (uncommitted, REWORKED)** — `tokenizeWith(vocab, text)` (pure, greedy longest-first) + async `tokenize(text)` (lazy memoised `import('../data/vocab.js')`) + **P5 M2: `modelLoadView(perf)` / `loadCaption(perf, config)`** (Stage 2 memory bar + GB caption, reuses lab.js `membarView`) + **P5 M3: `prefillDecodeView(perf)` / `prefillCaption` / `decodeCaption` / `speedNote`** (Stage 3 two-speed contrast, reuses lab.js `simPlan`/`simPhase`/`tokensAt`/`stageText`) + `runStage3Drip` (DI raf/now, reduced-motion instant) + `initPipeline({doc,store,raf,now,reduced})` factory (ONE store subscription drives Stages 2+3, `api.pending`, `api.destroy()` cancels drip + unsubs); M4–M5 seam ready |
| `index.html` | ✅ Lab panel + 3 M4 elements; **How tab = P5 M1 shell + Stage 1 live + Stage 2 (Model load) live + Stage 3 (Prefill vs decode) live** (uncommitted); Stages 4–5 still placeholder; Compare still "Phase 7 lands here" |
| `test/ui.test.mjs` | ✅ **76 checks green** (was 70; +6 P5 M3 blocks: prefillDecodeView fast/slow, prefill-half engine prompt-token count, clock-driven drip 0→256, reduced-motion instant, store-change re-render; uncommitted); harness: `makeLabDoc()`, `makePrintout()`, `makeClock()`, `makePipeDoc()` (now incl. pipe-loadbar/-caption/-layers + pipe-prefill/-decode/-phase/-drip fakes) patterns in-file |
| `blueprint.md` | ✅ §11 P6 row + verification log updated for M1–M4; awaiting sign-off flip |
| `HANDOFF.md` | ✅ this document — replace on disk when writing it |
| `dev/design-system.html` | P3 acceptance harness (signed off); unchanged |

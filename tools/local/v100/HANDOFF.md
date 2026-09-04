# v100 Handoff — P6 COMPLETE (M1–M4), awaiting owner sign-off

**Date:** 2026-09-04 · **Status: M4 DONE + committed.** Code, tests, docs all landed; both suites green. Supersedes the prior "M4 ~70% in progress" handoff (P1–P5 context unchanged).

Project: `/home/paul/Documents/GitHub/make/tools/local/v100/` (NOT the Bionic workspace folder). Static multi-tab site, vanilla HTML/CSS/JS ES modules, no build step. Spec in `blueprint.md`, owner Q&A in `plans.md`. Git repo root is `/home/paul/Documents/GitHub/make`; if a new session gets "No permission to write", re-request via `request_read_write_access`.

## What M4 was (owner's ask)

Concurrency teaching moment (per-request vs total throughput divergence, TTFT ×B queueing) + offload teaching moment (visible slowdown + one-sentence why), then full verification. Owner constraint: small bounded job only — GPU-fan noise around class time. It stayed small: **zero engine changes**, tests + docs + commit.

## What landed this session (all committed)

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

1. **Owner reviews P6 in light + dark** — serve from project dir (`python3 -m http.server 8077 --bind 127.0.0.1`), open `http://localhost:8077/index.html` and `#dark`. Eyeball the new rows: concurrency ×4 → total row + TTFT note appear; RTX 3060 + DDR4 + 70B stop → offload sentence appears under the memory caption.
2. **Owner sign-off** on P6 (incl. the agent-decided placement/copy list above) → flip blueprint §11 P6 row to SIGNED OFF with date.
3. Then P5 Pipeline tab / P7 Compare tab / P8 polish per blueprint §11 order.

## Observations / gotchas

- `search_file_line` tool returned false "No matches found" on `test/ui.test.mjs` and `HANDOFF.md` for strings that demonstrably exist — **don't trust it there; read files directly** (shell grep is fine).
- No headless browser on this box; ES modules fail over `file://`, always serve HTTP :8077.
- Store says `'pipeline'`, router/hash says `'how'` — always via `TAB_TO_STORE`. Button class is `.btn--primary`. Store appends `visitedTabs` in visit order (compare as sets).
- Engine facts used by M4 copy: RTX 3060 = 360 GB/s, DDR4-3200 = 51.2 GB/s (`hardware.js`); `decodeTpsTotal = perRequest × B` exactly; `ttftMs = ttftMsBase × B` (prefills serialized — labeled assumption in perf.js header).
- AIO configs can never be offload/cpuOnly (unified pool → gpu or noFit), so the offload note is rig-only by construction.

## Important files & reference map

| File | Status / significance |
|---|---|
| `js/data/*`, `js/engine/perf.js`+`cost.js`, `js/state/store.js` | ✅ P1+P2 signed off; 62/62 green — **do not modify** (M4 deliberately didn't) |
| `css/tokens.css`, `base.css`, `tabs.css` | ✅ P3/P4 signed off; `.is-hidden` + `.ctl-note` utilities already exist (used by M4 rows) |
| `js/app.js`, `js/theme.js`, `js/motion/scroll.js`, `js/tabs/home.js` | ✅ built, unchanged in M4 |
| `js/tabs/lab.js` | ✅ **M1–M4 complete** (624 lines); M4 helpers exported for tests |
| `index.html` | ✅ Lab panel + 3 M4 elements; How/Compare tabs still "Phase 5/7 lands here" placeholders |
| `test/ui.test.mjs` | ✅ **988 lines, 56 checks green** (incl. 4 M4 blocks); harness: `makeLabDoc()`, `makePrintout()`, `makeClock()` patterns in-file |
| `blueprint.md` | ✅ §11 P6 row + verification log updated for M1–M4; awaiting sign-off flip |
| `HANDOFF.md` | ✅ this document — replace on disk when writing it |
| `dev/design-system.html` | P3 acceptance harness (signed off); unchanged |

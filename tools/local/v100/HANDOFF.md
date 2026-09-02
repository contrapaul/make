# v100 Handoff — "How Local AI Works" Interactive Page (Session 3)

**Date:** 2026-09-02 · **Status: STOPPED AT OWNER'S REQUEST.** Phase 1 is complete on disk; awaiting owner sign-off (P1 gate). Nothing is mid-flight. Owner will update R9 street prices themselves shortly — do not guess or re-research them.

Project lives at `/home/paul/Documents/GitHub/make/tools/local/v100/` (NOT in the Bionic workspace folder — that one is empty). Static multi-tab site, vanilla HTML/CSS/JS, no build step; full spec in [blueprint.md](blueprint.md), owner Q&A context in [plans.md](plans.md).

---

## Where things stand

- **Phase 1 (Research & Data): ~100% on disk.** All five data files exist, were verified against primary sources across two sessions, and `blueprint.md` is fully synced to the closed research (§10 checklist has ✅/⚠️ status + verification log; §3.1–§3.5 markers updated).
- **One open item:** R9 hardware street prices (¥) are labeled estimates in `hardware.js`. Owner said they will update these themselves shortly.
- **Then:** P1 sign-off → Phase 2 (engine).

## What was done, last two sessions

**Session 2 (2026-09-01):** verification pass of all five data files against primary sources; found and fixed one real error — RX 9070 XT `tflopsFp32Dense` in `hardware.js` corrected **132.7 → 48.7 TFLOPS** (wrong CU/ALU derivation; actual 64 CUs / 4096 shaders, boost 2970 MHz — AMD official + TechPowerUp) and `tdpW` 300 → **304 W**. Everything else confirmed as written.

**Session 3 (2026-09-02):** re-verified all five data files against the session-2 handoff claims (all consistent); synced `blueprint.md`:
- §10 research checklist: added Status column for R1–R10 + "Verification log (2026-09-01)" note.
- §3.1 GPU table: all `*(verify)*` markers replaced with verified values (V100 900 GB/s; RX 9070 XT FP32 48.7 TFLOPS / 304 W; 5070 Ti 43.9; 5090 104.8; RTX 6000 Ada 91.1); CPU row "confirm inclusion" → included (user-approved).
- §3.2 anchor table: all stops filled with verified configs + [M#] refs (incl. Gemma 3 12B head dim **256**; Qwen3 selected for 14B/32B).
- §3.4 cloud table: "Verify at build" column → "Status (P1)" ✅ closed, pointing at `cloud.js`.
- §3.5: FX "~7.2 CNY/USD" → **≈6.72** (verified Aug 31 2026; supersedes old assumption). [S2] source note updated to confirmed.

## Open items & next steps (in order)

1. **Owner updates R9 prices themselves** — `js/data/hardware.js`, the `priceRMB` fields + `[H7]` estimate notes (current estimates: V100 ¥4,200 · 3060 ¥2,000 · 3090 ¥6,000 · RX 9070 XT ¥5,000 · 5070 Ti ¥6,500 · 5090 ¥17,000 · RTX 6000 Ada ¥38,000 · Air M5 ¥9,000 · MBP M4 Pro ¥18,000 · DGX Spark ¥29,000).
   - *Next session: first check whether owner has edited these (diff `priceRMB` fields / H7 note). If updated → flip blueprint §10 R9 row ⚠️→✅ and append a line to the verification log. If not yet → wait; do NOT re-research or guess prices.*
2. **P1 sign-off** (owner) — gate per blueprint §11: "Data review sign-off (owner)".
3. **Phase 2 (engine):** `js/engine/perf.js`, `js/engine/cost.js`, `js/state/store.js`. Acceptance = all five §5 sanity anchors within range (e.g., RTX 3090 + 8B Q4_K_M → 140–200 tok/s; M4 Pro + 70B Q4_K_M → 5–9 tok/s). Calibrate `η` constants in `ENGINE_CONSTANTS` (`hardware.js`) — never change formula shape. R10 CPU `prefillTflopsEff` estimates get calibrated here too.

## Key decisions & constraints (condensed)

**Owner-approved:** audience = high school students + educators, English only (Chinese deferred); must pass muster with seasoned local-AI enthusiasts (labeled assumptions, footnoted sources); desktop-first, touch-friendly controls, no mobile polish; glassmorphism, light+dark mode, Pi.dev-style reversible scroll reveals; zero image/video/font-file assets (CSS/SVG/canvas only); hosted as plain static files on owner's site; owner in **Shenzhen** → RMB costs at local electricity rates; local cost = hardware price + electricity ONLY; no custom hardware entry (presets only); semantic HTML only, no a11y program.

**Agent-decided (labeled as assumptions/estimates in the data files):** η_decode 0.65–0.80 / η_prefill 0.5–0.7 ranges; multi-GPU bandwidth factors {1:1.0, 2:1.75, 4:3.2}; PC system base 100 W; unified-memory OS carve-out ⅓ — all isolated in `ENGINE_CONSTANTS` for P2 calibration. Mac load power (Air ~30 W, MBP ~90 W) = labeled assumption. All `priceRMB` values are estimates (`priceBasis:'estimate'`, [H7]) → UI must footnote them. CPU `prefillTflopsEff` = community-behavior estimates, labeled per row. Electricity default 0.65 RMB/kWh = rounded midpoint of residential tier-1 ≈0.66 and industrial 0.610.

**Process constraint (owner pain point):** context limits have killed sessions before — **persist work to disk early and often; checkpoint after each major piece; keep milestones frequent.**

## File map & verified-vs-estimated cheat sheet

| File | Contents | Verified ✅ / Estimated ⚠️ |
|---|---|---|
| `js/data/hardware.js` | 3 all-in-ones, 8 GPUs (×1/2/4), RAM tiers, 6 CPUs, `ENGINE_CONSTANTS`, sources H1–H9 | Bandwidths/TDPs/compute ✅ · **street prices ⚠️** · Mac load power + multi-GPU factors = labeled assumptions |
| `js/data/models.js` | 10 slider stops with anchor configs (layers/KV heads/head dim), sources M1–M6 | ✅ all anchors verified from HF / gemma_pytorch configs |
| `js/data/quantization.js` | 5 levels, bytes/param, student explainers | Static per blueprint §3.3 |
| `js/data/cloud.js` | GPT-5.6 Sol · DeepSeek V4 Pro + Flash · Claude Opus 5 · ChatGPT Plus $20/mo; sources C1–C8 with as-of dates | ✅ pricing/speeds/context verified (single-file update policy for future changes) |
| `js/data/rates.js` | Shenzhen electricity default 0.65 RMB/kWh; FX 6.72 CNY/USD (Aug 31 2026); sources R8a/R8b/FX1 | ✅ both rate anchors current; midpoint is a labeled choice |
| `blueprint.md` | Full spec: architecture, data layer, engine formulas (§5), tab specs (§6), design system (§7–9), research checklist (§10), build order (§11) | Synced to closed research as of 2026-09-02 |
| `plans.md` | Owner Q&A context (read-only reference) | — |

**Not yet created:** `index.html`, `css/*`, `js/engine/*`, `js/state/*`, `js/motion/*`, `js/tabs/*`, `js/app.js` (Phases 2–8 per blueprint §11).

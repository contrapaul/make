# v100 — Blueprint: "How Local AI Works" Interactive Page

Status: **Building** — P1 signed off by owner 2026-09-02 (incl. R9 prices, now owner-provided Taobao listings); **P2 engine complete + signed off 2026-09-02** (all §5.4 anchors pass; `test/engine.test.mjs` 62/62 green; owner confirmed all prices correct — incl. unchanged RTX 3060 ¥2,000 / MBP M4 Pro ¥18,000 — and approved the KV-inclusive decode semantics); **P3 design system SIGNED OFF by owner 2026-09-02** (harness light+dark clean on all components, reveals reversible; "links don't work" verified as expected at P3 — router proven by tests; `test/ui.test.mjs` 21/21 green) · **P4 Home tab SIGNED OFF by owner 2026-09-02** ("looking ridiculously good"; hero + story beats + explore grid; exploration tracker across tabs; `test/ui.test.mjs` 31/31 green) · **P6 Hardware Lab BUILT (M1–M4, 2026-09-03→04), awaiting owner sign-off** (full control panel + printouts rail + memory bar; Run Inference simulation with labeled time compression; concurrency teaching moment — per-request vs total throughput divergence + TTFT ×B queueing note; offload teaching moment — one-sentence “why it’s slow” naming real bandwidths; `test/ui.test.mjs` 56/56 green at build time · engine unchanged at 62/62) · **P5 Pipeline tab BUILT through M3 (2026-09-04, commit `85780dc`), awaiting owner review** (Stage 1 tokenization against a real Qwen3 vocabulary subset; Stage 2 model load; Stage 3 prefill-vs-decode two-speed contrast) · **Suites now `test/ui.test.mjs` 79/79 green · `test/engine.test.mjs` 63/63 green** (2026-09-05: the two bug-fix-pass test gaps closed) · Supersedes [outline.md](outline.md) · Context in [plans.md](plans.md)
Last updated: 2026-09-05

---

## 1. Product Definition

A static, multi-tab interactive site for **high school students and educators** (English first; Chinese toggle deferred). It demonstrates how local AI models run, makes hardware a first-class factor in performance, simulates inference with representative real numbers, and compares local setups against ChatGPT (GPT-5 family), DeepSeek V4, and Claude Opus 5 — including cost at Shenzhen electricity rates.

**Success criteria:**
1. A student can toggle hardware + model + quantization, run a simulation, and *explain* why the speed changed.
2. Numbers pass muster with seasoned local-AI enthusiasts (labeled assumptions, footnoted sources).
3. Every tab is visually rewarding; exploration of all 4 tabs is encouraged and celebrated.
4. Hosts as plain static files on the owner's website — no build step, no external media assets.

**Out of scope:** mobile layout polish (touch-friendly controls only), Chinese UI, fine-tuning *simulation* (covered in comparison narrative only), custom hardware entry.

---

## 2. Architecture & File Layout

```
v100/
├── index.html              # App shell: tab nav, theme toggle, footer placeholder
├── css/
│   ├── tokens.css          # Design tokens + light/dark themes (CSS custom properties)
│   ├── base.css            # Reset, typography, glass components, controls
│   └── tabs.css            # Per-tab layout & motion classes
├── js/
│   ├── data/
│   │   ├── hardware.js     # All-in-ones, GPUs, RAM tiers, CPUs (verified specs + sources)
│   │   ├── models.js       # Slider stops w/ anchor-model architecture metadata
│   │   ├── quantization.js # Levels, bytes/param, student explainers
│   │   ├── cloud.js        # GPT-5 family / DeepSeek V4 / Claude Opus 5 (specs, pricing, "as of" dates)
│   │   └── rates.js        # Shenzhen electricity rate + USD conversion
│   ├── engine/
│   │   ├── perf.js         # Decode/prefill/KV-cache/fits-check formulas (§5)
│   │   └── cost.js         # Power, kWh, RMB/USD per M tokens
│   ├── state/store.js      # Shared reactive store (config → derived metrics), localStorage persistence
│   ├── motion/scroll.js    # Reversible scroll-reveal engine (§8)
│   ├── tabs/
│   │   ├── home.js         # Tab 1
│   │   ├── pipeline.js     # Tab 2
│   │   ├── lab.js          # Tab 3 (centerpiece)
│   │   └── compare.js      # Tab 4
│   └── app.js              # Bootstrap, tab router, theme switcher, exploration tracker
├── package.json            # {"type":"module"} — enables Node-based engine tests; browsers ignore it (zero hosting impact)
├── test/
│   └── engine.test.mjs     # P2 acceptance suite: §5.4 anchors + unit checks (`node test/engine.test.mjs`)
├── plans.md · outline.md · blueprint.md
```

- **No framework, no build step.** Vanilla ES modules; one optional charting library (Chart.js) if hand-rolled SVG proves clumsy — decision at Phase 3.
- All visuals: CSS gradients/SVG/canvas only. Zero image/video/font-file dependencies (system font stack).

---

## 3. Data Layer (verified anchors + research TODOs)

### 3.1 Hardware presets

**All-in-one:**

| Platform | Memory | Bandwidth | Compute notes | Load power |
|---|---|---|---|---|
| MacBook Air M5 | 16 GB unified | **153 GB/s** [S1] | M5, 10-core CPU + 8/10-core GPU | ~30 W (assumption) |
| MacBook Pro M4 Pro | 48 GB unified | **273 GB/s** [S2] | M4 Pro, 14-core CPU + 20-core GPU | ~90 W (assumption range 65–120) |
| DGX Spark | 128 GB LPDDR5x unified | **273 GB/s** [S3] | GB10 Grace Blackwell, up to 1 PFLOP FP4 sparse; 20-core Arm | GB10 TDP 140 W / PSU 240 W [S3] |

**GPUs (1×/2×/4×):**

| GPU | VRAM | Bandwidth | Prefill compute | TDP |
|---|---|---|---|---|
| V100 PCIe | 16 GB | HBM2 **900 GB/s** ✅ (R1) | FP32 15.7 / Tensor 125 TFLOPS [user-provided] | 250 W; PCIe Gen3 x16 ≈ 32 GB/s link [user-provided] |
| RTX 3060 | 12 GB GDDR6 | 360 GB/s | FP32 12.7 TFLOPS | 170 W |
| RTX 3090 | 24 GB GDDR6X | 936 GB/s | FP32 35.6 TFLOPS | 350 W |
| RX 9070 XT | 16 GB GDDR6 | **644.6 GB/s** [S4] | RDNA4, boost 2970 MHz — **FP32 48.7 TFLOPS** ✅ (R2) | **304 W** [S5] |
| RTX 5070 Ti | 16 GB GDDR7 | 896 GB/s | Blackwell — **FP32 43.9 TFLOPS** ✅ (R2) | 300 W |
| RTX 5090 | 32 GB GDDR7 | 1792 GB/s | Blackwell — **FP32 104.8 TFLOPS** ✅ (R2) | 575 W |
| RTX 6000 Ada | 48 GB GDDR6 ECC | 960 GB/s | Ada — **FP32 91.1 TFLOPS** ✅ (R2) | 300 W |

**System RAM (dual-channel bandwidth):** DDR4-3200 ≈ **51.2 GB/s**; DDR5-6000 ≈ **96 GB/s**. Capacities: both at 16/32/48/64/128 GB; DDR5 additionally 192/256 GB.

**CPU (selectable — offload realism):** Ryzen 5 3600 · Ryzen 9 5800X3D · i5-13600K · i9-13900KF *(user-approved)* + included adds (user-approved): **Ryzen 7 7800X3D** and **Threadripper 7960X (DDR5, 12-ch ≈ 400 GB/s)** as a workstation tier. CPU compute matters for prefill on CPU-only/offload paths; RAM bandwidth is the decode bottleneck.

### 3.2 Model slider (approved list)
**4B · 8B · 12B · 14B · 16B · 27B · 32B · 70B · 80B · 405B** — each stop anchored to a real model for architecture metadata (layers, KV heads, head dim):

| Stop | Anchor (metadata source) |
|---|---|
| 4B | Qwen3-4B — 36 layers, GQA 8 KV heads, head dim 128 ✅ (R4) [M1] |
| 8B | Llama 3.1 8B — 32 layers, GQA 8 KV heads, head dim 128 |
| 12B | Gemma 3 12B — 48 layers, GQA 8 KV heads, head dim **256** ✅ (R4) [M2] |
| 14B | Qwen3-14B (selected) — 40 layers, GQA 8 KV heads, head dim 128 ✅ (R4) [M3] |
| 16B | Interpolated (no major anchor) — labeled "representative" |
| 27B | Gemma 3 27B v3 — 62 layers, GQA **16** KV heads, head dim 128 ✅ (R4) [M4] |
| 32B | Qwen3-32B (selected) — 64 layers, GQA 8 KV heads, head dim 128 ✅ (R4) [M6] |
| 70B | Llama 3.3 70B — 80 layers, GQA 8 KV heads, head dim 128 |
| 80B | Interpolated between 70B/405B anchors — labeled "representative" |
| 405B | Llama 3.1 405B — 126 layers, GQA 8 KV heads, head dim 128 |

### 3.3 Quantization levels (each with a student explainer)

| Level | Bytes/param | Explainer angle |
|---|---|---|
| FP16/BF16 | 2.0 | "Full precision — the model as trained; biggest and slowest" |
| INT8/AWQ | ~1.05 | "Halved size, near-identical answers for most tasks" |
| Q6_K (GGUF) | ~0.75 | "Small quality dip on hard reasoning" |
| Q5_K_M | ~0.63 | "The balance pick" |
| Q4_K_M | ~0.55 | "Community default — fits more, slightly dumber" |

Explainers must cover: what precision means → bytes/param → size vs speed vs quality trade-off → why quantization makes small models viable on big hardware and vice versa.

### 3.4 Cloud baselines (research + cite; fallback = nearest published equivalent with footnote)

| System | Known now | Status (P1) |
|---|---|---|
| ChatGPT / GPT-5 family ("ChatGPT 5+") | GPT-5 exists on Artificial Analysis [S6] | ✅ closed — current top = **GPT-5.6 Sol**: $5/$30 list (promo $4/$20 through Nov 21, 2026), ~1.05M ctx, 82.8 t/s max-effort; ChatGPT Plus $20/mo — see `js/data/cloud.js` [C1][C3][C7] |
| DeepSeek V4 | Released ~Apr 2026; **1M context**; "rivaling top closed models" [S7]; community: practical coding sweet spot 150–250k ctx [S8] | ✅ closed — **V4 Pro** peak $1.32/$3.96 (off-peak half), 54.1 t/s, TTFT 1.65 s; V4 Flash value tier — see `js/data/cloud.js` [C5][C6] |
| Claude Opus 5 | Released **Jul 24 2026**; **$5/M input, $25/M output** [S9]; context window reported 1M — ✅ confirmed in P1 (see Status) | ✅ closed — 1M ctx default (all providers), Fast mode $10/$50, ~53 t/s, II 63 #1/187 + agentic-coding results — see `js/data/cloud.js` [C2][C4] |

### 3.5 Cost constants
- **Shenzhen electricity:** residential tier-1 ≈ **0.66 RMB/kWh** [S10]; industrial 35 kV+ = **0.61 RMB/kWh** (Jul 2026, NDRC via CEIC) [S11]. Model default: **0.65 RMB/kWh** (labeled midpoint), displayed in RMB + USD at **≈6.72 CNY/USD** — verified Aug 31, 2026 across Wise/Xe/Bloomberg/Yahoo; supersedes the earlier ~7.2 assumption. See `js/data/rates.js`.
- Local cost model: hardware price (one-time, amortized over a chosen horizon — default 3 yr) + electricity only *(per user)*.

### 3.6 Sources
- [S1] Apple MacBook Air tech specs (M5, 153 GB/s): https://www.apple.com/macbook-air/specs/
- [S2] M4 Pro memory bandwidth 273 GB/s — confirmed (R3, see `hardware.js` [H2])
- [S3] NVIDIA DGX Spark: https://www.nvidia.com/en-us/products/workstations/dgx-spark
- [S4] TechPowerUp RX 9070 XT (644.6 GB/s): https://www.techpowerup.com/gpu-specs/radeon-rx-9070-xt.c4229
- [S5] Corsair RX 9070/XT power guide (304 W TDP)
- [S6] Artificial Analysis GPT-5 benchmarks: https://artificialanalysis.ai
- [S7] DeepSeek V4 preview news: https://api-docs.deepseek.com/news/news260424/
- [S8] r/LocalLLaMA on V4 1M context practicality (context only, not a citation)
- [S9] Anthropic Claude Opus 5 announcement: https://www.anthropic.com/news/claude-opus-5
- [S10] Shenzhen residential rate ≈0.6629 RMB/kWh tier-1: https://www.eyeshenzhen.com (verify current schedule at build)
- [S11] CEIC/NDRC Shenzhen industrial 35 kV+ = 0.610 RMB/kWh Jul 2026

---

## 4. State Model & App Shell

**Shared reactive store** (`state/store.js`): single source of truth; every tab subscribes.

```
config: { platform | gpu:{type,count} | ram:{tier,capacity} | cpu, modelStop, quant,
          contextWindow, promptSplit, concurrency }
derived (recomputed on any change): fitsState, decodeTps, ttftMs, kvCacheGB,
          maxModelFits, watts, costPerMOutRMB/USD, prefillTflopsEff
ui: { activeTab, theme, visitedTabs[], simRunning, simProgress }
```

- Persist `config` + `visitedTabs` to `localStorage`; restore on load.
- Tab router: hash-based (`#/lab`) so tabs are linkable/bookmarkable without leaving the page.
- **Exploration tracker:** per-tab "new" dots until first visit; Home shows a progress ring (n/4); all-4 → one-time celebration state (CSS sparkle burst, no assets) + persistent "Explorer" badge in nav.

---

## 5. Performance Engine Spec (`engine/perf.js`)

All formulas documented on-page as an expandable "How we estimate this" panel with assumptions labeled.

**Memory accounting**
- `weightsGB = params × bytesPerParam(quant)` (table §3.3)
- `kvCacheGB = 2 × layers × kvHeads × headDim × ctxTokens × dtypeBytes / 1e9` (dtype follows quant; FP16 KV default, note Q8_0 option later)
- Usable memory: discrete GPU → VRAM per card; Apple/DGX unified pool minus **⅛** OS carve-out (P2-calibrated from the initial ~⅓ guess — macOS in practice lets one inference workload use most of the unified pool; labeled assumption, `ENGINE_CONSTANTS.unifiedMemoryOsCarveout`).

**Fits check (drives everything)**
1. `weights + kv ≤ VRAM` → **GPU-resident** (fast path).
2. Else split layers across GPU/CPU at the boundary → **offload mode**; if `weights + kv > VRAM + RAM` → **doesn't fit** state (UI explains what to change: smaller model / lower quant / shorter context).

**Decode speed (bandwidth-bound)**
- Per-layer serial model: `t_token = Σ_layers (layerBytes / BW_of_resident_device)`; `tps = 1/t_token × η`
- **`layerBytes` includes the layer's weight bytes *plus* its KV-cache read at the current context length** — attention must stream each request's full K/V history for every new token, and that is bandwidth-bound traffic. P2 calibration note: with weights-only bytes no constant set can satisfy anchors 3+4 simultaneously; counting KV reads lets one global η pass all five (same formula shape as above).
- Concurrency B *(labeled assumption)*: weights are read once per step (shared across the batch), but each request's KV history is re-read every token → `t_step = [Σ_gpu w_l/BW_g + B·Σ_all kv_l/BW_of_layer] / η`; total throughput = B × per-request (sub-linear when KV dominates); fits check uses KV ×B.
- `η_decode` **calibrated in P2 to 0.85** (initial guess was 0.65–0.80; higher because KV traffic is now explicit instead of hidden inside η) — one global constant passes all five §5.4 anchors (`ENGINE_CONSTANTS.etaDecode`).
- Multi-GPU scaling factors on bandwidth: 2× → **1.75**, 4× → **3.2** (NVLink/PCIe overhead; labeled assumption)
- CPU-resident layers use RAM tier bandwidth (51.2 / 96 GB/s); this is why offload visibly punishes speed — the teaching moment.

**Prefill / TTFT (compute-bound)**
- `ttft_s = promptTokens × 2 × params / (η_prefill × TFLOPS_eff) + 0.1s overhead`
- `TFLOPS_eff = Σ_gpu TFLOPS × η_prefill`, `η_prefill` **set to 0.6** (midpoint of the initial guess 0.5–0.7; sanity-checked vs community prompt-eval rates — no hard anchor); CPU path uses per-CPU `prefillTflopsEff` directly (already efficiency-adjusted, `hardware.js`)
- All-in-one prefill compute = **labeled estimates** in `ENGINE_CONSTANTS.unifiedPrefillTflopsEstimate` (Air M5 12 · M4 Pro 24 · DGX Spark 120 TFLOPS-equivalent) — Apple/GB10 don't publish comparable dense figures

**Power & cost (`engine/cost.js`)**
- `watts_load = Σ GPU_TDP×0.9 + systemBase(platform)` (systemBase: Macs ~30–60 W, PC rigs ~80–120 W — assumptions)
- `kWh_per_M_out = watts × (1e6 / tps) / 3.6e6` → `costRMB = kWh × 0.65`; show RMB + USD
- Amortized hardware: `price / (3×365×24h)` blended into $/M for the comparison tab *(hardware prices researched at build, cited)*

**Sanity anchors (Phase 2 acceptance — engine output must land in these ranges):**
| Setup | Model | Expected decode |
|---|---|---|
| RTX 3090 ×1 | 8B Q4_K_M (~4.5 GB) | **140–200 tok/s** |
| M4 Pro 48GB | 8B Q4_K_M | **40–60 tok/s** |
| M4 Pro 48GB | 70B Q4_K_M (~40 GB) | **5–9 tok/s** |
| MacBook Air M5 16GB | 4B Q4_K_M (~2.6 GB) | **25–45 tok/s** |
| RTX 3060 ×1 (offload, DDR4-3200) | 70B Q4_K_M | **< 3 tok/s** (teaches offload pain) |

**P2 result (2026-09-02, `test/engine.test.mjs`):** A1 → **145.3** · A2 → **42.4** · A3 → **5.63** · A4 → **38.2** · A5 → **1.40 t/s** — all in range with one global η_decode = 0.85; 62/62 checks green.

If an anchor misses its range by >25%, adjust `η` constants — never the formula shape.

---

## 6. Tab Specifications

### Tab 1 — Home / Intro
- **Layout:** full-viewport hero ("AI, running on *your* hardware") → scroll story in 4–5 beats: what a model is (weights = billions of numbers) → why it needs memory & bandwidth → the local vs cloud fork → "explore" CTA grid linking tabs.
- **Motion:** Pi.dev-style beat-by-beat reveals (§8); hero has an ambient CSS gradient-mesh + floating glass panels; token-glyph stream animation (pure CSS/SVG).
- **Components:** exploration progress ring, tab cards with "new" dots, theme toggle in nav.
- **Acceptance:** a first-time visitor reaches Tab 3 within ~60 s of scrolling; all beats reverse cleanly on scroll-up.

### Tab 2 — How It Works (pipeline)
- **Layout:** horizontal pipeline diagram (5 stages), each stage an expandable glass card:
  1. **Tokenization** — live example: type a sentence → watch it split into token chips with IDs.
  2. **Model load** — weights "pouring" from disk into the memory bar of *the current config*; shows GB used vs available.
  3. **Prefill vs decode** — two-speed animation: prompt processed in one fast pass (compute-bound), then tokens drip out one-by-one at the estimated tok/s (bandwidth-bound). This contrast is the core lesson.
  4. **KV cache growth** — a bar that fills as context grows; live GB readout from §5 formulas for current model/context.
  5. **Sampling** — temperature/top-p sliders with a "next-token probability" bar chart that visibly reshapes (hand-rolled SVG).
- **Binding:** all numbers reflect the shared store's current config; changing hardware in Tab 3 changes this tab live.
- **Acceptance:** each stage shows at least one real number from the engine; tokenization demo works with arbitrary input.

### Tab 3 — Hardware Lab (centerpiece)
- **Layout (desktop ≥1280px):** left rail = controls; center = simulation canvas; right rail = printouts.
- **Left rail (controls, top→bottom):**
  - Platform group: All-in-one (Air M5 / MBP M4 Pro / DGX Spark) *or* GPU rig (GPU picker × count 1/2/4 + RAM tier/capacity + CPU picker).
  - Model slider (§3.2 stops, with anchor-model name shown per stop).
  - Quantization segmented control + inline explainer card for the selected level.
  - Toggles: context window (8K/32K/128K), prompt-vs-generation split (short/long/balanced presets), concurrency (1 / 4 / 16 requests).
- **Center (simulation):** "Run Inference" button → animated pass: load bar → prefill flash → token stream at estimated rate across a canvas/SVG "conveyor"; live tokens/sec gauge; progress to N-token target. Concurrency >1 shows queueing and throughput vs per-request speed divergence *(teaching moment)*.
- **Right rail (printouts, always visible):** max model size that fits · time-to-first-token · power draw (W) · memory fill bar (VRAM/RAM split) · $/M output tokens (RMB+USD). Values animate on change; "doesn't fit" state shows a friendly diagnosis + suggested fixes.
- **Acceptance:** every control changes ≥1 printout within 100 ms; simulation speed matches engine ±5%; offload scenario visibly slows the stream and explains why in one sentence of UI copy.

### Tab 4 — Local vs Cloud
- **Layout:** top = animated "race" (same 256-token generation task: local config vs GPT-5 family vs DeepSeek V4 vs Claude Opus 5, progress bars racing at their respective tok/s with latency offsets); below = full comparison table; bottom = cost panel.
- **Table dimensions:** speed & TTFT · cost per M tokens (local amortized+electricity vs API pricing) · subscription alternative ($20/mo ChatGPT Plus equivalent — verify current plan names/pricing at build) · privacy/on-device data · offline capability · quality benchmarks (cite [S6][S9]) · context window (DeepSeek V4 1M [S7] vs local KV-cache-limited reality) · **agentic coding** (narrative + cited results) · **trainability/customization** — the local advantage: fine-tune/LoRA on your data, no API dependency; cloud = none.
- **Cost panel:** interactive "your usage" estimator (messages/day × tokens/message) → monthly RMB for local vs each cloud tier at Shenzhen rates [S10][S11].
- **Acceptance:** race finishes in ≤20 s real time (time-compressed, labeled); every authoritative number has a footnote; cost panel computes correctly against §5.

---

## 7. Design System (`css/tokens.css`)

**Glassmorphism recipe (not cookie-cutter):**
- Background: layered CSS radial-gradient mesh (3–4 soft color blobs, slow drift animation ≤60 s loop) — different hue sets per theme.
- Panels: `background: rgba(255,255,255,.07)` (dark) / `rgba(255,255,255,.55)` (light); `backdrop-filter: blur(18px) saturate(140%)`; 1px border `rgba(255,255,255,.14)`; radius 16–20 px; layered soft shadows. Cap simultaneous blurred layers ≤ ~8 for performance on mid-range GPUs.
- Accent: single electric accent (indigo→cyan gradient) for interactive states + data highlights; semantic green/amber/red for fits/warn/fail.

**Tokens:** spacing scale 4/8/12/16/24/32/48; type scale 13/15/17/20/24/32/48 (system stack: SF Pro / Segoe UI / Noto Sans CJK fallback); motion durations 150/250/400/600 ms; easing `cubic-bezier(.22,1,.36,1)` for reveals, `ease-in-out` for toggles.

**Themes:** light + dark via `[data-theme]` on `<html>`; default = `prefers-color-scheme`; manual toggle persisted. All colors tokenized — no hardcodes in tab CSS.

---

## 8. Motion & Scroll Choreography (`motion/scroll.js`)

- **Reversible reveals:** IntersectionObserver with `rootMargin: -10% 0px`; elements enter from below → add `.in-view` (translateY(24–48px)→0, opacity 0→1, stagger via `--i × 60 ms`); leaving upward past threshold → class removed (clean reverse on scroll-up). No library.
- **Micro-interactions:** control changes pulse the affected printout; tab switches crossfade + slight parallax of background mesh; "Run Inference" button has a charging→running state machine.
- `prefers-reduced-motion`: reveals become instant opacity-only; ambient drift disabled. (Courtesy, not required.)

---

## 9. Touch & Input Considerations (desktop-first)

- All hit targets ≥ 40×40 px; sliders draggable by touch; no hover-only information (tooltips get tap/focus fallbacks).
- Keyboard: tab order logical per rail; all controls focusable with visible focus rings.
- No accessibility program beyond the above *(per user)*, but semantic HTML + labels kept clean for future i18n.

---

## 10. Research Checklist (Phase 1 deliverables)

| # | Task | Source target | Status (P1) |
|---|---|---|---|
| R1 | V100 PCIe HBM2 bandwidth confirm (900 GB/s?) + TDP | NVIDIA datasheet | ✅ 900 GB/s HBM2 + 250 W confirmed (`hardware.js` [H4]) |
| R2 | RX 9070 XT / RTX 5070 Ti / 5090 / RTX 6000 Ada TFLOPS for prefill model | TechPowerUp / vendor | ✅ FP32 dense: **48.7 / 43.9 / 104.8 / 91.1** (RX 9070 XT corrected 2026-09-01 — see log below) |
| R3 | M4 Pro bandwidth confirm (273 GB/s) + Mac load-power estimates | Apple specs, reviews | ✅ 273 GB/s confirmed [H2][H3] · ⚠️ Mac load power = labeled assumption (Air ~30 W; MBP ~90 W midpoint of 65–120) |
| R4 | Anchor-model configs (layers/KV heads/head dim) for §3.2 stops | HF config.json per anchor | ✅ all anchors verified (`models.js` [M1]–[M6]; Gemma 3 uses explicit `head_dim`) |
| R5 | GPT-5 family: current top model, tok/s, $/M in/out, context, subscription plan names/pricing | OpenAI + artificialanalysis.ai [S6] | ✅ **GPT-5.6 Sol**: list $5/$30 (promo $4/$20 through Nov 21, 2026), ~1.05M ctx, 82.8 t/s max-effort; ChatGPT Plus $20/mo (`cloud.js`) |
| R6 | DeepSeek V4 pricing + speed claims | api-docs.deepseek.com [S7] | ✅ **V4 Pro** peak $1.32/$3.96 (off-peak half), 54.1 t/s, TTFT 1.65 s; V4 Flash value tier (`cloud.js`) |
| R7 | Claude Opus 5 context window confirm (1M?) + benchmark/agentic-coding results | anthropic.com [S9] | ✅ 1M ctx default on all providers, $5/$25 (Fast mode $10/$50), ~53 t/s, II 63 #1/187 (`cloud.js`) |
| R8 | Shenzhen residential TOU schedule current values; USD/CNY rate | CEG/NDRC, PBOC [S10][S11] | ✅ tier-1 ≈0.66 + industrial 0.610 both current → default **0.65** (labeled midpoint) · ⚠️ FX now **6.72** CNY/USD (Wise, Aug 31 2026) — supersedes §3.5's ~7.2 |
| R9 | Hardware street prices (RMB) for amortization: each GPU, Macs, DGX Spark, RAM kits | JD/Taobao listings or vendor pages | ✅ **Owner-provided current Taobao listings, 2026-09-02** — all `priceRMB` values in `hardware.js`, now `priceBasis:'taobao-listing'` [H7]; UI footnotes them as a date-stamped listing snapshot (not live prices) |
| R10 | CPU FLOPs + memory channels for the 4 approved CPUs (+2 proposed) | AMD/Intel ARK | ⚠️ `prefillTflopsEff` = community-behavior estimates, labeled per row (`hardware.js`) — kept as labeled estimates in P2 (no §5.4 anchor constrains the CPU prefill path; sanity-checked vs community prompt-eval rates) |

**Verification log (2026-09-01):** full re-check of all five data files against primary sources. **One real error found and fixed:** RX 9070 XT `tflopsFp32Dense` in `hardware.js` corrected **132.7 → 48.7 TFLOPS** (earlier derivation "54 CUs × 512 ALU" was wrong; actual is 64 CUs / 4096 shaders, boost 2970 MHz — AMD official + TechPowerUp both ≈48.7); `tdpW` also updated 300 → **304 W** [H8][H9]. Everything else confirmed as written: V100 bandwidth/TDP (R1), M5/M4 Pro/DGX Spark bandwidths (R3), all anchor configs incl. Gemma 3's explicit `head_dim` (R4), cloud pricing/speeds/contexts (R5–R7), Shenzhen rates + FX (R8).

**Verification log (2026-09-02):** owner updated R9 street prices to current Taobao listings and signed off P1. New `priceRMB` values in `hardware.js`: V100 ¥1,000 · RTX 3060 ¥2,000 · RTX 3090 ¥8,000 · RX 9070 XT ¥5,400 · RTX 5070 Ti ¥8,000 · RTX 5090 ¥29,000 · RTX 6000 Ada ¥78,400 · MacBook Air M5 ¥8,500 · MBP M4 Pro ¥18,000 · DGX Spark ¥38,900. All `priceBasis` flipped `'estimate' → 'taobao-listing'`; [H7] relabeled as owner-provided listing snapshot (2026-09-02). No other data values changed.

**Verification log (P2, 2026-09-02):** engine acceptance run. `test/engine.test.mjs` (plain Node ESM, no framework) — **62/62 checks green**. All five §5.4 anchors in range with a single global η_decode = 0.85: A1 RTX 3090+8B → 145.3 t/s [140–200] · A2 M4 Pro+8B → 42.4 [40–60] · A3 M4 Pro+70B → 5.63 [5–9], fits on the unified pool (carve-out calibrated to ⅛) · A4 Air M5+4B → 38.2 [25–45] · A5 RTX 3060 offload+70B → 1.40 [<3], layer split 23 GPU / 57 CPU. Decode `layerBytes` now includes each layer's KV-cache read (same formula shape; see §5 note). Tests also caught and fixed one store bug: a rejected `setConfig` no longer mutates state before validation throws.

**Verification log (P2 sign-off, 2026-09-02):** owner closed both open flags — confirmed all prices correct (incl. unchanged RTX 3060 ¥2,000 and MBP M4 Pro ¥18,000) and approved the KV-inclusive `layerBytes` decode semantics as documented in §5. **P2 gate: signed off.**

**Verification log (P3, 2026-09-02):** design system built — `css/tokens.css` (§7 exact glass recipe + per-theme accent/semantic/mesh tokens; light default, dark under `[data-theme="dark"]`, no-JS `prefers-color-scheme` fallback), `css/base.css` (reset, ambient mesh, glass panels/nav/buttons/run-state machine, radio segmented control, slider fill, switch, cards+dots+badge, progress ring, chips, memory-bar states, printout pulse, conic gauge, comparison table, estimates panel, footnotes, CSS-only celebration, reversible scroll reveals gated on `html.js`, full reduced-motion block), `js/theme.js` (hash > stored > system precedence; pure-system default not persisted), `js/motion/scroll.js` (IO rootMargin `-10% 0px`, reversible `.in-view`, `--i` stagger, pulse + slider-fill helpers), `js/app.js` (P3 bootstrap: theme + reveals + hash router). **Tests:** `test/ui.test.mjs` 16/16 green; all JS pass `node --check`. **Token audit:** every `var()` resolves to a defined token; no hardcoded theme colors in component CSS. **Pending:** owner visual sign-off of light+dark on all components + reveal reversibility (the §11 P3 gate) — opened in-app browser for review.

**Verification log (P3 owner check-in, 2026-09-02):** owner confirmed the light/dark theme swap works cleanly. Owner then reported "none of the links work" — investigated and **verified as expected at P3**, two distinct reasons: (1) `dev/design-system.html` is a single-page component showcase with **no tab navigation by design** (its only link is the brand mark); (2) `index.html`'s hash router works — clicking a tab changes the hash → `hashchange` → `router.show(tab)` toggles `.is-active` on exactly one panel + its nav link — but all four panels are intentional "Phase N lands here" placeholders until P4–P7, so navigation looks inert. **Proof:** 5 new router tests added to `test/ui.test.mjs` (`tabFromHash` parsing incl. rejecting theme hashes like `#dark`; default panel on load; `show()` activates exactly one panel + link; no stacking across switches; safe no-op when a page has no `.tab-panel`s so the harness keeps `#light/#dark`) → suite now **21/21 green**; live deep-link check of `index.html#/lab` in the app browser shows the Lab placeholder active. The theme toggle — wired by the same bootstrap that runs the router — working end-to-end corroborates the JS path.

**Verification log (P3 sign-off, 2026-09-02):** owner reviewed the acceptance harness (`dev/design-system.html`) in light + dark: "Looks fantastic" — all components pass muster; scroll reveals reversible. **P3 gate: signed off.** (Owner initially reviewed `index.html`, which correctly shows only placeholder panels at P3 — the sign-off page is the harness.) Proceeding to Phase 4 — Home tab.

**Verification log (P4, 2026-09-02):** Home tab built per §6 Tab 1 + §4 — hero (eyebrow/H1/sub/CTA pair incl. "Skip to the Lab" ghost link), 3 story beats ("A model is billions of numbers", Qwen3-4B ≈ 4.2×10⁹ · "Speed is set by memory bandwidth", RTX 3090 936 GB/s vs DDR5-6000 96 GB/s per §3.1 · "The fork: local or cloud?" at ¥0.65/kWh), explore grid (progress ring + 3 tab cards with unvisited dots). Exploration tracker in `js/app.js`: `TAB_TO_STORE` mapping (`how`↔`pipeline`), nav dots + card dots, ring n/4 with aria-label, Explorer badge, one-time spark burst gated on separate localStorage key `v100-celebrated`. New files: `css/tabs.css` (hero layout, floating glass panels, pure-CSS token stream, reduced-motion block), `js/tabs/home.js` (CTA smooth-scroll). **Tests:** `test/ui.test.mjs` **31/31 green** (+10 tracker/home checks); `test/engine.test.mjs` 62/62; all JS pass `node --check`.

**Verification log (P4 sign-off, 2026-09-02):** owner reviewed the Home tab in light + dark in the app browser: "this site is looking ridiculously good." **P4 gate: signed off.** The seven agent-decided P4 items (TAB_TO_STORE mapping, celebration key, button CTA, token stream, float panels, beat copy, deep-link counts as visit) are approved with the phase.

**Verification log (owner-reported JSON error — closed, 2026-09-02):** owner supplied the exact message: **"Unterminated string in JSON at position 347 (line 1 column 348)"**, seen **in harness stream/output** (not on any v100 page; no file reference). Consistent with the session-10 audit — v100 has no code path that throws an uncaught JSON error (`js/state/store.js` is the only runtime JSON user, both parse and stringify wrapped in try/catch with a green test covering the corrupt-state fallback; zero `fetch()` calls; no `.json` assets). **Closed as external to v100 — no action needed.**

**Verification log (P6, 2026-09-03→04):** Hardware Lab built across four milestones. **M1 (2026-09-03, commit `e67fdde`):** full control panel — mode/platform/GPU/count/RAM tier+capacity/CPU/quant/context/split/concurrency groups, model slider with anchor readout, store-bound re-render; capacity chips clamped per RAM tier. **M2 (2026-09-03, commit `50f4bbf`):** printouts rail (tok/s · TTFT · watts · ¥/M-out · max-fit) with §8 pulse-on-change; VRAM/RAM memory fill bar + fit chip + doesn’t-fit diagnosis from engine suggestions; quantization explainer card. **M3 (2026-09-03, commit `3e018a5`):** Run Inference simulation — virtual timeline load → prefill beat → decode at the engine’s exact per-request rate; ≤8 s real-time budget with labeled ×N compression; token conveyor + gauge (full ≥200 tok/s) + progress; reduced-motion instant path; click mid-run restarts, store change cancels. **M4 (2026-09-04):** teaching moments — concurrency: “Total throughput (all requests)” row + TTFT ×B queueing note appear only at B>1 (per-request vs total divergence; prefills serialized); offload: one-sentence “Why it’s slow” under the memory caption naming real bandwidths (e.g. DDR4-3200 51.2 GB/s vs RTX 3060 360 GB/s) + layer split; Done line names both rates at B>1. **Zero engine changes** — M4 only surfaces P2-signed-off values (`decodeTpsTotal`, `ttftMs`/`ttftMsBase`). **Tests:** `test/ui.test.mjs` **56/56 green** (was 52; +4 M4 blocks); `test/engine.test.mjs` 62/62 unchanged; all JS pass `node --check`. Awaiting owner light+dark review → sign-off.

**Verification log (P6 bug-fix pass, 2026-09-04, commit `f21797b`):** owner reported "nothing happens when I use any links on page" — this time it was **real**, not the P3-style false alarm logged above. Two genuine defects found by loading the served page in a browser and reading the console; both fixed, plus one markup typo.

1. **`js/app.js` — fatal TDZ, killed all page JS.** `const defaultDoc` / `defaultHash` were declared on the *last two lines* of the module, but the auto-bootstrap `initApp()` at the file's end reaches them through `initRouter({ doc = defaultDoc() })` default parameters. `const` is not hoisted → `Uncaught ReferenceError: Cannot access 'defaultDoc' before initialization` at module evaluation, so the router, tracker, Home and Lab never wired up. **Fix:** both declarations moved directly under the imports. **Why no test caught it:** `test/ui.test.mjs` dependency-injects `doc` into every module and never calls `initApp()` — the bootstrap path is the one code path with zero coverage. All 56 UI checks passed against a completely dead page.

2. **`js/engine/perf.js` — TFLOPS/FLOPs unit error in prefill.** `flopsPerToken` is raw FLOPs (`2 × paramsB × 1e9`) but `tflopsFp32Dense` / `prefillTflopsEff` / `unifiedPrefillTflopsEstimate` are **tera**FLOPS; the divisors lacked `× 1e12`, inflating every TTFT by exactly 1e12. Default rig printed `1534082397003.85 s`. **Fix:** the three effective-throughput locals now convert to FLOPs at the point of derivation and were renamed `flopsEff` / `gpuFlopsEff` / `cpuFlopsEff` so the names match their units (the bug *was* a unit confusion). Line 190's `prefillTflopsEff` divides by `1e12` on the assumption `ttftS` is correct, so it became right for free — deliberately left alone. **This respects the §5.4 rule:** formula *shape* is unchanged; only a missing unit conversion was restored. Decode-path anchors are untouched and `test/engine.test.mjs` stays **62/62 green** — TTFT was never anchored, which is precisely why the error survived. Corrected default-rig TTFT: 2048 × 1.6e10 ÷ (35.6 × 0.6 × 1e12) + 0.1 = **1.63 s**.

3. **`index.html` — literal `\n` rendering in the header.** A stray two-character `\n` escape sat between spark spans #5 and #6 inside `#explorer-celebrate`, printing as visible text next to the theme toggle. Replaced with a real newline; no other occurrence anywhere in the tree.

**Live verification (served over HTTP, not `file://`):** console clean · `#/lab` routes and paints · printouts read `145.3 tok/s · 1.63 s · 415 W · ¥0.516 · $0.077 · 80B` · controls two-way live (128K context → 36.9 tok/s, caption `4.4 GB weights + 17.2 GB KV of 24 GB VRAM`) · Run Inference completes 256/256 tokens, 256 chips, gauge 36.9, `×1.0 time-compressed`. Both suites green: **56/56 UI + 62/62 engine**.

**Verification log (test gaps from the bug-fix pass — CLOSED, 2026-09-05):** both gaps the bug-fix pass left open are now covered, and each new test was **regression-proven** by reintroducing the original defect and watching it fail.

1. **Bootstrap coverage.** `test/ui.test.mjs` gained an `app.js — initApp() bootstrap` section: `makeAppDoc()` composes the existing `makeLabDoc()` / `makePipeDoc()` / `makeTrackerDoc()` fixtures into one document, installs browser globals (`document`, `window`, `location` at the deep link `#/lab`, `addEventListener`, `localStorage`), and then imports a **fresh copy of `app.js` via a cache-busting query string** so the module's own auto-bootstrap runs. That last detail is the whole point: calling the already-evaluated `initApp()` directly **cannot** reproduce a TDZ, because the `const` bindings are initialized by the time any test could call it — the fault only exists *during module evaluation*. Verified: with the declarations moved back to the foot of `app.js`, a direct `initApp()` call still passed 79/79, while the fresh-import version fails. Assertions: exactly one active panel and it is the deep-linked one, tracker ring 1/4, theme toggle wired, Lab printouts painted, Pipeline Stage 3 painted, one `hashchange` listener — then the handler is fired for real and routes to `#/how` at 2/4.

2. **Absolute TTFT magnitude.** `test/engine.test.mjs` gained `TTFT has a plausible absolute magnitude for the default rig (0.5–5 s)` beside the existing floor check. The old assertions — `ttftMs ≈ ttftMsBase × B` (a ratio) and `ttftMsBase > 100` (a floor) — are both satisfied by a value 1e12 too large, which is how the unit bug survived four milestones. Verified by deleting one `× 1e12` in `perf.js`: the floor check still passes, the new check fails with `got 1534082397003845.5 ms`.

**Zero source changes** — tests and comments only (plus one stale `index.html` comment corrected: the Tab 2 header still described Stages 3–5 as placeholders after M3 shipped). Suites: `test/ui.test.mjs` **79/79 green** (was 76) · `test/engine.test.mjs` **63/63 green** (was 62).

**Verification log (scroll reveals made ONE-WAY, 2026-09-05):** owner reported that animations *"can loop/bounce depending where the user stops scrolling"*, against the reference feel of pi.dev where elements fade/move into place and then stay. **Cause:** reveals were deliberately *reversible* — `js/motion/scroll.js` removed `.in-view` whenever an element left the IntersectionObserver band (`rootMargin: -10% 0px`). Park the scroll position at a band edge and the browser emits a burst of alternating intersect/unintersect events; each one replays the element's 400 ms opacity+translateY transition. **Fix:** the observer now adds `.in-view` on first entry and immediately `unobserve()`s that element, so no later event can reach it — one line of behaviour change, no CSS animation involved (reveals are transitions, `animation-name: none`).

**This supersedes a P3 sign-off criterion.** "Reveals reversible" was part of the P3 acceptance gate (§11 P3 row, signed off 2026-09-02); the owner reversed that decision on 2026-09-05 after seeing it in use. The §11 row is annotated rather than rewritten, so the original sign-off record stands.

**Tests:** the `motion/scroll.js` block in `test/ui.test.mjs` was rewritten — the `IOStub` now models `unobserve()` faithfully (a `live` set; a real observer stops delivering entries for unobserved targets, so the test drives it through a `scroll()` helper that filters them out). New checks: a revealed element is unobserved immediately · leaving and re-entering the band never re-animates · **a burst of 8 alternating intersection events at the band edge — the exact reported symptom — leaves the reveal untouched** · elements below the fold stay hidden and stay watched. `test/ui.test.mjs` **81/81 green** (was 79); `test/engine.test.mjs` 63/63 unchanged.

**Not changed (deliberate, flagged for the owner):** eight *ambient* infinite animations remain, confirmed live in the browser — four `.mesh .blob` drifts (44–60 s), three `.hero-float` bobs (9–13 s), and the `.token-track` marquee (36 s). These are continuous background motion, not scroll-triggered entrances, and none of them replay an element's arrival; all are already killed under `prefers-reduced-motion`. They are the one remaining source of looping motion on the page if the owner wants them gone too.

**Verification limit — read this before trusting a browser check here:** the fix could NOT be confirmed by scrolling in the agent's browser pane. The pane reports `document.visibilityState: "hidden"`, and a hidden page never delivers IntersectionObserver callbacks — with `innerHeight: 0` before an explicit resize, nothing intersects at all. Instrumenting `.in-view` with a MutationObserver and scrolling the full page produced **zero** class changes and left every reveal at `opacity: 0`. That is the same class of harness artifact already logged for `requestAnimationFrame`, **not** a dead page (console clean, `html.js` set, correct panel active). Owner-side confirmation still wanted, in a real browser window.

**Verification log (P9 copy rewrite begins, 2026-09-05):** owner's brief: the site is written for high school students and people with no local AI experience, and the current copy fails them. Three faults named: a TED-talk cadence built on the em dash, technical terms used without ever being defined (`KV cache` with no account of what K, V or the cache are), and headers written to be catchy rather than informative. **New governing document `style-guide.md`** codifies the audience, the em dash ban with replacements, cadence rules, textbook header rules, and the term-introduction rule, with before-and-after examples drawn from the live page.

**Built:** `js/data/glossary.js` (34 terms, each with a short hover definition and a full page definition plus cross references) and `js/tabs/glossary.js`, feeding two surfaces from one source so they cannot disagree: the glossary page, and hover cards on any word marked `<a class="gloss" data-term="...">`. Cards are wired by delegated document listeners, so terms rendered later by other tabs work without re-initialising. Clicking a term navigates to its full entry, which is the owner's teaching intent: the reader learns where the definitions live, and that hovering was the faster route. Keyboard focus shows the same card and Escape dismisses it; `aria-describedby` is set for screen readers.

**Two owner decisions.** (1) The glossary is a router tab but **not** a tracked one: `'glossary'` joins `TABS` in `js/app.js` and is deliberately absent from `TAB_IDS`, so the Explorer badge still counts four tabs and **the signed-off `js/state/store.js` needed no change**. (2) The memory-bandwidth explanation moved off Home into How It Works, rewritten and placed after the pipeline stages where the reader has already met decode. **Home now reads:** what an AI model actually is, you have probably used a cloud model, defining local AI.

**One real defect found and fixed:** `initRouter` rewrote the hash to `#/<tab>` on load whenever it differed, which destroyed `#/glossary/kv-cache` before the glossary module could read the term. The rewrite now skips a hash already prefixed `#/<tab>/`. Regression test added.

**Mechanical enforcement:** the em dash ban is guarded in `test/ui.test.mjs` against reader-facing text only (HTML comments stripped). Rewritten panels (`home`, `glossary`) must hold at zero; unrewritten panels carry a budget that may only go down (`how` ≤ 15, `lab` ≤ 13). Every `data-term` must resolve to a real entry, and every marked term must link to its own definition. **Tests:** `test/ui.test.mjs` **102/102 green** (was 81); `test/engine.test.mjs` 63/63 unchanged. Live check over HTTP: console clean, 34 entries render, `#/glossary/kv-cache` deep link survives load and marks its entry, hover cards fire on real marked terms.

**Verification log (P7 M1, 2026-09-05):** the Local vs Cloud race built, blueprint §6 Tab 4. The reader's machine and three cloud models each wait, then write 256 tokens at their own measured rate. **Local** figures come from the signed-off engine via the store; **cloud** figures from `js/data/cloud.js`, P1's sourced single source of truth. **A model with no measured speed is excluded rather than estimated:** DeepSeek V4 Flash has `outputTps: null`, so it does not race, and a test pins that. Result on the default rig: local 3.4 s, DeepSeek V4 Pro 6.4 s, Claude Opus 5 7.7 s, GPT-5.6 Sol 118.8 s. **The last-placed model is the fastest writer of the three**, and finishes last purely on ~116 s of thinking; cloud.js asked that this be labelled as thinking rather than latency, and it is. Race compresses 5.9x into exactly 20.0 s, **meeting the §6 Tab 4 acceptance line and labelled on screen**. **Pacing caveat flagged for the owner:** three of four racers finish within ~1.3 real seconds, leaving ~19 s of one model thinking, so the wait counts up on screen rather than sitting frozen. **One real bug fixed:** `racerTokensAt` derived progress by flooring elapsed × rate, which left the slowest racer permanently one token short of the target and the race never showing as finished; anything past the finishing time now returns the target exactly. **Tests:** `test/ui.test.mjs` **125/125 green** (was 117); `test/engine.test.mjs` 63/63 unchanged. Live verification drove the real DOM with an injected clock, because `requestAnimationFrame` does not fire in the agent's browser pane. **New harness gotcha logged:** `python -m http.server` served a cached `js/app.js`, so a correctly wired feature rendered nothing with a clean console; a cache-busting query string on `index.html` resolved it.

**Verification log (P5 M5, 2026-09-05, P5 COMPLETE):** Step 5 (Sampling) built, blueprint §6 Tab 2.5. Temperature (0 to 2) and top-p (0.05 to 1) sliders drive a live bar chart of ten candidate next tokens. Temperature 1 is a no-op, below 1 sharpens, above 1 flattens, 0 is greedy; top-p keeps the smallest set reaching the threshold, renormalises the survivors, and dims the discarded rows rather than removing them so the reader sees the cut. **Two things flagged for sign-off.** (1) **Step 5 shows no engine number, and cannot:** the engine models memory, bandwidth, time and cost, not predictions, so the candidate list is illustrative and is labelled as such in bold in the UI copy. This is a knowing exemption from the §11 P5 acceptance line "each stage shows at least one real number from the engine". The *maths* is genuine, so the reshaping a reader sees is accurate. (2) **Agent decision:** §6 Tab 2.5 specifies a hand-rolled SVG chart; it is built from the existing `.bw` bar primitives instead, which meets the acceptance criterion (a chart that visibly reshapes), keeps the page consistent, and cost one CSS rule rather than a new chart system. Temperature and top-p are view state, not config, since nothing in the engine reads them. **Tests:** `test/ui.test.mjs` **117/117 green** (was 108), including that every transform stays normalised to 1; `test/engine.test.mjs` 63/63 unchanged. Live check: temperature 1.8 drops the favourite from 45% to 27.5% and widens the keep set from 7 to 8; top-p 0.7 leaves three survivors at 58.3 / 25.0 / 16.7, which is 42 / 18 / 12 renormalised; console clean. **Tab 2 now has no placeholder steps.**

**Verification log (P5 M4, 2026-09-05):** Step 4 (KV cache growth) built, blueprint §6 Tab 2.4. A slider drags the conversation from empty to the full context window; the card shows memory used, a bar filling toward the limit, and a comparison against the size of the model. **The formula is not re-derived:** §5 is linear in token count, so `kvGrowthView` takes the engine's own `perf.kvCacheGB` and divides by the context window for a per-token cost, which makes drift from the engine impossible. A full 8K window reproduces `perf.kvCacheGB` exactly (asserted to 1e-12). Painted on the **same single store subscription** as steps 2 and 3, so a hardware change in the Lab moves it live. **Teaching moment:** at a 128K window the store overtakes the weights at about 33,570 tokens and reaches 17.18 GB against 4.4 GB of weights, and the bar flips to the amber warn state. Slider position is deliberately view state rather than config, so dragging cannot restart the step 3 drip. No new CSS: reuses `.membar` / `.seg` / `.slider`. **Tests:** `test/ui.test.mjs` **108/108 green** (was 102); `test/engine.test.mjs` 63/63 unchanged. Live check over HTTP: first paint at a quarter window, dragging fills to 100%, a Lab context change to 128K extends the range and keeps the position, dragging to the end shows 42.95 GB in the warn state; console clean.

**Verification log (P9 copy rewrite COMPLETE, 2026-09-05):** second pass finished every remaining surface. **How It Works** stage headings no longer lead with undefined terms ("Prefill vs decode" became "Step 3. Reading your question, then writing the answer"), and Step 4 builds keys and values from scratch before naming the KV cache. **Hardware Lab** control labels and all six results rows are plain English ("Time to first token" became "Wait before the first word"); the estimates panel keeps every formula and labeled assumption, rewritten to be followable. All runtime prose in `js/tabs/lab.js` and `js/tabs/pipeline.js` was rewritten, including both branches of the offload sentence, the concurrency queueing note, the memory captions and the finish line.

**The owner's hand edits to the first pass (`6c3d03b`) were folded back into `style-guide.md` §3 as rules 8 to 11:** use contractions, prefer the everyday word ("math" over "arithmetic"), no clever phrasing even when accurate, and say it once.

**`js/data/quantization.js` (P1 signed off) was edited, deliberately and narrowly.** The quantization explainer prose lived there and was the single worst example of the fault the owner named ("K-quant blocks with per-group scales"). Only `qualityLabel` and the three `explainer` fields on the five levels changed. **Every number and id is byte-identical**, verified by diffing the `bytesPerParam` / `kvBytesPerElement` / `id:` lines before and after; `test/engine.test.mjs` remains 63/63. This follows the P2 `perf.js` precedent: the sign-off protects the value, not the sentence beside it.

**The missing-value placeholder changed from an em dash to an ellipsis** across every formatter and every static readout, since it also reads as "still waiting".

**Enforcement is now absolute rather than a ratchet:** all five panels must contain zero em dashes, plus a whole-file check on `index.html`; no middot may sit between two lowercase words; and a new test drives the real Lab and Pipeline functions across the fast, offloading, does-not-fit and four-users states, asserting no em dash appears in anything they generate at runtime (most site prose lives in JavaScript template strings that no HTML scan can reach). 31 glossary terms are marked up in the page, each resolving to a real entry. **Tests:** `test/ui.test.mjs` **102/102 green**; `test/engine.test.mjs` **63/63 green**. Live check over HTTP on all five tabs: `document.body.innerText` contains **zero** em dashes in every hardware state tested, console clean.

**Open test gaps (not yet closed):** (a) nothing calls `initApp()` against a full-document fixture, so another bootstrap-order fault would ship silently; (b) no test pins TTFT to an absolute magnitude — the existing checks only assert `ttftMs ≈ ttftMsBase × B` and `> 100 ms`, both of which a 1e12 error satisfies.

---

## 11. Build Order & Milestones

| Phase | Deliverable | Acceptance gate |
|---|---|---|
| **P1 Research** | `js/data/*` complete with sources + "as of" dates; R1–R10 closed or footnoted as estimates | Data review sign-off (owner) |
| **P2 Engine** | `perf.js`, `cost.js`, store ✅ 2026-09-02 | All §5 sanity anchors within range; unit checks for fits/offload/KV math — **met** (`test/engine.test.mjs` 62/62) |
| **P3 Design system** | tokens/base CSS ✅ · theme switcher ✅ · glass components ✅ · scroll engine ✅ (built 2026-09-02) | Light/dark both correct on all components; reveals reversible (⚠ **reversibility SUPERSEDED 2026-09-05** — owner reported looping/bouncing at scroll stops; reveals are now one-way, see the verification log) — **SIGNED OFF by owner 2026-09-02** (harness light+dark clean, reveals reversible; "links don't work" verified as expected at P3 — router proven by tests) (`test/ui.test.mjs` 21/21 green) |
| **P4 Home tab** | hero + CTA ✅ · story beats ✅ · explore grid ✅ · exploration tracker ✅ (built 2026-09-02) | §6 acceptance; exploration tracker works across tabs — **SIGNED OFF by owner 2026-09-02** ("looking ridiculously good"; light+dark reviewed in app browser) (`test/ui.test.mjs` 31/31 green · `test/engine.test.mjs` 62/62) |
| **P5 Pipeline tab** | Tab 2 complete — ✅ M1 tokenization (real Qwen3 vocab subset) · ✅ M2 model load · ✅ M3 prefill vs decode (built 2026-09-04, commit `85780dc`, **awaiting owner review**) · ✅ M4 KV-cache growth · ✅ M5 sampling (both built 2026-09-05) — **P5 COMPLETE, awaiting owner sign-off** | Live-bound to store; tokenization demo functional |
| **P6 Hardware Lab** | Tab 3 complete (largest) ✅ M1–M4 built 2026-09-03→04 — **awaiting owner sign-off** | §6 acceptance incl. concurrency + offload teaching moment — both moments implemented; suites now `test/ui.test.mjs` 79/79 green · `test/engine.test.mjs` 63/63 green |
| **P7 Compare tab** | Tab 4 complete — ✅ M1 race (built 2026-09-05) · M2 comparison table + M3 cost panel still to build | Race ≤20 s; footnotes on all authoritative numbers; cost math verified |
| **P9 Copy rewrite for a novice audience** | **COMPLETE 2026-09-05** — `style-guide.md` ✅ · glossary data + Tab 5 + hover cards ✅ · Home ✅ · How It Works ✅ · Hardware Lab ✅ · all runtime strings in lab.js/pipeline.js/quantization.js ✅ · awaiting owner review | Every user-facing string obeys `style-guide.md`; every technical term defined at first use and marked up for the glossary; no em dash anywhere a reader can see it (guarded by a ratchet test in `test/ui.test.mjs`) |
| **P8 Polish & QA** | Motion pass, edge cases (doesn't-fit, 4×GPU+405B), performance on mid-range GPU, final walkthrough with owner | Owner sign-off; ship as static files |

Suggested order note: P3→P6 before P5/P7 if the Lab is the priority demo surface.

---

## 12. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Numbers feel "off" to enthusiasts | §5 calibration anchors; assumptions labeled on-page; footnotes [S*]; "representative estimate" disclaimer in engine panel |
| Cloud pricing/specs change before launch | All cloud data centralized in `cloud.js` with as-of dates → single-file update |
| `backdrop-filter` jank on mid-range hardware | Blur-layer cap (§7); test on RTX 3060-class machine during P8 |
| Scope creep (more tabs/features) | Strict tab boundaries; new ideas go to a `backlog.md`, not the build |
| Multi-GPU efficiency assumptions wrong | Factors isolated in one constant table (`hardware.js`) for easy recalibration |

# v100 — Project Outline: "How Local AI Works" Interactive Page

Status: **Outline** (next step → expand into a full blueprint)
Source context: [plans.md](plans.md) answers, 2026-09-01

## 1. Overview

A multi-tab, single-page interactive site for **high school students and educators**, hosted on the owner's website. It visually demonstrates how local AI models run, shows hardware as a first-class factor in performance, simulates inference with representative real numbers (plausible enough to pass muster with seasoned local-AI enthusiasts), and compares local setups against consumer cloud LLMs (ChatGPT 5+, DeepSeek V4, Claude Opus-5.0).

**Core promise:** a visitor can toggle hardware, pick a model + quantization, hit "Run Inference," watch tokens stream at a believable speed, read live metrics on the right, and then see how that setup stacks up against ChatGPT/DeepSeek/Claude — including cost in Shenzhen electricity rates.

**Tone:** modern, engaging, glassmorphism; light + dark mode; scroll-driven reveal animations (Pi.dev-style, reversible on scroll-up); rewards for exploring every tab. No image/video assets — all visuals built from CSS/SVG/canvas so nothing needs to be dropped in or built externally.

## 2. Information Architecture (tabs, no page navigation)

| # | Tab | Purpose |
|---|-----|---------|
| 1 | **Home / Intro** | Hook + "why hardware matters" narrative; scroll-driven story; CTA into the other tabs; exploration progress tracker lives here |
| 2 | **How It Works** | Animated pipeline: tokenization → model load into memory → prefill vs. decode loop → KV cache growth → sampling. Real numbers for the *current* config from Tab 3 (shared state) |
| 3 | **Hardware Lab** *(centerpiece)* | All toggles + modifiers, "Run Inference" simulation, animated tokens/sec visual, right-side printouts (max model size, TTFT, power draw) |
| 4 | **Local vs Cloud** | Side-by-side table **+** animated race/progress visualization across all comparison dimensions; cost modeled with Shenzhen energy pricing |
| — | Footer | Placeholder now; owner adds later |

Shared state: hardware config + model + quantization chosen in the Hardware Lab persists and drives numbers shown in How It Works and Local vs Cloud.

## 3. Data Model (the "real" backbone)

### 3.1 Hardware presets
- **All-in-one:** MacBook Air 16GB · MacBook Pro M4 Pro 48GB · DGX Spark 128GB
- **GPU rigs** — 1× / 2× / 4× of: V100 16GB (SXM2/PCIe — *confirm form factor*) · RTX 3060 12GB · RTX 3090 24GB · RX 9070 XT 16GB · RTX 5070 Ti 16GB · RTX 5090 32GB · RTX 6000 48GB
- **System memory:** DDR4-3200 and DDR5-6000 at 16/32/48/64/128GB; DDR5 additionally 192/256GB
- **CPU:** not user-selectable, but included as a fixed baseline tier because partial GPU offload is common — the real variable is RAM bandwidth (DDR4 ≈ 50 GB/s vs DDR5 ≈ 96 GB/s dual-channel), which visibly punishes offloaded layers. *Flagged for confirmation.*
- No custom specs; presets only.

### 3.2 Model slider
Anchored to real models: **4B, 7B (8B-class), 12B/14B, 16B, 27B, 32B, 70B** + proposed "few others": **80B and 405B**. *Confirm final list.*

### 3.3 Quantization levels (each with a plain-language explainer)
FP16/BF16 → INT8/AWQ → Q6_K → Q5_K_M → Q4_K_M (GGUF). Explainers cover: what precision means, bytes/param, size vs speed vs quality trade-off.

### 3.4 Other modifiers (toggles/options, not free inputs)
Context window length · prompt-vs-generation split · batch/concurrent-request level.

### 3.5 Cloud baselines (research + cite)
ChatGPT 5+ · DeepSeek V4 · Claude Opus-5.0 — verify current specs/pricing via web search at build time; fall back to nearest published models if a name isn't findable, and say so in footnotes.

### 3.6 Performance estimation engine (the credibility core)
Documented, defensible formulas with assumptions labeled on-page:
- **Decode speed** ≈ effective memory bandwidth ÷ bytes-per-token-reads (quantization-aware); multi-GPU scales bandwidth with an efficiency factor; CPU-offloaded layers bottleneck at RAM bandwidth.
- **Prefill / TTFT** ≈ compute-bound (TFLOPS) over prompt length.
- **KV cache** = f(layers, heads, context, dtype) — shown growing live in How It Works.
- **Fits-or-not check:** weights + KV cache vs available VRAM/RAM → drives "max model size" printout and offload behavior.
- **Power & cost:** TDP-based watts × runtime × Shenzhen electricity rate (researched, cited).

### 3.7 Research tasks (web search, cite in footnotes)
1. GPU spec sheets: bandwidth, TFLOPS, TDP for all listed GPUs + Mac/DGX memory bandwidths.
2. Cloud model specs/pricing: ChatGPT 5+, DeepSeek V4, Claude Opus-5.0 (speed claims, context windows, benchmark scores, agentic-coding results).
3. Shenzhen/Guangdong residential electricity rate (RMB/kWh) for the cost model.
4. Representative tokens/sec benchmarks per GPU class to sanity-check formula outputs against real-world reports.

## 4. Interaction Design

- **Hardware toggles** (Tab 3): segmented controls for all-in-one / GPU count × GPU type / RAM tier; instant recalculation of right-side printouts: *max model size that fits · time-to-first-token · power draw*.
- **Model slider + quantization selector** with inline explainers.
- **"Run Inference" simulation:** animated pass through the pipeline (Tab 2 can mirror it), tokens streaming at the estimated rate, live-updating metrics — tokens/sec, TTFT, total generation time, VRAM/RAM fill, $/M tokens, watts.
- **Local vs Cloud (Tab 4):** static comparison table + an animated "race" visualization; dimensions: speed & latency · cost (per-token vs subscription vs hardware+electricity) · privacy/on-device data · offline capability · quality benchmarks · context window · **agentic coding** · **trainability/customization of local models**.
- **Exploration rewards:** per-tab visited badges, a progress ring on Home ("3/4 explored"), and a small celebratory state when all tabs are seen — encouraging full exploration without gating content.

## 5. Visual & Motion System

- Fresh design (not matching the existing `local` folder), glassmorphism: translucent panels, soft borders, depth via blur/shadow; "engaging, not cookie-cutter."
- **Light + dark mode** with manual toggle (default follows system).
- **Scroll choreography:** elements slide/fade into place on scroll-down and reverse cleanly on scroll-up (IntersectionObserver-driven, Pi.dev-style); respects `prefers-reduced-motion` as a courtesy even though not required.
- All animation via CSS/SVG/canvas — zero external media assets; libraries allowed where they help (e.g., Chart.js or hand-rolled SVG for metric charts).
- No build step: static HTML/CSS/JS, hostable directly on the owner's website.

## 6. Assumptions & Open Questions (confirm before blueprint)

1. **V100 form factor:** Model v100 with FP32 15.7 TFLOPS, FP64 7.8 TFLOPS, Tensor 125 TFLOPS, and 32GB/s PCIE interconnect bandwidth.  
2. **MacBook Air chip gen** M5 Macbook Air, Macbook M4 Pro does equal MacBook Pro with M4 Pro 48GB.
3. **Final model list** I(approve adding 14B, 32B, 80B, 405B to the slider?
4. **CPU baseline:** It's totally ok to include a fixed modern-CPU tier purely for offload realism, and can be selectable if relevant. (Be sure to include Ryzen 5 3600, Ryzen 9 5800X3D, i5-13600K, i9-13900KF, and others you wish to include.)
5. **Mobile:** Build for desktop browsers, and we can customize for mobile later. Touch/tap should be considered when building interactives, but mobile layout is secondary.
6. **Language:** English is correct. A language toggle may be added for Chinese, but we won't build that version until English is complete. 
7. Cloud model names to be verified by search; acceptable fallback = nearest published equivalent with a footnote. This is acceptable.

## 7. Build Phases (for the blueprint)

1. **Research & data** — complete §3.7 searches; produce cited dataset + estimation-engine constants.
2. **Engine** — state store, performance formulas, fits-check, cost model; unit-sanity check against real benchmarks.
3. **Design system** — tokens (color/type/spacing/motion), glassmorphism components, theme switcher.
4. **Tab 1 Home** — scroll story + exploration tracker.
5. **Tab 2 How It Works** — pipeline animation bound to shared state.
6. **Tab 3 Hardware Lab** — controls, simulation loop, right-side printouts (largest phase).
7. **Tab 4 Local vs Cloud** — table + race visualization + cost panel.
8. **Polish & QA** — motion pass, enthusiast-plausibility review of numbers, edge cases (model too big for hardware), final walkthrough.

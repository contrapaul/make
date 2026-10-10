/**
 * v100 — Hardware presets (Tab 3 controls + engine inputs)
 * =========================================================
 * Blueprint §3.1. All-in-ones, GPUs (×1/2/4), RAM tiers, CPUs.
 *
 * Field semantics for the P2 engine:
 *  - `bandwidthGBs`        → decode bottleneck (bytes/sec ÷ 1e9)
 *  - `tflopsFp32Dense`     → GPU prefill peak; engine applies η_prefill per arch family
 *  - `tensorTflops`        → FP16/BF16 tensor dense where published (informational + future INT8 path)
 *  - `prefillTflopsEff`    → CPU-only: ALREADY efficiency-adjusted effective prefill throughput
 *                            (estimates from community llama.cpp behavior; calibrate in P2).
 *                            The engine uses this field directly for CPU paths (η = 1.0 on it),
 *                            keeping one formula shape with per-device constants (blueprint §12).
 *  - `tdpW`                → load power for cost.js (`watts_load = Σ GPU_TDP×0.9 + systemBase`)
 *  - `priceRMB`            → amortization input. As of 2026-09-02 all values are owner-provided
 *                            current Taobao listings (`priceBasis: 'taobao-listing'`, [H7]); the UI
 *                            must footnote them as a listing snapshot (date-stamped), not live prices.
 */

export const HARDWARE_DATA_AS_OF = '2026-09-02';

/* ------------------------------------------------------------------ */
/* All-in-one platforms (unified memory)                               */
/* ------------------------------------------------------------------ */

export const ALL_IN_ONES = [
  {
    id: 'mba-m5',
    name: 'MacBook Air M5 · 16 GB',
    kind: 'allInOne',
    unifiedMemoryGB: 16,
    bandwidthGBs: 153, // Apple spec page (M5) [H1]
    computeNote: 'Apple M5: 10-core CPU + 8/10-core GPU; memory-bandwidth-bound decode.',
    tdpW: 30, // ASSUMPTION (blueprint §3.1): sustained load ~30 W for the Air class
    priceRMB: 8_500,
    priceBasis: 'taobao-listing', // Owner-provided current Taobao listing, 2026-09-02 [H7]; Apple.cn MSRP context [H6]
    sources: ['H1', 'H6', 'H7'],
  },
  {
    id: 'mbp-m4pro-48',
    name: 'MacBook Pro M4 Pro · 48 GB',
    kind: 'allInOne',
    unifiedMemoryGB: 48,
    bandwidthGBs: 273, // Apple spec page (M4 Pro) [H2]
    computeNote: 'Apple M4 Pro: 14-core CPU + 20-core GPU.',
    tdpW: 90, // ASSUMPTION range 65–120 W under sustained load (blueprint §3.1); midpoint used
    priceRMB: 18_000,
    priceBasis: 'taobao-listing', // Owner-provided current Taobao listing, 2026-09-02 [H7]; prior-gen config, Apple.cn MSRP context [H6]
    sources: ['H2', 'H6', 'H7'],
  },
  {
    id: 'dgx-spark',
    name: 'NVIDIA DGX Spark · 128 GB',
    kind: 'allInOne',
    unifiedMemoryGB: 128, // LPDDR5x unified pool
    bandwidthGBs: 273, // NVIDIA DGX Spark spec [H3]
    computeNote: 'GB10 Grace Blackwell: up to 1 PFLOP FP4 sparse; 20-core Arm CPU.',
    tdpW: 140, // GB10 TDP per NVIDIA (PSU rated 240 W) [H3]
    priceRMB: 38_900,
    priceBasis: 'taobao-listing', // Owner-provided current Taobao listing, 2026-09-02 [H7]; US$3,999 list context [H3]
    sources: ['H3', 'H6', 'H7'],
  },
];

/* ------------------------------------------------------------------ */
/* Discrete GPUs (selectable ×1 / ×2 / ×4)                             */
/* ------------------------------------------------------------------ */

export const GPUS = [
  {
    id: 'v100-pcie-16g',
    name: 'NVIDIA V100 PCIe · 16 GB',
    vramGB: 16,
    bandwidthGBs: 900, // HBM2 — user-provided + NVIDIA datasheet [H4]
    tflopsFp32Dense: 15.7, // user-provided (plans.md Q&A #1)
    tensorTflops: 125, // FP16 Tensor Core, user-provided
    tdpW: 250, // PCIe form factor; SXM2 variant is 300 W [H4]
    pcieLinkGBs: 32, // PCIe Gen3 x16 ≈ 32 GB/s — user-provided (matters for offload paths)
    priceRMB: 1_000,
    priceBasis: 'taobao-listing', // Owner-provided current Taobao listing (used market), 2026-09-02 [H7]
    sources: ['H4', 'H7'],
  },
  {
    id: 'rtx-3060-12g',
    name: 'NVIDIA RTX 3060 · 12 GB',
    vramGB: 12,
    bandwidthGBs: 360, // GDDR6 [H5]
    tflopsFp32Dense: 12.7,
    tensorTflops: 25.6, // FP16 dense (sparse 51.2)
    tdpW: 170,
    priceRMB: 2_000,
    priceBasis: 'taobao-listing', // Owner-provided current Taobao listing (new), 2026-09-02 [H7]
    sources: ['H5', 'H7'],
  },
  {
    id: 'rtx-3090-24g',
    name: 'NVIDIA RTX 3090 · 24 GB',
    vramGB: 24,
    bandwidthGBs: 936, // GDDR6X [H5]
    tflopsFp32Dense: 35.6,
    tensorTflops: 71, // FP16 dense (sparse 142)
    tdpW: 350,
    priceRMB: 8_000,
    priceBasis: 'taobao-listing', // Owner-provided current Taobao listing (used market), 2026-09-02 [H7]
    sources: ['H5', 'H7'],
  },
  {
    id: 'rx-9070xt-16g',
    name: 'AMD RX 9070 XT · 16 GB',
    vramGB: 16,
    bandwidthGBs: 644.6, // TechPowerUp [H8]
    tflopsFp32Dense: 48.7, // AMD official + TechPowerUp: 64 CUs / 4096 shaders, boost 2970 MHz → FP32 48.66 TFLOPS [H8] (corrected 2026-09-01; earlier derivation used wrong CU/ALU counts)
    tensorTflops: null, // AMD does not publish a comparable "tensor" figure — use FP32 path with lower η
    tdpW: 304, // 304 W max (TechPowerUp [H8]; Corsair power guide [H9])
    priceRMB: 5_400,
    priceBasis: 'taobao-listing', // Owner-provided current Taobao listing, 2026-09-02 [H7]
    sources: ['H8', 'H9', 'H7'],
  },
  {
    id: 'rtx-5070ti-16g',
    name: 'NVIDIA RTX 5070 Ti · 16 GB',
    vramGB: 16,
    bandwidthGBs: 896, // GDDR7 [H5]
    tflopsFp32Dense: 43.9, // Blackwell: 8960 CUDA × 2 × 2.452 GHz (derived; verify at P2)
    tensorTflops: null, // FP8/FP4 rates not pinned down for the prefill model — calibrate in P2
    tdpW: 300,
    priceRMB: 8_000,
    priceBasis: 'taobao-listing', // Owner-provided current Taobao listing, 2026-09-02 [H7]; US$799 class context
    sources: ['H5', 'H7'],
  },
  {
    id: 'rtx-5090-32g',
    name: 'NVIDIA RTX 5090 · 32 GB',
    vramGB: 32,
    bandwidthGBs: 1792, // GDDR7 [H5]
    tflopsFp32Dense: 104.8, // Blackwell: 21760 CUDA × 2 × 2.407 GHz (derived; verify at P2)
    tensorTflops: null,
    tdpW: 575,
    priceRMB: 29_000,
    priceBasis: 'taobao-listing', // Owner-provided current Taobao listing, 2026-09-02 [H7]; US$1999 class + scarcity premium context
    sources: ['H5', 'H7'],
  },
  {
    id: 'rtx-6000-ada-48g',
    name: 'NVIDIA RTX 6000 Ada · 48 GB',
    vramGB: 48,
    bandwidthGBs: 960, // GDDR6 ECC [H5]
    tflopsFp32Dense: 91.1, // Ada: 18176 CUDA × 2 × 2.505 GHz (derived; verify at P2)
    tensorTflops: null,
    tdpW: 300,
    priceRMB: 78_400,
    priceBasis: 'taobao-listing', // Owner-provided current Taobao listing, 2026-09-02 [H7]; workstation card
    sources: ['H5', 'H7'],
  },
];

/* ------------------------------------------------------------------ */
/* System RAM tiers (dual-channel bandwidth = decode bottleneck for    */
/* CPU-resident layers)                                                */
/* ------------------------------------------------------------------ */

export const RAM_TIERS = [
  {
    id: 'ddr4-3200',
    name: 'DDR4-3200 (dual-channel)',
    bandwidthGBs: 51.2, // 2 × 8 bytes × 3200 MT/s
    capacitiesGB: [16, 32, 48, 64, 128],
  },
  {
    id: 'ddr5-6000',
    name: 'DDR5-6000 (dual-channel)',
    bandwidthGBs: 96, // 2 × 8 bytes × 6000 MT/s
    capacitiesGB: [16, 32, 48, 64, 128, 192, 256],
  },
];

/* ------------------------------------------------------------------ */
/* CPUs (selectable — offload realism; user-approved list + 2 adds)    */
/* prefillTflopsEff = effective prefill throughput estimate            */
/* (community llama.cpp behavior scaled by core count/IPC).           */
/* Calibrate in P2 if CPU-only scenarios become a demo focus.          */
/* ------------------------------------------------------------------ */

export const CPUS = [
  { id: 'ryzen5-3600', name: 'AMD Ryzen 5 3600 (6C/12T, Zen 2)', prefillTflopsEff: 2.0, note: 'estimate' },
  { id: 'ryzen9-5800x3d', name: 'AMD Ryzen 9 5800X3D (8C/16T, Zen 3 + V-Cache)', prefillTflopsEff: 3.5, note: 'estimate; cache helps prompt processing' },
  { id: 'i5-13600k', name: 'Intel Core i5-13600K (14C/20T, Raptor Lake)', prefillTflopsEff: 4.5, note: 'estimate' },
  { id: 'i9-13900kf', name: 'Intel Core i9-13900KF (24C/32T, Raptor Lake)', prefillTflopsEff: 7.0, note: 'estimate' },
  { id: 'ryzen7-7800x3d', name: 'AMD Ryzen 7 7800X3D (8C/16T, Zen 4 + V-Cache)', prefillTflopsEff: 4.0, note: 'estimate; proposed add, user-approved' },
  { id: 'threadripper-7960x', name: 'AMD Threadripper 7960X (24C/48T, DDR5 12-ch ≈ 400 GB/s)', prefillTflopsEff: 15.0, note: 'estimate; workstation tier; proposed add, user-approved' },
];

/* ------------------------------------------------------------------ */
/* Engine constants isolated here for easy recalibration (blueprint §12)*/
/* ------------------------------------------------------------------ */

export const ENGINE_CONSTANTS = {
  /** Multi-GPU bandwidth scaling factors on decode (NVLink/PCIe overhead). Blueprint §5. ASSUMPTION. */
  multiGpuBandwidthFactor: { 1: 1.0, 2: 1.75, 4: 3.2 },

  /** System base power for PC rigs beyond GPU TDP×0.9 (Macs/DGX already include it). ASSUMPTION 80–120 W. */
  pcSystemBaseW: 100,

  /** Unified-memory OS carve-out fraction for Apple/DGX pools.
   *  CALIBRATED P2 (2026-09-02): initial guess was ~⅓; lowered to ⅛ so the M4 Pro 48 GB can host
   *  70B Q4_K_M at 8K ctx (§5.4 anchor: weights 38.5 + KV 2.68 = 41.2 GB ≤ 48×(1−⅛) = 42 GB).
   *  macOS in practice lets a single inference workload use most of the unified pool — labeled assumption. */
  unifiedMemoryOsCarveout: 0.125,

  /** Decode efficiency η (dimensionless). CALIBRATED P2 against all five §5.4 anchors (2026-09-02):
   *  initial guess range was 0.65–0.80; with KV-cache read traffic now explicit in the decode formula
   *  (see perf.js header), η = 0.85 lands every anchor inside its expected range. */
  etaDecode: 0.85,

  /** Prefill efficiency η for GPU tensor paths (CPU path uses prefillTflopsEff directly, η=1).
   *  Midpoint of the initial guess [0.5, 0.7]; no hard anchor — sanity-checked vs community prompt-eval rates. */
  etaPrefillGpu: 0.6,

  /** Prefill compute for all-in-one platforms (TFLOPS-equivalent). LABELED ESTIMATES — Apple/GB10 do not
   *  publish a comparable dense figure; derived from community llama.cpp/Metal prompt-eval behavior. */
  unifiedPrefillTflopsEstimate: { 'mba-m5': 12, 'mbp-m4pro-48': 24, 'dgx-spark': 120 },

  /** Fixed prefill overhead (s) — kernel-launch/scheduling floor. Blueprint §5. */
  prefillOverheadS: 0.1,
};

/* ------------------------------------------------------------------ */
/* Sources                                                             */
/* ------------------------------------------------------------------ */

export const HARDWARE_SOURCES = [
  { id: 'H1', label: 'Apple: MacBook Air tech specs (M5, 153 GB/s memory bandwidth)', url: 'https://www.apple.com/macbook-air/specs/' },
  { id: 'H2', label: 'Apple: MacBook Pro tech specs (M4 Pro, 273 GB/s); re-verify at P2 sign-off', url: 'https://www.apple.com/macbook-pro/specs/' },
  { id: 'H3', label: 'NVIDIA: DGX Spark product page (128 GB LPDDR5x, 273 GB/s, GB10 TDP 140 W / PSU 240 W)', url: 'https://www.nvidia.com/en-us/products/workstations/dgx-spark' },
  { id: 'H4', label: 'NVIDIA V100 datasheet + user-provided values (900 GB/s HBM2, FP32 15.7 / Tensor 125 TFLOPS, PCIe Gen3 x16 ≈ 32 GB/s)', url: 'https://www.nvidia.com/en-us/data-center/v100/' },
  { id: 'H5', label: 'TechPowerUp GPU database: RTX 3060/3090/5070 Ti/5090/RTX 6000 Ada (bandwidth, TDP, CUDA counts)', url: 'https://www.techpowerup.com/gpu-specs/' },
  { id: 'H6', label: 'Apple China store + EveryMac China MSRP archive: Mac street-price anchors (M5 14" ¥13,499; M5 Pro 32GB ¥17,999)', url: 'https://www.apple.com.cn/shop/buy-mac/macbook-pro' },
  { id: 'H7', label: 'Owner-provided current Taobao listings, 2026-09-02: all priceRMB values in this file (supersedes the earlier estimate ranges; listing snapshot, not live prices)', url: null },
  { id: 'H8', label: 'TechPowerUp: RX 9070 XT (644.6 GB/s, RDNA4)', url: 'https://www.techpowerup.com/gpu-specs/radeon-rx-9070-xt.c4229' },
  { id: 'H9', label: 'Corsair: RX 9070/XT power guide (~304 W TDP)', url: null },
];

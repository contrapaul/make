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
 *  - `priceRMB`            → amortization input; `priceBasis: 'estimate'` rows MUST show a
 *                            "street-price estimate" footnote in the UI (P1 gate allows estimates).
 */

export const HARDWARE_DATA_AS_OF = '2026-09-01';

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
    computeNote: 'Apple M5 — 10-core CPU + 8/10-core GPU; memory-bandwidth-bound decode.',
    tdpW: 30, // ASSUMPTION (blueprint §3.1): sustained load ~30 W for the Air class
    priceRMB: 9_000,
    priceBasis: 'estimate', // Apple.cn M5-era Air pricing ≈ ¥8–10k; verify at owner sign-off [H6]
    sources: ['H1', 'H6'],
  },
  {
    id: 'mbp-m4pro-48',
    name: 'MacBook Pro M4 Pro · 48 GB',
    kind: 'allInOne',
    unifiedMemoryGB: 48,
    bandwidthGBs: 273, // Apple spec page (M4 Pro) [H2]
    computeNote: 'Apple M4 Pro — 14-core CPU + 20-core GPU.',
    tdpW: 90, // ASSUMPTION range 65–120 W under sustained load (blueprint §3.1); midpoint used
    priceRMB: 18_000,
    priceBasis: 'estimate', // Prior-gen by Sep 2026; Apple.cn M4 Pro-era configs ran ¥17–22k [H6]
    sources: ['H2', 'H6'],
  },
  {
    id: 'dgx-spark',
    name: 'NVIDIA DGX Spark · 128 GB',
    kind: 'allInOne',
    unifiedMemoryGB: 128, // LPDDR5x unified pool
    bandwidthGBs: 273, // NVIDIA DGX Spark spec [H3]
    computeNote: 'GB10 Grace Blackwell — up to 1 PFLOP FP4 sparse; 20-core Arm CPU.',
    tdpW: 140, // GB10 TDP per NVIDIA (PSU rated 240 W) [H3]
    priceRMB: 29_000,
    priceBasis: 'estimate', // US$3,999 list; China street ≈ ¥28–30k assumed [H6]
    sources: ['H3', 'H6'],
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
    priceRMB: 4_200,
    priceBasis: 'estimate', // Used-market card; China street ¥3.5–5k assumed [H7]
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
    priceBasis: 'estimate', // Still sold new in China; ¥1.8–2.2k assumed [H7]
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
    priceRMB: 6_000,
    priceBasis: 'estimate', // Discontinued; used China street ¥5–7k assumed [H7]
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
    priceRMB: 5_000,
    priceBasis: 'estimate', // China launch street ≈ ¥4.9–5.3k assumed [H7]
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
    priceRMB: 6_500,
    priceBasis: 'estimate', // US$799 class; China street ≈ ¥6.5–7k assumed [H7]
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
    priceRMB: 17_000,
    priceBasis: 'estimate', // US$1999 class + China scarcity premium assumed [H7]
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
    priceRMB: 38_000,
    priceBasis: 'estimate', // Workstation card; China street ≈ ¥35–42k assumed [H7]
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
  { id: 'ryzen9-5800x3d', name: 'AMD Ryzen 9 5800X3D (8C/16T, Zen 3 + V-Cache)', prefillTflopsEff: 3.5, note: 'estimate — cache helps prompt processing' },
  { id: 'i5-13600k', name: 'Intel Core i5-13600K (14C/20T, Raptor Lake)', prefillTflopsEff: 4.5, note: 'estimate' },
  { id: 'i9-13900kf', name: 'Intel Core i9-13900KF (24C/32T, Raptor Lake)', prefillTflopsEff: 7.0, note: 'estimate' },
  { id: 'ryzen7-7800x3d', name: 'AMD Ryzen 7 7800X3D (8C/16T, Zen 4 + V-Cache)', prefillTflopsEff: 4.0, note: 'estimate — proposed add, user-approved' },
  { id: 'threadripper-7960x', name: 'AMD Threadripper 7960X (24C/48T, DDR5 12-ch ≈ 400 GB/s)', prefillTflopsEff: 15.0, note: 'estimate — workstation tier; proposed add, user-approved' },
];

/* ------------------------------------------------------------------ */
/* Engine constants isolated here for easy recalibration (blueprint §12)*/
/* ------------------------------------------------------------------ */

export const ENGINE_CONSTANTS = {
  /** Multi-GPU bandwidth scaling factors on decode (NVLink/PCIe overhead). Blueprint §5. */
  multiGpuBandwidthFactor: { 1: 1.0, 2: 1.75, 4: 3.2 },

  /** System base power for PC rigs beyond GPU TDP×0.9 (Macs/DGX already include it). ASSUMPTION 80–120 W. */
  pcSystemBaseW: 100,

  /** Unified-memory OS carve-out fraction for Apple/DGX pools (blueprint §5 "minus ~⅓"). ASSUMPTION. */
  unifiedMemoryOsCarveout: 1 / 3,

  /** Decode efficiency η range to calibrate against §5.4 anchors in P2. */
  etaDecodeRange: [0.65, 0.8],
  /** Prefill efficiency η for GPU tensor paths (CPU path uses prefillTflopsEff directly). */
  etaPrefillGpuRange: [0.5, 0.7],
};

/* ------------------------------------------------------------------ */
/* Sources                                                             */
/* ------------------------------------------------------------------ */

export const HARDWARE_SOURCES = [
  { id: 'H1', label: 'Apple — MacBook Air tech specs (M5, 153 GB/s memory bandwidth)', url: 'https://www.apple.com/macbook-air/specs/' },
  { id: 'H2', label: 'Apple — MacBook Pro tech specs (M4 Pro, 273 GB/s) — re-verify at P2 sign-off', url: 'https://www.apple.com/macbook-pro/specs/' },
  { id: 'H3', label: 'NVIDIA — DGX Spark product page (128 GB LPDDR5x, 273 GB/s, GB10 TDP 140 W / PSU 240 W)', url: 'https://www.nvidia.com/en-us/products/workstations/dgx-spark' },
  { id: 'H4', label: 'NVIDIA V100 datasheet + user-provided values (900 GB/s HBM2, FP32 15.7 / Tensor 125 TFLOPS, PCIe Gen3 x16 ≈ 32 GB/s)', url: 'https://www.nvidia.com/en-us/data-center/v100/' },
  { id: 'H5', label: 'TechPowerUp GPU database — RTX 3060/3090/5070 Ti/5090/RTX 6000 Ada (bandwidth, TDP, CUDA counts)', url: 'https://www.techpowerup.com/gpu-specs/' },
  { id: 'H6', label: 'Apple China store + EveryMac China MSRP archive — Mac street-price anchors (M5 14" ¥13,499; M5 Pro 32GB ¥17,999)', url: 'https://www.apple.com.cn/shop/buy-mac/macbook-pro' },
  { id: 'H7', label: 'GPU street prices in RMB — ESTIMATES from typical China retail ranges (JD/Taobao); verify at owner sign-off', url: null },
  { id: 'H8', label: 'TechPowerUp — RX 9070 XT (644.6 GB/s, RDNA4)', url: 'https://www.techpowerup.com/gpu-specs/radeon-rx-9070-xt.c4229' },
  { id: 'H9', label: 'Corsair — RX 9070/XT power guide (~304 W TDP)', url: null },
];

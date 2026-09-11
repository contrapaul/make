/**
 * v100 — Performance engine (blueprint §5)
 * =========================================================
 * Pure functions, no DOM — importable from Node for tests (see test/).
 * One formula shape with per-device constants (hardware.js header); all
 * assumptions labeled. The on-page "How we estimate this" panel (P6) mirrors
 * this header.
 *
 * MEMORY ACCOUNTING
 *   weightsGB      = paramsB × bytesPerParam(quant)                          [§3.3]
 *   kvCacheGB/req  = 2 × (globalLayers × ctxTokens + slidingLayers × min(ctxTokens, window))
 *                        × kvHeads × headDim × dtypeBytes / 1e9
 *                    (a plain full-attention anchor has globalLayers = layers, no sliding)
 *   usable (rig)   = VRAM per card × count; system RAM capacity as-is
 *   usable (AIO)   = unified pool × (1 − unifiedMemoryOsCarveout)            [labeled assumption]
 *
 * FITS CHECK (drives everything — blueprint §5)
 *   weights + kv×concurrency ≤ usable              → 'gpu'     (fast path; AIO: single pool)
 *   else if ≤ VRAM + RAM, split layers at boundary → 'offload' (max n with n×(w_l+kv_l) ≤ VRAM)
 *   rig with zero GPU-resident layers              → 'cpuOnly'
 *   otherwise                                      → 'noFit'   (+ UI suggestions)
 *
 * DECODE (bandwidth-bound, per-layer serial model — blueprint §5)
 *   Per token step at concurrency B:
 *     t_step = [ Σ_{l∈GPU} w_l/BW_gpu + B × Σ_all kv_l / BW(resident device of l) ] / η_decode
 *   - Weights are read once per step (shared across the batch); each request's KV history is
 *     re-read every token, so KV traffic scales with B. At B=1 this reduces to the blueprint
 *     formula:  t_token = Σ_layers (layerBytes / BW_of_resident_device),  tps = 1/t_token × η.
 *   - layerBytes includes that layer's weight bytes PLUS its KV read at current context length —
 *     attention must stream the full K/V history for every new token, and that is bandwidth-bound
 *     traffic. Calibration note: with weights-only bytes no constant set can satisfy §5.4 anchors
 *     3+4 simultaneously; including KV reads lets one global η pass all five (see below).
 *   - Multi-GPU: BW_gpu = cardBW × multiGpuBandwidthFactor[count]            [labeled assumption]
 *   - CPU-resident layers use the RAM tier's bandwidth — this is why offload visibly punishes
 *     speed (the teaching moment, blueprint §5/§6).
 *   decodeTpsPerRequest = 1/t_step;  decodeTpsTotal = B × per-request.
 *
 * PREFILL / TTFT (compute-bound)
 *   ttft_s(B=1) = Σ_layers [ promptTokens × 2 × paramsPerLayer / tflopsEff(device of l) ] + overhead
 *   - GPU device: tflopsFp32Dense × η_prefillGpu; AIO: unifiedPrefillTflopsEstimate (labeled est.)
 *   - CPU device: prefillTflopsEff directly (η=1 — already efficiency-adjusted, hardware.js)
 *   - At B=1 this reduces exactly to the blueprint formula promptTokens×2×params/(η×TFLOPS)+0.1s.
 *   - Concurrency: prefills are serialized → ttft_s(B) = ttft_s(1) × B (labeled assumption;
 *     teaches throughput-vs-latency divergence, blueprint §6 Tab 3).
 *
 * CALIBRATION (P2, 2026-09-02 — constants only, formula shape unchanged):
 *   η_decode = 0.85 · carve-out = ⅛ · η_prefillGpu = 0.6 → all five §5.4 anchors in range:
 *     A1 RTX 3090 ×1 + 8B Q4_K_M      ≈145 t/s   (expected 140–200) ✓
 *     A2 M4 Pro 48GB + 8B Q4_K_M      ≈ 42 t/s   (expected 40–60)   ✓
 *     A3 M4 Pro 48GB + 70B Q4_K_M     ≈ 5.6 t/s  (expected 5–9)     ✓
 *     A4 MacBook Air M5 + 4B Q4_K_M   ≈ 38 t/s   (expected 25–45)   ✓
 *     A5 RTX 3060 offload + 70B Q4    ≈ 1.4 t/s  (expected <3)      ✓
 */

import { ALL_IN_ONES, GPUS, RAM_TIERS, CPUS, ENGINE_CONSTANTS } from '../data/hardware.js';
import { MODEL_STOPS } from '../data/models.js';
import { QUANT_BY_ID } from '../data/quantization.js';

/** Prompt length per split preset (tokens). LABELED DEFAULTS — blueprint §6 names the presets
 *  (short/balanced/long) without sizes; these are the engine's representative values. */
export const PROMPT_SPLIT_TOKENS = { short: 256, balanced: 2048, long: 8192 };

/** Fixed generation task for the Tab 3 simulation and Tab 4 race (blueprint §6). */
export const GENERATION_TARGET_TOKENS = 256;

const AIO_BY_ID = Object.fromEntries(ALL_IN_ONES.map((x) => [x.id, x]));
const GPU_BY_ID = Object.fromEntries(GPUS.map((x) => [x.id, x]));
const RAM_BY_ID = Object.fromEntries(RAM_TIERS.map((x) => [x.id, x]));
const CPU_BY_ID = Object.fromEntries(CPUS.map((x) => [x.id, x]));

export function findModelStop(index) {
  return MODEL_STOPS[index] ?? MODEL_STOPS[0];
}

/** Resolve a config to concrete device descriptors. Throws on unknown ids (store validates first). */
function resolveDevices(config) {
  if (config.mode === 'allInOne') {
    const platform = AIO_BY_ID[config.platformId];
    if (!platform) throw new Error(`Unknown all-in-one platform: ${config.platformId}`);
    return { kind: 'unified', platform, gpu: null, ram: null, cpu: null };
  }
  const gpu = GPU_BY_ID[config.gpuId];
  const ram = RAM_BY_ID[config.ramTierId];
  const cpu = CPU_BY_ID[config.cpuId];
  if (!gpu || !ram || !cpu) throw new Error('Rig config needs valid gpuId, ramTierId and cpuId');
  return { kind: 'rig', platform: null, gpu, ram, cpu };
}

/** KV cache size in GB for one request at a given context length (blueprint §5 formula).
 *
 *  Not every layer keeps a cache that grows with the context. Two of the
 *  anchors are hybrids and say so in their own config:
 *    - Gemma 4 E4B: 7 of 42 layers are global; the other 35 are sliding-window
 *      attention, whose cache stops growing once the context passes the window.
 *    - Qwen3.8-27B: 16 of 64 layers are full attention; the other 48 are Gated
 *      DeltaNet, whose state is a fixed size no matter how long the context is.
 *  An anchor that declares neither field is a plain full-attention model, and
 *  falls back to every layer growing — which is exactly what it does. */
export function kvCacheGB(anchor, ctxTokens, quant) {
  const globalLayers = anchor.kvLayers ?? anchor.layers;
  const slidingLayers = anchor.slidingLayers ?? 0;
  const windowTokens = anchor.slidingWindow ? Math.min(ctxTokens, anchor.slidingWindow) : 0;
  const tokenSlots = globalLayers * ctxTokens + slidingLayers * windowTokens;
  return (2 * tokenSlots * anchor.kvHeads * anchor.headDim * quant.kvBytesPerElement) / 1e9;
}

/** Usable memory in GB for the config's primary pool. */
function usableMemoryGB(dev, config) {
  if (dev.kind === 'unified') {
    return dev.platform.unifiedMemoryGB * (1 - ENGINE_CONSTANTS.unifiedMemoryOsCarveout);
  }
  return dev.gpu.vramGB * config.gpuCount;
}

/**
 * Evaluate a full config → derived performance metrics. Pure & synchronous.
 * @param {object} config See store.js DEFAULT_CONFIG shape.
 */
export function evaluate(config) {
  const dev = resolveDevices(config);
  const stop = findModelStop(config.modelStopIndex);
  const quant = QUANT_BY_ID[config.quantId];
  if (!quant) throw new Error(`Unknown quantization level: ${config.quantId}`);

  const B = Math.max(1, config.concurrency | 0);
  const ctxTokens = config.contextWindow;
  const L = stop.anchor.layers;

  /* ---------------- memory accounting ---------------- */
  const weightsGB = stop.paramsB * quant.bytesPerParam; // paramsB is in billions → decimal GB
  const kvCacheGBReq = kvCacheGB(stop.anchor, ctxTokens, quant); // per request
  const kvTotalGB = kvCacheGBReq * B;

  const wLayerGB = weightsGB / L;   // uniform-layer approximation (embeddings folded into the average)
  const kvLayerGB = kvCacheGBReq / L;

  let fitsState;
  let layersOnGpu = L;
  let layersOnCpu = 0;
  const gpuUsableGB = usableMemoryGB(dev, config);
  const ramUsableGB = dev.kind === 'rig' ? config.ramCapacityGB : null;

  if (dev.kind === 'unified') {
    fitsState = weightsGB + kvTotalGB <= gpuUsableGB ? 'gpu' : 'noFit';
  } else {
    const vram = gpuUsableGB;
    if (weightsGB + kvTotalGB <= vram) {
      fitsState = 'gpu';
    } else if (weightsGB + kvTotalGB <= vram + ramUsableGB) {
      // Max GPU-resident layers whose weights+KV fit in VRAM (KV must live with its layer).
      const perLayerGB = wLayerGB + kvLayerGB;
      let n = Math.floor(vram / perLayerGB);
      n = Math.max(0, Math.min(L, n));
      fitsState = n > 0 ? 'offload' : 'cpuOnly';
      layersOnGpu = n;
      layersOnCpu = L - n;
    } else {
      fitsState = 'noFit';
    }
  }

  /* ---------------- decode + prefill (only when it fits) ---------------- */
  let decodeTpsPerRequest = null;
  let ttftMsBase = null;
  let prefillTflopsEff = null;

  if (fitsState !== 'noFit') {
    const etaD = ENGINE_CONSTANTS.etaDecode;
    let tStepS;
    if (dev.kind === 'unified') {
      // All layers on one pool: weights shared per step, KV read scales with B.
      tStepS = ((weightsGB + B * kvCacheGBReq) / dev.platform.bandwidthGBs) / etaD;
    } else {
      const factor = ENGINE_CONSTANTS.multiGpuBandwidthFactor[config.gpuCount] ?? 1.0;
      const bwGpu = dev.gpu.bandwidthGBs * factor; // GB/s
      const bwRam = dev.ram.bandwidthGBs;          // GB/s
      tStepS = (
        layersOnGpu * wLayerGB / bwGpu + B * layersOnGpu * kvLayerGB / bwGpu +
        layersOnCpu * wLayerGB / bwRam + B * layersOnCpu * kvLayerGB / bwRam
      ) / etaD;
    }
    decodeTpsPerRequest = 1 / tStepS;

    // Prefill: serial per-layer compute model (reduces to blueprint §5 formula at one device).
    const promptTokens = PROMPT_SPLIT_TOKENS[config.promptSplit] ?? PROMPT_SPLIT_TOKENS.balanced;
    const flopsPerToken = 2 * stop.paramsB * 1e9; // ≈2 FLOPs per param per token (matmul bound)
    let ttftS;
    if (dev.kind === 'unified') {
      // Hardware figures are TFLOPS; flopsPerToken is raw FLOPs — convert before dividing.
      const flopsEff =
        (ENGINE_CONSTANTS.unifiedPrefillTflopsEstimate[dev.platform.id] ?? 0) * ENGINE_CONSTANTS.etaPrefillGpu * 1e12;
      if (!(flopsEff > 0)) throw new Error(`No prefill estimate for platform ${dev.platform.id}`);
      ttftS = (promptTokens * flopsPerToken) / flopsEff + ENGINE_CONSTANTS.prefillOverheadS;
    } else {
      const gpuFlopsEff = dev.gpu.tflopsFp32Dense * ENGINE_CONSTANTS.etaPrefillGpu * 1e12;
      const cpuFlopsEff = dev.cpu.prefillTflopsEff * 1e12; // η=1 by definition (hardware.js header)
      ttftS =
        (promptTokens * flopsPerToken * layersOnGpu) / L / gpuFlopsEff +
        (promptTokens * flopsPerToken * layersOnCpu) / L / cpuFlopsEff +
        ENGINE_CONSTANTS.prefillOverheadS;
    }
    ttftMsBase = ttftS * 1000;

    // Aggregate effective prefill throughput for printouts (FLOPs actually scheduled per second).
    const totalPrefillFLOPs = promptTokens * flopsPerToken;
    prefillTflopsEff = totalPrefillFLOPs / Math.max(ttftS - ENGINE_CONSTANTS.prefillOverheadS, 1e-9) / 1e12;
  }

  /* ---------------- max model that fits (current quant/ctx/concurrency) ---------------- */
  let maxModelFits = null;
  for (let i = MODEL_STOPS.length - 1; i >= 0; i--) {
    const s = MODEL_STOPS[i];
    const wGB = s.paramsB * quant.bytesPerParam;
    const kvReqGB = kvCacheGB(s.anchor, ctxTokens, quant);
    let fits;
    if (dev.kind === 'unified') {
      fits = wGB + kvReqGB * B <= gpuUsableGB;
    } else {
      fits = wGB + kvReqGB * B <= gpuUsableGB + ramUsableGB;
    }
    if (fits) { maxModelFits = { paramsB: s.paramsB, label: s.label }; break; }
  }

  /* ---------------- no-fit diagnosis for the UI ---------------- */
  let noFitSuggestions = null;
  if (fitsState === 'noFit') {
    const totalUsable = dev.kind === 'unified' ? gpuUsableGB : gpuUsableGB + ramUsableGB;
    noFitSuggestions = [
      `Needs ~${(weightsGB + kvTotalGB).toFixed(1)} GB but only ${totalUsable.toFixed(0)} GB is available.`,
      'Try a smaller model stop, a lower quantization level, or a shorter context window.',
      ...(dev.kind === 'rig' ? ['Or add more GPU cards / more system RAM.'] : []),
    ];
  }

  return {
    // memory
    fitsState,
    layersOnGpu,
    layersOnCpu,
    totalLayers: L,
    weightsGB,
    kvCacheGB: kvCacheGBReq,   // per request at current context
    kvTotalGB,                 // × concurrency (what the fits check uses)
    gpuUsableGB,
    ramUsableGB,
    bytesPerTokenGB: weightsGB + kvCacheGBReq, // what one decode step moves for a single request
    // speed
    decodeTpsPerRequest,
    decodeTpsTotal: decodeTpsPerRequest != null ? decodeTpsPerRequest * B : null,
    ttftMsBase,                // concurrency 1
    ttftMs: ttftMsBase != null ? ttftMsBase * B : null, // prefills serialized (labeled assumption)
    prefillTflopsEff,
    promptTokens: PROMPT_SPLIT_TOKENS[config.promptSplit] ?? PROMPT_SPLIT_TOKENS.balanced,
    // guidance
    maxModelFits,
    noFitSuggestions,
  };
}

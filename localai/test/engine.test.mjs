/**
 * v100 — Phase 2 engine acceptance tests (blueprint §5.4 anchors + unit checks)
 * =============================================================================
 * Plain Node, no framework. Run from the localai directory:
 *
 *   node test/engine.test.mjs
 *
 * Covers:
 *  - The five §5.4 sanity anchors (exact configs; all ctx 8K, concurrency 1, Q4_K_M)
 *  - Memory accounting units (weightsGB, kvCacheGB, usable pools, noFit paths)
 *  - Multi-GPU bandwidth factor + offload layer split
 *  - Concurrency model (KV ×B memory, serialized TTFT, total throughput)
 *  - Cost engine (watts, kWh/M, RMB/USD, amortization, null-safe noFit path)
 *  - Store behavior (recompute+emit, validation throws, persistence round-trip)
 *
 * Calibration rule (§5.4): if an anchor misses its range by >25%, adjust ONLY the
 * constants in hardware.js ENGINE_CONSTANTS — never the formula shape.
 */

import { evaluate, kvCacheGB, PROMPT_SPLIT_TOKENS, GENERATION_TARGET_TOKENS } from '../js/engine/perf.js';
import { computeCost, loadWatts, hardwarePriceRMB } from '../js/engine/cost.js';
import { createStore, DEFAULT_CONFIG, validateConfig } from '../js/state/store.js';
import { MODEL_STOPS } from '../js/data/models.js';
import { QUANT_BY_ID } from '../js/data/quantization.js';

/* ---------------- tiny harness ---------------- */

let passed = 0;
let failed = 0;
const failures = [];

function check(name, cond, detail = '') {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    failures.push({ name, detail });
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function section(title) {
  console.log(`\n— ${title}`);
}

const near = (a, b, relTol = 1e-9) => Math.abs(a - b) <= Math.max(Math.abs(a), Math.abs(b)) * relTol;
const inRange = (v, lo, hi) => v >= lo && v <= hi;

/* ---------------- config builders (anchor shapes from §5.4) ---------------- */

const rig = (over = {}) => ({
  mode: 'rig',
  gpuId: 'rtx-3090-24g',
  gpuCount: 1,
  ramTierId: 'ddr5-6000',
  ramCapacityGB: 64,
  cpuId: 'i5-13600k',
  modelStopIndex: 1, // 8B (Gemma 4 E4B anchor)
  quantId: 'q4_k_m',
  contextWindow: 8192,
  promptSplit: 'balanced',
  concurrency: 1,
  ...over,
});

const aio = (platformId, over = {}) => ({
  mode: 'allInOne',
  platformId,
  gpuId: null,
  gpuCount: 1,
  ramTierId: null,
  ramCapacityGB: null,
  cpuId: null,
  modelStopIndex: 1, // 8B
  quantId: 'q4_k_m',
  contextWindow: 8192,
  promptSplit: 'balanced',
  concurrency: 1,
  ...over,
});

const STOP_4B = 0;   // Qwen3-4B anchor
const STOP_8B = 1;   // Gemma 4 E4B anchor
const STOP_70B = 7;  // Llama 3.3 70B anchor

/* ---------------- §5.4 sanity anchors (P2 acceptance) ---------------- */

section('§5.4 sanity anchors — decode tok/s must land in range');

{
  const a1 = evaluate(rig({ gpuId: 'rtx-3090-24g', modelStopIndex: STOP_8B }));
  console.log(`    A1 RTX 3090 ×1 + 8B Q4_K_M      → ${a1.decodeTpsPerRequest.toFixed(1)} t/s (fits=${a1.fitsState})`);
  check('A1 fits on GPU', a1.fitsState === 'gpu');
  check('A1 decode in [140, 200] t/s', inRange(a1.decodeTpsPerRequest, 140, 200), `got ${a1.decodeTpsPerRequest.toFixed(2)}`);
}

{
  const a2 = evaluate(aio('mbp-m4pro-48', { modelStopIndex: STOP_8B }));
  console.log(`    A2 M4 Pro 48GB + 8B Q4_K_M      → ${a2.decodeTpsPerRequest.toFixed(1)} t/s (fits=${a2.fitsState})`);
  check('A2 fits on unified pool', a2.fitsState === 'gpu');
  check('A2 decode in [40, 60] t/s', inRange(a2.decodeTpsPerRequest, 40, 60), `got ${a2.decodeTpsPerRequest.toFixed(2)}`);
}

{
  const a3 = evaluate(aio('mbp-m4pro-48', { modelStopIndex: STOP_70B }));
  console.log(`    A3 M4 Pro 48GB + 70B Q4_K_M     → ${a3.decodeTpsPerRequest.toFixed(2)} t/s (fits=${a3.fitsState})`);
  check('A3 fits on unified pool', a3.fitsState === 'gpu');
  check('A3 decode in [5, 9] t/s', inRange(a3.decodeTpsPerRequest, 5, 9), `got ${a3.decodeTpsPerRequest.toFixed(2)}`);
}

{
  const a4 = evaluate(aio('mba-m5', { modelStopIndex: STOP_4B }));
  console.log(`    A4 MacBook Air M5 + 4B Q4_K_M   → ${a4.decodeTpsPerRequest.toFixed(1)} t/s (fits=${a4.fitsState})`);
  check('A4 fits on unified pool', a4.fitsState === 'gpu');
  check('A4 decode in [25, 45] t/s', inRange(a4.decodeTpsPerRequest, 25, 45), `got ${a4.decodeTpsPerRequest.toFixed(2)}`);
}

{
  const a5 = evaluate(rig({ gpuId: 'rtx-3060-12g', ramTierId: 'ddr4-3200', ramCapacityGB: 64, modelStopIndex: STOP_70B }));
  console.log(`    A5 RTX 3060 offload + 70B Q4_K_M → ${a5.decodeTpsPerRequest.toFixed(2)} t/s (fits=${a5.fitsState}, GPU layers=${a5.layersOnGpu}/${a5.totalLayers})`);
  check('A5 is offload mode', a5.fitsState === 'offload');
  check('A5 decode < 3 t/s (teaches offload pain)', a5.decodeTpsPerRequest < 3, `got ${a5.decodeTpsPerRequest.toFixed(2)}`);
  check('A5 layer split = 23 GPU / 57 CPU', a5.layersOnGpu === 23 && a5.layersOnCpu === 57, `got ${a5.layersOnGpu}/${a5.layersOnCpu}`);
}

/* ---------------- memory accounting units ---------------- */

section('Memory accounting (weights / KV cache / usable pools)');

{
  const r = evaluate(rig({ modelStopIndex: STOP_8B }));
  check('weightsGB(8B, Q4_K_M) = 4.4', near(r.weightsGB, 4.4, 1e-9), `got ${r.weightsGB}`);

  // Gemma 4 E4B is a hybrid: 7 global layers grow with the context, 35
  // sliding-window layers stop growing at 512 tokens. So the slot count is
  // 7×8192 + 35×512 = 75,264, not 42×8192, and the cache is ~7× smaller than
  // the full-attention model that used to anchor this stop.
  const kv8k = kvCacheGB(MODEL_STOPS[STOP_8B].anchor, 8192, QUANT_BY_ID.q4_k_m);
  check('kvCacheGB(8B @ 8K) ≈ 0.154 GB', near(kv8k, 0.154140672, 1e-6), `got ${kv8k}`);

  // The sliding layers must genuinely stop growing: doubling the context does
  // not double this cache, which is the whole point of the architecture.
  const kv16k = kvCacheGB(MODEL_STOPS[STOP_8B].anchor, 16384, QUANT_BY_ID.q4_k_m);
  check('sliding-window layers stop growing (16K < 2× the 8K cache)', kv16k < kv8k * 2, `got ${kv16k} vs ${kv8k}`);

  // A full-attention anchor declares no hybrid fields and must be unchanged.
  const kv70 = kvCacheGB(MODEL_STOPS[STOP_70B].anchor, 8192, QUANT_BY_ID.q4_k_m);
  check('full-attention anchors still use every layer', near(kv70, 2.68435456, 1e-6), `got ${kv70}`);

  const kv32k = kvCacheGB(MODEL_STOPS[STOP_70B].anchor, 32768, QUANT_BY_ID.q4_k_m);
  check('kvCacheGB(70B @ 32K) ≈ 10.737 GB', near(kv32k, 10.73741824, 1e-6), `got ${kv32k}`);

  const a2 = evaluate(aio('mbp-m4pro-48'));
  check('M4 Pro usable pool = 42 GB (48 × (1 − ⅛))', near(a2.gpuUsableGB, 42, 1e-9), `got ${a2.gpuUsableGB}`);

  const a4 = evaluate(aio('mba-m5'));
  check('Air M5 usable pool = 14 GB (16 × (1 − ⅛))', near(a4.gpuUsableGB, 14, 1e-9), `got ${a4.gpuUsableGB}`);

  const a1 = evaluate(rig({ gpuId: 'rtx-3090-24g' }));
  check('rig usable VRAM = 24 GB (×1 card)', near(a1.gpuUsableGB, 24, 1e-9), `got ${a1.gpuUsableGB}`);
}

section('No-fit paths + suggestions');

{
  const nf1 = evaluate(aio('mba-m5', { modelStopIndex: STOP_70B })); // 41.2 GB > 14 GB usable
  check('Air M5 + 70B @8K → noFit', nf1.fitsState === 'noFit');
  check('noFit exposes suggestions for the UI', Array.isArray(nf1.noFitSuggestions) && nf1.noFitSuggestions.length >= 2);
  check('noFit has null speed metrics', nf1.decodeTpsPerRequest === null && nf1.ttftMsBase === null);

  const nf2 = evaluate(aio('mbp-m4pro-48', { modelStopIndex: STOP_70B, contextWindow: 32768 })); // KV blows the pool
  check('M4 Pro + 70B @32K → noFit (KV growth)', nf2.fitsState === 'noFit');

  let threw = false;
  try { evaluate(rig({ quantId: 'not-a-quant' })); } catch { threw = true; }
  check('evaluate() throws on unknown quant id', threw);
}

/* ---------------- multi-GPU + offload split ---------------- */

section('Multi-GPU bandwidth factor');

{
  const m2 = evaluate(rig({ gpuId: 'rtx-3090-24g', gpuCount: 2, modelStopIndex: STOP_70B }));
  console.log(`    RTX 3090 ×2 + 70B Q4_K_M → ${m2.decodeTpsPerRequest.toFixed(1)} t/s (fits=${m2.fitsState})`);
  check('3090×2 + 70B fits on GPU', m2.fitsState === 'gpu');
  // 41.18 GB / (936 × 1.75 × 0.85) ≈ 33.8 t/s — factor 1.75 must be applied, not 2.0
  check('3090×2 + 70B decode ≈ 34 t/s (factor 1.75)', inRange(m2.decodeTpsPerRequest, 30, 38), `got ${m2.decodeTpsPerRequest.toFixed(2)}`);

  const m1 = evaluate(rig({ gpuId: 'rtx-3090-24g', gpuCount: 1, modelStopIndex: STOP_70B }));
  check('multi-GPU is faster than single card', m2.decodeTpsPerRequest > m1.decodeTpsPerRequest);
}

/* ---------------- concurrency model (labeled assumptions) ---------------- */

section('Concurrency: KV ×B memory · serialized TTFT · total throughput');

{
  const b1 = evaluate(aio('mbp-m4pro-48', { concurrency: 1 }));
  const b4 = evaluate(aio('mbp-m4pro-48', { concurrency: 4 }));
  check('KV memory scales ×B for fits check', near(b4.kvTotalGB, b1.kvCacheGB * 4, 1e-9), `got ${b4.kvTotalGB}`);
  check('TTFT scales linearly with B (serialized prefills)', near(b4.ttftMs, b1.ttftMsBase * 4, 1e-9));
  check('total throughput = B × per-request', near(b4.decodeTpsTotal, b4.decodeTpsPerRequest * 4, 1e-9));
  check('per-request tps drops as KV traffic grows with B', b4.decodeTpsPerRequest < b1.decodeTpsPerRequest);

  // Fits boundary: M4 Pro + 70B @8K fits at B=1 (41.2 ≤ 42) but not at B=4 (38.5 + 4×2.68 = 49.2 > 42)
  const f1 = evaluate(aio('mbp-m4pro-48', { modelStopIndex: STOP_70B, concurrency: 1 }));
  const f4 = evaluate(aio('mbp-m4pro-48', { modelStopIndex: STOP_70B, concurrency: 4 }));
  check('concurrency can flip fits → noFit (KV ×B)', f1.fitsState === 'gpu' && f4.fitsState === 'noFit');
}

/* ---------------- cost engine ---------------- */

section('Cost engine (watts · kWh/M · RMB/USD · amortization)');

{
  const rigCfg = rig({ gpuId: 'rtx-3090-24g' });
  check('rig watts = TDP×0.9×count + 100 W base (350→415)', near(loadWatts(rigCfg), 415, 1e-9), `got ${loadWatts(rigCfg)}`);

  const rig2 = rig({ gpuId: 'rtx-3090-24g', gpuCount: 2 });
  check('rig ×2 watts = 350×0.9×2 + 100 (730)', near(loadWatts(rig2), 730, 1e-9), `got ${loadWatts(rig2)}`);

  const aioCfg = aio('mba-m5');
  check('AIO watts = whole-machine tdpW (Air M5 → 30)', near(loadWatts(aioCfg), 30, 1e-9));

  check('rig price = GPU×count only (3090×2 → ¥16,000)', hardwarePriceRMB(rig2) === 16_000);
  check('AIO price = platform listing (M4 Pro → ¥18,000)', hardwarePriceRMB(aio('mbp-m4pro-48')) === 18_000);

  // Formula: kWh/M = watts × (1e6/tps) / 3.6e6 ; RMB = ×0.65 ; USD = ÷6.72
  const perfStub = { decodeTpsPerRequest: 100 };
  const c = computeCost(rigCfg, perfStub); // 415 W → 415/360 kWh per M tokens
  check('kWh/M formula (415 W @100 t/s ≈ 1.1528)', near(c.kwhPerMOut, 415 / 360, 1e-9), `got ${c.kwhPerMOut}`);
  check('costRMB/M = kWh × 0.65 (≈0.7493)', near(c.costRMBPerMOut, (415 / 360) * 0.65, 1e-9), `got ${c.costRMBPerMOut}`);
  check('costUSD/M = RMB ÷ 6.72', near(c.costUSDPerMOut, ((415 / 360) * 0.65) / 6.72, 1e-9), `got ${c.costUSDPerMOut}`);

  // Amortization: ¥8,000 over 3 yr → per hour × gen-hours-per-M
  const expHour = 8_000 / (3 * 8760);
  check('amortized RMB/hour = price/(3×8760)', near(c.amortizedRMBPerHour, expHour, 1e-9), `got ${c.amortizedRMBPerHour}`);
  const expGenH = (1e6 / 100) / 3600; // hours of generation per M output tokens @100 t/s
  check('amortized RMB/M = price/hour × gen-hours-per-M', near(c.amortizedRMBPerMOut, expHour * expGenH, 1e-9), `got ${c.amortizedRMBPerMOut}`);
  const expBlended = c.costRMBPerMOut + expHour * expGenH;
  check('blended RMB/M = electricity + amortized hardware', near(c.blendedRMBPerMOut, expBlended, 1e-9), `got ${c.blendedRMBPerMOut}`);

  // noFit → null-safe cost (watts/price still reported)
  const nf = computeCost(aio('mba-m5', { modelStopIndex: STOP_70B }), null);
  check('noFit perf=null → costs null, watts+price intact', nf.kwhPerMOut === null && nf.blendedRMBPerMOut === null && nf.watts === 30 && nf.priceRMB === 8_500);

  // End-to-end: A1 anchor cost with real engine output
  const a1 = evaluate(rig({ gpuId: 'rtx-3090-24g', modelStopIndex: STOP_8B }));
  const cA1 = computeCost(rig({ gpuId: 'rtx-3090-24g' }), a1);
  check('A1 end-to-end cost is finite & positive', Number.isFinite(cA1.blendedRMBPerMOut) && cA1.blendedRMBPerMOut > 0, `got ${cA1.blendedRMBPerMOut}`);
}

/* ---------------- store behavior ---------------- */

section('Store: recompute + emit · validation · persistence');

function makeMockStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => void map.set(k, String(v)),
    removeItem: (k) => void map.delete(k),
    _dump: () => Object.fromEntries(map),
  };
}

{
  check('DEFAULT_CONFIG passes validation', validateConfig(DEFAULT_CONFIG).length === 0);

  const mock = makeMockStorage();
  const s = createStore({ storage: mock });
  const st0 = s.getState();
  check('fresh store starts at DEFAULT_CONFIG with ok derived state', st0.config.quantId === 'q4_k_m' && st0.derived.ok === true);

  // recompute + emit on change. Asserted as growth against the starting
  // context rather than a fixed threshold: how much the cache grows depends
  // on the anchor's attention design, but that it grows does not.
  let emits = 0;
  const kvBefore = s.getState().derived.perf.kvCacheGB;
  const unsub = s.subscribe(() => emits++);
  s.setConfig({ contextWindow: 32768 });
  unsub();
  check('setConfig recomputes derived (KV grows with ctx)', s.getState().derived.perf.kvCacheGB > kvBefore, `got ${s.getState().derived.perf.kvCacheGB} vs ${kvBefore}`);
  check('setConfig emits exactly once', emits === 1, `emits=${emits}`);

  // persistence happened
  const persisted = Object.values(mock._dump());
  check('config persisted to storage on setConfig', persisted.length === 1 && JSON.parse(persisted[0]).config.contextWindow === 32768);

  // invalid config throws, state unchanged
  let threw = false;
  try { s.setConfig({ gpuCount: 3 }); } catch { threw = true; }
  check('invalid setConfig throws', threw);
  check('state unchanged after rejected setConfig', s.getState().config.gpuCount === 1 && s.getState().derived.ok === true);

  let threw2 = false;
  try { createStore({ storage: makeMockStorage(), initialConfig: { contextWindow: 4096 } }); } catch { threw2 = true; }
  check('invalid initialConfig throws at construction', threw2);

  // round-trip through a second store instance on the same backing store
  const s2 = createStore({ storage: mock });
  check('persistence round-trip restores config + derived ok', s2.getState().config.contextWindow === 32768 && s2.getState().derived.ok === true);

  // corrupt/foreign persisted state → fall back to defaults (never crash)
  const bad = makeMockStorage();
  bad.setItem('v100.state.v1', JSON.stringify({ config: { gpuCount: 99 } }));
  const s3 = createStore({ storage: bad });
  check('corrupt persisted state → safe fallback to defaults', s3.getState().config.gpuCount === DEFAULT_CONFIG.gpuCount && s3.getState().derived.ok === true);

  // explicit initialConfig wins over persisted state
  const m2 = makeMockStorage();
  m2.setItem('v100.state.v1', JSON.stringify({ config: { quantId: 'q5_k_m' } }));
  const s4 = createStore({ storage: m2, initialConfig: { quantId: 'fp16' } });
  check('initialConfig overrides persisted state', s4.getState().config.quantId === 'fp16');

  // tab/theme bookkeeping
  s.setActiveTab('lab');
  check('setActiveTab marks visited + sets active', s.getState().ui.activeTab === 'lab' && s.getState().ui.visitedTabs.includes('lab'));
  let threw3 = false;
  try { s.setActiveTab('nope'); } catch { threw3 = true; }
  check('unknown tab id throws', threw3);
}

/* ---------------- labeled contract constants (lock the documented defaults) ---------------- */

section('Labeled engine contracts (documented in perf.js header / blueprint §5–§6)');

{
  check('prompt split presets: short 256 / balanced 2048 / long 8192', PROMPT_SPLIT_TOKENS.short === 256 && PROMPT_SPLIT_TOKENS.balanced === 2048 && PROMPT_SPLIT_TOKENS.long === 8192);
  check('Tab 3/4 generation target = 256 tokens', GENERATION_TARGET_TOKENS === 256);

  const a1 = evaluate(rig({ modelStopIndex: STOP_8B }));
  check('promptTokens follows the split preset (balanced → 2048)', a1.promptTokens === 2048);
  check('TTFT > fixed overhead floor', a1.ttftMsBase > 100, `got ${a1.ttftMsBase}`);

  // Absolute magnitude, not just a floor. The 2026-09-04 TFLOPS-vs-FLOPs unit bug
  // made every TTFT 1e12 too large (default rig printed 1,534,082,397,003 s) and
  // still satisfied BOTH the >100 ms floor above and the ttftMs = ttftMsBase x B
  // ratio check, so it survived four milestones. Hand-check for this exact config
  // (RTX 3090, 8B Q4, 2048-token prompt):
  //   2048 x 1.6e10 FLOPs / (35.6 TFLOPS x 0.6 x 1e12) + 0.1 s overhead = 1.63 s
  check('TTFT has a plausible absolute magnitude for the default rig (0.5-5 s)',
    a1.ttftMsBase > 500 && a1.ttftMsBase < 5000, `got ${a1.ttftMsBase} ms`);

  // maxModelFits: A5 rig (3060 12 GB + 64 GB RAM) at Q4/8K → 70B and 80B fit via offload pool
  const a5 = evaluate(rig({ gpuId: 'rtx-3060-12g', ramTierId: 'ddr4-3200', ramCapacityGB: 64, modelStopIndex: STOP_70B }));
  check('maxModelFits finds the largest stop in VRAM+RAM (A5 rig → 80B)', a5.maxModelFits && a5.maxModelFits.paramsB === 80, `got ${JSON.stringify(a5.maxModelFits)}`);

  const mba = evaluate(aio('mba-m5', { modelStopIndex: STOP_4B }));
  // 16B: 8.8 GB weights + 1.68 GB KV = 10.5 GB ≤ 14 GB usable; 27B (14.85 GB weights alone) doesn't fit
  check('maxModelFits on Air M5 (14 GB usable) → 16B at Q4/8K', mba.maxModelFits && mba.maxModelFits.paramsB === 16, `got ${JSON.stringify(mba.maxModelFits)}`);
}

/* ---------------- summary ---------------- */

console.log(`\n${'='.repeat(60)}`);
if (failed === 0) {
  console.log(`ALL PASS — ${passed} checks green. §5.4 anchors satisfied; P2 acceptance gate met.`);
} else {
  console.log(`${failed} FAILED / ${passed} passed:`);
  for (const f of failures) console.log(`  ✗ ${f.name}${f.detail ? ` — ${f.detail}` : ''}`);
  process.exitCode = 1;
}

/**
 * v100 — Cost engine (blueprint §5 "Power & cost")
 * =========================================================
 * Pure functions, no DOM — importable from Node for tests.
 *
 *   watts_load      = Σ GPU_TDP × 0.9 + pcSystemBaseW        (rig; base covers CPU/RAM/mobo/fans)
 *                     all-in-one tdpW already includes the whole machine (hardware.js header)
 *   kWh_per_M_out   = watts × (1e6 / tps) / 3.6e6            [§5]
 *   costRMB_per_M   = kWh × cnyPerKwh ;  USD via usdCny      [rates.js, Shenzhen defaults]
 *   amortization    = priceRMB / (years × 8760 h) blended into RMB/M for the Tab 4 comparison.
 *                     Rig rigs: selected GPU(s) only — no CPU/RAM/mobo prices exist in the data
 *                     layer (owner-provided listings cover GPUs + all-in-ones), so UI copy must say
 *                     "selected hardware price" rather than "full system".
 *
 * Local cost = hardware price (amortized, default 3 yr) + electricity ONLY — per owner (blueprint §3.5).
 */

import { ALL_IN_ONES, GPUS, ENGINE_CONSTANTS } from '../data/hardware.js';
import { RATES } from '../data/rates.js';

const HOURS_PER_YEAR = 8760;

/** Load power draw in watts for the config (independent of perf result). */
export function loadWatts(config) {
  if (config.mode === 'allInOne') {
    const platform = ALL_IN_ONES.find((x) => x.id === config.platformId);
    if (!platform) throw new Error(`Unknown all-in-one platform: ${config.platformId}`);
    return platform.tdpW; // whole-machine load power (Macs/DGX include system base — hardware.js)
  }
  const gpu = GPUS.find((x) => x.id === config.gpuId);
  if (!gpu) throw new Error(`Unknown GPU: ${config.gpuId}`);
  return gpu.tdpW * config.gpuCount * 0.9 + ENGINE_CONSTANTS.pcSystemBaseW;
}

/** One-time hardware price used for amortization (RMB). */
export function hardwarePriceRMB(config) {
  if (config.mode === 'allInOne') {
    const platform = ALL_IN_ONES.find((x) => x.id === config.platformId);
    return platform ? platform.priceRMB : null;
  }
  const gpu = GPUS.find((x) => x.id === config.gpuId);
  if (!gpu) throw new Error(`Unknown GPU: ${config.gpuId}`);
  return gpu.priceRMB * config.gpuCount; // selected GPU(s) only — see header note
}

/**
 * Compute power + cost metrics for a config.
 * @param {object} config   store.js config shape
 * @param {object} perf     result of perf.evaluate(config); null-safe when it doesn't fit
 * @param {object} [rates]  override RATES (tests)
 */
export function computeCost(config, perf, rates = RATES) {
  const watts = loadWatts(config);
  const priceRMB = hardwarePriceRMB(config);

  // Per-request decode speed drives the per-M-output cost (each request's tokens are what we pay for).
  const tps = perf && perf.decodeTpsPerRequest ? perf.decodeTpsPerRequest : null;

  let kwhPerMOut = null;
  let costRMBPerMOut = null;
  let costUSDPerMOut = null;
  if (tps != null) {
    kwhPerMOut = (watts * (1e6 / tps)) / 3.6e6; // W × s-per-M-tokens → J → kWh
    costRMBPerMOut = kwhPerMOut * rates.cnyPerKwh;
    costUSDPerMOut = costRMBPerMOut / rates.usdCny;
  }

  // Amortized hardware (Tab 4 blended cost): price spread over the horizon, per hour of generation.
  const years = rates.amortizationYearsDefault;
  const amortizedRMBPerHour = priceRMB != null ? priceRMB / (years * HOURS_PER_YEAR) : null;

  let genHoursPerMOut = null;
  let amortizedRMBPerMOut = null;
  if (tps != null && amortizedRMBPerHour != null) {
    genHoursPerMOut = (1e6 / tps) / 3600; // hours of generation per M output tokens
    amortizedRMBPerMOut = amortizedRMBPerHour * genHoursPerMOut;
  }

  const blendedRMBPerMOut =
    costRMBPerMOut != null && amortizedRMBPerMOut != null ? costRMBPerMOut + amortizedRMBPerMOut : null;
  const blendedUSDPerMOut = blendedRMBPerMOut != null ? blendedRMBPerMOut / rates.usdCny : null;

  return {
    watts,
    priceRMB,
    amortizationYears: years,
    kwhPerMOut,
    costRMBPerMOut,   // electricity only
    costUSDPerMOut,
    amortizedRMBPerHour,
    amortizedRMBPerMOut,
    blendedRMBPerMOut, // electricity + amortized hardware (Tab 4 comparison basis)
    blendedUSDPerMOut,
  };
}

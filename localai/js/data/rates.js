/**
 * v100 — Cost constants (Shenzhen electricity + FX)
 * ===================================================
 * Used by engine/cost.js and the Tab 4 cost panel.
 * Blueprint §3.5: local cost = hardware price (amortized, default 3 yr) + electricity only.
 */

export const RATES_DATA_AS_OF = '2026-09-01';

export const RATES = {
  /**
   * Default residential rate used by the engine, RMB per kWh.
   * Chosen as a round midpoint between:
   *  - Shenzhen residential tier-1 ≈ 0.66 RMB/kWh (eyeshenzhen.com schedule) [R8a]
   *  - Shenzhen industrial 35 kV+ = 0.610 RMB/kWh, Jul 2026 (CEIC/NDRC) [R8b]
   */
  cnyPerKwh: 0.65,

  /**
   * USD → CNY mid-market rate. Verified late Aug 2026 across Xe (6.7204),
   * Wise (6.7193 on Aug 31, 2026 — 6-month low), Bloomberg (6.7192), Yahoo (6.7199).
   * NOTE: supersedes the blueprint's ~7.2 assumption.
   */
  usdCny: 6.72,

  /** Default hardware amortization horizon in years (blueprint §3.5). */
  amortizationYearsDefault: 3,
};

export const RATES_SOURCES = [
  { id: 'R8a', label: 'Shenzhen residential electricity price schedule (tier-1 ≈0.6629 RMB/kWh)', url: 'https://www.eyeshenzhen.com' },
  { id: 'R8b', label: 'CEIC: Shenzhen industrial electricity, 35 kV & above: 0.610 RMB/kWh (Jul 2026, constant from prior month)', url: 'https://www.ceicdata.com' },
  { id: 'FX1', label: 'Wise mid-market USD/CNY history: 6.7193 on Aug 31, 2026; 6-month average 6.8057', url: 'https://wise.com/us/currency-converter/usd-to-cny-rate/history' },
];

/**
 * v100 — Shared reactive store (blueprint §4)
 * =========================================================
 * Single source of truth; every tab subscribes. Node-safe: no DOM/localStorage
 * access at import time (guarded), so the engine + store are testable in Node.
 *
 *   state = { config, derived: {ok, perf, cost}, ui: {activeTab, theme, visitedTabs} }
 *
 * - `setConfig(partial)` merges into the current config, validates against the data layer,
 *  recomputes all derived metrics (perf.evaluate + cost.computeCost), persists, notifies.
 * - Persists `config` + `visitedTabs` + manual theme to localStorage (blueprint §4);
 *  falls back gracefully when storage is unavailable (Node tests, private mode).
 */

import { evaluate } from '../engine/perf.js';
import { computeCost } from '../engine/cost.js';
import { ALL_IN_ONES, GPUS, RAM_TIERS, CPUS } from '../data/hardware.js';
import { MODEL_STOPS } from '../data/models.js';
import { QUANT_LEVELS } from '../data/quantization.js';

export const TAB_IDS = ['home', 'pipeline', 'lab', 'compare'];
export const CONTEXT_WINDOWS = [8192, 32768, 131072]; // Lab toggles: 8K / 32K / 128K (blueprint §6)
export const GPU_COUNTS = [1, 2, 4];
export const CONCURRENCIES = [1, 4, 16];
export const PROMPT_SPLITS = ['short', 'balanced', 'long'];

/** Default config — a classic local-AI rig that comfortably runs the §5.4 anchor models. */
export const DEFAULT_CONFIG = {
  mode: 'rig',
  gpuId: 'rtx-3090-24g',
  gpuCount: 1,
  ramTierId: 'ddr5-6000',
  ramCapacityGB: 64,
  cpuId: 'i5-13600k',
  modelStopIndex: 1, // 8B — middle of the slider; matches the §5.4 anchor pair
  quantId: 'q4_k_m', // community default (blueprint §3.3)
  contextWindow: 8192,
  promptSplit: 'balanced',
  concurrency: 1,
};

const STORAGE_KEY = 'v100.state.v1';

function safeStorage() {
  try { if (typeof localStorage !== 'undefined') return localStorage; } catch { /* ignore */ }
  return null;
}

/** @returns {string[]} list of problems (empty when valid). */
export function validateConfig(config) {
  const errs = [];
  if (!['allInOne', 'rig'].includes(config.mode)) errs.push(`mode must be 'allInOne' or 'rig'`);

  if (config.mode === 'allInOne') {
    if (!ALL_IN_ONES.some((x) => x.id === config.platformId)) errs.push(`unknown platformId: ${config.platformId}`);
  } else {
    if (!GPUS.some((x) => x.id === config.gpuId)) errs.push(`unknown gpuId: ${config.gpuId}`);
    if (!GPU_COUNTS.includes(config.gpuCount)) errs.push(`gpuCount must be one of ${GPU_COUNTS.join('/')}`);
    const tier = RAM_TIERS.find((x) => x.id === config.ramTierId);
    if (!tier) errs.push(`unknown ramTierId: ${config.ramTierId}`);
    else if (!tier.capacitiesGB.includes(config.ramCapacityGB)) {
      errs.push(`ramCapacityGB must be one of ${tier.capacitiesGB.join('/')} for tier ${tier.id}`);
    }
    if (!CPUS.some((x) => x.id === config.cpuId)) errs.push(`unknown cpuId: ${config.cpuId}`);
  }

  if (!Number.isInteger(config.modelStopIndex) || config.modelStopIndex < 0 || config.modelStopIndex >= MODEL_STOPS.length) {
    errs.push(`modelStopIndex must be an integer in [0, ${MODEL_STOPS.length - 1}]`);
  }
  if (!QUANT_LEVELS.some((x) => x.id === config.quantId)) errs.push(`unknown quantId: ${config.quantId}`);
  if (!CONTEXT_WINDOWS.includes(config.contextWindow)) {
    errs.push(`contextWindow must be one of ${CONTEXT_WINDOWS.join('/')}`);
  }
  if (!PROMPT_SPLITS.includes(config.promptSplit)) errs.push(`promptSplit must be one of ${PROMPT_SPLITS.join('/')}`);
  if (!CONCURRENCIES.includes(config.concurrency)) errs.push(`concurrency must be one of ${CONCURRENCIES.join('/')}`);

  return errs;
}

function loadPersisted(storage) {
  if (!storage) return null;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const config = { ...DEFAULT_CONFIG, ...(parsed.config || {}) };
    if (validateConfig(config).length > 0) return null; // corrupt/foreign state → defaults
    return {
      config,
      theme: typeof parsed.theme === 'string' ? parsed.theme : null,
      visitedTabs: Array.isArray(parsed.visitedTabs)
        ? parsed.visitedTabs.filter((t) => TAB_IDS.includes(t))
        : [],
    };
  } catch {
    return null;
  }
}

/**
 * Create a store instance.
 * @param {object} [opts]
 * @param {object} [opts.initialConfig] merged over DEFAULT_CONFIG (validated)
 * @param {?Storage} [opts.storage] inject for tests; defaults to guarded localStorage
 */
export function createStore({ initialConfig, storage } = {}) {
  const store_ = safeStorage();
  const backing = storage !== undefined ? storage : store_;

  let config = { ...DEFAULT_CONFIG, ...(initialConfig || {}) };
  const errs0 = validateConfig(config);
  if (errs0.length > 0) throw new Error(`Invalid initial config: ${errs0.join('; ')}`);

  const persisted = loadPersisted(backing);
  if (persisted && !initialConfig) {
    config = persisted.config;
  }

  const ui = {
    activeTab: 'home',
    theme: persisted ? persisted.theme : null, // null = follow prefers-color-scheme
    visitedTabs: persisted ? persisted.visitedTabs : [],
  };

  let derived = recompute();
  const listeners = new Set();

  function recompute() {
    try {
      const perf = evaluate(config);
      const cost = computeCost(config, perf);
      return { ok: true, perf, cost };
    } catch (err) {
      return { ok: false, error: String((err && err.message) || err), perf: null, cost: null };
    }
  }

  function persist() {
    if (!backing) return;
    try {
      backing.setItem(STORAGE_KEY, JSON.stringify({ config, theme: ui.theme, visitedTabs: ui.visitedTabs }));
    } catch { /* storage full/unavailable — non-fatal */ }
  }

  function emit() {
    const snapshot = getState();
    for (const fn of listeners) {
      try { fn(snapshot); } catch { /* one bad listener must not break the others */ }
    }
  }

  function applyConfig(next, { merge }) {
    // Validate BEFORE mutating: a rejected set must leave the store exactly as it was
    // (otherwise one bad call poisons `config` and every later setConfig throws too).
    const candidate = merge ? { ...config, ...next } : { ...DEFAULT_CONFIG, ...next };
    const errs = validateConfig(candidate);
    if (errs.length > 0) throw new Error(`Invalid config: ${errs.join('; ')}`);
    config = candidate;
    derived = recompute();
    persist();
    emit();
  }

  function getState() {
    return { config, derived, ui };
  }

  const store = {
    getState,
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    /** Merge a partial config (e.g. `{ quantId: 'q5_k_m' }`). Throws on invalid values. */
    setConfig(partial = {}) { applyConfig(partial, { merge: true }); },
    /** Replace the whole config with defaults (+ optional overrides). */
    resetConfig(overrides = {}) { applyConfig(overrides, { merge: false }); },
    markTabVisited(id) {
      if (!TAB_IDS.includes(id)) throw new Error(`Unknown tab id: ${id}`);
      if (!ui.visitedTabs.includes(id)) ui.visitedTabs.push(id);
      persist();
      emit();
    },
    setActiveTab(id) {
      if (!TAB_IDS.includes(id)) throw new Error(`Unknown tab id: ${id}`);
      ui.activeTab = id;
      store.markTabVisited(id);
    },
    /** 'light' | 'dark' | null (follow system). */
    setTheme(theme) {
      if (theme !== null && !['light', 'dark'].includes(theme)) throw new Error(`Invalid theme: ${theme}`);
      ui.theme = theme;
      persist();
      emit();
    },
  };

  return store;
}

/** App-wide singleton for index.html/app.js. Tests should use createStore() with injected storage. */
export const store = createStore();

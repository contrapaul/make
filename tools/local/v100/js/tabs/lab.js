/* ============================================================
   v100 — Tab 3 (Hardware Lab), blueprint §6 Tab 3.
   ------------------------------------------------------------
   P6 M1: the control rail, bound two-way to the signed-off P2 store.
     - platform mode (allInOne | rig) + AIO picker / GPU×count / RAM tier+capacity / CPU
     - model slider (§3.2 stops with anchor readout; representative stops labeled)
     - quantization segmented control (+ explainer card slot — M2 fills it)
     - context window · prompt split · concurrency toggles

   P6 M2 (next): printouts rail, memory bar states, doesn't-fit diagnosis,
                 pulse-on-change, quant explainer content.
   P6 M3/M4: Run Inference simulation + concurrency/offload teaching moments.

   The store is the single source of truth — this module never stores config
   itself; it renders `state.config` and calls `store.setConfig(partial)`.
   Pure helpers are exported for Node tests; initLab({doc, store}) is
   DI-friendly like the P4 modules (no DOM access at import time).

   DOM contract (ids/selectors used by this module — keep in sync with
   index.html and test/ui.test.mjs):
     #lab-aio-group · #lab-rig-group            mode-dependent sub-groups
     input[name=lab-mode]      input[name=lab-platform]
     input[name=lab-gpu]       input[name=lab-gpucount]
     input[name=lab-ramtier]   input[name=lab-capacity]  (labels may carry data-tier-only)
     input[name=lab-cpu]       #lab-model (range) · #lab-model-anchor
     input[name=lab-quant]     #lab-quant-explain        (M2)
     input[name=lab-ctx]       input[name=lab-split]     input[name=lab-conc]

   M2 (printouts rail):
     #po-tps · #po-ttft · #po-power · #po-cost · #po-maxfit  (each has a .v span)
     #lab-membar (.seg-gpu / .seg-cpu children) · #lab-mem-caption
     #lab-fit-state (chip, data-fit attr) · #lab-nofit · #lab-nofit-list
     #lab-quant-explain (innerHTML — own static data only)
   ============================================================ */

import { ALL_IN_ONES, RAM_TIERS } from '../data/hardware.js';
import { MODEL_STOPS } from '../data/models.js';
import { QUANT_LEVELS } from '../data/quantization.js';
import { pulse } from '../motion/scroll.js';

const defaultDoc = () => (typeof document !== 'undefined' ? document : null);

/* ---------------- pure helpers (unit-tested) ----------------- */

/** Pure: clamp a RAM capacity to the nearest value the tier offers.
 *  (DDR4 tops out at 128 GB; DDR5 adds 192/256 — blueprint §3.1.) */
export function clampCapacity(tierId, gb) {
  const tier = RAM_TIERS.find((t) => t.id === tierId);
  if (!tier || !Number.isFinite(gb)) return gb;
  let best = tier.capacitiesGB[0];
  for (const c of tier.capacitiesGB) {
    if (Math.abs(c - gb) < Math.abs(best - gb)) best = c;
  }
  return best;
}

/** Pure: the store partial needed when switching platform mode.
 *  allInOne configs must carry a valid platformId — DEFAULT_CONFIG has none,
 *  so the first switch seeds it with the first AIO (agent-decided). */
export function modeSwitchPartial(config, mode) {
  const partial = { mode };
  if (mode === 'allInOne' && !ALL_IN_ONES.some((x) => x.id === config.platformId)) {
    partial.platformId = ALL_IN_ONES[0].id;
  }
  return partial;
}

/** Pure: switching RAM tier may strand the current capacity (e.g. 192 → DDR4).
 *  Returns a safe partial with the clamped value included. */
export function tierSwitchPartial(config, tierId) {
  return { ramTierId: tierId, ramCapacityGB: clampCapacity(tierId, config.ramCapacityGB) };
}

/** Pure: anchor readout line for a model stop (blueprint §3.2 —
 *  representative stops MUST be labeled as such). */
export function anchorNote(index) {
  const s = MODEL_STOPS[index] ?? MODEL_STOPS[0];
  if (s.representative) return `${s.label} · representative stop (interpolated metadata)`;
  return `Anchored to ${s.anchor.name} · ${s.anchor.layers} layers, GQA ${s.anchor.kvHeads} KV heads`;
}

/* ---------------- M2 · printouts rail (pure + render) -------- */

/** Pure: memory-fill bar view for a perf result.
 *  gpu/cpu byte splits follow the engine's fits model (KV lives with its layer).
 *  state: 'fail' when noFit; 'warn' when any pool is ≥90 % full (agent-decided); else 'ok'. */
export function membarView(perf) {
  if (!perf || !perf.totalLayers) return null;
  const L = perf.totalLayers;
  const perLayerGB = (perf.weightsGB + perf.kvCacheGB) / L; // weights + KV-per-request, per layer
  let gpuBytes, cpuBytes;
  if (perf.fitsState === 'gpu') {
    gpuBytes = perf.weightsGB + perf.kvTotalGB;
    cpuBytes = 0;
  } else if (perf.fitsState === 'offload' || perf.fitsState === 'cpuOnly') {
    gpuBytes = perf.layersOnGpu * perLayerGB;
    cpuBytes = perf.layersOnCpu * perLayerGB;
  } else { // noFit — show the demand against the primary pool (bar reads full + fail border)
    gpuBytes = perf.weightsGB + perf.kvTotalGB;
    cpuBytes = 0;
  }
  const gpuPct = perf.gpuUsableGB > 0 ? Math.min(1, gpuBytes / perf.gpuUsableGB) : 0;
  const cpuPct = perf.ramUsableGB != null && perf.ramUsableGB > 0
    ? Math.min(1, cpuBytes / perf.ramUsableGB)
    : 0;
  const state = perf.fitsState === 'noFit' ? 'fail'
    : (Math.max(gpuPct, cpuPct) >= 0.9 ? 'warn' : 'ok');
  return { gpuPct, cpuPct, state };
}

/** Pure: fit-state chip text for a perf result (blueprint §6 Tab 3). */
export function fitChipText(perf, config) {
  if (!perf) return '—';
  switch (perf.fitsState) {
    case 'gpu':
      return config && config.mode === 'allInOne' ? 'Unified-memory resident — fast path' : 'GPU-resident — fast path';
    case 'offload':
      return `Offloaded: ${perf.layersOnGpu} GPU / ${perf.layersOnCpu} CPU layers`;
    case 'cpuOnly':
      return 'CPU-only — RAM-bandwidth bound';
    default:
      return "Doesn't fit";
  }
}

/** Pure: quantization explainer content for the selected level (blueprint §3.3). */
export function quantExplainer(quantId) {
  const q = QUANT_LEVELS.find((x) => x.id === quantId);
  if (!q || !q.explainer) return null;
  return {
    title: `${q.name} — ${q.qualityLabel}`,
    whatItIs: q.explainer.whatItIs,
    tradeOff: q.explainer.tradeOff,
    whyItMatters: q.explainer.whyItMatters,
  };
}

/* ---- formatting (pure, unit-tested) ---- */
const esc = (s) => String(s).replace(/[&<>\"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function fmtTps(x) { return x == null ? '—' : `${(Math.round(x * 10) / 10).toLocaleString()} tok/s`; }
export function fmtMs(ms) {
  if (ms == null) return '—';
  return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(2)} s`;
}
export function fmtWatts(w) { return w == null ? '—' : `${w} W`; }
/** Money: ¥/$ values are small — keep 3 decimals under 1, 2 above. */
function money(v) {
  if (v == null) return null;
  if (v >= 100) return Math.round(v).toLocaleString();
  if (v >= 1) return v.toFixed(2);
  return v.toFixed(3);
}
export function fmtCost(rmb, usd) {
  const a = money(rmb), b = money(usd);
  if (a == null && b == null) return '—';
  return `¥${a ?? '—'} · $${b ?? '—'}`;
}

/** Set one printout row's value; pulses it (§8) only when the text actually changed.
 *  Returns true when the text changed. */
function setPrintout(doc, id, text, doPulse = true) {
  const el = doc.getElementById?.(id);
  if (!el || typeof el.querySelector !== 'function') return false;
  const v = el.querySelector('.v');
  if (!v || v.textContent === text) return false;
  v.textContent = text;
  if (doPulse) pulse(el); // P3 micro-interaction: restarts cleanly on rapid changes
  return true;
}

/** Render the whole printouts rail from a store snapshot. Idempotent; DOM-only side effects.
 *  opts.pulse=false suppresses §8 pulses (used for the initial paint). */
export function renderPrintouts(doc, state, { pulse: doPulse = true } = {}) {
  if (!doc || !state) return;
  const perf = state.derived?.perf ?? null;
  const cost = state.derived?.cost ?? null;

  setPrintout(doc, 'po-tps', fmtTps(perf?.decodeTpsPerRequest), doPulse);
  setPrintout(doc, 'po-ttft', fmtMs(perf?.ttftMs), doPulse);
  setPrintout(doc, 'po-power', fmtWatts(cost?.watts), doPulse);
  setPrintout(doc, 'po-cost', perf ? fmtCost(cost?.costRMBPerMOut, cost?.costUSDPerMOut) : '—', doPulse);
  setPrintout(doc, 'po-maxfit', perf?.maxModelFits ? `${perf.maxModelFits.label}` : 'none at this precision/ctx', doPulse);

  // Memory fill bar (VRAM/RAM split) + state border
  const membar = doc.getElementById?.('lab-membar');
  if (membar && perf) {
    const view = membarView(perf);
    if (view) {
      for (const [sel, pct] of [['.seg-gpu', view.gpuPct], ['.seg-cpu', view.cpuPct]]) {
        const seg = typeof membar.querySelector === 'function' ? membar.querySelector(sel) : null;
        if (seg && seg.style && seg.style.setProperty) seg.style.setProperty('--w', `${(pct * 100).toFixed(1)}%`);
      }
      if (membar.setAttribute) membar.setAttribute('data-state', view.state);
    }
    const cap = doc.getElementById?.('lab-mem-caption');
    if (cap) cap.textContent = memoryCaption(perf, state.config);
  }

  // Fit chip + doesn't-fit diagnosis
  const chip = doc.getElementById?.('lab-fit-state');
  if (chip && perf) {
    chip.textContent = fitChipText(perf, state.config);
    if (chip.setAttribute) chip.setAttribute('data-fit', perf.fitsState);
  }
  const nofit = doc.getElementById?.('lab-nofit');
  const list = doc.getElementById?.('lab-nofit-list');
  const showNofit = Boolean(perf && perf.fitsState === 'noFit' && Array.isArray(perf.noFitSuggestions));
  if (nofit && nofit.classList) nofit.classList.toggle('is-hidden', !showNofit);
  if (list && typeof list.appendChild === 'function') {
    while (list.children && list.children.length > 0) list.removeChild(list.children[0]);
    if (showNofit) {
      for (const s of perf.noFitSuggestions) {
        const li = doc.createElement ? doc.createElement('li') : { textContent: '' };
        li.textContent = s;
        list.appendChild(li);
      }
    }
  }

  // Quantization explainer card (blueprint §3.3 — student-facing)
  const ex = doc.getElementById?.('lab-quant-explain');
  if (ex && state.config) {
    const q = quantExplainer(state.config.quantId);
    if (q && typeof ex.innerHTML === 'string') {
      ex.innerHTML = `<h5>${esc(q.title)}</h5><p>${esc(q.whatItIs)}</p><p>${esc(q.tradeOff)}</p><p>${esc(q.whyItMatters)}</p>`;
    }
  }
}

/** Pure: one-line memory caption under the fill bar. */
export function memoryCaption(perf, config) {
  if (!perf) return '—';
  const w = perf.weightsGB.toFixed(1);
  const kv = (perf.kvCacheGB * Math.max(1, config?.concurrency ?? 1)).toFixed(1);
  if (config && config.mode === 'allInOne') {
    return `${w} GB weights + ${kv} GB KV of ${perf.gpuUsableGB.toFixed(0)} GB unified pool`;
  }
  if (perf.fitsState === 'offload' || perf.fitsState === 'cpuOnly') {
    const L = perf.totalLayers;
    const perLayer = (perf.weightsGB + perf.kvCacheGB) / L;
    return `${(perf.layersOnGpu * perLayer).toFixed(1)} GB in ${perf.gpuUsableGB.toFixed(0)} GB VRAM · ${(perf.layersOnCpu * perLayer).toFixed(1)} GB in ${perf.ramUsableGB} GB RAM`;
  }
  if (perf.fitsState === 'noFit') {
    return `Needs ~${(perf.weightsGB + perf.kvTotalGB).toFixed(0)} GB — more than this rig offers`;
  }
  return `${w} GB weights + ${kv} GB KV of ${perf.gpuUsableGB.toFixed(0)} GB VRAM`;
}

/* ---------------- control binding ---------------------------- */

/** Wire the Lab control rail. DI-friendly: {doc, store}. Returns handles. */
export function initLab({ doc = defaultDoc(), store } = {}) {
  if (!doc || !store) return { syncControls() {}, unsubscribe() {} };

  const byId = (id) => doc.getElementById?.(id) ?? null;
  const radios = (name) => Array.from(doc.querySelectorAll(`input[name="${name}"]`) ?? []);

  const aioGroup = byId('lab-aio-group');
  const rigGroup = byId('lab-rig-group');
  const modelInput = byId('lab-model');
  const anchorEl = byId('lab-model-anchor');

  let syncing = false; // guard: programmatic sync must not re-trigger handlers (loop)
  let firstSync = true; // initial paint: set values, skip §8 pulses

  function setRadio(name, value) {
    const v = String(value);
    for (const r of radios(name)) r.checked = String(r.value) === v;
  }

  /** Reflect store config into the controls (initial paint + every store change). */
  function syncControls(state) {
    if (!state || !state.config) return;
    const c = state.config;
    syncing = true;
    try {
      setRadio('lab-mode', c.mode);
      if (aioGroup && aioGroup.classList) aioGroup.classList.toggle('is-hidden', c.mode !== 'allInOne');
      if (rigGroup && rigGroup.classList) rigGroup.classList.toggle('is-hidden', c.mode !== 'rig');

      if (c.mode === 'allInOne') {
        setRadio('lab-platform', c.platformId);
      } else {
        setRadio('lab-gpu', c.gpuId);
        setRadio('lab-gpucount', c.gpuCount);
        setRadio('lab-ramtier', c.ramTierId);
        const cap = clampCapacity(c.ramTierId, c.ramCapacityGB);
        setRadio('lab-capacity', cap);
        // Hide capacity chips the tier can't offer (192/256 are DDR5-only).
        for (const r of radios('lab-capacity')) {
          const label = r.parentElement;
          if (!label || !label.classList) continue;
          const only = label.dataset && label.dataset.tierOnly;
          label.classList.toggle('is-hidden', Boolean(only) && only !== c.ramTierId);
        }
        setRadio('lab-cpu', c.cpuId);
      }

      if (modelInput) {
        modelInput.value = String(c.modelStopIndex);
        // Refresh the P3 slider fill: bindRangeFill's 'input' listener updates --val.
        // Our own handler below is skipped by the `syncing` guard → no loop.
        try {
          if (typeof modelInput.dispatchEvent === 'function' && typeof Event !== 'undefined') {
            modelInput.dispatchEvent(new Event('input'));
          }
        } catch { /* non-browser context */ }
      }
      if (anchorEl) anchorEl.textContent = anchorNote(c.modelStopIndex);

      setRadio('lab-quant', c.quantId);
      setRadio('lab-ctx', c.contextWindow);
      setRadio('lab-split', c.promptSplit);
      setRadio('lab-conc', c.concurrency);

      // M2: printouts rail + quant explainer track the same snapshot.
      // First paint sets values without pulsing; later changes pulse (§8).
      renderPrintouts(doc, state, { pulse: !firstSync });
      firstSync = false;
    } finally {
      syncing = false;
    }
  }

  /* ---- control → store (each handler builds a validated partial) ---- */

  function onRadio(name, buildPartial) {
    for (const r of radios(name)) {
      r.addEventListener('change', () => {
        if (syncing) return;
        try {
          store.setConfig(buildPartial(r.value));
        } catch { /* invalid value — store unchanged; controls re-sync on next emit */ }
      });
    }
  }

  onRadio('lab-mode', (v) => modeSwitchPartial(store.getState().config, v));
  onRadio('lab-platform', (v) => ({ platformId: v }));
  onRadio('lab-gpu', (v) => ({ gpuId: v }));
  onRadio('lab-gpucount', (v) => ({ gpuCount: Number(v) }));
  onRadio('lab-ramtier', (v) => tierSwitchPartial(store.getState().config, v));
  onRadio('lab-capacity', (v) => ({ ramCapacityGB: Number(v) }));
  onRadio('lab-cpu', (v) => ({ cpuId: v }));
  onRadio('lab-quant', (v) => ({ quantId: v })); // M2 also refreshes the explainer card here
  onRadio('lab-ctx', (v) => ({ contextWindow: Number(v) }));
  onRadio('lab-split', (v) => ({ promptSplit: v }));
  onRadio('lab-conc', (v) => ({ concurrency: Number(v) }));

  if (modelInput) {
    modelInput.addEventListener('input', () => {
      if (syncing) return;
      const idx = Number(modelInput.value);
      try {
        store.setConfig({ modelStopIndex: idx });
      } catch { /* out of range — ignore */ }
    });
  }

  // Store → controls on every change (including changes made elsewhere, e.g. P7).
  const unsubscribe = store.subscribe(syncControls);
  syncControls(store.getState()); // initial paint (covers persisted config)

  return { syncControls, unsubscribe };
}

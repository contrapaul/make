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
   ============================================================ */

import { ALL_IN_ONES, RAM_TIERS } from '../data/hardware.js';
import { MODEL_STOPS } from '../data/models.js';

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

/* ============================================================
   v100 — Tab 3 (Hardware Lab), blueprint §6 Tab 3.
   ------------------------------------------------------------
   P6 M1: the control rail, bound two-way to the signed-off P2 store.
     - platform mode (allInOne | rig) + AIO picker / GPU×count / RAM tier+capacity / CPU
     - model slider (§3.2 stops with anchor readout; representative stops labeled)
     - quantization segmented control (+ explainer card slot — M2 fills it)
     - context window · prompt split · concurrency toggles

   P6 M2 (done): printouts rail, memory bar states, doesn't-fit diagnosis,
                 pulse-on-change, quant explainer content.
   P6 M3 (done): Run Inference simulation — load → prefill → decode at the engine's rate.
   P6 M4 (done): concurrency teaching moment (per-request vs total throughput, TTFT ×B
                 queueing) + offload teaching moment (one-sentence why).

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

   M3 (Run Inference simulation):
     #lab-run (data-run-state) · #lab-sim-stage · #lab-sim-loadbar (.seg)
     #lab-conveyor (chips appended as tokens emit) · #lab-gauge (--val) · #lab-tps-value
     #lab-progress-bar (.seg) · #lab-progress-label · #lab-run-meta

   M4 (teaching moments):
     #po-tps-total (row, hidden at B=1) · #po-ttft-note (queueing note, hidden at B=1)
     #lab-offload-note (one-sentence why; hidden on the fast path and noFit)
   ============================================================ */

import { ALL_IN_ONES, GPUS, RAM_TIERS } from '../data/hardware.js';
import { MODEL_STOPS } from '../data/models.js';
import { QUANT_LEVELS } from '../data/quantization.js';
import { pulse } from '../motion/scroll.js';
import { GENERATION_TARGET_TOKENS } from '../engine/perf.js';

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
  if (!perf) return '…';
  switch (perf.fitsState) {
    case 'gpu':
      return config && config.mode === 'allInOne'
        ? 'The whole model sits in shared memory, which is the fast case.'
        : 'The whole model sits on the graphics card, which is the fast case.';
    case 'offload':
      return `Split: ${perf.layersOnGpu} layers on the graphics card, ${perf.layersOnCpu} in system memory`;
    case 'cpuOnly':
      return 'Running entirely on the processor, so the speed of system memory sets the pace.';
    default:
      return 'Does not fit on this machine';
  }
}

/** Pure: quantization explainer content for the selected level (blueprint §3.3). */
export function quantExplainer(quantId) {
  const q = QUANT_LEVELS.find((x) => x.id === quantId);
  if (!q || !q.explainer) return null;
  return {
    title: `${q.name}. ${q.qualityLabel}.`,
    whatItIs: q.explainer.whatItIs,
    tradeOff: q.explainer.tradeOff,
    whyItMatters: q.explainer.whyItMatters,
  };
}

/* ---- formatting (pure, unit-tested) ---- */
const esc = (s) => String(s).replace(/[&<>\"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function fmtTps(x) { return x == null ? '…' : `${(Math.round(x * 10) / 10).toLocaleString()} tok/s`; }
export function fmtMs(ms) {
  if (ms == null) return '…';
  return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(2)} s`;
}
export function fmtWatts(w) { return w == null ? '…' : `${w} W`; }
/** Money: ¥/$ values are small — keep 3 decimals under 1, 2 above. */
function money(v) {
  if (v == null) return null;
  if (v >= 100) return Math.round(v).toLocaleString();
  if (v >= 1) return v.toFixed(2);
  return v.toFixed(3);
}
export function fmtCost(rmb, usd) {
  const a = money(rmb), b = money(usd);
  if (a == null && b == null) return '…';
  return `¥${a ?? '…'} · $${b ?? '…'}`;
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
  setPrintout(doc, 'po-cost', perf ? fmtCost(cost?.costRMBPerMOut, cost?.costUSDPerMOut) : '…', doPulse);
  setPrintout(doc, 'po-maxfit', perf?.maxModelFits ? `${perf.maxModelFits.label}` : 'none at this precision/ctx', doPulse);

  // M4 teaching moments — each row appears only when it teaches something.
  const conc = concTeaching(perf, state.config);
  if (conc) setPrintout(doc, 'po-tps-total', conc.total, doPulse);
  const tpsTotalRow = doc.getElementById?.('po-tps-total');
  if (tpsTotalRow && tpsTotalRow.classList) tpsTotalRow.classList.toggle('is-hidden', !conc);
  const ttftNoteEl = doc.getElementById?.('po-ttft-note');
  if (ttftNoteEl) {
    const noteText = conc ? conc.ttftNote : '';
    if (ttftNoteEl.textContent !== noteText) ttftNoteEl.textContent = noteText;
    if (ttftNoteEl.classList) ttftNoteEl.classList.toggle('is-hidden', !conc);
  }

  const off = offloadNote(perf, state.config);
  const offEl = doc.getElementById?.('lab-offload-note');
  if (offEl) {
    const offText = off ?? '';
    if (offEl.textContent !== offText) offEl.textContent = offText;
    if (offEl.classList) offEl.classList.toggle('is-hidden', !off);
  }

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
  if (!perf) return '…';
  const w = perf.weightsGB.toFixed(1);
  const kv = (perf.kvCacheGB * Math.max(1, config?.concurrency ?? 1)).toFixed(1);
  if (config && config.mode === 'allInOne') {
    return `${w} GB of weights and ${kv} GB of conversation store, in ${perf.gpuUsableGB.toFixed(0)} GB of shared memory`;
  }
  if (perf.fitsState === 'offload' || perf.fitsState === 'cpuOnly') {
    const L = perf.totalLayers;
    const perLayer = (perf.weightsGB + perf.kvCacheGB) / L;
    return `${(perf.layersOnGpu * perLayer).toFixed(1)} GB on the graphics card, which holds ${perf.gpuUsableGB.toFixed(0)} GB. The other ${(perf.layersOnCpu * perLayer).toFixed(1)} GB sits in ${perf.ramUsableGB} GB of system memory.`;
  }
  if (perf.fitsState === 'noFit') {
    return `Needs about ${(perf.weightsGB + perf.kvTotalGB).toFixed(0)} GB, which is more than this machine has`;
  }
  return `${w} GB of weights and ${kv} GB of conversation store, in ${perf.gpuUsableGB.toFixed(0)} GB of graphics card memory`;
}

/* ---------------- M4 · teaching moments (pure) ---------------- */

/** Pure: concurrency teaching moment — null when there is nothing to teach
 *  (concurrency 1, or no perf). The engine already computes both rates and the
 *  queued TTFT (P2 signed off); this only shapes the student-facing copy. */
export function concTeaching(perf, config) {
  const B = Math.max(1, Number(config?.concurrency) || 1);
  if (!perf || perf.decodeTpsPerRequest == null || B < 2) return null;
  return {
    total: fmtTps(perf.decodeTpsTotal),
    perReq: fmtTps(perf.decodeTpsPerRequest),
    ttftNote: `With ${B} people asking at once, the machine reads their questions one after another rather than together. So the last person waits about ${fmtMs(perf.ttftMs)} for a first word, where one person alone would wait about ${fmtMs(perf.ttftMsBase)}.`,
  };
}

/** Pure: offload teaching moment — one sentence on why the stream slows down.
 *  null when everything is on the fast path, or doesn't fit at all. */
export function offloadNote(perf, config) {
  if (!perf || (perf.fitsState !== 'offload' && perf.fitsState !== 'cpuOnly')) return null;
  const gpu = GPUS.find((g) => g.id === config?.gpuId);
  const ram = RAM_TIERS.find((t) => t.id === config?.ramTierId);
  const bwGpu = gpu ? `${gpu.bandwidthGBs} GB/s` : 'GPU bandwidth';
  const bwRam = ram ? `${ram.bandwidthGBs} GB/s` : 'RAM bandwidth';
  if (perf.fitsState === 'cpuOnly') {
    return `Why this is slow: every layer sits in system memory, which is read at ${bwRam}. The graphics card would read it at ${bwGpu}. Every single token has to wait for the slower one.`;
  }
  return `Why this is slow: ${perf.layersOnCpu} of the model's ${perf.totalLayers} layers did not fit on the graphics card, so they sit in system memory instead. That memory is read at ${bwRam}, where the graphics card manages ${bwGpu}. Every token has to pass through all of the layers, so it waits for the slow ones.`;
}

/* ---------------- M3 · Run Inference simulation --------------
   Virtual timeline (sim seconds): load → prefill beat → decode at the
   engine's per-request rate. Real time = virtual ÷ speedup, where speedup
   keeps any run within SIM_REAL_BUDGET_S and is LABELED on screen when >1
   (blueprint Tab 4 precedent: "time-compressed, labeled"). The displayed
   tok/s is always the engine's exact value → §6 acceptance (±5 %) holds by
   construction. Reduced motion (§8): instant completion, no animation.
   ------------------------------------------------------------ */

/** Agent-decided: a full run takes at most ~8 s real time; slower configs are compressed ×N and labeled. */
export const SIM_REAL_BUDGET_S = 8;
const PREFILL_BEAT_S = 0.8; // virtual-time beat for the prefill flash (true TTFT is shown numerically in printouts)

/** Pure: simulation plan from a perf result. null → can't run (doesn't fit). */
export function simPlan(perf, targetTokens = GENERATION_TARGET_TOKENS) {
  if (!perf || perf.decodeTpsPerRequest == null || !(perf.decodeTpsPerRequest > 0)) return null;
  const tps = perf.decodeTpsPerRequest;
  // Illustrative load time ∝ weights size at a nominal ~20 GB/s (labeled assumption — choreography, not physics).
  const loadS = Math.min(2, Math.max(0.5, perf.weightsGB / 20));
  const decodeS = targetTokens / tps; // true virtual seconds at the engine rate
  const totalVirtualS = loadS + PREFILL_BEAT_S + decodeS;
  const speedup = Math.max(1, totalVirtualS / SIM_REAL_BUDGET_S);
  return {
    targetTokens,
    tps,
    promptTokens: perf.promptTokens ?? 0,
    loadS,
    prefillBeatS: PREFILL_BEAT_S,
    decodeS,
    totalVirtualS,
    speedup,
    realDurationS: totalVirtualS / speedup,
  };
}

/** Pure: per-request tokens emitted by virtual time t (0 before decode starts, clamped at target).
 *  Relative epsilon keeps the exact end-time boundary from flooring to target−1 in float math. */
export function tokensAt(plan, tVirtual) {
  const t = Math.max(0, tVirtual - plan.loadS - plan.prefillBeatS);
  const raw = t * plan.tps;
  return Math.min(plan.targetTokens, Math.floor(raw + 1e-9 * (raw + 1)));
}

/** Pure: phase at virtual time t — loading → prefill → decoding → done. */
export function simPhase(plan, tVirtual) {
  if (tVirtual < plan.loadS) return 'loading';
  if (tVirtual < plan.loadS + plan.prefillBeatS) return 'prefill';
  if (tokensAt(plan, tVirtual) >= plan.targetTokens) return 'done';
  return 'decoding';
}

/** Pure: gauge fill 0..1 — full at ≥200 tok/s; the label carries the exact value. */
export function gaugeFill(tps) {
  if (!tps || !(tps > 0)) return 0;
  return Math.min(1, tps / Math.max(200, tps));
}

/** Pure: stage line for a phase (rendered into #lab-sim-stage). */
export function stageText(phase, plan) {
  if (phase === 'loading') return 'Loading weights into memory…';
  if (phase === 'prefill') return `Reading your question: ${plan.promptTokens.toLocaleString()} tokens in one pass.`;
  if (phase === 'decoding') return `Writing the answer at ${fmtTps(plan.tps)}, one token at a time.`;
  return 'Done';
}

const defaultRaf = () => (typeof requestAnimationFrame === 'function' ? requestAnimationFrame : null);
const defaultNow = () => (typeof performance !== 'undefined' && typeof performance.now === 'function'
  ? () => performance.now()
  : Date.now);

/** Wire the Run Inference simulation. DI-friendly: {doc, store, raf, now, reduced}. */
export function initSim({ doc = defaultDoc(), store, raf = defaultRaf(), now = defaultNow(), reduced } = {}) {
  if (!doc || !store) return { start() {}, cancel() {}, isRunning: () => false };

  const byId = (id) => doc.getElementById?.(id) ?? null;
  const runBtn = byId('lab-run');
  const stageEl = byId('lab-sim-stage');
  const loadbarSeg = (() => { const b = byId('lab-sim-loadbar'); return b && typeof b.querySelector === 'function' ? b.querySelector('.seg') : null; })();
  const conveyor = byId('lab-conveyor');
  const gauge = byId('lab-gauge');
  const tpsValue = byId('lab-tps-value');
  const progressSeg = (() => { const b = byId('lab-progress-bar'); return b && typeof b.querySelector === 'function' ? b.querySelector('.seg') : null; })();
  const progressLabel = byId('lab-progress-label');
  const metaEl = byId('lab-run-meta');

  // §8 courtesy: reduced motion → instant completion, no animation loop.
  const isReduced = reduced ?? (typeof matchMedia !== 'undefined' && typeof matchMedia === 'function'
    ? matchMedia('(prefers-reduced-motion: reduce)').matches
    : false);

  let rafId = null;
  let running = false;
  let chipsRendered = 0;

  function setRunState(s) { if (runBtn && runBtn.setAttribute) runBtn.setAttribute('data-run-state', s); }
  function setW(el, frac) {
    if (el && el.style && el.style.setProperty) el.style.setProperty('--w', `${Math.max(0, Math.min(100, frac * 100)).toFixed(1)}%`);
  }

  function clearConveyor() {
    chipsRendered = 0;
    if (conveyor && typeof conveyor.appendChild === 'function') {
      while (conveyor.children && conveyor.children.length > 0) conveyor.removeChild(conveyor.children[0]);
    }
  }

  /** Append per-request token chips up to n (bounded at the target — M4 reports totals separately). */
  function renderChips(n) {
    if (!conveyor || typeof doc.createElement !== 'function') return;
    while (chipsRendered < n) {
      const chip = doc.createElement('span');
      chip.className = 'chip';
      chip.textContent = `#${chipsRendered + 1}`;
      conveyor.appendChild(chip);
      chipsRendered += 1;
    }
  }

  function paintFrame(plan, tVirtual) {
    const phase = simPhase(plan, tVirtual);
    setW(loadbarSeg, Math.min(1, tVirtual / plan.loadS));
    if (stageEl) stageEl.textContent = stageText(phase, plan);
    renderChips(tokensAt(plan, tVirtual));
    if (gauge && gauge.style && gauge.style.setProperty) gauge.style.setProperty('--val', String(gaugeFill(plan.tps)));
    if (tpsValue) tpsValue.textContent = `${Math.round(plan.tps * 10) / 10}`;
    const n = tokensAt(plan, tVirtual);
    setW(progressSeg, plan.targetTokens > 0 ? n / plan.targetTokens : 0);
    if (progressLabel) progressLabel.textContent = `${n} / ${plan.targetTokens} tokens`;
  }

  function finish(plan) {
    paintFrame(plan, plan.totalVirtualS); // land on the exact final state
    running = false;
    setRunState('idle');
    const compressed = plan.speedup > 1
      ? `, sped up ${plan.speedup.toFixed(1)} times so you do not have to wait for the real thing`
      : '';
    // M4: at concurrency >1, name both rates — per-request vs total (the divergence).
    let concLine = '';
    const cfgB = Math.max(1, Number(store.getState()?.config?.concurrency) || 1);
    if (cfgB > 1) {
      const perfNow = store.getState()?.derived?.perf ?? null;
      if (perfNow && perfNow.decodeTpsTotal != null) {
        concLine = `, which is ${cfgB} people getting ${fmtTps(perfNow.decodeTpsPerRequest)} each, or ${fmtTps(perfNow.decodeTpsTotal)} of work in total`;
      }
    }
    if (metaEl) metaEl.textContent =
      `Finished. ${plan.targetTokens} tokens${cfgB > 1 ? ' for each person' : ''} in ${plan.realDurationS.toFixed(1)} seconds of real time${compressed}${concLine}. The dial shows the writing speed calculated for this hardware.`;
  }

  function start() {
    const perf = store.getState()?.derived?.perf ?? null;
    const plan = simPlan(perf);
    if (!plan) {
      setRunState('idle');
      if (stageEl) stageEl.textContent = "This model does not fit on the selected hardware. The results panel explains why and what to change.";
      return false;
    }
    cancel(); // click mid-run = restart with the current config
    clearConveyor();
    running = true;

    if (isReduced || !raf) { finish(plan); return true; } // §8 reduced motion → instant result

    const t0 = now();
    function frame() {
      if (!running) return;
      const tVirtual = ((now() - t0) / 1000) * plan.speedup;
      const clamped = Math.min(tVirtual, plan.totalVirtualS);
      // Button state machine (§8): charging through load+prefill, running while decoding.
      setRunState(simPhase(plan, clamped) === 'decoding' ? 'running' : 'charging');
      paintFrame(plan, clamped);
      if (tVirtual >= plan.totalVirtualS) { finish(plan); return; }
      rafId = raf(frame);
    }
    rafId = raf(frame);
    return true;
  }

  function cancel() {
    running = false;
    if (rafId != null && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(rafId);
    rafId = null;
    setRunState('idle');
  }

  return { start, cancel, isRunning: () => running };
}

/* ---------------- control binding ---------------------------- */

/** Wire the whole Lab tab (controls + printouts + simulation).
 *  DI-friendly: {doc, store, sim} — `sim` is forwarded to initSim ({raf, now, reduced}). */
export function initLab({ doc = defaultDoc(), store, sim: simOpts = {} } = {}) {
  if (!doc || !store) return { syncControls() {}, unsubscribe() {}, sim: { start() {}, cancel() {}, isRunning: () => false } };

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

  /* M3: Run Inference simulation — click starts; any config change mid-run
     cancels it (the numbers changed under it; agent-decided). */
  const sim = initSim({ doc, store, ...simOpts });
  const runBtn = byId('lab-run');
  if (runBtn) runBtn.addEventListener('click', () => { sim.start(); });

  // Store → controls on every change (including changes made elsewhere, e.g. P7).
  const unsubscribe = store.subscribe((state) => {
    if (sim.isRunning()) sim.cancel();
    syncControls(state);
  });
  syncControls(store.getState()); // initial paint (covers persisted config)

  return { syncControls, unsubscribe, sim };
}

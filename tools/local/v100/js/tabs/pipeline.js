/* ============================================================
   v100 — Tab 2 (How It Works pipeline), blueprint §6 Tab 2.
   ------------------------------------------------------------
   P5 M1: tab shell (horizontal 5-stage glass-card pipeline) +
          Stage 1 Tokenization — live: type a sentence, watch it
          split into token chips with REAL Qwen3 token ids
          (blueprint §6 Tab 2.1).
   P5 M2: Stage 2 Model load — live: the current config's weights
          "pour" from disk into a memory bar (blueprint §6 Tab 2.2).
          Reuses lab.js's tested pure `membarView(perf)` for the fill
          math — same segment structure as the Lab bar — and binds to
          the shared store in initPipeline (unsubscribe via destroy()).
   P5 M3: Stage 3 Prefill vs decode — live: the two-speed CONTRAST (prompt
          chewed in one fast pass, then the answer dripping one token at a
          time) bound to the same store subscription (blueprint §6 Tab 2.3).
          Reuses lab.js's tested `simPlan` / `simPhase` / `tokensAt` /
          `stageText` for the two-speed math (tVirtual is VIRTUAL SECONDS —
          the same units the Lab's sim drives) — not re-derived.
   Stages 4–5 (KV cache growth · Sampling) remain visible placeholder
   cards — they land in P5 M4–M5.

   TOKENIZER — real vocabulary subset, not an approximation:
   `tokenizeWith(vocab, text)` does greedy longest-first matching
   against a Map of tokenText → real Qwen3 token id, taken from
   `js/data/vocab.js` (a 30,747-entry subset of Qwen3's 248,320-token
   vocabulary). The leading-space convention is genuine BPE (" world"
   is one real token, id 1814, distinct from "world"). Two honest
   limits (also stated on-page under Stage 1):
     - it is a SUBSET — words outside it split into sub-pieces
     - matching is greedy longest-first, NOT true BPE merge-order
   The full 381 KB `vocab.js` is loaded LAZILY via a memoised dynamic
   import() on first use of the Stage 1 demo (never on Home/Lab, and
   never as a top-level static import of this module).

   Pure helpers are exported for Node tests (import VOCAB directly,
   exercise the sync `tokenizeWith`); `tokenize(text)` is the async
   convenience wrapper that awaits the lazy vocab. initPipeline({doc,
   store}) is DI-friendly (no DOM access at import time), same shape as
   initLab; M2 binds Stage 2 to it (M3–M5 will do the same).

   DOM contract (ids/selectors used by this module — keep in sync with
   index.html and test/ui.test.mjs):
     #pipe-token-input (text) · #pipe-token-chips (chip area) · #pipe-token-count
     #pipe-loadbar (.membar, .seg-gpu/.seg-cpu) · #pipe-load-caption · #pipe-load-layers
     #pipe-prefill-tokens · #pipe-prefill-note · #pipe-decode-tps · #pipe-decode-note
     #pipe-phase · #pipe-drip (.sim-conveyor) · #pipe-drip-label · #pipe-speed-note
   ============================================================ */

// P5 M2 reuses the tested fill math; P5 M3 reuses the tested two-speed sim plan
// + token math (requirement: don't re-derive — same source the Lab's run drives).
import { membarView, simPlan, simPhase, tokensAt, stageText, fmtTps } from './lab.js';

const defaultDoc = () => (typeof document !== 'undefined' ? document : null);

/* ---------------- pure helpers (unit-tested) ----------------- */

/** Pure: greedy LONGEST-FIRST split of `text` against a token Map.
 *  `vocab` is Map<tokenText, id> (e.g. VOCAB from js/data/vocab.js).
 *  At each position try the longest candidate substring that exists in
 *  `vocab`; emit { text, id, unknown:false }. If nothing matches, emit
 *  the single character with id null and unknown:true.
 *  Fully synchronous + DI: no vocab.js import, no DOM, no globals. */
export function tokenizeWith(vocab, text) {
  const s = String(text ?? '');
  if (!s || !vocab || typeof vocab.has !== 'function') return [];
  let maxLen = 1;
  for (const k of vocab.keys()) if (k.length > maxLen) maxLen = k.length;
  const out = [];
  let i = 0;
  while (i < s.length) {
    let best = null;
    const end = Math.min(s.length, i + maxLen);
    for (let len = end - i; len >= 1; len -= 1) {
      const cand = s.slice(i, i + len);
      if (vocab.has(cand)) { best = cand; break; }
    }
    if (best) {
      out.push({ text: best, id: vocab.get(best), unknown: false });
      i += best.length;
    } else {
      const ch = s[i];
      out.push({ text: ch, id: null, unknown: true });
      i += 1;
    }
  }
  return out;
}

/* Lazy, memoised load of the ~381 KB real vocabulary.
   NOT a top-level static import — resolved only on first use. */
let _vocabModule = null;
function loadVocabModule() {
  if (!_vocabModule) _vocabModule = import('../data/vocab.js');
  return _vocabModule;
}

/** Async convenience: tokenize `text` using the lazy real vocab. */
export async function tokenize(text) {
  const mod = await loadVocabModule();
  return tokenizeWith(mod.VOCAB, text);
}

/* ---------------- Stage 2 · Model load (P5 M2) ---------------- */

/** Pure: Stage 2 “Model load” view for a perf result (blueprint §6 Tab 2.2).
 *  The bar shows the whole memory demand the engine's fits model uses
 *  (weights + KV), so usedGB = weightsGB + kvTotalGB — the caption's
 *  “GB used vs available” pair. The fill math is lab.js's `membarView`
 *  (reused, not re-derived); this only adds the caption numbers. */
export function modelLoadView(perf) {
  if (!perf || !perf.totalLayers) return null;
  const bar = membarView(perf);
  if (!bar) return null;
  // available = the pools the demand actually draws on: VRAM on the fast path,
  // VRAM+RAM when it splits (offload/cpuOnly) or overflows (noFit — the rig's full offer)
  const splitOrOverflow = perf.fitsState === 'offload' || perf.fitsState === 'cpuOnly' || perf.fitsState === 'noFit';
  const availableGB = splitOrOverflow
    ? perf.gpuUsableGB + (perf.ramUsableGB ?? 0)
    : perf.gpuUsableGB;
  return {
    usedGB: perf.weightsGB + perf.kvTotalGB,
    availableGB,
    pct: Math.max(bar.gpuPct, bar.cpuPct),
    state: bar.state,
    gpuPct: bar.gpuPct,
    cpuPct: bar.cpuPct,
  };
}

/** Pure: one-line caption under the Stage 2 bar — GB used vs available,
 *  same voice as lab.js's memoryCaption. */
export function loadCaption(perf, config) {
  if (!perf || !modelLoadView(perf)) return '—';
  const w = perf.weightsGB.toFixed(1);
  if (perf.fitsState === 'noFit') {
    const avail = (perf.gpuUsableGB + (perf.ramUsableGB ?? 0)).toFixed(0);
    return `Needs ~${w} GB of weights, but this rig offers ${avail} GB — it doesn't fit`;
  }
  if (perf.fitsState === 'offload' || perf.fitsState === 'cpuOnly') {
    const L = perf.totalLayers;
    const perLayer = (perf.weightsGB + perf.kvCacheGB) / L;
    return `${(perf.layersOnGpu * perLayer).toFixed(1)} GB of weights pour into ${perf.gpuUsableGB.toFixed(0)} GB of VRAM, the rest overflows into RAM`;
  }
  // fitsState === 'gpu' — AIOs report their pool as gpuUsableGB
  return config && config.mode === 'allInOne'
    ? `${w} GB of weights pour into ${perf.gpuUsableGB.toFixed(0)} GB of unified memory — it fits`
    : `${w} GB of weights pour into ${perf.gpuUsableGB.toFixed(0)} GB of VRAM — it fits`;
}

/** True when the user asks for reduced motion (guarded — no matchMedia in Node). */
function prefersReducedMotion() {
  try { return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true; }
  catch { return false; }
}

/** Paint one .membar (Lab segment structure) from a modelLoadView/membarView view.
 *  pour=true animates the fill from 0 on the next frame(s) — the “pouring” beat,
 *  driven by the existing `.membar .seg { transition: width … }` rule in base.css
 *  (no new CSS needed). Under prefers-reduced-motion the final state is painted
 *  instantly instead (tabs.css also kills the transition on #pipe-loadbar). */
function paintMembar(doc, id, view, { pour = false } = {}) {
  const bar = doc.getElementById?.(id);
  if (!bar) return;
  const set = (g, c) => {
    for (const [sel, pct] of [['.seg-gpu', g], ['.seg-cpu', c]]) {
      const seg = typeof bar.querySelector === 'function' ? bar.querySelector(sel) : null;
      if (seg && seg.style && seg.style.setProperty) seg.style.setProperty('--w', `${(pct * 100).toFixed(1)}%`);
    }
  };
  if (bar.setAttribute) bar.setAttribute('data-state', view.state);
  if (pour && !prefersReducedMotion()) {
    set(0, 0); // commit the empty state first, so the width transition has a start
    const raf = globalThis.requestAnimationFrame ?? ((fn) => setTimeout(fn, 16));
    raf(() => raf(() => set(view.gpuPct, view.cpuPct)));
  } else {
    set(view.gpuPct, view.cpuPct);
  }
}

/** Render Stage 2 from a store snapshot (caption is sync; pour is the first paint only). */
function renderStage2(doc, state, { pour = false } = {}) {
  const perf = state?.derived?.perf ?? null;
  const view = perf ? modelLoadView(perf) : null;
  if (view) paintMembar(doc, 'pipe-loadbar', view, { pour });
  const cap = doc.getElementById?.('pipe-load-caption');
  if (cap) cap.textContent = loadCaption(perf, state?.config);
  const layers = doc.getElementById?.('pipe-load-layers');
  if (layers) {
    const show = perf && (perf.fitsState === 'offload' || perf.fitsState === 'cpuOnly');
    const text = show
      ? `${perf.layersOnGpu} of ${perf.totalLayers} layers ride the GPU; the rest wait on RAM, so every token is slower`
      : '';
    if (layers.textContent !== text) layers.textContent = text;
    if (layers.classList && layers.classList.toggle) layers.classList.toggle('is-hidden', !show);
  }
}

/* ---------------- Stage 3 · Prefill vs decode (P5 M3) ---------
   The deliverable is the CONTRAST, not either half: prefill chews the
   whole prompt in one fast pass (compute-bound), then decode trickles the
   answer out one token at a time (bandwidth-bound). The two-speed math is
   lab.js's tested `simPlan` + `simPhase` + `tokensAt` + `stageText` (reused,
   not re-derived) — tVirtual is in VIRTUAL SECONDS, the same units the Lab's
   run drives. We animate only the decode drip; the prefill beat is surfaced
   as its one fast pass via stageText. The displayed tok/s is always the
   engine's exact value → §6 ±5 % holds by construction. Reduced motion (§8)
   paints the final state instantly. Compression is LABELLED when >1 (Lab
   precedent: "time-compressed, labeled").
   -------------------------------------------------------------- */

/** Pure: Stage 3 "Prefill vs decode" view (blueprint §6 Tab 2.3).
 *  Reuses lab.js's `simPlan` for the two-speed structure; adds the engine's
 *  real per-request TTFT as the honest "one fast pass" duration (the sim's
 *  prefillBeatS is choreography, not physics). null → can't run. */
export function prefillDecodeView(perf) {
  const plan = simPlan(perf);
  if (!plan) return null;
  const ttftMs = perf.ttftMsBase ?? perf.ttftMs ?? null;
  return {
    promptTokens: plan.promptTokens,
    targetTokens: plan.targetTokens,
    tps: plan.tps,
    perTokenMs: 1000 / plan.tps,
    ttftMs,
    prefillS: ttftMs != null ? ttftMs / 1000 : null,
    decodeS: plan.decodeS,
    speedup: plan.speedup,
    realDurationS: plan.realDurationS,
  };
}

/** Pure: the prefill-half line (one gulp, compute-bound). */
export function prefillCaption(perf) {
  const v = prefillDecodeView(perf);
  if (!v) return '—';
  const when = v.prefillS != null
    ? (v.prefillS < 1 ? `~${v.prefillS.toFixed(2)} s` : `~${v.prefillS.toFixed(1)} s`)
    : 'a flash';
  return `one fast pass — ${v.promptTokens.toLocaleString()} tokens chewed in ${when} (compute-bound)`;
}

/** Pure: the decode-half line (a drip, bandwidth-bound). */
export function decodeCaption(perf) {
  const v = prefillDecodeView(perf);
  if (!v) return '—';
  const each = v.perTokenMs >= 1000 ? `${(v.perTokenMs / 1000).toFixed(1)} s` : `${Math.round(v.perTokenMs)} ms`;
  return `${v.targetTokens} tokens out one at a time — ~${each} each (bandwidth-bound)`;
}

/** Pure: the run's real time, with the compression LABELLED when >1. */
export function speedNote(perf) {
  const v = prefillDecodeView(perf);
  if (!v) return '';
  const compressed = v.speedup > 1 ? ` · ×${v.speedup.toFixed(1)} time-compressed` : '';
  return `A full ${v.targetTokens}-token run takes ~${v.realDurationS.toFixed(1)} s real time${compressed} — the gulp and the drip run at very different speeds, and that gap is the point.`;
}

/** Append decode chips up to `n` in the Stage 3 conveyor (bounded at target). */
function paintDrip(doc, plan, n) {
  const drip = doc.getElementById?.('pipe-drip');
  if (drip && typeof doc.createElement === 'function' && drip.children) {
    while (drip.children.length < n) {
      const chip = doc.createElement('span');
      chip.className = 'chip';
      chip.textContent = `#${drip.children.length + 1}`;
      drip.appendChild(chip);
    }
  }
  const label = doc.getElementById?.('pipe-drip-label');
  if (label) label.textContent = `${n} / ${plan.targetTokens} tokens`;
}

/** Clear the Stage 3 conveyor (for a fresh animation run). */
function dripClear(doc) {
  const drip = doc.getElementById?.('pipe-drip');
  if (drip && drip.children) while (drip.children.length) drip.removeChild(drip.children[0]);
}

/** Animate the decode drip with the Lab's tested sim (DI: raf/now; reduced →
 *  final state instantly). Skips the load beat (Stage 2 covers it) and starts
 *  at the prefill; tokensAt is 0 through the prefill, then drips. {cancel}. */
function runStage3Drip({ doc, plan, raf, now, reduced }) {
  if (reduced || !raf) {
    dripClear(doc);
    paintDrip(doc, plan, plan.targetTokens);
    return { cancel() {} };
  }
  const t0 = now();
  const tStart = plan.loadS; // Stage 3 is prefill-vs-decode; the load beat belongs to Stage 2
  let running = true;
  let rafId = null;
  function frame() {
    if (!running) return;
    const tVirtual = Math.min(tStart + ((now() - t0) / 1000) * plan.speedup, plan.totalVirtualS);
    const phaseEl = doc.getElementById?.('pipe-phase');
    if (phaseEl) phaseEl.textContent = stageText(simPhase(plan, tVirtual), plan);
    paintDrip(doc, plan, tokensAt(plan, tVirtual));
    if (tVirtual >= plan.totalVirtualS) { running = false; return; }
    rafId = raf(frame);
  }
  rafId = raf(frame);
  return {
    cancel() {
      running = false;
      if (rafId != null && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(rafId);
      rafId = null;
    },
  };
}

/* ---------------- Stage 1 · Tokenization (live) -------------- */

/** Wire the Pipeline tab (P5 M1: shell + Stage 1 demo; M2: Stage 2 live;
 *  M3: Stage 3 live).
 *  DI-friendly: {doc, store, raf, now, reduced} — `raf`/`now`/`reduced`
 *  feed the Stage 3 drip animation (same DI shape as the Lab's initSim);
 *  Stages 2 & 3 share ONE store subscription (unsubscribe via destroy()). */
export function initPipeline({ doc = defaultDoc(), store, raf, now, reduced } = {}) {
  if (!doc) return {};

  const byId = (id) => doc.getElementById?.(id) ?? null;
  const input = byId('pipe-token-input');
  const chips = byId('pipe-token-chips');
  const count = byId('pipe-token-count');

  // P5 M3: DI defaults for the drip animation (mirror initSim's defaults).
  const rafFn = raf ?? (typeof requestAnimationFrame === 'function' ? requestAnimationFrame : null);
  const nowFn = now ?? (typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? () => performance.now()
    : Date.now);
  const isReduced = reduced ?? prefersReducedMotion();
  let dripCtl = null;

  // P5 M3: render Stage 3 (numbers always; the drip animates on the first
  // paint only, then re-renders to its final state on store changes — no
  // replay jitter while the owner drags Lab controls).
  function paintStage3(state, { animate }) {
    const perf = state?.derived?.perf ?? null;
    const v = prefillDecodeView(perf);
    const setText = (id, txt) => { const el = doc.getElementById?.(id); if (el) el.textContent = txt; };
    setText('pipe-prefill-tokens', v ? v.promptTokens.toLocaleString() : '—');
    setText('pipe-prefill-note', prefillCaption(perf));
    setText('pipe-decode-tps', v ? fmtTps(v.tps) : '—');
    setText('pipe-decode-note', decodeCaption(perf));
    setText('pipe-speed-note', speedNote(perf));

    if (dripCtl && typeof dripCtl.cancel === 'function') { dripCtl.cancel(); dripCtl = null; }
    const plan = simPlan(perf);
    if (!plan) {
      dripClear(doc);
      setText('pipe-drip-label', '—');
      setText('pipe-phase', "Can't run — the model doesn't fit this hardware.");
      return;
    }
    if (animate) {
      dripCtl = runStage3Drip({ doc, plan, raf: rafFn, now: nowFn, reduced: isReduced });
    } else {
      dripClear(doc);
      paintDrip(doc, plan, plan.targetTokens);
      setText('pipe-phase', stageText('done', plan));
    }
  }

  // P5 M2 + M3: Stage 2 (Model load) and Stage 3 (Prefill vs decode) bound
  // live to the shared store via ONE subscription — changing hardware/model in
  // the Lab re-renders both here. First paint "pours" (S2) and drips (S3).
  let unsubStage2 = null;
  if (store && typeof store.subscribe === 'function' && typeof store.getState === 'function') {
    const first = store.getState();
    renderStage2(doc, first, { pour: true });
    paintStage3(first, { animate: true });
    unsubStage2 = store.subscribe((state) => {
      renderStage2(doc, state);
      paintStage3(state, { animate: false });
    });
  }

  const hasDom = !!(chips && typeof doc.createElement === 'function');

  function clearChips() {
    if (!chips) return;
    while (chips.children && chips.children.length > 0) chips.removeChild(chips.children[0]);
  }

  function addChip(text, idText) {
    if (!hasDom) return;
    const chip = doc.createElement('span'); // .chip — existing P3 utility
    chip.className = 'chip';
    chip.textContent = text.trim(); // visible text; the space lives in the data
    const idEl = doc.createElement('span'); // .chip .id — existing P3 utility
    idEl.className = 'id';
    idEl.textContent = idText;
    chip.appendChild(idEl);
    chips.appendChild(chip);
  }

  /** Brief, accessible "loading vocabulary…" state in the chip area. */
  function showLoading() {
    clearChips();
    if (hasDom) addChip('loading vocabulary…', '');
    if (count) count.textContent = 'loading vocabulary…';
  }

  /** Re-render the chip area for `text` (async: awaits the lazy vocab).
   *  Empty text short-circuits with no vocab load. Returns the tokens. */
  async function renderTokens(text) {
    const value = String(text ?? '');
    if (value === '') {
      clearChips();
      if (count) count.textContent = '0 tokens';
      return [];
    }
    if (hasDom) showLoading();
    const mod = await loadVocabModule();
    const tokens = tokenizeWith(mod.VOCAB, value);
    clearChips();
    for (const t of tokens) addChip(t.text, t.id != null ? String(t.id) : '?');
    if (count) count.textContent = `${tokens.length} ${tokens.length === 1 ? 'token' : 'tokens'}`;
    return tokens;
  }

  let pending = Promise.resolve();
  const render = (text) => { pending = renderTokens(text); return pending; };

  if (input && typeof input.addEventListener === 'function') {
    input.addEventListener('input', () => render(input.value));
  }
  render(input ? String(input.value ?? '') : ''); // initial paint (covers a pre-filled value)

  return {
    render,
    renderTokens,
    /** The in-flight render promise (so tests can await completion). */
    get pending() { return pending; },
    /** Tear down (unsubscribes the shared Stage 2 + Stage 3 store binding). */
    destroy() {
      if (dripCtl) { dripCtl.cancel(); dripCtl = null; }
      if (unsubStage2) { unsubStage2(); unsubStage2 = null; }
    },
  };
}

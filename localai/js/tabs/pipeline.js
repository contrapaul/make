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
  if (!perf || !modelLoadView(perf)) return '…';
  const w = perf.weightsGB.toFixed(1);
  if (perf.fitsState === 'noFit') {
    const avail = (perf.gpuUsableGB + (perf.ramUsableGB ?? 0)).toFixed(0);
    return `This model needs about ${w} GB of memory. This machine has ${avail} GB, so it will not fit.`;
  }
  if (perf.fitsState === 'offload' || perf.fitsState === 'cpuOnly') {
    const L = perf.totalLayers;
    const perLayer = (perf.weightsGB + perf.kvCacheGB) / L;
    return `${(perf.layersOnGpu * perLayer).toFixed(1)} GB of weights fit into ${perf.gpuUsableGB.toFixed(0)} GB of graphics card memory. The rest has to sit in system memory, which is much slower to read.`;
  }
  // fitsState === 'gpu' — AIOs report their pool as gpuUsableGB
  return config && config.mode === 'allInOne'
    ? `${w} GB of weights loaded into ${perf.gpuUsableGB.toFixed(0)} GB of shared memory. It fits.`
    : `${w} GB of weights loaded into ${perf.gpuUsableGB.toFixed(0)} GB of graphics card memory. It fits.`;
}

/* ---------- Step 5 · Sampling (P5 M5) ------------------------
   The one step on this tab with NO engine number, and it cannot
   have one: the site models memory, bandwidth and time, not what
   a model would actually predict. Producing real probabilities
   would mean running a real model in the browser.

   So the candidate list below is ILLUSTRATIVE and is labelled as
   such in the UI. What is NOT illustrative is the maths: the
   temperature and top-p transforms here are the real ones, so the
   shape a reader sees when they drag a slider is exactly how a
   real distribution responds.
   ------------------------------------------------------------ */

/** Illustrative next-token candidates after "The cat sat on the".
 *  Probabilities are made up but plausible, and sum to 1. */
export const SAMPLE_CANDIDATES = Object.freeze([
  { token: ' mat', p: 0.42 },
  { token: ' floor', p: 0.18 },
  { token: ' couch', p: 0.12 },
  { token: ' roof', p: 0.07 },
  { token: ' chair', p: 0.06 },
  { token: ' ground', p: 0.05 },
  { token: ' bed', p: 0.04 },
  { token: ' table', p: 0.03 },
  { token: ' windowsill', p: 0.02 },
  { token: ' porch', p: 0.01 },
]);

/** Pure: reshape a distribution by temperature.
 *  Softmax on scaled logits reduces to p^(1/T), renormalised.
 *  T below 1 sharpens, above 1 flattens, and at 0 it goes greedy. */
export function applyTemperature(base, temperature) {
  const list = Array.isArray(base) ? base : [];
  if (list.length === 0) return [];
  const T = Number(temperature);

  // T at or near zero is deterministic: all mass on the favourite.
  if (!Number.isFinite(T) || T <= 0.01) {
    let best = 0;
    for (let i = 1; i < list.length; i += 1) if (list[i].p > list[best].p) best = i;
    return list.map((c, i) => ({ ...c, p: i === best ? 1 : 0 }));
  }

  const powered = list.map((c) => Math.pow(Math.max(c.p, 0), 1 / T));
  const total = powered.reduce((a, b) => a + b, 0);
  if (total <= 0) return list.map((c) => ({ ...c, p: 0 }));
  return list.map((c, i) => ({ ...c, p: powered[i] / total }));
}

/** Pure: keep the smallest set of most likely tokens whose probability
 *  adds up to `topP`, discard the rest, then renormalise. Each entry is
 *  marked `kept` so the chart can show what was thrown away. */
export function applyTopP(dist, topP) {
  const list = Array.isArray(dist) ? dist : [];
  if (list.length === 0) return [];
  const limit = Math.min(Math.max(Number(topP) || 0, 0), 1);

  // Walk in probability order, keeping until the running total reaches p.
  const order = list.map((c, i) => ({ i, p: c.p })).sort((a, b) => b.p - a.p);
  const kept = new Set();
  let cum = 0;
  for (const { i, p } of order) {
    if (cum >= limit && kept.size > 0) break;
    kept.add(i);
    cum += p;
  }

  const total = list.reduce((sum, c, i) => sum + (kept.has(i) ? c.p : 0), 0);
  return list.map((c, i) => ({
    ...c,
    kept: kept.has(i),
    p: kept.has(i) && total > 0 ? c.p / total : 0,
  }));
}

/** Pure: the full chart state for the current settings. */
export function samplingView(base, { temperature = 1, topP = 1 } = {}) {
  const shaped = applyTopP(applyTemperature(base ?? SAMPLE_CANDIDATES, temperature), topP);
  const keptCount = shaped.filter((c) => c.kept).length;
  const top = shaped.reduce((a, b) => (b.p > a.p ? b : a), shaped[0] ?? { p: 0 });
  return {
    rows: shaped,
    keptCount,
    discardedCount: shaped.length - keptCount,
    topShare: top ? top.p : 0,
    topToken: top ? top.token : null,
  };
}

/** Pure: one sentence describing what the current settings did. */
export function samplingCaption(view, { temperature = 1, topP = 1 } = {}) {
  if (!view || !view.rows.length) return '…';
  const share = Math.round(view.topShare * 100);

  const shape = temperature <= 0.01
    ? 'At a temperature of 0, the model always takes its favourite word, so the same question gives the same answer every time.'
    : temperature < 1
      ? `A temperature below 1 sharpens the odds, so "${view.topToken}" now holds ${share}% of the probability and the safe choice gets safer.`
      : temperature > 1
        ? `A temperature above 1 flattens the odds, so "${view.topToken}" is down to ${share}% and unlikely words get a real chance.`
        : `At a temperature of 1 the odds are exactly as the model produced them, with "${view.topToken}" at ${share}%.`;

  const cut = view.discardedCount === 0
    ? 'Top-p is keeping every option on the list.'
    : `Top-p keeps the ${view.keptCount} most likely ${view.keptCount === 1 ? 'option' : 'options'} and discards the other ${view.discardedCount}.`;

  return `${shape} ${cut}`;
}

/** Render the probability chart into `host`. Reuses the .bw bar
 *  primitives already used by the memory-speed card, so this adds no
 *  new chart CSS: one row per candidate, discarded rows dimmed. */
export function renderSampling(doc, host, view) {
  if (!doc || !host || typeof doc.createElement !== 'function' || !view) return 0;

  while (host.children && host.children.length > 0) host.removeChild(host.children[0]);

  let n = 0;
  for (const row of view.rows) {
    const line = doc.createElement('div');
    if (line.classList && typeof line.classList.add === 'function') {
      line.classList.add('bw-row');
      if (!row.kept) line.classList.add('is-cut');
    }

    const label = doc.createElement('span');
    if (label.classList) label.classList.add('bw-label');
    label.textContent = `"${row.token}"`;
    line.appendChild(label);

    const bar = doc.createElement('span');
    if (bar.classList) bar.classList.add('bw-bar');
    const fill = doc.createElement('i');
    if (fill.style && typeof fill.style.setProperty === 'function') {
      fill.style.setProperty('--w', `${(row.p * 100).toFixed(1)}%`);
    }
    bar.appendChild(fill);
    line.appendChild(bar);

    const val = doc.createElement('b');
    if (val.classList) val.classList.add('bw-val');
    // A discarded token is not "0%", it is out of the running entirely.
    val.textContent = row.kept ? `${(row.p * 100).toFixed(1)}%` : 'cut';
    line.appendChild(val);

    host.appendChild(line);
    n += 1;
  }
  return n;
}

/* ---------- Stage 4 · KV cache growth (P5 M4) ----------------
   The store of keys and values grows linearly with the number of
   tokens in the conversation, straight from the blueprint §5
   formula: kvCacheGB = 2 × layers × kvHeads × headDim × tokens ×
   bytesPerElement / 1e9. Everything below is that one line divided
   by the context window to get a per-token cost, so nothing is
   re-derived and nothing can drift from the engine.

   The teaching moment is the comparison with the weights: on a long
   context the conversation store can grow LARGER than the model
   itself, which is why context length costs memory.
   ------------------------------------------------------------ */

/** Pure: the state of the conversation store at `tokens` tokens.
 *  Returns null without a config or engine result. */
export function kvGrowthView(perf, config, tokens) {
  if (!perf || !config || perf.kvCacheGB == null) return null;
  const ctx = Math.max(1, config.contextWindow | 0);

  // §5 is linear in token count, so the full-window figure the engine
  // already computed divides straight down to a per-token cost.
  const perTokenGB = perf.kvCacheGB / ctx;
  const t = Math.max(0, Math.min(Math.round(Number(tokens) || 0), ctx));
  const usedGB = perTokenGB * t;
  const weightsGB = perf.weightsGB;

  // The conversation length at which the store overtakes the model.
  const overtakeTokens = perTokenGB > 0 ? Math.ceil(weightsGB / perTokenGB) : null;

  return {
    tokens: t,
    contextWindow: ctx,
    perTokenMB: perTokenGB * 1000,
    usedGB,
    fullGB: perf.kvCacheGB,
    pct: t / ctx,
    weightsGB,
    shareOfWeightsPct: weightsGB > 0 ? (usedGB / weightsGB) * 100 : null,
    overtakeTokens,
    overtakesWithinWindow: overtakeTokens != null && overtakeTokens <= ctx,
  };
}

/** Pure: the GB readout under the bar. */
export function kvCaption(perf, config, tokens) {
  const v = kvGrowthView(perf, config, tokens);
  if (!v) return '…';
  const pct = Math.round(v.pct * 100);
  return `${v.usedGB.toFixed(2)} GB of memory for ${v.tokens.toLocaleString()} tokens, which is ${pct}% of this model's ${v.contextWindow.toLocaleString()} token limit.`;
}

/** Pure: the teaching line comparing the store against the model. */
export function kvCompareNote(perf, config, tokens) {
  const v = kvGrowthView(perf, config, tokens);
  if (!v) return '…';
  const each = v.perTokenMB < 1
    ? `${(v.perTokenMB * 1000).toFixed(0)} KB`
    : `${v.perTokenMB.toFixed(2)} MB`;

  if (v.overtakesWithinWindow) {
    return `Every token adds about ${each}. At around ${v.overtakeTokens.toLocaleString()} tokens the conversation store grows larger than the model itself, and it is competing with the model for the same memory.`;
  }
  const full = v.weightsGB > 0 ? Math.round((v.fullGB / v.weightsGB) * 100) : 0;
  return `Every token adds about ${each}. Even a completely full conversation stays smaller than the model here, reaching ${full}% of its size.`;
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
  if (!v) return '…';
  const when = v.prefillS != null
    ? (v.prefillS < 1 ? `about ${v.prefillS.toFixed(2)} seconds` : `about ${v.prefillS.toFixed(1)} seconds`)
    : 'a flash';
  return `${v.promptTokens.toLocaleString()} tokens read in one pass, taking ${when}. Limited by calculation speed.`;
}

/** Pure: the decode-half line (a drip, bandwidth-bound). */
export function decodeCaption(perf) {
  const v = prefillDecodeView(perf);
  if (!v) return '…';
  const each = v.perTokenMs >= 1000 ? `${(v.perTokenMs / 1000).toFixed(1)} s` : `${Math.round(v.perTokenMs)} ms`;
  return `${v.targetTokens} tokens written one at a time, about ${each} each. Limited by memory speed.`;
}

/** Pure: the run's real time, with the compression LABELLED when >1. */
export function speedNote(perf) {
  const v = prefillDecodeView(perf);
  if (!v) return '';
  const compressed = v.speedup > 1
    ? `, sped up ${v.speedup.toFixed(1)} times here so you do not have to wait for the real thing`
    : '';
  return `Writing all ${v.targetTokens} tokens takes about ${v.realDurationS.toFixed(1)} seconds in real time${compressed}. Reading and writing run at very different speeds, and that gap is the point.`;
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
    setText('pipe-prefill-tokens', v ? v.promptTokens.toLocaleString() : '…');
    setText('pipe-prefill-note', prefillCaption(perf));
    setText('pipe-decode-tps', v ? fmtTps(v.tps) : '…');
    setText('pipe-decode-note', decodeCaption(perf));
    setText('pipe-speed-note', speedNote(perf));

    if (dripCtl && typeof dripCtl.cancel === 'function') { dripCtl.cancel(); dripCtl = null; }
    const plan = simPlan(perf);
    if (!plan) {
      dripClear(doc);
      setText('pipe-drip-label', '…');
      setText('pipe-phase', "This model does not fit on the selected hardware, so there is nothing to run.");
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

  /* P5 M4: Stage 4 (KV cache growth). `kvTokens` is how far along the
     conversation the reader has dragged the slider. It is view state, not
     config, so it stays local rather than going into the shared store: it
     changes nothing about the hardware being modelled. It is clamped
     whenever the context window changes under it. */
  let kvTokens = null;

  function paintStage4(state) {
    const perf = state?.derived?.perf ?? null;
    const config = state?.config ?? null;
    const setText = (id, txt) => { const el = doc.getElementById?.(id); if (el) el.textContent = txt; };
    const ctx = Math.max(1, config?.contextWindow | 0);

    // First paint starts a quarter of the way in, so both the bar and the
    // numbers say something, rather than opening at a flat zero.
    if (kvTokens == null) kvTokens = Math.round(ctx / 4);
    kvTokens = Math.max(0, Math.min(kvTokens, ctx)); // context may have shrunk

    const slider = byId('pipe-kv-slider');
    if (slider) {
      slider.max = String(ctx);
      slider.step = String(Math.max(1, Math.round(ctx / 256)));
      slider.value = String(kvTokens);
      // Keep the filled track in sync (base.css reads --val).
      if (slider.style && typeof slider.style.setProperty === 'function') {
        slider.style.setProperty('--val', `${((kvTokens / ctx) * 100).toFixed(2)}%`);
      }
    }

    const v = kvGrowthView(perf, config, kvTokens);
    setText('pipe-kv-used', v ? `${v.usedGB.toFixed(2)} GB` : '…');
    setText('pipe-kv-tokens', v ? `${v.tokens.toLocaleString()} tokens` : '…');
    setText('pipe-kv-caption', kvCaption(perf, config, kvTokens));
    setText('pipe-kv-compare', kvCompareNote(perf, config, kvTokens));

    const bar = byId('pipe-kv-bar');
    const seg = bar && typeof bar.querySelector === 'function' ? bar.querySelector('.seg') : null;
    if (seg && seg.style && typeof seg.style.setProperty === 'function') {
      seg.style.setProperty('--w', `${((v ? v.pct : 0) * 100).toFixed(1)}%`);
    }
    // Warn once the store has outgrown the model it is sitting next to.
    if (bar && typeof bar.setAttribute === 'function') {
      bar.setAttribute('data-state', v && v.shareOfWeightsPct > 100 ? 'warn' : 'ok');
    }
  }

  // P5 M2 + M3 + M4: Stages 2, 3 and 4 are bound live to the shared store via
  // ONE subscription. Changing hardware or model in the Lab re-renders all of
  // them here. First paint "pours" (S2) and drips (S3).
  let unsubStage2 = null;
  if (store && typeof store.subscribe === 'function' && typeof store.getState === 'function') {
    const first = store.getState();
    renderStage2(doc, first, { pour: true });
    paintStage3(first, { animate: true });
    paintStage4(first);
    unsubStage2 = store.subscribe((state) => {
      renderStage2(doc, state);
      paintStage3(state, { animate: false });
      paintStage4(state);
    });

    // Dragging the slider repaints Stage 4 only. It never touches the store,
    // so it cannot restart the Stage 3 drip.
    const kvSlider = byId('pipe-kv-slider');
    if (kvSlider && typeof kvSlider.addEventListener === 'function') {
      kvSlider.addEventListener('input', () => {
        kvTokens = Math.round(Number(kvSlider.value) || 0);
        paintStage4(store.getState());
      });
    }
  }

  /* P5 M5: Step 5 (Sampling). Like the Step 4 slider these are view state,
     not config: temperature and top-p change how a model chooses words, not
     what the hardware can do, and nothing in the engine reads them. The
     store is not involved at all here, so this paints without one. */
  let temperature = 1;
  let topP = 0.9;

  function paintStage5() {
    const view = samplingView(SAMPLE_CANDIDATES, { temperature, topP });
    const setText = (id, txt) => { const el = doc.getElementById?.(id); if (el) el.textContent = txt; };

    setText('pipe-temp-value', temperature.toFixed(2));
    setText('pipe-topp-value', topP.toFixed(2));
    setText('pipe-sample-caption', samplingCaption(view, { temperature, topP }));

    const host = byId('pipe-sample-bars');
    if (host) renderSampling(doc, host, view);

    for (const [id, value, min, max] of [['pipe-temp', temperature, 0, 2], ['pipe-topp', topP, 0.05, 1]]) {
      const el = byId(id);
      if (el && el.style && typeof el.style.setProperty === 'function') {
        el.style.setProperty('--val', `${(((value - min) / (max - min)) * 100).toFixed(2)}%`);
      }
    }
  }

  const tempSlider = byId('pipe-temp');
  if (tempSlider && typeof tempSlider.addEventListener === 'function') {
    tempSlider.addEventListener('input', () => {
      temperature = Number(tempSlider.value);
      paintStage5();
    });
  }
  const toppSlider = byId('pipe-topp');
  if (toppSlider && typeof toppSlider.addEventListener === 'function') {
    toppSlider.addEventListener('input', () => {
      topP = Number(toppSlider.value);
      paintStage5();
    });
  }
  paintStage5();

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

/* ============================================================
   v100 — Tab 4 (Local vs Cloud), blueprint §6 Tab 4
   ------------------------------------------------------------
   P7 M1: the race. The same job, 256 output tokens, run by the
   reader's local configuration and by three cloud models, each
   moving at its own measured speed after its own waiting time.

   Where the numbers come from:
     - LOCAL: the signed-off engine, via the shared store. Speed
       is perf.decodeTpsPerRequest and the wait is perf.ttftMs.
     - CLOUD: js/data/cloud.js, which P1 built as the single
       source of truth, every figure carrying a source id and an
       as-of date. Nothing is invented here. A model with no
       measured speed is EXCLUDED from the race rather than
       guessed at (DeepSeek V4 Flash has outputTps: null).

   The honest bit worth preserving: GPT-5.6 Sol's wait is ~116
   seconds because it is a reasoning model and that figure
   includes thinking time at max effort. cloud.js says so, and
   asks that the race label it as thinking rather than as
   network latency. `waitLabel` below does exactly that.

   Time compression: a real race would take about two minutes,
   so it is compressed to fit RACE_REAL_BUDGET_S and the factor
   is LABELED on screen, the same contract the Lab's simulation
   uses (blueprint §6 Tab 4 acceptance: "≤20 s, labeled").

   No DOM access at import time, so it stays Node-testable.
   ============================================================ */

import { CLOUD_MODELS, CLOUD_DATA_AS_OF } from '../data/cloud.js';
import { GENERATION_TARGET_TOKENS } from '../engine/perf.js';

const defaultDoc = () => (typeof document !== 'undefined' ? document : null);
const defaultRaf = () => (typeof requestAnimationFrame === 'function' ? requestAnimationFrame : null);
const defaultNow = () => (typeof performance !== 'undefined' && typeof performance.now === 'function'
  ? () => performance.now()
  : Date.now);

/** Blueprint §6 Tab 4 acceptance: the race finishes within 20 s of real time. */
export const RACE_REAL_BUDGET_S = 20;

/** True when the reader has asked for reduced motion (guarded for Node). */
function prefersReducedMotion() {
  try {
    return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch { return false; }
}

/* ---------- building the field ------------------------------- */

/** Pure: the local machine as a racer, or null when it cannot run at all. */
export function localRacer(perf, config) {
  if (!perf || perf.decodeTpsPerRequest == null || !(perf.decodeTpsPerRequest > 0)) return null;
  return {
    id: 'local',
    isLocal: true,
    vendor: 'Your machine',
    name: config?.mode === 'allInOne' ? 'Local, all-in-one' : 'Local, your rig',
    tps: perf.decodeTpsPerRequest,
    waitS: (perf.ttftMs ?? 0) / 1000,
    waitIsThinking: false,
    contextTokens: config?.contextWindow ?? null,
    sources: [],
  };
}

/** Pure: the cloud models that can actually be raced.
 *  A model with no measured speed is left out rather than guessed. */
export function cloudRacers(models = CLOUD_MODELS) {
  return (models ?? [])
    .filter((m) => m && m.outputTps > 0 && m.ttftS != null)
    .map((m) => ({
      id: m.id,
      isLocal: false,
      vendor: m.vendor,
      name: m.name,
      tps: m.outputTps,
      waitS: m.ttftS,
      // cloud.js flags this one: the wait is the model thinking, not the network.
      waitIsThinking: /thinking/i.test(m.ttftNote ?? ''),
      contextTokens: m.contextTokens,
      sources: m.sources ?? [],
    }));
}

/** Pure: how a racer's waiting time should be described to a reader. */
export function waitLabel(racer) {
  if (!racer) return '';
  const s = racer.waitS;
  const time = s >= 10 ? `${Math.round(s)} seconds` : `${s.toFixed(1)} seconds`;
  if (racer.waitIsThinking) {
    return `${time} before it writes anything, most of it spent thinking before it answers`;
  }
  return `${time} before the first word`;
}

/**
 * Pure: the whole race.
 * Every racer waits, then writes at its own rate. The slowest finisher sets
 * the length of the race, and the compression factor is derived from that.
 */
export function racePlan(perf, config, { models = CLOUD_MODELS, targetTokens = GENERATION_TARGET_TOKENS } = {}) {
  const field = [];
  const local = localRacer(perf, config);
  if (local) field.push(local);
  field.push(...cloudRacers(models));
  if (field.length === 0) return null;

  const racers = field.map((r) => ({
    ...r,
    targetTokens,
    writeS: targetTokens / r.tps,
    finishS: r.waitS + targetTokens / r.tps,
  }));

  const slowestS = Math.max(...racers.map((r) => r.finishS));
  const speedup = Math.max(1, slowestS / RACE_REAL_BUDGET_S);

  // Ranking is by finish time, so first place is genuinely first.
  const order = [...racers].sort((a, b) => a.finishS - b.finishS);
  racers.forEach((r) => { r.place = order.findIndex((o) => o.id === r.id) + 1; });

  return {
    racers,
    targetTokens,
    slowestS,
    fastestS: Math.min(...racers.map((r) => r.finishS)),
    speedup,
    realDurationS: slowestS / speedup,
    localRan: !!local,
    asOf: CLOUD_DATA_AS_OF,
  };
}

/** Pure: tokens written by one racer at `tVirtual` seconds into the race. */
export function racerTokensAt(racer, tVirtual) {
  if (!racer) return 0;
  const t = Math.max(0, Number(tVirtual) || 0);
  if (t <= racer.waitS) return 0; // still waiting
  // Past the finishing time it is done, stated exactly. Deriving this by
  // flooring elapsed x rate leaves the slowest racer stuck one token short
  // forever, because (finishS - waitS) * tps lands a hair under the target
  // in floating point.
  if (t >= racer.finishS) return racer.targetTokens;
  return Math.min(racer.targetTokens, Math.floor((t - racer.waitS) * racer.tps));
}

/** Pure: what a racer's row should say right now. */
export function racerStatus(racer, tVirtual) {
  if (!racer) return '';
  const t = Math.max(0, Number(tVirtual) || 0);
  const done = racerTokensAt(racer, t);
  if (done >= racer.targetTokens) return `Finished in ${racer.finishS.toFixed(1)} s`;
  if (t <= racer.waitS) {
    // Count the wait up. Without this the reasoning model shows a frozen row
    // for most of the race, since its ~116 s of thinking is nearly the whole
    // thing. The bar stays empty because no tokens exist yet, which is true.
    const word = racer.waitIsThinking ? 'Thinking' : 'Waiting';
    return t >= 1 ? `${word}, ${Math.floor(t)} s so far` : `${word}…`;
  }
  return `${done} of ${racer.targetTokens} tokens`;
}

/** Pure: the labelled compression line under the race. */
export function raceNote(plan) {
  if (!plan) return '…';
  const real = `A real run of this race would take about ${Math.round(plan.slowestS)} seconds, set by the slowest finisher.`;
  if (plan.speedup <= 1) return `${real} It plays here at normal speed.`;
  return `${real} It is sped up ${plan.speedup.toFixed(1)} times here so you do not have to wait for it.`;
}

/* ---------- rendering ---------------------------------------- */

/** Render one row per racer into `host`. Reuses the .bw bar primitives. */
export function renderRace(doc, host, plan, tVirtual = 0) {
  if (!doc || !host || typeof doc.createElement !== 'function' || !plan) return 0;

  while (host.children && host.children.length > 0) host.removeChild(host.children[0]);

  for (const racer of plan.racers) {
    const row = doc.createElement('div');
    if (row.classList && typeof row.classList.add === 'function') {
      row.classList.add('bw-row');
      if (racer.isLocal) row.classList.add('is-local');
    }

    const label = doc.createElement('span');
    if (label.classList) label.classList.add('bw-label');
    label.textContent = racer.isLocal ? racer.name : `${racer.vendor} ${racer.name}`;
    row.appendChild(label);

    const bar = doc.createElement('span');
    if (bar.classList) bar.classList.add('bw-bar');
    const fill = doc.createElement('i');
    const pct = (racerTokensAt(racer, tVirtual) / racer.targetTokens) * 100;
    if (fill.style && typeof fill.style.setProperty === 'function') {
      fill.style.setProperty('--w', `${pct.toFixed(1)}%`);
    }
    bar.appendChild(fill);
    row.appendChild(bar);

    const val = doc.createElement('b');
    if (val.classList) val.classList.add('bw-val');
    val.textContent = racerStatus(racer, tVirtual);
    row.appendChild(val);

    host.appendChild(row);
  }
  return plan.racers.length;
}

/* ---------- the animated run --------------------------------- */

/**
 * Drive the race. DI `raf`/`now` so tests can step it by hand, and an
 * instant final paint when motion is reduced or no clock is available.
 * Returns { cancel }.
 */
export function runRace({ doc, host, plan, raf, now, reduced, onFrame }) {
  if (!plan) return { cancel() {} };

  if (reduced || typeof raf !== 'function' || typeof now !== 'function') {
    renderRace(doc, host, plan, plan.slowestS); // everyone finished
    if (typeof onFrame === 'function') onFrame(plan.slowestS, true);
    return { cancel() {} };
  }

  const startedAt = now();
  let cancelled = false;

  const frame = () => {
    if (cancelled) return;
    const realElapsed = (now() - startedAt) / 1000;
    const tVirtual = Math.min(realElapsed * plan.speedup, plan.slowestS);
    renderRace(doc, host, plan, tVirtual);
    const done = tVirtual >= plan.slowestS;
    if (typeof onFrame === 'function') onFrame(tVirtual, done);
    if (!done) raf(frame);
  };
  raf(frame);

  return { cancel() { cancelled = true; } };
}

/* ---------- tab wiring --------------------------------------- */

/** Wire the Compare tab. Same DI shape as the Lab's simulation. */
export function initCompare({ doc = defaultDoc(), store, raf, now, reduced } = {}) {
  if (!doc) return {};

  const byId = (id) => doc.getElementById?.(id) ?? null;
  const rafFn = raf ?? defaultRaf();
  const nowFn = now ?? defaultNow();
  const isReduced = reduced ?? prefersReducedMotion();

  let ctl = null;
  let plan = null;

  function setText(id, text) {
    const el = byId(id);
    if (el) el.textContent = text;
  }

  /** Rebuild the field from the current config and paint it at the start line. */
  function rebuild(state) {
    if (ctl && typeof ctl.cancel === 'function') { ctl.cancel(); ctl = null; }
    const perf = state?.derived?.perf ?? null;
    const config = state?.config ?? null;
    plan = racePlan(perf, config);

    const host = byId('cmp-race');
    if (host) renderRace(doc, host, plan, 0);
    setText('cmp-race-note', raceNote(plan));
    setText('cmp-race-local', plan?.localRan
      ? `Your machine is in the race, running at ${plan.racers.find((r) => r.isLocal).tps.toFixed(1)} tokens per second.`
      : 'Your current hardware cannot fit this model, so it is not in the race. Change the hardware in the Hardware Lab and it will join.');
  }

  function start() {
    if (!plan) return;
    if (ctl && typeof ctl.cancel === 'function') ctl.cancel();
    const host = byId('cmp-race');
    ctl = runRace({
      doc, host, plan, raf: rafFn, now: nowFn, reduced: isReduced,
      onFrame: (t, done) => { if (done) setText('cmp-race-note', raceNote(plan)); },
    });
  }

  const btn = byId('cmp-run');
  if (btn && typeof btn.addEventListener === 'function') btn.addEventListener('click', start);

  let unsub = null;
  if (store && typeof store.subscribe === 'function' && typeof store.getState === 'function') {
    rebuild(store.getState());
    // A hardware change in the Lab rebuilds the field, since the local racer
    // moves. It resets to the start line rather than animating unprompted.
    unsub = store.subscribe(rebuild);
  }

  return {
    start,
    getPlan: () => plan,
    destroy() {
      if (ctl && typeof ctl.cancel === 'function') ctl.cancel();
      if (typeof unsub === 'function') unsub();
    },
  };
}

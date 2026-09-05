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

import { CLOUD_MODELS, CLOUD_DATA_AS_OF, CLOUD_SUBSCRIPTIONS, CLOUD_SOURCES } from '../data/cloud.js';
import { GENERATION_TARGET_TOKENS } from '../engine/perf.js';
import { RATES } from '../data/rates.js';
import { MODEL_STOPS } from '../data/models.js';

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

/** Pure: vendor plus model, without repeating a vendor the name already
 *  carries ("DeepSeek DeepSeek V4 Pro" reads like a typo). */
export function displayName(vendor, name) {
  const v = String(vendor ?? '').trim();
  const n = String(name ?? '').trim();
  if (!v) return n;
  return n.toLowerCase().startsWith(v.toLowerCase()) ? n : `${v} ${n}`;
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

/** Pure: what a racer's row should say right now.
 *  `tVirtual` of null means the race has NOT started. Before the gun,
 *  nobody is waiting or thinking yet, so no row claims to be. */
export function racerStatus(racer, tVirtual) {
  if (!racer) return '';
  if (tVirtual == null) return 'Ready';
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

/**
 * Pure: measurement conditions a reader needs in order to read the race
 * honestly, taken from each model's own note in cloud.js.
 *
 * This exists because of a real misreading. GPT-5.6 Sol's figures are the
 * MAX reasoning effort variant, where the ~116 s wait is mostly thinking.
 * Its own note says the default effort is medium and the wait is "much
 * lower" there, which is the setting a person meets in a chat app. Racing
 * the max-effort number without saying so makes a fast model look slow.
 */
export function raceCaveats(models = CLOUD_MODELS) {
  return (models ?? [])
    .filter((m) => m.ttftNote && m.outputTps > 0 && m.ttftS != null)
    .map((m) => ({ who: displayName(m.vendor, m.name), note: forReaders(m.ttftNote) }))
    .filter((c) => c.note.length > 0);
}

/**
 * Pure: strip sentences written for whoever builds this site rather than for
 * whoever reads it. cloud.js mixes the two, e.g. GPT-5.6's TTFT note ends
 * "Race tab should label the latency offset as 'thinking time'", which is an
 * instruction to a developer and meaningless on the page.
 */
export function forReaders(note) {
  const toBuilder = /\b(race tab|cost panel|this tab|the ui) (should|must|can)\b|verify before publishing|estimate at build/i;
  return String(note ?? '')
    .split(/(?<=\.)\s+/)
    .filter((sentence) => sentence.trim() && !toBuilder.test(sentence))
    .join(' ')
    .trim();
}

/* ---------- rendering ---------------------------------------- */

/** Render one row per racer into `host`. Reuses the .bw bar primitives. */
export function renderRace(doc, host, plan, tVirtual = null) {
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
    label.textContent = racer.isLocal ? racer.name : displayName(racer.vendor, racer.name);
    row.appendChild(label);

    const bar = doc.createElement('span');
    if (bar.classList) bar.classList.add('bw-bar');
    const fill = doc.createElement('i');
    const pct = (racerTokensAt(racer, tVirtual ?? 0) / racer.targetTokens) * 100;
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

/* ---------- P7 M2 · the comparison table ---------------------
   Blueprint §6 Tab 4 lists the dimensions and sets one acceptance
   rule that shapes everything here: EVERY AUTHORITATIVE NUMBER
   CARRIES A FOOTNOTE. So a cell is not a string, it is
   { text, sources }, and the footnote list under the table is
   built from the sources actually cited rather than dumping the
   whole source file on the reader.

   Where a figure does not exist, the cell says so. The local
   column has no benchmark score and no agentic-coding result
   because this site does not measure model quality, only the
   memory, speed and cost of running one. Writing "varies" in
   those cells is the honest answer, not a placeholder.
   ------------------------------------------------------------ */

const fmtRMB = (v) => (v == null ? 'Not available' : `¥${v < 1 ? v.toFixed(3) : v.toFixed(2)}`);

/** Pure: the local model's display name at the current stop. */
export function localModelName(config) {
  // MODEL_STOPS is positional: the config stores an index into it.
  const stop = MODEL_STOPS[config?.modelStopIndex ?? 0];
  if (!stop) return 'your model';
  return stop.representative ? `${stop.label} (no single anchor model)` : `${stop.label}, ${stop.anchor.name}`;
}

/** Pure: the table's column headers. Local first, then every cloud model. */
export function compareColumns(config, models = CLOUD_MODELS) {
  return [
    { id: 'local', label: 'Your machine', sub: localModelName(config) },
    ...(models ?? []).map((m) => ({ id: m.id, label: displayName(m.vendor, m.name), sub: m.tierNote?.split('.')[0] ?? '' })),
  ];
}

/** Pure: price of a million output tokens from a cloud model, in RMB. */
function cloudOutputRMB(model, rates = RATES) {
  const usd = model?.pricing?.outputUSD;
  return usd == null ? null : usd * rates.usdCny;
}

/**
 * Pure: every row of the comparison table.
 * A cell is { text, sources } so the footnote markers can be rendered from
 * the same structure the text comes from.
 */
export function compareRows(perf, config, cost, { models = CLOUD_MODELS, rates = RATES } = {}) {
  const cloud = models ?? [];
  const cell = (text, sources = []) => ({ text, sources });
  const row = (label, localCell, cloudFn, note = null) => ({
    label, note, cells: [localCell, ...cloud.map(cloudFn)],
  });

  const localFits = perf && perf.decodeTpsPerRequest != null;

  return [
    row('Writing speed',
      cell(localFits ? `${perf.decodeTpsPerRequest.toFixed(1)} tokens per second` : 'Will not run on this hardware'),
      (m) => cell(m.outputTps ? `${m.outputTps.toFixed(1)} tokens per second` : 'Not published', m.speedSource ? [m.speedSource] : []),
      'Your figure is calculated live by this site\'s engine. Cloud figures are measured on each vendor\'s own API.'),

    row('Wait before the first word',
      cell(localFits && perf.ttftMs != null ? `${(perf.ttftMs / 1000).toFixed(1)} seconds` : 'Not applicable'),
      (m) => cell(m.ttftS == null ? 'Not published' : `${m.ttftS < 10 ? m.ttftS.toFixed(1) : Math.round(m.ttftS)} seconds`,
        m.speedSource ? [m.speedSource] : []),
      'A reasoning model spends this time thinking, not waiting on the network.'),

    row('Cost per million words written',
      cell(cost?.blendedRMBPerMOut != null ? `${fmtRMB(cost.blendedRMBPerMOut)}` : 'Not available'),
      (m) => cell(fmtRMB(cloudOutputRMB(m, rates)), m.sources?.slice(0, 1) ?? []),
      `Your cost is the electricity used plus the hardware spread over ${cost?.amortizationYears ?? 3} years. Cloud cost is the published price of output tokens, converted at ${rates.usdCny} yuan to the dollar. These are different kinds of cost and the comparison is only rough.`),

    row('Paying by subscription instead',
      cell('There is no subscription. You bought the hardware and you pay for electricity.'),
      (m) => {
        const sub = CLOUD_SUBSCRIPTIONS.find((x) => x.vendor === m.vendor);
        return sub
          ? cell(`${sub.plan}, $${sub.priceUSDPerMonth} a month`, sub.sources ?? [])
          : cell('No consumer subscription listed here');
      },
      'A subscription can be much cheaper than paying per token if you use it a lot, and much more expensive if you barely use it.'),

    row('Where your text goes',
      cell('Nowhere. It stays on your machine.'),
      () => cell('Over the internet to the company running the model.')),

    row('Works without internet',
      cell('Yes, completely.'),
      () => cell('No.')),

    row('How capable the model is',
      cell('Not measured here. This site models memory, speed and cost, not answer quality. Models small enough to run at home are generally less capable than the largest cloud models.'),
      (m) => cell(m.intelligenceIndex
        ? `Intelligence Index ${m.intelligenceIndex.score}, ranked ${m.intelligenceIndex.rank}`
        : 'Not scored in the sources used here',
        m.intelligenceIndex && m.speedSource ? [m.speedSource] : [])),

    row('How much it can hold in mind',
      cell(localFits
        ? `${(config?.contextWindow ?? 0).toLocaleString()} tokens, and every token of it takes memory you have to own`
        : 'Not applicable'),
      (m) => cell(`${m.contextTokens.toLocaleString()} tokens`, m.sources?.slice(0, 1) ?? []),
      'A cloud context window costs you nothing in hardware. Yours competes with the model for the same memory, which is what Step 4 of How It Works shows.'),

    row('Agentic coding',
      cell('No cited results. Running a coding agent locally is possible, but this site does not benchmark it.'),
      (m) => {
        const claim = agenticHighlight(m);
        return claim
          ? cell(claim, m.sources?.slice(0, 1) ?? [])
          : cell('No agentic coding result in the sources used here');
      }),

    row('Can you change the model itself',
      cell('Yes. The weight file is yours, so it can be fine-tuned on your own data and it will still be there next year.'),
      () => cell('No. You use the model as offered, and the vendor can change or retire it.')),
  ];
}

/**
 * Pure: a model's agentic-coding claim, or null.
 *
 * Two filters, both deliberate. `highlights` is a mixed bag (knowledge
 * cutoffs, concurrency limits), so only a claim actually about coding
 * qualifies. And a highlight carrying P1's own "verify before publishing"
 * caveat is NOT published: DeepSeek V4 Pro's SWE-bench figure says exactly
 * that, and pasting an unverified third-party number onto the page would
 * break the site's rule that every authoritative number is sourced.
 */
export function agenticHighlight(model) {
  const coding = /agentic|coding|SWE-?bench|CursorBench|AutomationBench/i;
  const unverified = /verify before publishing/i;
  return (model?.highlights ?? []).find((h) => coding.test(h) && !unverified.test(h)) ?? null;
}

/** Pure: only the sources actually cited by the table, in file order. */
export function usedSources(rows, all = CLOUD_SOURCES) {
  const ids = new Set();
  for (const r of rows ?? []) for (const c of r.cells ?? []) for (const id of c.sources ?? []) ids.add(id);
  return (all ?? []).filter((s) => ids.has(s.id));
}

/** Pure: pricing caveats worth stating under the table, straight from the data. */
export function pricingCaveats(models = CLOUD_MODELS) {
  return (models ?? [])
    .filter((m) => m.pricingNote)
    .map((m) => ({ who: `${m.vendor} ${m.name}`, note: m.pricingNote }));
}

/* ---------- rendering the table ------------------------------ */

/** Render the comparison table into `host`. Reuses base.css `table.data`. */
export function renderCompareTable(doc, host, columns, rows) {
  if (!doc || !host || typeof doc.createElement !== 'function' || !rows) return 0;
  while (host.children && host.children.length > 0) host.removeChild(host.children[0]);

  const table = doc.createElement('table');
  if (table.classList) table.classList.add('data');

  const thead = doc.createElement('thead');
  const hr = doc.createElement('tr');
  const corner = doc.createElement('th');
  corner.textContent = '';
  hr.appendChild(corner);
  for (const col of columns) {
    const th = doc.createElement('th');
    th.textContent = col.label;
    if (typeof th.setAttribute === 'function') th.setAttribute('scope', 'col');
    hr.appendChild(th);
  }
  thead.appendChild(hr);
  table.appendChild(thead);

  const tbody = doc.createElement('tbody');
  for (const r of rows) {
    const tr = doc.createElement('tr');
    const th = doc.createElement('th');
    th.textContent = r.label;
    if (typeof th.setAttribute === 'function') th.setAttribute('scope', 'row');
    tr.appendChild(th);

    for (const c of r.cells) {
      const td = doc.createElement('td');
      td.textContent = c.text;
      // Footnote markers: every authoritative number is traceable (§6 Tab 4).
      for (const id of c.sources ?? []) {
        const sup = doc.createElement('sup');
        if (sup.classList) sup.classList.add('fn');
        sup.textContent = ` [${id}]`;
        td.appendChild(sup);
      }
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  host.appendChild(table);
  return rows.length;
}

/** Render the footnote list for the sources the table actually cited. */
export function renderFootnotes(doc, host, sources) {
  if (!doc || !host || typeof doc.createElement !== 'function') return 0;
  while (host.children && host.children.length > 0) host.removeChild(host.children[0]);

  for (const src of sources ?? []) {
    const li = doc.createElement('li');
    const tag = doc.createElement('b');
    tag.textContent = `[${src.id}] `;
    li.appendChild(tag);

    const a = doc.createElement('a');
    a.textContent = src.label;
    if (typeof a.setAttribute === 'function') {
      a.setAttribute('href', src.url);
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener noreferrer');
    }
    li.appendChild(a);
    host.appendChild(li);
  }
  return (sources ?? []).length;
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
    if (host) renderRace(doc, host, plan, null); // at the start line, not waiting
    setText('cmp-race-note', raceNote(plan));

    // Measurement conditions, straight from cloud.js. Without these the
    // max-effort figures read as if they were typical.
    const caveatHost = byId('cmp-race-caveats');
    if (caveatHost && typeof doc.createElement === 'function') {
      while (caveatHost.children && caveatHost.children.length > 0) caveatHost.removeChild(caveatHost.children[0]);
      for (const c of raceCaveats()) {
        const li = doc.createElement('li');
        li.textContent = `${c.who}: ${c.note}`;
        caveatHost.appendChild(li);
      }
    }

    // P7 M2: the table moves with the hardware too, since half of it is the
    // reader's own column.
    const rows = compareRows(perf, config, state?.derived?.cost ?? null);
    const tableHost = byId('cmp-table');
    if (tableHost) renderCompareTable(doc, tableHost, compareColumns(config), rows);
    const notesHost = byId('cmp-table-notes');
    if (notesHost && typeof doc.createElement === 'function') {
      while (notesHost.children && notesHost.children.length > 0) notesHost.removeChild(notesHost.children[0]);
      for (const r of rows.filter((x) => x.note)) {
        const li = doc.createElement('li');
        li.textContent = `${r.label}: ${r.note}`;
        notesHost.appendChild(li);
      }
      for (const c of pricingCaveats()) {
        const li = doc.createElement('li');
        li.textContent = `${c.who} pricing: ${c.note}`;
        notesHost.appendChild(li);
      }
    }
    const fnHost = byId('cmp-footnotes');
    if (fnHost) renderFootnotes(doc, fnHost, usedSources(rows));
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

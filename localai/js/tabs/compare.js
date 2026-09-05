/* ============================================================
   v100 — Tab 4 (Local vs Cloud), blueprint §6 Tab 4
   ------------------------------------------------------------
   P7 M1: the race. It used to be five bars filling at published
   benchmark rates, which taught speed and nothing else. It is
   now ONE REAL PROMPT AND FIVE REAL ANSWERS (responses.md, via
   js/data/race-sample.js): each model's actual reply, streamed
   token by token at the speed that model actually produced it.
   A reader watches the wait, then reads what the wait bought.

   Where the speed comes from — the two kinds differ on purpose:
     - CLOUD: the owner's own stopwatch, in race-sample.js. Fixed.
       A cloud model does not get faster because you bought a
       graphics card, so these three never move.
     - LOCAL: nothing is stored. The engine evaluates the reader's
       own configuration with the model swapped to the stop that
       model sits at (Qwen3.8-27B at 27B, Gemma 4 E4B at 8B), so
       the two local racers move with the Hardware Lab. A model
       the reader's memory cannot hold stays on screen marked
       `cannotRun`, because that is the useful answer for them.

   The honest bits, which the page states rather than hides:
     - Two of the three cloud answers were free-tier and timed
       end to end, with no separate first-word measurement. That
       FLATTERS them: some of those seconds were really waiting.
     - Claude Opus 5 spent 7 of its 16 seconds thinking before a
       word appeared, so its row says "Thinking", not "Waiting".
     - Token counts are real, from the site's own Qwen3 tokenizer,
       not a words-per-token guess.

   Time compression: at a normal rig the whole race runs inside
   RACE_REAL_BUDGET_S and plays at TRUE speed, second for second.
   On a slow rig the slowest finisher would overrun it, so it is
   compressed and the factor is LABELED on screen — the same
   contract the Lab's simulation uses (blueprint §6 Tab 4
   acceptance: "≤20 s, labeled").

   No DOM access at import time, so it stays Node-testable.
   ============================================================ */

import { CLOUD_MODELS, CLOUD_DATA_AS_OF, CLOUD_SUBSCRIPTIONS, CLOUD_SOURCES } from '../data/cloud.js';
import { evaluate } from '../engine/perf.js';
import { RATES } from '../data/rates.js';
import { MODEL_STOPS } from '../data/models.js';
import { RACE_ENTRIES, RACE_PROMPT, RACE_SAMPLE_AS_OF, displayText, entryTps } from '../data/race-sample.js';
// Reuses the pipeline's memoised lazy vocab loader rather than pulling the
// ~381 KB tokenizer in a second time.
import { tokenize } from './pipeline.js';

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

/** Pure: index into MODEL_STOPS for a stop label like '27B'. -1 when absent. */
export function stopIndexFor(label, stops = MODEL_STOPS) {
  return (stops ?? []).findIndex((s) => s.label === label);
}

/**
 * Pure: one racer from one captured answer.
 *
 * `tokens` is the answer already run through the site's real tokenizer, so
 * the length is a real token count rather than a words-per-token guess.
 *
 * The two kinds get their speed from different places on purpose:
 *   - CLOUD keeps the rate the owner actually measured. It does not move when
 *     the reader changes hardware, because a cloud model does not.
 *   - LOCAL has no stored rate at all. The text came from a real local run,
 *     but the speed is computed here by the same engine the Lab uses, against
 *     the reader's own configuration with the model swapped to the stop this
 *     model sits at. Change the rig and these two change; the cloud three do not.
 *
 * A local model the reader's hardware cannot hold is NOT dropped. It stays in
 * the field marked `cannotRun`, because "this machine cannot run that model"
 * is the most useful thing the race can tell that reader.
 */
export function makeRacer(entry, tokens, config, { stops = MODEL_STOPS, evaluateFn = evaluate } = {}) {
  const targetTokens = tokens?.length ?? 0;
  if (!entry || !targetTokens) return null;

  const base = {
    id: entry.id,
    kind: entry.kind,
    isLocal: entry.kind === 'local',
    vendor: entry.vendor,
    name: entry.name,
    setting: entry.setting,
    capturedNote: entry.capturedNote,
    ranOn: entry.ranOn,
    tokens,
    targetTokens,
    waitIsThinking: !!entry.waitIsThinking,
    waitMeasured: !!entry.waitMeasured,
    cannotRun: false,
  };

  if (entry.kind === 'cloud') {
    const tps = entryTps(entry, targetTokens);
    if (!(tps > 0)) return null;
    const waitS = entry.waitS ?? 0;
    return { ...base, tps, waitS, writeS: targetTokens / tps, finishS: waitS + targetTokens / tps };
  }

  const idx = stopIndexFor(entry.modelStopId, stops);
  if (idx < 0 || !config) return null;

  let perf = null;
  try {
    perf = evaluateFn({ ...config, modelStopIndex: idx });
  } catch {
    return null; // an invalid rig is the Lab's problem to report, not the race's
  }

  const tps = perf?.decodeTpsPerRequest;
  if (!(tps > 0)) {
    return { ...base, tps: null, waitS: null, writeS: null, finishS: null, cannotRun: true, fitsState: perf?.fitsState ?? 'noFit' };
  }
  const waitS = (perf.ttftMs ?? 0) / 1000;
  return { ...base, tps, waitS, writeS: targetTokens / tps, finishS: waitS + targetTokens / tps, fitsState: perf.fitsState };
}

/** Pure: vendor plus model, without repeating a vendor the name already
 *  carries ("DeepSeek DeepSeek V4 Instant" reads like a typo). */
export function displayName(vendor, name) {
  const v = String(vendor ?? '').trim();
  const n = String(name ?? '').trim();
  if (!v) return n;
  return n.toLowerCase().startsWith(v.toLowerCase()) ? n : `${v} ${n}`;
}

/** Pure: how a racer's waiting time should be described to a reader. */
export function waitLabel(racer) {
  if (!racer || racer.cannotRun || racer.waitS == null) return '';
  const s = racer.waitS;
  const time = s >= 10 ? `${Math.round(s)} seconds` : `${s.toFixed(1)} seconds`;
  if (racer.waitIsThinking) return `${time} of thinking before it wrote anything`;
  if (!racer.waitMeasured) return 'the wait before the first word was not timed separately';
  return `${time} before the first word`;
}

/**
 * Pure: the whole race.
 * Every racer waits, then writes its own real answer at its own rate. The
 * slowest finisher sets the length, and the compression factor comes from that.
 */
export function racePlan(config, tokensById, { entries = RACE_ENTRIES, stops = MODEL_STOPS, evaluateFn = evaluate } = {}) {
  const racers = (entries ?? [])
    .map((e) => makeRacer(e, tokensById?.[e.id], config, { stops, evaluateFn }))
    .filter(Boolean);
  const runners = racers.filter((r) => !r.cannotRun);
  if (runners.length === 0) return null;

  // Ranking is by finish time, so first place is genuinely first.
  const order = [...runners].sort((a, b) => a.finishS - b.finishS);
  runners.forEach((r) => { r.place = order.findIndex((o) => o.id === r.id) + 1; });

  const slowestS = Math.max(...runners.map((r) => r.finishS));
  const speedup = Math.max(1, slowestS / RACE_REAL_BUDGET_S);

  return {
    racers,
    runners,
    prompt: RACE_PROMPT,
    slowestS,
    fastestS: Math.min(...runners.map((r) => r.finishS)),
    speedup,
    realDurationS: slowestS / speedup,
    localRan: runners.some((r) => r.isLocal),
    localBlocked: racers.filter((r) => r.cannotRun).map((r) => r.name),
    asOf: RACE_SAMPLE_AS_OF,
  };
}

/** Pure: tokens written by one racer at `tVirtual` seconds into the race. */
export function racerTokensAt(racer, tVirtual) {
  if (!racer || racer.cannotRun) return 0;
  const t = Math.max(0, Number(tVirtual) || 0);
  if (t <= racer.waitS) return 0; // still waiting
  // Past the finishing time it is done, stated exactly. Deriving this by
  // flooring elapsed x rate leaves the slowest racer stuck one token short
  // forever, because (finishS - waitS) * tps lands a hair under the target
  // in floating point.
  if (t >= racer.finishS) return racer.targetTokens;
  return Math.min(racer.targetTokens, Math.floor((t - racer.waitS) * racer.tps));
}

/** Pure: the answer text visible at `tVirtual`, streamed token by token the
 *  way a chat window fills in. Before the gun there is nothing to show. */
export function streamedText(racer, tVirtual) {
  if (!racer || racer.cannotRun || tVirtual == null) return '';
  const n = racerTokensAt(racer, tVirtual);
  if (n <= 0) return '';
  let out = '';
  for (let i = 0; i < n; i += 1) out += racer.tokens[i].text;
  return out;
}

/** Pure: what a racer's row should say right now.
 *  `tVirtual` of null means the race has NOT started. Before the gun,
 *  nobody is waiting or thinking yet, so no row claims to be. */
export function racerStatus(racer, tVirtual) {
  if (!racer) return '';
  if (racer.cannotRun) return 'Your hardware cannot hold this model';
  if (tVirtual == null) return 'Ready';
  const t = Math.max(0, Number(tVirtual) || 0);
  const done = racerTokensAt(racer, t);
  if (done >= racer.targetTokens) return `Finished in ${racer.finishS.toFixed(1)} s`;
  if (t <= racer.waitS) {
    // Count the wait up, so a thinking model shows a live row rather than a
    // frozen one. The text stays empty because no tokens exist yet, which is true.
    const word = racer.waitIsThinking ? 'Thinking' : 'Waiting';
    return t >= 1 ? `${word}, ${Math.floor(t)} s so far` : `${word}…`;
  }
  return `${done} of ${racer.targetTokens} tokens`;
}

/** Pure: the labelled compression line under the race. */
export function raceNote(plan) {
  if (!plan) return '…';
  const real = `A real run of this race would take about ${Math.round(plan.slowestS)} seconds, set by the slowest finisher.`;
  if (plan.speedup <= 1) return `${real} It plays here at true speed, second for second.`;
  return `${real} It is sped up ${plan.speedup.toFixed(1)} times here so you do not have to wait for it.`;
}

/**
 * Pure: the conditions a reader needs in order to read this race honestly,
 * taken from each answer's own note in race-sample.js.
 *
 * These matter more than usual here. Two of the three cloud answers were timed
 * end to end on a free tier with no separate first-word measurement, which
 * flatters them; the third spent 7 of its 16 seconds thinking. Racing those
 * numbers without saying so would sell the cloud as blazing fast.
 */
export function raceCaveats(entries = RACE_ENTRIES) {
  return (entries ?? [])
    .filter((e) => e.capturedNote)
    .map((e) => ({ who: displayName(e.vendor, e.name), note: forReaders(e.capturedNote) }))
    .filter((c) => c.note.length > 0);
}

/**
 * Pure: strip sentences written for whoever builds this site rather than for
 * whoever reads it, so a builder's note in a data file cannot leak onto the page.
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

/** Pure: the speed line under a racer's name. */
export function speedLine(racer) {
  if (!racer) return '';
  if (racer.cannotRun) return 'Not enough memory on the hardware you picked';
  const rate = `${racer.tps.toFixed(1)} tokens/s`;
  // The setting is quoted as the owner wrote it. Lower-casing it to make the
  // sentence flow turned "ChatGPT" into "chatgpt".
  return racer.isLocal
    ? `${rate}, calculated for your hardware`
    : `${rate}, measured on ${racer.setting}`;
}

/** Render one card per racer into `host`: name, speed, live status and the
 *  answer filling in. After the race the cards are simply the five answers,
 *  side by side, which is the point of racing them. */
export function renderRace(doc, host, plan, tVirtual = null) {
  if (!doc || !host || typeof doc.createElement !== 'function' || !plan) return 0;

  while (host.children && host.children.length > 0) host.removeChild(host.children[0]);

  for (const racer of plan.racers) {
    const card = doc.createElement('article');
    if (card.classList && typeof card.classList.add === 'function') {
      card.classList.add('race-card');
      if (racer.isLocal) card.classList.add('is-local');
      if (racer.cannotRun) card.classList.add('is-blocked');
      if (!racer.cannotRun && racerTokensAt(racer, tVirtual ?? 0) >= racer.targetTokens && tVirtual != null) {
        card.classList.add('is-done');
      }
    }

    const head = doc.createElement('header');
    if (head.classList) head.classList.add('race-head');

    const who = doc.createElement('b');
    if (who.classList) who.classList.add('race-who');
    who.textContent = displayName(racer.vendor, racer.name);
    head.appendChild(who);

    const tag = doc.createElement('span');
    if (tag.classList) tag.classList.add('race-tag');
    tag.textContent = racer.isLocal ? 'Local' : 'Cloud';
    head.appendChild(tag);

    if (racer.place && tVirtual != null && racerTokensAt(racer, tVirtual) >= racer.targetTokens) {
      const place = doc.createElement('span');
      if (place.classList) place.classList.add('race-place');
      place.textContent = `#${racer.place}`;
      head.appendChild(place);
    }
    card.appendChild(head);

    const speed = doc.createElement('p');
    if (speed.classList) speed.classList.add('race-speed');
    speed.textContent = speedLine(racer);
    card.appendChild(speed);

    const bar = doc.createElement('span');
    if (bar.classList) bar.classList.add('bw-bar');
    const fill = doc.createElement('i');
    const pct = racer.cannotRun ? 0 : (racerTokensAt(racer, tVirtual ?? 0) / racer.targetTokens) * 100;
    if (fill.style && typeof fill.style.setProperty === 'function') {
      fill.style.setProperty('--w', `${pct.toFixed(1)}%`);
    }
    bar.appendChild(fill);
    card.appendChild(bar);

    const status = doc.createElement('p');
    if (status.classList) status.classList.add('race-status');
    status.textContent = racerStatus(racer, tVirtual);
    card.appendChild(status);

    const answer = doc.createElement('div');
    if (answer.classList) answer.classList.add('race-answer');
    if (typeof answer.setAttribute === 'function') answer.setAttribute('aria-live', 'off');
    answer.textContent = streamedText(racer, tVirtual);
    card.appendChild(answer);

    host.appendChild(card);
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

/** Count every answer's tokens once, with the site's real tokenizer.
 *  Keyed by entry id, which is what racePlan expects. */
export async function tokenizeAnswers(entries = RACE_ENTRIES, tokenizeFn = tokenize) {
  const out = {};
  for (const e of entries ?? []) out[e.id] = await tokenizeFn(displayText(e.answer));
  return out;
}

/** Pure: the line that tells a reader where their own machine stands.
 *  Both local racers are theirs, so it names both, and says plainly when one
 *  will not fit rather than quietly dropping it from the field. */
export function localSummary(plan) {
  if (!plan) return 'Preparing the answers…';
  const local = plan.racers.filter((r) => r.isLocal);
  const running = local.filter((r) => !r.cannotRun);
  const blocked = local.filter((r) => r.cannotRun);
  const parts = [];
  if (running.length > 0) {
    const list = running.map((r) => `${r.name} at ${r.tps.toFixed(1)} tokens/s`).join(' and ');
    parts.push(`On the hardware you picked in the Hardware Lab: ${list}.`);
  }
  if (blocked.length > 0) {
    const one = blocked.length === 1;
    parts.push(`${blocked.map((r) => r.name).join(' and ')} ${one ? 'does' : 'do'} not fit in that machine's memory, so ${one ? 'it sits' : 'they sit'} this one out. Change the hardware in the Hardware Lab and ${one ? 'it joins' : 'they join'}.`);
  }
  return parts.join(' ');
}

/** Wire the Compare tab. Same DI shape as the Lab's simulation.
 *  `tokensById` is injectable so tests can skip the async vocab load. */
export function initCompare({ doc = defaultDoc(), store, raf, now, reduced, tokensById = null, tokenizeFn } = {}) {
  if (!doc) return {};

  const byId = (id) => doc.getElementById?.(id) ?? null;
  const rafFn = raf ?? defaultRaf();
  const nowFn = now ?? defaultNow();
  const isReduced = reduced ?? prefersReducedMotion();

  let ctl = null;
  let plan = null;
  let tokens = tokensById;

  function setText(id, text) {
    const el = byId(id);
    if (el) el.textContent = text;
  }

  /** Rebuild the field from the current config and paint it at the start line. */
  function rebuild(state) {
    if (ctl && typeof ctl.cancel === 'function') { ctl.cancel(); ctl = null; }
    const perf = state?.derived?.perf ?? null;
    const config = state?.config ?? null;
    // No plan until the answers have been tokenised: the field is built from
    // real token counts, so there is nothing honest to draw before then.
    plan = tokens ? racePlan(config, tokens) : null;

    setText('cmp-race-prompt', RACE_PROMPT);
    const host = byId('cmp-race');
    if (host) renderRace(doc, host, plan, null); // at the start line, not waiting
    setText('cmp-race-note', raceNote(plan));

    // Measurement conditions, straight from the owner's own capture notes.
    // Without these the free-tier end-to-end timings read as if they were
    // careful benchmarks.
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
    setText('cmp-race-local', localSummary(plan));
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
    // A hardware change in the Lab rebuilds the field, since the two local
    // racers move with it. It resets to the start line rather than animating
    // unprompted.
    unsub = store.subscribe(rebuild);

    // The vocabulary is a lazy ~381 KB import, so the field arrives a moment
    // after the tab does. Tests inject `tokensById` and skip this entirely.
    if (!tokens) {
      tokenizeAnswers(RACE_ENTRIES, tokenizeFn ?? tokenize)
        .then((t) => { tokens = t; rebuild(store.getState()); })
        .catch(() => { setText('cmp-race-note', 'The answers could not be loaded, so the race cannot run.'); });
    }
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

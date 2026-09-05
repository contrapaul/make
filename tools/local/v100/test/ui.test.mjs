/* ============================================================
   v100 — Phase 4 UI logic tests (plain Node ESM, no framework)
   ------------------------------------------------------------
   Runs the browser modules against minimal DOM stubs:
     - js/theme.js        theme resolution precedence + toggle/persist
     - js/motion/scroll.js stagger index, IO wiring, one-way reveals,
                          pulse micro-interaction, slider fill binding
     - js/app.js          hash router + exploration tracker (P4)
     - js/tabs/home.js    hero CTA → story scroll (P4)
   Run: node test/ui.test.mjs
   ============================================================ */

import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { STORAGE_KEY, resolveInitialTheme, initTheme } from '../js/theme.js';
import { revealStaggerIndex, initReveals, pulse, bindRangeFill } from '../js/motion/scroll.js';
import {
  tabFromHash, initRouter, TABS,
  TAB_TO_STORE, trackerView, unseenRouterTabs, initTracker, CELEBRATED_KEY,
} from '../js/app.js';
import { initHome } from '../js/tabs/home.js';
import {
  clampCapacity, modeSwitchPartial, tierSwitchPartial, anchorNote, initLab,
  membarView, fitChipText, quantExplainer, fmtTps, fmtMs, fmtWatts, fmtCost,
  renderPrintouts, memoryCaption, concTeaching, offloadNote,
  simPlan, tokensAt, simPhase, gaugeFill, stageText, SIM_REAL_BUDGET_S, initSim,
} from '../js/tabs/lab.js';
import { tokenizeWith, tokenize, initPipeline, modelLoadView, loadCaption, prefillDecodeView, prefillCaption, decodeCaption, speedNote, kvGrowthView, kvCaption, kvCompareNote, SAMPLE_CANDIDATES, applyTemperature, applyTopP, samplingView, samplingCaption, renderSampling } from '../js/tabs/pipeline.js';
import { VOCAB } from '../js/data/vocab.js';
import { termIdFromHash, tooltipText, renderGlossary, initTermCards, initGlossary } from '../js/tabs/glossary.js';
import { GLOSSARY } from '../js/data/glossary.js';
import {
  RACE_REAL_BUDGET_S, localRacer, cloudRacers, waitLabel, racePlan,
  racerTokensAt, racerStatus, raceNote, renderRace, runRace, initCompare,
} from '../js/tabs/compare.js';
import { CLOUD_MODELS } from '../js/data/cloud.js';
import { createStore, DEFAULT_CONFIG } from '../js/state/store.js';
import { evaluate, PROMPT_SPLIT_TOKENS, GENERATION_TARGET_TOKENS } from '../js/engine/perf.js';

let passed = 0;
const ok = (name) => { passed += 1; console.log(`  ✓ ${name}`); };

/* ---------------- theme.js ---------------- */
console.log('theme.js');

// resolveInitialTheme — precedence: hash > stored > system
assert.equal(resolveInitialTheme({ stored: 'dark', system: 'light', hash: '' }), 'dark');
assert.equal(resolveInitialTheme({ stored: null, system: 'dark', hash: '' }), 'dark');
assert.equal(resolveInitialTheme({ stored: null, system: 'light', hash: '' }), 'light');
assert.equal(resolveInitialTheme({ stored: 'light', system: 'dark', hash: '#dark' }), 'dark');
assert.equal(resolveInitialTheme({ stored: 'dark', system: 'light', hash: '#Light' }), 'light');
ok('resolveInitialTheme precedence (hash > stored > system), case-insensitive');

function makeDoc() {
  const attrs = {};
  return {
    documentElement: {
      setAttribute: (k, v) => { attrs[k] = v; },
      getAttribute: (k) => (attrs[k] ?? null),
    },
    querySelectorAll: () => [],
  };
}

function makeStorage() {
  const m = new Map();
  return {
    data: m,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
  };
}

const mediaStub = (dark) => (q) => ({ matches: q.includes('dark') ? dark : false });

{ // system default — follows OS, NOT persisted (so it can keep following)
  const doc = makeDoc(); const storage = makeStorage();
  initTheme({ doc, storage, media: mediaStub(false), hash: '' });
  assert.equal(doc.documentElement.getAttribute('data-theme'), 'light');
  assert.equal(storage.getItem(STORAGE_KEY), null);
  ok('initTheme follows the OS scheme; pure default is not persisted');
}

{ // dark OS → dark theme
  const doc = makeDoc(); const storage = makeStorage();
  initTheme({ doc, storage, media: mediaStub(true), hash: '' });
  assert.equal(doc.documentElement.getAttribute('data-theme'), 'dark');
  ok('initTheme is dark when the OS scheme is dark');
}

{ // stored choice beats OS scheme
  const doc = makeDoc(); const storage = makeStorage();
  storage.setItem(STORAGE_KEY, 'light');
  initTheme({ doc, storage, media: mediaStub(true), hash: '' });
  assert.equal(doc.documentElement.getAttribute('data-theme'), 'light');
  ok('stored manual choice beats the OS scheme');
}

{ // #hash override wins over stored + system; explicit → persisted
  const doc = makeDoc(); const storage = makeStorage();
  storage.setItem(STORAGE_KEY, 'light');
  initTheme({ doc, storage, media: mediaStub(true), hash: '#dark' });
  assert.equal(doc.documentElement.getAttribute('data-theme'), 'dark');
  assert.equal(storage.getItem(STORAGE_KEY), 'dark');
  ok('#hash override wins and persists the explicit choice');
}

{ // toggle flips + persists
  const doc = makeDoc(); const storage = makeStorage();
  const t = initTheme({ doc, storage, media: mediaStub(false), hash: '' });
  assert.equal(t.theme, 'light');
  assert.equal(t.toggle(), 'dark');
  assert.equal(doc.documentElement.getAttribute('data-theme'), 'dark');
  assert.equal(storage.getItem(STORAGE_KEY), 'dark');
  assert.equal(t.toggle(), 'light');
  ok('toggle() flips the theme and persists to localStorage("v100-theme")');
}

{ // [data-theme-toggle] button wiring
  const attrs = {};
  const btn = { listeners: {}, addEventListener(ev, fn) { this.listeners[ev] = fn; }, setAttribute() {} };
  const doc = {
    documentElement: { setAttribute: (k, v) => { attrs[k] = v; }, getAttribute: (k) => (attrs[k] ?? null) },
    querySelectorAll: (sel) => (sel === '[data-theme-toggle]' ? [btn] : []),
  };
  const storage = makeStorage();
  initTheme({ doc, storage, media: mediaStub(false), hash: '' });
  btn.listeners.click();
  assert.equal(attrs['data-theme'], 'dark');
  ok('[data-theme-toggle] click flips the theme');
}

/* ---------------- motion/scroll.js ---------------- */
console.log('motion/scroll.js');

function makeEl(extra = {}) {
  const classes = new Set();
  return Object.assign({
    attrs: {},
    hasAttribute(a) { return a in this.attrs; },
    classList: { add(c) { classes.add(c); }, remove(c) { classes.delete(c); }, contains: (c) => classes.has(c), _set: classes },
    style: { vars: {}, setProperty(k, v) { this.vars[k] = v; } },
    offsetWidth: 10,
    listeners: {},
    addEventListener(ev, fn) { (this.listeners[ev] ??= []).push(fn); },
    dispatch(ev) { for (const fn of this.listeners[ev] ?? []) fn({}); },
  }, extra);
}

{ // stagger index = ordinal among data-reveal siblings in the same parent
  const a = makeEl();
  const b = makeEl({ attrs: { 'data-reveal': true } });
  const c = makeEl({ attrs: { 'data-reveal': true } });
  const d = makeEl({ attrs: { 'data-reveal': true } });
  for (const el of [a, b, c, d]) el.parentElement = { children: [a, b, c, d] };
  assert.equal(revealStaggerIndex(b), 0);
  assert.equal(revealStaggerIndex(c), 1);
  assert.equal(revealStaggerIndex(d), 2);
  ok('--i = ordinal among data-reveal siblings in the same parent');
}

{ // IO wiring: rootMargin, observe list, one-way reveal + unobserve, disconnect
  const b = makeEl({ attrs: { 'data-reveal': true } });
  const c = makeEl({ attrs: { 'data-reveal': true } });
  for (const el of [b, c]) el.parentElement = { children: [b, c] };

  let cb = null; let opts = null; const observed = []; const unobserved = []; let disconnected = false;
  const live = new Set(); // what the observer is still watching, as a real IO would track
  class IOStub {
    constructor(callback, options) { cb = callback; opts = options; }
    observe(el) { observed.push(el); live.add(el); }
    unobserve(el) { unobserved.push(el); live.delete(el); }
    disconnect() { disconnected = true; live.clear(); }
  }
  // A real IntersectionObserver stops delivering entries for unobserved
  // targets; scroll past them all you like and the callback never runs.
  const scroll = (entries) => cb(entries.filter((e) => live.has(e.target)));

  const root = { querySelectorAll: () => [b, c] };
  const r = initReveals({ root, IO: IOStub });

  assert.equal(opts.rootMargin, '-10% 0px');
  ok('IntersectionObserver configured with rootMargin "-10% 0px" (§8)');
  assert.deepEqual(observed, [b, c]);
  assert.equal(b.style.vars['--i'], '0');
  assert.equal(c.style.vars['--i'], '1');

  scroll([{ target: b, isIntersecting: true }]);
  assert.ok(b.classList.contains('in-view'));
  assert.deepEqual(unobserved, [b], 'a revealed element is unobserved immediately');
  ok('.in-view added when the element enters the band, then the element is unobserved');

  /* Reveals are ONE-WAY (changed 2026-09-05). Reversible reveals meant an
     element parked at the band edge flipped in/out on scroll jitter and
     replayed its fade+slide — the looping/bouncing the owner reported. */
  scroll([{ target: b, isIntersecting: false }]);
  assert.ok(b.classList.contains('in-view'), 'leaving the band must NOT strip .in-view');
  scroll([{ target: b, isIntersecting: true }]);
  assert.ok(b.classList.contains('in-view'));
  assert.deepEqual(unobserved, [b], 'scrolling back over it delivers nothing — no re-trigger');
  ok('reveals are one-way: an element that left and re-entered never re-animates (§8)');

  // The jitter case that caused the bug report: stop scrolling right at the
  // band edge and the browser fires a burst of alternating entries.
  for (let i = 0; i < 8; i += 1) scroll([{ target: b, isIntersecting: i % 2 === 0 }]);
  assert.ok(b.classList.contains('in-view'), 'jitter at the band edge cannot flip it back');
  ok('8 alternating intersection events at the band edge leave the reveal untouched');

  assert.ok(!c.classList.contains('in-view'), 'an element that never entered stays hidden');
  assert.ok(live.has(c), 'and is still being watched');
  ok('elements below the fold stay hidden until they first enter the band');

  r.disconnect();
  assert.equal(disconnected, true);
  ok('disconnect() stops the observer');
}

{ // pulse micro-interaction
  const el = makeEl();
  pulse(el);
  assert.ok(el.classList.contains('is-pulsing'));
  el.dispatch('animationend');
  assert.ok(!el.classList.contains('is-pulsing'));
  ok('pulse() adds .is-pulsing and clears it on animationend');

  pulse(el); pulse(el); // rapid re-trigger must not throw or drop the class
  assert.ok(el.classList.contains('is-pulsing'));
  ok('rapid re-pulse restarts cleanly');
}

{ // bindRangeFill — --val tracks the value and updates on input
  const input = makeEl({ min: '0', max: '100', value: '63' });
  bindRangeFill(input);
  assert.equal(input.style.vars['--val'], '63.00%');
  ok('bindRangeFill sets --val from the current value (63%)');

  input.value = '25';
  input.dispatch('input');
  assert.equal(input.style.vars['--val'], '25.00%');
  ok('--val updates on the input event');
}

/* ---------------- js/app.js — hash router (tab links) ---------------- */
console.log('app.js — router');

function makeClassEl(dataset = {}) {
  const classes = new Set();
  return {
    dataset,
    classList: {
      add(c) { classes.add(c); },
      remove(c) { classes.delete(c); },
      contains(c) { return classes.has(c); },
      toggle(c, force) {
        if (force === undefined) { if (classes.has(c)) classes.delete(c); else classes.add(c); }
        else if (force) classes.add(c); else classes.delete(c);
      },
    },
  };
}

{ // tabFromHash — maps #/<tab> to a known tab; rejects theme hashes + unknowns
  assert.equal(tabFromHash('#/home'), 'home');
  assert.equal(tabFromHash('#/lab'), 'lab');
  assert.equal(tabFromHash(''), null);
  assert.equal(tabFromHash('#dark'), null);   // #light/#dark are theme overrides, not tabs
  assert.equal(tabFromHash('#/nope'), null);
  ok('tabFromHash parses #/<tab> and rejects non-tab hashes (e.g. #dark)');
}

{ // initRouter — default panel active on load; show() switches exactly one panel + its link
  const tabs = ['home', 'how', 'lab', 'compare'];
  const panels = Object.fromEntries(tabs.map((t) => [t, makeClassEl({ tab: t })]));
  const links = Object.fromEntries(tabs.map((t) => [t, makeClassEl({ tabLink: t })]));
  const doc = { querySelectorAll: (sel) => sel === '.tab-panel' ? tabs.map((t) => panels[t]) : sel === '[data-tab-link]' ? tabs.map((t) => links[t]) : [] };

  const router = initRouter({ doc, hash: '' }); // no hash → defaults to home
  assert.ok(panels.home.classList.contains('is-active'));
  assert.ok(!panels.how.classList.contains('is-active'));
  ok('initRouter shows the default (home) panel on load');

  router.show('lab'); // what a "Hardware Lab" link click does via hashchange
  assert.ok(panels.lab.classList.contains('is-active'));
  assert.ok(!panels.home.classList.contains('is-active'));
  assert.ok(links.lab.classList.contains('is-active'));
  assert.ok(!links.home.classList.contains('is-active'));
  ok('show(tab) activates exactly one panel + its nav link (tab-link click path)');

  router.show('compare');
  const active = tabs.filter((t) => panels[t].classList.contains('is-active'));
  assert.deepEqual(active, ['compare']);
  ok('switching again leaves exactly one panel active (no stacking)');
}

{ // non-app page: no .tab-panel → router is a safe no-op (design-system harness keeps #light/#dark)
  const doc = { querySelectorAll: () => [] };
  const r = initRouter({ doc, hash: '#dark' });
  assert.equal(typeof r.show, 'function');
  ok('initRouter is a no-op when there are no .tab-panel elements (harness keeps #light/#dark)');
}

/* ---------------- js/app.js — exploration tracker (P4, §4) -------- */
console.log('app.js — tracker');

{ // TAB_TO_STORE bridges the two id systems ('how' in URLs ↔ 'pipeline' in store)
  assert.deepEqual(TAB_TO_STORE, { home: 'home', how: 'pipeline', lab: 'lab', compare: 'compare' });
  ok('TAB_TO_STORE maps router ids to store ids (how → pipeline)');
}

{ // trackerView — pure derivation from a visited set; foreign ids ignored
  assert.deepEqual(trackerView([]), { count: 0, total: 4, allVisited: false });
  assert.deepEqual(trackerView(['home', 'pipeline']), { count: 2, total: 4, allVisited: false });
  assert.equal(trackerView(['home', 'pipeline', 'lab', 'compare']).allVisited, true);
  assert.equal(trackerView(['bogus-tab']).count, 0); // foreign ids never count
  ok('trackerView derives n/4 + allVisited; ignores unknown ids');
}

{ // unseenRouterTabs — "new" dots per ROUTER tab id
  assert.deepEqual(unseenRouterTabs([]), ['home', 'how', 'lab', 'compare']);
  assert.deepEqual(unseenRouterTabs(['pipeline']), ['home', 'lab', 'compare']); // how visited → no dot
  ok('unseenRouterTabs reports which tabs still show a "new" dot');
}

function tEl(extra = {}) {
  const classes = new Set();
  return Object.assign({
    dataset: {},
    attrs: {},
    textContent: '',
    offsetWidth: 10,
    style: { vars: {}, setProperty(k, v) { this.vars[k] = String(v); } },
    classList: {
      add(c) { classes.add(c); }, remove(c) { classes.delete(c); }, contains: (c) => classes.has(c),
      toggle(c, force) {
        if (force === undefined) { if (classes.has(c)) classes.delete(c); else classes.add(c); }
        else if (force) classes.add(c); else classes.delete(c);
      },
    },
    setAttribute(k, v) { this.attrs[k] = v; },
    getAttribute(k) { return this.attrs[k] ?? null; },
  }, extra);
}

function makeTrackerDoc() {
  const navDot = {}; const cardDot = {};
  const containers = [];
  for (const t of ['home', 'how', 'lab', 'compare']) {
    navDot[t] = tEl();
    containers.push(tEl({ dataset: { tabLink: t }, querySelector: (s) => (s === '.dot-new' ? navDot[t] : null) }));
  }
  for (const t of ['how', 'lab', 'compare']) { // Home's explore-grid cards
    cardDot[t] = tEl();
    containers.push(tEl({ dataset: { trackTab: t }, querySelector: (s) => (s === '.dot-new' ? cardDot[t] : null) }));
  }
  const ringLabel = tEl();
  const ring = tEl({ querySelector: (s) => (s === '.ring-label' ? ringLabel : null) });
  const badge = tEl();
  const celebrate = tEl();
  return {
    navDot, cardDot, ring, ringLabel, badge, celebrate,
    querySelectorAll: () => containers,
    getElementById: (id) => ({ 'explore-ring': ring, 'explorer-badge': badge, 'explorer-celebrate': celebrate }[id] ?? null),
  };
}

{
  const storage = makeStorage();
  const st = createStore({ storage }); // real P2 store contract, injected storage
  const doc = makeTrackerDoc();
  const tr = initTracker({ doc, storage, store: st });

  // fresh state: every dot visible (nav + cards), ring 0/4, badge hidden, no burst
  for (const t of ['home', 'how', 'lab', 'compare']) assert.ok(!doc.navDot[t].classList.contains('is-hidden'), `nav dot ${t} visible`);
  for (const t of ['how', 'lab', 'compare']) assert.ok(!doc.cardDot[t].classList.contains('is-hidden'), `card dot ${t} visible`);
  assert.equal(doc.ring.style.vars['--progress'], '0');
  assert.equal(doc.ringLabel.textContent, '0/4');
  assert.ok(doc.badge.classList.contains('is-hidden'));
  ok('fresh visitor: all dots visible, ring 0/4, badge hidden, no celebration');

  tr.markVisited('how'); // router id → store 'pipeline'
  assert.ok(doc.navDot.how.classList.contains('is-hidden') && doc.cardDot.how.classList.contains('is-hidden'));
  for (const t of ['home', 'lab', 'compare']) assert.ok(!doc.navDot[t].classList.contains('is-hidden'), `${t} still dotted`);
  assert.equal(doc.ring.style.vars['--progress'], '0.25');
  assert.equal(doc.ringLabel.textContent, '1/4');
  ok('visiting How It Works hides its dots and moves the ring to 1/4');

  tr.markVisited('lab');
  tr.markVisited('compare');
  assert.equal(doc.ringLabel.textContent, '3/4');
  assert.ok(doc.badge.classList.contains('is-hidden'));
  assert.ok(!doc.celebrate.classList.contains('is-once'), 'no burst before all-4');
  ok('3/4: badge still hidden and celebration has not fired');

  tr.markVisited('home'); // the fourth tab → all visited
  assert.ok(!doc.badge.classList.contains('is-hidden'), 'badge shown at 4/4');
  assert.equal(doc.ring.style.vars['--progress'], '1');
  assert.equal(doc.ringLabel.textContent, '4/4');
  assert.ok(doc.celebrate.classList.contains('is-once'), 'spark burst fired once');
  assert.equal(storage.getItem(CELEBRATED_KEY), '1', 'one-time flag persisted');
  ok('all-4: badge shown, ring full, celebration fires and its flag persists');

  const persisted = JSON.parse(storage.getItem('v100.state.v1'));
  // Store appends in visit order — compare as a set, not an ordered array.
  assert.deepEqual([...persisted.visitedTabs].sort(), ['compare', 'home', 'lab', 'pipeline']);
  ok('visited tabs persist through the P2 store (cross-session state)');
}

{
  // A fresh instance (new page load) with the same storage must NOT re-fire.
  const storage = makeStorage();
  const st1 = createStore({ storage });
  initTracker({ doc: makeTrackerDoc(), storage, store: st1 });
  for (const id of ['home', 'pipeline', 'lab', 'compare']) st1.setActiveTab(id);
  assert.equal(storage.getItem(CELEBRATED_KEY), '1');

  const st2 = createStore({ storage }); // restores all-4 visited state from persistence
  const doc2 = makeTrackerDoc();
  initTracker({ doc: doc2, storage, store: st2 });
  assert.ok(!doc2.celebrate.classList.contains('is-once'), 'no re-fire on load');
  assert.ok(!doc2.badge.classList.contains('is-hidden'), 'badge still shown from persisted state');

  st2.setActiveTab('lab'); // repeated update after the fact → still no burst
  assert.ok(!doc2.celebrate.classList.contains('is-once'));
  ok('celebration is one-time: fresh instance + later updates never re-fire it');
}

/* ---------------- js/tabs/home.js — hero CTA (P4) -------------- */
console.log('tabs/home.js');

{
  const target = { calls: [], scrollIntoView(o) { this.calls.push(o); } };
  const btn = { listeners: {}, addEventListener(ev, fn) { this.listeners[ev] = fn; } };
  const doc = { getElementById: (id) => (id === 'story' ? target : id === 'start-exploring' ? btn : null) };
  initHome({ doc });
  btn.listeners.click();
  assert.equal(target.calls.length, 1);
  assert.equal(target.calls[0].behavior, 'smooth'); // no matchMedia in Node → not reduced
  ok('hero CTA smooth-scrolls to the story (block: start)');
}

/* ---------------- js/tabs/lab.js — P6 M1 controls ------------- */
console.log('tabs/lab.js — P6 M1');

function makeRadio(value, label = null) {
  const el = {
    value: String(value),
    checked: false,
    listeners: {},
    addEventListener(ev, fn) { (this.listeners[ev] ??= []).push(fn); },
    dispatch(ev) { for (const fn of this.listeners[ev] ?? []) fn({}); },
  };
  if (label) el.parentElement = label;
  return el;
}

function makeLabClassEl(extra = {}) {
  const classes = new Set();
  return Object.assign({
    classList: {
      add(c) { classes.add(c); }, remove(c) { classes.delete(c); }, contains: (c) => classes.has(c),
      toggle(c, force) {
        if (force === undefined) { if (classes.has(c)) classes.delete(c); else classes.add(c); }
        else if (force) classes.add(c); else classes.delete(c);
      },
    },
  }, extra);
}

function makeLabDoc() {
  const groups = {};
  const group = (name, values, labels = {}) => {
    groups[name] = values.map((v) => makeRadio(v, labels[v] ?? null));
  };
  group('lab-mode', ['allInOne', 'rig']);
  group('lab-platform', ['mba-m5', 'mbp-m4pro-48', 'dgx-spark']);
  group('lab-gpu', ['v100-pcie-16g', 'rtx-3060-12g', 'rtx-3090-24g', 'rx-9070xt-16g', 'rtx-5070ti-16g', 'rtx-5090-32g', 'rtx-6000-ada-48g']);
  group('lab-gpucount', ['1', '2', '4']);
  group('lab-ramtier', ['ddr4-3200', 'ddr5-6000']);
  // Every capacity chip sits in a <label> (index.html); 192/256 GB are DDR5-only
  const capLabels = {};
  for (const v of ['16', '32', '48', '64', '128']) capLabels[v] = makeLabClassEl();
  capLabels['192'] = makeLabClassEl({ dataset: { tierOnly: 'ddr5-6000' } });
  capLabels['256'] = makeLabClassEl({ dataset: { tierOnly: 'ddr5-6000' } });
  group('lab-capacity', ['16', '32', '48', '64', '128', '192', '256'], capLabels);
  group('lab-cpu', ['ryzen5-3600', 'ryzen9-5800x3d', 'i5-13600k', 'i9-13900kf', 'ryzen7-7800x3d', 'threadripper-7960x']);
  group('lab-quant', ['fp16', 'int8-awq', 'q6_k', 'q5_k_m', 'q4_k_m']);
  group('lab-ctx', ['8192', '32768', '131072']);
  group('lab-split', ['short', 'balanced', 'long']);
  group('lab-conc', ['1', '4', '16']);

  const modelInput = {
    min: '0', max: '9', step: '1', value: '1',
    style: { vars: {}, setProperty(k, v) { this.vars[k] = v; } },
    listeners: {},
    addEventListener(ev, fn) { (this.listeners[ev] ??= []).push(fn); },
    dispatchEvent(evt) { for (const fn of this.listeners[evt.type] ?? []) fn(evt); return true; },
  };

  // M2 printouts rail stubs (pulse() needs classList + offsetWidth + addEventListener)
  const makePrintout = () => {
    const classes = new Set();
    const v = { textContent: '…' };
    return {
      v,
      querySelector: (sel) => (sel === '.v' ? v : null),
      classList: {
        add(c) { classes.add(c); }, remove(c) { classes.delete(c); }, contains: (c) => classes.has(c),
        toggle(c, force) { if (force === undefined) { if (classes.has(c)) classes.delete(c); else classes.add(c); } else if (force) classes.add(c); else classes.delete(c); },
      },
      offsetWidth: 10,
      listeners: {},
      addEventListener(ev, fn) { (this.listeners[ev] ??= []).push(fn); },
    };
  };
  const makeSeg = () => {
    const vars = {};
    return { style: { vars, setProperty(k, v) { vars[k] = v; } } };
  };
  const segGpu = makeSeg(); // persistent instances — querySelector must return the same object
  const segCpu = makeSeg();
  const membarEl = {
    attrs: {},
    setAttribute(k, v) { this.attrs[k] = v; },
    getAttribute(k) { return this.attrs[k] ?? null; },
    querySelector: (sel) => (sel === '.seg-gpu' ? segGpu : sel === '.seg-cpu' ? segCpu : null),
  };
  const makeList = () => ({
    children: [],
    appendChild(c) { this.children.push(c); },
    removeChild(c) { this.children.splice(this.children.indexOf(c), 1); },
  });
  const nofitList = makeList();

  // M3 simulation stubs (persistent seg instances, as in the real DOM)
  const runBtnStub = {
    attrs: {},
    setAttribute(k, v) { this.attrs[k] = v; },
    getAttribute(k) { return this.attrs[k] ?? null; },
    listeners: {},
    addEventListener(ev, fn) { (this.listeners[ev] ??= []).push(fn); },
  };
  const loadbarSegStub = makeSeg();
  const progressSegStub = makeSeg();
  const conveyorStub = makeList();
  const gaugeStub = makeSeg(); // --val lives in style.vars, like the real .gauge

  const byId = {
    'lab-aio-group': makeLabClassEl(),
    'lab-rig-group': makeLabClassEl(),
    'lab-model': modelInput,
    'lab-model-anchor': { textContent: '' },
    'po-tps': makePrintout(), 'po-ttft': makePrintout(), 'po-power': makePrintout(),
    'po-cost': makePrintout(), 'po-maxfit': makePrintout(),
    // M4 teaching rows (total-throughput row + TTFT queueing note + offload sentence)
    'po-tps-total': makePrintout(),
    'po-ttft-note': makeLabClassEl({ textContent: '' }),
    'lab-offload-note': makeLabClassEl({ textContent: '' }),
    'lab-membar': membarEl,
    'lab-mem-caption': { textContent: '' },
    'lab-fit-state': { textContent: '', attrs: {}, setAttribute(k, v) { this.attrs[k] = v; } },
    'lab-nofit': makeLabClassEl(),
    'lab-nofit-list': nofitList,
    'lab-quant-explain': { innerHTML: '' },
    // M3
    'lab-run': runBtnStub,
    'lab-sim-stage': { textContent: '' },
    'lab-sim-loadbar': { querySelector: (sel) => (sel === '.seg' ? loadbarSegStub : null) },
    'lab-conveyor': conveyorStub,
    'lab-gauge': gaugeStub,
    'lab-tps-value': { textContent: '' },
    'lab-progress-bar': { querySelector: (sel) => (sel === '.seg' ? progressSegStub : null) },
    'lab-progress-label': { textContent: '' },
    'lab-run-meta': { textContent: '' },
  };

  return {
    groups, modelInput, membarEl, nofitList,
    runBtnStub, conveyorStub, gaugeStub, loadbarSegStub, progressSegStub,
    getElementById: (id) => byId[id] ?? null,
    createElement: (tag) => ({ tag, textContent: '' }),
    querySelectorAll: (sel) => {
      const m = /^input\[name="(.+)"\]$/.exec(sel);
      return m && groups[m[1]] ? groups[m[1]] : [];
    },
  };
}

const checkedOf = (doc, name) => doc.groups[name].find((r) => r.checked)?.value ?? null;

{ // pure helpers — capacity clamping across RAM tiers (§3.1)
  assert.equal(clampCapacity('ddr4-3200', 192), 128);   // DDR4 tops out at 128 GB
  assert.equal(clampCapacity('ddr5-6000', 192), 192);   // DDR5 offers it
  assert.equal(clampCapacity('ddr5-6000', 100), 128);   // nearest offered value
  ok('clampCapacity: DDR4 caps at 128 GB, DDR5 keeps 192/256, nearest-value rounding');
}

{ // pure helpers — mode + tier switch partials (store-safe)
  assert.deepEqual(modeSwitchPartial({ platformId: 'mba-m5' }, 'allInOne'), { mode: 'allInOne' });
  const seeded = modeSwitchPartial(DEFAULT_CONFIG, 'allInOne'); // DEFAULT_CONFIG has no platformId
  assert.equal(seeded.mode, 'allInOne');
  assert.equal(seeded.platformId, 'mba-m5', 'first AIO seeds a missing platformId');
  assert.deepEqual(tierSwitchPartial({ ramCapacityGB: 192 }, 'ddr4-3200'), { ramTierId: 'ddr4-3200', ramCapacityGB: 128 });
  ok('mode/tier switch partials are store-safe (seeded platformId, clamped capacity)');
}

{ // pure helper — anchor readout labels representative stops (§3.2)
  assert.match(anchorNote(1), /Llama 3\.1 8B/);
  assert.match(anchorNote(4), /representative/i); // 16B stop is interpolated
  ok('anchorNote names the anchor model and flags representative stops');
}

{ // initial paint reflects DEFAULT_CONFIG (rig mode)
  const doc = makeLabDoc();
  const st = createStore({ storage: null });
  initLab({ doc, store: st });
  assert.ok(!doc.getElementById('lab-rig-group').classList.contains('is-hidden'), 'rig group visible');
  assert.ok(doc.getElementById('lab-aio-group').classList.contains('is-hidden'), 'AIO group hidden in rig mode');
  assert.equal(checkedOf(doc, 'lab-gpu'), 'rtx-3090-24g');
  assert.equal(checkedOf(doc, 'lab-capacity'), '64');
  assert.equal(doc.modelInput.value, '1');
  assert.match(doc.getElementById('lab-model-anchor').textContent, /Llama 3\.1 8B/);
  ok('initial paint: controls reflect the store config (rig · RTX 3090 · 64 GB · 8B)');
}

{ // control → store: every rail writes a validated partial
  const doc = makeLabDoc();
  const st = createStore({ storage: null });
  initLab({ doc, store: st });

  const fire = (name, value) => { const r = doc.groups[name].find((x) => x.value === value); r.checked = true; r.dispatch('change'); };

  fire('lab-gpu', 'rtx-5090-32g');
  assert.equal(st.getState().config.gpuId, 'rtx-5090-32g');
  assert.ok(typeof st.getState().derived.perf.decodeTpsPerRequest === 'number', 'derived recomputed');

  fire('lab-gpucount', '4');
  assert.equal(st.getState().config.gpuCount, 4);

  fire('lab-cpu', 'i9-13900kf');
  assert.equal(st.getState().config.cpuId, 'i9-13900kf');

  doc.modelInput.value = '7';
  doc.modelInput.dispatchEvent({ type: 'input' });
  assert.equal(st.getState().config.modelStopIndex, 7);
  assert.match(doc.getElementById('lab-model-anchor').textContent, /Llama 3\.3 70B/);

  fire('lab-quant', 'q5_k_m');
  assert.equal(st.getState().config.quantId, 'q5_k_m');

  fire('lab-ctx', '131072');
  assert.equal(st.getState().config.contextWindow, 131072);
  fire('lab-split', 'long');
  assert.equal(st.getState().config.promptSplit, 'long');
  fire('lab-conc', '16');
  assert.equal(st.getState().config.concurrency, 16);

  ok('control → store: GPU/count/CPU/model/quant/ctx/split/concurrency all land in the config');
}

{ // RAM tier switch clamps a stranded capacity + hides DDR5-only chips
  const doc = makeLabDoc();
  const st = createStore({ storage: null });
  initLab({ doc, store: st });

  const fire = (name, value) => { const r = doc.groups[name].find((x) => x.value === value); r.checked = true; r.dispatch('change'); };
  fire('lab-capacity', '192'); // DDR5-only capacity, valid now
  assert.equal(st.getState().config.ramCapacityGB, 192);

  fire('lab-ramtier', 'ddr4-3200');
  const c = st.getState().config;
  assert.equal(c.ramTierId, 'ddr4-3200');
  assert.equal(c.ramCapacityGB, 128, '192 GB clamped to DDR4 max');

  const cap192 = doc.groups['lab-capacity'].find((x) => x.value === '192').parentElement;
  const cap64 = doc.groups['lab-capacity'].find((x) => x.value === '64').parentElement;
  assert.ok(cap192.classList.contains('is-hidden'), '192 GB chip hidden on DDR4');
  assert.ok(!cap64.classList.contains('is-hidden'), '64 GB chip still offered');
  ok('tier switch: stranded capacity clamped, tier-exclusive chips hidden');
}

{ // mode switch seeds a valid platformId and flips the sub-groups
  const doc = makeLabDoc();
  const st = createStore({ storage: null });
  initLab({ doc, store: st });

  const fire = (name, value) => { const r = doc.groups[name].find((x) => x.value === value); r.checked = true; r.dispatch('change'); };
  fire('lab-mode', 'allInOne');
  let c = st.getState().config;
  assert.equal(c.mode, 'allInOne');
  assert.equal(c.platformId, 'mba-m5', 'missing platformId seeded with first AIO');
  assert.ok(!doc.getElementById('lab-aio-group').classList.contains('is-hidden'), 'AIO group visible');
  assert.ok(doc.getElementById('lab-rig-group').classList.contains('is-hidden'), 'rig group hidden');

  fire('lab-platform', 'dgx-spark');
  assert.equal(st.getState().config.platformId, 'dgx-spark');

  fire('lab-mode', 'rig'); // back to rig — previous rig config intact
  c = st.getState().config;
  assert.equal(c.mode, 'rig');
  assert.ok(!doc.getElementById('lab-rig-group').classList.contains('is-hidden'), 'rig group visible again');
  ok('mode switch: platformId seeded on first AIO use, sub-groups flip both ways');
}

{ // store → controls sync (external change) without re-triggering handlers
  const doc = makeLabDoc();
  const st = createStore({ storage: null });
  initLab({ doc, store: st });

  let handlerFiredDuringSync = false;
  for (const r of doc.groups['lab-gpu']) {
    r.addEventListener('change', () => { handlerFiredDuringSync = true; });
  }
  st.setConfig({ gpuCount: 2, modelStopIndex: 3 }); // external change → sync path
  assert.equal(checkedOf(doc, 'lab-gpucount'), '2');
  assert.equal(doc.modelInput.value, '3');
  assert.match(doc.getElementById('lab-model-anchor').textContent, /Qwen3-14B/);
  assert.equal(handlerFiredDuringSync, false, 'sync never re-fires control handlers (no loop)');
  ok('store → controls: external changes sync the rail without event loops');
}

{ // initial paint covers a persisted AIO config (fresh page load)
  const doc = makeLabDoc();
  const st = createStore({ storage: null, initialConfig: { mode: 'allInOne', platformId: 'dgx-spark' } });
  initLab({ doc, store: st });
  assert.equal(checkedOf(doc, 'lab-mode'), 'allInOne');
  assert.equal(checkedOf(doc, 'lab-platform'), 'dgx-spark');
  ok('initial paint restores a persisted all-in-one config');
}

{ // M2 formatting helpers
  assert.equal(fmtTps(145.3), '145.3 tok/s');
  assert.equal(fmtTps(null), '…', 'the no-value placeholder is an ellipsis, not the banned em dash');
  assert.equal(fmtMs(850), '850 ms');
  assert.equal(fmtMs(1650), '1.65 s');
  assert.equal(fmtWatts(415), '415 W');
  assert.equal(fmtCost(0.18, 0.027), '¥0.180 · $0.027');
  ok('M2 formatters: tok/s · ms/s · watts · ¥/$ (3dp under 1)');
}

{ // M2 membarView — gpu / offload / noFit states, self-consistent with the engine
  const perfGpu = evaluate(DEFAULT_CONFIG); // RTX 3090 + 8B Q4 → GPU-resident
  assert.equal(perfGpu.fitsState, 'gpu');
  let v = membarView(perfGpu);
  assert.ok(v.gpuPct > 0 && v.cpuPct === 0, 'all bytes on the VRAM side');
  assert.equal(v.state, 'ok', '8B in a 24 GB card is far from full');

  const offCfg = { ...DEFAULT_CONFIG, gpuId: 'rtx-3060-12g', ramTierId: 'ddr4-3200', modelStopIndex: 7 };
  const perfOff = evaluate(offCfg); // §5.4 anchor A5 shape → offload
  assert.equal(perfOff.fitsState, 'offload');
  v = membarView(perfOff);
  const perLayer = (perfOff.weightsGB + perfOff.kvCacheGB) / perfOff.totalLayers;
  assert.ok(Math.abs(v.gpuPct - Math.min(1, (perfOff.layersOnGpu * perLayer) / perfOff.gpuUsableGB)) < 1e-9);
  assert.ok(Math.abs(v.cpuPct - Math.min(1, (perfOff.layersOnCpu * perLayer) / perfOff.ramUsableGB)) < 1e-9);
  assert.equal(v.state, v.gpuPct >= 0.9 || v.cpuPct >= 0.9 ? 'warn' : 'ok', 'state follows the ≥90 % rule');

  const noCfg = { mode: 'allInOne', platformId: 'mba-m5', modelStopIndex: 9, quantId: 'q4_k_m', contextWindow: 8192 };
  const perfNo = evaluate(noCfg); // 405B Q4 on a 16 GB Air → noFit
  assert.equal(perfNo.fitsState, 'noFit');
  v = membarView(perfNo);
  assert.equal(v.state, 'fail');
  assert.equal(v.gpuPct, 1, 'demand clamps the bar to full');
  ok('membarView: gpu/offload/noFit splits + ok/warn/fail states match the engine model');
}

{ // M2 renderPrintouts — default config renders exact engine values
  const doc = makeLabDoc();
  const st = createStore({ storage: null });
  initLab({ doc, store: st });

  const perf = evaluate(DEFAULT_CONFIG);
  assert.equal(doc.getElementById('po-tps').v.textContent, fmtTps(perf.decodeTpsPerRequest));
  assert.equal(doc.getElementById('po-ttft').v.textContent, fmtMs(perf.ttftMs));
  assert.equal(doc.getElementById('po-power').v.textContent, '415 W'); // 350×0.9 + 100 system base
  assert.match(doc.getElementById('po-cost').v.textContent, /^¥[\d.]+ · \$[\d.]+$/);
  assert.equal(doc.getElementById('po-maxfit').v.textContent, '80B'); // 70B/80B fit in 24+64 GB at Q4/8K

  const v = membarView(perf);
  assert.ok(doc.membarEl.querySelector('.seg-gpu').style.vars['--w'].endsWith('%'));
  assert.equal(doc.membarEl.getAttribute('data-state'), 'ok');
  assert.match(doc.getElementById('lab-mem-caption').textContent,
    /GB of weights and .* GB of conversation store, in 24 GB of graphics card memory/);

  const chip = doc.getElementById('lab-fit-state');
  assert.equal(chip.textContent, 'The whole model sits on the graphics card, which is the fast case.');
  assert.equal(chip.attrs['data-fit'], 'gpu');
  assert.ok(doc.getElementById('lab-nofit').classList.contains('is-hidden'), 'diagnosis hidden when it fits');

  const ex = doc.getElementById('lab-quant-explain').innerHTML;
  assert.match(ex, /Q4_K_M \(GGUF\)\. Fits far more, gives up a little accuracy\./);
  // whatItIs from the data layer, rewritten in P9 to explain rather than name:
  // it must describe the mechanism without leaning on unexplained jargon.
  assert.match(ex, /small groups that share a scaling factor/);
  assert.ok(!/K-quant|per-group scales/.test(ex), 'the explainer no longer uses undefined jargon');
  ok('M2 printouts: exact engine values · membar + caption · fit chip · quant explainer');
}

{ // M2 doesn't-fit — diagnosis card with the engine's suggestions
  const doc = makeLabDoc();
  const st = createStore({ storage: null });
  initLab({ doc, store: st });

  st.setConfig({ mode: 'allInOne', platformId: 'mba-m5' }); // seed AIO (M1 logic)
  st.setConfig({ modelStopIndex: 9 });                        // 405B Q4 → noFit on the Air
  const perf = evaluate(st.getState().config);
  assert.equal(perf.fitsState, 'noFit');

  assert.ok(!doc.getElementById('lab-nofit').classList.contains('is-hidden'), 'diagnosis visible');
  assert.equal(doc.nofitList.children.length, perf.noFitSuggestions.length);
  assert.equal(doc.nofitList.children[0].textContent, perf.noFitSuggestions[0]);

  assert.equal(doc.getElementById('po-tps').v.textContent, '…', 'speed unavailable when it doesn’t fit');
  assert.equal(doc.membarEl.getAttribute('data-state'), 'fail');
  const chip = doc.getElementById('lab-fit-state');
  assert.equal(chip.attrs['data-fit'], 'noFit');
  ok('M2 noFit: suggestions rendered from the engine, speed rows read “—”, bar in fail state');
}

{ // M2 §8 pulse — changed printouts pulse; unchanged ones don’t; first paint never pulses
  const doc = makeLabDoc();
  const st = createStore({ storage: null });
  initLab({ doc, store: st }); // initial paint (firstSync → no pulses)
  assert.ok(!doc.getElementById('po-tps').classList.contains('is-pulsing'), 'no pulse on first paint');

  st.setConfig({ modelStopIndex: 2 }); // 8B → 12B: tps/TTFT/cost move, maxfit stays 80B, watts unchanged
  assert.ok(doc.getElementById('po-tps').classList.contains('is-pulsing'), 'changed row pulses');
  assert.ok(!doc.getElementById('po-power').classList.contains('is-pulsing'), 'unchanged row does not pulse');
  ok('M2 pulse-on-change: §8 micro-interaction fires only for rows whose value moved');
}

{ // M3 simPlan — fast configs run real-time; slow ones compress within budget
  const perfFast = evaluate(DEFAULT_CONFIG);
  let p = simPlan(perfFast);
  assert.equal(p.speedup, 1, 'fast config needs no compression');
  assert.ok(Math.abs(p.realDurationS - (p.loadS + p.prefillBeatS + p.decodeS)) < 1e-9);

  const perfSlow = evaluate({ ...DEFAULT_CONFIG, gpuId: 'rtx-3060-12g', ramTierId: 'ddr4-3200', modelStopIndex: 7 });
  assert.ok(perfSlow.decodeTpsPerRequest < 5, 'offload pain (anchor A5 shape)');
  p = simPlan(perfSlow);
  assert.ok(p.speedup > 1, 'slow config is time-compressed');
  assert.ok(p.realDurationS <= SIM_REAL_BUDGET_S + 1e-9, 'real duration stays within budget');

  const perfNo = evaluate({ ...DEFAULT_CONFIG, mode: 'allInOne', platformId: 'mba-m5', modelStopIndex: 9 });
  assert.equal(simPlan(perfNo), null, "can't plan a run that doesn't fit");
  ok('M3 simPlan: real-time when fast · labeled compression within budget · null on noFit');
}

{ // M3 timeline math — tokensAt / simPhase / gauge scale
  const perf = evaluate(DEFAULT_CONFIG);
  const p = simPlan(perf);
  assert.equal(tokensAt(p, 0), 0);
  assert.equal(tokensAt(p, p.loadS + p.prefillBeatS - 0.01), 0, 'nothing before decode starts');
  const mid = p.loadS + p.prefillBeatS + (p.decodeS / 2);
  assert.ok(Math.abs(tokensAt(p, mid) - Math.floor((p.decodeS / 2) * p.tps)) <= 1);
  assert.equal(tokensAt(p, p.totalVirtualS), p.targetTokens, 'clamped at target');

  assert.equal(simPhase(p, 0.1), 'loading');
  assert.equal(simPhase(p, p.loadS + 0.4), 'prefill');
  assert.equal(simPhase(p, p.loadS + p.prefillBeatS + 0.05), 'decoding');
  assert.equal(simPhase(p, p.totalVirtualS), 'done');

  assert.ok(Math.abs(gaugeFill(145) - 145 / 200) < 1e-9);
  assert.equal(gaugeFill(500), 1, 'full at ≥200 tok/s; label carries the exact value');
  ok('M3 timeline: tokensAt + phase transitions + gauge scale');
}

function makeClock() {
  let t = 0; // ms
  let pending = null;
  return {
    now: () => t,
    raf: (cb) => { pending = cb; return 1; },
    step: (ms) => { t += ms; if (pending) { const cb = pending; pending = null; cb(); } },
    isPending: () => pending !== null,
  };
}

{ // M3 full run — fake clock drives load → prefill → decode to completion
  const doc = makeLabDoc();
  const st = createStore({ storage: null });
  const clock = makeClock();
  const sim = initSim({ doc, store: st, raf: clock.raf, now: clock.now });

  assert.equal(sim.start(), true);
  clock.step(100); // still inside the load phase (loadS ≥ 0.5 s)
  assert.match(doc.getElementById('lab-sim-stage').textContent, /Loading weights/);
  assert.equal(doc.runBtnStub.getAttribute('data-run-state'), 'charging', 'button in charging state during load');

  while (clock.isPending() && clock.now() < 20000) clock.step(100); // drive to completion
  assert.ok(!clock.isPending(), 'animation loop stopped at the end');
  assert.equal(doc.getElementById('lab-progress-label').textContent, '256 / 256 tokens');
  assert.equal(doc.conveyorStub.children.length, 256, 'one chip per token of the target task');
  assert.equal(doc.runBtnStub.getAttribute('data-run-state'), 'idle', 'button back to idle after finish');

  const engineTps = evaluate(DEFAULT_CONFIG).decodeTpsPerRequest;
  const shown = parseFloat(doc.getElementById('lab-tps-value').textContent);
  assert.ok(Math.abs(shown - engineTps) / engineTps < 0.05, '§6 acceptance: displayed rate within ±5 % of the engine');

  assert.match(doc.getElementById('lab-run-meta').textContent, /Finished\. 256 tokens/);
  ok('M3 run: phases in order · 256 chips · gauge + progress land exactly on the engine values');
}

{ // M3 slow config — compression label appears in the finish line
  const doc = makeLabDoc();
  const st = createStore({ storage: null });
  st.setConfig({ gpuId: 'rtx-3060-12g', ramTierId: 'ddr4-3200', modelStopIndex: 7 }); // offload, ~1.4 t/s
  const clock = makeClock();
  const sim = initSim({ doc, store: st, raf: clock.raf, now: clock.now });
  assert.equal(sim.start(), true);
  while (clock.isPending() && clock.now() < 60000) clock.step(250);
  assert.match(doc.getElementById('lab-run-meta').textContent, /sped up .* times/);
  ok('M3 slow run: ×N compression labeled on screen');
}

{ // M3 noFit — start is refused with a pointer to the diagnosis
  const doc = makeLabDoc();
  const st = createStore({ storage: null });
  st.setConfig({ mode: 'allInOne', platformId: 'mba-m5' });
  st.setConfig({ modelStopIndex: 9 }); // 405B on the Air → noFit
  const clock = makeClock();
  const sim = initSim({ doc, store: st, raf: clock.raf, now: clock.now });
  assert.equal(sim.start(), false);
  assert.match(doc.getElementById('lab-sim-stage').textContent, /does not fit/);
  assert.equal(doc.conveyorStub.children.length, 0);
  ok("M3 noFit: run refused with a pointer to the diagnosis");
}

{ // M3 reduced motion (§8) — instant completion, final state rendered, no loop
  const doc = makeLabDoc();
  const st = createStore({ storage: null });
  const sim = initSim({ doc, store: st, raf: () => { throw new Error('must not animate'); }, now: () => 0, reduced: true });
  assert.equal(sim.start(), true);
  assert.equal(doc.getElementById('lab-progress-label').textContent, '256 / 256 tokens');
  assert.equal(doc.conveyorStub.children.length, 256);
  assert.match(doc.getElementById('lab-run-meta').textContent, /Finished/);
  ok('M3 reduced motion: no animation loop, instant final state');
}

{ // M3 wiring — click starts the run; a config change mid-run cancels it
  const doc = makeLabDoc();
  const st = createStore({ storage: null });
  const clock = makeClock();
  const lab = initLab({ doc, store: st, sim: { raf: clock.raf, now: clock.now } });

  doc.runBtnStub.listeners.click[0](); // click “Run Inference”
  assert.ok(lab.sim.isRunning(), 'run in flight after the click');
  clock.step(100);

  st.setConfig({ gpuCount: 2 }); // config change mid-run → cancel (agent-decided)
  assert.equal(lab.sim.isRunning(), false, 'mid-run config change cancels the run');
  assert.equal(doc.runBtnStub.getAttribute('data-run-state'), 'idle');
  ok('M3 wiring: click starts · store change mid-run cancels cleanly');
}

{ // M4 concTeaching — null at B=1; shapes both rates + the queueing note at B>1
  const perf1 = evaluate(DEFAULT_CONFIG);
  assert.equal(concTeaching(perf1, DEFAULT_CONFIG), null, 'nothing to teach at concurrency 1');

  const cfg4 = { ...DEFAULT_CONFIG, concurrency: 4 };
  const perf4 = evaluate(cfg4);
  const t = concTeaching(perf4, cfg4);
  assert.equal(t.total, fmtTps(perf4.decodeTpsTotal));
  assert.equal(t.perReq, fmtTps(perf4.decodeTpsPerRequest));
  assert.match(t.ttftNote, /4 people asking at once/);
  assert.ok(Math.abs(perf4.decodeTpsTotal - perf4.decodeTpsPerRequest * 4) < 1e-9, 'engine: total = per-request × B');
  ok('M4 concTeaching: null at B=1 · both rates + ×B queueing note at B>1');
}

{ // M4 offloadNote — one sentence naming the real bandwidths; null on the fast path
  const perfFast = evaluate(DEFAULT_CONFIG);
  assert.equal(offloadNote(perfFast, DEFAULT_CONFIG), null, 'GPU-resident → nothing to explain');

  const cfgOff = { ...DEFAULT_CONFIG, gpuId: 'rtx-3060-12g', ramTierId: 'ddr4-3200', modelStopIndex: 7 };
  const perfOff = evaluate(cfgOff);
  assert.equal(perfOff.fitsState, 'offload');
  const note = offloadNote(perfOff, cfgOff);
  assert.match(note, /Why this is slow/);
  assert.match(note, /51\.2 GB\/s/, 'DDR4-3200 bandwidth named');
  assert.match(note, /360 GB\/s/, 'RTX 3060 bandwidth named');
  // Intent, not phrasing: both halves of the split must reach the reader.
  assert.ok(note.includes(String(perfOff.layersOnCpu)) && note.includes(String(perfOff.totalLayers)),
    'layer split stated');
  ok('M4 offloadNote: one sentence · real bandwidths + layer split · null on fast path');
}

{ // M4 renderPrintouts — teaching rows appear only while they teach, then hide again
  const doc = makeLabDoc();
  const st = createStore({ storage: null });
  initLab({ doc, store: st });

  assert.ok(doc.getElementById('po-tps-total').classList.contains('is-hidden'), 'total row hidden at B=1');
  assert.ok(doc.getElementById('po-ttft-note').classList.contains('is-hidden'), 'TTFT note hidden at B=1');
  assert.ok(doc.getElementById('lab-offload-note').classList.contains('is-hidden'), 'offload note hidden on fast path');

  st.setConfig({ concurrency: 4 });
  const perfB4 = evaluate(st.getState().config);
  assert.ok(!doc.getElementById('po-tps-total').classList.contains('is-hidden'));
  assert.equal(doc.getElementById('po-tps-total').v.textContent, fmtTps(perfB4.decodeTpsTotal));
  assert.match(doc.getElementById('po-ttft-note').textContent, /4 people asking at once/);

  st.setConfig({ gpuId: 'rtx-3060-12g', ramTierId: 'ddr4-3200', modelStopIndex: 7 }); // offload (anchor A5 shape)
  const offEl = doc.getElementById('lab-offload-note');
  assert.ok(!offEl.classList.contains('is-hidden'), 'offload note visible in offload state');
  assert.match(offEl.textContent, /Why this is slow/);

  st.setConfig({ gpuId: 'rtx-3090-24g', ramTierId: 'ddr5-6000', modelStopIndex: 1 }); // back on GPU (still B=4)
  assert.ok(doc.getElementById('lab-offload-note').classList.contains('is-hidden'), 'note hides again when it fits');
  ok('M4 renderPrintouts: rows appear only while they teach, then hide again');
}

{ // M4 run finish — the Done line names both rates at concurrency >1
  const doc = makeLabDoc();
  const st = createStore({ storage: null });
  const clock = makeClock();
  const sim = initSim({ doc, store: st, raf: clock.raf, now: clock.now });

  st.setConfig({ concurrency: 4 });
  assert.equal(sim.start(), true);
  while (clock.isPending() && clock.now() < 20000) clock.step(100); // drive to completion
  const meta = doc.getElementById('lab-run-meta').textContent;
  assert.match(meta, /for each person/);
  assert.match(meta, /4 people getting .* each, or .* of work in total/);
  ok('M4 run finish: Done line shows per-request rate and the ×B total');
}

/* ---------------- js/tabs/pipeline.js — P5 M1 ------------------ */
console.log('tabs/pipeline.js — P5 M1');

function makePipeDoc(prefill = '') {
  const input = {
    value: prefill,
    listeners: {},
    addEventListener(ev, fn) { (this.listeners[ev] ??= []).push(fn); },
    dispatch(ev) { for (const fn of this.listeners[ev] ?? []) fn({}); },
  };
  const chips = {
    children: [],
    appendChild(c) { this.children.push(c); },
    removeChild(c) { this.children.splice(this.children.indexOf(c), 1); },
  };
  const count = { textContent: '' };
  const makeSeg = () => ({ style: { props: {}, setProperty(k, v) { this.props[k] = v; } } });
  const segGpu = makeSeg();
  const segCpu = makeSeg();
  const loadbar = {
    setAttributes: {},
    setAttribute(k, v) { this.setAttributes[k] = v; },
    querySelector: (sel) => (sel === '.seg-gpu' ? segGpu : sel === '.seg-cpu' ? segCpu : null),
  };
  const loadcaption = { textContent: '' };
  const loadlayers = { textContent: '', classes: new Set(['is-hidden']), classList: { toggle(c, on) { on ? this.set.add(c) : this.set.delete(c); } } };
  loadlayers.classList.set = loadlayers.classes;
  // P5 M3 (Stage 3) fakes
  const drip = {
    children: [],
    appendChild(c) { this.children.push(c); },
    removeChild(c) { this.children.splice(this.children.indexOf(c), 1); },
  };
  // P5 M5 (Stage 5) fakes
  const makeSlider = (value) => ({
    value: String(value),
    style: { props: {}, setProperty(k, v) { this.props[k] = v; } },
    listeners: {},
    addEventListener(ev, fn) { (this.listeners[ev] ??= []).push(fn); },
    dispatch(ev) { for (const fn of this.listeners[ev] ?? []) fn({}); },
  });
  const temp = makeSlider(1);
  const topp = makeSlider(0.9);
  const tempvalue = { textContent: '' };
  const toppvalue = { textContent: '' };
  const samplebars = {
    children: [],
    appendChild(c) { this.children.push(c); return c; },
    removeChild(c) { this.children.splice(this.children.indexOf(c), 1); },
  };
  const samplecaption = { textContent: '' };

  // P5 M4 (Stage 4) fakes
  const kvseg = { style: { props: {}, setProperty(k, v) { this.props[k] = v; } } };
  const kvbar = {
    attrs: {},
    setAttribute(k, v) { this.attrs[k] = v; },
    querySelector: (sel) => (sel === '.seg' ? kvseg : null),
  };
  const kvslider = {
    min: '0', max: '8192', step: '32', value: '2048',
    style: { props: {}, setProperty(k, v) { this.props[k] = v; } },
    listeners: {},
    addEventListener(ev, fn) { (this.listeners[ev] ??= []).push(fn); },
    dispatch(ev) { for (const fn of this.listeners[ev] ?? []) fn({}); },
  };
  const kvused = { textContent: '' };
  const kvtokens = { textContent: '' };
  const kvcaption = { textContent: '' };
  const kvcompare = { textContent: '' };
  const prefilltokens = { textContent: '' };
  const prefillnote = { textContent: '' };
  const decodetps = { textContent: '' };
  const decodenote = { textContent: '' };
  const phase = { textContent: '' };
  const driplabel = { textContent: '' };
  const speednote = { textContent: '' };
  return {
    input, chips, count,
    loadbar, loadcaption, loadlayers,
    drip, driplabel, prefilltokens, decodetps, phase,
    kvbar, kvseg, kvslider, kvused, kvtokens, kvcaption, kvcompare,
    temp, topp, tempvalue, toppvalue, samplebars, samplecaption,
    getElementById: (id) => ({
      'pipe-token-input': input, 'pipe-token-chips': chips, 'pipe-token-count': count,
      'pipe-loadbar': loadbar, 'pipe-load-caption': loadcaption, 'pipe-load-layers': loadlayers,
      'pipe-prefill-tokens': prefilltokens, 'pipe-prefill-note': prefillnote,
      'pipe-decode-tps': decodetps, 'pipe-decode-note': decodenote,
      'pipe-phase': phase, 'pipe-drip': drip, 'pipe-drip-label': driplabel,
      'pipe-speed-note': speednote,
      'pipe-kv-bar': kvbar, 'pipe-kv-slider': kvslider, 'pipe-kv-used': kvused,
      'pipe-kv-tokens': kvtokens, 'pipe-kv-caption': kvcaption, 'pipe-kv-compare': kvcompare,
      'pipe-temp': temp, 'pipe-topp': topp, 'pipe-temp-value': tempvalue,
      'pipe-topp-value': toppvalue, 'pipe-sample-bars': samplebars, 'pipe-sample-caption': samplecaption,
    }[id] ?? null),
    createElement: (tag) => {
      const classes = new Set();
      return {
        tag, textContent: '', children: [],
        classList: { add: (c) => classes.add(c), contains: (c) => classes.has(c), _set: classes },
        style: { props: {}, setProperty(k, v) { this.props[k] = v; } },
        appendChild(c) { this.children.push(c); return c; },
      };
    },
  };
}

{ // tokenizeWith — real Qwen3 vocab (the fix): a long word splits into many pieces
  const t = tokenizeWith(VOCAB, 'Antidisestablishmentarianism');
  assert.ok(t.length > 3, `long word → more than 3 tokens (got ${t.length})`);
  ok(`tokenizeWith: "Antidisestablishmentarianism" → ${t.length} tokens (not one)`);
}

{ // tokenizeWith — digit run "936" splits into separate digit tokens
  const t = tokenizeWith(VOCAB, '936');
  assert.deepEqual(t.map((x) => x.text), ['9', '3', '6'], 'each digit is its own token');
  assert.ok(t.every((x) => Number.isInteger(x.id) && x.id >= 0), 'digit tokens carry real ids');
  ok('tokenizeWith: "936" splits into separate digit tokens');
}

{ // tokenizeWith — a common word stays ONE token with its real id
  const t = tokenizeWith(VOCAB, ' world');
  assert.equal(t.length, 1, '" world" is a single token');
  assert.equal(t[0].text, ' world');
  assert.equal(t[0].id, 1814, '" world" → real Qwen3 id 1814');
  ok('tokenizeWith: " world" → ONE token, id 1814');
}

{ // tokenizeWith — empty/null-safe + determinism
  assert.deepEqual(tokenizeWith(VOCAB, ''), [], 'empty string → no tokens');
  assert.deepEqual(tokenizeWith(VOCAB, null), [], 'null → no tokens (no throw)');
  assert.deepEqual(tokenizeWith(VOCAB, 'Hello, world!'), tokenizeWith(VOCAB, 'Hello, world!'), 'deterministic across calls');
  ok('tokenizeWith: empty/null-safe and deterministic');
}

{ // tokenizeWith — punctuation stays attached where BPE puts it
  const t = tokenizeWith(VOCAB, 'Hello, world!');
  assert.deepEqual(t.map((x) => x.text), ['Hello', ',', ' world', '!']);
  assert.equal(t[1].id, VOCAB.get(','), 'punctuation id comes from the real vocab');
  ok('tokenizeWith: "Hello, world!" → 4 tokens, punctuation kept');
}

{ // tokenize() — async convenience wrapper resolves to the same tokens
  const t = await tokenize(' world');
  assert.equal(t.length, 1);
  assert.equal(t[0].id, 1814);
  ok('tokenize: async wrapper awaits the lazy vocab');
}

{ // chip lifecycle — empty (sync) + type → chips, empty → cleared
  const doc = makePipeDoc();
  const api = initPipeline({ doc, store: null });
  assert.equal(doc.chips.children.length, 0, 'empty input → no chips on init');
  assert.equal(doc.count.textContent, '0 tokens');

  doc.input.value = 'Hello world';
  doc.input.dispatch('input');
  await api.pending;
  assert.equal(doc.chips.children.length, 2, 'one chip per token');
  assert.equal(doc.count.textContent, '2 tokens');

  doc.input.value = '';
  doc.input.dispatch('input');
  await api.pending;
  assert.equal(doc.chips.children.length, 0, 'chips clear as the input empties');
  assert.equal(doc.count.textContent, '0 tokens');
  ok('chip lifecycle: input events re-render chips + count, clearing on empty');
}

{ // chip lifecycle — initial paint covers a pre-filled value (like index.html's "Hello, world!")
  const doc = makePipeDoc('Hello, world!');
  const api = initPipeline({ doc, store: null });
  await api.pending;
  assert.equal(doc.chips.children.length, 4, 'pre-filled input renders on init, not on first keystroke');
  ok('initial paint renders a pre-filled input');
}

{ // chip anatomy — .chip with visible text + a .id span carrying the real token id
  const doc = makePipeDoc();
  const api = initPipeline({ doc, store: null });
  doc.input.value = 'Hi there';
  doc.input.dispatch('input');
  await api.pending;
  const [c0, c1] = doc.chips.children;
  assert.equal(c0.className, 'chip');
  assert.equal(c0.textContent, 'Hi');
  const id0 = c0.children.find((c) => c.className === 'id');
  assert.equal(id0.textContent, String(VOCAB.get('Hi')));
  const id1 = c1.children.find((c) => c.className === 'id');
  assert.equal(id1.textContent, String(VOCAB.get(' there')), 'leading-space chunk id shown');
  ok('chip anatomy: .chip text + .id span with the real token id');
}

/* ---------------- js/tabs/pipeline.js — P5 M2 ------------------ */
console.log('tabs/pipeline.js — P5 M2 (Stage 2 · Model load)');

{ // modelLoadView — fitting config: real engine numbers, bar in range, 'ok'
  const perf = evaluate(DEFAULT_CONFIG);
  assert.equal(perf.fitsState, 'gpu', 'test premise: default config fits on GPU');
  const v = modelLoadView(perf);
  assert.ok(v, 'view present for a fitting config');
  assert.equal(v.usedGB, perf.weightsGB + perf.kvTotalGB, 'used = weights + KV (what the engine\'s fits check uses)');
  assert.equal(v.availableGB, perf.gpuUsableGB, 'available = VRAM on the fast path');
  assert.ok(v.pct > 0 && v.pct <= 1, 'fill fraction in (0, 1]');
  assert.equal(v.state, 'ok', 'comfortable fit → ok');
  assert.equal(v.gpuPct, Math.min(1, (perf.weightsGB + perf.kvTotalGB) / perf.gpuUsableGB), 'gpu segment reuses membarView math');
  ok(`modelLoadView: fitting config → ${v.usedGB.toFixed(1)} GB of ${v.availableGB} GB, state ok`);
}

{ // modelLoadView — noFit config: demand exceeds every pool → pct 1, state fail
  const perf = evaluate({ ...DEFAULT_CONFIG, gpuId: 'v100-pcie-16g', modelStopIndex: 9, ramCapacityGB: 32 });
  assert.equal(perf.fitsState, 'noFit', 'test premise: 405B on 16 GB VRAM + 32 GB RAM doesn\'t fit');
  const v = modelLoadView(perf);
  assert.ok(v.pct >= 1, 'bar reads full');
  assert.equal(v.state, 'fail');
  assert.equal(v.availableGB, perf.gpuUsableGB + perf.ramUsableGB, 'available sums both pools');
  assert.ok(v.usedGB > v.availableGB, 'demand exceeds the rig');
  const cap = loadCaption(perf, { mode: 'rig' });
  assert.match(cap, /will not fit/);
  ok(`modelLoadView: noFit → ${v.usedGB.toFixed(0)} GB needed of ${v.availableGB} GB, state fail + "doesn't fit" caption`);
}

{ // loadCaption — offload: names the split, not just the total
  const perf = evaluate({ ...DEFAULT_CONFIG, gpuId: 'v100-pcie-16g', modelStopIndex: 7, ramCapacityGB: 128 });
  assert.equal(perf.fitsState, 'offload', 'test premise: 70B offloads onto 16 GB VRAM + 128 GB RAM');
  const v = modelLoadView(perf);
  assert.ok(v.cpuPct > 0, 'some of the bar lives in the RAM segment');
  const cap = loadCaption(perf, { mode: 'rig' });
  // Intent: the caption must name BOTH places the model ends up split across.
  assert.match(cap, /graphics card memory/);
  assert.match(cap, /system memory/);
  ok(`loadCaption: offload → "${cap}"`);
}

{ // store binding — config change in the "Lab" re-renders the Stage 2 caption live
  const storage = { _m: new Map(), getItem(k) { return this._m.get(k) ?? null; }, setItem(k, v) { this._m.set(k, v); } };
  const store = createStore({ initialConfig: { ...DEFAULT_CONFIG, gpuId: 'rtx-3090-24g' }, storage });
  const doc = makePipeDoc();
  const api = initPipeline({ doc, store });
  await api.pending; // let Stage 1 settle so the next assertion is about Stage 2
  const before = doc.loadcaption.textContent;
  assert.notEqual(before, '…', 'initial paint writes a real caption from evaluate()');
  assert.match(before, /24 GB of graphics card memory/);

  store.setConfig({ gpuId: 'rtx-3060-12g' }); // "change hardware in the Lab"
  assert.notEqual(doc.loadcaption.textContent, before, 'caption changed');
  assert.match(doc.loadcaption.textContent, /12 GB of graphics card memory/);
  api.destroy();
  ok(`store binding: 24 GB → 12 GB VRAM re-rendered Stage 2 ("${doc.loadcaption.textContent}")`);
}

{ // store binding — destroy() unsubscribes (no further re-renders)
  const storage = { _m: new Map(), getItem(k) { return this._m.get(k) ?? null; }, setItem(k, v) { this._m.set(k, v); } };
  const store = createStore({ initialConfig: { ...DEFAULT_CONFIG, gpuId: 'rtx-3090-24g' }, storage });
  const doc = makePipeDoc();
  const api = initPipeline({ doc, store });
  const before = doc.loadcaption.textContent;
  api.destroy();
  store.setConfig({ gpuId: 'rtx-3060-12g' });
  assert.equal(doc.loadcaption.textContent, before, 'after destroy() the store no longer re-renders Stage 2');
  ok('destroy() unsubscribes the Stage 2 store binding');
}

/* ---------------- js/tabs/pipeline.js — P5 M3 ------------------ */
console.log('tabs/pipeline.js — P5 M3 (Stage 3 · Prefill vs decode)');

{ // prefillDecodeView — fast config: real engine numbers, both halves present
  const perf = evaluate(DEFAULT_CONFIG); // RTX 3090 + 8B → fast
  assert.equal(perf.decodeTpsPerRequest > 50, true, 'test premise: a fast config');
  const v = prefillDecodeView(perf);
  assert.ok(v, 'view present for a fast config');
  assert.equal(v.promptTokens, perf.promptTokens, 'prompt tokens come from the engine');
  assert.equal(v.tps, perf.decodeTpsPerRequest, 'decode rate is the engine\'s exact value');
  assert.equal(v.targetTokens, GENERATION_TARGET_TOKENS);
  assert.ok(v.prefillS > 0, 'prefill beat has a real (TTFT-derived) duration');
  assert.ok(v.decodeS > 0 && v.perTokenMs > 0, 'decode drip has a per-token cadence');
  assert.equal(v.speedup, 1, 'fast run needs no compression');
  ok(`prefillDecodeView: fast config → ${v.promptTokens} prompt tokens, ${v.tps.toFixed(1)} tok/s, ${v.prefillS.toFixed(2)} s prefill`);
}

{ // prefillDecodeView — slow config: low tok/s → long drip, compression labelled
  const perf = evaluate({ ...DEFAULT_CONFIG, gpuId: 'rtx-3060-12g', ramTierId: 'ddr4-3200', modelStopIndex: 7 });
  assert.ok(perf.decodeTpsPerRequest < 5, 'test premise: an offloaded slow config');
  const v = prefillDecodeView(perf);
  assert.ok(v.tps < 5, 'slow config → low tok/s');
  assert.ok(v.decodeS > 1, 'the drip is long at this rate');
  assert.ok(v.speedup > 1, 'a slow run is time-compressed (and must be labelled)');
  assert.match(speedNote(perf), /sped up .* times/, 'compression label present');
  ok(`prefillDecodeView: slow config → ${v.tps.toFixed(2)} tok/s, ×${v.speedup.toFixed(1)} compressed`);
}

{ // prefill half — reports the engine's prompt-token count for the split
  const perf = evaluate({ ...DEFAULT_CONFIG, promptSplit: 'long' }); // 8192 prompt tokens
  const v = prefillDecodeView(perf);
  assert.equal(v.promptTokens, PROMPT_SPLIT_TOKENS.long, 'prompt tokens = the engine split for "long"');
  assert.match(prefillCaption(perf), new RegExp(v.promptTokens.toLocaleString()), 'caption names that count');
  // Intent: each half must name WHAT limits it, in words a novice can read.
  assert.match(prefillCaption(perf), /Limited by calculation speed/);
  assert.match(decodeCaption(perf), /Limited by memory speed/);
  ok(`prefill half reports the engine's prompt-token count (${v.promptTokens})`);
}

{ // animation — driving the injected clock advances decode tokens over time
  const storage = { _m: new Map(), getItem(k) { return this._m.get(k) ?? null; }, setItem(k, v) { this._m.set(k, v); } };
  const store = createStore({ storage });
  const doc = makePipeDoc();
  const clock = makeClock();
  const api = initPipeline({ doc, store, raf: clock.raf, now: clock.now });
  clock.step(16); // first frame: inside the prefill beat → 0 tokens yet
  assert.match(doc.driplabel.textContent, /^0 \/ 256/, 'empty during the prefill beat');
  assert.match(doc.phase.textContent, /Reading your question/, 'phase reads the prefill pass');
  while (clock.isPending() && clock.now() < 60000) clock.step(100); // drive to completion
  assert.ok(!clock.isPending(), 'animation loop stopped at the end');
  assert.match(doc.driplabel.textContent, /256 \/ 256/, 'drives to the full target');
  assert.equal(doc.drip.children.length, 256, 'one chip per decoded token');
  assert.match(doc.phase.textContent, /Done/, 'phase lands on Done');
  api.destroy();
  ok('driving the injected clock advances decode tokens one-by-one to completion');
}

{ // animation — reduced motion paints the final state instantly (no raf)
  const storage = { _m: new Map(), getItem(k) { return this._m.get(k) ?? null; }, setItem(k, v) { this._m.set(k, v); } };
  const store = createStore({ storage });
  const doc = makePipeDoc();
  const api = initPipeline({ doc, store, reduced: true, raf: () => { throw new Error('must not animate'); }, now: () => 0 });
  assert.equal(doc.driplabel.textContent, '256 / 256 tokens', 'reduced motion → final state instantly');
  assert.equal(doc.drip.children.length, 256);
  api.destroy();
  ok('reduced motion paints the Stage 3 final state instantly (raf never called)');
}

{ // store binding — a Lab config change re-renders Stage 3 live (shared subscription)
  const storage = { _m: new Map(), getItem(k) { return this._m.get(k) ?? null; }, setItem(k, v) { this._m.set(k, v); } };
  const store = createStore({ initialConfig: { ...DEFAULT_CONFIG, gpuId: 'rtx-3090-24g' }, storage });
  const doc = makePipeDoc();
  const api = initPipeline({ doc, store });
  const before = doc.decodetps.textContent;
  assert.match(before, /tok\/s/, 'initial paint shows a real decode rate');
  assert.equal(doc.prefilltokens.textContent, evaluate(store.getState().config).promptTokens.toLocaleString(), 'prefill half shows the engine count');
  store.setConfig({ gpuId: 'rtx-3060-12g', ramTierId: 'ddr4-3200', modelStopIndex: 7 }); // "change hardware in the Lab"
  const after = doc.decodetps.textContent;
  assert.notEqual(after, before, 'decode tok/s moves with the config');
  api.destroy();
  ok(`store change re-renders Stage 3 (decode rate ${before} → ${after})`);
}

/* ---------------- js/app.js — initApp() bootstrap ------------- */
console.log('app.js — initApp() bootstrap');

/* Every other block in this file dependency-injects `doc`, so the real
   bootstrap path — the one the browser actually runs — had zero coverage.
   That is exactly how the 2026-09-04 fatal TDZ in app.js shipped with a
   fully green suite: `initApp()` reaches `defaultDoc()` through a default
   parameter, which no DI test ever touches. This block runs the real
   `initApp()` against globals, wiring every tab module at once. */

function makeAppDoc() {
  const lab = makeLabDoc();
  const pipe = makePipeDoc('Hello, world!');
  const track = makeTrackerDoc();
  const links = track.querySelectorAll(); // [data-tab-link] nav + [data-track-tab] cards

  const panels = TABS.map((t) => tEl({ dataset: { tab: t } }));
  const themeBtn = tEl({
    dataset: { themeToggle: '' },
    listeners: {},
    addEventListener(ev, fn) { (this.listeners[ev] ??= []).push(fn); },
  });

  // Two reveal targets sharing a parent, so revealStaggerIndex() runs for real.
  const revealParent = { children: [] };
  const reveals = [tEl({ attrs: { 'data-reveal': true }, hasAttribute(a) { return a in this.attrs; } }),
    tEl({ attrs: { 'data-reveal': true }, hasAttribute(a) { return a in this.attrs; } })];
  for (const r of reveals) { r.parentElement = revealParent; revealParent.children.push(r); }

  const story = tEl({ scrolled: null, scrollIntoView(opts) { this.scrolled = opts; } });
  const startBtn = tEl({
    listeners: {},
    addEventListener(ev, fn) { (this.listeners[ev] ??= []).push(fn); },
    dispatch(ev) { for (const fn of this.listeners[ev] ?? []) fn({}); },
  });

  const extra = { 'start-exploring': startBtn, story };

  return {
    lab, pipe, track, panels, links, themeBtn, reveals, story, startBtn,
    documentElement: {
      attrs: {},
      setAttribute(k, v) { this.attrs[k] = v; },
      getAttribute(k) { return this.attrs[k] ?? null; },
    },
    createElement: pipe.createElement,
    getElementById: (id) =>
      lab.getElementById(id) ?? pipe.getElementById(id) ?? track.getElementById(id) ?? extra[id] ?? null,
    querySelectorAll(sel) {
      if (sel === '.tab-panel') return panels;
      if (sel === '[data-tab-link]') return links.filter((l) => l.dataset.tabLink);
      if (sel === '[data-tab-link], [data-track-tab]') return links;
      if (sel === '[data-theme-toggle]') return [themeBtn];
      if (sel === '[data-reveal]') return reveals;
      if (sel === '.slider') return [lab.modelInput];
      return lab.querySelectorAll(sel); // input[name="lab-*"] radio groups
    },
  };
}

{
  /* The TDZ only fired during MODULE EVALUATION — the auto-bootstrap at the
     foot of app.js calls initApp() before a trailing `const` is initialized.
     Calling the already-evaluated initApp() cannot reproduce that, so this
     block installs browser globals and then imports a FRESH copy of app.js
     (cache-busting query string), letting its own auto-bootstrap run. */
  const doc = makeAppDoc();
  const winListeners = {};
  const saved = {};
  const install = (k, v) => { saved[k] = globalThis[k]; globalThis[k] = v; };

  install('document', doc);
  install('window', {});
  install('location', { hash: '#/lab' }); // deep link: the tab shown on load counts as visited
  install('addEventListener', (ev, fn) => { (winListeners[ev] ??= []).push(fn); });
  install('localStorage', (() => {
    const m = new Map();
    return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) };
  })());

  try {
    await assert.doesNotReject(
      () => import('../js/app.js?bootstrap-test=1'),
      'app.js must bootstrap cleanly when it evaluates in a browser-like context'
    );
    ok('app.js auto-bootstraps against browser globals without throwing');

    // The bootstrap really wired each piece — not a silent no-op chain.
    assert.ok(doc.panels.find((p) => p.dataset.tab === 'lab').classList.contains('is-active'),
      'the deep-linked Lab panel is the active one');
    assert.equal(doc.panels.filter((p) => p.classList.contains('is-active')).length, 1,
      'exactly one panel is active');
    assert.equal(doc.track.ringLabel.textContent, '1/4', 'the deep-linked tab counts as a visit');
    assert.match(doc.lab.getElementById('po-tps').v.textContent, /tok\/s/, 'the Lab printouts painted');
    assert.match(doc.pipe.decodetps.textContent, /tok\/s/, 'the Pipeline tab painted (Stage 3)');
    assert.equal(doc.themeBtn.listeners.click?.length, 1, 'the theme toggle is wired');
    assert.equal(winListeners.hashchange?.length, 1, 'one hashchange listener on the window');
    ok('bootstrap paints the router, tracker, theme toggle, Lab and Pipeline');

    // hashchange → route + mark visited, end to end through the real handler.
    globalThis.location.hash = '#/how';
    winListeners.hashchange[0]();
    assert.ok(doc.panels.find((p) => p.dataset.tab === 'how').classList.contains('is-active'));
    assert.equal(doc.track.ringLabel.textContent, '2/4');
    ok('the bootstrapped hashchange handler routes to the new tab and counts the visit');
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete globalThis[k]; else globalThis[k] = v;
    }
  }
}

/* ------------- js/tabs/pipeline.js — P5 M4 (Step 4 · KV cache) ------------- */
console.log('tabs/pipeline.js — P5 M4 (Step 4 · KV cache growth)');

{ // kvGrowthView — linear in tokens, straight off the engine's §5 figure
  const cfg = { ...DEFAULT_CONFIG, contextWindow: 8192 };
  const perf = evaluate(cfg);

  const full = kvGrowthView(perf, cfg, 8192);
  assert.equal(full.tokens, 8192);
  assert.equal(full.pct, 1);
  // A full window must reproduce the engine's own per-request number exactly.
  assert.ok(Math.abs(full.usedGB - perf.kvCacheGB) < 1e-12, 'full window equals the engine kvCacheGB');

  const half = kvGrowthView(perf, cfg, 4096);
  assert.ok(Math.abs(half.usedGB - full.usedGB / 2) < 1e-12, 'half the tokens is half the memory');
  assert.equal(kvGrowthView(perf, cfg, 0).usedGB, 0, 'an empty conversation costs nothing');
  ok(`kvGrowthView is linear in tokens and matches the engine (${full.usedGB.toFixed(2)} GB at 8K)`);
}

{ // clamping and null safety
  const cfg = { ...DEFAULT_CONFIG, contextWindow: 8192 };
  const perf = evaluate(cfg);
  assert.equal(kvGrowthView(perf, cfg, 99999).tokens, 8192, 'clamped to the context window');
  assert.equal(kvGrowthView(perf, cfg, -50).tokens, 0, 'never negative');
  assert.equal(kvGrowthView(null, cfg, 100), null);
  assert.equal(kvGrowthView(perf, null, 100), null);
  assert.equal(kvCaption(null, null, 0), '…');
  ok('kvGrowthView clamps to the window, refuses negatives, and is null-safe');
}

{ // the teaching moment: at a long context the store outgrows the model
  const short = { ...DEFAULT_CONFIG, contextWindow: 8192 };
  const long = { ...DEFAULT_CONFIG, contextWindow: 131072 };
  const vShort = kvGrowthView(evaluate(short), short, 8192);
  const vLong = kvGrowthView(evaluate(long), long, 131072);

  assert.ok(!vShort.overtakesWithinWindow, '8K never overtakes the weights');
  assert.ok(vShort.shareOfWeightsPct < 100);
  assert.match(kvCompareNote(evaluate(short), short, 8192), /stays smaller than the model/);

  assert.ok(vLong.overtakesWithinWindow, '128K does overtake the weights');
  assert.ok(vLong.shareOfWeightsPct > 100, `128K store is ${vLong.shareOfWeightsPct.toFixed(0)}% of the weights`);
  assert.match(kvCompareNote(evaluate(long), long, 131072), /larger than the model itself/);
  // The per-token cost is a property of the model, not of the window.
  assert.ok(Math.abs(vShort.perTokenMB - vLong.perTokenMB) < 1e-9, 'per-token cost does not depend on the window');
  ok(`the store overtakes the weights at ${vLong.overtakeTokens.toLocaleString()} tokens (within a 128K window, not an 8K one)`);
}

{ // DOM: first paint, slider drag, and the bar
  const storage = { _m: new Map(), getItem(k) { return this._m.get(k) ?? null; }, setItem(k, v) { this._m.set(k, String(v)); } };
  const store = createStore({ initialConfig: { ...DEFAULT_CONFIG, contextWindow: 8192 }, storage });
  const doc = makePipeDoc();
  const api = initPipeline({ doc, store });

  // Opens a quarter of the way in rather than at a flat zero.
  assert.equal(doc.kvslider.value, '2048');
  assert.equal(doc.kvslider.max, '8192');
  assert.match(doc.kvtokens.textContent, /^2,048 tokens$/);
  assert.match(doc.kvused.textContent, /^0\.\d+ GB$/);
  assert.match(doc.kvcaption.textContent, /25% of this model's 8,192 token limit/);
  const quarterFill = doc.kvseg.style.props['--w'];
  assert.equal(quarterFill, '25.0%');
  ok(`Step 4 first paint: 2,048 of 8,192 tokens, bar at ${quarterFill}, ${doc.kvused.textContent}`);

  // Dragging repaints Stage 4 from the same engine numbers.
  doc.kvslider.value = '8192';
  doc.kvslider.dispatch('input');
  assert.equal(doc.kvseg.style.props['--w'], '100.0%');
  assert.match(doc.kvtokens.textContent, /^8,192 tokens$/);
  const fullGB = parseFloat(doc.kvused.textContent);
  assert.ok(Math.abs(fullGB - evaluate(store.getState().config).kvCacheGB) < 0.01, 'reads the engine figure at full window');
  ok(`dragging to the end fills the bar and reports ${doc.kvused.textContent}`);

  api.destroy();
}

{ // a context change in the Lab re-renders Step 4 and re-clamps the slider
  const storage = { _m: new Map(), getItem(k) { return this._m.get(k) ?? null; }, setItem(k, v) { this._m.set(k, String(v)); } };
  const store = createStore({ initialConfig: { ...DEFAULT_CONFIG, contextWindow: 131072 }, storage });
  const doc = makePipeDoc();
  const api = initPipeline({ doc, store });

  doc.kvslider.value = '131072';
  doc.kvslider.dispatch('input');
  const before = doc.kvused.textContent;
  assert.ok(doc.kvbar.attrs['data-state'] === 'warn', 'the bar warns once the store outgrows the model');
  assert.match(doc.kvcompare.textContent, /larger than the model itself/);

  // Shrinking the window must clamp the dragged position, not leave it past the end.
  store.setConfig({ contextWindow: 8192 });
  assert.equal(doc.kvslider.max, '8192');
  assert.equal(doc.kvslider.value, '8192', 'the slider was clamped to the smaller window');
  assert.notEqual(doc.kvused.textContent, before, 'the readout moved with the window');
  assert.equal(doc.kvbar.attrs['data-state'], 'ok', 'and the warning clears');
  ok(`a Lab context change re-clamps Step 4 (${before} at 128K → ${doc.kvused.textContent} at 8K)`);

  api.destroy();
}

/* ------------- js/tabs/pipeline.js — P5 M5 (Step 5 · Sampling) ------------- */
console.log('tabs/pipeline.js — P5 M5 (Step 5 · Sampling)');

const psum = (rows) => rows.reduce((a, b) => a + b.p, 0);

{ // the illustrative candidate list is a real distribution
  assert.equal(SAMPLE_CANDIDATES.length, 10);
  assert.ok(Math.abs(psum(SAMPLE_CANDIDATES) - 1) < 1e-9, 'candidate probabilities sum to 1');
  ok('the illustrative candidate list is a valid distribution summing to 1');
}

{ // temperature: 1 is a no-op, below 1 sharpens, above 1 flattens
  const at1 = applyTemperature(SAMPLE_CANDIDATES, 1);
  for (let i = 0; i < at1.length; i += 1) {
    assert.ok(Math.abs(at1[i].p - SAMPLE_CANDIDATES[i].p) < 1e-12, 'temperature 1 changes nothing');
  }

  const cold = applyTemperature(SAMPLE_CANDIDATES, 0.2);
  const hot = applyTemperature(SAMPLE_CANDIDATES, 2);
  assert.ok(cold[0].p > SAMPLE_CANDIDATES[0].p, 'a low temperature sharpens the favourite');
  assert.ok(hot[0].p < SAMPLE_CANDIDATES[0].p, 'a high temperature flattens it');
  assert.ok(hot[9].p > SAMPLE_CANDIDATES[9].p, 'and lifts the least likely option');

  for (const [name, d] of [['cold', cold], ['hot', hot]]) {
    assert.ok(Math.abs(psum(d) - 1) < 1e-9, `${name} still sums to 1`);
  }
  ok(`temperature reshapes correctly (favourite ${(cold[0].p * 100).toFixed(0)}% cold, ${(hot[0].p * 100).toFixed(0)}% hot)`);
}

{ // temperature 0 is greedy, and every path stays normalised
  const greedy = applyTemperature(SAMPLE_CANDIDATES, 0);
  assert.equal(greedy[0].p, 1, 'all the mass on the favourite');
  assert.equal(psum(greedy), 1);
  assert.ok(greedy.slice(1).every((c) => c.p === 0), 'nothing left for anything else');
  assert.deepEqual(applyTemperature([], 1), [], 'empty input is safe');
  assert.deepEqual(applyTemperature(null, 1), [], 'null input is safe');
  ok('temperature 0 is greedy (one option at 100%), and empty input is safe');
}

{ // top-p keeps the smallest set reaching p, then renormalises
  const half = applyTopP(SAMPLE_CANDIDATES, 0.5);
  const kept = half.filter((c) => c.kept);
  // 0.42 then 0.60 crosses 0.5, so exactly two survive.
  assert.equal(kept.length, 2, 'top-p 0.5 keeps two options');
  assert.ok(Math.abs(kept[0].p - 0.42 / 0.6) < 1e-9, 'survivors are renormalised');
  assert.ok(Math.abs(psum(half) - 1) < 1e-9, 'and still sum to 1');
  assert.ok(half.filter((c) => !c.kept).every((c) => c.p === 0), 'discarded options carry no probability');

  assert.equal(applyTopP(SAMPLE_CANDIDATES, 1).filter((c) => c.kept).length, 10, 'top-p 1 keeps everything');
  assert.equal(applyTopP(SAMPLE_CANDIDATES, 0).filter((c) => c.kept).length, 1, 'top-p 0 still keeps one');
  ok('top-p keeps the smallest set reaching the threshold and renormalises the survivors');
}

{ // samplingView + caption
  const v = samplingView(SAMPLE_CANDIDATES, { temperature: 1, topP: 0.9 });
  assert.equal(v.keptCount + v.discardedCount, 10);
  assert.equal(v.topToken, ' mat');
  assert.match(samplingCaption(v, { temperature: 1, topP: 0.9 }), /temperature of 1/);

  const coldCap = samplingCaption(samplingView(SAMPLE_CANDIDATES, { temperature: 0.3, topP: 1 }), { temperature: 0.3, topP: 1 });
  assert.match(coldCap, /sharpens/);
  assert.match(coldCap, /keeping every option/);

  const hotCap = samplingCaption(samplingView(SAMPLE_CANDIDATES, { temperature: 1.6, topP: 0.5 }), { temperature: 1.6, topP: 0.5 });
  assert.match(hotCap, /flattens/);
  assert.match(hotCap, /discards the other/);

  const zeroCap = samplingCaption(samplingView(SAMPLE_CANDIDATES, { temperature: 0, topP: 1 }), { temperature: 0, topP: 1 });
  assert.match(zeroCap, /same question gives the same answer/);
  ok('samplingCaption describes sharpening, flattening, greedy and the top-p cut');
}

{ // DOM: the chart renders and reshapes when the sliders move
  const doc = makePipeDoc();
  const api = initPipeline({ doc });

  assert.equal(doc.samplebars.children.length, 10, 'one row per candidate');
  assert.equal(doc.tempvalue.textContent, '1.00');
  assert.equal(doc.toppvalue.textContent, '0.90');
  const firstRow = doc.samplebars.children[0];
  assert.ok(firstRow.classList.contains('bw-row'));
  assert.equal(firstRow.children[0].textContent, '" mat"', 'label is the token, quoted');
  const widthAt1 = firstRow.children[1].children[0].style.props['--w'];
  ok(`Step 5 first paint: 10 rows, favourite bar at ${widthAt1}, caption written`);

  // Drop the temperature: the favourite's bar must grow.
  doc.temp.value = '0.2';
  doc.temp.dispatch('input');
  const widthCold = doc.samplebars.children[0].children[1].children[0].style.props['--w'];
  assert.ok(parseFloat(widthCold) > parseFloat(widthAt1), 'a colder temperature grows the favourite bar');
  assert.equal(doc.tempvalue.textContent, '0.20');
  assert.match(doc.samplecaption.textContent, /sharpens/);
  ok(`dragging temperature to 0.20 reshapes the chart (${widthAt1} → ${widthCold})`);

  // Tighten top-p: rows below the cut are marked, not deleted.
  doc.temp.value = '1'; doc.temp.dispatch('input');
  doc.topp.value = '0.5'; doc.topp.dispatch('input');
  const rows = doc.samplebars.children;
  assert.equal(rows.length, 10, 'discarded rows stay visible so the reader sees the cut');
  const cut = rows.filter((r) => r.classList.contains('is-cut'));
  assert.equal(cut.length, 8, 'eight of the ten are cut at top-p 0.5');
  assert.equal(cut[0].children[2].textContent, 'cut', 'a discarded row reads "cut", not "0%"');
  ok('tightening top-p marks the discarded rows instead of removing them');

  api.destroy?.();
}

{ // renderSampling is null-safe on a page without the chart
  const doc = makePipeDoc();
  assert.equal(renderSampling(doc, null, samplingView(SAMPLE_CANDIDATES, {})), 0);
  assert.equal(renderSampling(null, doc.samplebars, null), 0);
  ok('renderSampling is safe without a host or a view');
}

/* ---------------- js/tabs/glossary.js (Tab 5) ---------------- */
console.log('tabs/glossary.js');

{ // data integrity: the glossary is the single source of truth for both surfaces
  const ids = new Set(GLOSSARY.map((t) => t.id));
  assert.equal(ids.size, GLOSSARY.length, 'term ids are unique');
  let linkCount = 0;
  for (const t of GLOSSARY) {
    assert.ok(t.term && t.short && t.full, `${t.id} has term/short/full`);
    assert.ok(Array.isArray(t.links) && t.links.length > 0, `${t.id} has at least one Learn more link`);
    for (const l of t.links) {
      linkCount += 1;
      assert.ok(l.title && l.source, `${t.id} link is labelled`);
      // https only, and no relative or javascript: URL can sneak in.
      assert.match(l.url, /^https:\/\//, `${t.id} link is https`);
      assert.match(l.url, /^https:\/\/en\.wikipedia\.org\/wiki\/\S+$/, `${t.id} link is a Wikipedia article`);
      assert.ok(!/\s/.test(l.url), `${t.id} link has no whitespace`);
    }
  }
  ok(`glossary data: ${GLOSSARY.length} terms, unique ids, ${linkCount} outbound links, all https Wikipedia articles`);
}

{ // style-guide.md: the banned characters must never reach a reader
  const offenders = GLOSSARY.filter((t) => /[—]/.test(`${t.term}${t.short}${t.full}`));
  assert.deepEqual(offenders.map((t) => t.id), [], 'no em dash in any definition');
  const middots = GLOSSARY.filter((t) => /·/.test(`${t.short}${t.full}`));
  assert.deepEqual(middots.map((t) => t.id), [], 'no middot inside definition prose');
  ok('every definition obeys the style guide (no em dash, no middot in prose)');
}

{ // pure: deep-link parsing
  assert.equal(termIdFromHash('#/glossary/kv-cache'), 'kv-cache');
  assert.equal(termIdFromHash('#/glossary/KV-Cache'), 'kv-cache', 'case-insensitive');
  assert.equal(termIdFromHash('#/glossary'), null, 'the bare tab is not a term link');
  assert.equal(termIdFromHash('#/lab'), null);
  assert.equal(termIdFromHash(''), null);
  assert.equal(termIdFromHash(null), null);
  ok('termIdFromHash reads "#/glossary/<term>" and ignores everything else');
}

{ // pure: hover text
  assert.match(tooltipText('token'), /unit of text/i);
  assert.equal(tooltipText('not-a-real-term'), null);
  assert.equal(tooltipText(null), null);
  ok('tooltipText returns the short definition, null for unknown terms');
}

function makeGlossEl(extra = {}) {
  const classes = new Set();
  return Object.assign({
    attrs: {}, textContent: '', style: {}, children: [], dataset: {},
    classList: {
      add(c) { classes.add(c); }, remove(c) { classes.delete(c); }, contains: (c) => classes.has(c),
      toggle(c, on) { if (on) classes.add(c); else classes.delete(c); },
    },
    setAttribute(k, v) { this.attrs[k] = v; },
    getAttribute(k) { return this.attrs[k] ?? null; },
    removeAttribute(k) { delete this.attrs[k]; },
    appendChild(c) { this.children.push(c); return c; },
    removeChild(c) { this.children.splice(this.children.indexOf(c), 1); },
    get firstChild() { return this.children[0] ?? null; },
  }, extra);
}

function makeGlossDoc() {
  const list = makeGlossEl();
  const tip = makeGlossEl();
  const byId = { 'glossary-list': list, 'gloss-tip': tip };
  const listeners = {};
  return {
    list, tip, listeners,
    getElementById: (id) => byId[id] ?? null,
    createElement: () => makeGlossEl(),
    createTextNode: (text) => ({ text }),
    addEventListener(ev, fn) { (listeners[ev] ??= []).push(fn); },
    removeEventListener(ev, fn) {
      const a = listeners[ev] ?? []; const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1);
    },
    fire(ev, event) { for (const fn of [...(listeners[ev] ?? [])]) fn(event); },
    /** Register rendered entries so getElementById finds them, as a real DOM would. */
    index() { for (const e of list.children) byId[e.attrs.id] = e; },
  };
}

{ // page rendering: one anchored entry per term
  const doc = makeGlossDoc();
  const n = renderGlossary(doc, doc.list);
  assert.equal(n, GLOSSARY.length);
  assert.equal(doc.list.children.length, GLOSSARY.length);
  const first = doc.list.children[0];
  assert.equal(first.attrs.id, GLOSSARY[0].id, 'entry id is the term id, so it can be linked to');
  assert.ok(first.classList.contains('gloss-entry'));
  assert.equal(first.children[0].textContent, GLOSSARY[0].term, 'heading is the term');
  assert.equal(first.children[1].textContent, GLOSSARY[0].full, 'body is the full definition');
  const more = first.children[2];
  assert.ok(more.classList.contains('gloss-more'), 'the third block is the Learn more row');
  assert.equal(more.textContent, 'Learn more: ');
  const anchor = more.children[0];
  assert.equal(anchor.textContent, `Wikipedia \u201c${GLOSSARY[0].links[0].title}\u201d`,
    'rendered as Wikipedia \u201cArticle title\u201d');
  assert.equal(anchor.attrs.href, GLOSSARY[0].links[0].url);
  // External links must not hand the opener to the target page.
  assert.equal(anchor.attrs.target, '_blank');
  assert.equal(anchor.attrs.rel, 'noopener noreferrer');
  ok(`renderGlossary builds ${n} anchored entries from the data file`);
}

{ // rendering twice must not duplicate (a re-render clears first)
  const doc = makeGlossDoc();
  renderGlossary(doc, doc.list);
  renderGlossary(doc, doc.list);
  assert.equal(doc.list.children.length, GLOSSARY.length, 'no duplicated entries');
  ok('renderGlossary clears before it rebuilds');
}

{ // hover cards: show on hover, hide on leave, describedby for screen readers
  const doc = makeGlossDoc();
  const cards = initTermCards({ doc });
  assert.equal(doc.tip.getAttribute('aria-hidden'), 'true', 'starts hidden');

  const word = makeGlossEl({ dataset: { term: 'kv-cache' } });
  word.closest = function (sel) { return sel === '[data-term]' ? this : null; };

  doc.fire('mouseover', { target: word });
  assert.ok(doc.tip.classList.contains('is-visible'));
  assert.match(doc.tip.textContent, /keys and values/i, 'shows that term’s short definition');
  assert.equal(doc.tip.getAttribute('aria-hidden'), 'false');
  assert.equal(word.getAttribute('aria-describedby'), 'gloss-tip', 'wired for screen readers');
  ok('hovering a marked-up term shows its definition and announces it');

  doc.fire('mouseout', { target: word });
  assert.ok(!doc.tip.classList.contains('is-visible'));
  assert.equal(word.getAttribute('aria-describedby'), null, 'describedby is cleaned up');
  ok('leaving the term hides the card again');

  // Keyboard parity: focus does what hover does, Escape dismisses.
  doc.fire('focusin', { target: word });
  assert.ok(doc.tip.classList.contains('is-visible'), 'keyboard focus shows the same card');
  doc.fire('keydown', { key: 'Escape' });
  assert.ok(!doc.tip.classList.contains('is-visible'), 'Escape dismisses it');
  ok('keyboard users get the same card via focus, and Escape dismisses it');

  // An unknown term must not show an empty card.
  const bogus = makeGlossEl({ dataset: { term: 'nonsense' } });
  bogus.closest = function () { return this; };
  doc.fire('mouseover', { target: bogus });
  assert.ok(!doc.tip.classList.contains('is-visible'), 'unknown term shows nothing');
  ok('an unknown data-term shows no card rather than an empty one');

  cards.destroy();
  doc.fire('mouseover', { target: word });
  assert.ok(!doc.tip.classList.contains('is-visible'), 'destroy() unwires the listeners');
  ok('destroy() removes every delegated listener');
}

{ // deep link: '#/glossary/<term>' scrolls to and marks that entry
  const doc = makeGlossDoc();
  const api = initGlossary({ doc, hash: '#/glossary/vram' });
  doc.index();
  assert.equal(api.count, GLOSSARY.length);

  // initGlossary ran focusTerm before the entries were indexed, so drive it
  // again the way the hashchange handler does.
  const el = api.focusTerm('#/glossary/vram');
  assert.ok(el, 'the deep-linked entry was found');
  assert.ok(el.classList.contains('is-target'), 'it is marked as the target');

  const other = api.focusTerm('#/glossary/token');
  assert.ok(other.classList.contains('is-target'));
  assert.ok(!el.classList.contains('is-target'), 'only one entry is ever the target');
  ok('a "#/glossary/<term>" deep link marks exactly one entry as the target');

  assert.equal(api.focusTerm('#/glossary'), null, 'the bare tab targets nothing');
  assert.equal(api.focusTerm('#/glossary/not-a-term'), null, 'an unknown term targets nothing');
  ok('bare and unknown glossary links target nothing, without throwing');
}

{ // the glossary is a router tab but NOT a tracked one (owner, 2026-09-05)
  assert.ok(TABS.includes('glossary'), 'it routes');
  assert.equal(TAB_TO_STORE.glossary, undefined, 'it has no store id');
  assert.equal(trackerView([]).total, 4, 'the Explorer badge still counts four tabs');
  assert.ok(!unseenRouterTabs([]).includes('glossary'), 'and it never shows a "new" dot');
  ok('the glossary routes without joining the Explorer badge (ring stays n/4)');
}

{ // router regression: a deep-link sub-path must survive the load rewrite
  const saved = { location: globalThis.location, history: globalThis.history };
  let replacedWith = null;
  globalThis.history = { replaceState: (a, b, url) => { replacedWith = url; } };
  try {
    const panels = TABS.map((t) => makeGlossEl({ dataset: { tab: t } }));
    const doc = { querySelectorAll: (sel) => (sel === '.tab-panel' ? panels : []) };

    globalThis.location = { hash: '#/glossary/kv-cache' };
    const r = initRouter({ doc, hash: '#/glossary/kv-cache' });
    assert.equal(r.initial, 'glossary');
    assert.equal(replacedWith, null,
      'the router must NOT rewrite "#/glossary/kv-cache" to "#/glossary" and drop the term');
    ok('initRouter preserves a deep-link sub-path (the term survives page load)');

    replacedWith = null;
    globalThis.location = { hash: '' };
    initRouter({ doc, hash: '' });
    assert.equal(replacedWith, '#/home', 'a bare load still gets a bookmarkable hash');
    ok('initRouter still normalises a bare load to #/home');
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete globalThis[k]; else globalThis[k] = v;
    }
  }
}

/* ---------------- js/tabs/compare.js — P7 M1 (the race) ---------------- */
console.log('tabs/compare.js — P7 M1 (Local vs Cloud race)');

{ // the field is built from real data, and unmeasured models are left out
  const racers = cloudRacers();
  assert.ok(racers.length >= 3, 'at least three cloud models can be raced');

  // DeepSeek V4 Flash carries outputTps: null in cloud.js. It must be EXCLUDED
  // rather than guessed at, which is the whole point of the filter.
  const flash = CLOUD_MODELS.find((m) => m.id === 'deepseek-v4-flash');
  assert.ok(flash && flash.outputTps == null, 'test premise: Flash has no measured speed');
  assert.ok(!racers.some((r) => r.id === 'deepseek-v4-flash'), 'a model with no measured speed is not raced');

  for (const r of racers) {
    assert.ok(r.tps > 0 && r.waitS != null, `${r.id} has a real speed and wait`);
    assert.ok(r.sources.length > 0, `${r.id} carries its source ids`);
  }
  ok(`cloudRacers builds ${racers.length} racers from sourced data and drops the unmeasured one`);
}

{ // the local racer comes from the engine, and sits out when it cannot fit
  const cfg = { ...DEFAULT_CONFIG };
  const perf = evaluate(cfg);
  const me = localRacer(perf, cfg);
  assert.equal(me.tps, perf.decodeTpsPerRequest, 'speed is the engine figure, not a copy');
  assert.ok(Math.abs(me.waitS - perf.ttftMs / 1000) < 1e-9, 'wait is the engine TTFT in seconds');

  const tooBig = { ...DEFAULT_CONFIG, gpuId: 'rtx-3060-12g', modelStopIndex: 9 };
  const noFit = evaluate(tooBig);
  assert.equal(noFit.decodeTpsPerRequest, null, 'test premise: this config does not fit');
  assert.equal(localRacer(noFit, tooBig), null, 'a machine that cannot run does not enter');
  ok('the local racer is taken straight from the engine, and sits out when the model does not fit');
}

{ // racePlan: ordering, finishing times, and the labeled compression
  const cfg = { ...DEFAULT_CONFIG };
  const plan = racePlan(evaluate(cfg), cfg);
  assert.equal(plan.racers.length, 4, 'local plus three raceable cloud models');
  assert.equal(plan.targetTokens, 256);

  for (const r of plan.racers) {
    assert.ok(Math.abs(r.finishS - (r.waitS + 256 / r.tps)) < 1e-9, `${r.id} finish = wait + writing time`);
  }

  // Places must follow finishing time, not list order.
  const byPlace = [...plan.racers].sort((a, b) => a.place - b.place);
  for (let i = 1; i < byPlace.length; i += 1) {
    assert.ok(byPlace[i].finishS >= byPlace[i - 1].finishS, 'places are ordered by finishing time');
  }

  // Blueprint §6 Tab 4 acceptance: the race fits in 20 s of real time.
  assert.ok(plan.realDurationS <= RACE_REAL_BUDGET_S + 1e-9, `race fits the ${RACE_REAL_BUDGET_S} s budget`);
  assert.ok(plan.speedup > 1, 'and needs compressing to do it');
  assert.match(raceNote(plan), /sped up .* times/, 'the compression is labelled');
  ok(`racePlan: 4 racers, slowest ${plan.slowestS.toFixed(0)} s compressed ${plan.speedup.toFixed(1)}x into ${plan.realDurationS.toFixed(1)} s`);
}

{ // the honest bit: GPT-5.6's wait is thinking time, and is described as such
  const cfg = { ...DEFAULT_CONFIG };
  const plan = racePlan(evaluate(cfg), cfg);
  const sol = plan.racers.find((r) => r.id === 'gpt-56-sol');
  assert.ok(sol.waitIsThinking, 'cloud.js flags this wait as thinking time');
  assert.match(waitLabel(sol), /thinking/, 'and the label says so rather than blaming the network');

  const fast = plan.racers.find((r) => r.id === 'deepseek-v4-pro');
  assert.ok(!fast.waitIsThinking);
  assert.match(waitLabel(fast), /before the first word/);

  // It finishes last despite being the fastest writer of the cloud models.
  const cloud = plan.racers.filter((r) => !r.isLocal);
  assert.equal(Math.max(...cloud.map((r) => r.tps)), sol.tps, 'it writes fastest of the cloud models');
  assert.equal(Math.max(...cloud.map((r) => r.finishS)), sol.finishS, 'yet finishes last');
  ok('the reasoning model finishes last despite writing fastest, and its wait is labelled as thinking');
}

{ // progress over time
  const cfg = { ...DEFAULT_CONFIG };
  const plan = racePlan(evaluate(cfg), cfg);
  const r = plan.racers.find((x) => x.isLocal);

  assert.equal(racerTokensAt(r, 0), 0, 'nothing written at the start');
  assert.equal(racerTokensAt(r, r.waitS), 0, 'still nothing at the end of the wait');
  assert.equal(racerStatus(r, 0), 'Waiting…');
  assert.ok(racerTokensAt(r, r.waitS + 1) > 0, 'writing has begun a second later');
  assert.equal(racerTokensAt(r, r.finishS), 256, 'exactly the target at the finish');
  assert.equal(racerTokensAt(r, r.finishS + 100), 256, 'and never more than the target');
  assert.match(racerStatus(r, r.finishS), /^Finished in /);

  const sol = plan.racers.find((x) => x.id === 'gpt-56-sol');
  assert.equal(racerStatus(sol, 5), 'Thinking, 5 s so far', 'a reasoning model says it is thinking, not waiting');
  assert.equal(racerStatus(sol, 0.5), 'Thinking…', 'and does not count from a standing start');
  // The wait must visibly tick, or the reasoning model shows a frozen row for
  // nearly the whole race.
  assert.notEqual(racerStatus(sol, 40), racerStatus(sol, 41), 'the wait counts up every second');
  ok('racerTokensAt holds at zero through the wait, then fills to exactly the target');
}

{ // rendering + a clock-driven run
  const doc = makeGlossDoc(); // reuse: same element factory shape
  const host = doc.list;
  const cfg = { ...DEFAULT_CONFIG };
  const plan = racePlan(evaluate(cfg), cfg);

  assert.equal(renderRace(doc, host, plan, 0), 4, 'one row per racer');
  assert.ok(host.children[0].classList.contains('bw-row'));
  assert.ok(host.children.some((r) => r.classList.contains('is-local')), "the reader's own row is marked");
  assert.equal(renderRace(doc, null, plan, 0), 0, 'no host is safe');
  assert.equal(renderRace(doc, host, null, 0), 0, 'no plan is safe');

  // Drive it with an injected clock rather than a real one.
  const clock = makeClock();
  const ctl = runRace({ doc, host, plan, raf: clock.raf, now: clock.now, reduced: false });
  clock.step(0); // paint the start line
  // Step to the end of the compressed run, a frame at a time.
  while (clock.isPending()) clock.step(plan.realDurationS * 100);
  const last = host.children.find((r) => r.classList.contains('is-local'));
  assert.match(last.children[2].textContent, /^Finished in /, 'the local racer finished by the end');
  ctl.cancel();
  ok('the race renders a row per racer and runs to completion on an injected clock');
}

{ // reduced motion paints the finished state instantly, never calling raf
  const doc = makeGlossDoc();
  const cfg = { ...DEFAULT_CONFIG };
  const plan = racePlan(evaluate(cfg), cfg);
  let rafCalls = 0;
  runRace({ doc, host: doc.list, plan, raf: () => { rafCalls += 1; }, now: () => 0, reduced: true });
  assert.equal(rafCalls, 0, 'raf is never called under reduced motion');
  for (const row of doc.list.children) {
    assert.match(row.children[2].textContent, /^Finished in /, 'every racer is shown finished');
  }
  ok('reduced motion paints the finished race instantly without animating');
}

{ // a hardware change in the Lab rebuilds the field
  const storage = { _m: new Map(), getItem(k) { return this._m.get(k) ?? null; }, setItem(k, v) { this._m.set(k, String(v)); } };
  const store = createStore({ initialConfig: { ...DEFAULT_CONFIG }, storage });
  const doc = makeGlossDoc();
  const runBtn = { listeners: {}, addEventListener(ev, fn) { (this.listeners[ev] ??= []).push(fn); } };
  const note = { textContent: '' };
  const localNote = { textContent: '' };
  doc.getElementById = (id) => ({
    'cmp-race': doc.list, 'cmp-run': runBtn, 'cmp-race-note': note, 'cmp-race-local': localNote,
  }[id] ?? null);

  const api = initCompare({ doc, store, reduced: true });
  const before = api.getPlan().racers.find((r) => r.isLocal).tps;
  assert.match(localNote.textContent, /Your machine is in the race/);

  store.setConfig({ gpuId: 'rtx-3060-12g' });
  const after = api.getPlan().racers.find((r) => r.isLocal).tps;
  assert.notEqual(after, before, 'the local racer moves with the hardware');

  // Push it past what the hardware can hold: the reader drops out of the race.
  store.setConfig({ modelStopIndex: 9 });
  assert.ok(!api.getPlan().localRan, 'a machine that cannot fit the model leaves the race');
  assert.match(localNote.textContent, /cannot fit this model/);
  assert.equal(api.getPlan().racers.length, 3, 'the cloud models race on without it');
  api.destroy();
  ok(`a Lab hardware change rebuilds the field (${before.toFixed(0)} → ${after.toFixed(0)} tok/s, then out of the race)`);
}

/* ---------------- style-guide.md enforcement ----------------- */
console.log('style guide (copy rules)');

/* The em dash ban is a writing rule, so it needs a mechanical guard or it
   rots. Two halves:
     1. Panels whose copy has been rewritten must hold at ZERO. Add each
        panel here as its rewrite lands.
     2. Everything not yet rewritten gets a budget that may only ever go
        DOWN. Lower these numbers as sections are rewritten; a rise means
        new copy shipped in the old voice.
   HTML comments are stripped first: the rule governs what a reader sees,
   not what a developer reads. */
{
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
    .replace(/<!--[\s\S]*?-->/g, '');

  const panel = (tab) => {
    const i = html.indexOf(`data-tab="${tab}"`);
    if (i < 0) return '';
    const j = html.indexOf('<section class="tab-panel', i + 10);
    return html.slice(i, j < 0 ? html.length : j);
  };
  const emDashes = (text) => (text.match(/—/g) ?? []).length;

  // Every panel is now rewritten, so every panel holds at zero. There is no
  // budget left: if this fails, new copy shipped in the banned voice.
  for (const tab of ['home', 'how', 'lab', 'glossary', 'compare']) {
    const n = emDashes(panel(tab));
    assert.equal(n, 0, `the ${tab} panel must contain no em dash, found ${n}`);
  }
  assert.equal(emDashes(html), 0, 'no em dash anywhere a reader can see it');
  ok('every panel is free of em dashes in reader-facing text');

  // The middot is a data-label separator, never sentence punctuation. Catch
  // the clear violation: a middot sitting between two lowercase words.
  const proseMiddot = [...html.matchAll(/[a-z]\s·\s[a-z]/g)].map((m) => m[0]);
  assert.deepEqual(proseMiddot, [], 'no middot used as punctuation inside a sentence');
  ok('no middot used as sentence punctuation anywhere in the page');
}

{ // Copy generated at RUNTIME by the Lab and Pipeline. Most of the site's
  // prose lives in JavaScript template strings, which the index.html scan
  // above cannot reach, so drive the real functions across the interesting
  // hardware states and check what a reader would actually be shown.
  const configs = [
    ['fast path', { ...DEFAULT_CONFIG }],
    ['offloading', { ...DEFAULT_CONFIG, gpuId: 'v100-pcie-16g', modelStopIndex: 7, ramCapacityGB: 128 }],
    ['does not fit', { ...DEFAULT_CONFIG, gpuId: 'rtx-3060-12g', modelStopIndex: 9 }],
    ['four at once', { ...DEFAULT_CONFIG, concurrency: 4 }],
  ];

  const offenders = [];
  for (const [label, config] of configs) {
    const perf = evaluate(config);
    const strings = [
      memoryCaption(perf, config), fitChipText(perf, config), loadCaption(perf, config),
      prefillCaption(perf), decodeCaption(perf), speedNote(perf),
      offloadNote(perf, config), concTeaching(perf, config)?.ttftNote,
      // simPlan is null when the model does not fit, and stageText needs one.
      ...(simPlan(perf) ? [stageText('prefill', simPlan(perf)), stageText('decoding', simPlan(perf))] : []),
      fmtTps(perf.decodeTpsPerRequest), fmtMs(perf.ttftMs), fmtTps(null), fmtMs(null),
      quantExplainer(config.quantId),
    ].filter((x) => typeof x === 'string');

    for (const str of strings) {
      if (/—/.test(str)) offenders.push(`${label}: ${str.slice(0, 70)}`);
    }
  }
  assert.deepEqual(offenders, [], 'no em dash in any string the Lab or Pipeline shows a reader');
  ok('runtime copy from the Lab and Pipeline is clean across fast, offload, no-fit and multi-user states');
}

{ // Glossary terms must be marked up so the hover cards can find them.
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const marked = [...html.matchAll(/data-term="([a-z0-9-]+)"/g)].map((m) => m[1]);
  assert.ok(marked.length > 0, 'the copy marks up at least one glossary term');

  const ids = new Set(GLOSSARY.map((t) => t.id));
  const unknown = [...new Set(marked)].filter((id) => !ids.has(id));
  assert.deepEqual(unknown, [], 'every data-term in the markup exists in the glossary data');
  ok(`all ${new Set(marked).size} marked-up terms in the page resolve to a real definition`);

  // A marked term must also be a real link, so clicking reaches the glossary.
  const links = [...html.matchAll(/<a class="gloss" data-term="([a-z0-9-]+)" href="#\/glossary\/([a-z0-9-]+)"/g)];
  assert.equal(links.length, marked.length, 'every marked term is a link to the glossary');
  for (const [, term, href] of links) {
    assert.equal(term, href, `data-term and href must name the same term (${term} vs ${href})`);
  }
  ok('every marked term links to its own glossary entry (click goes to the definition)');
}

console.log(`\n============================================================`);
console.log(`ALL PASS — ${passed} checks green (UI logic incl. P6 M1–M4 Lab + P5 M1 Pipeline w/ real Qwen3 vocab subset + P5 M2 Model load + P5 M3 Prefill vs decode + P5 M4 KV cache + P5 M5 Sampling + P7 M1 race + app.js bootstrap).`);

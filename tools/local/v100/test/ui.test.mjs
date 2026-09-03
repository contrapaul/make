/* ============================================================
   v100 — Phase 4 UI logic tests (plain Node ESM, no framework)
   ------------------------------------------------------------
   Runs the browser modules against minimal DOM stubs:
     - js/theme.js        theme resolution precedence + toggle/persist
     - js/motion/scroll.js stagger index, IO wiring, reversibility,
                          pulse micro-interaction, slider fill binding
     - js/app.js          hash router + exploration tracker (P4)
     - js/tabs/home.js    hero CTA → story scroll (P4)
   Run: node test/ui.test.mjs
   ============================================================ */

import { strict as assert } from 'node:assert';
import { STORAGE_KEY, resolveInitialTheme, initTheme } from '../js/theme.js';
import { revealStaggerIndex, initReveals, pulse, bindRangeFill } from '../js/motion/scroll.js';
import {
  tabFromHash, initRouter,
  TAB_TO_STORE, trackerView, unseenRouterTabs, initTracker, CELEBRATED_KEY,
} from '../js/app.js';
import { initHome } from '../js/tabs/home.js';
import {
  clampCapacity, modeSwitchPartial, tierSwitchPartial, anchorNote, initLab,
} from '../js/tabs/lab.js';
import { createStore, DEFAULT_CONFIG } from '../js/state/store.js';

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

{ // IO wiring: rootMargin, observe list, reversible class toggling, disconnect
  const b = makeEl({ attrs: { 'data-reveal': true } });
  const c = makeEl({ attrs: { 'data-reveal': true } });
  for (const el of [b, c]) el.parentElement = { children: [b, c] };

  let cb = null; let opts = null; const observed = []; let disconnected = false;
  class IOStub {
    constructor(callback, options) { cb = callback; opts = options; }
    observe(el) { observed.push(el); }
    disconnect() { disconnected = true; }
  }

  const root = { querySelectorAll: () => [b, c] };
  const r = initReveals({ root, IO: IOStub });

  assert.equal(opts.rootMargin, '-10% 0px');
  ok('IntersectionObserver configured with rootMargin "-10% 0px" (§8)');
  assert.deepEqual(observed, [b, c]);
  assert.equal(b.style.vars['--i'], '0');
  assert.equal(c.style.vars['--i'], '1');

  cb([{ target: b, isIntersecting: true }]);
  assert.ok(b.classList.contains('in-view'));
  ok('.in-view added when the element enters the band');

  cb([{ target: b, isIntersecting: false }]);
  assert.ok(!b.classList.contains('in-view'));
  ok('.in-view removed when it leaves — reversible on scroll-up (§8)');

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

function makeClassEl(extra = {}) {
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
  // 192/256 GB chips are DDR5-only (labels carry data-tier-only, as in index.html)
  const capLabels = {
    '192': makeClassEl({ dataset: { tierOnly: 'ddr5-6000' } }),
    '256': makeClassEl({ dataset: { tierOnly: 'ddr5-6000' } }),
  };
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

  const byId = {
    'lab-aio-group': makeClassEl(),
    'lab-rig-group': makeClassEl(),
    'lab-model': modelInput,
    'lab-model-anchor': { textContent: '' },
  };

  return {
    groups, modelInput,
    getElementById: (id) => byId[id] ?? null,
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

console.log(`\n============================================================`);
console.log(`ALL PASS — ${passed} checks green (UI logic incl. P6 M1 Lab controls).`);

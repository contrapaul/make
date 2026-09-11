/* ============================================================
   v100 — App bootstrap (blueprint §2/§4)
   ------------------------------------------------------------
   P3: theme switcher + scroll reveals + hash-based tab router
       (#/home · #/how · #/lab · #/compare, linkable per §4).
   P4: exploration tracker (visited tabs, "new" dots, progress
       ring, one-time celebration) — blueprint §4. Tracker state
       lives in the signed-off P2 store; this module only renders
       it and owns the one-time celebration flag.
   ============================================================ */

import { initTheme } from './theme.js';
import { initReveals, bindRangeFill } from './motion/scroll.js';
import { store, TAB_IDS } from './state/store.js';
import { initHome } from './tabs/home.js';
import { initLab } from './tabs/lab.js';
import { initPipeline } from './tabs/pipeline.js';
import { initGlossary } from './tabs/glossary.js';
import { initCompare } from './tabs/compare.js';

const defaultDoc = () => (typeof document !== 'undefined' ? document : null);
const defaultHash = () => (typeof location !== 'undefined' ? location.hash : '');

/* Router tabs. NOTE: 'glossary' is deliberately absent from the store's
   TAB_IDS, so the Explorer badge still counts the original four tabs and
   js/state/store.js (P2, signed off) needs no change. Anything here without
   a TAB_TO_STORE mapping is simply not tracked. */
export const TABS = ['home', 'how', 'lab', 'compare', 'glossary'];

export function tabFromHash(hash) {
  const m = /^#\/([a-z]+)/.exec(String(hash || ''));
  return m && TABS.includes(m[1]) ? m[1] : null;
}

/** Minimal hash router: shows one .tab-panel, marks its nav link active. */
export function initRouter({ doc = defaultDoc(), hash = defaultHash() } = {}) {
  const panels = Array.from(doc.querySelectorAll('.tab-panel'));
  const links = Array.from(doc.querySelectorAll('[data-tab-link]'));

  // Non-app pages (e.g. the dev design-system harness): no routing, and
  // never touch location.hash — it may carry a #light/#dark theme override.
  if (panels.length === 0) return { show() {}, initial: null };

  function show(name) {
    for (const p of panels) p.classList.toggle('is-active', p.dataset.tab === name);
    for (const a of links) a.classList.toggle('is-active', a.dataset.tabLink === name);
  }

  const initial = tabFromHash(hash) || 'home'; // P4: exposed so the tracker can count a deep-link load as a visit
  show(initial);

  // Make the URL bookmarkable without a full navigation (§4).
  try {
    if (typeof history !== 'undefined' && typeof location !== 'undefined') {
      const want = `#/${initial}`;
      // '#/glossary/kv-cache' already names this tab: keep the sub-path.
      if (location.hash !== want && !location.hash.startsWith(`${want}/`)) {
        history.replaceState(null, '', want);
      }
    }
  } catch { /* non-browser context */ }

  return { show, initial };
}

/* ============================================================
   Exploration tracker (blueprint §4)
   ------------------------------------------------------------
   Per-tab "new" dots until first visit · Home progress ring (n/4) ·
   all-4 → one-time CSS spark burst + persistent Explorer badge.
   State source: the P2 store (ui.visitedTabs, persisted).

   ⚠ The store calls Tab 2 'pipeline'; URLs and the router say
     '#/how'. Always go through TAB_TO_STORE — never compare raw ids.
   ============================================================ */

export const TAB_TO_STORE = Object.freeze({ home: 'home', how: 'pipeline', lab: 'lab', compare: 'compare' });

// Agent-decided: the one-time celebration flag gets its own key so the
// signed-off P2 persisted shape (config/theme/visitedTabs) stays untouched.
export const CELEBRATED_KEY = 'v100-celebrated';

/** Pure: derive tracker view state from a visited set (store ids). */
export function trackerView(visitedTabs) {
  const seen = new Set(Array.isArray(visitedTabs) ? visitedTabs : []);
  const count = TAB_IDS.filter((t) => seen.has(t)).length; // foreign ids ignored
  return { count, total: TAB_IDS.length, allVisited: count === TAB_IDS.length };
}

/** Pure: which ROUTER tabs still show a "new" dot. */
export function unseenRouterTabs(visitedTabs) {
  const seen = new Set(Array.isArray(visitedTabs) ? visitedTabs : []);
  return TABS.filter((t) => TAB_TO_STORE[t] && !seen.has(TAB_TO_STORE[t]));
}

const safeStorage = () => {
  try { if (typeof localStorage !== 'undefined') return localStorage; } catch { /* ignore */ }
  return null;
};

/** Wire the tracker UI. DI-friendly for Node tests ({doc, storage, store}). */
export function initTracker({ doc = defaultDoc(), storage = safeStorage(), store: st = store } = {}) {
  // Dots live in nav links ([data-tab-link]) and Home tab cards ([data-track-tab]).
  const dots = Array.from(doc.querySelectorAll('[data-tab-link], [data-track-tab]'))
    .map((el) => ({ tab: el.dataset.tabLink || el.dataset.trackTab, dot: el.querySelector('.dot-new') }))
    .filter((x) => x.dot);

  const ring = doc.getElementById?.('explore-ring') ?? null;
  const ringLabel = ring ? ring.querySelector('.ring-label') : null;
  const badge = doc.getElementById?.('explorer-badge') ?? null;
  const celebrate = doc.getElementById?.('explorer-celebrate') ?? null;

  function celebrated() {
    try { return storage?.getItem(CELEBRATED_KEY) === '1'; } catch { return false; }
  }
  function rememberCelebration() {
    try { storage?.setItem(CELEBRATED_KEY, '1'); } catch { /* non-fatal */ }
  }

  // Restart pattern from the P3 harness: remove class → reflow → add.
  function fireCelebration() {
    if (!celebrate) return;
    celebrate.classList.remove('is-once');
    void celebrate.offsetWidth; // force reflow so the animation restarts
    celebrate.classList.add('is-once');
  }

  function render(state) {
    const visited = state?.ui?.visitedTabs ?? [];
    const view = trackerView(visited);
    const unseen = new Set(unseenRouterTabs(visited));

    for (const d of dots) d.dot.classList.toggle('is-hidden', !unseen.has(d.tab));

    if (ring) {
      ring.style.setProperty('--progress', String(view.count / view.total));
      if (ringLabel) ringLabel.textContent = `${view.count}/${view.total}`;
      ring.setAttribute('aria-label', `Exploration progress: ${view.count} of ${view.total} tabs`);
    }

    if (badge) badge.classList.toggle('is-hidden', !view.allVisited);

    // One-time celebration: fires the first time all-4 is reached, ever.
    if (view.allVisited && celebrate && !celebrated()) {
      fireCelebration();
      rememberCelebration();
    }
  }

  const unsubscribe = st.subscribe(render);
  render(st.getState()); // initial paint (also covers a deep-link load)

  /** Count a router tab as visited — called by the router on show/hashchange. */
  function markVisited(routerTabId) {
    const id = TAB_TO_STORE[routerTabId];
    if (!id) return;
    try { st.setActiveTab(id); } catch { /* unknown tab — ignore */ }
  }

  return { render, markVisited, unsubscribe };
}

/** Wire the whole app. Returns handles for tests / future phases. */
export function initApp() {
  const theme = initTheme();
  const reveals = initReveals();

  // Slider track fills (any .slider present now or added by tabs).
  document.querySelectorAll('.slider').forEach(bindRangeFill);

  const router = initRouter();
  const tracker = initTracker();
  initHome();
  const lab = initLab({ store }); // P6: Lab controls bound two-way to the shared store
  initPipeline({ store }); // P5 M1: Pipeline shell + Stage 1 tokenization demo
  const glossary = initGlossary(); // renders the glossary page + wires hover cards
  initCompare({ store }); // P7 M1: the local-vs-cloud race, bound to the same store

  // §4: the tab shown on load counts as visited too (deep links like #/lab).
  if (router.initial) tracker.markVisited(router.initial);

  globalThis.addEventListener('hashchange', () => {
    const t = tabFromHash(globalThis.location.hash);
    if (!t) return;
    router.show(t);
    tracker.markVisited(t); // every shown tab marks visited + persists (store)
    glossary.focusTerm(globalThis.location.hash); // '#/glossary/<term>' deep links
  });

  return { theme, reveals, router, tracker, lab, glossary };
}

/* Auto-bootstrap when loaded in a browser as the app entry point. */
if (typeof document !== 'undefined' && typeof window !== 'undefined') {
  initApp();
}

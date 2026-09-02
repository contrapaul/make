/* ============================================================
   v100 — App bootstrap (blueprint §2/§4)
   ------------------------------------------------------------
   P3 scope: theme switcher + scroll reveals + hash-based tab
   router (#/home · #/how · #/lab · #/compare, linkable per §4).

   P4 will add here: exploration tracker (visited tabs, "new"
   dots, progress ring, one-time celebration) — see blueprint §4.
   ============================================================ */

import { initTheme } from './theme.js';
import { initReveals, bindRangeFill } from './motion/scroll.js';

export const TABS = ['home', 'how', 'lab', 'compare'];

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
  if (panels.length === 0) return { show() {} };

  function show(name) {
    for (const p of panels) p.classList.toggle('is-active', p.dataset.tab === name);
    for (const a of links) a.classList.toggle('is-active', a.dataset.tabLink === name);
  }

  const initial = tabFromHash(hash) || 'home';
  show(initial);

  // Make the URL bookmarkable without a full navigation (§4).
  try {
    if (typeof history !== 'undefined' && typeof location !== 'undefined') {
      if (location.hash !== `#/${initial}`) history.replaceState(null, '', `#/${initial}`);
    }
  } catch { /* non-browser context */ }

  return { show };
}

/** Wire the whole app. Returns handles for tests / future phases. */
export function initApp() {
  const theme = initTheme();
  const reveals = initReveals();

  // Slider track fills (any .slider present now or added by tabs).
  document.querySelectorAll('.slider').forEach(bindRangeFill);

  const router = initRouter();
  globalThis.addEventListener('hashchange', () => {
    const t = tabFromHash(globalThis.location.hash);
    if (t) router.show(t);
  });

  return { theme, reveals, router };
}

/* Auto-bootstrap when loaded in a browser as the app entry point. */
if (typeof document !== 'undefined' && typeof window !== 'undefined') {
  initApp();
}

const defaultDoc = () => (typeof document !== 'undefined' ? document : null);
const defaultHash = () => (typeof location !== 'undefined' ? location.hash : '');

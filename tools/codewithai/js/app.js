/* ============================================================
   Code with AI — app bootstrap
   ------------------------------------------------------------
   Theme switcher, scroll reveals, a hash-based tab router
   (#/home · #/setup · #/workflow · #/prompting · #/glossary),
   and the glossary language switch.

   Structure inherited from make/localai. The exploration
   tracker that site carries is deliberately not here: this page
   is a reference students come back to, not a tour to complete.
   ============================================================ */

import { initTheme } from './theme.js';
import { initReveals } from './motion/scroll.js';
import { initLang } from './i18n.js';
import { initGlossary } from './tabs/glossary.js';

const defaultDoc = () => (typeof document !== 'undefined' ? document : null);
const defaultHash = () => (typeof location !== 'undefined' ? location.hash : '');

export const TABS = ['home', 'setup', 'workflow', 'prompting', 'glossary'];

export function tabFromHash(hash) {
  const m = /^#\/([a-z]+)/.exec(String(hash || ''));
  return m && TABS.includes(m[1]) ? m[1] : null;
}

/** Minimal hash router: shows one .tab-panel, marks its nav link active. */
export function initRouter({ doc = defaultDoc(), hash = defaultHash() } = {}) {
  const panels = Array.from(doc.querySelectorAll('.tab-panel'));
  const links = Array.from(doc.querySelectorAll('[data-tab-link]'));

  if (panels.length === 0) return { show() {}, initial: null };

  function show(name) {
    for (const p of panels) p.classList.toggle('is-active', p.dataset.tab === name);
    for (const a of links) a.classList.toggle('is-active', a.dataset.tabLink === name);
  }

  const initial = tabFromHash(hash) || 'home';
  show(initial);

  // Make the URL bookmarkable without a full navigation.
  try {
    if (typeof history !== 'undefined' && typeof location !== 'undefined') {
      const want = `#/${initial}`;
      // '#/glossary/repo' already names this tab: keep the sub-path.
      if (location.hash !== want && !location.hash.startsWith(`${want}/`)) {
        history.replaceState(null, '', want);
      }
    }
  } catch { /* non-browser context */ }

  return { show, initial };
}

/** Wire the whole app. Returns handles for tests. */
export function initApp() {
  const theme = initTheme();
  const reveals = initReveals();
  const lang = initLang();
  const router = initRouter();
  const glossary = initGlossary({ lang });

  globalThis.addEventListener('hashchange', () => {
    const t = tabFromHash(globalThis.location.hash);
    if (!t) return;
    router.show(t);
    glossary.focusTerm(globalThis.location.hash); // '#/glossary/<term>' deep links
  });

  return { theme, reveals, lang, router, glossary };
}

/* Auto-bootstrap when loaded in a browser as the app entry point. */
if (typeof document !== 'undefined' && typeof window !== 'undefined') {
  initApp();
}

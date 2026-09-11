/* ============================================================
   v100 — Theme module (blueprint §4/§7)
   ------------------------------------------------------------
   - Light + dark via [data-theme] on <html>.
   - Default follows prefers-color-scheme; manual toggle persists
     to localStorage("v100-theme").
   - Precedence: explicit hash (#light/#dark) > stored choice > system.
   - No DOM access at import time → Node-testable (test/ui.test.mjs).

   NOTE: the inline pre-paint snippet in index.html <head> mirrors
   resolveInitialTheme() — keep the two in sync.
   ============================================================ */

export const STORAGE_KEY = 'v100-theme';

function isTheme(v) { return v === 'light' || v === 'dark'; }

/** Pure theme resolution (unit-tested). Returns 'light' | 'dark'. */
export function resolveInitialTheme({ stored = null, system = 'light', hash = '' } = {}) {
  const h = String(hash || '').replace(/^#/, '').toLowerCase();
  if (isTheme(h)) return h;                       // explicit URL choice wins
  if (isTheme(stored)) return stored;             // persisted manual toggle
  return system === 'dark' ? 'dark' : 'light';    // follow the OS
}

function applyTheme(theme, doc) {
  doc.documentElement.setAttribute('data-theme', theme);
}

function readStored(storage) {
  try { return storage.getItem(STORAGE_KEY); } catch { return null; }
}

function writeStored(storage, value) {
  try { storage.setItem(STORAGE_KEY, value); } catch { /* private mode etc. */ }
}

const defaultDoc = () => (typeof document !== 'undefined' ? document : null);
const defaultStorage = () => (typeof localStorage !== 'undefined' ? localStorage : null);
const defaultMedia = () => (typeof matchMedia !== 'undefined' ? matchMedia.bind(globalThis) : null);
const defaultHash = () => (typeof location !== 'undefined' ? location.hash : '');

/**
 * Apply the initial theme and wire every [data-theme-toggle] button.
 * Returns { theme, toggle() }. All browser globals are injectable for tests.
 */
export function initTheme({
  doc = defaultDoc(),
  storage = defaultStorage(),
  media = defaultMedia(),
  hash = defaultHash(),
} = {}) {
  if (!doc || !doc.documentElement) throw new Error('initTheme: no document');

  const stored = readStored(storage);
  let theme = resolveInitialTheme({ stored, system: systemScheme(media), hash });
  applyTheme(theme, doc);

  // Persist only explicit choices (hash or stored). A pure system default
  // keeps following the OS until the user toggles manually.
  const h = String(hash || '').replace(/^#/, '').toLowerCase();
  if (!isTheme(h) && !isTheme(stored)) {
    followSystem(media, doc);
  } else {
    writeStored(storage, theme);
  }

  const buttons = Array.from(doc.querySelectorAll('[data-theme-toggle]'));

  function toggle() {
    theme = theme === 'dark' ? 'light' : 'dark';
    applyTheme(theme, doc);
    writeStored(storage, theme);
    for (const btn of buttons) {
      try { btn.setAttribute('aria-pressed', String(theme === 'dark')); } catch { /* stub */ }
    }
    return theme;
  }

  for (const btn of buttons) {
    if (typeof btn.addEventListener === 'function') {
      btn.addEventListener('click', () => toggle());
    }
  }

  return { get theme() { return theme; }, toggle };
}

function systemScheme(media) {
  try {
    const mq = media && media('(prefers-color-scheme: dark)');
    return mq && mq.matches ? 'dark' : 'light';
  } catch { return 'light'; }
}

/** Until the user makes an explicit choice, track OS scheme changes. */
function followSystem(media, doc) {
  try {
    const mq = media && media('(prefers-color-scheme: dark)');
    if (mq && typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', (e) => applyTheme(e.matches ? 'dark' : 'light', doc));
    }
  } catch { /* no live updates — fine */ }
}

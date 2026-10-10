/* ============================================================
   Code with AI — glossary language switch
   ------------------------------------------------------------
   Two languages, English and Simplified Chinese, applied to the
   glossary only. The rest of the site chrome stays in English on
   purpose: the toggle exists so a student can read a definition
   in the language they think in, not so the English disappears.
   Every entry keeps its English term visible in both modes.

   State lives on <html data-glossary-lang> and in localStorage
   under 'cwa-lang'. Subscribers are called on every change, so
   the glossary re-renders itself without the page reloading.

   No DOM access at import time, so this stays Node-testable.
   ============================================================ */

export const LANGS = ['en', 'zh'];
export const STORAGE_KEY = 'cwa-lang';

const defaultDoc = () => (typeof document !== 'undefined' ? document : null);

const safeStorage = () => {
  try { if (typeof localStorage !== 'undefined') return localStorage; } catch { /* blocked */ }
  return null;
};

/** Pure: a stored or requested value narrowed to a supported language. */
export function normalizeLang(value) {
  const v = String(value || '').toLowerCase();
  if (LANGS.includes(v)) return v;
  // 'zh-CN', 'zh-Hans', 'zh-SG' all mean the Chinese entries here.
  if (v.startsWith('zh')) return 'zh';
  return 'en';
}

/** Pure: the language a first-time visitor should get. */
export function resolveInitialLang({ stored = null, navigatorLang = '' } = {}) {
  if (LANGS.includes(String(stored))) return stored;
  return normalizeLang(navigatorLang);
}

/** The label on the toggle: it names the language you would switch TO. */
export function toggleLabel(lang) {
  return lang === 'zh' ? 'English' : '中文';
}

export function otherLang(lang) {
  return lang === 'zh' ? 'en' : 'zh';
}

/** Wire the language switch. Returns { get, set, subscribe }. */
export function initLang({ doc = defaultDoc(), storage = safeStorage(), nav = null } = {}) {
  const subscribers = new Set();
  const navigatorLang = nav ?? (typeof navigator !== 'undefined' ? navigator.language : '');

  let stored = null;
  try { stored = storage?.getItem(STORAGE_KEY) ?? null; } catch { /* blocked */ }

  let lang = resolveInitialLang({ stored, navigatorLang });

  const buttons = doc ? Array.from(doc.querySelectorAll('[data-lang-toggle]')) : [];

  function paint() {
    if (doc?.documentElement) {
      doc.documentElement.setAttribute('data-glossary-lang', lang);
    }
    for (const b of buttons) {
      b.textContent = toggleLabel(lang);
      b.setAttribute('aria-label', lang === 'zh'
        ? 'Show the glossary in English'
        : 'Show the glossary in Chinese');
      // The button is a switch: pressed means the glossary is in Chinese.
      b.setAttribute('aria-pressed', String(lang === 'zh'));
    }
  }

  function set(next) {
    const value = normalizeLang(next);
    if (value === lang) return lang;
    lang = value;
    try { storage?.setItem(STORAGE_KEY, lang); } catch { /* non-fatal */ }
    paint();
    for (const fn of subscribers) fn(lang);
    return lang;
  }

  for (const b of buttons) {
    b.addEventListener('click', () => set(otherLang(lang)));
  }

  paint();

  return {
    get: () => lang,
    set,
    toggle: () => set(otherLang(lang)),
    subscribe(fn) { subscribers.add(fn); return () => subscribers.delete(fn); },
  };
}

/* ============================================================
   Code with AI — Setup tab
   ------------------------------------------------------------
   Three small jobs, all for content that already lives in
   index.html (the step text is markup, so the copy tests read it):

     1. The Windows / Mac switch. Stamps <html data-os>, which CSS
        uses to hide the other system's [data-os-only] blocks.
        Remembered in localStorage ('cwa-os'); a first visit
        guesses from the browser.
     2. Screenshot placeholders. Each .shot <img> already points at
        its final file. If that file is missing, the figure gets
        .is-missing and shows the alt text and file name instead,
        so adding a screenshot is only adding the PNG.
     3. Copy buttons on code blocks.

   No DOM access at import time, so the pure helpers are
   Node-testable.
   ============================================================ */

export const OS_KEY = 'cwa-os';
export const OS_LIST = ['win', 'mac'];

const defaultDoc = () => (typeof document !== 'undefined' ? document : null);
const safeStorage = () => {
  try { if (typeof localStorage !== 'undefined') return localStorage; } catch { /* blocked */ }
  return null;
};

/** Pure: 'mac' for Apple platforms, otherwise 'win'. Students on
 *  ChromeOS or Linux get the Windows steps, which are the closer match. */
export function osFromPlatform(platform = '', userAgent = '') {
  return /mac|iphone|ipad/i.test(`${platform} ${userAgent}`) ? 'mac' : 'win';
}

/** Pure: the OS a visitor should see first. */
export function resolveInitialOs({ stored = null, platform = '', userAgent = '' } = {}) {
  return OS_LIST.includes(stored) ? stored : osFromPlatform(platform, userAgent);
}

/** Pure: the file name at the end of an image path, for the placeholder. */
export function fileNameOf(src) {
  return String(src ?? '').split(/[?#]/)[0].split('/').pop();
}

/* ---------- 1. Windows / Mac ---------------------------------- */

export function initOsSwitch({ doc = defaultDoc(), storage = safeStorage() } = {}) {
  if (!doc) return { get: () => 'win', set() {} };
  const nav = typeof navigator !== 'undefined' ? navigator : {};
  let stored = null;
  try { stored = storage?.getItem(OS_KEY) ?? null; } catch { /* blocked */ }

  let os = resolveInitialOs({
    stored,
    platform: nav.userAgentData?.platform ?? nav.platform ?? '',
    userAgent: nav.userAgent ?? '',
  });

  const radios = Array.from(doc.querySelectorAll('[data-os-choice]'));

  function paint() {
    doc.documentElement.setAttribute('data-os', os);
    for (const r of radios) r.checked = r.value === os;
  }

  function set(next) {
    if (!OS_LIST.includes(next)) return os;
    os = next;
    try { storage?.setItem(OS_KEY, os); } catch { /* non-fatal */ }
    paint();
    return os;
  }

  for (const r of radios) r.addEventListener('change', () => { if (r.checked) set(r.value); });
  paint();
  return { get: () => os, set };
}

/* ---------- 2. Screenshot placeholders ------------------------ */

export function initShots({ doc = defaultDoc() } = {}) {
  if (!doc) return 0;
  const figures = Array.from(doc.querySelectorAll('.shot'));
  for (const fig of figures) {
    const img = fig.querySelector('img');
    if (!img) continue;
    fig.setAttribute('data-alt', img.getAttribute('alt') ?? '');
    fig.setAttribute('data-file', fileNameOf(img.getAttribute('src')));
    const missing = () => { fig.classList.add('is-missing'); fig.classList.remove('is-loaded'); };
    const found = () => { fig.classList.add('is-loaded'); fig.classList.remove('is-missing'); };
    // The image may have finished, or failed, before this ran.
    if (img.complete) (img.naturalWidth > 0 ? found : missing)();
    img.addEventListener('error', missing);
    img.addEventListener('load', found);
  }
  return figures.length;
}

/* ---------- 3. Copy buttons ----------------------------------- */

export function initCopyButtons({ doc = defaultDoc() } = {}) {
  if (!doc) return 0;
  const buttons = Array.from(doc.querySelectorAll('[data-copy]'));
  for (const btn of buttons) {
    btn.addEventListener('click', async () => {
      const target = doc.getElementById(btn.dataset.copy);
      if (!target) return;
      const text = target.textContent;
      let ok = false;
      try { await navigator.clipboard.writeText(text); ok = true; } catch { /* no clipboard access */ }
      if (!ok) {
        // Fallback: select the code so the student can press Ctrl+C / Cmd+C.
        const range = doc.createRange();
        range.selectNodeContents(target);
        const sel = doc.defaultView.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      }
      btn.textContent = ok ? 'Copied' : 'Selected. Now copy it.';
      btn.classList.toggle('is-done', ok);
      setTimeout(() => { btn.textContent = 'Copy'; btn.classList.remove('is-done'); }, 2000);
    });
  }
  return buttons.length;
}

/** Wire the Setup tab. */
export function initSetup({ doc = defaultDoc() } = {}) {
  return {
    os: initOsSwitch({ doc }),
    shots: initShots({ doc }),
    copies: initCopyButtons({ doc }),
  };
}

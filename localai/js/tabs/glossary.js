/* ============================================================
   v100 — Tab 5 (Glossary), blueprint §6 + style-guide.md §5
   ------------------------------------------------------------
   One data file (js/data/glossary.js) feeds two surfaces:

     1. The glossary page: every term with its full definition,
        each one anchored so it can be linked to directly.
     2. Hover cards: any word marked up as
          <a class="gloss" data-term="token" href="#/glossary/token">
        shows that term's short definition on hover or keyboard
        focus, and navigates to the full entry when clicked.

   The teaching intent of the click behaviour (owner's, 2026-09-05):
   a reader who clicks lands on the glossary and sees where the
   definitions live, which also shows them that hovering was the
   faster route. Both paths reach the same words.

   Deep links are '#/glossary/<term-id>'. The router only reads
   the first segment, so it routes to the glossary tab and this
   module reads the rest.

   Listeners are delegated from the document, so terms rendered
   later by other tabs work without re-initialising anything.
   No DOM access at import time, so it stays Node-testable.
   ============================================================ */

import { GLOSSARY, glossaryTerm } from '../data/glossary.js';

const defaultDoc = () => (typeof document !== 'undefined' ? document : null);
const defaultHash = () => (typeof location !== 'undefined' ? location.hash : '');

/** Pure: the term id in a glossary deep link, or null.
 *  '#/glossary/kv-cache' -> 'kv-cache'   ·   '#/glossary' -> null */
export function termIdFromHash(hash) {
  const m = /^#\/glossary\/([a-z0-9-]+)/i.exec(String(hash || ''));
  return m ? m[1].toLowerCase() : null;
}

/** Pure: the text shown in the hover card, or null for unknown terms. */
export function tooltipText(id) {
  const t = glossaryTerm(id);
  return t ? t.short : null;
}

/** Pure: alphabetical index entries, for the jump links at the top. */
export function glossaryIndex(terms = GLOSSARY) {
  return terms.map((t) => ({ id: t.id, term: t.term }));
}

/* ---------- page rendering ----------------------------------- */

/** Render every term into `list` as an anchored entry. */
export function renderGlossary(doc, list, terms = GLOSSARY) {
  if (!doc || !list || typeof doc.createElement !== 'function') return 0;

  while (list.firstChild && typeof list.removeChild === 'function') {
    list.removeChild(list.firstChild);
  }

  let n = 0;
  for (const t of terms) {
    const entry = doc.createElement('article');
    if (entry.classList && typeof entry.classList.add === 'function') entry.classList.add('gloss-entry');
    if (typeof entry.setAttribute === 'function') entry.setAttribute('id', t.id);

    const h = doc.createElement('h3');
    h.textContent = t.term;
    if (typeof entry.appendChild === 'function') entry.appendChild(h);

    const p = doc.createElement('p');
    p.textContent = t.full;
    if (typeof entry.appendChild === 'function') entry.appendChild(p);

    // "Learn more" row: outbound references for a reader who wants the
    // full article. Rendered as real links, e.g. Wikipedia "Central
    // processing unit". Opens in a new tab so this page, which is a
    // single hash-routed document, does not lose the reader's place.
    const links = (t.links ?? []).filter((l) => l && l.url && l.title);
    if (links.length) {
      const row = doc.createElement('p');
      if (row.classList && typeof row.classList.add === 'function') row.classList.add('gloss-more');
      row.textContent = 'Learn more: ';

      links.forEach((l, i) => {
        const a = doc.createElement('a');
        a.textContent = `${l.source ?? 'Wikipedia'} \u201c${l.title}\u201d`;
        if (typeof a.setAttribute === 'function') {
          a.setAttribute('href', l.url);
          a.setAttribute('target', '_blank');
          a.setAttribute('rel', 'noopener noreferrer');
        }
        if (typeof row.appendChild === 'function') row.appendChild(a);
        if (i < links.length - 1 && typeof doc.createTextNode === 'function' && typeof row.appendChild === 'function') {
          row.appendChild(doc.createTextNode(', '));
        }
      });

      if (typeof entry.appendChild === 'function') entry.appendChild(row);
    }

    if (typeof list.appendChild === 'function') list.appendChild(entry);
    n += 1;
  }
  return n;
}

/* ---------- hover cards -------------------------------------- */

/** Wire one shared hover card to every [data-term] on the page.
 *  Returns { show, hide, destroy } for tests. */
export function initTermCards({ doc = defaultDoc(), tip } = {}) {
  const card = tip ?? doc?.getElementById?.('gloss-tip') ?? null;
  if (!doc || !card) return { show() {}, hide() {}, destroy() {} };

  let current = null;

  function hide() {
    if (current && typeof current.removeAttribute === 'function') {
      current.removeAttribute('aria-describedby');
    }
    current = null;
    if (card.classList && typeof card.classList.remove === 'function') {
      card.classList.remove('is-visible');
    }
    if (typeof card.setAttribute === 'function') card.setAttribute('aria-hidden', 'true');
  }

  function show(el) {
    const id = el?.dataset?.term ?? (typeof el?.getAttribute === 'function' ? el.getAttribute('data-term') : null);
    const text = tooltipText(id);
    if (!text) return hide();

    card.textContent = text;
    if (typeof card.setAttribute === 'function') {
      card.setAttribute('aria-hidden', 'false');
      card.setAttribute('id', 'gloss-tip');
    }
    if (card.classList && typeof card.classList.add === 'function') card.classList.add('is-visible');

    // Screen readers announce the definition with the term itself.
    if (typeof el.setAttribute === 'function') el.setAttribute('aria-describedby', 'gloss-tip');
    current = el;

    // Position under the word, clamped to the viewport. Purely visual:
    // everything above already works without it.
    if (typeof el.getBoundingClientRect === 'function' && card.style) {
      const r = el.getBoundingClientRect();
      const vw = typeof innerWidth === 'number' ? innerWidth : 1280;
      const width = 320;
      const left = Math.max(12, Math.min(r.left, vw - width - 12));
      card.style.left = `${Math.round(left)}px`;
      card.style.top = `${Math.round(r.bottom + 8)}px`;
    }
  }

  const target = (ev) => {
    const t = ev?.target ?? null;
    if (!t) return null;
    if (typeof t.closest === 'function') return t.closest('[data-term]');
    return t.dataset && t.dataset.term ? t : null;
  };

  const onOver = (ev) => { const el = target(ev); if (el) show(el); };
  const onOut = (ev) => { if (target(ev)) hide(); };
  const onKey = (ev) => { if (ev && ev.key === 'Escape') hide(); };

  const listeners = [
    ['mouseover', onOver], ['mouseout', onOut],
    ['focusin', onOver], ['focusout', onOut],
    ['keydown', onKey],
  ];
  for (const [ev, fn] of listeners) {
    if (typeof doc.addEventListener === 'function') doc.addEventListener(ev, fn);
  }

  hide();
  return {
    show, hide,
    destroy() {
      for (const [ev, fn] of listeners) {
        if (typeof doc.removeEventListener === 'function') doc.removeEventListener(ev, fn);
      }
      hide();
    },
  };
}

/* ---------- tab wiring --------------------------------------- */

/** Wire the glossary tab: render the page, wire hover cards, and
 *  honour '#/glossary/<term>' deep links. */
export function initGlossary({ doc = defaultDoc(), hash = defaultHash(), terms = GLOSSARY } = {}) {
  if (!doc) return { count: 0, focusTerm() {}, destroy() {} };

  const list = doc.getElementById?.('glossary-list') ?? null;
  const count = renderGlossary(doc, list, terms);
  const cards = initTermCards({ doc });

  let lastTarget = null;

  /** Scroll a deep-linked term into view and mark it as the target. */
  function focusTerm(h) {
    const id = termIdFromHash(h);
    if (!id) return null;
    const el = doc.getElementById?.(id) ?? null;
    if (!el) return null;
    // Only one entry is ever the current target.
    if (lastTarget && lastTarget !== el && lastTarget.classList) lastTarget.classList.remove('is-target');
    lastTarget = el;
    if (typeof el.scrollIntoView === 'function') {
      const reduced = typeof matchMedia !== 'undefined'
        && matchMedia('(prefers-reduced-motion: reduce)').matches;
      el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    }
    if (el.classList && typeof el.classList.add === 'function') el.classList.add('is-target');
    return el;
  }

  focusTerm(hash);

  return { count, focusTerm, cards, destroy() { cards.destroy(); } };
}

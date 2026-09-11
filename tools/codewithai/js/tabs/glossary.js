/* ============================================================
   Code with AI — Glossary tab
   ------------------------------------------------------------
   Adapted from make/localai's glossary module. One data file
   (js/data/glossary.js) feeds two surfaces:

     1. The glossary page: every term with its full definition,
        grouped by section and anchored so it can be linked to.
     2. Hover cards: any word marked up as
          <a class="gloss" data-term="repo" href="#/glossary/repo">
        shows that term's short definition on hover or keyboard
        focus, and navigates to the full entry when clicked.

   Both surfaces follow the language switch (js/i18n.js). The
   English term is printed in both languages, every time; the
   Chinese term is a subtitle under it, never a replacement.
   A student who only ever learns 仓库 cannot find the button in
   GitHub that says "repository", which is the whole point.

   Deep links are '#/glossary/<term-id>'. The router only reads
   the first segment, so it routes here and this module reads
   the rest.

   Listeners are delegated from the document, so terms rendered
   later by other tabs work without re-initialising anything.
   No DOM access at import time, so it stays Node-testable.
   ============================================================ */

import { GLOSSARY, GROUPS, glossaryTerm, termIn, termsInGroup } from '../data/glossary.js';

const defaultDoc = () => (typeof document !== 'undefined' ? document : null);
const defaultHash = () => (typeof location !== 'undefined' ? location.hash : '');

/** Pure: the term id in a glossary deep link, or null.
 *  '#/glossary/repo' -> 'repo'   ·   '#/glossary' -> null */
export function termIdFromHash(hash) {
  const m = /^#\/glossary\/([a-z0-9-]+)/i.exec(String(hash || ''));
  return m ? m[1].toLowerCase() : null;
}

/** Pure: the text shown in the hover card, or null for unknown terms. */
export function tooltipText(id, lang = 'en') {
  const t = glossaryTerm(id);
  if (!t) return null;
  const v = termIn(t, lang);
  // Chinese cards still name the English term, so the hover teaches both.
  return lang === 'zh' ? `${v.term} · ${v.subtitle}\n${v.short}` : v.short;
}

/* ---------- page rendering ----------------------------------- */

/** Render one entry as an anchored article. */
function renderEntry(doc, t, lang) {
  const v = termIn(t, lang);

  const entry = doc.createElement('article');
  entry.className = 'gloss-entry';
  entry.setAttribute('id', v.id);

  const h = doc.createElement('h3');
  h.textContent = v.term; // English, always
  entry.appendChild(h);

  if (v.subtitle) {
    const sub = doc.createElement('p');
    sub.className = 'gloss-zh';
    sub.setAttribute('lang', 'zh-Hans');
    sub.textContent = v.subtitle;
    entry.appendChild(sub);
  }

  const p = doc.createElement('p');
  if (lang === 'zh') p.setAttribute('lang', 'zh-Hans');
  p.textContent = v.full;
  entry.appendChild(p);

  // "Learn more" row: outbound references for a reader who wants the full
  // article. Opens in a new tab so this page, which is a single hash-routed
  // document, does not lose the reader's place.
  const links = v.links.filter((l) => l && l.url && l.title);
  if (links.length) {
    const row = doc.createElement('p');
    row.className = 'gloss-more';
    row.textContent = lang === 'zh' ? '延伸阅读：' : 'Learn more: ';

    links.forEach((l, i) => {
      const a = doc.createElement('a');
      a.textContent = `${l.source ?? 'Wikipedia'} “${l.title}”`;
      a.setAttribute('href', l.url);
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener noreferrer');
      row.appendChild(a);
      if (i < links.length - 1) row.appendChild(doc.createTextNode(', '));
    });

    entry.appendChild(row);
  }

  return entry;
}

/** Render every group and its terms into `list`. Returns the term count. */
export function renderGlossary(doc, list, { lang = 'en', terms = GLOSSARY, groups = GROUPS } = {}) {
  if (!doc || !list) return 0;

  list.textContent = '';

  let n = 0;
  for (const g of groups) {
    const inGroup = termsInGroup(g.id, terms);
    if (!inGroup.length) continue;

    const head = doc.createElement('h3');
    head.className = 'gloss-group';
    head.setAttribute('id', `group-${g.id}`);
    head.textContent = lang === 'zh' ? `${g.title_zh}` : g.title;
    if (lang === 'zh') head.setAttribute('lang', 'zh-Hans');
    list.appendChild(head);

    for (const t of inGroup) {
      list.appendChild(renderEntry(doc, t, lang));
      n += 1;
    }
  }
  return n;
}

/* ---------- hover cards -------------------------------------- */

/** Wire one shared hover card to every [data-term] on the page.
 *  `getLang` is read at show time, so the card follows the switch. */
export function initTermCards({ doc = defaultDoc(), tip, getLang = () => 'en' } = {}) {
  const card = tip ?? doc?.getElementById?.('gloss-tip') ?? null;
  if (!doc || !card) return { show() {}, hide() {}, destroy() {} };

  let current = null;

  function hide() {
    if (current) current.removeAttribute('aria-describedby');
    current = null;
    card.classList.remove('is-visible');
    card.setAttribute('aria-hidden', 'true');
  }

  function show(el) {
    const id = el?.dataset?.term ?? el?.getAttribute?.('data-term');
    const text = tooltipText(id, getLang());
    if (!text) return hide();

    card.textContent = text;
    card.setAttribute('aria-hidden', 'false');
    card.classList.add('is-visible');

    // Screen readers announce the definition with the term itself.
    el.setAttribute('aria-describedby', 'gloss-tip');
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

  const target = (ev) => ev?.target?.closest?.('[data-term]') ?? null;

  const onOver = (ev) => { const el = target(ev); if (el) show(el); };
  const onOut = (ev) => { if (target(ev)) hide(); };
  const onKey = (ev) => { if (ev?.key === 'Escape') hide(); };

  const listeners = [
    ['mouseover', onOver], ['mouseout', onOut],
    ['focusin', onOver], ['focusout', onOut],
    ['keydown', onKey],
  ];
  for (const [ev, fn] of listeners) doc.addEventListener(ev, fn);

  hide();
  return {
    show, hide,
    destroy() {
      for (const [ev, fn] of listeners) doc.removeEventListener(ev, fn);
      hide();
    },
  };
}

/* ---------- tab wiring --------------------------------------- */

/** Wire the glossary tab: render the page, wire hover cards, follow the
 *  language switch, and honour '#/glossary/<term>' deep links. */
export function initGlossary({ doc = defaultDoc(), hash = defaultHash(), lang, terms = GLOSSARY } = {}) {
  if (!doc) return { count: 0, focusTerm() {}, destroy() {} };

  const list = doc.getElementById?.('glossary-list') ?? null;
  const getLang = () => (lang ? lang.get() : 'en');

  let count = renderGlossary(doc, list, { lang: getLang(), terms });
  const cards = initTermCards({ doc, getLang });

  let lastTarget = null;

  /** Scroll a deep-linked term into view and mark it as the target. */
  function focusTerm(h) {
    const id = termIdFromHash(h);
    if (!id) return null;
    const el = doc.getElementById?.(id) ?? null;
    if (!el) return null;
    // Only one entry is ever the current target.
    if (lastTarget && lastTarget !== el) lastTarget.classList.remove('is-target');
    lastTarget = el;
    if (typeof el.scrollIntoView === 'function') {
      const reduced = typeof matchMedia !== 'undefined'
        && matchMedia('(prefers-reduced-motion: reduce)').matches;
      el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    }
    el.classList.add('is-target');
    return el;
  }

  // Re-render on a language change, then put the reader back where they were:
  // the deep-linked entry if there is one, otherwise the same scroll position.
  const unsubscribe = lang?.subscribe?.((next) => {
    const y = typeof scrollY === 'number' ? scrollY : 0;
    lastTarget = null;
    count = renderGlossary(doc, list, { lang: next, terms });
    if (!focusTerm(defaultHash()) && typeof scrollTo === 'function') scrollTo(0, y);
  });

  focusTerm(hash);

  return {
    get count() { return count; },
    focusTerm,
    cards,
    destroy() { cards.destroy(); unsubscribe?.(); },
  };
}

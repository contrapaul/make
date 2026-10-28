// e02s05t02: Glossary tab. Ported mechanism from localai/js/tabs/glossary.js.
// One data file (js/data/glossary.js) feeds the page and every hover card:
//   - page: every term with its full definition, each anchored + deep-linked (#/glossary/<id>)
//   - hover: any <span class="gloss" data-term="id"> shows the short definition on
//     hover or keyboard focus; clicking it follows the href to the full entry.
// Listeners are delegated, so terms rendered later by other tabs work too.
// No DOM access at import time, so it stays Node-testable.
import { GLOSSARY, glossaryTerm } from '../data/glossary.js';
import { registerTab } from '../app.js';

/** Pure: the term id in a glossary deep link, or null. */
export function termIdFromHash(hash) {
  const m = /^#\/glossary\/([a-z0-9-]+)/i.exec(String(hash || ''));
  return m ? m[1].toLowerCase() : null;
}

/** Pure: the text shown in the hover card, or null for unknown terms. */
export function tooltipText(id) {
  const t = glossaryTerm(id);
  return t ? t.short : null;
}

/** Render every term into `list` as an anchored entry. Returns the count. */
export function renderGlossary(doc, list, terms = GLOSSARY) {
  if (!doc || !list) return 0;
  list.innerHTML = '';
  const frag = doc.createDocumentFragment();
  let n = 0;
  for (const t of terms) {
    const entry = doc.createElement('article');
    entry.className = 'gloss-entry';
    entry.id = t.id;

    const h = doc.createElement('h3');
    h.textContent = t.term;
    entry.appendChild(h);

    const p = doc.createElement('p');
    p.textContent = t.full;
    entry.appendChild(p);

    const links = (t.links || []).filter(l => l && l.url && l.title);
    if (links.length) {
      const row = doc.createElement('p');
      row.className = 'gloss-more';
      row.textContent = 'Learn more: ';
      links.forEach((l, i) => {
        const a = doc.createElement('a');
        a.textContent = `${l.source ?? 'Reference'} “${l.title}”`;
        a.setAttribute('href', l.url);
        a.setAttribute('target', '_blank');
        a.setAttribute('rel', 'noopener noreferrer');
        row.appendChild(a);
        if (i < links.length - 1) row.appendChild(doc.createTextNode(', '));
      });
      entry.appendChild(row);
    }
    frag.appendChild(entry);
    n += 1;
  }
  list.appendChild(frag);
  return n;
}

/** Wire one shared hover card to every [data-term] on the page. */
export function initTermCards({ doc = document, tip } = {}) {
  const card = tip ?? doc.getElementById?.('gloss-tip') ?? null;
  if (!doc || !card) return { show() {}, hide() {}, destroy() {} };

  let current = null;

  function hide() {
    if (current && typeof current.removeAttribute === 'function') {
      current.removeAttribute('aria-describedby');
    }
    current = null;
    card.classList.remove('is-visible');
    card.setAttribute('aria-hidden', 'true');
  }

  function show(el) {
    const id = el?.dataset?.term ?? null;
    const text = tooltipText(id);
    if (!text) return hide();

    card.textContent = text;
    card.setAttribute('aria-hidden', 'false');
    card.classList.add('is-visible');
    el.setAttribute('aria-describedby', 'gloss-tip');
    current = el;

    if (typeof el.getBoundingClientRect === 'function' && card.style) {
      const r = el.getBoundingClientRect();
      const vw = (typeof innerWidth === 'number' ? innerWidth : 1280) - 24;
      const width = 320;
      const left = Math.max(12, Math.min(r.left, vw - width));
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

/* ---------- tab rendering (app.js calls this with the #stage) ---- */

let cardsApi = null;
let lastTarget = null;

function placeTerm(doc, h) {
  const id = termIdFromHash(h);
  if (!id) return null;
  const el = doc.getElementById?.(id) ?? null;
  if (!el) return null;
  if (lastTarget && lastTarget !== el) lastTarget.classList.remove('is-target');
  lastTarget = el;
  const reduced = (typeof matchMedia !== 'undefined')
    && matchMedia('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  el.classList.add('is-target');
  return el;
}

export function renderGlossaryTab(stage) {
  if (cardsApi) { cardsApi.destroy(); cardsApi = null; }
  lastTarget = null;

  stage.innerHTML = `
    <p class="tab-intro">Every word this site uses, in plain sight. Hover a marked word on
    any tab for the short definition, or tap it to open the full entry.</p>
    <div class="gloss-jumps" id="gloss-jumps"></div>
    <div id="glossary-list" class="glossary-list"></div>`;
  const list = stage.querySelector('#glossary-list');
  renderGlossary(stage.ownerDocument, list);
  // A-Z jump chip strip: one pill per letter that has entries.
  const jumps = stage.querySelector('#gloss-jumps');
  const letters = new Set(GLOSSARY.map(t => t.term[0].toUpperCase()));
  for (const letter of [...letters].sort()) {
    const a = stage.ownerDocument.createElement('a');
    a.href = '#/glossary/' + GLOSSARY.find(t => t.term[0].toUpperCase() === letter).id;
    a.textContent = letter;
    jumps.appendChild(a);
  }
  cardsApi = initTermCards({ doc: stage.ownerDocument });

  // Deep link: a hash like #/glossary/commit keeps pointing at its entry.
  if (typeof window !== 'undefined') {
    const onHash = () => placeTerm(stage.ownerDocument, location.hash);
    window.addEventListener('hashchange', onHash);
  }
  placeTerm(stage.ownerDocument, (typeof location !== 'undefined' ? location.hash : ''));
}

registerTab('glossary', renderGlossaryTab);
export default renderGlossaryTab;

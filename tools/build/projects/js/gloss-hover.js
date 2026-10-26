// e02s05t02 (helper): whole-word glossary auto-links, "exactly like localai".
// After every tab render (app.js fires 'site:rendered' with the tab name),
// this walks #stage and, for the first occurrence of each approved term in
// prose, wraps it in <a class="gloss" data-term="<id>" href="#/glossary/<id>">.
// The hover card itself lives in js/tabs/glossary.js; both halves bind on
// their own events, so neither knows about the other beyond the DOM classes.
// No build step. Skips anything already inside a .gloss, heading, code, or tag.

import { GLOSSARY, GLOSSARY_LINK_TERMS } from './data/glossary.js';

const TERMS_BY_TEXT = new Map(GLOSSARY.map(t => [t.term.toLowerCase(), t]));

/** Pure: find the first whole-word match of `text` in `html` as text.
 *  Returns a {start, end} index into the *decoded* text or null. */
export function findWholeWord(text, term) {
  const re = new RegExp(`(^|[^\\p{L}\\p{N}_])${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=$|[^\\p{L}\\p{N}_])`, 'iu');
  const m = re.exec(text);
  return m ? { start: m.index + m[1].length, end: m.index + m[1].length + term.length } : null;
}

/** Wrap the first occurrence of each matching term in `scope` with a
 *  whole-word glossary link. Returns the number of marks added.
 *  Terms shorter than 3 characters or already present are skipped. */
export function decorateGlossTerms(scope, terms = GLOSSARY_LINK_TERMS) {
  if (!scope) return 0;
  // Never touch the glossary page itself: it already owns its own terms.
  if (scope.querySelector && scope.querySelector('.glossary-list')) return 0;

  const walker = scope.ownerDocument.createTreeWalker(scope, /* SHOW_ELEMENT */ 1);
  const proseNodes = [];
  let node;
  const SKIP = new Set(['A', 'SCRIPT', 'STYLE', 'BUTTON', 'SELECT', 'INPUT']);
  while ((node = walker.nextNode())) {
    if (SKIP.has(node.tagName) || node.closest('a, h1, h2, h3, code, pre')) continue;
    if (node.childNodes.length === 0 && (node.textContent || '').trim().length >= 3) proseNodes.push(node);
  }

  const byTerm = new Map(terms.map(t => [t.toLowerCase(), t]));
  let added = 0;
  for (const [text, termObj] of byTerm) {
    if (text.length < 3 || added >= 24) break; // keep the markup light
    const t = termObj || TERMS_BY_TEXT.get(text);
    if (!t) continue;
    const link = scope.ownerDocument.createElement('a');
    link.className = 'gloss';
    link.dataset.term = t.id;
    link.setAttribute('href', `#/glossary/${t.id}`);
    link.textContent = t.term;
    for (const textNode of proseNodes) {
      const m = findWholeWord(textNode.textContent, text);
      if (!m) continue;
      const rest = textNode.splitText(m.end);        // textNode=[0,end), rest=[end,∞)
      const word = textNode.splitText(m.start);      // textNode=[0,start), word=[start,end)
      textNode.parentNode.replaceChild(link, textNode);
      word.parentNode.removeChild(word);
      added += 1;
      break;
    }
  }
  return added;
}

// Browser wiring: decorate once per tab render. Self-contained, no imports of app.js.
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  window.addEventListener('site:rendered', (ev) => {
    if (ev?.detail?.tab === 'glossary') return;
    const stage = document.getElementById('stage');
    if (stage) decorateGlossTerms(stage);
  });
}

/* ============================================================
   Code with AI — shared prose extraction + scoring for tests
   ------------------------------------------------------------
   Turns index.html and the glossary data into the sentences a
   student actually reads, then scores them. Used by
   readability.test.mjs and vocabulary.test.mjs so both checks
   see exactly the same text.

   What counts as prose:
     - text inside a .tab-panel, plus the footer
   What does not:
     - comments, <script>, <style>, <svg>
     - <code>, <pre>, <kbd>, <samp>, <q>: code, keys, terminal
       output and quoted examples are English by rule and are not
       the copy being judged (style-guide.md §6)
     - anything aria-hidden="true": decorative data labels such as
       the hero floats, which are not read as sentences

   Block-level tags end a sentence even without a full stop, so a
   heading or a list item never merges into the text after it.

   The syllable counter is a heuristic. It is the same one used to
   produce the figures in blueprint.md §3, so those figures and
   these tests agree. Treat FK as a smoke alarm, not a verdict.
   ============================================================ */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const readRoot = (p) => readFileSync(join(ROOT, p), 'utf8');

const SKIP_TAGS = ['script', 'style', 'svg', 'code', 'pre', 'kbd', 'samp', 'q'];
const BLOCK_TAGS = 'p|li|h[1-6]|td|th|dt|dd|blockquote|figcaption|summary|header|article|section|div|ul|ol|br';

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”' };

/** Strip one element type (non-nested match per opening tag). */
function dropElements(html, tag) {
  return html.replace(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?</${tag}>`, 'gi'), ' ');
}

/** Remove aria-hidden elements. Handles nesting of the same tag name. */
function dropAriaHidden(html) {
  const open = /<([a-z][a-z0-9]*)\b[^>]*\baria-hidden="true"[^>]*>/i;
  let m;
  while ((m = open.exec(html))) {
    const tag = m[1].toLowerCase();
    const re = new RegExp(`<(/?)${tag}\\b[^>]*>`, 'gi');
    re.lastIndex = m.index + m[0].length;
    let depth = 1, end = html.length, t;
    while ((t = re.exec(html))) {
      depth += t[1] ? -1 : 1;
      if (depth === 0) { end = t.index + t[0].length; break; }
    }
    html = html.slice(0, m.index) + ' ' + html.slice(end);
  }
  return html;
}

/** HTML fragment -> array of text blocks (one per block-level element). */
export function htmlToBlocks(html, { dropGlossLinks = false } = {}) {
  let s = html.replace(/<!--[\s\S]*?-->/g, ' ');
  for (const tag of SKIP_TAGS) s = dropElements(s, tag);
  s = dropAriaHidden(s);
  if (dropGlossLinks) s = s.replace(/<a\b[^>]*class="gloss"[^>]*>[\s\S]*?<\/a>/gi, ' ');
  s = s.replace(new RegExp(`</?(?:${BLOCK_TAGS})\\b[^>]*>`, 'gi'), '\n');
  s = s.replace(/<[^>]+>/g, '');
  s = s.replace(/&(#\d+|[a-z]+);/gi, (_, e) => (e[0] === '#' ? String.fromCharCode(+e.slice(1)) : ENTITIES[e.toLowerCase()] ?? ' '));
  return s.split('\n').map((b) => b.replace(/\s+/g, ' ').trim()).filter(Boolean);
}

/** The prose of each tab panel, keyed by data-tab, plus 'footer'. */
export function pagePanels(html = readRoot('index.html')) {
  const out = {};
  const re = /<section class="tab-panel[^"]*" data-tab="([a-z]+)"[^>]*>([\s\S]*?)\n    <\/section>/g;
  let m;
  while ((m = re.exec(html))) out[m[1]] = m[2];
  const foot = /<footer\b[\s\S]*?<\/footer>/.exec(html);
  if (foot) out.footer = foot[0];
  return out;
}

/** Text -> sentences. A block with no terminal punctuation is one sentence.
 *  A new sentence may open with a capital, a digit, a quote, a bracket, or
 *  code: glossary text often starts a sentence with a tag such as <p>. */
export function sentences(blocks) {
  const list = Array.isArray(blocks) ? blocks : [blocks];
  const out = [];
  for (const b of list) {
    for (const s of b.split(/(?<=[.!?])\s+(?=[A-Z0-9“"‘'(<#.])/)) {
      const t = s.trim();
      if (t) out.push(t);
    }
  }
  return out;
}

export const words = (s) => s.match(/[A-Za-z][A-Za-z'’-]*/g) || [];

export function syllables(w) {
  w = w.toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return 0;
  if (w.length <= 3) return 1;
  w = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '');
  return (w.match(/[aeiouy]{1,2}/g) || []).length || 1;
}

/** Score a list of sentences. Sentences of one word (labels) are ignored. */
export function score(sents) {
  const real = sents.filter((s) => words(s).length > 1);
  const ws = real.flatMap(words);
  if (!real.length) return null;
  const wps = ws.length / real.length;
  const spw = ws.reduce((a, w) => a + syllables(w), 0) / ws.length;
  return {
    sentences: real.length,
    words: ws.length,
    avgWords: +wps.toFixed(1),
    fk: +(0.39 * wps + 11.8 * spw - 15.59).toFixed(1),
    long: real.filter((s) => words(s).length > 25).map((s) => ({ n: words(s).length, s })),
  };
}

/** Glossary text with its backtick code spans replaced by one short word.
 *  Code is English by rule and is not the prose being judged, the same as
 *  <code> on the page. A placeholder rather than nothing keeps sentences
 *  that open with code ("`<p>` is correct.") splitting where they should. */
export const proseOf = (text) => String(text ?? '').replace(/`[^`]*`/g, 'X');

/** Load the glossary module (ESM) from the site. */
export const loadGlossary = () => import(join(ROOT, 'js/data/glossary.js'));

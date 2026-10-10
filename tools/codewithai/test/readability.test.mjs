/* ============================================================
   Code with AI — readability check (blueprint.md §3)
   ------------------------------------------------------------
   Holds every English string a student reads to the standard in
   style-guide.md §2. Fails with the offending sentences listed,
   so the output is the to-do list for fixing it.

     Tab prose + hover cards:  FK ≤ 6.0 · avg ≤ 14 words · none > 25
     Glossary full entries:    FK ≤ 7.0 overall, no entry > 8.0,
                               avg ≤ 16 words · none > 25

   FK is only judged on samples of MIN_SAMPLE sentences or more.
   On a four-sentence placeholder it measures noise. The whole
   page is always judged as one sample, so short panels still
   count toward the total. The 25-word cap applies everywhere,
   always: one long sentence is a problem at any sample size.

   ⚠ Averages can be diluted. Adding easy entries lowers the overall
   grade without fixing a single hard one. Full entries have a
   per-entry ceiling for exactly this reason. Hover cards do not,
   because one or two sentences is too small a sample for a grade
   to mean anything (a plain 20-word sentence can score 10). So a
   passing hover-card average does not mean every card is easy:
   read them. (Found in M1: the 29 new entries took the average
   from 6.1 to 5.5 while the 60 old cards stayed at 6.1.)

   Run: npm test   (or: node --test "test/*.test.mjs")
   ============================================================ */

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { pagePanels, htmlToBlocks, sentences, score, words, loadGlossary, proseOf } from './lib/prose.mjs';

export const LIMITS = Object.freeze({
  page: { fk: 6.0, avgWords: 14, maxWords: 25 },
  short: { fk: 6.0, avgWords: 14, maxWords: 25 },
  full: { fk: 7.0, fkEntry: 8.0, avgWords: 16, maxWords: 25 },
});
const MIN_SAMPLE = 10;

const list = (rows) => rows.map((r) => `    ${r}`).join('\n');
const longList = (sc, label) =>
  sc.long.map((l) => `${label ? `[${label}] ` : ''}${l.n}w: ${l.s}`);

const { GLOSSARY: RAW } = await loadGlossary();
// Grade the words, not the code: backtick spans become one short word.
const GLOSSARY = RAW.map((g) => ({ ...g, short: proseOf(g.short), full: proseOf(g.full) }));
const panels = pagePanels();

test('page: no sentence over 25 words, in any panel', (t) => {
  const bad = [];
  for (const [name, html] of Object.entries(panels)) {
    const sc = score(sentences(htmlToBlocks(html)));
    if (sc) bad.push(...longList(sc, name));
  }
  t.diagnostic(`${bad.length} long sentence(s)`);
  assert.equal(bad.length, 0, `Split these sentences:\n${list(bad)}`);
});

test('page: grade level and sentence length', (t) => {
  const all = [];
  const bad = [];
  for (const [name, html] of Object.entries(panels)) {
    const sents = sentences(htmlToBlocks(html));
    all.push(...sents);
    const sc = score(sents);
    if (!sc) continue;
    t.diagnostic(`${name.padEnd(10)} FK ${sc.fk}  avg ${sc.avgWords}w  n=${sc.sentences}`);
    if (sc.sentences < MIN_SAMPLE) continue;
    if (sc.fk > LIMITS.page.fk) bad.push(`${name}: FK ${sc.fk} > ${LIMITS.page.fk}`);
    if (sc.avgWords > LIMITS.page.avgWords) bad.push(`${name}: avg ${sc.avgWords} words > ${LIMITS.page.avgWords}`);
  }
  const total = score(all);
  t.diagnostic(`whole page FK ${total.fk}  avg ${total.avgWords}w  n=${total.sentences}`);
  if (total.fk > LIMITS.page.fk) bad.push(`whole page: FK ${total.fk} > ${LIMITS.page.fk}`);
  if (total.avgWords > LIMITS.page.avgWords) bad.push(`whole page: avg ${total.avgWords} words > ${LIMITS.page.avgWords}`);
  assert.equal(bad.length, 0, `Over the limit:\n${list(bad)}`);
});

test('glossary hover cards (short): grade level and sentence length', (t) => {
  const sc = score(sentences(GLOSSARY.map((g) => g.short)));
  t.diagnostic(`short  FK ${sc.fk}  avg ${sc.avgWords}w  n=${sc.sentences}`);
  const bad = [];
  for (const g of GLOSSARY) {
    for (const s of sentences(g.short)) {
      if (words(s).length > LIMITS.short.maxWords) bad.push(`[${g.id}] ${words(s).length}w: ${s}`);
    }
  }
  if (sc.fk > LIMITS.short.fk) bad.push(`all short entries: FK ${sc.fk} > ${LIMITS.short.fk}`);
  if (sc.avgWords > LIMITS.short.avgWords) bad.push(`all short entries: avg ${sc.avgWords} > ${LIMITS.short.avgWords}`);
  assert.equal(bad.length, 0, `Over the limit:\n${list(bad)}`);
});

test('glossary full entries: no sentence over 25 words', (t) => {
  const bad = [];
  for (const g of GLOSSARY) {
    for (const s of sentences(g.full)) {
      if (words(s).length > LIMITS.full.maxWords) bad.push(`[${g.id}] ${words(s).length}w: ${s}`);
    }
  }
  t.diagnostic(`${bad.length} long sentence(s) across ${GLOSSARY.length} entries`);
  assert.equal(bad.length, 0, `Split these sentences:\n${list(bad)}`);
});

test('glossary full entries: grade level', (t) => {
  const sc = score(sentences(GLOSSARY.map((g) => g.full)));
  t.diagnostic(`full   FK ${sc.fk}  avg ${sc.avgWords}w  n=${sc.sentences}`);
  const bad = [];
  if (sc.fk > LIMITS.full.fk) bad.push(`all full entries: FK ${sc.fk} > ${LIMITS.full.fk}`);
  if (sc.avgWords > LIMITS.full.avgWords) bad.push(`all full entries: avg ${sc.avgWords} > ${LIMITS.full.avgWords}`);
  const entries = GLOSSARY.map((g) => ({ id: g.id, sc: score(sentences(g.full)) }))
    .filter((e) => e.sc.fk > LIMITS.full.fkEntry)
    .sort((a, b) => b.sc.fk - a.sc.fk);
  for (const e of entries) bad.push(`[${e.id}] FK ${e.sc.fk} > ${LIMITS.full.fkEntry}`);
  assert.equal(bad.length, 0, `Over the limit:\n${list(bad)}`);
});

/* The splitter decides every number above, so it gets its own check. */
test('sentence splitter handles code, file names and abbreviations', () => {
  const cases = [
    ['Close it first. <p>Hi</p> is correct. Done.', 3],          // sentence opens with a tag
    ['Use a class. .warning chooses it.', 2],                       // sentence opens with a selector
    ['Open index.html in the browser.', 1],                         // dot inside a file name
    ['Go to example.com and look.', 1],                             // dot inside a domain
    ['It is fast. 936 GB/s is the speed.', 2],                      // sentence opens with a digit
    [proseOf('Close it. `<p>Hi</p>` is correct. Done.'), 3],         // a backtick code span
  ];
  for (const [text, n] of cases) assert.equal(sentences(text).length, n, text);
});

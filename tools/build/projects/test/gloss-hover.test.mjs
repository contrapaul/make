// e02s05t02 seed: single-word glossary hover, "exactly like localai".
// The pure half (findWholeWord) + deep-link helpers + a DOM-free render.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findWholeWord } from '../js/gloss-hover.js';
import { termIdFromHash, tooltipText, renderGlossary } from '../js/tabs/glossary.js';
import { GLOSSARY } from '../js/data/glossary.js';

test('findWholeWord: boundary match, case-insensitive', () => {
  assert.deepEqual(findWholeWord('one commit is enough', 'commit'), { start: 4, end: 10 });
  assert.equal(findWholeWord('COMMIT the work', 'commit').start, 0);
  assert.deepEqual(findWholeWord('a (commit) lands', 'commit'), { start: 3, end: 9 });
});

test('findWholeWord: refuses substrings, allows hyphen and bracket joins', () => {
  assert.equal(findWholeWord('committed yesterday', 'commit'), null);
  assert.equal(findWholeWord('commitment of effort', 'commit'), null);
  // A hyphen is a word boundary by design: the glossary carries the
  // slash-coded term 'push / pull', so descriptive text can join names.
  assert.deepEqual(findWholeWord('pre-commit hook', 'commit'), { start: 4, end: 10 });
});

test('findWholeWord: multi-word terms + slug/bracket separators', () => {
  assert.deepEqual(findWholeWord('push / pull daily', 'push / pull'), { start: 0, end: 11 });
  assert.deepEqual(findWholeWord('the context window closes', 'context window'), { start: 4, end: 18 });
  assert.equal(findWholeWord('GitHub owns the repo', 'github').start, 0);
});

test('termIdFromHash + tooltipText: deep-link contract', () => {
  assert.equal(termIdFromHash('#/glossary/commit'), 'commit');
  assert.equal(termIdFromHash('#/glossary/Commit'), 'commit');
  assert.equal(termIdFromHash('#/glossary'), null);
  assert.equal(termIdFromHash(''), null);
  const commit = GLOSSARY.find(t => t.id === 'commit');
  assert.equal(tooltipText('commit'), commit.short);
  assert.equal(tooltipText('not-a-term'), null);
});

test('renderGlossary: one anchored entry per term, count returned', () => {
  function makeDoc() {
    const element = (tag) => ({
      tag, attrs: {}, textContent: '', className: '', id: '', children: [],
      setAttribute(k, v) { this.attrs[k] = v; },
      appendChild(c) { this.children.push(c); },
    });
    return {
      createElement: element,
      createTextNode: (t) => ({ tag: '#text', textContent: t }),
      createDocumentFragment: () => ({ tag: '#fragment', children: [], appendChild(c) { this.children.push(c); } }),
    };
  }
  const doc = makeDoc();
  const list = { innerHTML: '', appendChild(f) { for (const e of f.children) this.children.push(e); }, children: [] };
  const n = renderGlossary(doc, list, GLOSSARY);
  assert.equal(n, GLOSSARY.length);
  const seen = list.children.map(e => e.id);
  assert.equal(seen.length, GLOSSARY.length);
  assert.ok(seen.includes('commit'));
  assert.ok(seen.every(id => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)), 'all anchor ids kebab-case');
});

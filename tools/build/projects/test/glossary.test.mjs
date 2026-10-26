// e02s05t01: glossary data contract. Node --test only, no DOM.
import test from 'node:test';
import assert from 'node:assert/strict';
import { GLOSSARY, glossaryTerm, GLOSSARY_LINK_TERMS } from '../js/data/glossary.js';

test('glossary: 44 owner-approved terms', () => {
  assert.equal(GLOSSARY.length, 44);
});

test('glossary: ids are unique kebab-case', () => {
  const ids = new Set();
  for (const t of GLOSSARY) {
    assert.match(t.id, /^[a-z0-9]+(-[a-z0-9]+)*$/, `bad id: ${t.id}`);
    assert.ok(!ids.has(t.id), `dup id: ${t.id}`);
    ids.add(t.id);
  }
});

test('glossary: every term has non-empty term/short/full', () => {
  for (const t of GLOSSARY) {
    assert.ok(t.term && t.term.trim(), `missing term on ${t.id}`);
    assert.ok(t.short && t.short.trim(), `missing short on ${t.id}`);
    assert.ok(t.full && t.full.trim(), `missing full on ${t.id}`);
    assert.ok(Array.isArray(t.links), `links must be array on ${t.id}`);
    for (const l of t.links) {
      assert.ok(l.url && /^https?:\/\//.test(l.url), `bad url on ${t.id}: ${l.url}`);
      assert.ok(l.title && l.title.trim(), `missing title on ${t.id}`);
    }
  }
});

test('glossary: style bans (no em dash, no middot) in definitions', () => {
  for (const t of GLOSSARY) {
    const all = `${t.term} ${t.short} ${t.full}`;
    assert.ok(!all.includes('\u2014'), `em dash in ${t.id}`);
    assert.ok(!all.includes('\u00b7'), `middot in ${t.id}`);
  }
});

test('glossaryTerm: resolves known id, null for unknown', () => {
  assert.equal(glossaryTerm('commit').term, 'commit');
  assert.equal(glossaryTerm('no-such-term'), null);
});

test('GLOSSARY_LINK_TERMS: multi-word first, then longest first, no dups, all real', () => {
  const set = new Set(GLOSSARY.map(t => t.id));
  const total = GLOSSARY.length;
  assert.equal(GLOSSARY_LINK_TERMS.length, total);
  assert.equal(new Set(GLOSSARY_LINK_TERMS.map(t => t.id)).size, total);
  for (const t of GLOSSARY_LINK_TERMS) assert.ok(set.has(t.id), `ghost id ${t.id}`);
  const multi = GLOSSARY_LINK_TERMS.filter(t => t.term.includes(' '));
  const single = GLOSSARY_LINK_TERMS.filter(t => !t.term.includes(' '));
  assert.equal(multi.length + single.length, total);
  assert.equal(GLOSSARY_LINK_TERMS.slice(0, multi.length).length, multi.length,
    'multi-word terms must come first');
  for (const group of [multi, single]) {
    for (let i = 1; i < group.length; i++) {
      assert.ok(group[i - 1].term.length >= group[i].term.length,
        `not longest-first at ${i}: ${group[i - 1].term} / ${group[i].term}`);
    }
  }
});

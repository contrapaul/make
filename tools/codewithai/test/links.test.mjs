/* ============================================================
   Code with AI — links and glossary data check
   ------------------------------------------------------------
   Every way the page points at itself must land somewhere real:

     - every data-term names a glossary entry
     - every glossary link's href agrees with its data-term
     - every '#/<tab>' href names a routed tab
     - nav links, tab panels and the router's TABS all agree

   And the glossary data must keep the contract the renderer and
   the language switch rely on (js/data/glossary.js header):

     - all eight text fields present, Chinese fields in Chinese
     - ids unique, kebab-case, and not colliding with any other
       id on the page (entries render as id="<term-id>" into the
       same document, so a term called "story" would break Home)
     - every group used is declared, every declared group is used
     - every Learn more link is https with a title

   Run: npm test   (or: node --test "test/*.test.mjs")
   ============================================================ */

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readRoot, loadGlossary } from './lib/prose.mjs';
import { TABS } from '../js/app.js';

const html = readRoot('index.html');
const { GLOSSARY, GROUPS } = await loadGlossary();
const ids = new Set(GLOSSARY.map((g) => g.id));

const all = (re) => [...html.matchAll(re)];
const fail = (bad, msg) => assert.equal(bad.length, 0, `${msg}:\n${bad.map((b) => `    ${b}`).join('\n')}`);

test('every data-term names a glossary entry', () => {
  const bad = all(/data-term="([^"]*)"/g).map((m) => m[1]).filter((id) => !ids.has(id));
  fail([...new Set(bad)], 'Unknown terms');
});

test('every glossary link points at its own entry', () => {
  const bad = [];
  for (const m of all(/<a\b[^>]*class="gloss"[^>]*>/g)) {
    const term = /data-term="([^"]*)"/.exec(m[0])?.[1];
    const href = /href="([^"]*)"/.exec(m[0])?.[1];
    if (href !== `#/glossary/${term}`) bad.push(`data-term="${term}" but href="${href}"`);
  }
  fail(bad, 'Mismatched glossary links');
});

test('every #/ href names a routed tab, and #/glossary/<id> names a term', () => {
  const bad = [];
  for (const [, href] of all(/href="(#\/[^"]*)"/g)) {
    const [, tab, sub] = /^#\/([a-z]+)(?:\/(.*))?$/.exec(href) ?? [];
    if (!TABS.includes(tab)) bad.push(`${href}: no tab "${tab}"`);
    else if (tab === 'glossary' && sub !== undefined && !ids.has(sub)) bad.push(`${href}: no term "${sub}"`);
    else if (tab !== 'glossary' && sub !== undefined) bad.push(`${href}: only the glossary takes a sub-path`);
  }
  fail([...new Set(bad)], 'Broken in-page links');
});

test('nav links, tab panels and the router agree', () => {
  const nav = all(/data-tab-link="([a-z]+)"/g).map((m) => m[1]);
  const panels = all(/class="tab-panel[^"]*" data-tab="([a-z]+)"/g).map((m) => m[1]);
  assert.deepEqual([...nav].sort(), [...TABS].sort(), 'nav links vs js/app.js TABS');
  assert.deepEqual([...panels].sort(), [...TABS].sort(), 'tab panels vs js/app.js TABS');
});

test('glossary entries have every field, in the right language', () => {
  const FIELDS = ['id', 'group', 'term', 'term_zh', 'short', 'short_zh', 'full', 'full_zh'];
  const CJK = /[一-鿿]/;
  const bad = [];
  for (const g of GLOSSARY) {
    for (const f of FIELDS) {
      if (typeof g[f] !== 'string' || !g[f].trim()) bad.push(`[${g.id}] missing ${f}`);
    }
    for (const f of ['term_zh', 'short_zh', 'full_zh']) {
      if (g[f] && !CJK.test(g[f])) bad.push(`[${g.id}] ${f} has no Chinese characters`);
    }
    for (const f of ['short', 'full']) {
      if (g[f] && CJK.test(g[f])) bad.push(`[${g.id}] ${f} (English) contains Chinese`);
    }
  }
  fail(bad, 'Incomplete entries');
});

test('glossary code spans: every backtick is paired, and terms carry none', () => {
  const bad = [];
  for (const g of GLOSSARY) {
    for (const f of ['short', 'short_zh', 'full', 'full_zh']) {
      if (((g[f] ?? '').match(/`/g) ?? []).length % 2) bad.push(`[${g.id}] ${f} has an unpaired backtick`);
      if (/``/.test(g[f] ?? '')) bad.push(`[${g.id}] ${f} has an empty or doubled code span`);
    }
    for (const f of ['term', 'term_zh']) if ((g[f] ?? '').includes('`')) bad.push(`[${g.id}] ${f} must not contain code marks`);
  }
  fail(bad, 'Code span problems');
});

test('glossary ids are unique, kebab-case, and free on the page', () => {
  const bad = [];
  const seen = new Set();
  for (const g of GLOSSARY) {
    if (seen.has(g.id)) bad.push(`duplicate id "${g.id}"`);
    seen.add(g.id);
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(g.id)) bad.push(`"${g.id}" is not kebab-case`);
  }
  // Ids already used by the page itself, plus the group headings the renderer adds.
  const pageIds = new Set([
    ...all(/\bid="([^"]+)"/g).map((m) => m[1]),
    ...GROUPS.map((gr) => `group-${gr.id}`),
  ]);
  for (const id of ids) if (pageIds.has(id)) bad.push(`term id "${id}" collides with an element id on the page`);
  fail(bad, 'Bad ids');
});

test('glossary groups: every one used is declared, every one declared is used', () => {
  const declared = new Set(GROUPS.map((g) => g.id));
  const used = new Set(GLOSSARY.map((g) => g.group));
  const bad = [
    ...[...used].filter((g) => !declared.has(g)).map((g) => `"${g}" used but not in GROUPS`),
    ...[...declared].filter((g) => !used.has(g)).map((g) => `"${g}" declared but has no terms`),
  ];
  for (const g of GROUPS) {
    if (!g.title || !/[一-鿿]/.test(g.title_zh ?? '')) bad.push(`group "${g.id}" needs title and title_zh`);
  }
  fail(bad, 'Group problems');
});

test('every image on the page is in the shot list, with alt text', () => {
  const list = readRoot('images/vscode/SHOTLIST.md');
  const listed = new Set([...list.matchAll(/`([\w.-]+\.png)`/g)].map((m) => m[1]));
  const bad = [];
  for (const m of all(/<img\b[^>]*>/g)) {
    const src = /src="([^"]*)"/.exec(m[0])?.[1] ?? '';
    const alt = /alt="([^"]*)"/.exec(m[0])?.[1] ?? '';
    if (src.startsWith('images/vscode/') && !listed.has(src.slice('images/vscode/'.length))) {
      bad.push(`${src} is not in images/vscode/SHOTLIST.md`);
    }
    if (alt.trim().length < 20) bad.push(`${src} needs a real alt text (it is also the placeholder description)`);
  }
  fail(bad, 'Image problems');
});

test('every Learn more link is https and titled', () => {
  const bad = [];
  for (const g of GLOSSARY) {
    for (const l of g.links ?? []) {
      if (!/^https:\/\/[^\s]+$/.test(l.url ?? '')) bad.push(`[${g.id}] bad url: ${l.url}`);
      if (!l.title) bad.push(`[${g.id}] link has no title`);
    }
    if (!(g.links ?? []).length) bad.push(`[${g.id}] has no Learn more link`);
  }
  fail(bad, 'Link problems');
});

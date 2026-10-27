/**
 * Builds every view as real elements. Nothing here reaches into the document
 * while the module loads, so `node --check` and the tests can read this file
 * with no browser present.
 *
 * Text comes from two places only: the record (English data) and CHROME
 * (the switchable strings). A view adds no sentence of its own.
 */

import { t } from "./i18n.js";
import { href } from "./router.js";
import { demoBlock, runItLink } from "./demo.js";
import { LANGUAGES } from "./data/languages.js";
import { GLOSSARY } from "./data/glossary.js";
import { SOURCES } from "./data/sources.js";

const el = (tag, cls, text) => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
};

const bySlug = new Map(LANGUAGES.map((r) => [r.slug, r]));

/** A word that also exists in the glossary becomes a link into it. */
function linkedGlossaryText(text, terms) {
  const p = el("p", "prose");
  let rest = text;
  for (const term of terms) {
    const entry = GLOSSARY.find((g) => g.term.toLowerCase() === term.toLowerCase());
    if (!entry) continue;
    const at = rest.toLowerCase().indexOf(term.toLowerCase());
    if (at < 0) continue;
    p.append(document.createTextNode(rest.slice(0, at)));
    const a = el("a", "gloss", term);
    a.href = href({ view: "glossary", term: entry.id });
    a.dataset.term = entry.id;
    p.append(a);
    rest = rest.slice(at + term.length);
  }
  if (rest) p.append(document.createTextNode(rest));
  return p;
}

function section(headingKey, body) {
  const s = el("section", "view-section");
  s.append(el("h2", "sect-h", t(LANG_CACHE, headingKey)));
  s.append(body);
  return s;
}

let LANG_CACHE = "en";

function statTable(stats) {
  const box = el("div", "stats");
  for (const row of stats) {
    const line = el("div", "stat-row");
    line.append(el("span", "stat-metric", row.metric));
    line.append(el("span", "stat-value", row.value));
    const src = SOURCES[row.source];
    if (src) {
      const a = el("a", "stat-src", src.label);
      a.href = src.url;
      a.rel = "noreferrer";
      line.append(a);
    }
    line.append(el("span", "stat-date", row.as_of));
    box.append(line);
  }
  return box;
}

export function indexView(lang) {
  LANG_CACHE = lang;
  const v = el("div", "view view-index");
  v.append(el("h1", "display", t(lang, "site.name")));
  v.append(el("p", "lede", t(lang, "site.tagline")));
  const groups = [
    ["core", "index.core.title", "index.core.body"],
    ["extended", "index.extended.title", "index.extended.body"],
  ];
  for (const [tier, head, body] of groups) {
    const rows = LANGUAGES.filter((r) => r.tier === tier);
    if (!rows.length) continue;
    const list = el("ul", "lrow-list");
    for (const r of rows) {
      const li = el("li", "lrow");
      const a = el("a", "lrow-a", r.name);
      a.href = href({ view: "language", slug: r.slug });
      li.append(a);
      li.append(el("p", "lrow-reads", r.reads));
      if (r.difficulty && r.difficulty.label) {
        li.append(el("span", "lrow-diff", t(lang, "page.difficulty") + ": " + r.difficulty.label));
      }
      list.append(li);
    }
    const box = el("div", "index-group");
    box.append(el("h2", "sect-h", t(lang, head)), el("p", "group-body", t(lang, body)), list);
    v.append(box);
  }
  const actions = el("div", "actions");
  const gloss = el("a", "button", t(lang, "nav.glossary"));
  gloss.href = href({ view: "glossary" });
  actions.append(gloss);
  v.append(actions);
  return v;
}

export function languageView(lang, rec) {
  LANG_CACHE = lang;
  const v = el("div", "view view-language");
  v.dataset.slug = rec.slug;
  const head = el("header", "page-head");
  head.append(el("h1", "display", rec.name));
  head.append(el("p", "kicker", t(lang, "page.reads")));
  head.append(el("p", "lede", rec.reads));
  if (lang !== "en") head.append(el("p", "lang-note", t(lang, "content.lang_note")));
  v.append(head);

  v.append(section("page.category", el("p", "prose", rec.category)));
  const makes = el("ul", "dot-list");
  for (const m of rec.makes) makes.append(el("li", null, m));
  v.append(section("page.makes", makes));

  if (rec.difficulty && rec.difficulty.note) {
    v.append(section("page.difficulty", linkedGlossaryText(`${rec.difficulty.label}. ${rec.difficulty.note}`, rec.terms)));
  }

  v.append(demoBlock(lang, rec.demo));
  const runIt = runItLink(lang, rec.run_it);
  if (runIt) {
    const run = el("p", "run-out");
    run.append(runIt);
    v.append(run);
  }

  v.append(section("page.history", historyBlock(lang, rec)));
  if (rec.stats.length) v.append(section("page.stats", statTable(rec.stats)));

  const prereqs = rec.prereqs.map((s) => bySlug.get(s)?.name).filter(Boolean);
  if (prereqs.length) {
    v.append(section("page.prereqs", el("p", "prose", prereqs.join(", "))));
  }

  const terms = rec.terms
    .map((id) => GLOSSARY.find((g) => g.id === id))
    .filter(Boolean);
  if (terms.length) {
    const list = el("ul", "dot-list");
    for (const g of terms) {
      const a = el("a", null, g.term);
      a.href = href({ view: "glossary", term: g.id });
      const li = el("li");
      li.append(a);
      list.append(li);
    }
    v.append(section("page.terms", list));
  }

  const next = rec.next.map((s) => bySlug.get(s)).filter(Boolean);
  if (next.length) {
    const list = el("ul", "dot-list");
    for (const n of next) {
      const li = el("li");
      const a = el("a", null, n.name);
      a.href = href({ view: "language", slug: n.slug });
      li.append(a);
      list.append(li);
    }
    v.append(section("page.next", list));
  }

  if (rec.links.length) {
    const list = el("ul", "link-list");
    for (const l of rec.links) {
      const li = el("li");
      const a = el("a", null, l.label);
      a.href = l.url;
      a.rel = "noreferrer";
      li.append(a);
      list.append(li);
    }
    v.append(section("page.links", list));
  }
  return v;
}

function historyBlock(lang, rec) {
  const p = el("p", "prose");
  const bits = [rec.history.creator, rec.history.org, rec.history.year, rec.history.note].filter(Boolean);
  p.textContent = bits.join(". ") + ".";
  return p;
}

export function notFoundView(lang) {
  const v = el("div", "view view-notfound");
  v.append(el("h1", "display", t(lang, "notfound.title")));
  v.append(el("p", "prose", t(lang, "notfound.body")));
  const a = el("a", "button", t(lang, "notfound.link"));
  a.href = href({ view: "index" });
  v.append(a);
  return v;
}

/** The address a not-found means: a slug no record carries. */
export function missingRecordView(lang) {
  return notFoundView(lang);
}

export { bySlug };

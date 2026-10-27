/**
 * The glossary view: one list, a filter box, and a term that opens in place.
 * Same mechanism as the sibling sites (plan §10.1): a page link carries
 * `data-term="<id>"`, one listener on the document reads it, and the route
 * `#/glossary/<id>` focuses that entry.
 */

import { GLOSSARY } from "../data/glossary.js";
import { SOURCES } from "../data/sources.js";
import { t } from "../i18n.js";

const el = (tag, cls, text) => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
};

function entry(lang, rec) {
  const dt = el("dt", "gloss-term", rec.term);
  const dd = el("dd", "gloss-body");
  dd.append(el("p", "gloss-short", rec.short));
  dd.append(el("p", "gloss-full", rec.full));
  for (const link of rec.links || []) {
    const src = SOURCES[link.source];
    const a = el("a", "gloss-src", link.title || (src && src.label) || link.source);
    a.href = link.url;
    a.rel = "noreferrer";
    const line = el("p", "gloss-link");
    line.append(el("span", "gloss-src-label", `${t(lang, "glossary.source")}: `), a);
    dd.append(line);
  }
  const row = el("div", "gloss-entry");
  row.dataset.gloss = rec.id;
  row.append(dt, dd);
  return row;
}

export function glossaryView(lang, term) {
  const v = el("div", "view view-glossary");
  v.append(el("h1", "display", t(lang, "glossary.title")));
  v.append(el("p", "lede", t(lang, "glossary.body")));

  const input = el("input", "gloss-filter");
  input.type = "search";
  input.placeholder = t(lang, "glossary.filter");
  input.setAttribute("aria-label", t(lang, "glossary.filter"));
  v.append(input);

  const list = el("dl", "gloss-list");
  const sorted = [...GLOSSARY].sort((a, b) => a.term.localeCompare(b.term));
  for (const rec of sorted) list.append(entry(lang, rec));
  const empty = el("p", "gloss-empty", t(lang, "glossary.empty"));
  empty.hidden = true;
  v.append(list, empty);

  input.addEventListener("input", () => {
    const q = input.value.trim().toLowerCase();
    let shown = 0;
    for (const row of list.children) {
      const hit = !q || row.textContent.toLowerCase().includes(q);
      row.hidden = !hit;
      if (hit) shown += 1;
    }
    empty.hidden = shown > 0;
  });

  if (term) {
    const row = list.querySelector(`[data-gloss="${term}"]`);
    if (row) {
      row.classList.add("is-focus");
      queueMicrotask(() => row.scrollIntoView({ block: "center" }));
    }
  }
  return v;
}

/** One listener for links made anywhere, including inside another view. */
export function initGlossary() {
  document.addEventListener("click", (event) => {
    const link = event.target.closest?.("a.gloss[data-term]");
    if (!link) return;
    window.location.hash = `#/glossary/${link.dataset.term}`;
  });
}

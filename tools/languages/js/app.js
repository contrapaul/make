/**
 * The start-up glue. One file touches the document outside a view: it picks a
 * language, wires the address to a renderer, and keeps the header honest.
 */

import { startRouter, parse, href } from "./router.js";
import { applyI18n, currentLang, setLang, LANGS } from "./i18n.js";
import { indexView, languageView, notFoundView, missingRecordView, bySlug } from "./views.js";
import { initGlossary } from "./tabs/glossary.js";
import { glossaryView } from "./tabs/glossary.js";
import { LANGUAGES } from "./data/languages.js";
import { t } from "./i18n.js";

const main = document.querySelector("#main");
const fallback = document.querySelector("#static-index");
const picker = document.querySelector("#lang-switch select");

let lang = currentLang(window.location.search);

function title(route) {
  if (route.view === "language") {
    const rec = bySlug.get(route.slug);
    if (rec) return `${rec.name} - ${t(lang, "site.name")}`;
  }
  if (route.view === "glossary") return `${t(lang, "nav.glossary")} - ${t(lang, "site.name")}`;
  if (route.view === "about") return `${t(lang, "nav.about")} - ${t(lang, "site.name")}`;
  return `${t(lang, "site.name")} - ${t(lang, "site.tagline")}`;
}

function render(route) {
  document.title = title(route);
  applyI18n(document.querySelector(".masthead"), lang);
  applyI18n(document.querySelector(".site-foot"), lang);
  main.replaceChildren();
  if (route.view === "index") {
    main.append(indexView(lang));
  } else if (route.view === "language") {
    const rec = bySlug.get(route.slug);
    main.append(rec ? languageView(lang, rec) : missingRecordView(lang));
  } else if (route.view === "glossary") {
    main.append(glossaryView(lang, route.term));
  } else if (route.view === "about") {
    const v = document.createElement("div");
    v.className = "view view-about";
    const h = document.createElement("h1");
    h.className = "display";
    h.textContent = t(lang, "about.title");
    const p = document.createElement("p");
    p.className = "prose";
    p.textContent = t(lang, "about.body");
    v.append(h, p);
    main.append(v);
  } else {
    main.append(notFoundView(lang));
  }
  if (fallback) fallback.hidden = true;
  for (const el of document.querySelectorAll(".tabs a")) {
    const on = el.dataset.route === route.view;
    el.setAttribute("aria-current", on ? "page" : "false");
    if (!on) el.removeAttribute("aria-current");
  }
}

if (picker) {
  picker.value = lang;
  picker.addEventListener("change", () => {
    if (!LANGS.includes(picker.value)) return;
    lang = setLang(picker.value);
    const url = new URL(window.location.href);
    url.searchParams.set("lang", lang);
    window.history.replaceState(null, "", url);
    render(parse(window.location.hash));
  });
}

initGlossary();
startRouter(render);

// The header links are built here so one change cannot miss a copy.
for (const el of document.querySelectorAll(".wordmark a, .tabs a")) {
  if (el.dataset.route === "index" || el.closest(".wordmark")) el.href = href({ view: "index" });
}
void LANGUAGES;

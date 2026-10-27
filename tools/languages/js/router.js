/**
 * Turns the address after the `#` into a view. The whole site is this one file
 * (`tools/languages/index.html`), so a route is a fragment: `#/l/python`.
 *
 * Costs of that choice, and what this file does about them (plan §7.1):
 * a crawler sees one document, so index.html carries a plain link list that
 * mirrors these routes, and the document title and language are set here per
 * view. A shared address cannot carry its own social preview, so every page
 * offers a Copy link button instead.
 */

const BASE = "#/";

/** `#/l/python` -> { view: "language", slug: "python" } */
export function parse(hash) {
  const path = String(hash || "").replace(/^#/, "");
  if (path === "" || path === "/") return { view: "index" };
  const parts = path.split("/").filter(Boolean);
  if (parts[0] === "l" && parts.length === 2) return { view: "language", slug: parts[1] };
  if (parts[0] === "glossary") {
    return parts.length === 1 ? { view: "glossary" } : { view: "glossary", term: parts[1] };
  }
  if (parts[0] === "about" && parts.length === 1) return { view: "about" };
  return { view: "notfound", path };
}

/** The address for a view, so the nav and the router cannot disagree. */
export function href(route) {
  if (route.view === "index") return BASE;
  if (route.view === "language") return `${BASE}l/${route.slug}`;
  if (route.view === "glossary") return route.term ? `${BASE}glossary/${route.term}` : `${BASE}glossary`;
  if (route.view === "about") return `${BASE}about`;
  return BASE;
}

/** The value for `<title>` and for the heading of the browser tab. */
export function titleFor(route, names) {
  if (route.view === "language" && names && names[route.slug]) {
    return `${names[route.slug]} - Languages`;
  }
  if (route.view === "glossary" && route.term) return `${route.term} - Glossary - Languages`;
  if (route.view === "glossary") return "Glossary - Languages";
  if (route.view === "about") return "About - Languages";
  return "Languages - what each one is for";
}

/**
 * Watch the address and draw. `render(route)` returns the element to show;
 * this sets `document.title` and the `aria-current` mark before handing back.
 */
export function startRouter(render) {
  const draw = () => {
    const route = parse(window.location.hash);
    render(route);
    for (const el of document.querySelectorAll("nav [data-route]")) {
      const on = el.dataset.route === route.view;
      if (on) el.setAttribute("aria-current", "page");
      else el.removeAttribute("aria-current");
    }
    window.scrollTo(0, 0);
  };
  window.addEventListener("hashchange", draw);
  draw();
  return draw;
}

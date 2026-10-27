/**
 * The demo block on a language page: code, its recorded output, and a copy
 * button. Nothing here runs the code (decision 3). The output is text written
 * by hand after running the code, and it is labelled as that.
 *
 * `highlight` comes from js/highlight.js. It escapes before it wraps, so code
 * text can never become markup on this page.
 */

import { highlight } from "./highlight.js";
import { t } from "./i18n.js";

const el = (tag, cls, text) => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
};

/** Copy to the clipboard, with a select-the-text fallback for older browsers. */
async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.left = "-1000px";
    document.body.append(area);
    area.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    area.remove();
    return ok;
  }
}

/**
 * Build the block for one record's `demo`. `lang` is the interface language,
 * for the labels only; `demo.language` selects the highlighting rules.
 */
export function demoBlock(lang, demo) {
  const box = el("div", "demo");
  box.append(el("h3", "demo-h", t(lang, "demo.title")));
  box.append(el("p", "demo-title", demo.title));

  const pre = el("pre", "code-block");
  pre.setAttribute("aria-label", t(lang, "demo.code"));
  pre.tabIndex = 0;
  const code = el("code");
  code.innerHTML = highlight(demo.code, demo.language);
  pre.append(code);
  box.append(pre);

  const out = el("div", "demo-out");
  out.append(el("h4", "demo-out-h", t(lang, "demo.output")));
  const outPre = el("pre", "output-block");
  outPre.append(el("code", null, demo.output));
  out.append(outPre);
  out.append(el("p", "demo-out-note", t(lang, "demo.output_note")));
  if (demo.note) out.append(el("p", "demo-explain", demo.note));
  box.append(out);

  const btn = el("button", "button copy", t(lang, "demo.copy"));
  btn.type = "button";
  btn.setAttribute("aria-label", `${t(lang, "demo.copy")}: ${demo.title}`);
  btn.addEventListener("click", async () => {
    const ok = await copy(demo.code);
    btn.textContent = ok ? t(lang, "demo.copied") : t(lang, "demo.copy_fail");
    window.setTimeout(() => {
      btn.textContent = t(lang, "demo.copy");
    }, 2000);
  });
  const actions = el("p", "demo-actions");
  actions.append(btn);
  box.append(actions);
  return box;
}

/** A link to a page that does run this language, where one exists. */
export function runItLink(lang, runIt) {
  if (!runIt || runIt.kind === "none") return null;
  const a = el("a", "button run-out", t(lang, "demo.run_out"));
  a.href = runIt.url;
  a.rel = "noreferrer";
  return a;
}

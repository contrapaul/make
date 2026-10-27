/**
 * Which words the interface shows. English or Chinese, for the fixed chrome
 * only. Record text stays English in v1 (decision 8).
 *
 * The choice is the student's, always. It is never guessed from the browser,
 * because a student may be reading in a language they are studying.
 */

import { CHROME, LANG_KEY } from "./data/chrome.js";

export const LANGS = ["en", "zh"];
export const DEFAULT_LANG = "en";
export { LANG_KEY };

/** The stored choice wins, then `?lang=`, then English. */
export function currentLang(search) {
  const fromUrl = new URLSearchParams(search || "").get("lang");
  const pick = (v) => (LANGS.includes(v) ? v : null);
  let stored = null;
  try {
    stored = pick(window.localStorage.getItem(LANG_KEY));
  } catch {
    stored = null;
  }
  return pick(fromUrl) || stored || DEFAULT_LANG;
}

/** One chrome string. A missing key is loud, not silent. */
export function t(lang, key) {
  const entry = CHROME[key];
  if (!entry) return `[[missing chrome key: ${key}]]`;
  const value = entry[lang] || entry[DEFAULT_LANG];
  return value || `[[empty chrome string: ${key}]]`;
}

/**
 * Fill this page from the dictionary. `[data-i18n="key"]` takes text;
 * `[data-i18n-attr="attr:key;attr:key"]` takes attributes, so a label or a
 * placeholder switches too. The document language is corrected as well.
 */
export function applyI18n(root, lang) {
  const scope = root || document;
  for (const el of scope.querySelectorAll("[data-i18n]")) {
    el.textContent = t(lang, el.dataset.i18n);
  }
  for (const el of scope.querySelectorAll("[data-i18n-attr]")) {
    for (const pair of el.dataset.i18nAttr.split(";")) {
      const [attr, key] = pair.split(":").map((s) => (s || "").trim());
      if (attr && key) el.setAttribute(attr, t(lang, key));
    }
  }
  document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
}

/** Remember the choice, then re-draw. Private mode still switches for the visit. */
export function setLang(lang) {
  try {
    window.localStorage.setItem(LANG_KEY, lang);
  } catch {
    /* no storage: the switch holds for this visit only */
  }
  return lang;
}

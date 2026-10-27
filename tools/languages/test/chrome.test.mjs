/**
 * The switcher gate (plan §12, decision 8). The interface is bilingual in v1;
 * record prose is not. This test checks the dictionary is whole and that
 * nothing asks it for a word it does not hold.
 *
 * Run: node --test tools/languages/test/chrome.test.mjs
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const root = new URL("../", import.meta.url);
const { CHROME, LANG_KEY } = await import(new URL("js/data/chrome.js", root));
const html = readFileSync(new URL("index.html", root), "utf8");

/**
 * Every key the code or the page asks for. Collected from `data-i18n`, from
 * `t(lang, "…")`, and from dotted strings in the sources, because a heading key
 * reaches `t()` through a variable. A namespace prefix keeps the last pattern
 * from catching class names and file names.
 */
const NAMESPACE = "site|nav|lang|foot|footer|index|page|demo|glossary|notfound|content|about";
const ASK_SHAPE = new RegExp(`"((?:${NAMESPACE})\\.[a-z_]+(?:\\.[a-z_]+)*)"`, "g");

const KEYS_ASKED_FOR = (() => {
  const asked = new Set();
  const files = [
    html,
    ...readdirSync(new URL("js", root), { withFileTypes: true })
      .filter((d) => d.isFile() && d.name.endsWith(".js"))
      .map((d) => readFileSync(new URL(`js/${d.name}`, root), "utf8")),
    readFileSync(new URL("js/tabs/glossary.js", root), "utf8"),
  ];
  for (const text of files) {
    for (const m of text.matchAll(ASK_SHAPE)) asked.add(m[1]);
  }
  return asked;
})();

/**
 * A language is called by its own name in every language, so its two columns
 * hold one string on purpose. `English` and `中文` are the word, not a
 * translation of it.
 */
const SAME_IN_BOTH = ["lang.en", "lang.zh"];

test("every chrome key holds two non-empty strings", () => {
  const bad = [];
  for (const [key, pair] of Object.entries(CHROME)) {
    if (!pair.en || !pair.en.trim()) bad.push(`${key}: empty English`);
    if (!pair.zh || !pair.zh.trim()) bad.push(`${key}: empty Chinese`);
    if (pair.en && pair.en === pair.zh && !SAME_IN_BOTH.includes(key)) {
      bad.push(`${key}: the two languages hold one string`);
    }
  }
  assert.deepEqual(bad, []);
});

test("nothing asks the dictionary for a key it lacks", () => {
  const missing = [...KEYS_ASKED_FOR].filter((k) => !CHROME[k]);
  assert.deepEqual(missing, [], `keys used but not defined: ${missing.join(", ")}`);
});

test("no chrome key is defined and never used", () => {
  const unused = Object.keys(CHROME).filter((k) => !KEYS_ASKED_FOR.has(k) && k !== LANG_KEY);
  assert.deepEqual(unused, [], `defined but never read: ${unused.join(", ")}`);
});

test("the language choice is stored under one named key", () => {
  assert.equal(typeof LANG_KEY, "string");
  assert.ok(LANG_KEY.length > 0);
});

test("no English chrome sentence runs past fourteen words", () => {
  const WORD = /[A-Za-z][A-Za-z'’-]*/g;
  const long = [];
  for (const [key, v] of Object.entries(CHROME)) {
    for (const s of v.en.split(/(?<=[.!?])\s+/)) {
      const n = (s.match(WORD) || []).length;
      if (n > 14) long.push(`${key}: ${n} words`);
    }
  }
  assert.deepEqual(long, []);
});

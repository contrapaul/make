/**
 * Controlled vocabulary (plan §8.2): one word for one thing, and no word that
 * sneaks a judgement in. This file holds the lists; a violation is a bug in
 * the data, not a style choice to argue about.
 *
 * Run: node --test tools/languages/test/vocabulary.test.mjs
 */

import { test } from "node:test";
import assert from "node:assert/strict";

const root = new URL("../", import.meta.url);
const load = (p) => import(new URL(p, root));

const { LANGUAGES } = await load("js/data/languages.js");
const { GLOSSARY } = await load("js/data/glossary.js");
const { CHROME } = await load("js/data/chrome.js");
const { SOURCES } = await load("js/data/sources.js");

/** Banned anywhere a student reads. Each entry says what to write instead. */
const NEVER = {
  simply: "delete it; nothing here is simple to a beginner",
  just: "delete it, or write only",
  obviously: "delete it",
  "of course": "delete it",
  easy: "use the difficulty note, which is measured",
  simple: "use the difficulty note, which is measured",
  trivial: "delete it",
  powerful: "say what it does instead",
  "cutting-edge": "name the date instead",
  "state-of-the-art": "name the date instead",
  robust: "say what it resists",
  scalable: "say at what size",
  "industry standard": "cite the survey instead",
  eases: "use makes or reduces",
  leveraging: "use using",
  utilizes: "uses",
  utilize: "uses",
};

/** One word per thing. Key is the only allowed word; value is the rival. */
const CANONICAL = {
  site: "website",
  page: "web page",
  program: "programme",
  repo: "repository",
  run: "execute",
  list: "array",
};

const fields = () => {
  const out = [];
  const add = (where, text) => typeof text === "string" && out.push({ where, text });
  for (const rec of LANGUAGES) {
    const pairs = [
      ["reads", rec.reads],
      ["category", rec.category],
      ["difficulty.note", rec.difficulty ? rec.difficulty.note : ""],
      ["history.note", rec.history.note],
      ["demo.title", rec.demo.title],
      ["demo.note", rec.demo.note],
    ];
    for (const [key, value] of pairs) add(`${rec.slug}.${key}`, value);
    rec.makes.forEach((m, i) => add(`${rec.slug}.makes[${i}]`, m));
    
    rec.links.forEach((l, i) => add(`${rec.slug}.links[${i}].label`, l.label));
  }
  for (const g of GLOSSARY) {
    add(`glossary.${g.id}.short`, g.short);
    add(`glossary.${g.id}.full`, g.full);
  }
  for (const [k, v] of Object.entries(CHROME)) add(`chrome.${k}.en`, v.en);
  for (const [k, v] of Object.entries(SOURCES)) add(`sources.${k}.label`, v.label);
  return out;
};

const lower = (t) => t.toLowerCase();

test("no banned word appears", () => {
  const hits = [];
  for (const { where, text } of fields()) {
    for (const [word, why] of Object.entries(NEVER)) {
      const re = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
      if (re.test(text)) hits.push(`${where}: "${word}" - ${why}`);
    }
  }
  assert.deepEqual(hits, [], `banned words:\n${hits.join("\n")}`);
});

test("one word per thing", () => {
  const hits = [];
  const all = fields();
  for (const [allowed, rival] of Object.entries(CANONICAL)) {
    const used = all.filter((f) => new RegExp(`\\b${rival}\\b`, "i").test(f.text));
    if (used.length) hits.push(`"${rival}" in ${used.map((u) => u.where).join(", ")}; write "${allowed}"`);
  }
  assert.deepEqual(hits, [], `rival words:\n${hits.join("\n")}`);
});

test("a language is named the same way everywhere", () => {
  const names = new Map();
  for (const rec of LANGUAGES) {
    const key = rec.slug;
    if (names.has(key)) assert.equal(names.get(key), rec.name, `${key} has two spellings`);
    names.set(key, rec.name);
  }
  // C is not "C language" and C++ is not "Cpp".
  for (const [slug, name] of names) {
    assert.doesNotMatch(name, /\blanguage\b/, `${slug}: the name adds the word language`);
  }
});

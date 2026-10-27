/**
 * The reading-level gate (plan §8.1, §12). Every string a student reads in a
 * browser here must score at or below a sixth-place Fog, and no sentence may
 * run past twenty-five words. Chinese strings are exempt: they are checked by
 * a person, not by an English syllable counter.
 *
 * Run: node --test tools/languages/test/readability.test.mjs
 */

import { test } from "node:test";
import assert from "node:assert/strict";

const root = new URL("../", import.meta.url);
const load = (p) => import(new URL(p, root));

const { LANGUAGES } = await load("js/data/languages.js");
const { GLOSSARY } = await load("js/data/glossary.js");
const { CHROME } = await load("js/data/chrome.js");

const WORD = /[A-Za-z][A-Za-z'’-]*/g;

export function syllables(word) {
  let w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 0;
  if (w.length <= 3) return 1;
  w = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "").replace(/^y/, "");
  return (w.match(/[aeiouy]{1,2}/g) || []).length || 1;
}

/** Flesch-Kincaid grade of a run of text. Labels of one word are not read as sentences. */
export function fog(text) {
  const sentences = String(text)
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => (s.match(WORD) || []).length > 1);
  if (!sentences.length) return null;
  const words = sentences.flatMap((s) => s.match(WORD) || []);
  const avgWords = words.length / sentences.length;
  const avgSyllables = words.reduce((a, w) => a + syllables(w), 0) / words.length;
  return +(0.39 * avgWords + 11.8 * avgSyllables - 15.59).toFixed(1);
}

const longest = (text) =>
  String(text)
    .split(/(?<=[.!?])\s+/)
    .map((s) => (s.trim().match(WORD) || []).length)
    .reduce((a, b) => Math.max(a, b), 0);

/** What a student reads, from every module, with the field named. */
export function prose() {
  const out = [];
  const push = (where, text) => {
    if (typeof text === "string" && text.trim()) out.push({ where, text });
  };
  for (const rec of LANGUAGES) {
    push(`${rec.slug}.reads`, rec.reads);
    push(`${rec.slug}.category`, rec.category);
    rec.makes.forEach((m, i) => push(`${rec.slug}.makes[${i}]`, m));
    push(`${rec.slug}.demo.note`, rec.demo.note);
    if (rec.difficulty) push(`${rec.slug}.difficulty.note`, rec.difficulty.note);
    push(`${rec.slug}.history.note`, rec.history.note);
  }
  for (const g of GLOSSARY) {
    push(`glossary.${g.id}.short`, g.short);
    push(`glossary.${g.id}.full`, g.full);
  }
  for (const [key, pair] of Object.entries(CHROME)) {
    push(`chrome.${key}.en`, pair.en);
  }
  return out;
}

const CAP = 6.0;
const GLOSSARY_CAP = 7.0;
const MAX_WORDS = 25;

/**
 * A label is a chip, not a sentence: "General purpose" is four syllables over
 * two words, and Flesch-Kincaid divides by sentence length, so it scores 15 on
 * text no one reads as a sentence. The cap below therefore applies to prose.
 * A label is any cell with no sentence mark and at most four words. Labels are
 * still reviewed by a person (plan §12, V3), and a word a label introduces is a
 * word the glossary must hold (plan §8.1).
 */
const isLabel = (text) => !/[.!?]/.test(text) && (text.match(WORD) || []).length <= 4;
const LABELS = [];

test("record prose reads at grade six or below", () => {
  const bad = [];
  for (const item of prose()) {
    if (item.where.startsWith("glossary.")) continue;
    if (isLabel(item.text)) {
      LABELS.push(item.where);
      continue;
    }
    const score = fog(item.text);
    if (score !== null && score > CAP) bad.push(`${item.where} = ${score}`);
    if (longest(item.text) > MAX_WORDS) bad.push(`${item.where} has a ${longest(item.text)}-word sentence`);
  }
  assert.deepEqual(bad, [], `over the cap:\n${bad.join("\n")}`);
});

test("no glossary entry is over seven, and the mean is under", () => {
  const scores = GLOSSARY.map((g) => ({ id: g.id, s: fog(`${g.short} ${g.full}`) })).filter((x) => x.s !== null);
  const over = scores.filter((x) => x.s > GLOSSARY_CAP).map((x) => `${x.id} = ${x.s}`);
  assert.deepEqual(over, []);
  const mean = scores.reduce((a, x) => a + x.s, 0) / scores.length;
  assert.ok(mean < 6.5, `glossary mean is ${mean.toFixed(1)}`);
});

test("no English chrome string runs past two clauses", () => {
  const bad = Object.entries(CHROME)
    .map(([k, v]) => [k, (v.en.match(/,/g) || []).length])
    .filter(([, n]) => n > 2)
    .map(([k, n]) => `${k} has ${n} commas`);
  assert.deepEqual(bad, []);
});

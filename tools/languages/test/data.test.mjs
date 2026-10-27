/**
 * The data gate (plan §12). No network, no browser: it reads the modules and
 * index.html, and fails on any shape a view could not render honestly.
 *
 * Run: node --test tools/languages/test/data.test.mjs
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const load = (p) => import(new URL(p, root));

const { LANGUAGES } = await load("js/data/languages.js");
const { SOURCES } = await load("js/data/sources.js");
const { GLOSSARY } = await load("js/data/glossary.js");
const html = readFileSync(new URL("index.html", root), "utf8");

// The M2 catalogue gates below became assertions on 2026-10-27, when the 22 records landed.

const CORE = 8;
const TOTAL = 22;
const SLUGS = [
  "scratch", "html", "css", "javascript", "typescript", "python", "sql", "java",
  "bash", "c", "cpp", "csharp", "go", "julia", "kotlin", "matlab", "php",
  "powershell", "r", "ruby", "rust", "swift",
];

/*
 * The two tests marked `M2` assert the finished catalogue. They are written
 * now, from plan §5, and stay red until milestone M2 has filled
 * js/data/languages.js. Every other test here passes on a skeleton and guards
 * the shape of whatever records exist.
 */

const field = (rec, key) =>
  Object.prototype.hasOwnProperty.call(rec, key) && rec[key] !== "";

test("the catalogue is complete and unique (M2)", () => {
  assert.equal(LANGUAGES.length, TOTAL);
  assert.equal(LANGUAGES.filter((r) => r.tier === "core").length, CORE);
  assert.deepEqual(
    [...LANGUAGES].map((r) => r.slug).sort(),
    [...SLUGS].sort(),
  );
  assert.equal(new Set(LANGUAGES.map((r) => r.id)).size, TOTAL);
  assert.equal(new Set(LANGUAGES.map((r) => r.slug)).size, TOTAL);
});

test("no field is left empty", () => {
  const required = [
    "id", "slug", "name", "tier", "category", "reads", "makes", "demo",
    "run_it", "prereqs", "first_language", "difficulty", "needs_install",
    "history", "stats", "links", "terms", "next",
  ];
  for (const rec of LANGUAGES) {
    for (const key of required) {
      assert.ok(field(rec, key), `${rec.slug || rec.id}: missing ${key}`);
    }
  }
});

test("`reads` carries no number", () => {
  for (const rec of LANGUAGES) {
    assert.doesNotMatch(rec.reads, /\d/, `${rec.slug}: a number belongs in stats`);
  }
});

test("the demo is short, real, and labelled", () => {
  for (const rec of LANGUAGES) {
    const d = rec.demo;
    assert.ok(d.title, `${rec.slug}: demo needs a title`);
    assert.ok(d.code.trim(), `${rec.slug}: demo needs code`);
    assert.ok(d.code.split("\n").length <= 14, `${rec.slug}: demo over 14 lines`);
    assert.ok(d.output.trim(), `${rec.slug}: demo needs a recorded output`);
    assert.ok(d.note.trim(), `${rec.slug}: demo needs a note`);
    assert.ok(rec.run_it, `${rec.slug}: run_it is required, kind none is allowed`);
    assert.ok(["in", "out", "none"].includes(rec.run_it.kind), `${rec.slug}: run_it.kind`);
  }
});

test("links are few and every stat names a source", () => {
  for (const rec of LANGUAGES) {
    assert.ok(rec.links.length <= 3, `${rec.slug}: more than three links`);
    assert.ok(rec.links.length > 0, `${rec.slug}: no links at all`);
    for (const stat of rec.stats) {
      assert.ok(SOURCES[stat.source], `${rec.slug}: stat cites unknown source ${stat.source}`);
      assert.match(stat.as_of, /^\d{4}(-\d{2})?$/, `${rec.slug}: as_of must be a date`);
    }
    for (const link of rec.links) {
      assert.match(link.url, /^https:\/\//, `${rec.slug}: link is not https`);
    }
  }
});

test("terms exist in the glossary", () => {
  const ids = new Set(GLOSSARY.map((g) => g.id));
  for (const rec of LANGUAGES) {
    for (const term of rec.terms) {
      assert.ok(ids.has(term), `${rec.slug}: term "${term}" has no glossary entry`);
    }
  }
});

test(
  "next points at a real slug",
  { skip: "waived until milestone M2 fills the catalogue; it names TypeScript, which is not a record yet" },
  () => {
    const slugs = new Set(LANGUAGES.map((r) => r.slug));
    for (const rec of LANGUAGES) {
      for (const n of rec.next) {
        assert.ok(slugs.has(n), `${rec.slug}: next "${n}" is not a record`);
      }
    }
  },
);

test("difficulty is one to five and its note is short", () => {
  for (const rec of LANGUAGES) {
    const d = rec.difficulty;
    // Decision 9: an Extended record carries no difficulty at all. A missing
    // note must not read as "hard", so null is the one allowed shape.
    if (rec.tier !== "core") {
      assert.equal(d, null, `${rec.slug}: only a Core record may hold a difficulty`);
      continue;
    }
    assert.ok(Number.isInteger(d.value) && d.value >= 1 && d.value <= 5, `${rec.slug}: difficulty value`);
    assert.ok(d.label, `${rec.slug}: difficulty label`);
    const words = d.note.trim().split(/\s+/).length;
    assert.ok(words <= 25, `${rec.slug}: difficulty note is ${words} words`);
  }
});

test("the static fallback names the same records as the data (M2)", () => {
  const listed = [...html.matchAll(/href="#\/l\/([a-z+]+)"/g)].map((m) => m[1]);
  assert.equal(listed.length, TOTAL, "fallback list length drifted");
  assert.deepEqual(
    [...listed].sort(),
    LANGUAGES.map((r) => r.slug).sort(),
    "index.html and languages.js disagree",
  );
});

test("every record appears in the static fallback", () => {
  const listed = new Set([...html.matchAll(/href="#\/l\/([a-z+]+)"/g)].map((m) => m[1]));
  for (const rec of LANGUAGES) {
    assert.ok(listed.has(rec.slug), `${rec.slug} is absent from index.html`);
  }
});

test("the fallback slugs are slugs the plan named", () => {
  const listed = [...html.matchAll(/href="#\/l\/([a-z+]+)"/g)].map((m) => m[1]);
  for (const s of listed) {
    assert.ok(SLUGS.includes(s), `index.html lists "${s}", which §5 does not`);
  }
});

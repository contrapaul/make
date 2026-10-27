/**
 * e03s01 — the index filter gate (plan §7: "Filter chips by category",
 * quantized per the e03s01 decision 2026-10-28). No network, no browser:
 * the axis, the mapping, and the pure filter are all checkable in Node.
 *
 * Run: node --test tools/languages/test/filter.test.mjs
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const { LANGUAGES } = await import(new URL("js/data/languages.js", root));

const { KINDS, KIND_OF, filterLanguages } = await import(
  new URL("js/filter.js", root)
);

test("filter: every record maps to exactly one kind", () => {
  for (const rec of LANGUAGES) {
    const kind = KIND_OF[rec.id];
    assert.ok(kind, `missing kind for ${rec.id}`);
    assert.ok(KINDS.includes(kind), `${rec.id} maps to unmapped kind ${kind}`);
  }
});

test("filter: the kind set is small and non-trivial", () => {
  // A filter with one chip per row is not a filter. Keep the axis tight and
  // every chip meaningful. One named exception (owner decision 2026-10-28):
  // "blocks" holds only Scratch, but that one-record distinction is the
  // point of that chip for a beginner.
  assert.ok(KINDS.length >= 3 && KINDS.length <= 6, `kind count ${KINDS.length}`);
  for (const k of KINDS) {
    const n = LANGUAGES.filter((r) => KIND_OF[r.id] === k).length;
    assert.ok(n >= 1, `kind ${k} is empty`);
    if (k !== "blocks") {
      assert.ok(n >= 2, `kind ${k} holds only ${n} record(s); the chip would be noise`);
    }
  }
});

test("filter: all returns every record, unchanged order", () => {
  const out = filterLanguages(LANGUAGES, "all");
  assert.deepEqual(out.map((r) => r.id), LANGUAGES.map((r) => r.id));
});

test("filter: a kind returns exactly its records", () => {
  for (const k of KINDS) {
    const want = LANGUAGES.filter((r) => KIND_OF[r.id] === k).map((r) => r.id);
    const got = filterLanguages(LANGUAGES, k).map((r) => r.id);
    assert.deepEqual(got, want, `kind ${k}`);
  }
});

test("filter: kind and tier combine", () => {
  for (const tier of ["core", "extended"]) {
    const want = LANGUAGES.filter(
      (r) => r.tier === tier && KIND_OF[r.id] === "systems"
    ).map((r) => r.id);
    const got = filterLanguages(LANGUAGES, "systems", tier).map((r) => r.id);
    assert.deepEqual(got, want, `tier ${tier}`);
  }
});

test("filter: no match is an honest empty list", () => {
  // An axis lets the reader pick chips that leave nothing in one tier: the
  // view must then say "none" instead of silently showing a wrong set.
  assert.deepEqual(filterLanguages(LANGUAGES, "blocks", "extended"), []);
});

// --- e03s01t02: the view wiring ------------------------------
// The site has no DOM in its tests (and no dependency to fake one), so the
// wiring gate is source-level: the index view must render chips from this
// module, labels and the no-match state from chrome, never own a copy of
// the vocabulary or the copy itself.

const viewsSrc = readFileSync(new URL("js/views.js", root), "utf8");
const chromeSrc = readFileSync(new URL("js/data/chrome.js", root), "utf8");

test(
  "view: the index renders chips from the shared filter module",
  () => {
    assert.ok(
      viewsSrc.includes('"./filter.js"') || viewsSrc.includes("'./filter.js'"),
      "views.js imports the filter module"
    );
    assert.ok(viewsSrc.includes("KINDS"), "views.js walks KINDS");
    assert.ok(
      /filter\.kind\./.test(viewsSrc),
      "chip labels use the filter.kind.* chrome keys"
    );
  }
);

test("view: the no-match state is a chrome key, both languages", () => {
  assert.ok(/filter\.none/.test(viewsSrc), "views.js names the no-match key");
  assert.ok(
    /"filter\.none":\s*\{\s*en:\s*"[^"]+"/.test(chromeSrc),
    "filter.none has an English string"
  );
  assert.ok(
    /"filter\.none":\s*\{[^}]*zh:\s*"[^"]+"/.test(chromeSrc),
    "filter.none has a Chinese string"
  );
});

test("chrome: a key exists per kind, and new keys mark zh pending V8", () => {
  for (const k of KINDS) {
    assert.ok(
      chromeSrc.includes(`"filter.kind.${k}":`),
      `missing chrome key filter.kind.${k}`
    );
  }
  assert.ok(
    chromeSrc.includes("pending V8"),
    "new keys carry the zh-pending-V8 marker the epic promised"
  );
});

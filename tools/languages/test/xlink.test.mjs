/**
 * e03s03 — the cross-link gate to the sibling projects site. No network, no
 * browser: data integrity and the pure footer builder are checkable in Node.
 *
 * Run: node --test tools/languages/test/xlink.test.mjs
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const { LANGUAGES } = await import(new URL("js/data/languages.js", root));
const { LIST } = await import(new URL("js/data/project-lists.js", root));
const { projectLinksForLanguage, XLINK_HREF } = await import(
  new URL("js/views.js", root)
);
const PROJECTS = (
  await import(new URL("../build/projects/js/data/projects.js", root))
).PROJECTS;
const chromeSrc = readFileSync(new URL("js/data/chrome.js", root), "utf8");
const viewsSrc = readFileSync(new URL("js/views.js", root), "utf8");

test("xlink: the join table never names a language or project that does not exist", () => {
  const slugs = new Set(LANGUAGES.map((r) => r.slug));
  const ids = new Set(PROJECTS.map((p) => p.id));
  for (const [slug, rec] of Object.entries(LIST)) {
    assert.ok(slugs.has(slug), `unknown language slug ${slug}`);
    for (const p of rec.projects) assert.ok(ids.has(p.id), `unknown project ${p.id}`);
  }
});

test("xlink: count agrees with the sibling data (no drift, no stale row)", () => {
  for (const [slug, rec] of Object.entries(LIST)) {
    const n = PROJECTS.filter((p) =>
      (p.languages || []).some((t) => rec.tags.includes(t))
    ).length;
    assert.equal(rec.count, n, `count drifted for ${slug}`);
    assert.ok(rec.projects.length <= 3, "cap of three names");
  }
});

test("xlink: a matched language yields names, a correct count, and the pinned href", () => {
  const out = projectLinksForLanguage("python");
  assert.ok(out, "python must have a footer");
  assert.equal(out.count, LIST.python.count);
  assert.equal(out.names.length, Math.min(3, LIST.python.count));
  assert.equal(out.href, XLINK_HREF);
});

test("xlink: an unmatched language yields nothing (the footer is omitted)", () => {
  for (const rec of LANGUAGES) {
    if (LIST[rec.slug]) continue;
    assert.equal(projectLinksForLanguage(rec.slug), null, `${rec.slug}`);
  }
  assert.equal(projectLinksForLanguage("typescript"), null, "no sibling tag for TS");
});

test("xlink: the sibling route is pinned, so a route change is a loud failure", () => {
  assert.equal(
    XLINK_HREF,
    "/tools/build/projects/#/random",
    "owner decision 2026-10-28: the random tab is the only target"
  );
  assert.ok(
    viewsSrc.includes('href="/tools/build/projects/#/random"') === false,
    "views must not retype the route; they take it from XLINK_HREF"
  );
});

test("xlink: chrome holds the footer keys in both languages, zh pending V8", () => {
  for (const key of ["xlink.title", "xlink.more", "xlink.link"]) {
    assert.ok(chromeSrc.includes(`"${key}":`), `missing chrome key ${key}`);
  }
  assert.ok(chromeSrc.includes("pending V8"), "new keys carry the zh-pending-V8 marker");
});

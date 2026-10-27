/**
 * The link gate (plan §12). Two modes, because a network check has no business
 * failing an offline run:
 *
 *   node --test tools/languages/test/links.test.mjs          # shape only, always
 *   LINKS=1 node --test tools/languages/test/links.test.mjs  # + the live check
 *
 * The live check is run by hand before a release, not by `npm test`.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const load = (p) => import(new URL(p, root));

const { LANGUAGES } = await load("js/data/languages.js");
const { GLOSSARY } = await load("js/data/glossary.js");
const { SOURCES } = await load("js/data/sources.js");

/**
 * Six hosts answer a scripted client with a 403 or a sign-in redirect while
 * serving a browser fine. Each is exempt for the stated reason; none is a dead
 * link. Verified by hand on 2026-10-26 (plan §14).
 */
const BOT_BLOCKED = [
  "www.w3.org", // 403 on every path, incl. /History and /Style
  "www.mathworks.com", // 403 on /company/history
  "www.ibm.com", // 403 on /docs
  "dl.acm.org", // 403 on /doi
  "realpython.com", // 403 to curl, fine in a browser
  "developer.android.com", // 302 to Google sign-in without a cookie
];

const allLinks = () => {
  const out = [];
  const add = (where, url, label) => out.push({ where, url, label });
  for (const rec of LANGUAGES) {
    rec.links.forEach((l, i) => add(`${rec.slug}.links[${i}]`, l.url, l.label));
    if (rec.run_it.url) add(`${rec.slug}.run_it`, rec.run_it.url, null);
  }
  for (const g of GLOSSARY) {
    g.links.forEach((l, i) => add(`glossary.${g.id}.links[${i}]`, l.url, l.source));
  }
  for (const [k, s] of Object.entries(SOURCES)) add(`sources.${k}`, s.url, s.label);
  return out;
};

const blocked = (url) => BOT_BLOCKED.some((host) => url.includes(`//${host}`) || url.includes(`//www.${host}`));

test("every link is https, and every link has a label", () => {
  const bad = allLinks().filter((l) => !/^https:\/\//.test(l.url) || !l.label || !l.label.trim());
  assert.deepEqual(bad.map((b) => `${b.where} = ${b.url}`), []);
});

test("the same URL never carries two labels", () => {
  const byUrl = new Map();
  const clash = [];
  for (const l of allLinks()) {
    if (byUrl.has(l.url) && byUrl.get(l.url) !== l.label) {
      clash.push(`${l.url}: "${byUrl.get(l.url)}" vs "${l.label}" at ${l.where}`);
    }
    byUrl.set(l.url, l.label);
  }
  assert.deepEqual(clash, []);
});

test("sources.js holds the same urls as the source document's list", () => {
  let md = "";
  try {
    md = readFileSync(new URL("../build/languages.md", root), "utf8");
  } catch {
    return; // source document moved: the shape tests above still run
  }
  // The [Sn] list in languages.md is the citation list. Its prose labels are
  // longer than a link needs, so this compares the set of urls, key by key.
  const entries = [...md.matchAll(/\*\*\[(S\d+)\]\*\* ([^\n]+)/g)];
  const drift = [];
  const seen = new Set();
  for (const [, key, rest] of entries) {
    seen.add(key);
    const urls = [...rest.matchAll(/https:\/\/[^\s)]+/g)].map((u) => u[0].replace(/[.,;]$/, ""));
    if (!urls.length) {
      // A note in the document with no address, like the first edition's link
      // audit, is not a source a student can be sent to. It is not required
      // here, and its absence must stay deliberate.
      if (SOURCES[key]) drift.push(`${key}: the document has no url but sources.js holds one`);
      continue;
    }
    const held = SOURCES[key];
    if (!held) {
      drift.push(`${key}: in the document, missing from sources.js`);
      continue;
    }
    if (!urls.includes(held.url)) {
      drift.push(`${key}: sources.js url ${held.url} is not one of the document's ${urls.join(" ")}`);
    }
  }
  for (const key of Object.keys(SOURCES)) {
    if (!seen.has(key)) drift.push(`${key}: in sources.js, not in the document`);
  }
  assert.deepEqual(drift, []);
});

test("live check", { skip: process.env.LINKS ? false : "set LINKS=1 to run the network check" }, async () => {
  const fetch1 = (url) =>
    fetch(url, { redirect: "follow", headers: { "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)" } });
  const fails = [];
  for (const l of allLinks()) {
    if (blocked(l.url)) continue;
    try {
      const res = await fetch1(l.url);
      if (!res.ok) fails.push(`${l.where} -> ${res.status} ${l.url}`);
    } catch (error) {
      fails.push(`${l.where} -> ${error.message} ${l.url}`);
    }
  }
  assert.deepEqual(fails, [], `links that did not answer 200:\n${fails.join("\n")}`);
});

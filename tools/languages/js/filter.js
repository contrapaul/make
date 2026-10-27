/**
 * e03s01 — the index filter axis. Plan §7 says "filter chips by category",
 * but the raw category on the records is one free phrase each, so the axis
 * here is a small quantized kind, owner-approved 2026-10-28. Pure on purpose:
 * the view renders it, Node tests it (test/filter.test.mjs).
 */

// The chip set, sorted for stable rendering after "all".
export const KINDS = [
  "blocks",
  "web",
  "general",
  "systems",
  "data",
  "terminal",
];

// Each of the 22 records to exactly one kind. Touched by both the chips and
// the row grouping, so a record left off of this map is a loud failure in
// test/filter.test.mjs rather than a silent missing chip.
export const KIND_OF = {
  scratch: "blocks",
  html: "web",
  css: "web",
  javascript: "web",
  typescript: "web",
  php: "web",
  python: "general",
  java: "general",
  csharp: "general",
  kotlin: "general",
  ruby: "general",
  c: "systems",
  cpp: "systems",
  go: "systems",
  rust: "systems",
  swift: "systems",
  sql: "data",
  r: "data",
  julia: "data",
  matlab: "data",
  bash: "terminal",
  powershell: "terminal",
};

/**
 * Narrow the catalogue. kind defaults to "all", tier to "any". The result
 * keeps catalogue order: the reader is triaging, not browsing.
 */
export function filterLanguages(records, kind = "all", tier = "any") {
  return records.filter(
    (r) => (kind === "all" || KIND_OF[r.id] === kind) && (tier === "any" || r.tier === tier)
  );
}

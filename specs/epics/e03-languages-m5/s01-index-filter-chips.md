# e03s01 — Index filter chips (category axis + i18n)

Stable story id: e03s01. Slice: a student on the languages index can narrow the
22 languages by a small, meaningful category axis, in both languages.

## Problem

Plan §7 says the index ships "filter chips by `category`". The raw `category`
field on the 22 records holds varied free phrases ("Systems language",
"Systems language, compiled", "General purpose, managed", ...) with only a few
repeats. A filter on the raw field is a filter where each chip has one row.
The fix is a small *quantized* category vocabulary derived from the 22 records,
and chips that map cleanly to it.

## Deliverable

A pure function `filterLanguages(records, chips)` in
`tools/languages/js/views.js` (or a small new module) plus the index view wiring
it in. Chip labels in `js/data/chrome.js` under a new `filter.*` key, both
languages. A "no match" state in the same chrome keys.

## Acceptance questions (answered 2026-10-28, owner-approved)

A. Filter axis: quantized **"kind" chips** over a small pinned vocabulary
   (the raw `category` phrase is not a chip set — only ~6 repeats across 22).
   The exact bucket set is pinned in e03s01t01 output: a `kind` value added to
   each record's data or a small `kind` map in the filter module. Every record
   gets exactly one kind; the chip list is the sorted set of kinds plus "all".
B. Default state: "all" is the default chip; every record shows under it.
C. Selection: single-select, "all" default (simplest working model).

## Tasks

- [x] e03s01t01: pick the category vocabulary (A); code the `filterLanguages`
      pure function + unit tests verifying every record is included under
      "all" and each non-empty chip includes only recorded records
      - verify: `node --test tools/languages/test/filter.test.mjs`
- [x] e03s01t02: wire chips into `indexView` (`views.js`); both tiers
      observable to react; no-match state visible when the filter exclude-all
      - verify: `node --test tools/languages/test/*.test.mjs`
- [x] e03s01t03: chrome strings for `filter.label`, `filter.<chip>`,
      `filter.all`, `filter.none` in both languages; update the chrome-parity
      test to cover the new keys
      - verify: `node --test tools/languages/test/chrome.test.mjs`

## Out of scope

- Chinese for the new `filter.*` keys is audience-derented to M6's V8 pass:
  the owner's colleague (non-engineer reader) approves the new keys with the
  existing 42. Until then the new chrome keys are production-ready in both
  languages in this manifest; the zh is marked unapproved until V8 is done.
  (Owner decision 2026-10-28)

- Search box on the index (v1.1, per plan §11.1)
- Comparison view or "I am not sure" chooser (v1.1)
- Multi-select chips (deferred; single-select is the simplest working model
  for M5)
- Sort by name or difficulty (not in plan §7)
- URL-encodable filter state (hash-router core M1 locked out of query-hash
  state; if it helps, defer)

## Verify

- `npm test` green (whole repo)
- `wrangler pages dev` boots and the new chips render without JS errors

# e03s03 — Language-page cross-links to sibling projects

Stable story id: e03s03. Slice: a student reading any of the 22 language pages
can jump to matching one-afternoon project ideas on the sibling site, in one
click, only where the target project really answers.

## Problem

Plan decision 14: every language page links to matching project ideas from
`tools/build/projects.md` where one exists. The sibling site is built and live
at `/tools/build/projects/`. Its 150 records have normalized language tags
(`tools/build/projects/js/data/projects.js` — `PROJECTS[].languages`); we can
join on those to know for which of the 22 language slugs at least one project
ticket exists.

## Deliverable

A footer block on each of the 22 language pages: 3 project names + total
match count, one line, one link (no per-name links, no hover content, keeps
the "one screen" style). When zero projects match a language, no footer block
(do not ship an empty chip). The link target is decided below; the join table
is a build-time deliverable of this story.

## Decisions (owner-approved 2026-10-28)

- **Deep-link target: (a) — land on `…/tools/build/projects/#/random`**,
  unfiltered. The random tab answers, the copy names the language, and we do
  not open a sibling change to ship M5. (b) browse would mislead; (c) a
  `?lang=` URL-param route is the designed follow-up for the sibling owner.
- **Footer size: 3 project names + total match count**, one displayed line.
  The 3 names prefer Part 1 (general, plays wide) over Parts 2/3. Fewer than
  3 matches lists what is there; count always agrees; zero matches = no block.
- **Language-name slugs.** We join on `PROJECTS[].languages` tag (already
  lowercase). The 22 language slugs do not always match the sibling tags
  one-to-one (e.g., sibling uses `js`, language site slug is `javascript`).
  The join table lives in a small data file and is part of this story's
  deliverable.

Acceptance (owner-signed 2026-10-28):
- The join table (`languageSlug -> []siblingTags`) is complete for all 22.
- The footer block reads: 3 project names, total count, one line, one link.
- Chinese for new chrome keys: the drafts ship in chrome.js in both
  languages (parity test holds), but the new keys are NOT approved for
  public cn readers until the M6 V8 pass with the owner's colleague
  (non-engineer). Until that pass: the zh names for new keys exist, marked
  in a code comment as `zh pending V8`. Owner decision 2026-10-28.

## Tasks

- [x] e03s03t01: build `tools/languages/js/data/project-lists.js` — a
      generated module mapping each of the 22 language slugs to 3-4 matching
      sibling project `{id, name}` pairs (or fewer, or nothing)
      - verify: `node -e "import('...').then(m=>console.log(Object.keys(m.LIST).length))"` == 22
- [x] e03s03t02: a pure helper `projectLinksForLanguage(slug, list, fmt)`
      that returns the footer nodes (empty when the map has no entries);
      unit-test: (i) a core language has at least one entry, (ii) a language
      with no matches yields no block, (iii) the href deep-links to the
      chosen sibling route, (iv) every href ends with `#/random` (decision
      above)
      - verify: `node --test tools/languages/test/xlink.test.mjs`
- [x] e03s03t03: wire into `languageView` (`views.js`); copy in chrome.js in
      both languages for the footer heading ("Practice projects with
      <language>") and the button/link wording; update chrome parity test
      - verify: `node --test tools/languages/test/*.test.mjs`
- [x] e03s03t04: pin the selected sibling deep-link shape with a regression
      test (`xlinkHref` for a known slug). prevents a later sibling-route
      change from silently breaking the miles
      - verify: `node --test tools/languages/test/xlink.test.mjs`

## Out of scope

Adding a `#/random?lang=` filter route to the sibling site. (The sibling
product owner should own it; opens a sibling PR under its own plan, not
M5.) The same pattern could also grant a pre-filtered `#/browse?lang=`;
both are follow-up candidates under the sibling project, not M5.

### Candidate follow-up (not in this epic)

Under the sibling's own plan, a `#/random?lang=<tag>` (or
`#/browse?lang=<tag>`) route with the filter state loaded from the URL would
make every e03s03 link land pre-narrowed. Cost: ~2 hours, sibling domain,
requires the sibling's owner to say yes. If/when it lands, e03s03t04 is the
one test to flip.

## Verify

- `npm test` green (whole)
- On `http://localhost:8899/#/l/python` the footer appears with the
  chosen project names; the link deep-links to the shape pinned in e03s03t04
- On a low-match language (e.g., VBA — confirm via the join table) the
  footer is absent

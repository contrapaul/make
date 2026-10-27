# e03s02 — Nav row on the tools index page

Stable story id: e03s02. Slice: a student on the tools landing page finds the
languages site the same way they find the other four tools.

## Problem

`tools/index.html` lists four `.trow` entries (esp32 macropad, tone trainer,
chinese 101, soundboard). The languages site is live at
`/tools/languages/` but has no row here. A student who lands on the tools
page and wants "22 languages, one screen each" has no path.

## Deliverable

A new `.trow` in `tools/index.html` matching the existing markup (numbered
label, screen media slot, tag list, "Open tool →" cue). Row label text
follows the site's style rules.

## Tasks

- [x] e03s02t01: copy one of the four existing rows, renumber remaining rows;
      label `05: Language`, blurb covers what 22-language reference with a
      glossary means, 2-3 tags (Reference, Languages, Glossary)
      - verify: `node -e "const s=require('fs').readFileSync('tools/index.html','utf8');console.log((s.match(/trow/g)||[]).length)"` (expect 5)
- [x] e03s02t02: verify the href path `/tools/languages/` resolves (no 404,
      page is the languages home) — the 200-homepage catch-all means we check
      the title, not the status
      - verify-script: `curl -s https://make.contrapaul.com/tools/languages/ | grep -o '<title>[^<]*' `
        should print the languages title, not "contrapaul / make"

## Out of scope

- Screenshot on the row (media slot is a placeholder in all four existing
  rows; leaving it empty is consistent)
- CSS changes to `.trow` (four rows already determine the visual; a fifth
  should not change it)

## Verify

- `wrangler pages dev` renders the fifth row with the right href
- The title-check above (or the local equivalent) confirms the href resolves

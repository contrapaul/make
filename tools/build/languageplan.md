# Language Reference Site — Build Plan

**Status:** planning complete, fifteen decisions frozen, no open question. Ready for `kickoff-branch`.
A fourth decision set (12-15) settled the route model, review cadence, cross-link rule, and PR
shape on 2026-10-26, which is what stood between this plan and a first commit.
**Source document:** `tools/build/languages.md` (22-language table, second edition). The first
edition was a 20-row generated table reviewed in §1 below; it was corrected in place on
2026-10-26, so §1, §13 and §14 describe the document as it arrived, and `languages.md` carries
the corrections and their citations.
**Target:** a student-facing reference site for 22 programming languages, built as a static
sub-site of `make` with no new dependencies and no build step.
**Owner of plan:** Paul. Eleven decisions are recorded as taken in §3, none open. Two were added
by the build-readiness pass on 2026-10-26 (highlighting, v1 scope) and two were resolved by it
(language switcher, difficulty notes).
**Dates in this file:** the plan was written 2026-10-26 and its data refreshed the same day. All
market numbers carry their own as-of date in §4 and §13, because they expire.

---

## 1. Review of `tools/build/languages.md`

Review run against the **first edition** (commit `dd50574`). The findings below stand; the fixes
they call for were applied to `languages.md` on 2026-10-26 rather than left for the build, so
that the plan starts from a source whose facts carry citations.

### 1.1 What the document is

A single 8-column Markdown table titled "Programming Languages Reference Table — For Your
Educational Website", added in commit `dd50574` ("Update languages.md"). The opening line is
direct address to a model: *"Below is a broad catalogue you can trim down."* It is a generated
research artifact, and it was saved without its tail: the file ends mid-sentence in row 20 at
the bytes `Originates from`, with no closing sections and no rows beyond Bash.

The columns are good columns. `Type / Category`, `What It Actually Does`, `Typical Real-World
Applications`, `Demo / Example Idea`, `Key Notes`, `Suggested Reference Links` is a workable
content model, and most of the plain-language descriptions are accurate and useful. The
document is worth keeping as the seed of the build. It is not worth shipping.

### 1.2 Defects, by class

**Structural (blocks the build):**

| ID | Defect | Consequence | Fix |
|---|---|---|---|
| S1 | File is truncated inside row 20 (Bash `Key Notes`) | One of 20 entries has no notes, and no history claim an author can trust | **Fixed in source.** Bash written from the GNU project history (§13, last row) |
| S2 | Row 17 packs **MATLAB and Julia** into one row | Breaks one-entry-per-language data modelling: no id, no slug, no per-language stats or demo | **Fixed in source.** Two rows, both Extended tier (§5) |
| S3 | Rows are numbered 1–20 with no stated basis | Reads as a ranking. Students and teachers will rank them | **Fixed in source.** The `#` column is deleted; ordering is stated (§5.4). Never render a number in front of a language name |
| S4 | Columns are prose paragraphs, not fields | Cannot filter, sort, cross-link, or reuse in the projects glossary | Normalise into the record shape in §6.2 |
| S5 | No prerequisites, no difficulty scale, no install/runtime model, no first-language verdict | The one question a student has ("do I start here?") is unanswerable | Add `prereqs`, `difficulty`, `runtime`, `start_here` fields (§6.2) |
| S6 | No source column, no as-of dates on facts | Every number rots silently | **Fixed in source.** `languages.md` now carries `[S1]`-`[S27]` with retrieval dates. The site still needs `sources.js` + `as_of` per claim (§6.2) |
| S7 | No information architecture: no index design, no selection guidance, no URL scheme, no cross-linking | The site has no shape | §7 |

**Content quality (blocks shipping):**

| ID | Defect | Example (verbatim) | Fix |
|---|---|---|---|
| C1 | Addressed to the site owner, not the student | "Perfect *page 0* **for your site**"; "Reinforces OOP vocabulary **your students** will meet in AP CS"; "If **your students** own iPhones" | Full voice rewrite per §8. The reader is the student |
| C2 | Undated marketing superlatives | "The **single most in-demand** language for web work", "**≈ 43 %** of the web", "most admired **8+ years running**" | **Fixed in source.** Deleted or replaced with dated figures (§13) |
| C3 | Characterisation stated as fact | "Microsoft's answer to Java", "Often mocked online but powers a huge share of the live web", "the language of the terminal" | **Fixed in source.** Opinions deleted; the useful part kept (C# runs on .NET; PHP is server-side) |
| C4 | Broken or drifting reference links | 3 of 38 URLs are dead, 1 is bot-blocked, 4 land somewhere other than the named page | **Fixed in source**, table in §14.1 |
| C5 | Demo ideas assume runtimes the site cannot host | "An auto-running cell", "run 3 lines to produce a `ggplot2` scatter", "20-line web server" | **Fixed in source.** Every sketch now fits the L1 contract (§9.2) |
| C6 | One demo idea is technically unsupported | Scratch: "Embed the actual Scratch editor (it runs in-browser via iframe)" | **Fixed in source.** Scratch documents `/projects/<id>/embed` for the *player*, not the editor. The row links out (§9.2) |
| C7 | Copy-paste residue inside a cell | "Also by Bjarne Stroustrup, Bell Labs, 1979–85" (the "Also" refers to the C row above) | **Fixed in source.** Rewritten as its own dated sentence |
| C8 | Phrasing hides the fact it wants to teach | Kotlin: "Google's preferred language for Android development" | **Fixed in source.** JetBrains (2011), endorsed by Google (2017), Kotlin-first (2019) - all three now in the row |

**Style-guide violations (blocks the tests).** Measured 2026-10-26 with a script over the table
cells (Flesch-Kincaid by the same syllable counter the site tests will use):

| ID | Violation | Measured | Governing rule |
|---|---|---|---|
| T1 | Reading level too high | Mean FK across 119 prose cells: **8.8**. 72 of 119 cells above 6.0. Worst rows: Python 15.7, R 14.2, Go 10.5, Kotlin 10.4, Rust 10.0 | `tools/codewithai/style-guide.md` §2: reader prose ≤ 6.0 |
| T2 | Long sentences | 2 prose sentences over 25 words (the C and R demo cells), plus a 44-word intro sentence. Average 9.9 words per sentence is fine | Cap 25 words, no exceptions |
| T3 | Em dashes and en dashes used as prose glue | 4 em dashes, 2 en dashes | No em dash (`localai/style-guide.md` §6). En dash only in year ranges |
| T4 | Undefined terms used to define | "bytecode", "Turing-complete", "declarative", "goroutines", "WebAssembly", "buffer-overflow", "OOP" | Expand at first use, or define in the glossary first (§10) |
| T5 | Idioms, jokes, reveals | "aha moment", "the gateway", "fewer keystrokes", "black screen from tech-support memes", "isn't \"dead\"", "doubles as copy" | No idioms, no jokes, no reveals |
| T6 | Marketing register | "single most in-demand", "must-include", "Great \"aha\" moment", "Dramatic and memorable" | Describe what a student can do, not how impressive it is |

Note: the 19 middots in the file are all inside the `Suggested Reference Links` column, which is
a data label list. That is legal. Do not "fix" it.

**Net:** 100% of rows need new copy. The knowledge is reusable; the sentences are not.

**Disposition, 2026-10-26.** The structural defects (S1-S3, S6) and the content defects that are
facts rather than prose (C2-C8) were fixed in `languages.md` itself, in place, so that no build
task inherits a wrong date: the `#` column is gone, the superlatives are dated and sourced, the
links are repaired, and every demo sketch now fits the L1 contract. S4 and S7 stay open because
they belong to the site, not to the note. **C1 and the whole of the style table (T1-T6) stay open
on purpose** - the source document is internal research, and rewriting it into reader prose is
M2 and M3 work against the §8 standard, not a favour to a scratch file. If a build step ever
templates text out of `languages.md`, that step is the defect, not this note.

---

## 2. What we are building

One reference page per language, plus an index, a glossary, and a language switcher, at
`make.contrapaul.com/tools/languages/` (decision 2 in §3). A 15-year-old
who has never written code can pick a first language, understand in two minutes what it is for,
read one real example, and know what to do next. A teacher can send a link and be sure the
numbers on the page have dates.

**Non-goals for v1:** no in-browser execution, no accounts, no progress tracking, no
curriculum, no AI tutor, no comments, no analytics beyond what already exists site-wide, no
print stylesheet, no comparison view and no "I am not sure" chooser (both v1.1, decision 11),
no Chinese record prose (chrome only, decision 8).

**Success, measurable:**

| # | Check |
|---|---|
| Z1 | Every tier-1 (Core) page reachable from the index in ≤ 2 clicks |
| Z2 | 100% of reader-facing strings pass FK ≤ 6.0 and the banned-device list |
| Z3 | Every number on every page carries a visible as-of date and a source |
| Z4 | 0 broken links, machine-verified, re-verified before each deploy |
| Z5 | A student who reads only the index can name a first language and its first lesson |
| Z6 | Site builds and serves with `wrangler pages dev` and `npm test` with zero new dependencies |
| Z7 | The language switcher changes every chrome string, leaves record prose English, and states that once in Chinese. Both languages hold the same keys |

---

## 3. Decisions

**Taken (owner, 2026-10-26):**

1. **Reader:** the student, self-serve. Teachers are a secondary reader.
2. **Location:** `tools/languages/`. Resolved by the owner: `tools/build/` hosts **two** separate
   projects. The languages site is one, and it lives at `tools/languages/`; the suggested-projects
   site is the other. Anything this plan did not author (including
   `specs/product/PROJECTS_SITE_LATEST.md` and `tools/build/projects/HANDOFF.md`, which advertise
   `/tools/build/languages`) belongs to the other project and is **not** to be edited from here.
   If that project wants a link into this one, its own artifacts should be changed by its own plan.
3. **Demo depth:** L1 — code block with syntax highlight plus recorded output. No runtimes, no
   WASM interpreters, no new npm dependencies.
4. **Catalogue:** trim and tier the 20, finish the truncated Bash entry, split MATLAB/Julia,
   and mark a Core set ("learn this first") against an Extended set ("look this up").
5. **Core / Extended membership:** Core 8 and Extended 14 as listed in §5, approved as proposed.
6. **PowerShell:** in, Extended tier. Owner's words: add it "in whatever way that makes sense -
   it's a highly useful program/shell". It is the 9th most used language on the 2026 survey, so
   the table would have been wrong without it.
7. **Glossary ownership:** this site owns the glossary module and serves it at
   `#/glossary/<term-id>`. A sibling site that wants a definition links here instead of copying it.

**Taken on 2026-10-26, second batch (build readiness):**

8. **i18n (2026-10-26).** The switcher ships; Chinese content does not. Reader-facing prose for
   the 22 records stays English in v1. What ships is the **chrome**: the ~40 fixed strings
   (nav, view labels, filter chips, Copy and Output buttons, section headings, error and empty
   states) get both languages in `js/data/chrome.js`, and a toggle in the header writes a
   `lang` key that survives navigation. Every reader-facing string therefore lives in a data
   file, never inline in `views.js` (§8.2 rule extended to chrome). No machine translation in
   v1, and no unreviewed Chinese: each `zh` string is owner-approved before it merges, the same
   gate as English copy. §12 asserts the two columns have identical key sets.
9. **Difficulty notes (2026-10-26).** The agent drafts a 25-word note per Core language from
   cited evidence (the AP Java Quick Reference, The Book's pacing, real compiler error text),
   and the owner approves, rejects, or rewrites each one before M3. Extended 14 pages do not
   show a difficulty line at all, per §5.3; a missing note must never read as "hard". The 1-5
   scale in §6.3 stays frozen.
10. **Syntax highlighting (2026-10-26).** A hand-rolled tokenizer, not a vendored Prism or
    highlight.js. About 250 lines covering comments, strings, numbers, and per-language keyword
    lists. It deliberately mis-highlights nothing dangerous and does not try for Rust lifetimes,
    C preprocessor nesting, or template types. No new dependency, which matches the repo's
    standing rule. §9.2 already specified this, so the decision confirms the plan rather than
    changing it.
11. **v1 scope (2026-10-26).** Compare and the "I am not sure" chooser move to v1.1. v1 is the
    index, 22 pages, the glossary, and the language switcher. Both deferred features are the
    sort that need stable record schemas to be worth building, and neither is on the path to Z1.
12. **Route model (2026-10-26).** Hash router, one shell `index.html`, no generator and no build
    step. Matches `localai` and `tools/codewithai`, so the router and its tests port directly.
    Consequences are in §7.1, including the one that matters: a shared `#/l/python` link cannot
    carry a per-language social preview. That is accepted, and §7.1 says what is done instead.
13. **Review cadence (2026-10-26).** Core 8 reviewed as one pass, then Extended 14 in three
    batches of four to five, each validated before the next is drafted. A template mistake costs
    8 pages, not 22.
14. **Cross-links (2026-10-26).** A language page links to the sibling projects site only where
    the target exists at build time. `data.test.mjs` resolves every in-site href against the repo
    and fails on a link that would 404. The sibling's own URLs are its plan's business (§3.2).
15. **Git shape (2026-10-26).** One PR per milestone: M0+M1, M2, M3, M4, M5+M6. Five PRs, each
    independently testable and revertible. The sibling site plans one PR per story; this site has
    one data layer and one template, so milestone granularity is the honest unit.
16. **Visual system (2026-10-26).** Ink-on-paper, **fully divorced** from `localai`, from
    `tools/codewithai`, and from the root `make` theme. Its own `tokens.css`, no import of any
    existing sheet, system font stacks, serif text face (see above), no dark mode in v1, no
    decorative imagery. §6.4 holds the proposed values. The first draft of §6.4 argued for
    deriving from the root sheet; the owner overruled that, so the derivation is gone.
17. **`tools/build/languages-blueprint.md` is not a spec (2026-10-26).** An untracked file of
    unknown authorship appeared next to this plan naming the site "machines-site", proposing a
    different Core 8, and putting a live per-language virtual machine on every page. Owner's
    ruling: ignore and delete. It is deleted, and no value, palette, or section from it is a
    source for this site. If it reappears, it is stale by construction and this decision governs.

---

## 4. Reading of the market data (input to §5)

Stack Overflow Developer Survey 2026, Technology chapter. Published 2026-10-06; 30,903 respondents
in 169 countries across 467 technologies; the languages question has a base of **n = 14,099**.
Percent below = share of those respondents reporting use in the past year. Fetched from
`survey.stackoverflow.co/2026/technology/data` on 2026-10-26.

| Language | Used % (rank) | Admired % | Desired % |
|---|---|---|---|
| JavaScript | 62.0 (#1) | 42.0 | 27.8 |
| SQL | 58.4 (#2) | 51.4 | 32.0 |
| HTML/CSS | 58.2 (#3) | 47.8 | 29.0 |
| Python | 58.0 (#4) | 50.6 | 33.4 |
| Bash/Shell | 51.3 (#5) | 48.1 | 25.8 |
| TypeScript | 43.8 (#6) | 53.0 | 27.5 |
| Java | 27.6 (#7) | 38.5 | 13.1 |
| C# | 27.1 (#8) | 50.0 | 16.5 |
| PowerShell | 24.6 (#9) | 31.5 | 8.7 |
| C++ | 24.3 (#10) | 45.8 | 15.8 |
| C | 21.8 (#11) | 45.9 | 14.2 |
| Rust | 18.0 (#12) | 67.4 | 26.3 |
| PHP | 17.7 (#13) | 35.7 | 7.6 |
| Go | 16.5 (#14) | 49.5 | 17.7 |
| Kotlin | 10.8 (#15) | 43.1 | 9.4 |
| Swift | 5.9 (#18) | 48.5 | 5.3 |
| Ruby | 5.8 (#19) | 42.4 | 4.1 |
| R | 4.5 (#21) | 40.7 | 3.3 |
| MATLAB | 3.6 (#28) | 24.4 | 1.8 |
| Julia | 1.5 (#38, tied with Erlang) | 47.4 | 2.5 |

Ranks count only rows that name a language, so the survey's "Other" answer option is excluded;
that is why the gaps below #14 are large and why Julia sits at 38 on 1.5 %. Ranks above #14 are
safe to print on a page. Below #21, print the share and not the rank: the tail is a tie board,
not a ladder.

JavaScript held the top slot for the twelfth year; the survey states that in those words. SQL
passed HTML/CSS for the first time (58.4 against 58.2, where 2025 had HTML/CSS ahead 61.9 to
58.6, and 2024 ahead 52.9 to 51.0). Rust is twelfth on 2026 against fourteenth on 2025, so it
rose two places, and it is the highest-ranked systems language on the list. All three claims are
checkable against the survey's own 2017-2026 time series, which the data page prints, so any of
them can be re-verified without a second source.

**Do not write "most admired language" as a bare sentence.** In 2026 the raw admired column is
headed by Elm (94.1 %) and Odin (82.4 %), each with a user base measured in hundreds. Rust tops
the twenty most used at 67.4 %. The survey defines admired as *have used it and want to keep
using it*, not as a vote; the 2025 edition put Rust at 72 % and described an eleven-year run.

Tiering rule used in §5: a language is **Core** if a high-school student can act on it this
term (learn it, or use it to make something in a browser), and it is broadly hiring- or
course-relevant. It is **Extended** if it is reference knowledge for a student of this age.
Admired and desired scores are inputs, not the rule: a student cannot act on a language that
needs a licence, a toolkit, or a phone to see a result.

---

## 5. Catalogue

### 5.1 Core (8) — "learn first"

| Language | Slug | Why Core | Prereq | First page task |
|---|---|---|---|---|
| Scratch | `scratch` | Zero-syntax on-ramp; block logic only | none | Make a sprite say hello, then change one word |
| HTML | `html` | Everything on the web is made of it | none (Scratch optional) | Write a page with a heading, a picture, a link |
| CSS | `css` | Never separate from HTML in practice | `html` | Change colour, spacing, and width of that page |
| JavaScript | `javascript` | The only language the browser runs | `html`, `css` | Make a button do something |
| Python | `python` | Default school language; readable; AI/data | `none` (text-based entry) | Read a list, print the average |
| SQL | `sql` | 2nd most used language on the 2026 survey; no install for a first taste | `none` | Ask a table for rows that match a rule |
| Java | `java` | AP Computer Science A exam language; first OOP | `python` helpful | A class with a method, run and read output |
| TypeScript | `typescript` | Fastest-growing web language; makes JS errors visible | `javascript` | Add types to the button example until the compiler complains |

### 5.2 Extended (14) — "look this up"

C, C++, C#, Go, Julia, Kotlin, MATLAB, PHP, PowerShell, R, Ruby, Rust, Swift, Bash.

Tier-2 pages exist from day one but ship after Core (M4), and are visually marked Extended on
the index so a beginner never mistakes them for a starting point.

### 5.3 Explicitly not in v1

Dart/Flutter, Zig, Elixir, Lua, GDScript, COBOL, Fortran, Wolfram, and every
"AI prompt engineering" framing. Lua (9.4 %), Dart (4.9 %) and GDScript (4.0 %) all outscore R,
MATLAB and Julia on the 2026 survey, so the cut is not made on use alone: it is made on whether a
high-school student meets the language at all. Lua and GDScript are the two most defensible
additions for v1.1, both because of their tie to game modding, which is a real motive at that
age.

### 5.4 Ordering

Index order: Core by path position (Scratch → HTML → CSS → JavaScript → TypeScript → Python →
SQL → Java), then Extended alphabetically. No numbering, no rank, no stars.

---

## 6. Content model

### 6.1 Files

```
tools/languages/
  index.html              # shell: nav, view container, static fallback content
  css/
    tokens.css            # colour, spacing, type scale (no raw hex elsewhere)
    base.css              # reset, prose styles
    views.css             # index / language / glossary layouts (compare styles wait for v1.1)
  js/
    router.js             # hash router, static-fallback safe
    views.js              # render: index, language, glossary (compare is v1.1). No inline strings
    i18n.js               # chrome lookup + lang key persistence, reads data/chrome.js
    demo.js               # L1 demo widget: copy, output toggle
    highlight.js          # ~250-line tokenizer: escape first, then wrap (§9.2)
    tabs/glossary.js      # auto-link + hover cards, ported from localai/js/tabs/glossary.js
    data/
      chrome.js           # fixed UI strings, { key: { en, zh } }, ~40 entries
      languages.js        # 22 records, shape in §6.2
      glossary.js         # glossary terms, shape in §10.1
      sources.js          # id -> {label, url, as_of} for every cited number
  test/
    readability.test.mjs  # FK caps per §8.1, banned devices
    vocabulary.test.mjs   # controlled vocabulary, one word per thing
    links.test.mjs        # every URL in data/ returns 200 and has a label
    chrome.test.mjs       # en/zh key sets identical; no zh value left English; no record prose in chrome
    highlight.test.mjs    # escaping before tokenising; comment and string cases; unknown language
    data.test.mjs         # schema, tier/record counts, field rules
  package.json            # {"type":"module","scripts":{"test":"node --test \"test/*.test.mjs\""}}
```

The plan itself lives at `tools/build/languageplan.md` (this file), next to the source document.
`languages.md` stays where it is, untouched. It is the seed, not the spec.

### 6.2 Record shape (minimum fields)

```
{
  id, slug, name, tier: "core" | "extended",
  category: "markup" | "style" | "general" | "query" | "systems" | "mobile"
          | "scripting" | "data" | "visual",
  reads:  "<= 3 sentences, what it does, plain words>",
  makes:  ["web pages", "phone apps", ...],        // noun phrases, <= 6
  demo:   { title, language, code, output, note }, // L1 contract, §9.2
  run_it: { kind: "link-out" | "none", label, url },
  prereqs: [ids], first_language: bool,
  difficulty: 1..5,                                // scale defined in §6.3
  needs_install: "none" | "browser only" | "download an editor" | "download a toolkit",
  history: { creator, org, year, note },
  stats: [ { metric, value, as_of, source } ],     // NEVER an unnumbered number
  links: [ { label, url } ],                       // <= 3, validated
  terms: [term ids used on the page],
  next: [ids]
}
```

Rules:
- No field left as `""`. If a value is unknown, it is absent, and the page does not render it.
- `stats` entries must resolve through `sources.js`. A literal number in `reads` is a test
  failure.
- `links` capped at 3. Prefer a primary source (language or vendor docs) plus one interactive
  tutorial. No affiliate, no SEO course.
- One record per language. The MATLAB/Julia row becomes two records, each with its own history
  and stats.

### 6.4 Design system (`css/tokens.css`)

§6.1 named this file and the first draft of this plan never specified it, which is how a site
ends up with hex codes in six places. Fixed here.

**Look: an original ink-on-paper system, independent of every existing sheet.** Owner's call,
2026-10-26: the language site is "fully divorced from localai and codewithai, as well as the main
make themes" and goes ink-on-paper. The first draft of this section argued the opposite, that
three visual dialects on one domain is one too many, and proposed deriving from root
`style.css`. That argument is over. This site gets its own `tokens.css` and `@import` nothing.

Two consequences are accepted rather than hidden:

- A student moving from the home page to `/tools/languages/` sees a different typographic voice.
  That is the point of the call, not an oversight to apologise for.
- Nothing in `localai/css/`, `tools/codewithai/css/`, or root `style.css` is a source of truth
  for a value below. The shared **discipline** stays (one token file, no raw hex elsewhere); the
  **values** are this site's own.

### 6.4.1 Starting tokens (drafted here, tuned in M1)

These are proposals, not measurements. They exist so M1 has a place to start and so the contrast
rule below can be checked, and every one is negotiable until the owner sees a rendered page.

| Token | Proposed | Role |
|---|---|---|
| `--paper` | `#f7f4ec` | Page ground, warm off-white, never pure white |
| `--ink` | `#1b1a17` | Body text, near-black warm |
| `--ink-quiet` | `#5c584e` | Captions, source notes, as-of dates |
| `--rule` | `#cdc7b8` | Rules and card edges, 1 px only |
| `--accent` | `#a33d1f` | Burnt sienna. Links, one emphasis per view |
| `--focus` | `#1b1a17` 2 px offset ring | Keyboard focus, always visible |
| `--hl-key` / `--hl-str` / `--hl-com` / `--hl-num` | four values, set in M1 | Syntax classes, each ≥ 4.5:1 on `--paper` |

Type, one family for reading and one for code, both **system stacks**, so the site adds zero font
requests:

- `--font-text`: `Charter, "Bitstream Charter", "Sitka Text", Cambria, serif`
- `--font-code`: `"SF Mono", "Cascadia Mono", "DejaVu Sans Mono", Menlo, Consolas, monospace`

**Text face: serif. Decided 2026-10-26, owner's call.** A serif is the honest reading choice for a
site that is prose and code, and it is what separates this site's voice from the root site's Space
Grotesk while costing no font requests. The grotesque alternative is dropped, not deferred.

Scale: 8 pt rhythm (`--sp-1` 4 px through `--sp-8` 64 px), type sizes 15 17 20 24 32 48. Radius
0 or 2 px, no exception. Motion 120 and 200 ms, and only for focus, copy confirmation, and panel
open.

Rules for `tokens.css`, `base.css`, `views.css`:

1. **Color lives in `tokens.css` only.** Component CSS reads `var(--ink)`. A raw hex anywhere
   else is a review defect.
2. **One file states each value once.** Spacing, type sizes, radius, motion, and colour all
   originate in `tokens.css`. No second table of magic numbers in a view sheet.
3. **No theme toggle in v1.** One paper theme, high contrast, and `prefers-color-scheme` is
   respected only by not fighting it. A dark theme later is a token change, not a rewrite, *if*
   rule 1 holds.
4. **Code blocks:** `--paper` ground with a 1 px `--rule` stripe at the left, not a dark panel.
   Every highlight colour is checked for at least 4.5:1 against the block background, by the same
   kind of assertion the soundboard suite already makes about its palette. A token that cannot be
   read is not a token.
5. **Grid: single column, 68-character measure, flush left, ragged right.** One column is right
   for text a student reads on a phone. `align-grid` is the skill to use if this ever becomes a
   modular-grid page.
6. **No decorative imagery in v1.** No logos, no flags, no mascot art, nothing that needs a
   licence check, and nothing that adds a request a 15-year-old on a phone pays for. A language's
   page is text and code, or it is an index entry.

Done when: `views.css` and `base.css` contain zero hex codes, the page asks for zero font files
over the network, and a 375 px screenshot of `#/l/python` could not be mistaken for `localai`,
`codewithai`, or the home page.

### 6.5 Difficulty scale (reader-facing, so it must be plain)

| Value | Label shown | Meaning to a student |
|---|---|---|
| 1 | Easy to start | You can write something real in an afternoon |
| 2 | Gentle | New words, but the rules stay small |
| 3 | Steady | You must learn a system before you get results |
| 4 | Sharp | The computer argues with you a lot at first |
| 5 | Steep | Expect weeks before your own project works |

Scale is assigned by the owner, not by a model. Propose in M0, freeze before M2.

---

## 7. Information architecture

| Route | View | Content |
|---|---|---|
| `#/` | Index | Hero, then two blocks: "Start here" (Core 8 as cards with difficulty + first task), "Reference" (Extended 14 as a compact list). Filter chips by `category` |
| `#/l/<slug>` | Language | Template in §9.1 |
| `#/glossary/<term-id>` | Glossary | Every term in `data/glossary.js`, A–Z, with the language pages that use it. The deep-link form is what hover cards and the projects site point at |

Two views are specified but not built in v1, by decision 11: `#/compare/<a>/<b>`, a side-by-side
of the §6.2 fields for two languages that never invents a difference, and the "I am not sure"
card that asks three questions and names one language. Both are v1.1 (§11.1).

Cross-links:
- `tools/index.html` gains a `.trow` entry for the site (same markup as the other tool rows).
- Every language page footer links to matching project ideas from `tools/build/projects.md`
  where one exists, so the two sites feed each other.
- No link back to `languages.md` from any public page.
- The sibling projects site advertises its own Tab 3 card for languages. Pointing that card here
  is that project's change to make, under §3.2 and its own plan. This plan does not touch it.

### 7.1 What the hash router costs, and what is done about it

Decision 12 buys the simplest possible static site: one HTML file, no generator, no build step.
It costs three things, and each has a cheap answer except the third.

- **A crawler sees one document.** Cloudflare serves `index.html` for every fragment, so the 22
  language descriptions are invisible until JavaScript runs. Answer: the shell carries real
  static content, the index view written as HTML rather than rendered, so there is always a
  crawlable page of substance behind the app. `data.test.mjs` keeps that fallback in step with
  the records, because a fallback nobody regenerates is a lie waiting to happen.
- **Titles and metadata are set in JavaScript.** `document.title` and the description meta update
  per view, so a browser tab reads "Python - Languages". That is enough for a student deciding
  which of their own 20 open tabs to return to.
- **A shared link previews as the site, not the language.** `og:title` is read from the served
  HTML, and the fragment never reaches the crawler, so `#/l/python` pasted into a message card
  shows the shell's title. Accepted for v1. The mitigation is that every page offers **Copy
  link**, so what a student shares is at least a correct URL. Per-language static files would fix
  this, and the cost of that fix is deferred, not denied: the router keeps one view function per
  page, so the generator that would emit 22 files is additive work in v1.1, not a rewrite.

---

## 8. Copy standard

Governs every reader-facing string, in both languages of the chrome (§3.8). Inherited from
`localai/style-guide.md` and `tools/codewithai/style-guide.md`; both are enforced by tests in
their own folders, and this site gets the same tests.

### 8.1 Reading level

| Text | FK grade | Avg words / sentence | Longest sentence |
|---|---|---|---|
| Page prose (`reads`, demo notes, index) | ≤ 6.0 | ≤ 14 | 25 words, hard |
| Glossary `short` | ≤ 6.0 | ≤ 12 | 20 words |
| Glossary `full` | ≤ 7.0 overall, no entry > 8.0 | ≤ 16 | 25 words |

The English column of `chrome.js` is page prose and is tested as such. The Chinese column is not
FK-scored: Flesch-Kincaid measures English, so a Chinese string is reviewed by the owner for
length and plainness instead. Chinese is never a translation of a sentence the tests rejected.

### 8.2 Hard rules

- No em dash. No middot inside a sentence. No semicolon in reader prose.
- No idioms, no jokes, no rhetorical questions, no reveals, no "fun fact".
- Never *simply*, *just*, *obviously*, *of course*.
- Imperative for actions, one action per numbered line. Action first, reason second.
- Expand every abbreviation at first use. Never define a term with a term that is not yet in
  the glossary.
- 3–6 sentences per explanatory block, then a heading or a list.
- Simplify the wording, never the number. A real figure stays exact and gets a short sentence
  around it.
- One word per thing. Controlled vocabulary table in `test/lib/vocabulary.mjs`, seeded from the
  codewithai one: *page* (not site/document), *code* (not program/script, unless naming a
  file), *run* (not execute/launch), *tool that checks your code as you type* (not compiler,
  until the glossary defines it), *word processor*, *phone*, *server*.
- Headers are plain noun phrases. A term never appears for the first time in a header.

---

## 9. The language page

### 9.1 Section order (fixed)

1. **Name and kind** — one line: "Python. A general language for many jobs."
2. **Reads like English** — `reads`, ≤ 3 sentences.
3. **What people make with it** — `makes`, as a list of noun phrases.
4. **Example** — L1 demo widget (§9.2).
5. **Where it came from** — `history`, dated, ≤ 4 sentences.
6. **How many people use it** — `stats` with as-of dates, footnote markers.
7. **What is hard about it** — `difficulty` plus one honest paragraph.
8. **Before you start** — `prereqs` as links, `needs_install` in plain words.
9. **Words used on this page** — inline glossary terms, hover cards.
10. **Go further** — `links` (≤ 3, validated) and `next` languages.

### 9.2 The L1 demo contract

Each page holds exactly one example. Contract:

- 6–14 lines, one visible idea, real and idiomatic code. No placeholder names like `foo`.
- Highlighted in the browser by `js/highlight.js`: a tokenizer of about 250 lines over comments,
  strings, numbers, and per-language keyword lists. No highlighter library, no new dependency.
  **Escape the snippet, then wrap it.** The function signature is `highlight(code, lang)` and it
  returns escaped HTML: tokenise raw text and the 22 code samples become an injection surface,
  because a snippet contains `<`, `&`, and `</script>` on purpose, in the HTML and JavaScript
  pages above all. It must be a pure string-to-string function so `highlight.test.mjs` can run it
  in plain Node with no DOM. Unmatched quotes and unclosed comments degrade to plain text, never
  to a swallowed page.
- A **Copy** button. `navigator.clipboard.writeText` with a `document.execCommand` fallback,
  and a visible "Copied" state that is `aria-live` polite.
- An **Expected output** panel, opened by the student or shown as a static block, always
  labelled **"Output from an earlier run"** so nobody reads it as live.
- A **Run it for real** link out to an official playground where one exists
  (Rust Playground, Go Play, Scratch, the TypeScript editor), otherwise nothing. L1 never
  implies the site can execute code.
- No iframe embeds of third-party editors in v1 (CodePen, JSFiddle, StackBlitz). The reason is
  real rather than impressive: an embed runs someone else's JavaScript on our origin, lets them
  analytics our student's visit, and can change what it does with no notice from us. **Note for
  the build:** this repo carries no `Content-Security-Policy` today (no `_headers` file, no
  `wrangler.toml`, nothing in the served HTML), so nothing here would be *blocked*. An earlier
  line of this plan claimed such embeds "break the CSP", which was a claim about a protection the
  site does not have. If an editor embed is ever wanted, a real CSP should land first, and this
  bullet should be re-read then.

Per-language example assignment for all 22 records is produced as a table in M2 step 1 and
reviewed before any page HTML is written. The source document's demo column is the starting
sketch; §1.2 C5/C6 lists where it does not survive.

### 9.3 Deferred: L2 and L3

L2 (pre-computed interaction: sliders and toggles that change shown output) and L3 (real
in-browser execution via WASM, e.g. Pyodide) are out of scope for v1 by decision 3. L3 is a
separate project: it adds megabytes of payload, a worker, and a maintenance obligation. Do not
scope-creep it into a language page.

---

## 10. Glossary

### 10.1 Mechanism and data shape

- Hover-card mechanism ported from `localai/js/tabs/glossary.js`: one `initGlossary()` call wires
  document-level delegated listeners, renders the glossary page, and exposes `focusTerm()` so a
  deep link opens the right entry on load. The module does no DOM access at import time, which is
  what keeps it Node-testable (`localai/test/ui.test.mjs:10-13` asserts exactly that property).
  Keep it.
- Two surfaces, one data file. `js/data/glossary.js` feeds this site's glossary page and every
  hover card, and is the module the projects site links into at `#/glossary/<term-id>`.
- In-page markup for a term is
  `<a class="gloss" data-term="compiler" href="#/glossary/compiler">`. Keep ids kebab-case and
  stable: they are linkable URLs, so renaming one breaks a link somewhere else.
- Record shape, copied from `localai/js/data/glossary.js:32-42`:
  `{ id, term, short, full, links: [{ source, title, url }] }`
  - `short`: 1 to 2 sentences, shown in the hover card, must stand alone mid-sentence.
  - `full`: the page entry, 2 to 4 sentences, says why the reader cares.
  - `links`: the "Learn more" row. Every URL checked live; every `title` is the article's
    canonical name **after** redirects, so the label matches the page the reader lands on.
- No extra fields in v1. `group`, which codewithai adds for a 666-line glossary, comes in only if
  this one grows past about 40 terms.
- Seed list, from the undefined terms in §1.2 T4 plus what the Core pages need (≈ 30): *browser,
  server, compiler, interpreter, bytecode, runtime, syntax, variable, function, loop, condition,
  type, string, memory, library, framework, package manager, open source, markup language, query
  language, script, terminal, prompt, output, debug, static site, responsive, null, object,
  class*. A page may not use a term that is missing here; `data.test.mjs` checks it.

### 10.2 English first, Chinese added last

Glossary **entry prose** is content, so it follows the same rule as the 22 records: English in
v1, Chinese in v1.1, per decision 8. What v1 does translate is the glossary's own chrome, its
heading, its search or filter labels, and the hover-card affordance text, from `chrome.js`. The
English term itself is never translated away, which is the point of codewithai's pattern: a
student who learns only 仓库 cannot read the button in GitHub that says "repository". The same
holds here for *compile*, *deploy*, *pull request*.

### 10.3 What v1 does ship for Chinese

The switcher ships; record prose does not. The split is the **chrome**, about 40 fixed strings:
view names, filter chip labels, section headings, button labels, the copied and
"earlier run" notices, empty and error states, and the footnote lead-in. `js/data/chrome.js`
holds one entry per key, `{ key: { en, zh } }`, and `js/i18n.js` resolves the active language
from a `lang` key in `localStorage` with the URL parameter `?lang=` winning for a single visit.
The default is English, and the site never guesses from `navigator.language` — a wrong guess is
harder to notice than a wrong label.

Three rules make the mechanism honest:

1. **No partial record translation.** A language page in Chinese mode shows Chinese headings
   around English body text, and says so once at the top: "Descriptions are English for now."
   The student is never left to work out which is which.
2. **Every `zh` string is owner-approved before merge**, like English copy. No machine-
   translated string ships, because a plausible wrong term (*编译* for a tool that checks your
   code as you type) teaches the wrong word with the authority of the site.
3. **Key sets are identical**, enforced by `chrome.test.mjs`. A missing key falls back to
   English rather than rendering `undefined`, and the test still fails, so the fallback can
   never hide a gap. `data.test.mjs` asserts the converse too: no record field carries Chinese
   in v1, so nobody mistakes the mechanism for content that was never reviewed.

---

## 11. Plan of work

Effort in half-day units of focused agent+owner time. Total: 10.5 working days without
parallelism, 9 with the M4 batch split across three fresh agents. Adding the two v1.1 items
(§11.1) costs about 2 days on top of this, not 2 days instead of something.

| M | Deliverable | Steps | Done when | Cost |
|---|---|---|---|---|
| **M0** | Decisions frozen | 1. Draft the 8 Core difficulty notes for owner approval (§3.9, §6.3). 2. Add a `languages_site:` block to `specs/state.yaml` mirroring `projects_site:`, recording the eleven owner decisions in §3. 3. Confirm the 22-record catalogue against `languages.md` second edition | `specs/state.yaml` records the decisions. §3 has no open item. Core notes approved or explicitly waived | 0.5 d |
| **M1** | Skeleton | Tree from §6.1, tokens, base styles, hash router, index with static fallback, `package.json`, one placeholder record | `wrangler pages dev` serves the index and one page; `npm test` runs (green on the placeholder) | 1 d |
| **M2** | Content data | 1. Write the 22-record table: category, makes, difficulty, prereqs, demo choice. 2. Owner review, Core 8 as one pass, then Extended in three batches of four to five (§3.13). 3. Fill records fully, including `history` and `stats` from `languages.md` second edition | `data.test.mjs` passes on all 22 records. No empty fields, no unlinked numbers, no draft left unreviewed | 2 d |
| **M3** | Core 8 pages | Demo widget, page template, 8 pages, glossary seed, link-out buttons | Z1–Z4 green for Core. Reading-level tests pass with zero exceptions | 2.5 d |
| **M4** | Extended 14 pages | Same template, batched 4–5 at a time, each batch validated before the next | All 22 pages pass every test | 2 d |
| **M5** | Integration | Index filters, nav row in `tools/index.html`, header language switcher wired to `chrome.js`, cross-links to project ideas **only where the target exists** (§3.14) | A student task walkthrough passes end to end (Z5). `chrome.test.mjs` green; switching language changes every chrome string and no record prose | 1 d |
| **M6** | Ship | Accessibility pass (keyboard, contrast, reduced motion, screen-reader order), mobile pass, link re-validation, `npm test` + `wrangler pages dev` clean, deploy, `smoke-test` the live URL, update `specs/state.yaml` status | §12 verification log written to `specs/VERIFICATION_LANGUAGES_LATEST.md` | 1.5 d |

Sequence is strict: no page HTML before M2 passes owner review. The cost of rewriting 22 pages
is the cost of one bad review round.

**Branches and PRs (decision 15).** Five pull requests, one per milestone pair: `M0+M1` skeleton,
`M2` content data, `M3` Core pages, `M4` Extended pages, `M5+M6` integration and ship. Each
merges with `npm test` green and its own §12 evidence, so any one of them can be reverted without
losing the work before it. Conventional Commits throughout: `feat(languages):`, `content(languages):`,
`test(languages):`.

### 11.1 Deferred to v1.1 (decision 11)

| Item | Why not v1 |
|---|---|
| Compare view | Needs stable record fields and a reviewer to judge which differences are worth printing. Built on shifting data it becomes a table of noise |
| "I am not sure" chooser | Five honest questions are content work, not code. It reads the approved difficulty notes, so it waits for them |
| Chinese record prose | Needs 22 × 6 fields of owner-reviewed translation. The mechanism in v1 keeps this a content task, not a rewrite |
| Extended 14 difficulty notes | Same reason as §3.9: a rough note is worse than none, and 14 more are not cheap |

---

## 12. Verification

**Automated (`npm test` in `tools/languages/`):**

| File | Asserts |
|---|---|
| `readability.test.mjs` | Every reader string under §8.1 caps. Zero sentences > 25 words. Zero em dashes, zero middots in sentences, zero banned phrases |
| `vocabulary.test.mjs` | No term used where the controlled vocabulary has a canonical word. No glossary term defined with an undefined term |
| `links.test.mjs` | Every URL in `languages.js`, `data/glossary.js`, `sources.js` returns 200 and carries a label that matches the page after redirects. Six hosts are exempt in an allowlist with a comment each, because they answer a cookie-less client with 403 or a sign-in redirect while serving a browser normally: `www.w3.org`, `www.mathworks.com`, `www.ibm.com/docs`, `dl.acm.org`, `realpython.com`, `developer.android.com` |
| `data.test.mjs` | Schema validity per record. `tier` counts match §5. Each Core page has exactly one demo. `stats` values all resolve to `sources.js`. `prereqs` and `next` point at real ids. No record field contains Chinese in v1. Every in-site `href` resolves to a real record or a file that exists in the repo (decision 14). The static index fallback in `index.html` names the same 22 records as `languages.js` |
| `chrome.test.mjs` | `en` and `zh` key sets are identical. No `zh` value is pure ASCII, and no `en` value contains a CJK character. Every key is used by exactly one place in `views.js`, `i18n.js`, or `demo.js`, so no dead label survives |
| `highlight.test.mjs` | `highlight(code, lang)` escapes `<`, `>`, `&`, and `"` before it wraps anything. A `</script>` inside a snippet renders as text. Unclosed comment, unclosed string, and unknown language all degrade to escaped plain text |

Tests run in plain Node, no browser, no network in the default run (link checks are a separate
`npm run test:links` so a flaky third-party host cannot red the suite in CI).

**Manual (M6, logged with date and pass/fail):**

| # | Check |
|---|---|
| V1 | Cold start: clear cache, load the index on a phone, read it aloud, no sentence needs a second pass |
| V2 | Choose a first language as a stranger, using only the index. Does the page answer "start here?" |
| V3 | Keyboard only: tab order, focus visible, every control reachable, glossary cards dismissible |
| V4 | Copy button in Safari, Firefox, Chrome. "Copied" announced to a screen reader |
| V5 | Reduced-motion setting respected, no animation depends on hover |
| V6 | 375 px, 768 px, 1440 px, no horizontal scroll, code blocks scroll internally |
| V7 | One random page per deploy: numbers match the source, dates are visible |
| V8 | Switch to Chinese as a reader who cannot read English: reach the index, one language page, and the glossary without touching English-only controls. Ask a Chinese-reading reviewer, not the model that wrote the strings |

**Gates:** CI green before merge; `wrangler pages dev` boots clean; the 22-page link check runs
the same day as the deploy, not the week before.

---

## 13. Appendix A — fact corrections

Verified 2026-10-26 against the sources now listed in `languages.md`. **Status:** every row below
was applied to the source document in place on 2026-10-26, so this appendix is the audit trail,
not a work list. A `⚠` means the first edition's claim is wrong, stale, or unsourceable and must
not ship as written. Where the figure differs from the one in the first draft of this plan, the
plan was wrong: trust the row below, which cites the page it came from.

| Claim in source | Status | Correct text to use | Source |
|---|---|---|---|
| WordPress "≈ 43 % of the web"; PHP "powers a huge share" | ⚠ stale + mis-scoped | WordPress runs on **39.6 % of all websites**, which is **58.3 % of sites with a known CMS**, as of October 2026, and the share is falling from 43-44 % in 2025. PHP is used by **69.2 % of all websites whose server-side language is known** | w3techs.com/technologies/details/cm-wordpress and /details/pl-php (retrieved 2026-10-26) |
| Every survey figure in §4 and in the source's Survey column | ✓ verified, with a licence condition | Stack Overflow publishes its 2026 data page under **ODbL 1.0**, so republishing the numbers is permitted and attribution is required, not optional. `sources.js` carries the licence in its `note` field for this reason | survey.stackoverflow.co/2026/technology/data, retrieved 2026-10-26 |
| WordPress share, if the build ever reads the survey for it | ⚠ two-truths trap | Two numbers are true at once and must not be mixed: the survey finds WordPress used by **13.3 %** of respondents naming a web framework (n = 10,281), while W3Techs finds it on **39.6 % of all websites**. The survey measures developers, W3Techs measures sites. Cite W3Techs for any sentence about how much of the web runs on PHP or WordPress, and never the survey | survey.stackoverflow.co/2026/technology/data (web frameworks table); w3techs.com/technologies/details/cm-wordpress |
| Rust "most admired 8+ years running" | ⚠ stale, and the metric is wrong | The survey reports an **admired share** (*have used and want to keep using*), not a vote. In 2026 Rust is highest **among the twenty most used** at **67.4 %**, while Elm (94.1 %) and Odin (82.4 %) score higher on far smaller bases. Write the qualified sentence or write nothing | survey.stackoverflow.co/2026/technology/data; 2025 edition put Rust at 72 % for a tenth year |
| "JavaScript is the single most in-demand language for web work" | ⚠ unsourced superlative | JavaScript was the **most used** language in the 2026 survey, **62.0 %**, for the twelfth year running | survey.stackoverflow.co/2026/technology |
| SQL implied niche | ⚠ understated | SQL was **second** in 2026 at **58.4 %**, passing HTML/CSS for the first time | survey.stackoverflow.co/2026 |
| Bash/Shell implied minor | ⚠ understated | Bash/Shell was **fifth** in 2026 at **51.3 %** | survey.stackoverflow.co/2026 |
| Python "the default first language in most AP CS / IB CS courses today" | ⚠ half wrong | AP Computer Science A uses **Java**. AP Computer Science Principles is exam-board language-neutral. IB does not fix one language. Say: "Many introductory courses use Python." | `apcentral.collegeboard.org/courses/ap-computer-science-a`; ib.org DP Computer Science guide |
| AP Computer Science A "has used Java since 2003" | ⚠ unverified year | Keep "AP Computer Science A uses Java". Add: the exam is now **fully digital in the Bluebook app**, and it gives students a **Java Quick Reference** sheet | `apcentral.collegeboard.org/courses/ap-computer-science-a` (retrieved 2026-10-26); the course description was revised for **Fall 2025** |
| C "the ancestor of C++, Java, C#, JavaScript, and many more" | ~ defensible, soften | "Many later languages, including C++, Java, and C#, take their syntax from C" | — |
| C++ "1979–85" | ~ right years, wrong framing | "Stroustrup began work in 1979 on a version of C he called *C with Classes*. It was renamed C++ in late 1983, and first released in 1985" | stroustrup.com/hopl2.pdf ("A History of C++: 1979–1991") |
| C# "answer to Java" | ⚠ opinion | "Designed at Microsoft by Anders Hejlsberg, first released in 2000, runs on .NET" | learn.microsoft.com C# guide |
| Kotlin "Google's preferred language for Android" | ~ true, incomplete | "Created at JetBrains in 2011. Google made it the preferred Android language in 2019" | developer.android.com Kotlin page |
| TypeScript "used by Microsoft, Google, Slack" | ~ true, weak | Replace with: "JavaScript with types. A type is a label for what kind of value a variable holds" | typescriptlang.org handbook |
| Scratch "embed the editor in an iframe" | ⚠ not supported as written | Do not embed. "Scratch runs in the browser at scratch.mit.edu. Open a project in a new tab" | scratch.mit.edu help |
| JavaScript "renamed from LiveScript as a marketing nod to Java (they are unrelated)" | ~ true, keep | Keep, drop the aside about "marketing nod" being an explanation | MDN history |
| Ruby "GitHub, Shopify, Airbnb early days" | ⚠ needs citation or hedge | "Built with Ruby on Rails: GitHub and Shopify both run on it" | rubyonrails.org/community |
| Rust "created by Graydon Hoare at Mozilla, first stable 2015" | ✓ correct | keep | doc.rust-lang.org/book |
| Go "Pike, Thompson, Griesemer at Google, 2009" | ✓ correct | keep | go.dev |
| R "Ihaka and Gentleman, Auckland, 1993" | ✓ correct (first public release 1995) | add the 1995 release date | cran.r-project.org |
| MATLAB "Cleve Moler, 1970s; commercial via MathWorks" | ✓ correct (1970s; MathWorks founded 1984) | keep with the 1984 date | mathworks.com |
| Julia "Bezanson et al., MIT, 2012" | ✓ correct | keep | julialang.org |
| Bash "Originates from…" | ⚠ the file ends mid-sentence | Write from scratch. Verified wording: "Brian Fox wrote Bash for the GNU Project. The first public release was in 1989. Its name means *Bourne Again SHell*, a pun on Stephen Bourne, who wrote the shell it replaced. Chet Ramey has maintained it since 1992." The Bourne shell shipped with Version 7 Unix (1978–79; sources disagree on the year, so cite one and date it), not 1977, and it replaced Ken Thompson's 1971 shell | `gnu.org/software/bash` (manual preface), `tiswww.case.edu/php/chet/bash/rose94.pdf` |

## 14. Appendix B — reference-link audit

### 14.1 First edition, 38 unique URLs

All 38 unique links in the first-edition table checked 2026-10-26 with a browser user agent,
following redirects. 30 fine, 1 bot-blocked (last row). The rest, with what the page must do
instead:

| Link in source | Result | Action |
|---|---|---|
| `developer.android.com/courses/pathways/kotlin` | **404** | Replace with `developer.android.com/courses/android-basics-compose/course` (verified 200, 2026-10-26) |
| `en.scratch-wiki.info/wiki/Scratch_Educator_Guide` | **404** | Replace with `scratch.mit.edu/educators`, which 301s to `www.scratchfoundation.org/learn/for-educators`. Store the final URL |
| `posit.co/docs/` | **404** | Replace with `docs.posit.co` (verified 200) |
| `apps.apple.com/us/app/swift-playgrounds/id908519498` | 200, but redirects to `apps.apple.com/cn/iphone/today` | Not a dead link — the App Store geo-redirects the deep link by client region. Verify this one by hand from the target region in M2; automated checks will always look wrong. `?l=en` does not help |
| `mode.com/sql-tutorial/` | 301 → `thoughtspot.com/sql-tutorial` | Label as ThoughtSpot, not Mode |
| `laravel.com/docs` | 301 → `laravel.com/framework/docs` | Store the final URL |
| `en.cppreference.com/w/` | 301 → `en.cppreference.com/` | Store the final URL |
| `realpython.com` | 403 to bots | Fine in a browser. Exempt the host in `links.test.mjs` with a comment, or the suite will flap |

Also required by the plan: three new links that the source table omits and Core pages need,
all verified 200 on 2026-10-26 —
`apcentral.collegeboard.org/courses/ap-computer-science-a` (AP CSA is Java),
`web.dev/learn` (curated, current, no login),
`rust-lang.org/learn` (The Book plus Rustlings). Selected in M2 with the same audit.

### 14.2 Second edition sources

Every URL in the `languages.md` source list `[S1]`-`[S27]` was re-checked 2026-10-26 with the same
method, after the rewrite, because a plan that cites a dead link teaches a student that citations
are decoration. Six were replaced:

| First-round citation | Result | Now cites |
|---|---|---|
| `pythonhistory.readthedocs.io/.../design_and_history_faq.html` | 404 | `docs.python.org/3/faq/general.html`, whose "Why is it called Python?" entry carries the Monty Python statement verbatim |
| `ibmsystemsjournal.org/pdf_files/Chamberlin77.pdf` | 000, host does not resolve. A DOI written from memory for the same paper also failed: `10.1145/320473.320475` is not registered | `doi.org/10.1145/800296.811515` (Chamberlin and Boyce, "SEQUEL", 1976 ACM SIGFIDET, confirmed against the CrossRef registry), plus `en.wikipedia.org/wiki/SQL` for the early-1970s dating |
| `tech-insider.org/java/research/1996/0123.html` | 200 on the root only; the deep link is gone | `en.wikipedia.org/wiki/Java_version_history` |
| `en.scratch-wiki.info/wiki/How_to_Embed_...` | 000 from this network, 404 earlier | `scratch.mit.edu/projects/101283090/embed`, verified 200, which demonstrates the player form that the claim depends on |
| `2012.jsconf.eu/speaker/.../introducing-typescript.html` | 404 | dropped; `devblogs.microsoft.com/typescript/ten-years-of-typescript/` alone dates the 2012 preview |
| `bell-labs.com/usr/dmr/www/chist.html` | 301 to nokia.com/bell-labs | store the final URL |

Two lessons for `links.test.mjs`, both already reflected in §12: a `000` is a network failure and
not evidence that a link is dead, and a `200` whose `url_effective` is a site root is a silent
deep-link loss. Record the effective URL, never just the status.

A third lesson, and the uncomfortable one: **a remembered DOI is not a citation.** One row above
was fabricated by pattern-matching ACM's numbering rather than looked up, and it resolved to
nothing. `api.crossref.org/works/<doi>` answers a scripted client with the registrant, title, and
year and is the cheapest way to prove a paper exists. Any identifier of that shape in either file
gets the same check before it ships.

---

## 15. What changed between the two editions of this plan, and to the source

Kept as the audit trail for the owner's instruction to overwrite anything inaccurate. The first
draft of the plan and the first edition of `languages.md` were both written without web access.

**Corrections to the plan's own numbers.**

| Plan claim, first draft | Verified position | Basis |
|---|---|---|
| PHP "three quarters of websites with a known server-side language", and "76 to 77 %" in working notes | **69.2 %** as of October 2026 | w3techs.com/technologies/details/pl-php, fetched live |
| WordPress "43 % of the web" carried forward as roughly right | 39.6 % of all websites, 58.3 % of sites with a known CMS, and falling | w3techs.com/technologies/details/cm-wordpress |
| Rust "most admired 10 years running, 72 %" (2025 figures) | 2026 admired share **67.4 %**, and Elm 94.1 / Odin 82.4 score higher on small bases | survey.stackoverflow.co/2026/technology/data |
| The Bourne shell "shipped with Version 7 Unix in 1977" | 1978 or 1979; the sources disagree, so the doc says so instead of picking | Ramey, "Introduction to the History of Shell Programming" |
| 21 records (Core 8 + Extended 13) | **22** records (Core 8 + Extended 14) once PowerShell was added by owner decision | plan §5, `languages.md` second edition |
| The source table has "36" reference links | 38 unique URLs | `grep` for `https?://` in the source file, then `sort -u` |
| The first edition has "60+" em dashes | 4 em dashes, 2 en dashes; 149 prose sentences, mean FK 8.8 over 119 prose cells, 72 above 6.0 | measured with the same syllable counter the site tests will use |
| The first edition uses middots as prose decoration | all 19 middots sit in the link column, where they are legal data separators | same script |
| The first edition asks rhetorical questions | it asks none; that defect line is deleted | same script |

**Structure of §3 replaced.** Four items were open (`DECISION REQUIRED`) in the first draft. The
owner answered all four on 2026-10-26: location is `tools/languages/` and `tools/build/` hosts two
unrelated projects, the Core/Extended split stands, PowerShell joins the catalogue, and this site
owns the glossary. The first draft also proposed editing the sibling project site's artifacts to
repoint them; the owner ruled those files out of this project's authority, so §3.2 and §7 now say
explicitly that this plan does not touch them.

**Third pass, same day (build readiness).** Five more decisions were taken, so §3 now holds
eleven and none is open: Chinese ships as chrome only with an owner gate on every string (§3.8,
§10.3); difficulty notes are drafted here and approved line by line, Core only (§3.9); the
tokenizer is hand-rolled (§3.10, matching what §9.2 already said); compare and the chooser move
to v1.1 (§3.11, §11.1); and M5 gains the switcher while losing two views, so the plan is 9 days,
not 12. Two tests were added, `chrome.test.mjs` and `highlight.test.mjs`, and one manual check,
V8, which needs a human who reads Chinese.

**Fourth pass, same day.** Decisions 12 to 15 closed the last build blockers: hash router with a
real static index fallback, Core-first review in four passes, conditional cross-links, and five
PRs, one per milestone. §7.1 records what the router costs, and the honest part is the social
preview: a `#/l/python` link cannot show a per-language card, so the answer is a correct URL plus
**Copy link** on every page, with the generator deferred and not denied. Three assertions went
into `data.test.mjs` for the same reason: hrefs must resolve, and the fallback must name the same
22 records the data does.

**`languages.md` rewritten in place, second edition.** 20 unchecked rows became 22 checked ones:
the truncated Bash row finished from GNU project sources, MATLAB and Julia split, PowerShell
added, the misleading `#` column deleted, a Tier column and a dated Survey column added, 6 bad
citations replaced (§14.2), a `Sources` section with retrieval dates added where there had been
none, and every sentence addressed to the site owner removed. The first edition's plain-language
descriptions and demo ideas mostly survived. Its numbers needed 13 corrections and 8 of its 38
links did not land where the label said, which is what you would expect of a document written
with no way to check either.

**Not done, on purpose.** The source document is still written above a student's reading level
(mean FK 8.8 against a §8.1 cap of 6.0) because it is internal research. Reader prose is M2-M3
work against the §8 standard. Fixing the file early buys the build a better input; fixing it now
would buy a second document to maintain.

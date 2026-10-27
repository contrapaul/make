# HANDOFF — Languages site

Read `tools/build/languageplan.md` for the why. This file is the where things stand and what
is left. Written 2026-10-27 at commit `53b1554`.

## What this is

A static, dependency-free sub-site at `tools/languages/` on `make.contrapaul.com`. Twenty-two
programming-language records in two tiers (Core 8, Extended 14), one page per language, a
glossary, and an English/Chinese switcher. Audience: a high-school student alone with the page,
no teacher in the room. Source of facts: `tools/build/languages.md` (second edition).

## State

| Milestone | State |
|---|---|
| M0 decisions frozen | **Done.** Seventeen decisions in plan §3. The eight Core difficulty ratings were accepted by the owner "for now" on 2026-10-26 |
| M1 skeleton | **Done and committed.** Shell, router, i18n, hand-rolled highlighter, design tokens, six test files |
| M2 content data | **Done and committed.** All 22 records, every field filled, every number sourced |
| M3 Core 8 pages | **Not started.** Two test gates are red and belong to M3 and M4 (see Red below) |
| M4 Extended 14 pages | Not started |
| M5 integration | Not started |
| M6 ship | Not started. Nothing is deployed. `origin/feature/languages-site` exists; no PR opened |

## Commands

```sh
cd /Users/paul/Documents/GitHub/languages-site/tools/languages
node --test test/*.test.mjs        # the whole suite, no network, ~1 s
node --test test/highlight.test.mjs
LINKS=1 node --test test/links.test.mjs   # live URL check; run the day you deploy
python3 -m http.server 8899        # then open http://localhost:8899/
```

The worktree has no `node_modules`, so `npx wrangler pages dev` fails there. Run wrangler from
the main checkout (`/Users/paul/Documents/GitHub/make`, which has it), or use the plain HTTP
server above — the site is static and needs no functions for these pages.

Root `npm test` runs the soundboard suite only. It does **not** include this site's tests, and
the repo has no CI. Nothing will catch a regression here automatically. Say so in any review.

## Red: two gates, both by design

`node --test test/*.test.mjs` → 34 pass, 2 fail, 2 skipped (the skips are the `LINKS=1` live
check and one `run_it` label case). The two failures are real and are the first work of M3/M4.

1. **`record prose reads at grade six or below`** (M3) — 19 record strings score above the
   Flesch-Kincaid 6.0 cap. They are all short factual notes I wrote, mostly `history.note`.
   Fix = rewrite with short clauses, one idea each. Do not raise the cap and do not exempt more
   strings: the test already exempts labels (any string with no sentence-ending punctuation and
   four words or fewer, such as `"General purpose"`), and that exemption is documented in the
   test file. Raising the bar to pass is the one move that is forbidden.
2. **`terms exist in the glossary`** (M4) — the 22 records name 35 distinct terms; 4 of them have
   entries (variable, function, string, type). Missing: loop, event, tag, element, selector, rule, cascade, compiler, list, query,
   table, row, class, object, script, pointer, array, memory, garbage collection, goroutine,
   channel, matrix, null, plot, server, pipeline, data frame, block, ownership, borrow, optional.
   Write them to plan §10.1's rules: `short` under 12 words, `full` under grade 7.0, never define
   a term with a term that has no entry.

## Traps I already fell into

- **An unescaped double quote inside a JS string does not always break the parse.** One silently
  folded the string into arithmetic and produced `NaN`. `node --check` passes it. `data.test.mjs`
  now asserts every `demo.code`, `output`, `note`, and `title` is a string. Keep that assertion.
- **`difficulty` is `null` on all 14 Extended records** (decision 9: a missing note must not read
  as "hard"). Anything reading `.difficulty.value` must guard. Four files already needed this.
- **`run_it` has no citation label** by design; `links.test.mjs` excludes it from the label rules
  but still requires `https`. `views.js` reads its button text from `chrome.js`.
- **One URL, one name.** A link label must not disagree with the `sources.js` label for the same
  URL. `links.test.mjs` enforces it. Citation prose goes in `sources[].note`, never in `label`.
- **Never write the DOM shape `box.append(el(...) ? ... : ...).lastChild.append(...)`.** It
  parses, passes `node --check`, and throws in the browser. Build the child, then append it.
- **Six hosts reject a scripted client** (`www.w3.org`, `www.mathworks.com`, `www.ibm.com`,
  `dl.acm.org`, `realpython.com`, `developer.android.com`). They are allowlisted in
  `links.test.mjs` with a comment each. A 403 from them is not a dead link. `curl -L -A Mozilla`
  and read `url_effective`: a 200 on a site root means the deep link is gone.
- **`developer.mozilla.org` is unreachable from this network** (curl `000`). Do not chase it.
- **Do not delegate large authoring tasks.** Five of six delegated workers died on the harness's
  five-minute no-output watchdog with zero files and ~1.8 M wasted input tokens. Write files
  directly, a few at a time.
- **`git commit` is blocked while the main checkout sits on `main`.** The bigpowers hook runs
  `git rev-parse` in its own directory, which is the primary checkout, not the worktree. Move
  `/Users/paul/Documents/GitHub/make` to any other branch and commits work.

## Rules that survive any refactor

- A demo output is printed **only with its source named**: run here (say what ran), quoted from
  an official source (say which), or written by hand and labelled as such (plan §9.2). The page
  runs nothing in the browser.
- No invented URL, in code or in a commit message. Verify with `curl -L -A Mozilla`.
- Every number carries `stats[].source` pointing at a key in `js/data/sources.js`. The Stack
  Overflow base is n = 14,099 and its data page is ODbL 1.0, so the attribution stays visible.
- Rust is "highest admired of the twenty most used (67.4 %)", never "most admired" plain.
- Site prose: grade 6.0, no banned words (`simply`, `just`, `obvious`, `of course`, `page` for
  website, `run` for execute, `list` for array), no em dash, no middot inside a sentence.
- Chinese strings in `js/data/chrome.js` are **signed off** (2026-10-27, by a reader who reads
  Chinese at the owner's colleague). That is plan §12 V8 for the 42 chrome keys. Re-run V8 for any
  new key. Record prose stays English in v1 (decision 8) and `content.lang_note` says so.
- `tools/build/` hosts a second, unrelated project (the 150-project site). Never edit its
  artifacts from this work, including the link it advertises to `/tools/build/languages`, which
  404s. That project fixes its own link (owner ruling, 2026-10-27).
- Colour only in `css/tokens.css`. No `@import` of another sub-site's sheet. No font files.

## Git

Branch `feature/languages-site`, worktree `/Users/paul/Documents/GitHub/languages-site`, pushed
to `https://github.com/contrapaul/make.git`. Six commits: `b48871d` second-edition source,
`4c126d5` ink-on-paper tokens, `b6ba0a3` text face and blueprint ruling, `d2bb9e3` M0 notes and
state block, `1cac51b` M1 skeleton and M2 catalogue, `53b1554` citation labels and Rust date.

The branch is four ahead and four behind `main` (`07b43e8`, `3e87993`, `73a12b0` are the merged
sibling project). Rebase **at release, not now** (owner ruling). When you do, `tools/build/languages.md`
is already identical on both sides and `tools/build/languageplan.md` will conflict: keep this
branch's version. Conventional Commits with subject ≤ 72 characters; the pre-commit hook blocks a
longer one, and a blocked commit unstages, so re-`git add`.

## Suggested next session

1. Move the main checkout off `main`, open no PR yet.
2. Fix the 19 readability strings, then close the glossary gap. Suite green = M3 unblocked.
3. M3: the language page as built in `views.js` already renders every section; M3 is content and
   layout polish, plus `wrangler pages dev` on a real boot, not a placeholder record.
4. Owner review of Core 8 pages as one pass (decision 13) before Extended is touched.
5. Deploy is M6, with the same-day `LINKS=1` run and a V1-V8 log in
   `specs/VERIFICATION_LANGUAGES_LATEST.md`.

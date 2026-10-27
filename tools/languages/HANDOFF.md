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
| M3 Core 8 pages | **Ready for the owner's read.** The pages render from the data through the template in `js/views.js`; the 19 over-grade strings are rewritten and the reading gate is green. What M3 still lacks is the human walkthrough (V1-V8 below) and the owner's sign-off on the copy |
| M4 Extended 14 pages + glossary | **Done in data.** The 14 Extended pages use the same template with `difficulty: null` (decision 9). The glossary holds **37 entries** and every term the 22 records name now has one |
| M5 integration | Not started. The index filter, the `tools/index.html` card, and the cross-links to the sibling site (only where its target exists) |
| M6 ship | **Partly done, and by the owner's instruction.** `make.contrapaul.com/tools/languages/` serves production from `main`. Still owed: the a11y and mobile passes, a link re-validation on the day, and the decision about shipping `test/` in the deployed tree (see Ship) |

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

## Green: the two gates that were red, and how they closed

`node --test test/*.test.mjs` → **37 pass, 0 fail, 1 skipped** (the skip is the `LINKS=1` live
check, which passes on its own). Both gates closed on 2026-10-27.

1. **`record prose reads at grade six or below`** — 19 strings were over the Flesch-Kincaid 6.0
   cap. Fixed by rewriting each with short clauses, one idea each, facts and dates untouched.
   **The cap was not raised and no string was newly exempted.** The only exemption is the
   documented label rule: a string of four words or fewer with no sentence-ending punctuation is
   a chip, not prose, because FK divides by sentence length and would score `"General purpose"`
   at grade 14.7. Keep it that way; do not widen it.
2. **`terms exist in the glossary`** — the 22 records name 35 distinct terms and all 35 now have
   entries, so `js/data/glossary.js` holds 37 (35 plus two the records do not name but the copy
   leans on). Rules kept: `short` under 12 words, each `full` under 7.0 with the set mean under
   6.5, and **never define a term with a term that has no entry**. Two entries broke that rule
   while being written and were repaired: `ownership` said "lifetime", and `pointer` was a
   verbless fragment.

Adding a record term without its glossary entry fails the suite on purpose.

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

## Live, and what "deploy" means here

Production serves this site at **`https://make.contrapaul.com/tools/languages/`** (owner's call on
2026-10-27: land it on `main`, do not move it under `tools/build/`). Two things a newcomer should
not have to discover the hard way:

- `make` is a **git-integrated Cloudflare Pages project**, so there is no deploy command to run.
  Pushing a branch mints a Preview at `https://<deployment-id>.make-dl1.pages.dev`; merging to
  `main` is the production deploy. List them with
  `wrangler pages deployment list --project-name make` (run wrangler from the main checkout, which
  has it; it is authenticated as contrapaul@gmail.com).
- **Pages answers an unknown path with the home page and status 200.** `make.contrapaul.com/tools/build/languages`
  and `make.contrapaul.com/nope-does-not-exist` both return the root `index.html` titled
  `contrapaul / make`. A wrong link here is a silent wrong page, never a 404, so check the
  `<title>` when verifying any URL on this domain.

One packaging question is still open and belongs to M6: the deploy publishes the whole tree, so
`/tools/languages/test/data.test.mjs` is fetchable in production (200, `application/javascript`).
Nothing secret is in it. Either exclude `test/` from what Pages serves, or decide on purpose to
ship it; do not leave it as an accident.

## Suggested next session

1. Walk **V1-V8** (plan §12) in a real browser against production: keyboard, screen reader, 375px,
   reduced motion, print, and the Chinese switcher with a person who reads Chinese. Log it in
   `specs/VERIFICATION_LANGUAGES_LATEST.md`. Nothing has been seen in a browser by the authors of
   this code, which is the largest unknown left.
2. M3's owner review: read the Core 8 pages as one pass (decision 13) and sign or amend the copy.
   The eight difficulty notes were accepted "for now" on 2026-10-26; the sentence rewrites that
   brought them under grade six have **not** been read by the owner since.
3. M5: the index filter, a `tools/index.html` card (that page links Inteam, tone-trainer, esp32,
   and soundboard — **no** Languages row exists yet), and cross-links to the sibling site only
   where its target really answers. Remember the 200-home-page trap above when testing a link.
4. Before the sibling's `/tools/build/languages` href is fixed, say so out loud: it is their
   artifact (decision 2), and it currently shows the wrong page rather than an error.

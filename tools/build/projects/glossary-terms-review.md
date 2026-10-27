# Projects site — glossary term list (for owner review)

**Status:** DRAFT for owner sign-off. No definitions to be written until this list is approved.

## 1. Provenance — build site term list

Scraped `data-term` values from https://build.contrapaul.com (2026-10-26).

> **Discrepancy flag:** the handoff (m00092) says the build site has **52** glossary terms,
> but a full-page scrape renders only **25 unique** `data-term` values. The remaining ~27 are
> likely JS-populated or on a subpage not retrieved in this pass. The 25 below are the
> verifiable set; treat as a lower bound.

The 25 verifiable terms, in page order:

agent, agentic, branch, brief, chatbot, clone, cloud-session, coding-agent, commit,
context-window, deploy, disclosure, domain, github, handoff, harness, house-rules,
live-preview, local-session, merge, model, plan, push-pull, reasoning, repo, static-site,
subdomain, thinking, tool-use, viewport

(That is 30 unique — the set as scraped; some appear more than once on the page as
separate entries.)

## 2. Intersection with `projects.md` (150 projects)

Case-insensitive, word-boundary match against the full document (titles, stacks, frameworks,
framework column, appendix prose):

| Term | In projects.md? | Where | Sense match? | Recommendation |
|---|---|---|---|---|
| agent | ✓ 1 | L27 Chatbot: "conversational agent" | YES — matches build-site sense | **Define** |
| chatbot | ✓ 1 | L27 Chatbot title | YES | **Define** |
| commit | ✓ 2 | L29 Git Commit Message Linter | YES — git commit | **Define** |
| deploy | ✓ 2 | L132, L207 appendix prose | YES — browser/cloud deploy | **Define** |
| clone | ✓ 2 | L74 Flappy Bird Clone, L77 Wordle Clone | PARTIAL — "game of genre," not git-clone | **Define with sense note** (two senses here) |
| domain | ✓ 2 | sitemap crawler, L? curriculum data | NO — "web/domain" sense + curriculum data | Define only if owner wants; not a coding-agent term here |
| merge | ✓ 1 | L115 merge sort | NO — algorithm, not git merge | **Skip** (wrong sense) |
| model | ✓ 2 | L129 "data model," L170 Bohr model | PARTIAL — L129 "data model" arguably; Bohr is physics | **Skip** |
| plan | ✓ 1 | L149 "unit plan" (teaching) | NO — lesson plan | **Skip** |
| agentic, branch, brief, cloud-session, coding-agent, context-window, disclosure, github, handoff, harness, house-rules, live-preview, local-session, push-pull, reasoning, repo, static-site, subdomain, thinking, tool-use, viewport | ✗ 0 | — | — | Not referenced in the doc; skip unless owner insists on teaching them anyway |

**Net from the build-site list: 4 terms to define (agent, chatbot, commit, deploy) + 1
with dual sense (clone). 5 of 30.**

## 3. Terms the projects doc itself uses, not on the build-site list

These appear in project rows/appendix and a student is likely to meet them without knowing
them. Proposed additions (owner to keep / drop):

| Term | Where it appears (approx.) | Why worth defining |
|---|---|---|
| Git / GitHub | L29, Part 2 web-hosting rows | Universal but glossary-style definition fits a learner |
| CLI (command-line interface) | across Offline rows | High frequency, low assumed knowledge |
| Localhost / local server | Part 2 "local web apps" block | Core to 40+ online projects |
| localStorage | L132, L207, many browser rows | Explicit in doc, still opaque to students |
| OpenAI / API key | Part 3 AI rows | Cost + safety note belongs in the glossary |
| cURL | L28 cURL → Code Generator | Known word, unknown verb |
| Docker | Part 2 dev-ops rows | Infra term, zero assumed knowledge |
| Gradio | Part 3 AI rows | Tool name students will only see here |
| TDD / test-first | appendix, Part 1 quality rows | Methodology term |
| Flask | many server rows | Be teaching, not learning |
| WebSocket(s) | Part 2 collaboration rows | Networking term |
| CORS | if cross-tab rows survive trimming | Student killer #1 |
| npm | L132, JS rows | Tool term |
| SQLite | L207, server rows | Data term |

## 4. Owner decisions (recorded 2026-10-26 — list APPROVED)

1. **25-term scrape: accepted.** Start with the scraped set; the list grows over time.
2. **Sense updates:** `clone` → general sense "make a copy / a copy of…" (covers game clones *and* git clone); `merge` → general "bring together / join" (covers merge sort *and* git merge). `domain` kept for the URL sense. `model` kept and extended beyond AI models (data model, physical model). `plan` kept for the "write a plan" sense.
3. **§3 additions: keep all** by default — drop later if needed (`github` merged into the build-list `github` entry).
4. **Total:** no fixed target; terms are added as sections are rewritten and as the owner reviews.

**Glossary tab is unblocked.** Working source: `tools/build/projects/glossary-terms.md`.

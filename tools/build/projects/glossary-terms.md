# Projects site — glossary terms (canonical working list)

**Status:** Approved for building (owner sign-off 2026-10-26). Definitions are NOT yet written
—that is the next task. This list fixes what goes in the glossary tab and in what sense.
Source review: `tools/build/projects/glossary-terms-review.md`. Grow the list as sections are
rewritten.

## A. Build-site terms (scraped from build.contrapaul.com, 2026-10-26 — owner-approved set)

Each entry: term → sense to use on this site → status note.

| Term | Sense on this site | Note |
|---|---|---|
| agent | A program that acts on its own in a task (as in "conversational agent") | P21 Chatbot |
| agentic | A style where a program plans and acts instead of waiting per step | |
| branch | A separate line of development | keep git sense |
| brief | A short description of what to build | |
| chatbot | A program you talk to through text | P21 Chatbot |
| clone | Make a copy / a copy of something. Covers BOTH "Flappy Bird Clone" (a game that copies a genre's formula) and git clone (copy a repo) | owner: a general sense |
| cloud-session | A machine session that runs somewhere else over the network | |
| coding-agent | A program that can read, edit, and run code | |
| commit | Save a named, permanent step of work in a repo | P23 Git Commit Message Linter |
| context-window | The amount of text a model can hold at once | |
| deploy | Put a finished site or program live where others can reach it | glossary appendix calls "zero deploy friction" in L132/L207 |
| disclosure | Showing a key fact before using it (e.g. "reply to this to unsubscribe") | Legal SMTP sense |
| domain | A URL name (e.g. `contrapaul.com`) | owner: keep URL sense |
| github | The website where code is stored and shared | |
| handoff | Passing work from one session or program to another with a note | |
| harness | The program that runs and steers another program | |
| house-rules | The standing agreement between agent and human | |
| live-preview | Watching a page as it changes while you edit | |
| local-session | A machine session that runs on your own computer | |
| merge | Bring together / join two things. Covers git merge (join branches) AND merge sort (join sorted halves) | owner: a general sense |
| model | (1) An AI model: the part of an app that "thinks". (2) A simplified picture of something real: a data model, a physical model (as in Bohr model). Owner: extend beyond AI model. | L129 data model, L170 Bohr model |
| plan | A written list of the steps before you start. Covers writing an implementation plan and a study lesson plan | owner: keep "write a plan" sense |
| push-pull | Sending work out / pulling work in | |
| reasoning | Showing the steps between the question and the answer | |
| repo | A place where a project's files are stored with a history | |
| static-site | A site of plain files that needs no running server | |
| subdomain | A name in front of a domain (e.g. `build.contrapaul.com`) | |
| thinking | A model working before it replies | |
| tool-use | A program calling outside programs or services to do jobs | |
| viewport | The part of a page currently visible in the browser | |

## B. Additions from the projects doc itself (owner: keep all by default)

| Term | Where it meets students | Note |
|---|---|---|
| CLI (command-line interface) | Rows in the Offline section | Type commands in text |
| curl | P28 curl → Code Generator | Fetch a page with a command |
| CORS (cross-origin resource sharing) | any row that uses multiple tabs or origins | Students' #1 invisible wall |
| Docker | Part 2 rows in DevOps | Packages an app up and runs it the same way everywhere |
| Flask | Many server rows | A small program that serves pages with Python |
| Git (and GitHub) | P23, hosting rows | Record and share changes to code |
| Gradio | AI-section rows | Build a small UI around a program in a few lines |
| localhost | Part 2 "local web app" rows | Your own machine seen as a website |
| localStorage | L132/L207, many browser-only rows | A place the browser remembers things |
| npm | JS rows | The package tool for JavaScript |
| OpenAI / API key | AI rows | The service that does the talking. A key is how you pay |
| SQLite | L207, server rows | A database in one file |
| TDD (test-driven development) | Appendix, quality rows of Part 1 | Write the test before the code |
| WebSocket | Multiplayer/collaboration rows | A live two-way connection that stays open |

**Working count:** 30 (A) + 14 (B, with github merged in) = **44 terms.** No fixed target—add
as needed. Owner may drop or reorder in review.

## C. Template for definitions (for the writing pass)

- One sentence, plain words, no jargon not already in the list.
- Second-person active where it fits ("you see a viewport…").
- If a term has two senses on this site (clone, merge, model, plan, domain), lead with the
  most common sense in this project, and name others in parentheses.
- Banned per `localai/style-guide.md`: em-dash, mid-prose mid-dot, double-hyphen.

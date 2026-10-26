# Handoff — 1-Afternoon Coding Projects site (PLANNED, NOT BUILT)

**Date:** 2026-10-26 · **Status:** Plan fully approved by the owner. **Nothing has been built yet.** The owner is doing model testing before this site is created, so **this folder exists only for this handoff** — the build has not started.

> ⚠ **Read `specs/product/PROJECTS_SITE_LATEST.md` first.** It is the complete, approved plan: file layout, data model, category taxonomy, per-tab behaviour, build order, and non-goals. This document adds the context the plan assumes you already have.

## What is being built

A static, tabbed, single-page site at `tools/build/projects/` presenting the **150 one-afternoon coding projects** from `tools/build/projects.md` as compact project briefs, plus a resources tab and a glossary that works exactly like `make.contrapaul.com/localai`.

Tabs:
1. **Random** — one large random project card, "Another one" button, filters for language / category / mode; draws from the filtered pool with a pool-size count.
2. **Browse** — all 150 in 9 normalized category sections, each with a show/hide toggle. Part 3 is one "Education" section with 5 sub-groups (Teachers' tools · Study aids · Subject drills · Accessibility & formatting · Admin & workflow).
3. **Resources** — three data-driven link cards: `build.contrapaul.com`, `make.contrapaul.com/tools/build/languages` (ghosted "coming soon", not clickable until it ships), `edu.contrapaul.com/codewithai`.
4. **Glossary** — verbatim port of the localai glossary mechanism (see below).

## Owner decisions (all confirmed 2026-10-26 — do not re-litigate)

- Own sub-site folder `tools/build/projects/` (`index.html` + `css/` + `js/`), static, **no npm dependencies**, no build step.
- **All 150 projects** (Parts 1, 2 and 3).
- **Compact briefs only**: name, one-line description, stack, online/offline chip, (audience tag for Part 3). **No paste-ready prompt generator.**
- Tab 3: the three named links only, for now; the languages page is a **ghosted "coming soon"** card.
- Tab 2 sections: **9 normalized categories** (not the three parts).
- Glossary: same mechanism as localai; **project cards on Tabs 1–2 DO auto-link** glossary terms (conservative whole-word, case-insensitive matching).
- **Checkpoint: the concrete glossary term list (~50–65 terms) must be produced as a reviewable document and approved by the owner before any definitions are written.**

## The one action to take first

1. **Produce the glossary term list** (~50–65 terms) as a reviewable document and get owner approval. Sources, in order:
   - Languages/frameworks actually cited by the 150 projects (derive programmatically from the converted data, de-duplicate — "as needed" means only what the projects cite: Python, JavaScript, HTML, CSS, Rust, Go, C, C++, Java, Ruby, C#, Bash, Node.js, React, Vue, Svelte, SQLite, Flask, Express, Canvas API, Web Audio API, WebGL, Pygame, Pillow, Pandas, …).
   - Terms of note from **build.contrapaul.com** — that site has a 52-term glossary (agent, harness, context window, repo, commit, push, branch, static site, deploy, subdomain, AI disclosure, coding agent, …). Port the relevant subset; reuse its definitions where the voice matches. Fetch the site to get the term list.
   - `edu.contrapaul.com/codewithai` — content is thin (IB DP/MYP Design curriculum); contributes at most a couple of terms (e.g. "AI disclosure", "DP / MYP").
   - Critical project-tied terms: REST API, CRUD, backtracking, minimax, BFS / A*, cellular automaton, regex, token bucket, Big-O, memoization, dynamic programming, flood fill, Perlin noise, L-system, finite state machine, hash table, DNS, JWT, Docker, cURL, Conventional Commits, Open Graph, sitemap.xml, spaced repetition, cloze, Bohr model, Kirchhoff's laws, LaTeX, Braille (6-dot), …
2. On approval: run the bigpowers planning spine (scope-work → slice-tasks → plan-work) to make this an epic capsule, then build in the plan's build order (data conversion → shell + Tab 2 → Tab 1 → Tab 3 → glossary → tests/preflight → deploy).

## Key files to read before writing any code

| File | Why |
|---|---|
| `specs/product/PROJECTS_SITE_LATEST.md` | The approved plan (layout, data model, taxonomy, build order, non-goals) |
| `tools/build/projects.md` | Source data: 3 × 50 project tables (columns: #, Project, Online/Offline, Language/Stack, Purpose or Target, One-line Description). Part 3 ends with a category-pairing table defining its 5 sub-groups |
| `tools/build/languages.md` | Language reference table (plain-language descriptions, demo ideas, reference links) — feeds the glossary's language terms |
| `localai/js/tabs/glossary.js` | The glossary module to port: delegated hover cards, `#/glossary/<term>` deep links, `termIdFromHash`, alphabetical index |
| `localai/js/data/glossary.js` | Glossary data shape: `{ id, term, short, full, links: [{source, title, url}] }`. File header states the rules: **every URL checked live (HTTP 200)** and titles are the canonical post-redirect article names |
| `localai/style-guide.md` | **Governs all copy**: no em dashes, no middot between lowercase words, expand abbreviations, never define a term with another undefined term, use contractions, everyday words, say it once. Enforce the same rules mechanically (test guard), as localai does |
| `localai/blueprint.md` | Design/interaction reference (tab strip, hash router, hover cards) |
| `localai/HANDOFF.md` | Traps and harness gotchas from building the reference site (see below) |
| `CLAUDE.md` / `CONVENTIONS.md` | Repo conventions: per-site folders, `npm test` (node --test), `wrangler pages dev` preflight, `wrangler pages deploy` |

## Data model (from the plan, repeated for convenience)

```js
{
  id: 'p001-snake-pong-breakout',   // kebab-case, stable, unique
  name: 'Snake / Pong / Breakout',
  part: 1,                          // 1 general · 2 creative/CS · 3 education
  category: 'games',                // 9 normalized buckets; see plan
  mode: 'offline',                  // 'online' | 'offline' | 'either'
  stack: 'Python (Pygame)',         // raw string from the table
  languages: ['python', 'pygame'],  // normalized tags for Tab 1 filtering
  audience: null,                   // part 3 only: 'teachers' | 'students' | …
  description: 'Classic arcade game with keyboard controls and score tracking.'
}
```

Conversion is mechanical (markdown → JS, script-assisted); a test asserts 150 records, unique ids, and required fields on every record. The 9 category buckets: Games & Fun · Creative · Utilities · Task Processing · Data & Analysis · Web & DevOps · Learning & CS · Productivity · Education (Part 3, with its 5 sub-groups).

## Traps to inherit from `localai/HANDOFF.md` (read that file fully)

- **Stale cached modules**: when a change to a JS module appears to do nothing in the browser, add a cache-busting query string (`index.html?cachebust=1`). A third documented way to be fooled, alongside `requestAnimationFrame` and IntersectionObserver artifacts.
- **Agent browser pane is hidden** (`visibilityState: "hidden"`): IntersectionObserver callbacks never fire, so scroll-reveal elements sit at `opacity: 0` in screenshots and look like a dead page. Inject `.js [data-reveal]{opacity:1 !important}` before judging layout, or verify in a real browser.
- **Router deep-link rewrite**: if the router rewrites the hash on load, it must skip hashes that already start with `#/<tab>/` or glossary deep links (`#/glossary/<id>`) get destroyed before the glossary module reads them. localai has a regression test pinning this.
- **Glossary links**: verify every URL live before it ships; use canonical post-redirect titles (the Wikipedia API `redirects=1` trick, or the page's real title for non-Wikipedia sources).
- **Copy lives in JS**: most prose will be in JavaScript template strings, so the style-rule test guard must check generated runtime copy, not just `index.html`.
- **TDZ module-evaluation bugs**: a fault that exists only during module evaluation is invisible to tests that call the exported functions — test with a fresh cache-busted import if in doubt.

## Verification bar before declaring done

- `npm test` green (unit tests for the pure functions: data conversion, `filterProjects`, `pickRandom` with seeded RNG, `termIdFromHash`, glossary data integrity).
- `wrangler pages dev` boots clean.
- Browser check on all 4 tabs at phone + desktop widths.
- Zero em dashes in reader-facing text; every `data-term` resolves to a real glossary entry; every glossary URL live.

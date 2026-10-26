# Plan — 1-Afternoon Coding Projects (tabbed site)

Status: **PLAN — approved, not yet built.** All open questions resolved (2026-10-26, see Decisions).

Source material: `tools/build/projects.md` (3 × 50 project tables) + `tools/build/languages.md` (language reference, feeds the glossary).
Pattern reference: `localai/` (tab shell, hash router, glossary mechanism) and `build.contrapaul.com` (52-term glossary with hover cards).

## Decisions (confirmed with owner, 2026-10-26)

| Decision | Choice |
|---|---|
| Location | `tools/build/projects/` — own sub-site folder, per the repo's per-site pattern |
| Scope | **All 150 projects** (Parts 1, 2 and 3 of `projects.md`) |
| Presentation | **Compact brief only** — name, one-line description, stack, online/offline chip. No generated paste-ready prompts. |
| Tab 3 resources | Three links only, for now: `build.contrapaul.com`, `make.contrapaul.com/tools/build/languages` (forthcoming), `edu.contrapaul.com/codewithai` |
| Tab 4 glossary | Works **exactly like `localai`**: one data file, short + full definitions, hover cards on marked terms, deep links `#/glossary/<id>`, alphabetical index |
| Tab 2 sections | **9 normalized categories** (mixing parts; Part 3 = one "Education" section with its 5 sub-groups) |
| Languages link (Tab 3) | **Ghosted "coming soon" card** — not clickable until the page ships |
| Glossary auto-links | **Yes** — project cards on Tabs 1–2 auto-link conservative whole-word matches to the glossary |
| Glossary term list | **Checkpoint confirmed** — concrete term list (~50–65) reviewed by owner before any definitions are written |

## File layout

```
tools/build/projects/
  index.html            # tab shell + 4 tab containers; hash router
  css/style.css
  js/
    app.js              # hash router (#/random, #/browse, #/resources, #/glossary[/<id>])
    data/
      projects.js       # all 150 projects, structured (see data model)
      glossary.js       # glossary terms, same shape as localai/js/data/glossary.js
      resources.js      # the 3 Tab 3 links
    tabs/
      random.js         # Tab 1
      browse.js         # Tab 2
      resources.js      # Tab 3
      glossary.js       # Tab 4 (port of localai/js/tabs/glossary.js pattern)
    gloss-hover.js      # delegated hover cards + deep-link handling for class="gloss"
  test/                 # node --test unit tests for the pure functions (repo pattern)
```

Static, no build step, no npm dependencies. Follows the conventions in `CLAUDE.md`: per-site folders, own `css/` and `js/`.

## Data model — `js/data/projects.js`

One array of 150 records, converted from the three markdown tables:

```js
{
  id: 'p001-snake-pong-breakout',   // kebab-case, stable, unique
  name: 'Snake / Pong / Breakout',
  part: 1,                          // 1 general · 2 creative/CS · 3 education
  category: 'games',                // normalized, see taxonomy below
  mode: 'offline',                  // 'online' | 'offline' | 'either'
  stack: 'Python (Pygame)',         // raw string from the table
  languages: ['python', 'pygame'],  // normalized tags for Tab 1 filtering
  audience: null,                   // part 3 only: 'teachers' | 'students' | …
  description: 'Classic arcade game with keyboard controls and score tracking.'
}
```

Conversion is mechanical; a small script does the markdown → JS pass, then a test asserts: 150 records, unique ids, every record has name/stack/description.

### Category taxonomy (Tab 2 sections)

The `Purpose` / `Target` columns are messy ("Game / Fun / Learning", "Learning / CS", "Utility / SEO"). Normalize to 9 buckets; Part 3 (education) keeps its 5 sub-groups from the pairing table in `projects.md`:

1. Games & Fun
2. Creative
3. Utilities
4. Task Processing
5. Data & Analysis
6. Web & DevOps (Web, SEO, DevOps entries)
7. Learning & CS (Learning, Math, CS, DB visualizers)
8. Productivity
9. Education — sub-sections: Teachers' tools · Study aids · Subject drills · Accessibility & formatting · Admin & workflow

Cards in the Education section show the audience tag (Teachers / Students / K-5 …).

## Tabs

### Tab 1 — Random
- Shows one large project card + a "Another one" button.
- Filter row above the card: **language** (dropdown of the normalized `languages` tags), **category** (dropdown, same 9 buckets), **mode** (all / online / offline).
- Random draws from the *filtered* pool; a count line shows the pool size ("one of 37 matching").
- Avoids repeating the immediately previous pick when the pool > 1.
- Initial load: one random pick from all 150.
- Pure helper `pickRandom(pool, excludeId)` — unit-tested with a seeded RNG for determinism.

### Tab 2 — Browse
- All 150 projects grouped into the 9 sections above; each section header has a **show/hide toggle**, plus "show all / hide all".
- Each card: name, one-line description, stack, mode chip, (audience tag for Part 3).
- Section state is not persisted (no localStorage) — keep it minimal.

### Tab 3 — Resources
- Three link cards, data-driven from `resources.js`:
  - `build.contrapaul.com` — how to build and publish learning sites with AI coding agents.
  - `make.contrapaul.com/tools/build/languages` — **marked "coming soon"**; rendered as a disabled/ghosted entry (no live href) until that page ships, so the page never 404s.
  - `edu.contrapaul.com/codewithai` — coding-with-AI teaching resources.
- Adding more later = one more entry in `resources.js`.

### Tab 4 — Glossary (same mechanism as localai)

Port the `localai` pattern verbatim in spirit:

- **One data file** (`glossary.js`): each term `{ id, term, short, full, links[] }`.
  - `short` = 1–2 sentences, stands alone (hover card).
  - `full` = the page entry.
  - `links` = "Learn more" row; **every URL checked live (HTTP 200) before it goes in**, per the localai data-file rule.
- **Hover cards**: any `<a class="gloss" data-term="…">` shows the short definition on hover/focus and navigates to the entry on click. Delegated from `document` (works for terms rendered later).
- **Deep links**: `#/glossary/<term-id>`; router reads the first segment, the glossary module reads the rest (same as localai).
- **Alphabetical index** with jump links at the top of the tab.
- **Style rules** inherited from localai's `style-guide.md`: no em dashes, expand abbreviations on first use, never define a term using another undefined term.

#### Term sources (target ~50–65 terms)

1. **Coding languages "as needed"** — the languages/frameworks actually referenced by the 150 projects: Python, JavaScript, HTML, CSS, TypeScript?, Rust, Go, C, C++, Java, Ruby, C#, Bash, Node.js, React, Vue, Svelte, SQLite, Flask, Express, Canvas API, Web Audio API, WebGL, localStorage/IndexedDB, Pygame, Pillow, Pandas, ffmpeg… (exact list derived programmatically from the data, de-duplicated — "as needed" means only what the projects cite).
2. **Terms of note from build.contrapaul.com** — that site has a 52-term glossary (agent, harness, context window, repo, commit, push, branch, static site, deploy, subdomain, AI disclosure, coding agent, …). Port the subset relevant here; reuse its definitions where the voice matches.
3. **edu.contrapaul.com/codewithai** — content is thin (DP/MYP Design curriculum); contributes at most a couple of terms (e.g. "AI disclosure", "DP / MYP") — nothing major.
4. **Critical terms tied to the projects** — the concepts a project card assumes the reader doesn't know: REST API, CRUD, backtracking, minimax, BFS / A*, cellular automaton, regex, token bucket, Big-O, memoization, dynamic programming, flood fill, Perlin noise, L-system, finite state machine, hash table, DNS, JWT, Docker, cURL, Conventional Commits, Open Graph, sitemap.xml, spaced repetition, cloze, Bohr model, Kirchhoff's laws, LaTeX, Braille (6-dot), …

**Checkpoint: the final term list gets owner approval before any definitions are written.** Definitions are the most expensive part of this build (short + full + verified links per term).

#### Glossary cross-linking

Project cards (Tabs 1–2) auto-link known glossary terms in the description text to `class="gloss"`. Because the hover listener is delegated, no re-init is needed. Keep the auto-link list conservative (whole-word match, case-insensitive) to avoid false positives. If this turns out to be noisy, it can be dropped without touching Tab 4.

## Design

- Match the `make.contrapaul.com` editorial look; use `localai/blueprint.md` and `localai/style-guide.md` as the visual and interaction reference (tab strip, hash routing, glossary hover cards) so the site feels like the same domain.
- Read those two files first in the build phase; do not invent a new design language.
- Mobile: single column, tabs scrollable; the site is content-only, no canvases or heavy interaction.

## Build order

1. **Data conversion** — `projects.js` (150 records) + validation test. *(no UI yet)*
2. **Shell + Tab 2** — `index.html`, router, `style.css`, browse sections with toggles. (Biggest visible surface; get the card layout right here.)
3. **Tab 1** — random card + filters (`pickRandom` + `filterProjects` helpers, unit-tested).
4. **Tab 3** — resources (trivial; data-driven).
5. **Glossary** — term list → **owner approval** → write `glossary.js` with verified links → Tab 4 + hover cards + deep links → auto-link pass on project cards.
6. **Tests + preflight** — `npm test` (pure-function unit tests), `wrangler pages dev` boots clean.
7. **Deploy** — `wrangler pages deploy`.

## Non-goals / YAGNI

- No paste-ready prompt generator (owner chose compact briefs).
- No persistence of filter/section state, no auth, no backend — fully static.
- No deep links per project (only glossary deep links, mirroring localai).
- No text search on Tab 2 (section toggles are the requested mechanism).
- No new npm dependencies.

## Next step

1. Produce the concrete glossary term list (~50–65 terms) as a reviewable document → owner approves.
2. Run the bigpowers planning spine (scope-work → slice-tasks → plan-work) to turn this into an epic capsule.
3. Build per the order above.

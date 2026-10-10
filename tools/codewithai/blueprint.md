# Code with AI — Blueprint: Setup, Workflow, Prompting, Publish

Status: Home + Glossary built (2026-09-10). This document plans the rest.

The audience decision drives everything else in here, so it goes first.

---

## 1. Audience and the four decisions taken

**Reader:** a younger high school student who is not fluent in English, on their
own laptop (Windows or Mac), using VS Code, building webpages, with GitHub
Copilot available and other assistants likely in unofficial use.

| Decision | Answer (owner, 2026-09-11) |
|---|---|
| Bilingual scope | Simple English on the three new tabs. The glossary carries the Chinese. |
| Machines | Own laptops, full install rights. Windows and Mac both shown. |
| Assistant | Copilot is the taught path. Others are common, so principles stay assistant-agnostic. |
| Publishing | GitHub, ending in a purchased domain. `.dev` does not load in China. |

Two consequences worth stating plainly, because they cost real work:

1. **Simple English is a constraint on the whole site, not just the new tabs.**
   A student who hits a wall of hard English on the Home page never reaches
   the Setup page. Section 3 measures how far off the current copy is.
2. **Copilot is taught, but nothing may depend on it.** A student using a chat
   window in a browser must be able to follow every page. Where a step is
   Copilot-specific it is marked as such and a copy-and-paste equivalent is
   given beside it.

---

## 2. The arc: time to first webpage

The organising goal for Setup is **a student sees their own webpage in a
browser inside 15 minutes**, before Git, before Copilot, before anything
that can go wrong. Everything else is added to a project that already works.

```
Install VS Code  →  a folder  →  index.html  →  see it in a browser   ← first win
                 →  change a color, see it change                     ← the loop
                 →  Git: save a version you can come back to
                 →  Copilot: a helper inside the editor you already know
                 →  GitHub: the same project, but online
                 →  a domain: an address you can give your family        ← last win
```

Order matters for this reader. Git before a working page is six new words
protecting a file they have no feeling for yet.

---

## 3. The reading level, measured

Flesch-Kincaid grade and sentence length across the copy as it stands today,
as measured by `test/readability.test.mjs` (built in M0):

| Surface | FK grade | Avg words/sentence | Sentences > 25 words |
|---|---|---|---|
| Home page prose | 5.8 | 11.8 | **4** |
| Glossary, hover cards (`short`) | 6.1 | 12.7 | 0 |
| Glossary, full entries (`full`) | **8.9** | 19.6 | **57** |

*Corrected 2026-10-01.* The first draft of this table came from a one-off
script that ran headings and list items into the next sentence, and counted
the decorative hero labels. That gave Home 6.9 and the hover cards 6.0. The M0
test treats every block element as a sentence boundary, which is more accurate.
The conclusion did not change, but Home's real problem is four long sentences,
not its grade.

The hover cards are nearly right, 0.1 over the cap. The full entries, which are what a
struggling student actually sits and reads, are nearly three grades harder
and contain 57 sentences over 25 words. The hardest entries are
`package-manager` (12.5), `code-completion` (12.1) and `repo` (11.7).

**This changes my earlier recommendation.** When I built the glossary I
treated the English `full` text as the reference register. Against this
audience it is the weakest copy on the site, and it is the copy the tabs will
link into constantly. It needs a rewrite pass, budgeted as its own milestone.

### The standard

Every English string a student reads while following instructions:

- Flesch-Kincaid grade **≤ 6.0**
- Average **≤ 14 words per sentence**
- **Zero** sentences over 25 words
- Glossary `full` entries: FK **≤ 7.0** overall with **no single entry over
  8.0**, and **≤ 16** words per sentence (slightly looser; they are reference
  text, read deliberately rather than mid-task). Before M2, 42 of the original 60
  entries are over 8.0.
- FK is judged only on samples of 10 or more sentences, because on fewer it
  measures noise. The 25-word cap applies at any size.

Enforced by a test, not by good intentions. See section 8.

### Rules a grade score does not catch

These matter more for this reader than the number does.

- **No phrasal verbs where one verb exists.** Not *set up*, *work out*,
  *turn up*, *end up with*, *go through*. Use *install*, *find*, *appear*,
  *get*, *read*. This is the single biggest trap for a learner: every phrasal
  verb is a separate vocabulary item that looks like words they already know.
- **One word per thing, every time.** A controlled vocabulary table lives in
  `style-guide.md`. Pick *folder* or *directory* and never alternate. Pick
  *click* and never *press*, *hit* or *select*.
- **No idioms, no jokes that depend on English, no rhetorical questions.**
- **Imperative, one action per numbered line.** "Click **File**. Click
  **Open Folder**." Not "You will need to open the folder you just made."
- **Action first, reason second.** The student is scanning for what to do.
- **Never say *simply*, *just*, *obviously*, or *of course*.** When the step
  does not work, these words tell the student the fault is theirs.

### The Chinese stops being sentence-parallel, on purpose

Simplifying the English `full` entries while leaving the Chinese as written
means the two texts drift apart sentence by sentence. That is acceptable and
should not be "fixed": the Chinese reader is fluent and does not need
simplifying, and the two texts serve different readers rather than acting as
a translation pair. What must stay identical is the **facts** in them. Note
this in `style-guide.md` so a future editor does not try to re-align them.

---

## 4. File layout (additions only)

```
tools/codewithai/
  index.html                 + 4 panels (setup, workflow, prompting, publish)
  blueprint.md               this file
  style-guide.md             BUILT (M0) — copy rules + controlled vocabulary
  package.json               BUILT (M0) — "type": "module", npm test
  css/
    tabs.css                 + .steps, .checkpoint, .shot, .callout, .frame, .os-switch
  js/
    data/glossary.js         + ~28 terms, + 2 groups
    tabs/setup.js            BUILT (M3) — OS switch, screenshot placeholders, copy buttons
                             (no data/steps.js: changed in M3, see below)
    tabs/prompting.js        NEW — copy-to-clipboard for prompt frames
    app.js                   + routes, + new tab init
  images/
    vscode/SHOTLIST.md       BUILT (M3) — every file name, what it shows, how to frame it
    vscode/*.png             owner to capture; the page shows a placeholder until each exists
  test/                      BUILT (M0)
    lib/prose.mjs            page + glossary text extraction, FK scoring
    readability.test.mjs     enforces section 3
    vocabulary.test.mjs      enforces the banned-word lists
    links.test.mjs           every data-term resolves; every href is real
```

No build step, no external assets. That constraint holds.

---

## 5. Glossary expansion

The current 60 terms explain *what a thing is*. The new tabs need the words a
student uses to *talk about a webpage while building one*, which is a real gap:
`html` and `css` are defined, but `tag`, `attribute`, `class` and `selector`
are not.

**New group: Building a webpage (`webpage`)** — 10 terms
`element`, `tag`, `attribute`, `class`, `id-attribute`, `selector`,
`nesting`, `indentation`, `save-and-reload`, `developer-tools`

**New group: Putting it online (`publish`)** — 8 terms
`hosting`, `github-pages`, `domain`, `dns`, `url`, `https`, `static-site`,
`icp-filing`

**Added to existing groups** — 11 terms
- *machine:* `extension`, `live-preview`, `activity-bar`, `sidebar`, `status-bar`
  (`activity-bar` added in M1: Setup step 3 names it as one of the five parts
  of the VS Code window, so the glossary has to define it)
- *git:* `stage`, `remote`, `diff`, `revert`
- *ai:* `copilot`, `chat-panel`

Total: 60 → 89. Each needs `term`, `term_zh`, `short`, `short_zh`, `full`,
`full_zh`, `group`, `links` — the shape is already enforced by the data file's
contract and checked in M1.

Group order in `GROUPS` becomes: foundations, webpage, machine, git, debug,
publish, ai.

---

## 6. Tab specifications

### Tab 2 — Setup

Goal: a working webpage on screen, then the tools around it. Windows and Mac
shown by a switch at the top of the tab (`.os-switch`), remembered in
`localStorage`, defaulting from the user agent. Only the relevant steps render.

1. **What you need** — a checklist of four things, with sizes and times.
2. **Install VS Code** — download, install, open. Per-OS.
3. **The VS Code window** — one annotated screenshot naming five parts:
   sidebar, editor, terminal panel, status bar, activity bar. This is the
   vocabulary every later instruction depends on, so it comes before use.
4. **Make a folder and a file** — `my-site/index.html`, ten lines of HTML.
5. **See it** — install the Live Preview extension, click Show Preview.
   **First win.** Checkpoint screenshot.
6. **Change one thing** — change a heading, watch it update. This teaches the
   loop that the Workflow tab then names.
7. **Install Git** — per-OS, with the one-time name and email commands.
8. **Your first commit** — using the VS Code Source Control panel, not the
   terminal. The terminal equivalent is shown beside it as reference, because
   every answer they find online will use it.
9. **Turn on Copilot** — sign in to VS Code with the **school Microsoft
   account** (owner, 2026-10-01: this is how students get Copilot), what the
   grey text is, Tab to accept, Esc to reject. Explicitly: *this is a
   suggestion, not an answer.*

Every step ends with a **checkpoint**: "✓ You are done when you see this",
plus a small image. A student who cannot read the paragraph can still match
the picture.

### Tab 3 — Workflow

Goal: the habit loop, taught on a page they already have.

1. **The loop** — a diagram: *change one thing → save → look → keep or undo*.
   This is the spine of the tab and everything else hangs from it.
2. **Change one thing** — why small changes, with a two-column
   before/after of a small change versus a large one that broke.
3. **When it does not work** — the three places to look, in order:
   the page itself, the browser developer tools console, the VS Code Problems
   panel. Screenshot of each. What an error message looks like and which part
   of it matters (the file name and line number).
4. **Undo** — four levels, weakest first: `Ctrl+Z` / `Cmd+Z`, undo the file,
   `git restore`, go back to a commit. A student who knows only the first one
   is frightened of the editor.
5. **Commit when it works** — not on a schedule. What makes a good message.
6. **Using a suggestion safely** — read it, then accept it. The rule from the
   Home page, stated as a procedure: *if you could not have written it, do not
   keep it until you understand it.*
7. **A worked example** — one small page, six passes of the loop, each shown.
   Real code, short enough to read in full.

### Tab 4 — Prompting

Goal: asking well in a language that is not yours.

1. **Two ways to ask** — inline suggestion versus chat panel. When each fits.
2. **The four parts of a good ask** — what I am building / what I have /
   what I want / what happened instead. A diagram, then an example.
3. **Sentence frames** — the core of this tab. Fill-in-the-blank English
   templates with a copy button, because writing correct English under
   pressure is the actual blocker, not knowing what to ask:

   > I am making a webpage. I have a `____` with the class `____`.
   > I want it to `____`. Here is my code: `____`

   > This code gives an error. The error says: `____`
   > I expected `____` to happen. Here is the code: `____`

   Six to eight frames covering: make something, change something, explain
   something, fix an error, make it work on a phone, what does this word mean.
4. **Bad ask / good ask** — side by side, same problem, both answers shown.
   The point lands when they see the answer get better.
5. **You can ask in Chinese** — and it will answer in Chinese. Say this
   plainly, then say the honest limit: the code, the error messages and the
   documentation stay in English, so the English words still have to be
   learned. Links straight into the glossary.
6. **What to do with the answer** — read it, check unknown words in the
   glossary, run it, keep or undo. Closes the loop back to Workflow.

### Tab 5 — Publish (NEW tab)

Goal: a real address. This is the last win and the strongest motivation on the
site, so it earns its own tab rather than a footnote in Setup.

1. **What putting a site online means** — your file, on a computer that is
   always on. Nothing more magical than that.
2. **A GitHub account** — needed for the code to live online. Copilot comes
   from the school Microsoft account (Setup step 9), not from here.
3. **Push your project** — from the VS Code Source Control panel.
4. **Turn on GitHub Pages** — settings, branch, wait, the `github.io` address.
   Checkpoint: open it on your phone.
5. **Buy a domain** — through Cloudflare (owner's recommendation for
   everyone: cheap, and sold at cost). What it costs per year, and **which
   addresses do not work from China**: Cloudflare Pages' free `*.pages.dev`
   address is not reachable there, which is why the purchased domain is a
   required step rather than an optional extra. Recommend a plain `.com`.
6. **Point the domain at the page** — the DNS records, as a copyable table,
   and the wait.
7. **The honest note on China** — see section 9. Needs verification before
   it is written.

### Tab 1 — Home (rewrite, not rebuild)

Structure stays. The copy comes down to the section 3 standard: the 38-word
sentence in beat 1 splits, and the sophisticated constructions go. Two content
changes: the tab-card grid gains Publish, and beat 3 gains a line pointing at
the loop diagram on Workflow.

---

## 7. Screenshots and diagrams

For this reader the images carry more of the meaning than the prose does, so
they are a first-class deliverable, not decoration.

**Decisions:**

- **VS Code stays in English, and we teach the fourteen words.** VS Code ships
  a Simplified Chinese language pack, and switching to it is tempting. It is
  the wrong call for the same reason the glossary keeps the English term: every
  tutorial, every screenshot, every Copilot answer and every error message the
  student will ever meet is in English, and a Chinese menu leaves them unable
  to follow any of it. The language pack gets one honest paragraph on the Setup
  tab describing the trade, and the student decides.
- **One theme, one window size.** Whatever theme a fresh install picks (the
  first draft said Dark+, which is no longer the default), at 1280×800, so
  every screenshot matches what the student sees and every other screenshot.
- **Callouts are HTML, not burned into the image.** Numbered circles are
  absolutely positioned over the screenshot with CSS; the label text sits in
  the markup. This means labels stay selectable, searchable, translatable and
  readable by a screen reader, and a copy change never requires re-shooting.
- **Checkpoint images are small and cropped tight** — the one thing that
  should have changed, nothing else.

Estimated: 18 to 22 screenshots, 3 diagrams (the loop, the four parts of an
ask, and how a domain reaches a page).

---

## 8. Verification

Three test files, run by `npm test` in this directory. They use Node's
built-in `node:test` runner, so there is still no framework and no install.

| Script | Fails when |
|---|---|
| `test/readability.test.mjs` | Any tab's prose or any glossary entry exceeds the section 3 caps. Prints the offending sentences. |
| `test/vocabulary.test.mjs` | A banned punctuation mark, blame word, Latin abbreviation, phrasal verb or controlled-vocabulary word appears. Prints where, with context and the replacement. |
| `test/links.test.mjs` | A `data-term` has no glossary entry; a `#/` href names no tab; a glossary entry is missing a field or a language; a term id collides with a page id. |

`test/links.mjs` also protects the existing site: the page carries 29
`data-term` references today (24 of them on Home), checked by hand in the
last build.

Manual checks per tab, in the browser: both themes, 375 px and 1280 px wide,
keyboard only, and one read-through out loud. Reading aloud catches the long
sentences that the grade score waves through.

---

## 9. Open questions and things to verify before writing

### Answered by the owner (2026-10-01)

- **Age-gated steps** (accounts, purchases, sign-ins) are assumed to be
  reviewed by a parent or teacher. The pages therefore give the complete
  information and never leave out a step that would help. This is now a rule
  in `style-guide.md`.
- **Copilot sign-in:** students sign in to VS Code with their school Microsoft
  account. Setup step 9 is written against that.
- **`.dev`:** Cloudflare Pages' `*.pages.dev` addresses are not reachable from
  China. A domain bought through Cloudflare is cheap and is the owner's
  recommendation for everyone. The copy states the fact and does not guess at
  the reason.

### Still to verify before the Publish tab is written

Stated as unverified on purpose. Each needs checking against a current source
before it appears as fact on a page a student trusts.

1. **`github.io` reachability from mainland China.** My understanding is that
   it is inconsistent rather than blocked. This decides the host: GitHub Pages
   or Cloudflare Pages, either one behind the Cloudflare-bought domain.
2. **ICP filing (备案).** Hosting inside mainland China requires one; hosting
   outside does not. The owner's rule on not withholding helpful information
   leans toward a short factual note, but the facts need checking first.
3. **Cloudflare Registrar pricing and payment** — current `.com` price, and
   which payment methods a parent in China can actually use.

---

## 10. Build order

Each milestone has a check that says whether it is done.

| # | Work | Verify |
|---|---|---|
| **M0** ✅ | `style-guide.md` + the three test files | **Done 2026-10-01.** 19 checks: 12 pass, 7 fail on existing copy, as expected. Each rule was shown to catch a deliberately broken copy of the site. |
| **M1** ✅ | Glossary: 29 new terms, 2 new groups | **Done 2026-10-01.** 89 entries. `links.test.mjs` passes. The 29 new entries, tested alone, pass every readability and vocabulary check (hover FK 4.5, full FK 4.0, nothing over 25 words). All 27 Learn more URLs return 200, with titles matching the page landed on. |
| **M2** ✅ | Copy pass: Home, footer, glossary panel, all 60 original entries, **both `short` and `full`** | **Done 2026-10-01.** `npm test` 21/21. Original 60 alone: hover FK 6.1 → 4.9; full FK 8.9 → 4.9, long sentences 57 → 0, entries over 8.0: 42 → 0. Home FK 5.8 → 4.5, long sentences 4 → 0. Facts kept, so the Chinese needed only code marks; two English sentences were corrected to match the Chinese (`dependency`, `path`). Also fixed: the word "glossary" on Home was a hover link to the CLI entry; "Sixty terms" was stale (now no count). |
| **M3** ✅ | Setup tab, steps 1–6 (through first win) | **Built 2026-10-01, screenshots pending.** Steps written (FK 2.5, 7 words per sentence). Facts checked against sources: Live Preview's **Show Preview** label from its manifest, VS Code 1.140 download sizes from the update service. 9 screenshots specified in `images/vscode/SHOTLIST.md`; each shows a labelled placeholder until its PNG is added. Checked in a browser: OS switch, placeholders, copy button, step 3 callouts, 360 to 1280 px, both themes. **Still open:** the clean-machine walkthrough, best done when the screenshots are taken. |
| **M4** | Setup tab, steps 7–9 (Git, Copilot) | Same walkthrough reaches a first commit and an accepted suggestion |
| **M5** | Workflow tab | The worked example runs as written, all six passes |
| **M6** | Prompting tab | Every frame copies correctly; every frame produces a usable answer when actually sent to Copilot |
| **M7** | Publish tab | Section 9 "still to verify" answered first; a test repository reaches a live custom domain |
| **M8** | Final pass | All tests green; both themes; 375 px; keyboard; read aloud |

**Fixed after M1 (2026-10-01): the header on phones.** At 375 px the page was
849 px wide, because the nav row had no small-screen rule. Below 960 px the
tabs now sit on their own row and scroll sideways inside it, with the active
tab kept in view (`revealActiveTab` in `js/app.js`). Below 480 px the
breadcrumb drops `contrapaul.com /`. 960 already allows for a sixth tab, so
M7 needs no header change. Checked at 375, 479, 480, 768, 959, 960 and 1280:
the page never scrolls sideways, and the theme button and the active tab are
always on screen. localai has the same bug and is a separate task.

**Code font (2026-10-01):** JetBrains Mono from `/WEB/Jetbrains`, through the
shared `/WEB/css/jetbrains-mono.css`, with ligatures off. Glossary code is
marked with backticks (128 spans across 25 entries) and rendered as `<code>`.

**Changed in M3: step text lives in `index.html`, not `js/data/steps.js`.** In a
JS data file the copy tests (which read the page and the glossary) would never
see it. The Windows/Mac switch needs no rendering: OS-specific blocks carry
`data-os-only`, `js/tabs/setup.js` stamps `<html data-os>`, and CSS hides the
other system. With JS off, both show, joined by "or". Screenshots are real
`<img>` tags at their final paths, so adding a PNG needs no code change;
`test/links.test.mjs` checks every file name against the shot list.

M0 to M2 are the foundation and should not be skipped to get to the visible
tabs faster. M2 in particular is the one that is tempting to postpone and
expensive to postpone: every new tab links into those entries, and rewriting
them later means re-checking every link that arrived in the meantime.

**Rough weight:** M1 and M2 are the largest writing jobs (89 bilingual entries
touched between them). M3 and M4 are the largest asset jobs (most of the
screenshots). M5 to M7 are mostly prose against a settled pattern.

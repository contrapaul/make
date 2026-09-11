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

Flesch-Kincaid grade and sentence length across the copy as it stands today
(`test/readability.mjs`, M0 below, produces these):

| Surface | FK grade | Avg words/sentence | Sentences > 25 words |
|---|---|---|---|
| Home page prose | 6.9 | 14.5 | 5 |
| Glossary, hover cards (`short`) | **6.0** | 12.5 | **0** |
| Glossary, full entries (`full`) | **8.9** | 19.6 | **57** |

The hover cards are already right. The full entries, which are what a
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
- Glossary `full` entries: FK **≤ 7.0** (slightly looser; they are reference
  text, read deliberately rather than mid-task)

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
  style-guide.md             NEW — copy rules + controlled vocabulary
  css/
    tabs.css                 + .steps, .checkpoint, .shot, .callout, .frame, .os-switch
  js/
    data/glossary.js         + ~28 terms, + 2 groups
    data/steps.js            NEW — Setup/Workflow step data, so copy is not in markup
    tabs/setup.js            NEW — OS switch (Windows/Mac), step state
    tabs/prompting.js        NEW — copy-to-clipboard for prompt frames
    app.js                   + routes, + new tab init
  images/
    vscode/*.png             NEW — annotated screenshots (see section 7)
  test/
    readability.mjs          NEW — enforces section 3
    vocabulary.mjs           NEW — enforces the banned-word list
    links.mjs                NEW — every data-term resolves; every href is real
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

**Added to existing groups** — 10 terms
- *machine:* `extension`, `live-preview`, `sidebar`, `status-bar`
- *git:* `stage`, `remote`, `diff`, `revert`
- *ai:* `copilot`, `chat-panel`

Total: 60 → 88. Each needs `term`, `term_zh`, `short`, `short_zh`, `full`,
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
9. **Turn on Copilot** — sign in, what the grey text is, Tab to accept,
   Esc to reject. Explicitly: *this is a suggestion, not an answer.*

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
2. **A GitHub account** — and the Student Developer Pack, which is how a
   student gets Copilot without paying.
3. **Push your project** — from the VS Code Source Control panel.
4. **Turn on GitHub Pages** — settings, branch, wait, the `github.io` address.
   Checkpoint: open it on your phone.
5. **Buy a domain** — what a domain costs, where to buy one, and **which
   endings to avoid**: `.dev` is unreliable from China. Recommend a plain
   `.com` or `.net`.
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
- **One theme, one window size.** Dark+ (the default) at 1280×800, so every
  screenshot matches what the student sees and matches every other screenshot.
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

Three scripts, run by `npm test` in this directory, following the localai
pattern of Node tests with no framework.

| Script | Fails when |
|---|---|
| `test/readability.mjs` | Any tab's prose or any glossary entry exceeds the section 3 caps. Prints the offending sentence. |
| `test/vocabulary.mjs` | A banned phrasal verb or a controlled-vocabulary violation appears. Prints file and line. |
| `test/links.mjs` | A `data-term` has no glossary entry; a `#/` href names no tab; a Learn more URL is malformed. |

`test/links.mjs` also protects the existing site: the page carries 29
`data-term` references today (24 of them on Home), checked by hand in the
last build.

Manual checks per tab, in the browser: both themes, 375 px and 1280 px wide,
keyboard only, and one read-through out loud. Reading aloud catches the long
sentences that the grade score waves through.

---

## 9. Open questions and things to verify before writing

These are stated as unverified on purpose. Each needs checking against a
current source before it appears as fact on a page a student trusts.

1. **GitHub Student Developer Pack** — what it currently includes for Copilot,
   and whether a free domain is still part of it. Terms change yearly.
2. **`github.io` reachability from mainland China.** My understanding is that
   it is inconsistent rather than blocked, which is exactly the sort of claim
   that should not be published without checking. If it is unreliable, the
   Publish tab needs a second host as the recommended path, and Cloudflare
   Pages is the obvious candidate since this repository already uses Cloudflare.
3. **ICP filing (备案).** Hosting inside mainland China requires one; hosting
   outside does not. Whether that belongs on a student page at all is a
   judgement call for the owner, not for me.
4. **`.dev` specifics.** The owner reports `.dev` does not load in China. The
   recommendation to avoid it stands on that report alone; the *reason* should
   not be guessed at in the copy.
5. **Copilot in a school setting** — whether a student under 18 can sign in
   without a parent or school account. This affects the Setup tab's step 9.

---

## 10. Build order

Each milestone has a check that says whether it is done.

| # | Work | Verify |
|---|---|---|
| **M0** | `style-guide.md` + the three test scripts | Tests run; readability fails on glossary `full` and Home, as measured in section 3 |
| **M1** | Glossary: 28 new terms, 2 new groups | 88 entries; every entry has all 8 fields in both languages; `links.mjs` passes |
| **M2** | Copy pass: Home + all 60 existing `full` entries | `readability.mjs` and `vocabulary.mjs` pass on everything built so far |
| **M3** | Setup tab, steps 1–6 (through first win) | A person following only the page, on a clean machine, reaches a webpage in a browser |
| **M4** | Setup tab, steps 7–9 (Git, Copilot) | Same walkthrough reaches a first commit and an accepted suggestion |
| **M5** | Workflow tab | The worked example runs as written, all six passes |
| **M6** | Prompting tab | Every frame copies correctly; every frame produces a usable answer when actually sent to Copilot |
| **M7** | Publish tab | Section 9 questions answered first; a test repository reaches a live custom domain |
| **M8** | Final pass | All tests green; both themes; 375 px; keyboard; read aloud |

M0 to M2 are the foundation and should not be skipped to get to the visible
tabs faster. M2 in particular is the one that is tempting to postpone and
expensive to postpone: every new tab links into those entries, and rewriting
them later means re-checking every link that arrived in the meantime.

**Rough weight:** M1 and M2 are the largest writing jobs (88 bilingual entries
touched between them). M3 and M4 are the largest asset jobs (most of the
screenshots). M5 to M7 are mostly prose against a settled pattern.

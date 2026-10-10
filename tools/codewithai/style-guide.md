# Code with AI — Style Guide

How to write every word on this site.

Status: drafted 2026-10-01. Governs `index.html`, every user-facing string in
`js/`, and both languages of `js/data/glossary.js`. If a sentence breaks a rule
here, the sentence is wrong, not the rule.

Most of these rules are enforced by `npm test` in this folder. The test files
are the source of truth for the exact lists; this guide explains why the rules
exist. Where the two disagree, fix whichever one is wrong, in the same commit.

| Rule | Enforced by |
|---|---|
| §2 Reading level | `test/readability.test.mjs` |
| §3 Punctuation, §4 blame words and Latin, §5 phrasal verbs, §6 controlled vocabulary | `test/vocabulary.test.mjs` |
| Glossary data shape, every in-page link | `test/links.test.mjs` |
| Everything else | You, reading it aloud |

---

## 1. Who is reading this

A younger high school student who is **not fluent in English**. They are
building webpages in VS Code on their own laptop, with Copilot beside them.

They are capable. Their English is the bottleneck, not their thinking. Every
rule below exists to keep the English from getting in the way of an idea they
could otherwise understand.

**English is the language of the work, and this site does not trade it away.**
Code, VS Code's menus, error messages and the documentation they will search
are all in English. The glossary's Chinese is there for understanding and
translanguaging: a student reads the idea in the language they think in, then
connects it to the English word. The Chinese never replaces the English term.
Nothing on the tabs is translated; it is written simply instead.

### Inherited from localai, and what changed

This guide starts from `make/localai/style-guide.md`. These rules carry over
unchanged, and that guide has the reasons:

- No em dash. No middot inside a sentence (data labels only).
- No sentence fragments, no rule of three, no rhetorical questions, no reveals.
- Headers are plain noun phrases. A term never appears for the first time in a header.
- Expand every abbreviation at first use. Never define a term with another undefined term.
- Pick the everyday word. Say it once. Use common contractions (*don't*, *it's*, *you're*).
- No clever phrasing, even when it is accurate.

**One rule is reversed.** localai says *"vary sentence length, and let the long
ones be long."* For this reader a long sentence is a wall. Here the cap is 25
words, with no exceptions. When an explanation needs a subordinate clause,
it becomes two sentences.

---

## 2. Reading level

| Text | FK grade | Avg words / sentence | Longest sentence |
|---|---|---|---|
| Tab prose, footer | ≤ 6.0 | ≤ 14 | 25 words |
| Glossary hover cards (`short`) | ≤ 6.0 | ≤ 14 | 25 words |
| Glossary full entries (`full`) | ≤ 7.0 overall, no single entry over 8.0 | ≤ 16 | 25 words |

The full entries are allowed to be a little harder because they are reference
text. A student reads them on purpose, not in the middle of a task.

**How it is measured.** Flesch-Kincaid grade, from sentence length and syllables
per word, using a heuristic syllable counter. The grade is a smoke alarm, not a
verdict: it is blind to idioms, phrasal verbs and word order, which is why §5
exists. A panel's grade is only judged once it has 10 sentences, because on
fewer it measures noise. The whole page is always judged as one sample. The
25-word cap applies everywhere, always.

**What is not measured.** Text inside `<code>`, `<pre>`, `<kbd>`, `<samp>` and
`<q>`, and anything `aria-hidden="true"`. Code and keys are English by rule.
Use `<q>` for a quoted example of jargon, such as an answer full of words the
student does not know yet. That is the only escape, and it should be rare.

**When the test fails,** it prints the sentences. The fix is almost always to
split one sentence into two, then to swap a long word for a short one. Do not
fix a grade by cutting the explanation. Simplify the wording, never the claim.

---

## 3. Punctuation

- **No em dash** (`—`). Use a full stop and a second sentence.
- **No en dash** (`–`), except in a number range: `4–5 bits`.
- **No middot** (`·`) inside a sentence. Allowed in data labels only.
- Keep the colon for a true definition or list.

---

## 4. Words that blame the reader, and Latin

**Never write *simply*, *just*, *obviously*, *of course* or *basically*.** When
the step does not work, these words tell the student the fault is theirs. A
learner also often reads *just* as *only* or *recently*, which changes the
meaning.

**No *e.g.*, *i.e.*, *etc.* or *vs*.** Write *for example*, *this means*,
*and others*, *or*. Many learners have never been taught the Latin forms.

---

## 5. Phrasal verbs

This is the biggest trap for a learner, and a grade score cannot see it.
*Work out* looks like two words the student knows. It means neither of them.
Each phrasal verb is a separate vocabulary item, so use the single verb.

| Do not write | Write |
|---|---|
| set up | install, create, prepare |
| work out, figure out | find, calculate, understand |
| find out | learn, check |
| turn up | appear |
| end up | say what the result is |
| go through | read, follow, pass |
| come up with | think of, write |
| look into | check |
| look up | search for |
| carry out | do |
| point out | show |
| give up | stop |
| put together | build, make |
| run into | meet, get |
| get rid of | remove, delete |
| pick up | learn |
| break down | split, stop working |
| back up | copy, save a copy |
| bring up | show, open |
| leave out | skip, not include |
| shut down | close, turn off |
| sort out | fix |
| mess up | break |
| try out | try |
| keep track of | record, follow |

The test catches the separated form too: *set it up*.

**Allowed on purpose:** *turn on*, *turn off*, *sign in*, *fill in*. These are
the exact words in the interfaces and classrooms the student already uses. If
VS Code's menu says it, the page says it.

---

## 6. Controlled vocabulary

One word for one thing, every time. A learner who reads *folder* in step 3 and
*directory* in step 5 reasonably assumes they are two different things.

Applies to tab prose. The glossary is exempt, because it has to name the
alternatives in order to define them. So is the text of a glossary link,
because linking the other word is how a student learns it.

| Use | Never | Notes |
|---|---|---|
| folder | directory | *Directory* lives in the glossary, linked |
| sign in | log in, login, log on | It is VS Code's own label |
| click | click on, hit | For a button or a link |
| press | hit | For a key: *press **Enter*** |
| terminal | command prompt | The panel inside VS Code |
| go to, open | navigate to | |
| to | in order to | |
| before | prior to | |
| use | utilize | |

**UI labels are written exactly as they appear in English VS Code, in bold:**
click **File**, then **Open Folder…**. Never paraphrase a label. The student is
matching letters on the screen, not meaning.

---

## 7. Instructions

Setup, Workflow and Publish are mostly steps. Steps have their own rules.

1. **One action per numbered line,** in the imperative. *Click **File**.*
   Not *You will need to open the folder you made.*
2. **Action first, reason second.** The student is scanning for what to do.
   The reason, if it is needed, is the next sentence.
3. **Every step ends with a checkpoint:** *You are done when you see this,*
   with a small image. A student who could not read the paragraph can still
   match the picture.
4. **Code is in `<code>`, keys are in `<kbd>`.** Both render in JetBrains
   Mono with ligatures off, so `//` and `</` look like the keys pressed.
5. **Every command is in a copy block.** Nobody should have to type
   `git config --global user.email` from a screenshot.
6. **Windows and Mac are both written out,** never *the equivalent on Mac*.
   The OS switch shows only the relevant one.
7. **Keys are written with `<kbd>`:** <kbd>Ctrl</kbd>+<kbd>Z</kbd> on Windows,
   <kbd>Cmd</kbd>+<kbd>Z</kbd> on Mac.

---

## 8. Accounts, sign-ins and purchases

Steps that involve an account, a sign-in or money are reviewed by a parent or
teacher (owner, 2026-10-01). So **give the complete information.** Do not skip
a step, a price or a warning because the student is young. Say what it costs,
what it asks for, and what happens to the information. Say plainly when a step
needs an adult.

---

## 9. The glossary in two languages

- **The English term is always shown.** In Chinese mode the Chinese term sits
  under it as a subtitle. It never replaces it.
- **`short` is the hover card.** One or two sentences that stand alone, because
  the reader is in the middle of something else.
- **`full` is the entry.** It says what the thing is and why the student needs it.
- **The Chinese is written, not translated,** for a fluent reader. It does not
  follow the English simplification rules, so the two texts stop matching
  sentence by sentence once the English is simplified. That is expected. **The
  facts must stay identical.** If you change a fact in one language, change it
  in the other in the same commit.
- Chinese is Simplified (简体字).
- **Code is marked with backticks** in both languages: `` `<p>Hello</p>` ``,
  `` `git add` ``, `` `example.com` ``. The page shows each span in JetBrains
  Mono with ligatures off, so the student sees exactly the characters to type.
  Mark anything a student would type or read character for character: tags,
  attributes, file names, commands, selectors, addresses. Do not mark product
  names (Git, Python, npm as a name) or keys (those are `<kbd>` on the tabs).
  The tests skip code when grading the English, and fail on an unpaired backtick.

---

## 10. Checklist

Before any user-facing string ships:

- [ ] `npm test` passes in `tools/codewithai/`.
- [ ] No sentence was "fixed" for the test by removing the explanation.
- [ ] Every technical term is defined in place or linked to the glossary.
- [ ] Every UI label is bold and matches English VS Code exactly.
- [ ] Every step has a checkpoint. Every command has a copy block.
- [ ] Read it aloud, slowly. Reading aloud catches what the grade misses.
- [ ] Could a student who reads English slowly follow this without help?

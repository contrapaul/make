# Plan — Visual overhaul: 1-Afternoon Coding Projects site

Target: `tools/build/projects/` (currently live, 4 tabs: random · browse · resources · glossary).
Style donor: `tools/soundboard/` (`css/soundboard.css`, `js/pad-style.js`, `index.html`).

Goal: make the site feel **playful, clickable, and worth exploring** for a student visitor, without touching routing, data, tests, or the glossary mechanism. The original "editorial paper" direction (beige, Georgia, hairlines, 2px radii) is abandoned in favour of the soundboard's "toy hardware" language.

## What makes the soundboard look alive (the transferable set)

| Element | Soundboard value | Where it lives |
|---|---|---|
| Warm cream page | `--bg: #FFF7EA`, white `--surface`, inset `--surface-2: #FFF1D6` | `tools/soundboard/css/soundboard.css:17-26` |
| Ink outlines | `--ink: #1E2240` (navy, not black), `--outline: 3px` on every card/button | `soundboard.css:22, 29-33` |
| Sticker lift | `--lift: 0 4px 0 var(--ink)`, pressed state `0 1px 0` + `translateY(2px)` on `:active` | `soundboard.css:28-29`, `660-677` |
| Radius scale | 12 / 18 / 26 / 999px (pill) | `soundboard.css:33` |
| Type | Fredoka (display) + Nunito (body), self-hosted woff2 in `tools/soundboard/fonts/` (OFL-licensed) | `soundboard.css:36-39` |
| Bright palette | 12-colour pad palette `'#FF6B6B', '#FF9F43', '#FFD93D', '#6BCB77', '#4DD4F0', '#6C8CFF', '#B47CFF', '#FF7AC6', '#FFFFFF', '#C8F169', '#FFB3A7', '#9EE8DA'` | `tools/soundboard/js/soundboard-core.js:168-169` |
| Playful hardware bits | LED dots, LCD status bar, `sb-breathe` + `sb-shake` keyframes, `prefers-reduced-motion` kill switch | `soundboard.css:140-148`, end of file |
| Focus | 3px accent outline, offset 3px, on every control | `soundboard.css:74-81` |

## Design direction for this site

Keep the **cream + navy ink + sticker outline**, take the **bright palette as a category system** (each of the 9 browse categories owns one palette colour, used for its section band, its chips, and a colour stripe on its cards). The random tab becomes the "draw a card" moment: one big poster card with a coloured header band, a chunky pill button, and a soft flip/pop on each draw.

### 1. Tokens & page chrome (`css/style.css` rewrite)

- Replace the `:root` block with soundboard-derived tokens: `--bg #FFF7EA`, `--surface #FFF`, `--surface-2 #FFF1D6`, `--ink #1E2240`, `--ink-2 #4A4F75`, `--line #E7D9BD`, `--accent #6C8CFF` (one palette colour as primary interactive blue-violet), radius scale + `--lift`.
- Fonts: copy `fredoka-latin-wght-normal.woff2` + `nunito-latin-wght-normal.woff2` (plus their OFL licence files) into a new `tools/build/projects/fonts/` with a `README.md` pointing at `tools/soundboard/fonts/README.md`. Fredoka for h1/section headers/card titles, Nunito for body. Zero font requests beyond these two.
- Body: 16px Nunito on cream; visible 3px accent focus rings on links, buttons, selects.
- Header: white sticker bar (3px ink, 26px radius, lift shadow) replacing the current full-width rule line. Brand: small solid pad (14px circle, orange, ink border, like `.sb-brand__mark`) next to the Fredoka title. Sub-tag under it.
- Tabs: **pill buttons** (999px radius, ink border, lift + press), active tab = ink-filled with cream text. Horizontally scrollable on mobile (already works).
- Footer: stays minimal, ink-soft on cream.

### 2. Category colour system (new data: `js/data/categories-colors.js` or fold into `buckets.js`)

Map the 9 buckets to 9 of the 12 palette colours (skip white + the two muted pastels): games→`#FF6B6B`, creative→`#FF7AC6`, utilities→`#6C8CFF`, task processing→`#FFD93D`, data & analysis→`#C8F169`, web & DevOps→`#B47CFF`, learning & CS→`#4DD4F0`, productivity→`#FF9F43`, education→`#6BCB77`. Pure data, unit-testable. This one change is the biggest visual upgrade in the whole plan: every section, chip, and card on the site gets a colour its brain can group by.

### 3. Random tab (`js/tabs/random.js` + CSS)

- The hero card is a **poster**: white, 3px ink, 18px radius, lift; a coloured top band (category colour) with the part label and a big emoji/disc icon for the category; project name in Fredoka ~30px; description in Nunito 17px; chips as pills below.
- The draw button is the **repeated click** of the site: "Draw another card" pill, ~52px tall, ink fill, sticker lift, depresses on `:active`. On draw: card does a fast (150–200ms) scale/fade "pop" (new class, respect `prefers-reduced-motion`).
- The pool line ("you drew from 37 matching ideas") goes into a small LCD-styled strip (`--surface-2`, ink border, mono or Fredoka small-caps digits) as an homage to the soundboard's status bar.
- Filters: the three selects get pill styling + a coloured "clear filters" chip.

### 4. Browse tab

- Section headers: Fredoka, with the category colour as a **thick underline band** (6px, rounded) instead of the current 2px black rule; the show/hide toggle becomes a pill chip next to the title (click the section header row to toggle, per current behaviour).
- Cards: white, 3px ink (soften to 2.5px visually: keep 3px tokens), 12px radius, lift that deepens on `:hover` (`translateY(-2px)` + shadow `0 6px 0`), snap press on `:active`. A **4px left stripe** in the category colour on every card. Card titles Fredoka 19px; description 15px in `--ink-2`; stack in a small mono pill.
- Mode chip: outlined pill (online = accent blue-violet outline, offline = ink outline). Language chips: cream-fill pills.
- "Show all / Hide all" stay as the last two control pills.
- Staggered reveal: cards in the first viewport fade/slide up ~40ms apart on section render (one CSS animation + per-card delay via inline `--i`), gated by `prefers-reduced-motion`. Cap the stagger at ~20 cards so the rest render instantly.

### 5. Resources & glossary

- Resources: three staple cards in the new card style, each with a big glyph (📦 build · 🅻 languages · 🎓 codewithai); the ghost card keeps its dashed border but in the new palette (muted, `--line` border).
- Glossary: header + A–Z jump **index chips** as a pill strip (wrapping); entries keep the list layout but with 18px Fredoka terms and dotted accent underlines on inline `.gloss` links (keep existing hover mechanism unchanged).
- `#gloss-tip` hover card: restyle as a mini card (white bg, 3px ink, 12px radius, lift) instead of the dark block.

### 6. Copy pass (student-for-student, no corporate tone)

Chrome copy (cheap, in `index.html` + tab modules):

- Title stays; tag → "150 tiny builds. Pick one, ship it in one afternoon with an AI assistant, and you'll know more than before dinner."
- Random tab pool line → "Drawn from 37 ideas that match. Tap the button and see what the deck throws at you."
- Buttons: "Another one" → "Draw another". Controls: Honest, short, second-person. No em dashes, contractions OK — the same mechanical style-guard rules localai uses (the site already inherits `localai/style-guide.md` from the approved plan; keep enforcing them on new copy).
- Footer → "Every idea here fits in one sitting. Done a build? The next draw is always free."

Card-level copy (150 descriptions) is **out of scope for this pass** — it regenerates from `projects.md` via `build-data.mjs` and is a bigger, separate review. Optional follow-up: run the `why` notes (already written, in `notes/batch-0X-notes.js`) as a per-category intro line above each browse section, which gives each section a voice without touching generated data.

### 7. Non-goals / constraints

- No build step, no npm deps, no new runtime (only two vendored font files).
- No changes to `app.js` routing, `gloss-hover.js`, data files, or test suite behaviour. Existing `node --test` suite must stay green; add one tiny test for the new category→colour map (all 9 buckets have valid hex, no collisions).
- Colour contrast: every new text/background pair must clear 4.5:1 (soundboard already proves the token set passes; palette colours are used for bands/stripes/chip borders, with ink text, not as body text on each other).
- Respect `prefers-reduced-motion`: single media query killing transitions/animations, copied from `soundboard.css`.
- Keep the existing `tools/test:browser` style verification habit in mind: verify at phone + desktop widths on all 4 tabs before deploy.

## Build order (tiny commits, one per step)

1. **Tokens + fonts + header/tabs/footer** (`css/style.css` rewrite, `fonts/`, `index.html`) — the whole site instantly changes character.
2. **Category colour map** (+ test) and colour wiring in browse sections/cards.
3. **Card + chip + button component styles** (shared by all tabs).
4. **Random tab poster treatment** + draw pop animation + LCD pool strip.
5. **Browse reveal stagger** + hover/press motion.
6. **Glossary + resources restyling** (jump chips, tip card, ghost card).
7. **Chrome copy pass** (index.html + tab strings), run style-guard rules.
8. **Verify**: `npm test` green, `wrangler pages dev` boots clean, manual check all 4 tabs at phone + desktop widths, screenshot both. Deploy.

Each step is a revertable slice; the site is broken-look-only (never broken-function) between steps.

---

## Appendix: Copy review (2026-10-28)

Scope: all reader-facing copy. Three tiers, in order of how much a reader sees them.

### Tier 1 — Chrome (rewritten in the overhaul)
New tag, footer, "Draw another", pool line, tab intros. All human-checked, no em dashes.

### Tier 2 — 150 `why` notes (`notes/batch-0{0,1,2}-notes.js`) — the subtext
Best of the three tiers, but three systematic tells:
1. **"You will …" prognostication** — 22 of 150 lines open or pivot on it ("You will practice the kinds of state…", "You will crawl a site…"). Reads like a course catalogue.
2. **Hype residues** (2–3% of lines): "killer feature" (p016-batch-file-renamer), "one of the fastest satisfying payoffs" (p036-svg-geometric-pattern-generator), "doubly useful" (p012-gitignore-generator), "fun enough that you will iterate… past the point where the code should be done" (p024-random-story-generator), "alive" used four times in the sense of "feels cool" (p001-flappy, p007-hangman, p031-kaleidoscope…).
3. **Repetitive sentence shapes** — the stock form is "[Subject] is [X and Y], and you will [learn/see/get] [Z]". The content is genuinely good but the cadence is.

### Tier 3 — 150 `description` lines (`projects.js`, generated from `projects.md` via `build-data.mjs`) — what ships on every card
Wire-spec telegraphs, not sentences: "Upload an image → get a 5-color hex palette.", "Type English → see 6-dot braille grid (and reverse); export as a print-ready SVG.", "Timed adaptive drill; wrong answers resurface more often; streak & accuracy badges." Consistent and scannable, but reads like an API doc. This tier is the main source of the "boring" feeling, because it is the first thing a card shows.

### Bugs found in review (dialect/typos, fix regardless)
- `p038-markdown-notes-app`: "feels selfevident" → "self-evident" (batch-00 notes)
- `p009-anatomy-diagram-quiz` (batch-01/2 Part 3, anatomy entry): "A scored label the diagram quiz with a reveal correct labels mode sizes for whole-class review." — garbled, needs full rewrite
- `p013-sudoku-solver-generator`: "a hard-to-destroy hard puzzle" — repeated word
- `p039-text-to-speech-reader`: "...sync text with the spoke-word event." — should be specked word boundary event, garbled
- `p013-gitignore-generator` (contributes to "magic" use): "until logs/ and *.pyc stop looking like magic"

### Recommendation (owner decision)
- 1: fix the five bugs above (cheap, do now)
- 2: rewrite the ~27 worst Tier-2 lines (22 "you will" + hype residues, deduplicated) to drop the course-catalogue cadence, keeping the content
- 3: Tier 3 rewrites are a separate project: the descriptions are generated, so a rewrite means editing projects.md (source of truth) + regen + revalidation, and the current terse style is arguably right for a card grid. Cheaper alternatives: (a) surface the `why` note as the card's visible second line instead of the generated description (it is written in exactly the human voice these cards lack), or (b) leave Tier 3 as is.

### Copy pass — done (2026-10-28, owner chose items 1+2)
- All 5 typos/garbles fixed (self-evident, sudoku repeated word, TTS boundary-event line, anatomy sentence rewrite, gitignore "magic/doubly useful").
- 20 course-catalogue cadence lines rewritten across batches 00–01; 4 hype lines deflated (killer feature, fastest satisfying payoffs, doubly useful, iterate-past-the-point).
- Remaining 3 "you will" in batch-00 are idiomatic ("smallest state machine you will ever write") and kept on purpose.
- Tier 3 (150 generated description lines) untouched: item 3's cheaper alternatives (why-note-as-visible-line, or edit projects.md + regen) still open if wanted.

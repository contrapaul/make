# HANDOFF: tools/chinese (汉语词汇 · Chinese Vocab Review)

Start here. This file records where things stand and what is left. Plans live next to it;
the repo convention puts planning in `specs/`, Paul chose to keep these two beside the code.

Static sub-site of `make` at `tools/chinese/`, served from `make.contrapaul.com`. No build
step: static HTML plus `js/data.js`, which `parse_vocab.py` generates from
`../LearningChinese/ExpandedVocab.md`.

## Plans waiting to be built

| Plan | State | Order |
|---|---|---|
| `PLAN-fonts.md` | **Built 2026-11-08**, all checks green | done |
| `PLAN-conversations.md` | **Built 2026-11-08**, all checks green; waiting on the 42 mp3s | done |

Both plans were written with the owner present and every open question answered. Do not
re-litigate a decision listed under "Decisions" in either plan; if one looks wrong, say so
rather than quietly deviating.

## 2026-11-09: reviewer pass on the conversations code

**Asked:** review the newly added code for bugs before handover.

Two reviewer dispatches timed out at 30m (they over-read the repo). A third, budgeted to
three files, returned 10 findings. All were checked against the code and data first:

- **Fixed (real).** (1) Play all pressed while a card already played orphaned the queue:
  `advance()` re-handed the playing card to `playCard()`, which read it as a second tap
  and stopped. `startQueue()` now stops first. (2) `advance()` treated *unprobed* as
  playable; with probes deferred to scroll, a cold Play-all guessed wrong either way, so
  it now resolves each card with a HEAD (`probe()` returns a promise, in-flight probes
  are shared). (3) A dropped request on venue wifi marked a card pending forever: a probe
  rejection now `ready.delete()`s so a later render re-probes; only a real response marks
  a card missing. (4) A device pause (screen lock, incoming call) never fired `ended`, so
  the queue sat on Stop forever; a `pause` listener ends the queue, guarded by
  `selfPause` + `audio.ended` + `readyState 0` so our own `stop()`s do not count. The
  short-lived `selfPause` flag is load-bearing: the browser dispatches the pause task
  *after* `stop()` returns and after the next clip can be loaded (observed `readyState 4`
  with `ended:true`), so a flag cleared on the next task was not enough. (5) Pending
  buttons were separated from ready by `opacity: 0.38` alone, near invisible in sunlight
  on a glossy iPad; pending now also gets a dashed border and a faint glyph (the
  `cursor: default` was dropped, inert on touch). (6) The auto-play toggle is remembered
  between visits but rendered identically on and off; `#cvAutoplay[aria-pressed="true"]`
  now gets the seal background. (7) `p` always played the top card and a held key
  restarted it; it now targets the card nearest the middle of the screen and ignores
  `e.repeat`. (8) The caption hard-coded "42"; built from `CONVERSATIONS.length`.
  (9) Missing `conversations-data.js` left the `载入中…` placeholder forever; it now says
  what to run. (10) `advance()` could overtake a manual tap landing during a probe; it
  bails when `current` is set and lets the `ended` handler carry on.
- **Rejected (false positives, verified).** Role glyph B: section B cards are all role
  `S` (rendered 说, matching the 说 tab); `B`/`C` appear only in section C as candidate
  answers, where 答 is right. Gate `!== false` on the card tap: correct there (unknown is
  worth one attempt) where `advance()` needed the resolve-first behaviour above.

**Also found locally, not by the reviewer.** Under `wrangler pages dev` a missing file
returns `200` + `text/html` (SPA fallback), which `r.ok` alone read as playable; the probe
now rejects an HTML content-type. Verified a real mp3 still reports `audio/mpeg` under
both wrangler and `python3 -m http.server`.

**Tests.** `verify_conversations.mjs` grew from 40 to 52 checks: play-all over a playing
card, device pause, cold play-all resolving unprobed cards, search/tab mid-queue,
Stop-all mid-queue, `p` targeting and `p` inside the search box, pending-vs-ready styling.
The Audio element is wrapped via `Page.addScriptToEvaluateOnNewDocument` (it lives in a
closure), and playback is asserted on `play` events, not the network log, because a
re-fetched clip is served from cache. One flake fixed: a fixed 1400ms sleep after a 0.6s
stub occasionally read `playing`; now a `waitFor`. 5 clean consecutive runs.
`verify_fonts.mjs` unchanged at 44 green.

**Not verified by eye:** this model cannot open the screenshots in `test/shots/`.
Rendering is covered by the geometry and layout checks, but the screenshots need Paul's
eyes.

## 2026-11-08: both plans built

**Asked:** Paul said "Let's go ahead and build the pages" (fonts first, then the
conversations page), after the two plans were signed off.

**Fonts (PLAN-fonts.md F1–F4).** `build_fonts.py` downloads the four upstream families
into a gitignored `.fonts-src/`, subsets them against the characters this site really
renders (`font_coverage.py` harvests them from `js/*.js`, `*.html`, `js/*.json`,
`css/*.css`), and writes `css/fonts.css` plus `fonts/*.woff2`. `css/style.css` lost the
Google `@import` and gained `@import url(fonts.css)`; `--latin` is now Source Serif 4 and
Noto Serif SC sits at the end of `--ui` so `↕ ▼ ≡` resolve locally. `✅ ❌ ✕` are drawn
in CSS instead of shipped as emoji. 4 files, ~485 KB, zero external requests.

**Conversations (PLAN-conversations.md).** New page `conversations.html` plus
`js/conversations.js`, generated `js/conversations-data.js`, `build_conversations.py`,
`check_audio.py`, `audio/conversations/README.md`, and a CSS block in `style.css`. The
parser reads `../LearningChinese/conversations.md` (the copy in this folder is a
reference only) and prints **42 cards, 77 speakable lines** (the plan said 75, which
miscounted; 77 is the verified number: A 21 cards/42 lines, B 14/14, C 7/21). Play
button per card, one shared `<audio>`, auto-play as an opt-in toggle persisted in
localStorage, keyboard `p` plays the card nearest the middle of the screen. `index.html`
loads `js/conversations-data.js` and fills `#countCards` from `CONVERSATION_COUNTS`, so
the index row does not carry a number that can go stale (same trick as `#countVocab`). Audio files are addressed as
`AUDIO_BASE + id + '.mp3'` with `AUDIO_BASE = 'audio/conversations/'` in one place, so
dropping mp3s in needs no code change; `python3 check_audio.py` lists what is missing and
exits non-zero until all 42 are there. All five existing pages gained the sidebar link,
and the tabbar swapped Tone Trainer for Conversations (Tones → Chats), as decided.

**Tests.** `test/browser.mjs` is a shared headless-Edge harness (http.server + CDP, records
every request URL). `test/verify_fonts.mjs` covers all six pages; `test/verify_conversations.mjs`
drives the new page with real mouse clicks (Runtime.evaluate clicks are not user gestures,
so a sound that only played from a scripted click would prove nothing) and generates two
stub mp3s, then deletes them. Both are green: 44 font checks, 43 conversation checks.

**Decisions taken while building**
- Readiness is probed per card with a `HEAD` request when the card nears the viewport,
  not for all 42 on load, so a page open on venue wifi does not compete with the fonts.
  A card with no file gets a dimmed *pending* button with an honest aria-label, and is
  skipped by Play-all rather than stalling the queue. The probe rejects a `200` whose
  `content-type` is HTML: `wrangler pages dev` answers a missing file with the SPA
  fallback page (200 + `text/html`), which `r.ok` alone would read as playable. Real
  mp3s return `audio/mpeg` under both `wrangler` and `python3 -m http.server`, so only
  HTML is rejected; a server that sends no content-type for a real file stays playable.
- An audio event only counts while `audio.src` still matches the card being played.
  Clearing `src` to cancel a clip makes the browser fire a late `error` for it, which
  otherwise blacklisted the card that had just taken over.
- Searching or switching section mid-queue filters the queue to what is on screen and
  stops a card that has just been filtered out, so no sound is left with no button to
  own it. A queue that empties this way ends itself and resumes if cards come back.
- Auto-play stays off by default: browsers refuse unattended `play()`.

**Still unverified**
- The 42 recordings do not exist. Everything about audio was proven against two
  ffmpeg stub tones, so the *contract* is tested, not the real clips. Re-run
  `verify_conversations.mjs` once the first real mp3s land, and listen on the iPad.
- The visual result has not been eyeballed: the model driving this session cannot see
  images, so layout was asserted by geometry (alignment, clipping, type scale, touch
  size) rather than looked at. Screenshots are in `test/shots/` for Paul.
- No deploy yet, and nothing here is committed.

## Why fonts goes first

All five pages load three Google font families. Measured on 2026-11-08:

- One `css2` request, 349 KB, declaring **324 `@font-face` rules** (303 of them Noto Serif SC
  unicode-range slices).
- The text this site actually contains triggers **105 of those slices = 6.04 MB**, plus latin
  slices, from a host that is blocked on mainland home and mobile networks.
- Replacement: 4 self-hosted woff2 files, **about 485 KB**, 4 requests.

Separately, and independent of China: `Newsreader` and `Instrument Sans` do not contain the
eight third-tone pinyin glyphs (`ǎ ǐ ǒ ǔ ǖ ǘ ǚ ǜ`). **7,971 of them** are rendered by this site
(5,100 in `js/data.js` alone). Each falls back to the browser's system serif glyph by glyph.
Verified against the upstream variable fonts, so this is absent upstream and subsetting cannot
fix it. `--latin` therefore moves to **Source Serif 4**, which has them all.

## Decisions already made (Paul, 2026-11-08)

**Fonts**
- `--latin` (every pinyin line) becomes Source Serif 4, self-hosted, variable 400-600.
- Emoji chrome is fixed in the same task: `✅ ❌` become CSS state marks, `✕` on the chip remove
  button becomes CSS-drawn, and Noto Serif SC joins the end of `--ui` so `↕ ▼ ≡` resolve locally.
- Fonts task ships before the conversations page.

**Conversations page**
- One audio file per card, whole exchange, 42 files: `audio/conversations/a01.mp3` .. `c07.mp3`.
- Per-card play button **and** a global auto-play toggle, default **off**, persisted in
  localStorage.
- Hanzi, pinyin and English all visible at once. No flip-to-reveal in v1.
- `tools/chinese/conversations.md` is a **read-only reference copy**; the parser reads
  `../LearningChinese/conversations.md`. `../LearningChinese/conversation.md` is left alone.
- **Tone Trainer comes out of the mobile tabbar** (keeps its sidebar link), so the bar stays
  at 5 items when Conversations is added.
- ffmpeg stub mp3s are for testing only and are **deleted after verification**. Paul advises
  when the real recordings are in place.

## Facts worth not re-deriving

- 42 cards in `conversations.md`: A1-A21, B1-B14, C1-C7. **77 speakable lines** (28 Q, 35 answer
  variants, 14 bare B-section statements). The two plans said 75; the parser's real count is 77.
  41 `New words:` / `Note:` lines are not speakable.
- Unique CJK glyphs the site renders: **1,059**. Total codepoints for the CJK face: 1,215.
- Subset sizes actually measured with fontTools 4.68.0: CJK variable 400-600 = 387 KB, three
  static cuts = 681 KB. Source Serif 4 roman 40 KB, italic 32 KB. Instrument Sans 26 KB.
  Source Sans 3 measured at 32 KB but is **not needed**.
- Glyph holes that fonts cannot solve: `✕` U+2715 and `✅ ❌` (emoji) are missing from every
  candidate face. `─` U+2500 is missing from Instrument Sans but appears only in JS comment
  separators, never rendered.
- `tools/chinese` has **no** audio, no tests, and no lint. `package.json` at the repo root
  tests only the soundboard and projects sites. Nothing catches a regression here.
- The only Google Fonts references in the whole `make` repo are these five files:
  `tools/chinese/{index,lessons,glossary,sentence-builder,tone-trainer}.html`. Other sub-sites
  (`tools/build/projects`, `tools/soundboard`, `WEB`, `fun/gametools`, `bloodbowl`) already ship
  local `@font-face`, which is the pattern to copy.
- Page chrome (sidebar, topbar, tabbar, theme script) is copy-pasted into every page, not
  shared. Adding a page, or changing the tabbar, means touching all five.
- `python3 -m http.server 8000` to test; `fetch` fails over `file://`.
- Machine now has `fonttools` 4.68.0 and `brotli` 1.2.1 installed via pip. Not project deps.

## Commands

```sh
cd /Users/paul/Documents/GitHub/make/tools/chinese
python3 -m http.server 8000          # then open http://localhost:8000/
python3 parse_vocab.py               # regenerate js/data.js (+ anki_import.csv) from ../LearningChinese
python3 build_anki.py                # regenerate chinese_vocab_anki.apkg (needs genanki)
cd /Users/paul/Documents/GitHub/make && npm test           # soundboard + projects only, NOT this site
npx wrangler pages dev               # repo-level boot check before deploy
```

## Unverified / open

- Both plans are built and green. What is left is Paul's, in order:
  1. Look at the screenshots in `test/shots/` (fonts) and `test/shots/conversations/`
     (the new page), light and dark, desktop and phone. This model cannot open images, so
     the visual sign-off has not happened.
  2. Record or generate the 42 clips into `audio/conversations/` (one per card, whole
     exchange, `a01.mp3` … `c07.mp3`). `python3 check_audio.py` lists them and goes green
     when they land. No AI-generated audio without Paul asking, and a TTS pass would need
     a zh-CN voice plus a listening check on `shí'èr` and the brand names.
  3. Decide the fate of the duplicate card file: this folder's `conversations.md` is a
     reference copy; `../LearningChinese/conversations.md` is what the parser reads.
- Visual consequence of Newsreader to Source Serif 4 is unreviewed. The F3 screenshot pass in
  `PLAN-fonts.md` is the sign-off point, and the fallback is documented there.
- Whether to take the CJK trim lever (one static weight, 227 KB instead of 387 KB, at the cost
  of lighter display headings) is still Paul's call at build time.
- The 42 audio clips do not exist. The page is built for that: a card with no file shows a
  dashed pending button and is skipped by Play-all, auto-play and `p`.
- The repo has no CI. Verification is the two `node tools/chinese/test/verify_*.mjs`
  scripts plus `python3 check_audio.py` and `python3 font_coverage.py`.

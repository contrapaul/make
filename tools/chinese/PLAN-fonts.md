# Plan: self-hosted fonts for tools/chinese (China-accessible type)

Status: DRAFT, not built. Decided with Paul 2026-11-08: this task runs **before**
the Flash Conversations build. Owner: Paul.

## 1. Goal

Remove every request to another host from `tools/chinese`, so the site renders
identically on a venue or school network in mainland China. Today all five pages
load three Google font families from `fonts.googleapis.com` and `fonts.gstatic.com`.

Measured today (all figures from real fetches on 2026-11-08, spike in `/tmp/fontspike`):

| Measurement | Value |
|---|---|
| Google Fonts stylesheet request | 349 KB, one `css2` call, **324 `@font-face` rules** |
| `@font-face` split | Instrument Sans 6, Newsreader 15, Noto Serif SC **303** unicode-range slices |
| NSS slices the site's own text actually triggers | **105 slices = 6.04 MB** |
| NSS worst case (every slice fetched) | 17.25 MB |
| Latin slices (Instrument Sans + Newsreader) | 21 slices, 592 KB downloaded as all weights |
| **Total payload the page wants today** | **about 6.6 MB, from a blocked host** |

Blocking evidence (not assumed, sourced):
- GreatFire: `fonts.google.com` 100% disrupted in the last 3 conclusive tests, last test
  2026-11-03. <https://en.greatfire.org/https/fonts.google.com>
- 21YunBox probe: `fonts.googleapis.com` answered 72/72 (111 ms median) from an Alibaba
  Cloud Zhangjiakou server on 2026-08-28, but **0 of 54 from a Beijing China Mobile home
  line** on 2026-08-30. Home broadband and mobile data is the audience, not the datacentre.
  <https://www.chinawebfoundry.com/resources/china-web-guide/google-fonts-china/>
- AppInChina: "the Google Fonts API is blocked in China... host the fonts locally."
  <https://appinchina.co/does-google-fonts-api-work-in-china/>

So the fix is not "use a mirror". It is: no third-party font host at all.

## 2. The bug the spike found (bigger than the China problem)

`Newsreader` and `Instrument Sans` **do not contain the eight third-tone pinyin
glyphs**. Verified against the upstream variable fonts in `google/fonts`:

| Glyph set | Newsreader VF | Instrument Sans VF | Noto Serif SC VF | Source Serif 4 VF | Source Sans 3 VF |
|---|---|---|---|---|---|
| `ǎ ǐ ǒ ǔ ǖ ǘ ǚ ǜ` (U+01CE..01DC) | **0/8** | **0/8** | 8/8 | 8/8 | 8/8 |
| `ā ē ī ō ū ǎ ě` macrons/carons | partial | partial | yes | yes | yes |
| `↕` U+2195, `≡` U+2261 | missing | missing | **yes** | missing | yes |
| `▼ ▲ → ·` and U+2014 / U+2026 dashes and ellipsis | yes | yes | yes | yes | yes |
| `✕` U+2715 | missing | missing | missing | missing | missing |
| `✅ ❌` (emoji) | missing | missing | missing | missing | missing |

Count of third-tone pinyin glyphs rendered by this site: **7,971**
(`js/data.js` 5,100, `tone-trainer.js` 11, `sentence-builder.js` 11, plus the rest across
`data.js`/html). Every one of those falls back to the browser's system serif today, glyph by
glyph, inside a Newsreader line. Pinyin is the whole point of a Chinese study site, and its
tone marks are the one thing not under our font control.

This is not a China-only defect, and subsetting will not fix it: the glyphs are absent
upstream. It needs a different family for the pinyin face.

## 3. Decisions (Paul, 2026-11-08)

1. **`--latin` (all pinyin) moves to Source Serif 4.** It has every pinyin glyph plus
   `↕ ≡ ▼`. Chosen over "keep Newsreader and accept the per-glyph system fallback" and over
   a Newsreader/Source Serif 4 hybrid, which would mean maintaining four latin faces.
2. **Emoji and chrome glyphs are fixed in this task.** `✅ ❌` become CSS marks, `✕` becomes
   a CSS-drawn cross, and the CJK face joins the `--ui` stack so `↕ ▼ ≡` resolve locally.
3. **This task ships first.** The Flash Conversations page is then born with local fonts and
   needs no rework.

## 4. Target state

Three loaded families, four files, all committed under `tools/chinese/fonts/`:

| File | Source | Weights | Measured size |
|---|---|---|---|
| `fonts/noto-serif-sc.woff2` | `NotoSerifSC[wght].ttf` | variable 400-600 | **387 KB** |
| `fonts/source-serif-4.woff2` | `SourceSerif4[opsz,wght].ttf` | variable 400-600 | **40 KB** |
| `fonts/source-serif-4-italic.woff2` | `SourceSerif4-Italic[opsz,wght].ttf` | variable 400-500 | **32 KB** |
| `fonts/instrument-sans.woff2` | `InstrumentSans[wdth,wght].ttf` | variable 400-600 | **26 KB** |
| | | **Total** | **about 485 KB, 4 requests** |

That is 6.6 MB of blocked requests replaced by 485 KB of local, cacheable files, and pinyin
tone marks stop being a coin flip.

Notes:
- Variable beats static here. Three static CJK cuts measure 681 KB total; the single
  400-600 variable file is 387 KB and one request. Same story on the latin side
  (187 KB static vs 40 KB variable).
- `opsz` and `wdth` are pinned to their default at build time, which is what produced the
  sizes above (unpinned `opsz` bloats the latin files).
- Instrument Sans stays the UI face. It has `↑ → ↓` but lacks `↕ ≈ ≡ ▼` (and `─`, which appears
  **only in JS comment separators**, never rendered), so it needs NSS in its stack rather than
  a family swap.
- No new families beyond the swap: Newsreader leaves, Source Serif 4 arrives, and Source
  Sans 3 was measured (32 KB) but is **not** needed.

### Trim lever (optional, decide at build)

One CJK weight only (`wght` pinned to 500, static): 227 KB instead of 387 KB, so the whole
set drops to about 325 KB. Cost: `.seal-mark`, `.sidebar-title` and `.home-hero h1` render
at 400 instead of 600 and will look slightly lighter. Only take this if 485 KB feels heavy.

## 5. Token and CSS changes

Only `css/style.css` is touched for the font declarations, plus the five HTML heads.

```css
/* tokens, replacing lines 29-31 */
--cjk:   "Noto Serif SC", "Songti SC", "STSong", "SimSun", serif;
--latin: "Source Serif 4", "Noto Serif SC", "Iowan Old Style", Palatino, Georgia, serif;
--ui:    "Instrument Sans", "Noto Serif SC", -apple-system, "Helvetica Neue", Arial, sans-serif;
```

- `Noto Serif SC` goes **immediately after** the intended face in both `--latin` and `--ui`,
  not at the end of the stack. Instrument Sans source VF lacks `↕` U+2195, `≈` U+2248, `≡` U+2261
  and `▼` U+25BC (it does have `↑ → ↓`), and Source Serif 4 lacks `↕ ≡ ─`. Those chrome glyphs
  must come from a file we ship. If `-apple-system` or `Helvetica Neue` sit first, macOS answers
  them from San Francisco and Windows answers from something else, which is exactly the
  non-determinism being removed here. Since each face covers every ASCII and pinyin codepoint
  it is meant to render, NSS only ever supplies glyphs that face is missing.
- `.sort-indicator` (`↕`) and `.tool-row-arrow` (`→`) set no `font-family`, so they inherit
  `--latin` from `body`; `button` takes `--ui` (`style.css:120`), which is why `≡` and `▼` need
  NSS in that stack too.
- `@font-face` block goes at the top of `css/style.css` (matches the repo pattern in
  `tools/build/projects/css/style.css`), with `font-display: swap` and
  `src: url("../fonts/<file>.woff2") format("woff2")`. No `@import`.
- Remove from all five pages (`index.html`, `lessons.html`, `glossary.html`,
  `sentence-builder.html`, `tone-trainer.html`): the two `preconnect` links and the
  `css2?family=...` stylesheet link. Five pages, three lines each.

## 6. Build script: `build_fonts.py`

Follows the existing `parse_vocab.py` / `build_anki.py` shape (a plain committed Python
script, no CI dependency, run by hand).

1. Download the four upstream TTFs from `raw.githubusercontent.com/google/fonts/main/ofl/...`
   into a gitignored `.fonts-src/`. Pin the commit SHA in the script, not `main`.
2. Build the codepoint set **from this site's own text**, exactly as the spike did:
   `js/*.js` + `*.html` + `conversations.md`, split into a CJK set (U+3400-4DBF, U+4E00-9FFF)
   and a latin set (ASCII plus every non-ASCII char found). Measured: 1,059 unique CJK chars,
   1,215 codepoints for the CJK face, 156 for the latin faces.
3. Subset with `fontTools.subset` (`layout_features=['*']`, `notdef_outline=True`), then
   `fontTools.varLib.instancer.instantiateVariableFont` to clamp `wght` and pin the other
   axes. Write `flavor='woff2'`.
4. Write the four woff2 files plus `fonts/LICENSE-*.txt` (OFL texts for the three families)
   and a `fonts/README.md` recording the source repo, pinned SHA, codepoint counts and the
   exact command, so a future maintainer can regenerate without re-deriving this.
5. **Fail the build** if the coverage audit finds a missing glyph that the site renders and
   the target face was supposed to have. This is the check that would have caught the
   Newsreader pinyin hole.

Dependencies: `fonttools` and `brotli` (both installed on this machine now, 4.68.0 / 1.2.1).
Add a one-line `pip install` note in `fonts/README.md`; do not add a `package.json` dep.

### Known glyph gaps to close in code, not in fonts

Subsetting cannot invent glyphs. These five are absent from every candidate face and are
emoji or symbols used as UI chrome:

| Glyph | Where | Fix |
|---|---|---|
| `✅` U+2705 | `tone-trainer.js:158`, `sentence-builder.js:324` | CSS `::before` content mark using `--green`, or a `correct` class already on the element. Feedback bars already carry `.correct` / `.incorrect` colour state (`style.css:1117`, `1214`) |
| `❌` U+274C | `tone-trainer.js:161`, `sentence-builder.js:233` | same, with `--red` |
| `✕` U+2715 | `sentence-builder.js:357` (`.slot .remove-btn`) | CSS-drawn cross on `.remove-btn` (two rotated pseudo-elements, or `background` linear-gradients). It is a 17px circle today (`style.css:963-981`) |
| `🗣` U+1F5E3 | decorative only, `conversations.md` heading, not rendered by the site | ignore |
| `↕` `▼` `≡` | `glossary.html:64-66`, `main.js:163`, `lessons.js:107`, `index.html:55` and friends | resolved by the `--ui` / `--latin` stack change in §5, no JS edit |

Rule for the two feedback strings: drop the emoji from the JS template literals and let CSS
carry the state mark. The verdict is already encoded in `type` (`'correct'` / `'incorrect'`),
so the emoji is decoration, not information. Keep the text after it.

## 7. Verification (evidence before "done")

There is no preflight in this repo (`package.json` tests only soundboard and projects), so
the gate is built per task:

1. **Failing test first.** A coverage audit script that renders each rendered codepoint
   against the shipped woff2 and reports misses. Run it against the **current** Google-hosted
   Newsreader files first and show it failing on the eight carons. That is the red test.
2. `python3 build_fonts.py` -> four files with the sizes in §4, deterministic (byte-identical
   on a second run).
3. `grep -rn "googleapis\|gstatic" tools/chinese` prints nothing.
4. Serve `python3 -m http.server 8000` from `tools/chinese` and load all five pages. Network
   panel: **zero requests to any host other than localhost**. This is the acceptance test for
   the China requirement.
5. Block-and-screenshot check: load with the network panel showing no external calls at all,
   at desktop and 375px, light and dark. Confirm:
   - pinyin third tones (`nǐ hǎo`, `shénme`, `wǒ`, `lǎoshī`) render in Source Serif 4 italic
     in seal red, same metrics as the rest of the pinyin line;
   - `汉语词汇` seal and sidebar title still render bold (variable weight working);
   - glossary sort arrows `↕`, accordion `▼`, and the `≡` toggle render (no tofu boxes);
   - the chip remove button still looks like an X and is still tappable at 44px.
6. Headless Edge for the regression pass (Edge is installed; the soundboard already drives
   headless Edge from this repo, see `npm run test:browser`), screenshotting tone-trainer
   feedback in both states after the emoji swap.
7. `npx wrangler pages dev` boots clean before deploy.

## 8. Milestones

| # | Deliverable | Gate |
|---|---|---|
| F1 | Coverage audit script written and **red** against current fonts (proves the 8-caron hole) | red test on record |
| F2 | `build_fonts.py` + four woff2 + licenses + `fonts/README.md` | sizes match §4, deterministic |
| F3 | `style.css` tokens + `@font-face`, Google tags removed from 5 pages | 0 external requests in the network panel |
| F4 | Chrome-glyph cleanup (`✅ ❌ ✕`, `↕ ▼ ≡`) | both tools' feedback states screenshot-verified |

## 9. Out of scope

- Any other sub-site. `grep` shows the only Google Fonts references in the whole repo are
  these five files (`tools/chinese/*.html`). `tools/build/projects`, `tools/soundboard`,
  `WEB`, `fun/gametools` and `bloodbowl` already ship local `@font-face`.
- Font hinting or `size-adjust` fine tuning beyond what looks right on inspection.
- Adding new typefaces or a design change. This is a substitution task, not a redesign.
- The Flash Conversations page itself (see `PLAN-conversations.md`).

## 10. Flags

1. **Visual change is real.** Newsreader and Source Serif 4 are both transitional serifs,
   but they are not the same face. Pinyin, English definitions and every prose line shift.
   F3's screenshot pass is the sign-off point; if the swap reads badly, the fallback is
   option 2 from §3 (keep Newsreader, live with the system fallback on third tones).
2. **485 KB of fonts on first load** is not trivial on venue wifi, but it is one-time and
   cacheable, against roughly 6.6 MB today. If it feels heavy, take the §4 trim lever.
3. **`--ui` gains a CJK family in second position.** Harmless (per-glyph fallback), but it means
   the seal glyphs in the tabbar and sidebar, and the `↕ ▼ ≡` chrome marks, fall to NSS instead
   of the system font. That is the intended improvement, not a bug, and it is what makes the
   rendering identical on macOS, Windows and a venue Android tablet.
4. **fontTools is a manual dependency.** Not in `package.json`, no CI runs it. A future
   rebuild needs `pip install fonttools brotli`. Recorded in `fonts/README.md`.

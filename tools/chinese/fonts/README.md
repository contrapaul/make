# fonts/

Self-hosted web fonts for this site. Nothing here is fetched from another host at run
time, which is the point: the audience reaches us from school and venue wifi in mainland
China, where Google's font CDN does not answer.

Do not edit these files by hand. They are generated.

| File | Family | Role | Weights | Bytes |
|---|---|---|---|---|
| `noto-serif-sc.woff2` | Noto Serif SC | `--cjk`, plus the CJK tail of `--latin` and `--ui` | variable 400-600 | about 386 K |
| `source-serif-4.woff2` | Source Serif 4 | `--latin` roman (pinyin, English, prose) | variable 400-600 | about 41 K |
| `source-serif-4-italic.woff2` | Source Serif 4 | `--latin` italic | variable 400-600 | about 34 K |
| `instrument-sans.woff2` | Instrument Sans | `--ui` | variable 400-600 | about 26 K |

Total about 487 KB in four requests, replacing roughly 6.6 MB of blocked requests.

## Rebuild

```sh
pip install fonttools brotli          # not project dependencies
python3 build_fonts.py                # writes this directory
python3 font_coverage.py              # gate: exits 1 on any uncovered rendered glyph
```

`build_fonts.py` downloads the upstream TTFs from `google/fonts` at the commit pinned in
`GOOGLE_FONTS_SHA` into `.fonts-src/` (gitignored), harvests the codepoints the site
actually draws from `js/`, `*.html` and the `content:""` rules of `css/style.css`, then
subsets and clamps the weight axes. Rebuilds are byte-identical, so a changed
`sha256` in `manifest.json` means a real change.

## Read this before changing anything

- **Source Serif 4 is not a taste choice.** Newsreader and Instrument Sans do not contain
  the eight third-tone pinyin glyphs (`ǎ ǐ ǒ ǔ ǖ ǘ ǚ ǜ`), which the site renders thousands
  of times. Those fell through to the browser's system serif, one glyph at a time. Any
  replacement latin face must pass the pinyin integrity check in `font_coverage.py`.
- **Noto Serif SC stays second in `--latin` and `--ui`**, ahead of every system family. It
  supplies `↕ ≡ ▼`, which the latin faces lack. Move it behind `-apple-system` and those
  marks come from the operating system again, which is the non-determinism this directory
  exists to remove.
- **`✓` and `×`** in the feedback bars are painted by `css/style.css` with `content:""`.
  They are forced into every subset by `CHROME_EXTRA`, and required in each latin primary.
  `✕` (U+2715) and the emoji `✅ ❌` exist in no candidate face: the remove button is drawn
  with two CSS bars, the feedback marks are the two characters above.
- Adding new vocabulary changes the subset. Run the rebuild and the gate together, in that
  order.

## Licences

Three families, all SIL Open Font License 1.1, texts included beside this file:
`LICENSE-notoserifsc.txt`, `LICENSE-sourceserif4.txt`, `LICENSE-instrumentsans.txt`.
Upstream: <https://github.com/google/fonts> at the commit recorded in `manifest.json`.

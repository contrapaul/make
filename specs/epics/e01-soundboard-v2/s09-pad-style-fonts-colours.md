---
story: e01s09
title: Far more pad colour and font options, with no pop-up pickers
owner: Local AI
wave: 3
depends_on: [e01s02, e01s06]   # s06 must be merged first: both edit soundboard-core.js
files:
  - tools/soundboard/js/ui-style.js (new)
  - tools/soundboard/js/ui-panel.js (replace the colour swatch block with ui-style controls)
  - tools/soundboard/js/soundboard-core.js (style defaults, validateBoard, contrast helper)
  - tools/soundboard/css/soundboard.css (/* ==== style-picker ==== */ section + pad font classes)
  - tools/soundboard/fonts/ (more woff2 files)
  - tools/soundboard/index.html (script tag for ui-style.js)
  - tools/soundboard/test/style.test.js (new)
---

# s09 — Pad colours and fonts

## Why

v1 has 8 fixed colour swatches and one font. Teachers and kids want to colour-code and
label pads clearly, and media users want a board that looks how they want. The ask:
**"far more customizable, without introducing a color pop-up that can be annoying to
close."** So **no native `<input type="color">`** (it opens an OS dialog on most
platforms), no modal, no floating panel. Every control is inline in the edit panel.

## New pad fields (flat, like `effects`)

| Field | Values | Default |
|---|---|---|
| `color` (existing) | `#RRGGBB` | palette colour, as today |
| `textColor` | `'auto'` or `#RRGGBB` | `'auto'` |
| `font` | one of the `FONTS` keys below | `'fredoka'` |
| `fontSize` | `'auto' \| 's' \| 'm' \| 'l' \| 'xl'` | `'auto'` |
| `bold` | boolean | `true` |
| `caps` | boolean | `false` |

`validateBoard` fills these defaults for old boards and rejects bad values back to the
defaults: the hex must match `/^#[0-9a-f]{6}$/i`, and `font` must be a known key.

`textColor: 'auto'` → `core.readableText(bgHex)`, which returns `'#1E2240'` (ink) or
`'#FFFFFF'`, whichever has the higher WCAG contrast against the background.

## Fonts (vendored woff2, latin subset, SIL OFL — same method as s02)

```js
var FONTS = {
  fredoka:   { label: 'Fredoka',     family: '"Fredoka", system-ui, sans-serif' },     // from s02
  nunito:    { label: 'Nunito',      family: '"Nunito", system-ui, sans-serif' },      // from s02
  baloo:     { label: 'Baloo 2',     family: '"Baloo 2", system-ui, sans-serif' },
  atkinson:  { label: 'Atkinson (easy read)', family: '"Atkinson Hyperlegible", system-ui, sans-serif' },
  bungee:    { label: 'Bungee',      family: '"Bungee", system-ui, sans-serif' },
  marker:    { label: 'Marker',      family: '"Permanent Marker", cursive' },
  pixel:     { label: 'Pixel',       family: '"Press Start 2P", monospace' },
  system:    { label: 'System',      family: 'system-ui, sans-serif' },
};
```

Each new font gets an `@font-face` with `font-display: swap`. Browsers only download a
font when something uses it, so unused fonts cost nothing. The total added fonts folder
must stay under **400 KB**.

## Inline controls (`ui-style.js` → `window.SoundBoard.styleControls(pad, onChange)`)

Order within the pad panel, all inline:

1. **Pad colour:**
   - A swatch grid of the 12 palette colours plus 6 extras
     (`#FFFFFF #F2F2F2 #BDBDBD #4A4F75 #1E2240 #000000`). Swatches are 36px rounded
     squares with a 3px ink outline, and the active one gets a check mark.
   - A **"More colours"** disclosure (`<details>`, inline, pushes content down). Inside:
     a **hue slider** (0–360, rainbow gradient track), a **lightness slider** (20–90%,
     track goes dark→colour→light at the current hue, saturation fixed at 90%), and a
     **hex text field** that accepts `#abc` or `#aabbcc` on blur/Enter.
   - **Recent colours:** the last 6 custom colours used on this board, derived from its
     pads; no extra storage.
2. **Text colour:** `Auto` chip + the same 18 swatches (smaller, 28px).
3. **Font:** a wrap of chips, each showing the font's label **in that font**; the selected
   one is filled with `--accent`.
4. **Size:** a segmented control `Auto · S · M · L · XL`. **Style:** toggle chips **B**
   (bold) and **AA** (caps).
5. **"Apply style to all pads"** button: copies `textColor`, `font`, `fontSize`, `bold`,
   `caps` (not `color`) to every pad, with an undo toast in the status line ("Applied to
   9 pads · Undo") that lasts 5 s.

Every change updates the pad on the stage **live** (no full re-render while a slider is
being dragged; update that one pad node's CSS variables) and calls `persist()`.

## Rendering (via the `applyPadStyle` hook, not by editing `ui-stage.js`)

s01 leaves a hook in `padNode`: `if (SoundBoard.applyPadStyle) SoundBoard.applyPadStyle(node, pad)`.
`ui-style.js` defines `SoundBoard.applyPadStyle`, which keeps this story out of s08's file.

- Set CSS variables on the pad: `--pad-bg`, `--pad-fg`, `--pad-font`.
- Pads get `container-type: size`, so `fontSize: 'auto'` can be
  `font-size: clamp(12px, 22cqmin, 64px)`. Fixed sizes: s = 14px, m = 18px, l = 26px,
  xl = 36px (each still capped at `40cqmin` so text never overflows a 1×1 pad).
- Long labels wrap to at most 3 lines, then get an ellipsis (`-webkit-line-clamp: 3`).

## Done when

- You can make any colour without leaving the panel, and nothing ever overlays the page.
- Every font chip renders in its own font, and the pad updates live.
- Old boards load with defaults; a refresh keeps every style field.

## Verify

```bash
npm test
du -ch tools/soundboard/fonts/*.woff2 | tail -1    # ≤ ~400K plus the s02 fonts
```

`test/style.test.js` covers: `readableText('#FFD93D')` → ink, `readableText('#1E2240')` →
white, the hue/lightness → hex conversion round-trip (`hslToHex(0,90,50)` ≈ `#F20D0D`), and
`validateBoard` dropping `font: 'comic'` back to `'fredoka'` and a bad hex back to the
default.

Screenshot a board of 9 pads using 9 different fonts and colours at 820×1180.

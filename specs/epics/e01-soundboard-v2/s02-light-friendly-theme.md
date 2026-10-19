---
story: e01s02
title: Light, friendly classroom theme
owner: Local AI
wave: 1
depends_on: []
files:
  - tools/soundboard/css/soundboard.css (full rewrite of colours/shape; keep class names)
  - tools/soundboard/index.html (<head> font preload + header markup text only)
  - tools/soundboard/fonts/ (new: woff2 files + OFL.txt)
  - tools/soundboard/js/soundboard-core.js (PALETTE constant only)
---

# s02 — Light, friendly theme

## Why

The page will be used in primary-school music rooms, media production and at events. The
current near-black "hardware" look (BLUEPRINT §10, D16) is too dark and fiddly for that.
**D16 is replaced by D22**: a light, bright, rounded, chunky-outline look.

## Design tokens (put these in `:root`; delete the old dark tokens)

```css
:root {
  /* surfaces */
  --bg:        #FFF7EA;   /* warm cream page */
  --surface:   #FFFFFF;   /* panels, header */
  --surface-2: #FFF1D6;   /* inset areas (stage background, inputs) */
  --ink:       #1E2240;   /* text + outlines */
  --ink-2:     #4A4F75;   /* secondary text (≥ 7:1 on --surface) */
  --ink-3:     #6B7096;   /* hints (≥ 4.5:1 on --surface) */
  --grid-line: #E7D9BD;   /* edit-mode grid cells */
  /* accents */
  --accent:    #5B6CFF;   /* primary buttons, focus */
  --ok:        #1FB57A;
  --warn:      #FFB020;
  --danger:    #F0434D;
  /* shape */
  --outline:   3px;       /* every pad, button, panel */
  --r-sm: 12px; --r-md: 18px; --r-lg: 26px; --r-pill: 999px;
  --lift: 0 4px 0 var(--ink);          /* "sticker" shadow under pads/buttons */
  --lift-pressed: 0 1px 0 var(--ink);
  /* type */
  --font-ui:   "Fredoka", "Nunito", system-ui, sans-serif;
  --font-body: "Nunito", system-ui, sans-serif;
}
```

Pad palette (replace `PALETTE` in `soundboard-core.js`; it must stay an array of 6-digit
hex strings). These are bright but still carry dark `--ink` text at ≥ 4.5:1:

```js
var PALETTE = ['#FF6B6B', '#FF9F43', '#FFD93D', '#6BCB77', '#4DD4F0', '#6C8CFF', '#B47CFF', '#FF7AC6',
               '#FFFFFF', '#C8F169', '#FFB3A7', '#9EE8DA'];
```

## Look and feel rules

- **Page:** `--bg` background. Header and panels are `--surface` cards with
  `var(--outline) solid var(--ink)` borders and `--r-lg` corners.
- **Pads:** fill = pad colour at full strength (not the 18% tint used today). A 3px ink
  outline, `--r-md` corners (`--r-lg` for pads 2+ cells in both directions), `--lift`
  shadow. Label in `--font-ui` 600, dark ink.
  - Pressed/playing: `transform: translateY(3px)`, `box-shadow: var(--lift-pressed)`, and a
    3px inner white ring (`inset 0 0 0 3px #fff`) so a playing pad shows on any colour.
  - Selected (edit mode): a 4px dashed `--accent` ring outside the outline (s08 replaces
    this with the drag frame).
  - Dead pad (sound missing): diagonal-stripe overlay plus the "no clip" label. Keep the
    existing `is-dead` class.
- **Buttons:** pill shape (`--r-pill`), 3px ink outline, `--lift` shadow, `--font-ui` 600,
  sentence case (drop the all-caps letter-spaced monospace look), minimum 44px tall.
  Primary = `--accent` fill + white text; secondary = white fill + ink text;
  danger = `--danger` fill + white text. STOP uses danger.
- **Inputs:** `--surface-2` fill, 3px ink outline, `--r-sm`, 44px tall, 16px text (stops
  iOS zooming on focus).
- **Range sliders:** thick 10px track with rounded ends, 28px round thumb with an ink
  outline. Style both `::-webkit-slider-*` and `::-moz-range-*`.
- **Focus:** `outline: 3px solid var(--accent); outline-offset: 3px` on every control.
- **LCD status line:** becomes a friendly status pill (white, ink outline, `--font-body`).
  It turns `--danger` with white text on errors. Keep the `#sb-lcd` id and `role=status`.
- **Brand line:** replace "MAKE / SOUND UNIT · SB-01" with a simple wordmark:
  "Soundboard" in `--font-ui` 700 plus a small coloured dot logo. Keep the ← tools link.
- Keep `prefers-reduced-motion` support: no press bounce or pulse when it is set.
- **No dark mode** in this story. The board is used on projectors, where light is better.
  Note it as a possible follow-up only.

## Fonts (vendored, no Google Fonts link — matches the repo's vendored-font convention)

Download the latin-subset woff2 files from fontsource via jsDelivr into
`tools/soundboard/fonts/`:

- `fredoka-latin-wght-normal.woff2` from `@fontsource-variable/fredoka`
- `nunito-latin-wght-normal.woff2` from `@fontsource-variable/nunito`
- Add the SIL `OFL.txt` licence file next to them.

Declare both with `@font-face { font-display: swap; }` at the top of the CSS. Add
`<link rel="preload" as="font" type="font/woff2" crossorigin>` for Fredoka only.

## CSS section markers (other stories rely on these)

Organise `soundboard.css` into these sections, in this order, each opened with a
`/* ==== name ==== */` comment. Later stories edit **only their own section**:

`tokens` · `fonts` · `base` · `header` · `account` (empty, s03) · `layout` (s04) ·
`stage` · `pads` · `edit-grid` (empty, s08) · `panel` · `controls` · `style-picker`
(empty, s09) · `recorder` (empty, s10/s11) · `status` · `motion`

## Done when

- No dark surfaces are left anywhere; every class used in the JS still has a style.
- Text contrast is at least 4.5:1 everywhere (check pad labels on all 12 palette colours).
- Fonts load from `/tools/soundboard/fonts/` (Network tab) and nowhere else.

## Verify

```bash
npx wrangler pages dev --port 8788
grep -c "@font-face" tools/soundboard/css/soundboard.css   # expect 2
grep -n "#0b0d10\|#141922\|--mono" tools/soundboard/css/soundboard.css   # expect nothing
```

Take screenshots at 390×844, 820×1180 and 1440×900 in both modes, with at least 6 pads in
different colours, one of them playing. Attach them to the hand-back.

# CSS Lookbook — Planning

## Goal
A webpage that lets users select different visual styles, each one drastically changing the look and feel of the site. The content stays the same; only the presentation shifts.

---

## Core Concept
The page displays a set of sample UI elements (cards, buttons, headings, text blocks) as a living gallery. A style selector lets the user switch between distinct visual themes — each theme applies a completely different color palette, typography, spacing, and decorative treatment. The swap should feel instant and dramatic.

---

## Style Themes to Implement

1. **Minimal** — Clean whites, generous whitespace, subtle borders, sans-serif body text. Think Apple-style restraint.
2. **Neon** — Dark background with glowing neon accents (cyan, magenta, lime), bold gradients, and animated hover effects.
3. **Retro** — Warm beige/cream tones, serif fonts, drop shadows, chunky borders. 90s web aesthetic.
4. **Brutalist** — Raw, unpolished look: monospace text, harsh black borders, no rounded corners, high-contrast colors.
5. **Glassmorphism** — Frosted-glass panels over a colorful gradient background, soft shadows, translucent layers.
6. **Paper** — Off-white textured background, handwritten-style fonts, ink-like strokes, subtle paper grain overlay.

---

## Architecture

### CSS Strategy
- Each theme is defined as its own CSS file (e.g., `themes/minimal.css`, `themes/neon.css`).
- A shared base stylesheet (`lookbook.css`) handles layout and structure only — no visual styling that would conflict between themes.
- Theme files override colors, fonts, borders, shadows, and decorative effects via CSS custom properties and direct rules.

### Switching Mechanism
- A `<select>` or set of toggle buttons in the header lets users pick a theme.
- On selection, JavaScript swaps the active `<link rel="stylesheet">` for the chosen theme file (or toggles a class on `<body>` that activates the right CSS variables).
- The current theme choice is saved to `localStorage` so it persists across page reloads.

### Content Elements
The page will showcase these UI components so each style's impact is obvious:
- Hero heading + subtitle
- Navigation bar with links
- Card grid (3–4 cards with title, description)
- Button variants (primary, secondary, ghost)
- Form elements (input field, textarea, checkbox)
- A blockquote or callout section
- Footer

---

## Modal System (card click)
Built after the original plan; now part of the codebase:

- `index.html`: `#modal-backdrop` overlay containing `#modal-content` (close button, `#modal-title`, `#modal-body`), placed after the footer.
- `switcher.js`: a `cardData` map keyed by each card's `data-card` value; card click populates title/body and activates the backdrop. Closes via the close button, backdrop click, or Escape.
- `lookbook.css`: base modal styles (backdrop, content box, close button, title, body) plus per-theme modal overrides — see the architecture violation below.
- Card text is duplicated: the card body holds a short description, `cardData` holds the expanded text.
- Accessibility gaps: cards are not focusable (no `tabindex`), no `role="dialog"`/`aria-modal`, no focus trap, focus is not returned to the originating card on close.

---

## Architecture Violation (needs a decision)
The plan requires `lookbook.css` to handle only layout and each theme file to be self-contained. Current state violates both:

- `lookbook.css` contains ~150 lines of modal CSS, including per-theme overrides (`body.theme-*.modal-*`) and a duplicated `.modal-backdrop` rule for every theme. Theme styling lives in the shared stylesheet.
- `lookbook.css` also applies visual styling beyond layout: `border-radius` on selector buttons and `.btn`, color/background transitions, and a universal `.card:hover` lift.
- Decision: move modal theming into the theme files to restore self-containment, or accept the current structure and record it here as the new rule.

---

## Implementation Steps

1. **Base layout** — Build the HTML structure with all content elements in `index.html`. Keep it semantic and theme-agnostic.
2. **Shared stylesheet** — Finalize `lookbook.css` for grid, spacing, and structural rules only.
3. **Theme CSS files** — Create one file per theme under a `themes/` directory. Each defines its own palette via custom properties and applies decorative styles.
4. **Style selector UI** — Add the toggle/select control to the header with minimal styling that works across all themes.
5. **JavaScript logic** — Wire up the switcher: swap stylesheet, update active state on buttons, persist choice in `localStorage`.
6. **Polish** — Smooth transitions between theme swaps (CSS `transition` on color/background properties), hover states per theme, responsive behavior.

---

## Notes
- Transitions between themes should feel smooth, not jarring. Use CSS `transition` on background-color, color, border-color, and box-shadow where appropriate.
- Keep each theme file self-contained — no cross-dependencies between themes.
- The style selector itself should be styled neutrally so it doesn't clash with any active theme.
- Theme switch flash: `index.html` hardcodes `body class="theme-minimal"`; the saved theme is applied by JS after load, so a non-minimal saved theme briefly flashes minimal styles before correcting.
- Responsive behavior (step 6) is unimplemented: no media queries; only the `auto-fill` card grid adapts. The neon stagger (`translateX(±1.5rem)`) pushes content past the viewport edge on narrow screens.
- Theme-swap smoothness is partial: only `body` background/color transition; a full stylesheet swap changes fonts, borders, and backgrounds instantly.

---

## Defects (audit)
1. `themes/paper.css`: nearly every rule uses `body.theme.paper` (dot instead of hyphen) — only the body background/font apply. `.btn-ghost` is also missing from this theme.
2. `themes/glassmorphism.css`: `card-title`, `card-body p`, and all three button variants use `body.theme.glassmorphism` — unstyled.
3. `lookbook.css`: `body.brutalist .modal-title` is missing the `theme-` prefix — unstyled.
4. Undefined spacing tokens: `--spacing-xs` (base `.style-selector button` padding) and `--spacing-3xl` (retro and glass hero padding) are not defined in `:root`; the declarations are dropped at computed-value time.
5. Neon stagger vs hover: the base `.card:hover` transform replaces the stagger `transform`, so odd/even cards jump horizontally on hover.
6. Box-model card modal never opens: HTML uses `data-card="box-model"`, `switcher.js` keys it `boxModel`.
7. Modal closes on internal clicks: the backdrop handler does not check `e.target`, so clicks inside the modal dismiss it.
8. Minor: `--accent` is undefined in neon (used by `.modal-close-btn`); unused `.centered-container` class; inline `onsubmit="return false;"` on the demo form.

---

## Remaining Work
1. Fix selector typos (`theme.paper` in paper.css, `theme.glassmorphism` in glassmorphism.css, `body.brutalist` in lookbook.css).
2. Define `--spacing-xs` and `--spacing-3xl` in `:root`, or replace the usages.
3. Fix the `boxModel`/`box-model` key mismatch; add an `e.target` check to the backdrop close handler.
4. Strip the dead `.card-image` CSS (the plan no longer calls for card images).
5. Add media queries for responsive behavior; resolve the neon stagger/hover conflict and narrow-viewport overflow.
6. Resolve the architecture violation: move modal theming out of `lookbook.css` into the theme files, or accept it and record the decision.
7. Add the missing paper `.btn-ghost`; if the modal stays, add keyboard access (`tabindex` on cards, `role="dialog"`, focus management).

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
- Card grid (3–4 cards with image, title, description)
- Button variants (primary, secondary, ghost)
- Form elements (input field, textarea, checkbox)
- A blockquote or callout section
- Footer

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

# Game Bench

`make.contrapaul.com/fun/gametools/`

Fourteen small browser tools for people making a tabletop game: dice, odds,
decks, setup time, session length, playtesting, card layouts, print sheets,
graphic checks, rules budget, simplification demos, team roles, a box, and
a drawer of extras. Built for the Grade 9 tabletop unit, usable by anyone.

No build step, no accounts, no external requests. Everything a person enters
stays in their browser (`localStorage`, key `gamebench.v1`) and can leave as
JSON, CSV, PNG or a print.

## Files

| File | What it is |
|---|---|
| `index.html` | The shell. Header, tool nav, one `<main>`, footer, script tags. |
| `bench.css` | All styling. Tokens at the top, shell, shared components, one block per tool, print. |
| `bench.js` | Registry, hash routing, the store, export helpers, `ROSTER` and `ICONS`. |
| `dicemath.js` | `Bench.dice`: parse a roll, roll it, exact distribution. |
| `tools/*.js` | One file per tool. Each ends in `Bench.register({ id, mount, unmount })`. |
| `tools/manifest.js` | Not a tool; the shared component table that Setup, Roles and Box embed. |
| `data/cards.js` | Card sizes, zone descriptions, the eight layouts. |
| `data/demos.js` | The six Simplify case studies. Edit copy here. |
| `fonts/` | Lexend and JetBrains Mono, self-hosted. |
| `mood.html` | The approved look on one page. Reference only. |
| `plan.md` | The build plan with every phase ticked and handoff notes per phase. |
| `brainstorm.md` | Where the ideas came from and what was decided. |

## Adding a tool

1. Add an entry to `ROSTER` in `bench.js` (id, title, blurb) and a 24×24
   stroke icon to `ICONS`.
2. Create `tools/<id>.js`:

```js
(function () {
  var B = window.Bench, el;
  function mount(root) { el = root; el.innerHTML = '<section class="panel">…</section>'; }
  function unmount() { el = null; }
  B.register({ id: '<id>', mount: mount, unmount: unmount });
})();
```

3. Add `<script src="tools/<id>.js">` to `index.html` after the ones it
   depends on.

The root a tool mounts into is thrown away on the next route, so listeners
on `el` die with it. Timers and `store.on` subscriptions need clearing in
`unmount`. State goes through `B.store.get(key)` / `B.store.set(key, v)`;
add the key to `EMPTY` in `bench.js`.

Shared helpers on `Bench`: `downloadCSV(rows, name)`, `downloadJSON(obj,
name)`, `downloadPNG(svgOrCanvas, name)`, `printSection(el)`, `esc(s)`,
`el(html)`, `pct(p)`, `rand(n)` (1..n, crypto-backed), `reducedMotion()`.

Shared CSS: `.panel`, `.kicker`, `.btn` (`.brass`, `.paper`, `.ghost`,
`.sm`, `.big`), `.field` + `.input`, `.seg`, `.badge`, `table.sheet`,
`.tool-grid`, `.stat`, `.callout`, `.kind-bar`, `.sw`.

## Colours

Felt green is the table. Paper panels sit on it. Berry does the actions,
brass the highlights. Series colours for charts, in order: berry, brass,
felt, slate, plum, rust. Dark mode is a token swap under `[data-theme=dark]`.

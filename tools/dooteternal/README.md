# Doot Eternal

Browser Doom/Boltgun-style FPS set in music hell. Full spec in [plans.md](plans.md);
build order and phase gates were agreed on top of it.

Play: <https://make.contrapaul.com/tools/dooteternal/>

## Status

The tech demo is complete against the definition of done in plans.md §26, with
one exception: **no audio files exist yet**. Every sound is wired to the paths in
[app/assets/audio/MANIFEST.md](app/assets/audio/MANIFEST.md); a missing file is
reported once and treated as silence, so the game plays normally and silently.
Drop the files in at those paths and they start working with no code change.

That leaves three §24 items unverifiable until then: that the trumpet and tuba
pick randomly per shot, that the saxophone's loop restarts cleanly on each burst,
and that the guitar's three files play in order. All three are asserted at the
call level in `npm run checks` — what nobody has done is *hear* them.

Controls: WASD move, mouse look, click fire, 1–4 or mouse wheel to switch,
R to catch your breath, ESC to pause.

## Commands

Run from this directory.

```bash
npm install
```

```bash
npm run dev
```

Dev server on <http://localhost:5174/tools/dooteternal/> — same path as production,
so absolute URLs behave the same in both.

```bash
npm run build
```

```bash
npm run check
```

```bash
npm run checks
```

`check` is types, `checks` is behaviour: the gameplay modules are bundled and
asserted in Node, one section per phase, exiting non-zero on any failure. It
exists because the things most likely to be wrong here are numbers — breath
timing, damage falloff, spread growth — and neither the typechecker nor a
screenshot can see those.

It has caught, among others: a breath refill that stalled just above empty, a
weak point no shot could reach, melee enemies that stopped a hair outside their
own reach, and settings changes that silently went to a detached object. It also
walks each level the way a player must, so a level whose exit can't be reached
fails as a check rather than as a bug report.

Modules that build canvas textures on construction (`EnemySystem`,
`PlaceholderAssets`) can't be loaded outside a browser, so anything depending on
them is verified in the browser instead, via the dev-only `window.doot` handle.

## Making maps

A level is one JSON file in `app/levels/` and the game picks it up automatically.
Draw it as text and run `npm run map`, or edit the JSON directly — see
[MAPS.md](MAPS.md). `npm run checks` validates every map, including whether its
exit can actually be reached.

## Layout

```text
tools/dooteternal/
  index.html          BUILT — commit this
  build/              BUILT js/css/sourcemaps — commit this
  app/                source (Vite root)
    index.html
    src/              main.ts, core/, systems/, data/
    levels/           one .json per map, discovered by glob
    assets/audio/     hand-supplied audio — see assets/audio/MANIFEST.md
  checks/             npm run checks — one file per phase, plus levels/images
  maps/               .map sources for npm run map
  scripts/            map-to-level.mjs
  vite.config.ts
```

## How this deploys

The site's `wrangler.toml` sets `pages_build_output_dir = "."`, so Cloudflare Pages
serves the repo root with no build step of its own. Two consequences:

1. **The build output is committed.** `npm run build` writes `index.html` and
   `build/` into this directory; commit them or the deployed game won't change.
2. **`outDir` is the parent of the Vite root**, so `build.emptyOutDir` must stay
   `false`. Setting it to `true` would delete `app/`, `plans.md`, and the config.

Runtime files — currently just audio — live only in `app/assets/` and are never
copied by the build. Since Pages serves the source folder too, their public path
differs by mode, which is why [`app/src/core/paths.ts`](app/src/core/paths.ts) is
the single place that resolves them. Level and enemy/weapon JSON is imported as
ES modules instead, so the bundler handles it and no path logic is involved.

Textures, sprites, particles and decals are generated procedurally at boot
(plans.md §21), so the game is complete with no image files at all. Supplying one
is opt-in per asset: drop a PNG at its path in
[app/assets/IMAGES.md](app/assets/IMAGES.md) and it takes over on the next
reload, while everything you haven't drawn keeps its stand-in.

`npm run checks` holds that checklist against the code, so a mistyped path fails
a check instead of looking like art you simply haven't made yet.

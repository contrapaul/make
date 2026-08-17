# Doot Eternal

Browser Doom/Boltgun-style FPS set in music hell. Full spec in [plans.md](plans.md);
build order and phase gates were agreed on top of it.

Play (once built): <https://make.contrapaul.com/tools/dooteternal/>

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

## Layout

```text
tools/dooteternal/
  index.html          BUILT — commit this
  build/              BUILT js/css/sourcemaps — commit this
  app/                source (Vite root)
    index.html
    src/              main.ts, core/, systems/, data/
    levels/           level_01.json, level_02.json
    assets/audio/     hand-supplied audio — see assets/audio/MANIFEST.md
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
(plans.md §21) — there are no image files to manage.

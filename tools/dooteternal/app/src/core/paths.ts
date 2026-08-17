/** Site path the game is served from. Must match `base` in vite.config.ts. */
export const BASE = '/tools/dooteternal/';

/**
 * Resolves a runtime asset path — audio and the optional image files.
 *
 * These live in exactly one place on disk — app/assets/ — and are never copied
 * by the build. Vite's dev server serves app/ as its root, while Pages serves
 * the committed source folder as-is, so the public path differs by mode.
 *
 * The mode check sits inside the function deliberately. At module scope it is a
 * property access on `import.meta.env`, which the bundler cannot prove is
 * side-effect free, so it survives tree-shaking and throws when these modules
 * are loaded in Node by `npm run checks`. Vite still replaces it statically here.
 */
export function asset(relativePath: string): string {
  const base = import.meta.env.DEV ? `${BASE}assets/` : `${BASE}app/assets/`;
  return base + relativePath;
}

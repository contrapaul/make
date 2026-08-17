/** Site path the game is served from. Must match `base` in vite.config.ts. */
export const BASE = '/tools/dooteternal/';

/**
 * Root for files fetched at runtime (audio now, images later if any are added).
 *
 * These live in exactly one place on disk — app/assets/ — and are never copied
 * by the build. Vite's dev server serves app/ as its root, while Pages serves
 * the committed source folder as-is, so the public path differs by mode.
 */
export const ASSET_BASE = import.meta.env.DEV ? `${BASE}assets/` : `${BASE}app/assets/`;

/** Resolve a path from the manifest, e.g. asset('audio/sfx/ui_click.ogg'). */
export function asset(relativePath: string): string {
  return ASSET_BASE + relativePath;
}

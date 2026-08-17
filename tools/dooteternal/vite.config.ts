import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// Source lives in app/. The build is written one level up, into the directory
// Cloudflare Pages already serves, so /tools/dooteternal/ is the game URL.
// emptyOutDir must stay false: outDir contains app/, plans.md and this config.
const outDir = fileURLToPath(new URL('.', import.meta.url));
const root = fileURLToPath(new URL('./app/', import.meta.url));

export default defineConfig({
  root,
  base: '/tools/dooteternal/',
  publicDir: false,
  build: {
    outDir,
    emptyOutDir: false,
    assetsDir: 'build',
    target: 'es2022',
    // Off deliberately: the output is committed, and a 2.7 MB map that changes
    // every build is git bloat. Dev serves the original TypeScript anyway.
    sourcemap: false,
    // three.js alone is ~525 kB, so the default 500 kB warning always fires.
    chunkSizeWarningLimit: 800,
  },
  server: {
    port: 5174,
    strictPort: true,
  },
});

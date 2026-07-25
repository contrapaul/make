import { defineConfig } from 'vitest/config';

// The engine is plain TypeScript, so tests skip the SvelteKit plugin entirely —
// loading it leaves a Vite server hanging after the run.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts']
  }
});

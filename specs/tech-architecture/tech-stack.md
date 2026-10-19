# Project Context — make

> Derived by scanning the codebase (map-codebase). Refresh after significant changes.

## Stack
- **Runtime/host:** Cloudflare Pages (`wrangler.toml` → `name = "make"`, `pages_build_output_dir = "."`) + Cloudflare Workers Functions.
- **Language:** TypeScript for the server layer (`functions/api/*`); plain JS + HTML + CSS for the front-ends.
- **Data:** D1 SQLite (`bloodbowl-db`, binding `DB`) + R2 object store (`bloodbowl-photos`, binding `PHOTOS`).
- **Realtime:** Durable Object `LiveGame` in `workers/bb-live` (binding `LIVE_GAME`), exposed via WebSocket in `functions/api/live/[code]/ws.ts`.
- **No build step / no bundler** — static output dir is the repo root. `package.json` has only `wrangler` as a devDependency.

## Architecture
- **Monorepo of static sub-sites** under the Pages root:
  - `index.html` + `style.css` — landing page
  - `bloodbowl/` — flagship game site (browse, coach, game, play, teams, tournaments, starplayers, rules, tools, account)
  - `localai/`, `fun/` (flashcards, gametools, students), `tools/`, `projects/`, `about/` — secondary sites
- **Functions API** (TypeScript, `_routes.json` includes `/api/*`):
  - `auth/` — signup, login, verify-email, resend, reset-password, me, logout
  - `coach/[username]`, `games`, `teams/`, `tournaments/` (entries, matches, posts), `photos/`, `feed/`
  - `live/` — create, join, finish, ws (Durable Object bridge)
  - shared helpers in `functions/api/_lib/` — `http`, `email`, `crypto`, `ratelimit`, `session`
  - `functions/api/_middleware.ts` — request middleware
- **Durable Object worker** — `workers/bb-live/` (own `wrangler.toml`), class `LiveGame`.

## Conventions (Observed)
- **Server code:** TypeScript, route-per-file under `functions/api/`, shared logic factored into `_lib/`. Rate limiting, sessions, and crypto are centralized in `_lib`.
- **Front-ends:** per-site folders with their own `index.html`, `css/`, `js/`; custom fonts vendored (Barlow, Nuffle).
- **DB migrations** live in `db/migrations/` (D1).

## Signals / Active Considerations
- **No test / lint / typecheck setup** yet — `package.json` has only `wrangler`. Preflight is currently just `wrangler pages dev` (run) + `wrangler pages deploy` (ship). Add vitest + eslint when test coverage is desired.
- **Two parallel game trees** exist: `bloodbowl/` and `bloodbowl-next/` (has `mockups/`, `REFACTOR-PLAN.md`, `rebuild.md`) — a migration/refactor is in flight. Decide which is canonical before new feature work.
- `localai/` is a self-contained sub-project with its own `package.json`, `test/`, `plans.md`, `blueprint.md`.
- Realtime path (DO + WebSocket) is the highest-complexity area; treat as a P0/P1 risk tier in any epic that touches `live/`.

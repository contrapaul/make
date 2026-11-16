# make — Claude Code

> Personal Cloudflare Pages site. This is the canonical agent context for Claude Code and pi.

Read `CONVENTIONS.md` before any git or GitHub operation.

<!-- BEGIN bigpowers:context-routing -->
## Context Routing

Load subdirectory context by file glob:

| Glob | Context |
|------|---------|
| `tools/build/projects/**` | Tabbed "1-Afternoon Coding Projects" site (built, live; e02 done) — read `tools/build/projects/HANDOFF.md` and `specs/product/PROJECTS_SITE_LATEST.md` before any change; glossary terms are in `glossary-terms.md` (owner-approved) |
| `functions/api/**` | TypeScript Functions API — read `specs/tech-architecture/tech-stack.md` and the relevant `_lib/` helper first |
| `bloodbowl/**` | Flagship game site — check `bloodbowl/REFACTOR-PLAN.md` and `bloodbowl/rebuild.md` before changes |
| `workers/bb-live/**` | Durable Object (LiveGame) — highest-complexity area; P0/P1 risk tier |
| `localai/**` | Self-contained sub-project with its own `package.json` and `test/` |
<!-- END bigpowers:context-routing -->

<!-- BEGIN bigpowers:learned-preferences -->
## Learned User Preferences

- (none yet — updated via `session-state`)

## Workspace Facts

- (none yet — durable facts discovered across sessions)
<!-- END bigpowers:learned-preferences -->

<!-- BEGIN bigpowers:project -->
## Project

make is a personal Cloudflare Pages site. It hosts several sub-sites (landing, localai, fun, tools, projects). The flagship is the Blood Bowl game. It is a static frontend plus a TypeScript Functions API. Backends are D1, R2 (photos), and the bb-live Durable Object.

Stack: TypeScript / Cloudflare (Workers Functions + Durable Objects + D1 + R2) over static HTML/CSS/JS front-ends.

## Commands

| Action | Command |
|--------|---------|
| Run | `wrangler pages dev` |
| Deploy | `wrangler pages deploy` |
| Test | `npm test` (soundboard unit tests, `node --test`) |
| Browser test | `npm run test:browser` — soundboard headless-Edge suites against `wrangler pages dev` on :8788; run before deploying the soundboard (macOS + Microsoft Edge; ports 8788/9222 must be free) |
| Lint | (none — not set up) |
| Build | (static — no build step) |
| Preflight | `wrangler pages dev` boots clean (test/lint not set up yet) |
| CI | `gh pr checks` (when a PR is open) |

## Architecture

Static sub-sites live under the Pages root. A TypeScript Functions API sits in `functions/api/*`. Shared helpers live in `_lib/`: http, email, crypto, ratelimit, session. Realtime flows through the `LiveGame` Durable Object over WebSocket. D1 holds structured data; R2 stores photos.

## Conventions

- Server code is TypeScript, one route per file under `functions/api/`.
- Shared logic lives in `functions/api/_lib/`; do not duplicate http/session/crypto helpers.
- Route-per-file; keep handlers thin and push logic to `_lib/`.
- Front-ends are per-site folders with their own `css/` and `js/`.
- D1 schema changes go through migrations in `db/migrations/`.

## Never

- Never dismiss reproducible gate failures as pre-existing or out of scope.
- Never proceed on a red Preflight or red CI — invoke quick-fix or fix-bug first.
- Never treat `bloodbowl/` and `bloodbowl-next/` as the same site. Confirm which is canonical first.
- Never commit secrets; auth tokens and keys stay in Cloudflare bindings/env, not the repo.

## Agent Rules

- **Workflow Mandate:** Use bigpowers skills (`plan-work`, `develop-tdd`, `orchestrate-project`) for structured work. Do not write feature code directly from a prompt.
- **Always Green:** Preflight and CI must be green before forward work.
- Read `specs/` and `CONVENTIONS.md` before writing code.
- Write the minimum code that solves the stated problem.
- Show evidence (a clean run) before declaring done.
- All planning output goes in `specs/`.

## Token Economy — Minimal Footprint

1. **Check existing dependencies first.** Inspect what is already available before adding a package.
2. **Prefer mature, maintained libraries.** Do not rewrite a capability a library provides without a documented reason.
3. **Copy validated patterns.** Study how established products solve the same problem first.
4. **Keep the simplest working implementation.** Write the least code that satisfies the requirement. Do not add preventive abstraction.
<!-- END bigpowers:project -->

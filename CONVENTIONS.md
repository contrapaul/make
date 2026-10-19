# Conventions — make

Shared rules for every AI agent working in this repo. Read this before git/GitHub work.

## Conventional Commits & Semantic Versioning

- All commits follow Conventional Commits: `type(scope): summary`.
- `type` is `feat`, `fix`, `docs`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.
- Breaking changes use `!` or a `BREAKING CHANGE:` footer.
- Keep commit messages accurate — they drive the changelog.

## Always Green / Shift Left

- **Always Green:** Preflight and CI are green before any forward work — not "green enough."
- **Shift Left (1-10-100):** a defect costs ~1× to fix in dev, 10× in integration, 100× in production. Fix a red gate now.
- **Preflight:** the full local verification stack recorded in `CLAUDE.md`. For make it is `wrangler pages dev` booting clean (test/lint not yet set up). Add the real test + lint commands to `CLAUDE.md` when they exist and Preflight becomes that chain.
- **CI green:** when a PR is open, `gh pr checks` must pass before merge.

## Discovered Defects

A reproducible gate failure hit during unrelated work is a **discovered defect**, not noise.

**fix-or-log ladder (mandatory):**
1. **quick-fix** — trivial, data-only, or single-file fixes within guardrails.
2. **fix-bug** — when quick-fix guardrails abort or investigation is needed (`specs/bugs/BUG-*.md` + TDD).
3. **Log** — use only when reproduction is blocked after a good-faith attempt. Write a BUG spec, then stop forward work until triaged.

- Discovered fixes ship in the **same PR** but **separate commits**.
- Never narrate a failure and continue.

## Risk Tiers

- **P0 — Critical (never violate):** Always Green. No direct coding without a `specs/` plan. Every story is tagged `story: eNNsNN`.
- **P1 — High (fix before merge):** Conventional Commits. Every story has runnable `verify:` commands. New functions and bug fixes include tests.
- **P2 — Medium (same/next epic):** source files under ~300 lines; behavior changes tagged ADDED/MODIFIED/REMOVED/RENAMED.
- **P3 — Low (best effort):** Boy Scout Rule; terse mode when context is heavy.

### Banned dismissive phrases

Do not use these (or close paraphrases) to ignore reproducible failures:

| Banned phrase | Do instead |
|---------------|------------|
| Pre-existing / pre-existing issues | Run fix-or-log; if truly unrelated, prove with a passing repro after revert |
| unrelated to this session | Session boundaries do not waive green gates |
| not introduced by my changes | Bisect or fix anyway — you own the tree |
| out of scope (ignoring a red gate) | Invoke quick-fix or fix-bug; scope-minimization never overrides Always Green |

## specs/ — All Planning Output Goes Here

- Every written planning artifact lives under `specs/`.
- Product intent → `specs/product/SCOPE_LATEST.yaml`, `VISION_LATEST.yaml`, `GLOSSARY_LATEST.yaml`.
- Release ordering → `specs/release-plan.yaml`; story status → `specs/execution-status.yaml`.
- Epic/story implementation → `specs/epics/eNN-*/` (story `.md` + `tasks.yaml`).
- Session state → `specs/state.yaml`; bug investigations → `specs/bugs/BUG-*.md` + `registry.yaml`.
- Architecture → `specs/tech-architecture/tech-stack.md`; ADRs → `specs/adr/`.
- Verification evidence → `specs/verifications/`.
- Do not put story status in `release-plan.yaml`; do not duplicate the release plan inside `state.yaml`.

## Code Style

- Functions: 4–20 lines; split if longer.
- Files: under ~300 lines; split by responsibility.
- One thing per function, one responsibility per module (SRP).
- Names: specific and unique; avoid `data`, `handler`, `Manager`, `Service`.
- Types: explicit; no `any`, no untyped public functions (TypeScript server layer).
- No code duplication — extract shared logic into `_lib/` or a module.
- Early returns over nested ifs; max 2 levels of indentation.
- Conditionals expressed as positives; avoid `unless`-style logic where possible.
- The Stepdown Rule: functions descend exactly one level of abstraction.
- Names describe side-effects (`sendWelcomeEmail`, not `processUser`).
- No magic strings or numbers — extract to named constants.
- Prefer exceptions over error-code sentinels; exception messages include the offending value, expected shape, and a remediation hint.
- Remove dead code — delete, do not comment out.
- Boy Scout Rule: leave every touched file at least as clean as found.

## Comments

- Keep existing comments; never strip them on refactor.
- Write WHY, not WHAT.
- Non-obvious logic carries a Provenance link (issue, commit SHA, or ADR).
- Docstrings on public functions: intent + one usage example.
- No comments that restate the code; no commented-out code.

## Tests (F.I.R.S.T)

- Tests run headless with a single command (recorded in `CLAUDE.md`). **Not set up yet** — add when test coverage is desired.
- Every new function gets a test; every bug fix gets a regression test.
- Mocks for external I/O are named fakes, not inline stubs.
- Tests are Fast, Independent, Repeatable, Self-Validating, Timely.
- Never skip/ignore a test without an explicit ambiguity note.
- Cover boundary conditions (empty, max, min, off-by-one).
- Assert on observable outcomes only — never internal state.
- Every change is verifiable with a single runnable command before it is done.

## Defensive Code

Implement defensive code **only** for these categories (all others require an explicit request):

- **Rate limit** — present in `functions/api/_lib/ratelimit.ts`; apply to untrusted/public endpoints.
- **Graceful degradation** — degrade cleanly when D1, R2, email, or external calls fail. Return a useful fallback rather than a hard 500.

## Structure

- Follow the Cloudflare Pages + Functions layout already in use.
- Server: one route per file under `functions/api/`, shared logic in `functions/api/_lib/`.
- Front-ends: per-site folders (`bloodbowl/`, `localai/`, `fun/`, …) each owning its `css/` and `js/`.
- D1 schema changes go through migrations in `db/migrations/`.
- Prefer small focused modules over god files.

## Formatting

- Use a language-appropriate formatter (e.g. Prettier for TS/JS/CSS) once added; configure in pre-commit and on-save.
- No style debates beyond the formatter.

## Logging

- Structured JSON for debugging/observability in the Functions API.
- Plain text only for user-facing output.

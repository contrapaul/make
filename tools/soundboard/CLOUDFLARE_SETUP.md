# Cloudflare setup — Soundboard (Phase B)

**Handoff for a Cloudflare-connected agent.** Execute the tasks below against the
Cloudflare account that owns the `make` project. Every step is idempotent and
verifiable. Do not modify application code — this is infrastructure only.

---

## Context

- **Project:** `make` (Cloudflare **Pages**). Git: `https://github.com/contrapaul/make`.
- **Repo root:** `/Users/paul/Documents/GitHub/make` (run all commands from here).
- **What needs infrastructure:** the Soundboard at `/tools/soundboard/` (built in Phase B)
  stores uploaded audio in a **new R2 bucket** and boards/sounds in **new D1 tables**.
  Auth + the rest of the site already run on the existing `DB` / `PHOTOS` resources.
- **Auth is already done in code** — it reuses the existing `bb_session` cookie and
  `/api/auth/*` endpoints. Nothing to set up on Cloudflare for auth.

**Resources that must exist on the account:**

| Resource | Name | Binding | Status | Used by |
| --- | --- | --- | --- | --- |
| R2 bucket | `make-sounds` | `SOUNDS` | **MUST BE CREATED** (verify first) | `functions/api/sounds/*` |
| D1 database | `bloodbowl-db` (id `541a4d6c-a488-432c-97c1-3786f995b4cf`) | `DB` | already exists | all `/api` endpoints |
| D1 tables | `sounds`, `soundboards` | (schema in `DB`) | **MUST BE MIGRATED** | `functions/api/sounds/*`, `functions/api/soundboards/*` |

`wrangler.toml` **already** contains the `SOUNDS` binding — confirm it (Task 1b). No
`account_id` is set in `wrangler.toml`; the account is inferred from the connected token.

---

## Task 1 — Create the `make-sounds` R2 bucket

**1a. Check whether it already exists** (idempotent guard):

```bash
wrangler r2 bucket list
```

- If `make-sounds` is in the list → skip to Task 1b.
- If it is **not** in the list → create it:

```bash
wrangler r2 bucket create make-sounds
```

**1b. Confirm the binding is present in `wrangler.toml`** (it should already be; verify,
do not duplicate). Expected block:

```toml
[[r2_buckets]]
binding = "SOUNDS"
bucket_name = "make-sounds"
```

If it is missing, add exactly that block (matching the existing `PHOTOS` block's style).
If it appears **twice**, remove the duplicate.

**Verification:** `wrangler r2 bucket list` shows `make-sounds`; `grep -n "make-sounds" wrangler.toml`
returns exactly one line.

---

## Task 2 — Apply the D1 migration (add `sounds` + `soundboards`)

The SQL is in `db/migrations/0005_soundboard.sql`. The repo keeps migrations in
`db/migrations/` (not the wrangler default `migrations/`) and there is **no**
`migrations_dir` in `wrangler.toml`, so apply the file directly against the **remote**
database. This is config-independent and transactional.

**2a. Run the migration file against remote D1:**

```bash
wrangler d1 execute bloodbowl-db --remote --file db/migrations/0005_soundboard.sql
```

Expected: success, no errors. (The script runs two `CREATE TABLE` and three
`CREATE INDEX` statements; `execute` wraps it in a transaction.)

**2b. Verify both tables now exist:**

```bash
wrangler d1 execute bloodbowl-db --remote \
  --command "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('sounds','soundboards') ORDER BY name;"
```

Expected output: a result set containing exactly `soundboards` and `sounds`.

> **If the tables already exist** (re-run), `2a` will error on the existing tables.
> That is fine — confirm with `2b` that both are present and move on. Do **not** drop or
> alter existing data.
>
> **Alternative (ledger-tracked):** if you prefer wrangler's migration ledger, first add
> `migrations_dir = "db/migrations"` to `wrangler.toml`, then run
> `wrangler d1 migrations apply bloodbowl-db`. Use this only if the project already tracks
> migrations that way; `d1 execute --file` (above) is the safe default here.

---

## Task 3 — (Optional) Deploy and smoke-test

Only if a deploy is in scope. The site is a Pages project (`pages_build_output_dir = "."`).

```bash
wrangler pages deploy .
```

**Smoke-test (in a signed-in browser session — a valid `bb_session` cookie is required
for the mutating endpoints):**

| Check | Request | Expect |
| --- | --- | --- |
| Auth OK (existing) | `GET /api/auth/me` | 200 with a user when signed in |
| Sound upload | `POST /api/sounds` (body = an `audio/*` file ≤ 2 MB, header `X-Sound-Name: test.mp3`) | 200 `{ id, url, name, size, mime }` |
| Sound read | `GET /api/sounds/<id>` (from upload) | 200, `Content-Type: audio/*`, `Cache-Control: immutable` |
| Sound 413 guard | `POST /api/sounds` with a file > 2 MB | 413 |
| Board list | `GET /api/soundboards` | 200 `{ boards: [...] }` |
| Board create | `POST /api/soundboards` | 200 `{ id, url, createdAt }` |
| Board read | `GET /api/soundboards/<id>` | 200 `{ board: { data, updatedAt, ... } }` |
| Board save | `PUT /api/soundboards/<id>` body `{ name, isPublic, data, updatedAt }` | 200 `{ ok: true, updatedAt }` |

**If `POST /api/sounds` returns a 5xx with `SOUNDS` undefined → the bucket or binding is
missing (re-check Task 1).** If soundboard endpoints return 5xx about unknown tables →
the migration did not apply (re-check Task 2).

---

## Definition of done

- [ ] `make-sounds` appears in `wrangler r2 bucket list`.
- [ ] Exactly one `SOUNDS` → `make-sounds` binding in `wrangler.toml`.
- [ ] `sqlite_master` query returns both `sounds` and `soundboards`.
- [ ] (If deployed) the smoke-test table above passes for a signed-in user.

## Rollback (if reverting)

- Remove the `[[r2_buckets]]` `SOUNDS` block from `wrangler.toml`.
- `wrangler r2 bucket delete make-sounds` (after confirming it is not referenced).
- Tables `sounds` / `soundboards`: leave in place unless reverting the feature
  (dropping them deletes user data — confirm before running any `DROP TABLE`).

---

## References (code that depends on each resource)

- **`SOUNDS` bucket:** `functions/api/sounds/index.ts` (POST/DELETE), `functions/api/sounds/[id].ts` (GET/DELETE). Objects stored at key `sounds/<uuid>`.
- **`sounds` table:** `functions/api/sounds/*` (row per uploaded clip).
- **`soundboards` table:** `functions/api/soundboards/index.ts` (list/create), `functions/api/soundboards/[id].ts` (get/upsert/delete).
- **Schema source of truth:** `db/migrations/0005_soundboard.sql`.
- **Client contract:** `tools/soundboard/js/api.js`, `tools/soundboard/js/board-model.js`.
- **Blueprint / decisions:** `tools/soundboard/BLUEPRINT.md` (§9, §12 D1–D19).

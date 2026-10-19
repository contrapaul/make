# Soundboard — Blueprint

A user-customizable soundboard that lives at `/tools/soundboard/`. A user builds a
"board" of clickable pads, assigns an uploaded sound to each pad, applies audio effects,
and shares the finished board with others by URL. Signed-in users get persistent,
account-scoped boards; signed-out visitors can play any shared board.

Status: **Phase A + Phase B + Phase C — BUILT (2026-07-10)** + **UX polish pass applied**. **Deployed 2026-10-19** (R2 `make-sounds` + D1 tables live). **Phase E (v2 classroom overhaul) — PLANNED**, see §16 and `specs/epics/e01-soundboard-v2/`. Phase D remaining: test harness (vitest, Q5) + 3-month orphan-sound GC + optional effect extensions (bitcrusher/tape-delay/pan).
- **Phase A** (client, no server): `index.html`, `css/soundboard.css`, and
  `js/{soundboard-core,audio-engine,board-model,ui,shell}.js` — 6×9 pad grid,
  add/remove/reposition/resize, local-file sounds, the 6 base effects (extensible
  registry), layering + master compressor, PLAY/EDIT modes.
- **Phase B** (accounts + persistence): `db/migrations/0005_soundboard.sql` (sounds +
  soundboards tables), `functions/api/sounds/{index,[id]}.ts` (upload ≤ 2 MB / read /
  delete), `functions/api/soundboards/{index,[id]}.ts` (list / create / get / upsert /
  delete), `js/api.js` (client wrapper over the shared `/api` backend, reuses the
  `bb_session` cookie), and `board-model.js` + `ui.js` rewritten for server save/load,
  sign-in/out, "New board" / "My boards", and `?board=` link loading. Sound buffers are
  cached client-side and re-fetched on load; `localStorage` remains the signed-out stopgap.
  `tools/index.html` ROW 04 card added. Decisions: §12 D1–D20.

**Deploy prerequisites (Phase B) — DONE 2026-10-19:** R2 bucket `make-sounds` created; `SOUNDS`
binding in `wrangler.toml`; `0005_soundboard.sql` applied to remote + local D1 with
`wrangler d1 execute bloodbowl-db --remote --file db/migrations/0005_soundboard.sql` (this repo
has no `migrations_dir`, so `d1 migrations apply` does **not** apply). Pages deploys on push to
`main` (Git-connected project `make`).

---

## 1. Goals / Non-goals

**In scope (v1)**
- Create, edit, persist, and share a personal soundboard.
- Upload sounds up to **2 MB** each (MP3 / WAV / OGG / M4A) into a per-user **sound library** you can reuse across boards.
- Assign a sound to a pad; rename, recolor, reposition, resize, add, remove pads.
- Arrange pads on a **customizable grid** (default **6×9**); each pad can **span one or many cells** (user-set position + size).
- Apply **non-destructive effects** per pad (volume, pitch/speed, filter, echo, reverb, distortion), built on an **extensible effect registry** so more effects can be added later without rework.
- Play multiple pads at once (layering), low latency, with a shared master output.
- Reuse Bloodbowl's existing login so the same account works across the site.
- Store audio in **R2** (same object-store type used for Bloodbowl user images).
- Share a board by a stable, unguessable URL; signed-out visitors can play it.

**Out of scope (v1)**
- Server-side audio re-encoding / "baking" effects into a new file.
- Real-time collaboration (two people editing one board simultaneously).
- Private share links (URL tokens) or per-user grants — **public/private only** (Q2).
- MIDI, DAW-style sequencing, or a full music editor.
- Mobile-app packaging; this is a responsive web page.

---

## 2. What we reuse from Bloodbowl (no re-invention)

These already exist and are shared across the whole `make` site — the soundboard
plugs into them directly.

| Concern | Reuse | Where |
|---|---|---|
| Accounts, passwords, sessions | Existing auth: `users`, `sessions`, `auth_tokens` (D1); PBKDF2-SHA256 @ 100k | `db/migrations/0001_init.sql`, `functions/api/_lib/crypto.ts` |
| Signed-in user on every request | `_middleware.ts` attaches `context.data.user`; `requireUser(context.data)` for authed routes | `functions/api/_middleware.ts`, `functions/api/_lib/http.ts` |
| Auth endpoints | `/api/auth/me`, `/signup`, `/login`, `/logout`, `/verify-email`, `/resend-verify`, `/request-reset`, `/reset-password` | `functions/api/auth/*` |
| Session cookie | `bb_session` (HttpOnly, Secure, SameSite=Lax, 30-day) | `functions/api/_lib/session.ts` |
| Rate limiting | `rateLimit(env, key, max, windowMs)` on the D1 `rate_limits` table | `functions/api/_lib/ratelimit.ts` |
| HTTP helpers | `json()`, `readJson()`, `HttpError`, `getIP()` | `functions/api/_lib/http.ts` |
| **Audio storage** | **R2** — same object store type as the `bloodbowl-photos` bucket | `wrangler.toml` (`r2_buckets`) |
| Upload pattern | Raw-body POST → size cap → magic-byte sniff → `R2.put(key, bytes, {httpMetadata})` → D1 metadata row → `{id,url}` | `functions/api/photos/index.ts` |
| Public immutable read | Public-by-uuid GET with `Cache-Control: immutable`; owner-only DELETE | `functions/api/photos/[id].ts` |
| Routing | `_routes.json` already includes `/api/*`, so new `functions/api/sounds/*` and `functions/api/soundboards/*` are auto-covered | `_routes.json` |
| Visual identity | **NOT reused (user addendum).** The soundboard gets an entirely new, self-contained "hardware unit" look (dark chassis, backlit pads) and does **not** link `../style.css`. Only placement (`tools/soundboard/`) + the `tools/index.html` card are shared | `tools/soundboard/` |

**Decision — reuse, don't fork.** The soundboard does not define new auth. It calls the
same `/api/auth/*` endpoints and reads the same `bb_session` cookie. A user who signs in
on Bloodbowl is already signed in on the soundboard.

---

## 3. Architecture

```
Browser (vanilla JS, no build)                Cloudflare
──────────────────────────────                ──────────────────────────────
tools/soundboard/index.html
  ├─ audio-engine.js    Web Audio graph,     functions/api/sounds/[id].ts
  │  decode → effect     effect chain         (GET public / DELETE owner) → R2 SOUNDS
  ├─ board-model.js      ──fetch──▶           functions/api/sounds/index.ts
  ├─ ui-editor.js        CRUD + UI            (POST upload, 2MB cap)
  └─ shell.js            auth, routing        functions/api/soundboards/[id].ts
       │                  share, save         (GET/PUT/DELETE) → D1 soundboards
       ▼                                   functions/api/soundboards/index.ts
   /api/auth/* (existing)                   (POST create / GET list) → D1 soundboards
   /api/soundboards/*  ──────────────────▶
   /api/sounds/*       ──────────────────▶
```

- **Client:** vanilla JS IIFEs (matching `bloodbowl/js/*` and other tools), no framework,
  no bundler. Audio plays through the **Web Audio API** (not `<audio>` tags) so effects
  and low-latency layering are possible.
- **Server:** Cloudflare Pages Functions (TypeScript), D1 for metadata, R2 for audio bytes.
  New code mirrors the existing `photos` + `teams` + `auth` modules.
- **Persistence split:** audio bytes → R2; ownership + board layout + effect params → D1.

---

## 4. Data model (D1)

New migration `db/migrations/0005_soundboards.sql`, following the existing `photos`
and `teams` shapes:

```sql
-- One row per uploaded sound file (mirrors `photos`).
CREATE TABLE sounds (
  id           TEXT PRIMARY KEY,          -- uuid
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  size_bytes   INTEGER NOT NULL,
  content_type TEXT NOT NULL,             -- audio/mpeg | audio/wav | audio/ogg | audio/mp4
  duration_ms  INTEGER,                   -- optional, client-reported at upload
  last_used_at INTEGER,                   -- refreshed when saved into one of the owner's boards
  created_at   INTEGER NOT NULL
);
CREATE INDEX idx_sounds_user ON sounds(user_id);

-- One row per board (mirrors `teams`: owner + public flag + JSON blob + timestamps).
CREATE TABLE soundboards (
  id          TEXT PRIMARY KEY,           -- uuid
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  is_public   INTEGER NOT NULL DEFAULT 0,
  data        TEXT NOT NULL,              -- JSON: pads[], layout, master settings
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);
CREATE INDEX idx_boards_owner  ON soundboards(user_id, updated_at DESC);
CREATE INDEX idx_boards_public ON soundboards(is_public, updated_at DESC);
```

**Sound library + GC (Q3).** A user's `sounds` rows are their **library** — every upload,
regardless of whether it is assigned to a board. A sound is **in use** when referenced by
one of the owner's boards; we refresh `last_used_at` each time the owner saves a board
that references it. A **GC** pass (best-effort on upload; a D1 cron is the robust v1.1
option) deletes a user's sounds that are both older than **3 months** and unused for
**3 months**:

```sql
DELETE FROM sounds
 WHERE user_id = ?
   AND created_at    < :now_minus_3mo
   AND (last_used_at IS NULL OR last_used_at < :now_minus_3mo);
```

*Edge case (documented):* a sound whose only referencing board was last saved > 3 months
ago is eligible; re-saving that board re-anchors it. Acceptable for v1.

**R2 layout:** each sound is `sounds/{id}.{ext}` where `ext` comes from the detected
type. Audio files are **immutable** — edits (re-assigning, re-effecting, re-sequencing)
live in the board JSON, so the R2 bytes never change.

### Board JSON (`data` column)

```jsonc
{
  "version": 1,
  "master": { "gain": 1.0 },
  "layout": { "cols": 4, "rows": 4 },
  "pads": [
    {
      "id": "p_01",
      "label": "Boing",
      "color": "#ff4d1c",
      "emoji": "🪀",              // optional
      "soundId": "9f2c…",        // FK into sounds (R2 key sounds/9f2c….mp3)
      "loop": false,
      "effects": {
        "gain": 1.0,             // 0–2
        "playbackRate": 1.0,     // 0.25–4 (pitch + speed)
        "filter":  { "type": "lowpass", "frequency": 12000, "q": 1 },
        "delay":   { "time": 0.25, "feedback": 0.35, "wet": 0.25 },
        "reverb":  { "wet": 0.2 },
        "distortion": { "amount": 0.0 }
      }
    }
  ]
}
```

The JSON is self-describing with a `version` field so future effect types can be added
without a migration.

---

## 5. Audio engine (Web Audio API)

**Decision — non-destructive effects.** Audio files stay pristine in R2. Effects are
applied **live at playback** through a per-pad Web Audio chain; only the effect *params*
are persisted. This keeps uploads small, lets users tweak later, and avoids any
server-side audio processing.

### Graph

```
AudioBuffer (decoded from R2 bytes)
  → AudioBufferSourceNode { playbackRate, loop }
    → GainNode            (pad gain)
      → BiquadFilterNode  (lowpass/highpass/bandpass, freq, Q)
        → DelayNode ─┬→ GainNode (feedback) ┘   (echo)
          → wet/dry mix
            → ConvolverNode (reverb) ─ wet/dry mix
              → WaveShaperNode (distortion curve)
                → GainNode (pad output)
                  → [MASTER] GainNode → DynamicsCompressorNode → destination
```

- **Single shared `AudioContext`**, lazily created and `resume()`d on the first user
  gesture (browser autoplay policy). One master `GainNode` + `DynamicsCompressorNode`
  prevent clipping when many pads fire at once.
- **Low latency + layering:** decode each sound once with `decodeAudioData()` into an
  `AudioBuffer` and cache it; each pad trigger creates a fresh `AudioBufferSourceNode`
  from that buffer, so unlimited pads can overlap.
- **Effect presets** (reverb impulse, distortion curve) are generated in-browser; reverb
  uses a small synthesized impulse response, so no large assets are needed.
- **Volume normalization (optional, v1.1):** measure peak from the decoded buffer and
  offer a "normalize to -1 dBFS" toggle so a loud upload doesn't blow out the master.

### Effect set (v1)

| Effect | Param(s) | Node |
|---|---|---|
| Volume | `gain` (0–2) | `GainNode` |
| Pitch / Speed | `playbackRate` (0.25–4) | `AudioBufferSourceNode.playbackRate` |
| Filter | `type`, `frequency`, `q` | `BiquadFilterNode` |
| Echo | `time`, `feedback`, `wet` | `DelayNode` + feedback gain |
| Reverb | `wet` | `ConvolverNode` |
| Distortion | `amount` | `WaveShaperNode` |

**Extensible effect registry (Q7).** Each effect is a self-contained entry
`{ id, defaults, build(ctx, params) → { input, output, update(params) } }`. A pad's chain
wires the **enabled** effects in a fixed canonical order. **Adding a new effect = register
one entry + one slider** — no engine change. Planned-but-not-shipped: **bitcrusher, tape
delay, pan** (all "good", addable later exactly this way).

Each effect is optional per pad; unused effects are simply not wired into the chain.

---

## 6. Uploads (≤ 2 MB)

Mirrors `functions/api/photos/index.ts` exactly, with sound-specific limits.

**Server (`functions/api/sounds/index.ts`, POST):**
1. `requireUser(context.data)`.
2. Rate limit: `rateLimit(env, `sound-upload:${user.id}`, 60, 15*60*1000)`.
3. Per-user byte cap **100 MB** total (Q4: "a sound board, not a song board") — reject a
   new upload that would push the user over it. (Per-board **20 MB** cap is enforced at
   board save, §7.)
4. Read raw body; reject 0 bytes; reject > **2 MB** (413).
5. **Type sniff** by magic bytes: `RIFF…WAVE` (WAV), `OggS` (OGG), `ID3`/`0xFF 0xF3/0xFb`
   (MP3), `ftyp` box (M4A/AAC). Store the detected `content_type`.
6. `id = crypto.randomUUID()`; `env.SOUNDS.put(`sounds/${id}.${ext}`, bytes, { httpMetadata: { contentType } })`.
7. Insert D1 `sounds` row; return `{ id, url: `/api/sounds/${id}` }`.

**Client:** `<input type="file" accept="audio/mpeg,audio/wav,audio/ogg,audio/mp4">`;
validate size ≤ 2 MB before sending (fail fast, no wasted upload); show progress; on
success the sound lands in the **library** (listed for reuse) and is attached to the
selected pad; the buffer is preloaded for instant playback.

> 2 MB is well within Cloudflare Pages/Workers request-body limits, so no special
> streaming is required — a plain `request.arrayBuffer()` (as `photos` does) is enough.

**Read (`functions/api/sounds/[id].ts`):** public GET by uuid with
`Cache-Control: public, max-age=31536000, immutable`; owner-only DELETE (removes D1 row +
R2 object), same as `photos/[id].ts`.

---

## 7. Soundboards (CRUD + sharing)

Mirrors `teams` (owner + public flag + JSON + timestamps).

| Method | Path | Auth | Returns / effect |
|---|---|---|---|
| POST | `/api/soundboards` | user | create → `{ id, url }`; body `{ name, data }` |
| GET  | `/api/soundboards` | user | list **my** boards (newest first) |
| GET  | `/api/soundboards/{id}` | owner **or** public | board (name + data); 403 if private & not owner |
| PUT  | `/api/soundboards/{id}` | owner | update name/data (`updated_at` bumped); enforce **20 MB/board** cap (Q4); refresh `sounds.last_used_at` for referenced sounds |
| DELETE | `/api/soundboards/{id}` | owner | delete board (sounds stay in the library; GC per §4) |

**Sharing model — public by uuid** (consistent with `photos`/`teams`):
- Boards default to **private**. Owner toggles `is_public`.
- Share URL: `/tools/soundboard/?board={uuid}` — unguessable 36-char uuid.
- **Signed-out visitors can play** any public board (read + play only, no editing).
- No account required to listen; account required to create/edit/upload.

This matches how Bloodbowl already exposes public teams (`/api/public/teams`).

---

## 8. New API surface (all under existing `/api/*` routing)

```
functions/api/sounds/index.ts        POST  upload
functions/api/sounds/[id].ts         GET (public) · DELETE (owner)
functions/api/soundboards/index.ts   POST create · GET list-mine
functions/api/soundboards/[id].ts    GET · PUT · DELETE
```

All reuse `_lib/http.ts`, `_lib/session.ts`, `_lib/ratelimit.ts`. No new dependencies,
no new bindings except the R2 `SOUNDS` bucket (see §9 / open Q1).

---

## 9. Frontend structure (`tools/soundboard/`)

```
tools/soundboard/
  index.html            shell: unit chassis (brand + power LED), pad stage, control rack, auth bar
  css/soundboard.css    self-contained dark hardware identity (NOT ../style.css)
  js/
    api.js              thin client for /api/sound* + /api/auth/* (pattern from bloodbowl/js/api.js)
    audio-engine.js     AudioContext, decode+cache, extensible effect registry, master, play/stop
    board-model.js      board state, grid occupancy + free-cell find, CRUD, default board
    ui.js               pad grid render, editor (position/size/label/color/sound/effects), library panel
    shell.js            boot: auth (me), route (?board=), edit vs play mode, local-file fallback
  __tests__/            vitest: pure math (effect curves, free-cell find, board-JSON guards)
```

- **Two modes** (v2: the toggle is labelled by its action — **"✎ Edit soundboard"** while
  playing, **"✓ Save edits"** while editing; see §16):
  - **Play mode** (default, works signed-out for public boards): big pads, click/tap to fire.
  - **Edit mode** (owner only): per-pad effect sliders, assign/reassign sound from the
    library, rename, recolor, set position + size on the grid, add/remove pads, save,
    toggle public, copy share link.
- **Local-file mode (Phase A):** before auth/persistence exist, pads can be assigned a
  local `File` (object URL) so the whole board is usable in-browser with no server.
- **Auth bar:** "Sign in / Sign up" (reuses `/api/auth/*`); on sign-in, show the user's
  boards, the sound library, and "New board".
- **Keyboard:** optional pad-keybinds (e.g. `1–0, q–p`) for power users; nice-to-have.

---

## 10. Visual design (ENTIRELY NEW identity — user addendum)

> **Superseded by D22 (2026-10-19).** v2 replaces the dark hardware look with a light,
> bright, rounded, thick-outline classroom theme — tokens and rules in
> `specs/epics/e01-soundboard-v2/s02-light-friendly-theme.md`. The section below is kept
> for history. The "do not match the core Make site" rule still stands.

> "Do NOT match the site … an entirely new look and feel — unrelated to the core Make
> pages." So this is **not** the paper/ink Make look. It is a self-contained
> **dark "hardware unit"** — the energy of a drum machine / hardware synth (Roland /
> Teenage-Engineering / Ableton-Push). No `../style.css`; its own font stacks.

- **Palette:** near-black chassis `#0b0d10` / `#14181d`; panel `#1b2129`; hairline seams
  `#2a323b`; backlit pad colors from a small vibrant set (amber `#ff8a1e`, cyan `#22d3ee`,
  magenta `#f45bb0`, lime `#a3e635`, coral `#ff5a4d`); LED green `#38f2a6` / red `#ff4d4d`;
  LCD amber-on-black readout `#ffcf5c`.
- **Type:** strong system sans for UI; `ui-monospace, "SF Mono", Menlo, monospace` for
  readouts, pad labels, and param values (hardware feel, zero web-font dependency).
- **Chassis:** a rounded "unit" with a top strip (brand + model name + a power LED), an
  inset pad **stage** (the 6×9 grid), a right **control rack** (vertical faders), and an
  LCD status line in the footer. Subtle bevels + hairline seams, not skeuomorphic.
- **Pads:** inset square keys; backlit fill = pad color (dim at rest, bright + soft glow
  while playing); small corner LED; label + optional emoji.
- **Control rack (edit mode):** vertical fader-style sliders for Volume / Pitch / Filter /
  Echo / Reverb / Distortion; a "sound" row to assign from the library or upload; grid
  position/size controls; Save / Make public / Copy link.
- **Responsive:** the stage scales to width (CSS grid `repeat(cols, 1fr)`); on narrow
  screens the control rack drops below the stage; multi-touch pads each fire on
  `touchstart`.

---

## 11. Security & limits

- **Auth** on all mutating routes via `requireUser`; ownership checked by `user_id` join
  (same as `photos` DELETE) — no client-trusted ownership.
- **Rate limits** (reuse `rateLimit`): signup/login already limited; add
  `sound-upload:{user}` and `soundboard-write:{user}` windows.
- **Size/type caps** enforced server-side (§6) — never trust the client `accept`/size.
- **CORS / cookies:** same-origin, `credentials: 'same-origin'` (existing pattern); no tokens in
  localStorage (session is the HttpOnly cookie).
- **XSS:** pad labels/emoji rendered via `textContent`, never `innerHTML` with user input.
- **R2 cost:** per-user sound + byte caps; immutable keys; optional GC of orphaned sounds
  (see open Q3).

---

## 12. Decisions log (made, with rationale)

| # | Decision | Why |
|---|---|---|
| D1 | Reuse Bloodbowl auth (same `/api/auth/*`, `bb_session`, D1 `users`) | "Same login logic as Bloodbowl so accounts are saved" — one account across the site |
| D2 | Store audio in **R2**, metadata in **D1** | "Same DB type as user images" = R2; mirrors the proven `photos` pattern |
| D3 | Effects are **non-destructive, live Web Audio**; only params persist | Small uploads, tweakable later, zero server audio processing |
| D4 | Sharing = **public-by-uuid** (like photos/teams), signed-out can play | Matches existing public-team model; unguessable uuid = privacy by default |
| D5 | Boards default **private**, opt-in public | Safe default for personal soundboards |
| D6 | New tables `sounds` + `soundboards` in migration `0005`, mirroring `photos` + `teams` | Consistent schema; reuse `_lib` helpers |
| D7 | Vanilla JS, no build, self-contained **new** visual identity under `tools/soundboard/` | Per-tool sub-site; user addendum: "entirely new look, unrelated to the core Make pages" |
| D8 | Accept MP3/WAV/OGG/M4A, ≤ **2 MB/file**, **20 MB/board**, **100 MB/user** total, server-enforced | "A sound board, not a song board" (Q4); universal playback; hard cap on R2 cost |
| D9 | New R2 bucket `make-sounds` (binding `SOUNDS`) | Keeps audio separate from photos (independent quota/lifecycle) (Q1) |
| D10 | **Public/private only** sharing (uuid) | "public private is enough" (Q2) |
| D11 | **Sound library** + 3-month GC of unassigned sounds | "Keep sounds in a user library for 3 months if not assigned to a board" (Q3) |
| D12 | **Customizable 6×9 grid**, pads span 1–many cells (position + size in board JSON) | "customizable grid at 6 x 9 … pads can take up multiple squares" (Q6) |
| D13 | **Extensible effect registry**; ship the 6 base effects; bitcrusher/tape-delay/pan later via the same mechanism | "easily add more" (Q7) |
| D14 | Introduce a **minimal vitest harness** (pure math + a couple route tests) | "introduce a minimal test harness as recommended" (Q5) |
| D15 | Link from `tools/index.html` now; `edu/tools` link is a **follow-up** (separate `edu.contrapaul.com` repo, not in this workspace) | Q8 |
| D16 | **Dark hardware aesthetic** (self-contained CSS, no `../style.css`) | User styling addendum |
| D17 | **Phase A board persistence via `localStorage`** (layout + effects + pad metadata; sound buffers NOT persisted — pads show "re-attach") | Meets the Phase A acceptance test "refresh keeps the board" with no server; now the *signed-out* stopgap; signed-in boards persist to the server |
| D18 | **`js/api.js` client wrapper reuses the existing `/api/auth/*` + `bb_session` cookie** (no auth fork); sound buffers held in a client-side cache keyed by sound id, re-fetched via `/api/sounds/<id>` on board load | One login across the site; buffers never serialized to localStorage/server (they live in R2) |
| D19 | **Server caps: 50 sounds/user, 2 MB/sound, 100 KB board JSON**; board upsert is last-write-wins with an optional `baseUpdatedAt` 409 guard | Mirrors the `photos` pattern; caps keep D1 quotas sane; 409 lets a stale client re-pull |
| D20 | **⚠ NOT BUILT (found 2026-10-19 — client calls it, route missing; bug SB-B4).** **Public boards via `GET /api/public/soundboards/<id>`** — no session required; owner + `isPublic=1` gate; signed-out playback in `readOnly` mode (mutations guarded in the model, UI hides edit controls); share link = `origin + /tools/soundboard/?board=<id>`; the published board is the same D1 `soundboards` row, so it **reflects the owner's latest save** (deleting a referenced sound leaves a dangling pad → shows 're-attach') | Q2 (public/private only); lets anyone play a shared board with no account; reuses the existing soundboards row (no separate publish copy) |
| D21 | **UX polish pass (2026-07-10)** — keyboard-operable pads (`keydown` Enter/Space + `:focus-visible`), dead-pad state (`is-dead`, "no clip", press shows an LCD error), **play mode hides the rack** (full-width "instrument" stage), power LED always on + pulses when playing, STOP gets a distinct danger treatment, dark-theme scrollbars + select chevron + LCD scanline, pad-label ellipsis, "Current" (disabled) on the active board, `ERR ` prefix on LCD errors, contrast bump (`--faint-2`), reduced-motion also stops the LED pulse. **Also fixed a real bug:** `--ink` was referenced but never defined in `:root` (board names + public label fell back to browser-default black on dark panels) → now `--text` | Reviewer agent cold-read + my own pass; every P0/P1 finding grounded in a real line; kept surgical (no layout rewrite, no new deps) |

---

## 13. Implementation plan (phases → stories)

Sequenced so each phase is independently usable and verifiable. (Promote to
`specs/epics/` when we move from blueprint to build.)

**Phase A — Foundations (client-side, no server — buildable & demoable now)**
- A1. `tools/soundboard/` shell + **new hardware CSS** (own identity, no `../style.css`):
  chassis, 6×9 pad stage, control rack, LCD. *verify:* page renders, pads light up.
- A2. `audio-engine.js`: decode a **local** file, play, layer 3 at once, master
  compressor; **extensible effect registry** with the 6 base effects. *verify:* overlap
  without clipping; each knob audibly changes the sound.
- A3. `board-model.js`: grid occupancy + free-cell find; pads with position + size;
  local-file assignment; `ui.js` editor: add/remove/resize/reposition, label/color,
  assign local sound, effect sliders. *verify:* build a 2–3 pad board locally.
- A4. `tools/index.html` card. *verify:* card links to `/tools/soundboard/`.

**Phase B — Accounts + persistence**
- B1. Migration `0005` + `functions/api/sounds/*` (upload ≤ 2 MB, read, delete). *verify:* upload a 2 MB mp3; a 2.1 MB one is rejected (413).
- B2. `functions/api/soundboards/*` (CRUD) + `board-model.js` save/load. *verify:* refresh keeps the board.
- B3. Auth bar wired to existing `/api/auth/*`; "New board", "My boards". *verify:* same login as Bloodbowl.

**Phase C — Editor + sharing + public boards (BUILT)**
- C1. Pad editor: add/remove/reorder, assign sound, rename, recolor. *verify:* changes persist after save.
- C2. Per-pad effect panel bound to the engine. *verify:* effect params round-trip through save.
- C3. Public toggle + share URL; signed-out playback of a public board. *verify:* open share link in a fresh (signed-out) browser context and play it.

**Phase D — Polish + test harness (Q5)**
- D1. Keyboard bindings, multi-touch, volume-normalize toggle, error states, empty states.
- D2. **Vitest harness**: unit tests for pure math (distortion curve, reverb IR,
  free-cell finder, board-JSON guards, effect defaults) + a couple Functions route tests.
  Add `vitest` devDependency + `test` script to `package.json`. *verify:* `npm test` green.

---

## 14. Verification (how "done" is proven per phase)

- **A:** manual — open the page, click pads, hear layering + effects (no server yet).
- **B:** `wrangler pages dev` → upload a real file, confirm D1 row + R2 object; confirm
  > 2 MB is rejected; confirm a second browser tab shows the saved board after reload.
- **C:** incognito/signed-out context opens the share URL and can play; owner-only DELETE
  returns 403 for a non-owner.
- **D:** spot-checks + a short manual QA pass (matches the site's current "no test
  suite" reality — see open Q5).

---

## 15. Open questions — RESOLVED

> Q1–Q8 answered by the user (see the trailing notes + §12 D9–D16). The styling addendum
> is binding: **do not match the site — an entirely new look and feel.**

**Q1 — R2 bucket: new or shared?** I recommend a dedicated `make-sounds` bucket
(binding `SOUNDS`) for clean quota/lifecycle. Alternative: reuse `bloodbowl-photos` under
a `sounds/` prefix to avoid adding a bucket + `wrangler.toml` entry. **Needs your call.** - We'll go with make-sounds as recommended.'

**Q2 — Sharing granularity.** Public-by-uuid (my default) vs. also supporting
**private share links** (token in URL) or **per-user grants** (share to a specific
account). Do you want any of those in v1, or is public/private enough? - public private is enough.

**Q3 — Orphaned audio.** When a board is deleted (or a pad's sound unassigned), should we
GC the R2 object, or keep it until the user deletes it explicitly (safer, avoids accidental
loss)? I lean **keep-until-explicit-delete** for v1. - Keep sounds in a user library for 3 months if not assigned to a board. 

**Q4 — Per-user storage caps.** I proposed 100 sounds / 250 MB per user. Reasonable for a
personal tool? Or do you want tighter/looser limits? - If users can build multiple boards, let's lock to 100MB, and if they only make 1 we can limit to 20MB per board. (It's a sound board, not a song board')'

**Q5 — Testing.** The repo currently has no test/lint setup. Do you want this feature to
be the one that introduces a minimal test harness (e.g. vitest for the audio-engine math
+ a couple of Functions route tests), or keep it manual-verification like the rest of the
site today? - We can introduce a minimal test harness as recommended.

**Q6 — Max board size.** Default 4×4 (16 pads). Cap it (e.g. 6×6 = 36) or allow arbitrary
grid sizes? - I'd like a customizable grid at 6 x 9, and buttons/pads can take up multiple squares (or just one), should be user customizable.'

**Q7 — Effects to ship in v1.** My set: volume, pitch/speed, filter, echo, reverb,
distortion. Add/remove any (e.g. "bitcrusher", "tape delay", "pan")? -The three mentioned are good, and as long as the structure exists to 'easily' add more we can do with "only" these at launch. 

**Q8 — Where it links from.** Add a card to `tools/index.html` pointing at
`/tools/soundboard/`? (I assume yes.) - Assumption is correct, and it will also be linked on edu/tools- following conventions on that page. 

**Addendum**

**Styling** Do NOT match the site, this is to have an entirely new look and feel- unrelated to the core Make pages.

---

## 16. Phase E — v2 classroom overhaul (PLANNED 2026-10-19)

Audience widened to **primary-school music classrooms, media production, and live use at
classes/events**. Requirements from the user, each mapped to a story in
`specs/epics/e01-soundboard-v2/` (README there has waves, file ownership, and the
local-AI / Claude split):

| Requirement | Story |
|---|---|
| Split `ui.js`, add `node --test` runner (enabler) | e01s01 |
| Light, friendly theme: rounder, brighter, thicker outlines | e01s02 |
| Account as a small header chip + popover, not a panel block | e01s03 |
| Fit-to-screen layout (iPad portrait/landscape, phone); bottom-sheet edit panel on portrait | e01s04 |
| Mode toggle labelled **"Edit soundboard" / "Save edits"**; Save edits really saves | e01s05 |
| New pads start with **no effects**; per-effect on/off | e01s06 |
| Re-tap restarts a pad (choke); other pads unaffected | e01s07 |
| Edit mode shows the grid; drag/resize pads by mouse or touch, snapping to cells | e01s08 |
| Far more pad colours + fonts, all inline (no pop-up picker) | e01s09 |
| Record up to 10 s onto a pad | e01s10 |
| Small trim/clean-up toolset for recordings | e01s11 |
| v1 bugs found in review (SB-B1…B5) | e01s12 |

### Phase E decisions

| # | Decision | Why |
|---|---|---|
| D22 | **Light classroom theme replaces D16** (cream page, white cards, 3px ink outlines, pill buttons, full-strength pad colours, vendored Fredoka + Nunito) | Primary-school + projector use; user asked for friendlier, brighter, rounder, thicker outlines, light UI |
| D23 | **`node --test` instead of vitest** (supersedes the tool choice in D14) | Zero new dependencies; Node 24 present; `soundboard-core.js` already CommonJS-exports |
| D24 | **Effects are opt-in per pad** (`filterOn/echoOn/reverbOn/distortionOn`, default off); v1 pads load with all off | v1 defaults (echo 0.25, reverb 0.2) were wired into every trigger; user wants dry pads by default |
| D25 | **Per-pad choke:** a re-tap fades the pad's previous voice in 8 ms and restarts from 0; other pads never affected; loops restart too (STOP ends them) | Enables the classic stutter ("Co-Co-Come on down!"); matches sampler "mono retrigger" behaviour |
| D26 | **Drag/resize snaps to whole cells; invalid drops revert** (no swap/push in v2) | Simple, predictable for kids; swap/push can be added later |
| D27 | **No pop-up colour picker:** swatches + inline hue/lightness sliders + hex field; never `<input type=color>` | User: pop-ups are "annoying to close" |
| D28 | **Recordings: ≤ 10 s, mono 16-bit WAV, client-encoded**, uploaded through the existing `/api/sounds` path (≤ 2 MB holds at 48 kHz) | No server change; one format that every browser decodes |
| D29 | **Edit mode taps select (no sound); ▶ Preview button in the panel** | A tap that may start a drag must not fire audio |


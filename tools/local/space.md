# Space — Direct-Control Fleet Combat (three.js) — Build Plan

## Goal
A browser game where the player **directly pilots** a Battlefleet-Gothic-style
capital ship on a flat plane in space: heavy, slow-to-turn hulls; weapons with
real firing arcs; missiles you must shoot down; collisions that hurt; wrecks
that can be blasted apart. Static files only — no build step, no npm install.
Lives at `tools/local/space/`, served like the siblings (`/local/space/`).

This is a **feel prototype**. The deliverable is: "are the controls and the
gunplay fun?" If yes, the next plan turns it multiplayer, so the simulation is
built as a **deterministic, fixed-step, data-driven state machine** from day
one. Enemies are dumb target hulls — no AI is written here.

Estimated effort: 9 milestones, each one bounded agent run (~15–30 min).

---

## Decisions & assumptions (owner: correct these before M0 if wrong)

| Topic | Decision |
|---|---|
| Plane | The world is the XZ plane, `y = 0` for every ship, projectile, and chunk. |
| Units | 1 unit ≈ 1 m. Player hull ≈ 40 units long. Arena 2000 × 2000 with a soft edge (force pushes you back). |
| Sim | Fixed 60 Hz tick (`dt = 1/60`), rendering interpolates. Seeded RNG (`sim/rng.js`). **No `Math.random` in `sim/`.** All game state is one plain JSON-able object; all sim functions are `(state, input, dt) → mutate state` with no three.js, no DOM. |
| Controls | `W` forward thrust · `S` reverse thrust (40 %) · `A`/`D` turn · `1`–`4` select weapon · `Q`/`E` rotate the selected weapon's aim · `Space` **or left mouse** fire (hold = auto for turret, tap for cannons/lance) · mouse drag orbits camera · wheel zooms · `Esc` pause. |
| Aim model | Every mount stores an aim angle **relative to the ship's heading**, clamped to its arc. Turret 360°. Port cannon arc centred at +90° ±35°. Starboard at −90° ±35°. Lance centred 0° ±5°. Q/E aim rates: turret 120°/s, cannon 60°/s, lance 15°/s. Aim persists when you switch weapons. |
| Enemies | Same hull builder as the player, team-coloured. They drift on a fixed straight line or sit still, and carry a **timed missile launcher** (fires a straight-line missile at the player's *current* position every N s). That is a spawner, not AI — but it is required to exercise turret interception. |
| Missiles | Slow-ish, HP 5, big impact damage. Turret rounds kill them in 2–3 hits; a cannon shell one-shots them. |
| Debris | Wrecks break into 4–6 chunks. Chunks have HP; a killing cannon/lance hit on a chunk splits it (up to 2 generations), then it vanishes. Chunks collide with ships and hurt. Maps also start with "space junk" chunks. |
| Audio | None in this plan. |
| Persistence | `localStorage` keys `space.settings` and `space.ship` only. |
| End | Game ends when the player dies **or** every enemy is destroyed → stats dialog → back to hangar. |

---

## Operator notes
- One milestone per agent run, verbatim, plus the Rules block. Never the whole file.
- Invocation:
  ```
  cd ~/Documents/GitHub/make/tools/local
  pi --provider local-qwen --model Qwen3.8-27B-Q4_K_M
  ```
- Serve for visual checks: `python3 -m http.server 8000` from `tools/local/`, open
  `http://localhost:8000/space/`. `file://` will not work.
- `../3d/` already exists with a working vendored three.js **0.186.0** and a
  starfield. M0 copies from it — do not re-download.
- The agent cannot see WebGL. Every milestone lists headless checks it must run
  itself plus a short visual check for the owner.

### Rules for the agent (paste with every milestone)
```
Rules:
- Work only inside tools/local/space/. Read-only access to tools/local/3d/ for copying.
- Plain HTML/CSS/ES-module JS. No bundler, no npm install, no TypeScript, no framework.
- Never edit files under vendor/. Import three via the importmap names "three" and "three/addons/...".
- Files under js/sim/ and js/data/ must NOT import three or touch document/window.
  They are unit-tested in Node. No Math.random in js/sim/ — use the seeded rng.
- Keep each JS file under ~180 lines. Small named functions; no class hierarchies.
- Numbers that tune gameplay live in js/data/*.js, never inline in sim or render code.
- Run the milestone's headless checks and paste their output before finishing.
- Do not git add or git commit. Do not create branches.
- If unclear, pick the simplest option and state the assumption.
```

---

## File layout (built up across milestones)
```
space/
├── index.html                 # all screens as <section data-screen=...>, importmap
├── css/style.css
├── js/
│   ├── main.js                # boot: screens, settings, game loop glue
│   ├── screens.js             # showScreen(name), splash/hangar/settings/end wiring
│   ├── input.js               # keyboard/mouse → plain input object per tick
│   ├── data/
│   │   ├── hulls.js           # hull defs: mass, size, hp, thrust, turn, hardpoints[]
│   │   ├── weapons.js         # weapon defs: kind, arc, damage, rate, speed, ttl
│   │   └── maps.js            # spawn points, enemy list, junk fields, bounds
│   ├── sim/
│   │   ├── rng.js             # mulberry32 seeded rng
│   │   ├── state.js           # createState(map, playerShip) + entity factories
│   │   ├── physics.js         # thrust/turn integration, damping, soft bounds
│   │   ├── collide.js         # circle collisions + impulse + damage
│   │   ├── weapons.js         # aim clamp/rotate, fire/reload, projectiles, hitscan
│   │   ├── damage.js          # applyDamage, destroy → debris, chunk splitting
│   │   ├── enemies.js         # drift + timed missile launcher (NOT ai)
│   │   ├── stats.js           # counters + summary()
│   │   └── step.js            # step(state, input, dt): calls the above in order
│   └── render/
│       ├── stars.js           # copied from ../3d, radius scaled, follows camera
│       ├── shipMesh.js        # buildShip(THREE, hull, colors) with named mounts
│       ├── world.js           # scene, grid plane, sync meshes ↔ state entities
│       ├── camera.js          # orbit rig locked to player ship
│       ├── effects.js         # tracers, shells, lance beam, hit flashes
│       └── hud.js             # DOM HUD + 2D-canvas arc radar
├── vendor/three/…             # copied from ../3d/vendor/three
├── test/                      # node --test, one file per sim module
└── package.json               # {"type":"module"}
```

---

## M0 — Skeleton, screens, starfield (deliverable: you can click through to an empty arena)

**Deliverable:** Splash → Hangar → (Settings) → Launch shows a grid plane in
space with stars; Esc returns to the splash. No ship yet.

### Steps
1. `mkdir -p space/{css,js/data,js/sim,js/render,test}`; `cp -r ../3d/vendor space/vendor`.
2. `package.json`: `{ "name": "space", "private": true, "type": "module" }`.
3. `index.html`: importmap identical to `../3d/index.html`; then five sections:
   `<section data-screen="splash">` (title "SPACE", buttons Hangar / Settings),
   `hangar` (placeholder + **Launch** button + Back), `settings` (Back),
   `game` (`<canvas id="view">` + `<div id="hud">`), `end` (`<dialog id="end-dialog">`).
   Only one section visible at a time via `[hidden]`.
4. `js/screens.js`: `showScreen(name)` toggles `hidden`; `onScreen(name, fn)` callbacks.
   Wire buttons. `Esc` on the game screen → splash.
5. `js/render/stars.js`: copy the starfield block from `../3d/js/scene.js` into
   `buildStars(THREE, { count = 4000, rMin = 4000, rMax = 6000 } = {})` returning a
   `Points`. (Bigger shell because the arena is 2000 wide; camera far plane 20000.)
6. `js/render/world.js`: `createWorld(THREE, canvas)` → `{ scene, camera, renderer, stars, resize() }`.
   Dark background, `GridHelper(2000, 40, 0x223355, 0x111a2e)` at `y = 0`,
   stars added to the scene. In the loop, `stars.position.copy(camera.position)`
   so they never get closer.
7. `js/main.js`: boot screens; on entering `game`, create the world (once) and
   start a `requestAnimationFrame` loop that just renders; stop it on leaving.
8. `css/style.css`: full-viewport canvas, dark glass panels for screens/HUD
   (reuse the `#hud` look from `../3d/css/style.css`), big centered buttons.

### Headless checks
```bash
cd tools/local/space
ls -l vendor/three/three.module.js vendor/three/three.core.js        # both present
for f in js/*.js js/render/*.js; do node --check "$f" || echo "SYNTAX FAIL $f"; done
grep -c 'data-screen=' index.html                                     # == 5
grep -n "buildStars" js/render/stars.js js/render/world.js            # defined + used
(python3 -m http.server 8010 >/dev/null 2>&1 &); sleep 1
for p in index.html js/main.js vendor/three/three.module.js; do
  printf "%-40s %s\n" "$p" "$(curl -s -o /dev/null -w '%{http_code}' http://localhost:8010/$p)"; done
pkill -f "http.server 8010"
```
**Visual:** click through all screens; Launch shows grid + stars; Esc back; console clean.

---

## M1 — Data + deterministic sim core: hull physics (deliverable: `node --test` green)

**Deliverable:** A ship as plain data that accelerates, coasts, turns, and
respects arena bounds — all in Node, no three.

### Steps
1. `js/sim/rng.js`: `createRng(seed)` → `{ next() [0,1), range(a,b), int(a,b) }` (mulberry32).
2. `js/data/hulls.js`: export `HULLS` object. One hull for now, `"corvette"`:
   ```js
   { id:'corvette', name:'Corvette', length:40, radius:14, mass:1200, hp:600,
     thrust:180, reverseFactor:0.4, maxSpeed:60, turnAccel:1.6, maxTurn:0.9,
     linearDamping:0.35, angularDamping:2.5, collisionK:0.08,
     hardpoints:[
       { id:'turret', weapon:'gun',    offset:[0, 0],  arcCenter:0,     arcHalf:Math.PI },
       { id:'port',   weapon:'cannon', offset:[0, 8],  arcCenter: Math.PI/2, arcHalf:0.61 },
       { id:'stbd',   weapon:'cannon', offset:[0,-8],  arcCenter:-Math.PI/2, arcHalf:0.61 },
       { id:'lance',  weapon:'lance',  offset:[18,0],  arcCenter:0,     arcHalf:0.087 } ] }
   ```
   (`offset` is `[forward, left]` in ship space. Angles in radians.)
3. `js/sim/state.js`: `createShip(hull, { x, z, heading, team, colors })` →
   `{ id, team, hull:hull.id, x, z, heading, vx, vz, angVel, hp, mounts:{…per hardpoint: {aim:arcCenter, cooldown:0}}, selected:'turret', alive:true }`.
   `createState({ seed })` → `{ tick:0, time:0, rng, ships:[], projectiles:[], missiles:[], chunks:[], bounds:{half:1000}, nextId:1, stats:{} }`.
4. `js/sim/physics.js`:
   - `stepShip(ship, hull, input, dt)`: `input = { thrust:-1|0|1, turn:-1|0|1 }`.
     Forward vector `(cos h, sin h)`. Acceleration = `thrust * hull.thrust / hull.mass * 1000`
     (scale so numbers stay readable); reverse uses `reverseFactor`. Angular:
     `angVel += turn * turnAccel * dt`, clamp `±maxTurn`, `heading += angVel * dt`.
     Exponential damping on both when no input: `v *= exp(-damping*dt)`. Clamp speed.
   - `applyBounds(ship, bounds)`: beyond `half - 100`, add inward acceleration
     proportional to overshoot. Nothing hard-stops.
   - `speedOf(ship)`.
5. `test/physics.test.mjs` (node:test): thrust for 2 s → speed > 0 and ≤ maxSpeed;
   coasting 10 s → speed < 5 % of start; `turn:1` 1 s → heading > 0, angVel ≤ maxTurn;
   ship at `x = 990` gets pushed back toward 0 over 3 s; rng with same seed yields
   the same 5 numbers; **determinism**: two states stepped identically for 600
   ticks are `deepStrictEqual`.

### Headless checks
```bash
cd tools/local/space
node --test test/
grep -rn "from 'three'\|document\.\|window\.\|Math.random" js/sim js/data && echo "FAIL: impure sim" || echo "ok: sim is pure"
```

---

## M2 — Fly it: ship mesh, camera rig, WASD (deliverable: it *feels* like a heavy ship)

**Deliverable:** Launch puts you in the corvette. WASD flies it, mouse orbits
the camera around it, wheel zooms. Speed and heading shown in the HUD.

### Steps
1. `js/render/shipMesh.js`: `buildShip(THREE, hull, colors)` → `Group` whose
   +X axis is forward. Procedural, low-poly, from `hull.length`/`radius`:
   hull = elongated box + prow wedge (`primary` colour), spine stripe (`accent`,
   emissive), engine block at the stern with an emissive `glow` plate.
   For each hardpoint add a child named `hardpoint.id` at its offset:
   turret = short cylinder + barrel, cannons = box + barrel, lance = long thin
   prism. Store `group.userData.mounts = { id: childGroup }`.
2. `js/render/camera.js`: `createCameraRig(THREE, camera)` → `{ yaw, pitch, dist, update(target, dt), attach(canvas) }`.
   Drag (pointer, any button) changes yaw/pitch; wheel changes `dist` (60–500);
   pitch clamped to 0.15–1.45 rad. `update` places camera at
   `target + spherical(yaw, pitch, dist)` and `lookAt(target)`. Smooth follow with
   exponential lerp (`k = 8`).
3. `js/input.js`: `createInput(canvas)` → `sample()` returns
   `{ thrust, turn, select:null|'turret'|'port'|'stbd'|'lance', aim:-1|0|1, fire:bool, pause:bool }`
   from current key/mouse state (1–4 map to the four mount ids in hull order).
   Left mouse on the canvas = fire, **not** orbit; orbit uses right/middle button
   or drag with no fire — simplest: right-button drag orbits, left = fire.
   (Owner may flip this later; keep it in one place.)
4. `js/sim/step.js`: `step(state, input, dt)` — for now: player ship physics + bounds; `tick++`, `time += dt`.
5. `js/render/world.js`: add `syncShips(state)` — one mesh per ship id (create
   on demand, remove when gone). `mesh.position.set(x, 0, z)`, `mesh.rotation.y = -heading`.
6. `js/main.js`: on Launch: `state = createState({ seed })`, add player at origin,
   fixed-step accumulator (`while (acc >= 1/60) step(...)`), then `sync`, camera
   `update`, render. Pause on `Esc` → overlay with Resume / Quit-to-hangar.
7. `js/render/hud.js`: `createHud(el)` with `update(state, player)`: speed
   (u/s), heading (deg), a placeholder weapon row.

### Headless checks
```bash
cd tools/local/space
for f in $(find js -name '*.js'); do node --check "$f" || echo "SYNTAX FAIL $f"; done
node --test test/
grep -n "userData.mounts" js/render/shipMesh.js                       # mounts exposed
grep -n "rotation.y = -" js/render/world.js                           # heading sign convention
grep -n "1 / 60\|1/60" js/main.js                                     # fixed step
```
**Visual (the important one):** W takes ~2 s to reach speed, S slows it
noticeably slower than it accelerated, releasing keys coasts for several
seconds, A/D swing the bow with visible inertia. Camera orbits smoothly; the
ship never leaves centre. If it feels like a car, raise mass/damping in
`hulls.js` — do NOT touch physics.js.

---

## M3 — Weapons core, pure (deliverable: aim arcs, reloads, projectiles, hitscan all tested)

**Deliverable:** `sim/weapons.js` handles selection, Q/E aiming within arcs,
firing with reloads, projectile flight, and lance hitscan — in Node.

### Steps
1. `js/data/weapons.js` → `WEAPONS`:
   ```js
   gun:    { kind:'gun',    damage:2,   rate:15,  aimRate:2.09, speed:420, ttl:1.4, spread:0.03, vsMissile:1.5 }
   cannon: { kind:'cannon', damage:40,  reload:1.2, aimRate:1.05, speed:260, ttl:2.5, spread:0.01, vsMissile:10, vsChunk:3 }
   lance:  { kind:'lance',  damage:250, reload:6,   aimRate:0.26, range:420, beamMs:120 }
   ```
   (`rate` = rounds/s while held; `reload` = seconds between shots. `vsX` are
   damage multipliers so cannons "vastly overkill" missiles/chunks.)
2. `js/sim/weapons.js`:
   - `selectMount(ship, id)`; `rotateAim(ship, hull, id, dir, dt)` → clamps to
     `arcCenter ± arcHalf` (turret: wraps, no clamp).
   - `worldAim(ship, hull, id)` → absolute angle + muzzle world position from the
     hardpoint offset.
   - `tickCooldowns(ship, dt)`.
   - `tryFire(state, ship, hull, id)`: if cooldown ≤ 0, for gun/cannon push a
     projectile `{ id, owner, team, kind, x, z, vx, vy, ttl, damage }` (spread via
     `state.rng`), set cooldown (`1/rate` or `reload`), bump `stats.rounds[kind]`.
     For lance: `hitscanCircles(origin, angle, range, targets)` → nearest hit
     within range; returns `{ target, point }` and pushes a `beam` record
     `{ x0,z0,x1,z1, expires }` for the renderer.
   - `stepProjectiles(state, dt)`: integrate, expire on ttl, circle-hit test vs
     ships (not owner's team), missiles, chunks → on hit call `damage.applyHit`
     (M4 stub for now: just remove projectile and record in `state.events`).
3. `test/weapons.test.mjs`: cannon aim clamps at `±0.61` around its centre;
   turret aim wraps past 2π; lance aim clamps at ±0.087; firing sets cooldown
   and a second `tryFire` in the same tick returns null; gun at rate 15 fires
   15 ± 1 rounds over 1 s of ticks with `fire:true`; projectile expires after
   `ttl`; hitscan picks the nearest of two circles and ignores ones behind;
   determinism holds across 600 ticks with firing.

### Headless checks
```bash
cd tools/local/space
node --test test/
grep -rn "Math.random" js/sim && echo "FAIL" || echo "ok: seeded only"
```

---

## M4 — Weapons in-game + HUD arcs (deliverable: shooting feels good)

**Deliverable:** 1–4 selects, Q/E sweeps the aim, Space/LMB fires; you see
tracers, shells, and a lance beam; the HUD radar shows arcs and current aim.

### Steps
1. `sim/step.js`: apply `input.select`, `input.aim`, `input.fire` to the player
   via `weapons.js`; step projectiles; expire beams.
2. `render/effects.js`: `createEffects(THREE, scene)` with `sync(state)`:
   gun rounds = short `Line` tracers (2-unit segment along velocity, `accent`
   colour); cannon shells = small bright spheres; lance beam = thin cylinder
   between `x0z0`–`x1z1` that fades over `beamMs`; a tiny expanding ring at
   hit points from `state.events`. Pool meshes; never allocate per frame.
3. `render/world.js`: rotate mount children: `mounts[id].rotation.y = -aim`
   (turret whole, cannon barrel, lance none).
4. `render/hud.js`: weapon row — four cells (`1 Turret`, `2 Port`, `3 Stbd`,
   `4 Lance`), selected highlighted, reload bar under each. **Radar**: a 160 px
   2D canvas, ship outline at centre pointing up, each mount's arc drawn as a
   translucent wedge, current aim as a bright line, selected arc brighter.
5. Add a faint muzzle flash (scale a small sphere for 60 ms) — optional if time.

### Headless checks
```bash
cd tools/local/space
for f in $(find js -name '*.js'); do node --check "$f" || echo "SYNTAX FAIL $f"; done
node --test test/
grep -n "getContext('2d')" js/render/hud.js                            # radar
grep -n "beamMs\|beams" js/render/effects.js                           # lance drawn
grep -n "input.fire\|input.aim\|input.select" js/sim/step.js           # wired
```
**Visual:** turret spins all the way round with Q/E; cannons stop at arc
edges; lance barely moves; lance fires a visible beam then a 6 s bar refills;
holding Space with the turret sprays tracers; radar matches what you see.

---

## M5 — Damage, collisions, wrecks, enemies (deliverable: an actual fight)

**Deliverable:** Enemy hulls on the map fire missiles at you; you can shoot
missiles down, kill ships, ram (and regret it), and blast wrecks to pieces.

### Steps
1. `js/data/maps.js` → `MAPS.skirmish`: player spawn, 3 enemies (hull `corvette`,
   `team:'red'`, positions, optional `drift:{vx,vz}`, `launcher:{period:7, speed:70, ttl:9, damage:120, hp:5}`),
   a `junk` field (12 chunks, sizes 4–10, random positions via rng), `seed`.
2. `sim/enemies.js`: `stepEnemies(state, dt)`: apply drift; each launcher ticks
   a timer and pushes a missile `{ x, z, vx, vz, ttl, hp, damage, team }` aimed
   at the player's current position. That is all. **No pursuit, no aiming lead, no evasion.**
3. `sim/collide.js`: broad-phase none (entity counts are tiny); circle tests
   ship↔ship, ship↔chunk, chunk↔chunk. Resolve overlap, apply impulse with
   restitution 0.3 and mass ratio; damage each party `collisionK * relSpeed * otherMass / 1000`
   (chunk mass = `size³ * 2`). Record `stats.collisions`, `stats.collisionDamage`.
   Missile↔ship = detonation (damage, remove missile). Missile↔chunk = detonation too.
4. `sim/damage.js`: `applyHit(state, target, amount, source)` with `vs*`
   multipliers; `stats.damageDealt/Taken` by team; on `hp ≤ 0`:
   ship → `alive:false`, spawn 4–6 chunks (sizes 5–12, inherit velocity + rng
   scatter, `gen:0`, hp `size*3`), `stats.kills++` if player-caused.
   Chunk killed by cannon/lance and `gen < 2 && size > 5` → 2–3 smaller chunks;
   otherwise removed (`stats.debrisDestroyed++`).
5. `sim/stats.js`: `createStats()` with all counters
   (`damageDealt, damageTaken, rounds:{gun,cannon,lance}, hits:{…}, missilesIntercepted, kills, collisions, collisionDamage, distance, debrisDestroyed, time`);
   `accumulateDistance(stats, ship, dt)`; `summary(stats)` → array of
   `{ label, value }` rows (accuracy % per weapon derived).
6. `sim/step.js` full order: input → player physics → enemies → all ship
   physics/bounds → chunks drift → weapons/projectiles → missiles → collisions →
   damage/cleanup → stats → `state.over = !player.alive || enemies.every(!alive)`.
7. `render/world.js`: enemy meshes via the same builder (`team` colours from
   `data/hulls.js` `TEAM_COLORS`); missiles = small elongated cones with a glow;
   chunks = irregular boxes (`BoxGeometry` scaled by rng) tumbling with
   `angVel`; dead ships' meshes removed. HUD: HP bar, enemies remaining,
   "MISSILE" warning when any missile is within 250 u.
8. `test/collide.test.mjs`, `test/damage.test.mjs`, `test/enemies.test.mjs`:
   head-on equal-mass collision → both damaged equally and velocities reverse
   partially; heavier body loses less speed; cannon on a `size 10` chunk splits
   it into 2–3 smaller ones with total size < original; gen-2 chunk is removed;
   launcher fires exactly `floor(T/period)` missiles in `T` seconds; a missile
   (hp 5) survives one gun round (`2 × 1.5 = 3`) and dies on the second, while
   one cannon shell (`40 × 10`) kills it outright; `state.over`
   flips when the last enemy dies; determinism over 1200 ticks with a full map.

### Headless checks
```bash
cd tools/local/space
node --test test/                                    # all suites green
grep -rn "Math.random\|document\.\|from 'three'" js/sim js/data && echo "FAIL" || echo "ok"
grep -n "state.over" js/sim/step.js js/main.js       # end condition produced + consumed
```
**Visual:** missiles come at you; turret tracers pop them; a cannon shell
turns one into a flash; ramming an enemy chunks HP off both; a dead enemy
becomes tumbling wreckage; cannon fire splits wreckage; junk hurts to hit.

---

## M6 — Hangar + settings + end-of-game stats (deliverable: the full loop)

**Deliverable:** Splash → Hangar (customise, Launch) → fight → stats dialog →
Hangar. Settings persist.

### Steps
1. **Hangar**: a second small `WebGLRenderer` on a `<canvas id="hangar-view">`
   showing the player's hull slowly rotating (reuse `buildShip`). Controls:
   `primary` / `accent` / `glow` colour inputs, ship name text, hull `<select>`
   (only `corvette` today — the select exists so more hulls slot in), and a
   read-only list of the four hardpoints ("weapon swap: coming later").
   Saves to `localStorage['space.ship']` on change; Launch reads it.
2. **Settings**: camera sensitivity (0.5–2), invert camera Y, zoom-to-fire
   (LMB fires vs orbits — the flip from M2), quality (pixel ratio 1 / 1.5 / 2),
   show damage numbers (bool), reset-to-defaults. `localStorage['space.settings']`.
   Read by `camera.js`, `input.js`, `world.js`, `hud.js` via one `getSettings()`.
3. **End dialog**: when `state.over` first becomes true, freeze sim, wait 1.5 s
   (let the wreck tumble), then open `<dialog id="end-dialog">` titled
   `VICTORY` / `SHIP LOST` with a two-column table from `stats.summary()` and
   buttons **Again** (same map + new seed) and **Hangar**.
4. Damage numbers (if enabled): floating DOM labels at hit points, fade 0.8 s,
   pooled (max 24).

### Headless checks
```bash
cd tools/local/space
for f in $(find js -name '*.js'); do node --check "$f" || echo "SYNTAX FAIL $f"; done
node --test test/
grep -n "space.ship\|space.settings" js/*.js js/render/*.js | wc -l   # >= 4
grep -n 'id="end-dialog"' index.html                                  # present
grep -n "summary(" js/sim/stats.js js/main.js js/screens.js           # produced + rendered
```
**Visual:** change colours → ship in hangar updates live → Launch shows those
colours in the arena; die or win → dialog with sensible numbers (distance
grows, rounds match what you fired); Again restarts; settings survive reload.

---

## M7 — Feel & tuning pass (deliverable: it's fun, or we know why not)

**Deliverable:** Nothing new — a tuning session on `js/data/*.js` plus a few
readability effects. Half an hour, hard stop.

### Steps
1. Add a `?tune` URL flag that mounts a lil-gui panel (from `vendor/three/addons/libs/`)
   bound **live** to `HULLS.corvette` and `WEAPONS.*` numbers so the owner can
   tune in-game without editing files. Panel also shows current tick rate and
   entity counts. Do not persist.
2. Camera: slight lag on fast turns (`k` 8 → 5 when `|angVel| > 0.5`), tiny
   shake on collision (decaying random offset, ≤ 1.5 u, 300 ms).
3. Engine glow plate emissive intensity scales with `thrust` input.
4. Speed lines: 200 stars of a second, nearer starfield shell (r 200–400) that
   parallax more — cheap sense of motion on a plane with no landmarks.
5. Write the numbers you end up with back into `data/*.js` with a one-line
   comment each on *why*.

### Headless checks
```bash
cd tools/local/space
node --test test/
grep -n "tune" js/main.js                                           # flag exists
grep -rn "Math.random" js/sim js/data && echo "FAIL" || echo "ok"   # still deterministic
```
**Visual:** owner plays 3 rounds. Records in `space/NOTES.md`: what felt good,
what didn't, and the tuned numbers.

---

## M8 — Hand-off (deliverable: README + clean tree, ≤ 20 min)

1. `space/README.md` (≤ 60 lines): premise, controls table, how to serve, file
   map, **how to add a hull / weapon / map** (data only — point at the three
   data files and the hardpoint schema), the determinism contract (`sim/` is
   pure, seeded, fixed-step — required for the multiplayer plan), and known gaps.
2. Re-run every headless check from M0–M7 and paste the combined output.
3. `git -C ../../.. status --short tools/local/space | head` — nothing staged.

---

## Scope guard — NOT in this plan
- **No enemy AI.** Drift + timed missile launcher is the ceiling. Don't add
  pursuit, leading, or evasion "because it was easy".
- No networking, no lobbies, no second player. (The pure `sim/` is the prep.)
- No audio. No GLTF/textures/HDR. No post-processing bloom.
- One hull, four weapons, one map. The **schemas** support more; the content doesn't.
- No mobile/touch layout.
- No shield/energy/power-management systems — HP only.

If any of these look tempting, note it in `NOTES.md` for the next plan.

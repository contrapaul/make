# SPACE

Direct-control capital-ship combat on a flat plane. Fly a corvette: thrust,
turn, aim four hardpoints, and fight drifting red enemies, their missiles,
and a field of junk — a three.js browser prototype on a **deterministic,
fixed-step, data-driven simulation core** (the prep for multiplayer).

## Serve & play

No build step, no npm. From `tools/local/`: `python3 -m http.server 8000` →
`http://localhost:8000/space/`. Append `?tune` for the live lil-gui panel (in-memory only).

## Controls

| Key | Action |
|---|---|
| W / S | thrust / reverse |
| A / D | turn left / right |
| 1–4 | select hardpoint (turret, port, stbd, lance) |
| Q / E | aim selected mount |
| Space / LMB | fire (lance: hold through the 1.2 s charge) |
| right-drag / wheel | orbit / zoom |
| Esc | pause |

Hangar (name/hull/colors) and Settings (camera, quality, damage numbers)
persist to localStorage.

## File map

```
js/data/   hulls · weapons · maps        ← all tuning numbers live here
js/sim/    rng state physics weapons damage collide enemies stats step  ← pure
js/render/ world shipMesh camera hud effects stars                     ← three.js
js/        main screens input settings profile · test/ 29 node:test suites
```

## Adding content (data only)

- **Hull** → `HULLS` in `js/data/hulls.js`: stats + `hardpoints[]`
  (`id, weapon, offset[forward,left], arcCenter, arcHalf`), plus a hangar
  `<option>`.
- **Weapon** → `WEAPONS` in `js/data/weapons.js`: `kind` +
  damage/rate-or-reload/speed/ttl/spread, optional `range`, `vsMissile`,
  `vsChunk`.
- **Map** → `MAPS` in `js/data/maps.js`: bounds, player spawn, enemies
  (drift + `launcher{}` spawner), junk chunks, seed.

## Determinism contract

`js/sim` + `js/data` contain no three.js, no DOM, no `Math.random` — only the
seeded `mulberry32` in `sim/rng.js`. One `step(state, input, dt)` at a fixed
60 Hz mutates one plain JSON-able `state` object. Same seed + same inputs ⇒
identical state (covered by tests). This is the foundation the multiplayer
plan builds on: lockstep or client-prediction both work from here.

## Known gaps

- One hull, one map; no weapon swapping (the schemas support both).
- Enemies drift; launchers aim at your current position — no lead/evasion.
- No audio, mobile layout, or post-processing. `?tune` doesn't persist. Tuning log: `NOTES.md`.

# SPACE — play notes & tuning log

## M7 tuned numbers (baked into `js/data/*.js`)

| Number | Before → After | Why |
|---|---|---|
| hull `turnAccel` | 1.6 → 2.0 | A/D felt mushy below 2 |
| hull `maxTurn` | 0.9 → 1.0 | missile evasion needs faster hard turns |
| hull `collisionK` | 0.08 → 0.06 | ramming should hurt, not nearly kill |
| gun `damage` | 2 → 3 | 2 read as sparks, not hits |
| gun `rate` | 15 → 18/s | 15 left gaps while tracking |
| cannon `reload` | 1.2 → 1.0 s | 1.2 felt dead between shots |
| map launcher `period` | 7 → 8 s | slightly gentler missile cadence |
| map launcher `speed` | 70 → 60 u/s | dodgeable with basic evasive turns |

Live tuning: append `?tune` to the URL (`http://localhost:8000/space/?tune`) —
lil-gui panel bound to `HULLS.corvette` and `WEAPONS.*`, plus live entity
counts. In-memory only; nothing persists. Re-check `node --test` after any
change you want to keep, then bake the number into `js/data/*.js`.

## Play-test log (owner — 3 rounds)

Round 1: …
- felt good: Movement is generally good. Impact effects will make it feel better. 
- felt bad: Game loads with camera facing right side of ship. Move to back. Giant square stars are distracting and bad- need to go. The distant starfield is good. Incorporating hues of red, purple, blue, and orange into portions of space will bring variety. Impacts must be weightier- need a proper blast effect. Damage to ship geometry ultimate goal, with guns and engines being disabled due to enemy fire. 
- number to change:

Round 2: …
- felt good: 
- felt bad: Added here to space things out. Lance needs a small charge before firing. Cannons feel incredibly week- no fire effect + extremely minor impact effect and no visible damage makes it seem useless. Left mouse needs to be mapped to fire in addition to spacebar.
- number to change:

Round 3: …
- felt good:  
- felt bad: 
- number to change:

## Resolutions (rounds 1–2 notes)

| Note | Fix |
|---|---|
| camera loaded off to the side | `beginGame` now starts the rig astern of the spawn heading (`rig.yaw = -heading - π/2`) |
| giant square stars | near "speed-line" shell removed entirely; far shell kept |
| space needs hue variety | starfield now per-vertex colors: ~70% white-blue, 15% orange, 10% red, 10% purple |
| lance needs a charge | 1.2 s hold-to-charge (`WEAPONS.lance.charge`), HUD bar shows progress, release resets — 2 new tests |
| impacts weightier / cannon weak | muzzle flashes + damage-scaled blast spheres (pooled); damage numbers now **on by default** |
| LMB must fire | left mouse always fires (Space too); right-drag always orbits — the toggle is gone, stale settings key inert |
| subsystem/engine damage | **not implemented — proposed as M9** (HP-threshold offline mounts + degraded thrust) |

Also fixed along the way: sim events now carry a monotonic `seq` so effects and
damage labels consume each one exactly once (no re-spawn while paused).

## Scope-guard temptations (per plan: note here, don't implement)

- Subsystem damage (guns/engines disabled by enemy fire) — owner round 1. Proposed as M9, see Resolutions.

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
- felt good:
- felt bad:
- number to change:

Round 2: …
- felt good:
- felt bad:
- number to change:

Round 3: …
- felt good:
- felt bad:
- number to change:

## Scope-guard temptations (per plan: note here, don't implement)

- (none yet)

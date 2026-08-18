# Making maps

A level is one JSON file in `app/levels/`. Drop a file in there and the game
finds it — the level list is a glob, not a hardcoded list.

There are two ways to author one: draw it as text and convert, or edit the JSON
directly. Either way, `npm run checks` validates every map in the folder,
including whether the exit can actually be reached.

## The quick way: draw it as text

Write a `.map` file — see [maps/example.map](maps/example.map) for a worked one:

```text
# id: level_03
# name: The Reed Pit
# yaw: 90

##########
#S...K..D#
#..TT....#
#....E...#
##########
```

Convert it:

```bash
npm run map -- maps/level_03.map
```

That writes `app/levels/level_03.json`. Then add a node to
[app/src/data/overworld.json](app/src/data/overworld.json) so it appears on the
descent map, and run `npm run checks`.

### Legend

Uppercase picks something up, lowercase is the door it opens.

| | | | |
|---|---|---|---|
| `#` wall | `.` or space floor | `S` player start | `E` exit portal |
| `K` red key | `B` blue key | `G` green key | |
| `k` or `D` red door | `b` blue door | `g` green door | |
| `T` Hell Tambourine | `M` Infernal Maracas | `W` Damned Whistle | `O` Abyssal Organ |
| `I` Screaming Siren | `F` Cursed Fiddle | `C` Choir of Ruin | `Z` Wretched Zither |

Header lines set metadata: `id`, `name`, `yaw` (start facing, 0 is map-north and
90 is east), and optionally `wall`, `floor`, `ceiling` texture ids.

Short rows are padded with wall, so a ragged text file still makes a sealed map.

## The direct way: edit the JSON

The format is plans.md §14. `walls` is row-major with `0` for floor and `1` for
wall; every other position is a cell coordinate into that grid. Doors are *not*
walls in the grid — they occupy an open cell and block it until opened.

Cell `(x, y)` becomes world position `(x + 0.5, y + 0.5)`: x runs east, y runs
south, and one cell is one metre.

### Sky or ceiling

Levels are open to the burning sky by default. For an enclosed level, add:

```json
"sky": false
```

and the `textures.ceiling` id is used as a roof at wall height instead. Walls are
3 m either way, and you can never see over a wall of equal height, so an open
level shows sky above the walls without revealing the layout beyond them.

## What the checks enforce

Run `npm run checks` after any change. Every map in `app/levels/` is held to:

- the grid matches its declared `width` and `height`, and the outer edge is sealed
- start, exit, every key, door and enemy stands on floor, not inside a wall
- every door has a key of that colour somewhere, and every key opens something
- enemy types exist in [enemies.json](app/src/data/enemies.json)
- **the exit is reachable** — it replays the level the way a player must: explore,
  take reachable keys, open what they unlock, explore again. A key behind its own
  door fails here rather than wasting your playtest
- every map has a node on the descent, and the descent is one chain with no
  orphaned nodes

## Deploying a new map

Levels are bundled at build time, unlike audio and images which are fetched at
runtime. So a new map needs:

```bash
npm run build
```

and the built output committed, same as any code change.

## Tuning what's in a map

- **Enemy stats** — [app/src/data/enemies.json](app/src/data/enemies.json). HP,
  speed, damage, cooldowns and weak points are all data; nothing is hardcoded.
- **Weapon stats** — [app/src/data/weapons.json](app/src/data/weapons.json).
- **Ranges, detection, timings** — [app/src/data/constants.ts](app/src/data/constants.ts).

The checks include guard rails on these: kill times stay inside two breath tanks,
no weapon runs away with the damage, and melee enemies always stop inside their
own reach. Change a number past what's sensible and a check will say so.

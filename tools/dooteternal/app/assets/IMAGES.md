# Image manifest

Every image the game will use if you supply it. **All of these are optional** —
each one has a procedural stand-in drawn at boot, so the game is complete and
playable with this list entirely empty, and gets better one file at a time.

Drop a file at its exact path and reload. No code change, no rebuild needed for
the asset itself. `npm run checks` fails if a path here and a path in the code
ever drift apart.

A 404 in the network tab for a file you haven't made yet is expected, not a bug.

**Shared specs (plans.md §11):** PNG with alpha · sRGB · power-of-two sizes ·
no checkerboard backgrounds in the final files · consistent scale across enemies.

## Level surfaces (§13)

Must tile seamlessly — they repeat once per metre.

- [ ] `textures/walls/hell_wall_01.png` — 512x512, tileable. Cracked brass, obsidian with glowing staff lines, melted piano keys.
- [ ] `textures/floors/music_floor_01.png` — 512x512, tileable. Cracked marble with gold veins, dark stage wood, obsidian tiles.
- [ ] `textures/ceilings/void_ceiling_01.png` — 512x512, tileable. Void with faint notes, inverted organ pipes, hellfire.

## Effects (§11.4)

- [ ] `textures/particles/particle_gold.png` — 64x64. Radial gold, bright centre to transparent edge. Drawn additively, so black is invisible and bright is hot.
- [ ] `textures/decals/gold_splat_01.png` — 256x256. Irregular gold splatter, liquid or molten.
- [ ] `textures/decals/gold_splat_02.png` — 256x256.
- [ ] `textures/decals/gold_splat_03.png` — 256x256.
- [ ] `textures/decals/gold_splat_04.png` — 256x256.

## Enemy sprite sheets (§11.1)

One sheet per enemy, **8 columns x 6 rows of 256x256 frames** (2048x1536).
Row order is fixed:

| Row | State | Frames used | Notes |
|---:|---|---:|---|
| 0 | idle | 4 | Currently the only row drawn for a living enemy |
| 1 | walk | 6 | |
| 2 | attack | 3–5 | |
| 3 | hit flash | 1 | |
| 4 | death | 8 | |
| 5 | corpse | 1 | Used as-is where the enemy fell |

Only rows 0 and 5 are read today — idle and corpse. The other rows are wired
into the layout so animation can be turned on without re-cutting art.

The **weak point must sit where the data puts it**: `weakPoint.offset` in
[enemies.json](../src/data/enemies.json) is measured from the enemy's centre, and
`heightMeters` is the sprite's world height. For the tambourine that puts the
weak point at 1.6 m — exactly player eye height, dead centre of the crosshair.

- [ ] `sprites/enemies/hell_tambourine_sheet.png` — low HP, slow, weak melee
- [ ] `sprites/enemies/infernal_maracas_sheet.png` — low HP, fast, weak melee
- [ ] `sprites/enemies/damned_whistle_sheet.png` — low HP, slow, weak ranged
- [ ] `sprites/enemies/abyssal_organ_sheet.png` — mid HP, slow, big, strong ranged
- [ ] `sprites/enemies/screaming_siren_sheet.png` — mid HP, fast, charged ranged
- [ ] `sprites/enemies/cursed_fiddle_sheet.png` — mid HP, fast, melee and ranged
- [ ] `sprites/enemies/choir_of_ruin_sheet.png` — high HP, slow, ranged AoE
- [ ] `sprites/enemies/wretched_zither_sheet.png` — very low HP, very fast, weak melee

## First-person instruments (§11.2)

512x512, transparent, right-hand style, angled in from the lower right with the
bell pointing toward screen centre. Keep the crosshair area clear.

- [ ] `sprites/weapons/trumpet_viewmodel.png`
- [ ] `sprites/weapons/tuba_viewmodel.png`
- [ ] `sprites/weapons/saxophone_viewmodel.png`
- [ ] `sprites/weapons/electric_guitar_viewmodel.png`

## Projectiles (§11.3)

- [ ] `sprites/projectiles/proj_note.png` — 64x64. Drawn additively and tinted in code: white for your shots, red for enemy fire. Keep it bright and neutral.

The tuba's wave and the guitar's blasts are shader rings, not images.

## Keys, doors and the exit (§11.5)

- [ ] `sprites/keys/key_red_note.png` — 128x128
- [ ] `sprites/keys/key_blue_note.png` — 128x128
- [ ] `sprites/keys/key_green_note.png` — 128x128
- [ ] `textures/doors/door_red_front.png` — 512x512, with a visible note-shaped lock
- [ ] `textures/doors/door_blue_front.png` — 512x512
- [ ] `textures/doors/door_green_front.png` — 512x512
- [ ] `sprites/exit_portal.png` — 256x256, additive. Bright centre reading as a way out.

Door colour must match its key unmistakably, and the lock shape should carry the
meaning too — colour alone isn't enough to read at speed.

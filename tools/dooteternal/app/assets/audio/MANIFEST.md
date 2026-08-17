# Audio manifest

The 22 files the tech demo expects, from [plans.md §12](../../../plans.md). Drop them
in at exactly these paths — `AudioManager` (Phase 3) resolves them from here, and
any file still missing is logged once and treated as silent, so an incomplete set
never blocks the build.

**Shared specs:** 44.1 kHz · WAV is 16-bit PCM · peaks normalised to about −3 dBFS ·
no clipping · loops must be seamless.

## Soundtrack

- [ ] `soundtrack/music_hell_loop.ogg` — seamless loop, stereo, 30–90 s, dark music-hell theme. Toggled by the pause menu.

## Breath

- [ ] `sfx/breath_recharge.ogg` — seamless loop, inhale/recharge. Starts when recharge begins, short fade-out when full or when firing resumes.

## Weapons

Trumpet — one of the three picked at random per shot:

- [ ] `sfx/trumpet_fire_01.wav`
- [ ] `sfx/trumpet_fire_02.wav`
- [ ] `sfx/trumpet_fire_03.wav`

Tuba — one of the two picked at random per blast:

- [ ] `sfx/tuba_blast_01.wav`
- [ ] `sfx/tuba_blast_02.wav`

Saxophone — held-fire loop, restarts on each new burst, ~100 ms fade-out on release:

- [ ] `sfx/saxophone_fire_loop.ogg` — seamless loop, continuous notes or a sustained riff.

Electric guitar — played in this exact order, matched to the three wave blasts
(large/short-range, medium/medium, small/long-range):

- [ ] `sfx/guitar_blast_01.wav`
- [ ] `sfx/guitar_blast_02.wav`
- [ ] `sfx/guitar_blast_03.wav`

## Enemies

- [ ] `sfx/enemy_hit_generic.ogg`
- [ ] `sfx/enemy_death_generic.ogg`
- [ ] `sfx/enemy_melee_windup.ogg`
- [ ] `sfx/enemy_projectile_fire.ogg`

Per-enemy hit/death variants are optional; generic is fine for the tech demo.

## World and UI

- [ ] `sfx/key_pickup_red.ogg`
- [ ] `sfx/key_pickup_blue.ogg`
- [ ] `sfx/key_pickup_green.ogg`
- [ ] `sfx/door_open.ogg`
- [ ] `sfx/exit_portal.ogg`
- [ ] `sfx/player_hurt.ogg`
- [ ] `sfx/ui_click.ogg`

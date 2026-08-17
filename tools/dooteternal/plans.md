# Browser Doom/Boltgun-Style “Music Hell” Clone — Build Plan

## 1. Recommended Technical Approach

For a browser-based Doom/Boltgun-style game with:

- WASD movement
- mouse look
- free strafing/aiming
- projectile weapons, not hitscan
- particles
- surface decals
- billboard enemy sprites
- local save
- overworld map
- pause menu settings

I recommend this stack:

| Area | Recommendation | Why |
|---|---:|---|
| Language | TypeScript | Safer data-driven gameplay code |
| Build tool | Vite | Fast dev server, easy browser build |
| Renderer | Three.js / WebGL | Easier than a pure raycaster for projectiles, particles, decals, mouse look, and 3D weapon view models |
| Audio | Howler.js or Web Audio API | Easy loops, volume control, random one-shots, sequence playback |
| Save system | `localStorage` first; IndexedDB later if saves grow large | Simple local persistence |
| Level editing | Custom JSON level format + optional Tiled Map Editor export | Simple for tech demo, scalable to 10 levels |

If you specifically want an authentic Doom-style raycaster instead of a full Three.js scene, the same data model can be used. But for this plan, I am choosing **Three.js** because it makes projectile weapons, gold particle blood, surface decals, weapon-specific death effects, and free mouse look much easier to implement cleanly.

---

# 2. Tech Demo Scope

The initial build should be a **2-level tech demo**, not the full 10-level game.

## Included in tech demo

- First-person browser gameplay
- WASD movement + mouse look with pointer lock
- Free strafing and aiming
- Player breath system
- 4 weapons:
  - Trumpet
  - Tuba
  - Saxophone
  - Electric Guitar
- Projectile-based weapon effects, not hitscan
- 8 enemy types based on demonic instruments
- Enemy HP and weak points configurable in code/data
- Yellow/gold hit particles
- Gold “blood” decals projected onto nearby surfaces
- Weapon-specific death animations/effects
- Overkill-tier death variations
- Persistent corpse sprites where enemies die
- Colored music-note keys
- Doors that open with matching keys
- Exit portal to next level
- 2 playable levels
- Simple overworld descent map
- Local save for settings and progress
- Pause menu with:
  - soundtrack on/off
  - SFX volume
  - mouse sensitivity
- 100% placeholder art can be generated in code, or you can request simple placeholder images using the asset brief below

## Not required yet

- Full 10 levels
- Complex inventory pickups
- Jumping/flying unless desired later
- Multiplayer
- Advanced pathfinding/AI
- Custom per-enemy weapon-specific death sprite sheets for all combinations, though the system should support them

---

# 3. High-Level Architecture

Suggested project structure:

```text
src/
  main.ts
  core/
    GameLoop.ts
    InputManager.ts
    PlayerController.ts
    CameraRig.ts
    CollisionSystem.ts
    SpatialHashGrid.ts
    LevelLoader.ts
    SaveSystem.ts
    AudioManager.ts
    PlaceholderAssets.ts

  systems/
    BreathSystem.ts
    WeaponSystem.ts
    ProjectileSystem.ts
    EnemySystem.ts
    ParticleSystem.ts
    DecalSystem.ts
    DoorKeySystem.ts
    OverworldMap.ts
    PauseMenu.ts

  data/
    enemies.json
    weapons.json
    overworld.json
    textures.json

levels/
  level_01.json
  level_02.json

assets/
  audio/
    soundtrack/
      music_hell_loop.ogg
    sfx/
      breath_recharge.ogg
      trumpet_fire_01.wav
      trumpet_fire_02.wav
      trumpet_fire_03.wav
      tuba_blast_01.wav
      tuba_blast_02.wav
      saxophone_fire_loop.ogg
      guitar_blast_01.wav
      guitar_blast_02.wav
      guitar_blast_03.wav
      enemy_hit_generic.ogg
      enemy_death_generic.ogg
      key_pickup_red.ogg
      door_open.ogg
      exit_portal.ogg
      player_hurt.ogg
      ui_click.ogg

  textures/
    walls/
      hell_wall_01.png
    floors/
      music_floor_01.png
    ceilings/
      void_ceiling_01.png
    decals/
      gold_splat_01.png
      gold_splat_02.png
    particles/
      particle_gold.png

  sprites/
    enemies/
      hell_tambourine_sheet.png
      infernal_maracas_sheet.png
      damned_whistle_sheet.png
      abyssal_organ_sheet.png
      screaming_siren_sheet.png
      cursed_fiddle_sheet.png
      choir_of_ruin_sheet.png
      wretched_zither_sheet.png

    weapons/
      trumpet_viewmodel.png
      tuba_viewmodel.png
      saxophone_viewmodel.png
      electric_guitar_viewmodel.png

    projectiles/
      proj_trumpet_note.png
      proj_tuba_ring.png
      proj_sax_note.png
      proj_guitar_wave_1.png
      proj_guitar_wave_2.png
      proj_guitar_wave_3.png

    keys/
      key_red_note.png
      key_blue_note.png
      key_green_note.png

    doors/
      door_red_front.png
      door_blue_front.png
      door_green_front.png
```

For the tech demo, many of these image files can be replaced by runtime-generated placeholder textures. That is acceptable and recommended for the first playable build.

---

# 4. Core Gameplay Data Model

All gameplay numbers should live in data files or typed constants so HP, damage, breath cost, spread, fire rate, weak point multiplier, etc. are easy to adjust.

## 4.1 General Constants

```ts
export const PLAYER = {
  maxBreath: 40,
  moveSpeed: 4.0,          // meters/second
  radius: 0.35,            // collision circle radius
  eyeHeight: 1.6,
};

export const BREATH = {
  max: 40,
  rechargeTimeFullFromEmpty: 1.6,   // seconds
  autoRechargeDelayAfterStopFiring: 2.0, // seconds
  manualRechargeKey: "r",
};
```

---

# 5. Breath System

## Required behavior

- Player has **40 units of breath**.
- Weapons consume breath per shot or per burst.
- Breath recharges in **1.6 seconds when fully out**.
- Breath also recharges when the player stops firing for **2 seconds**.
- Breath can be manually recharged by pressing **R**.
- A breathing/recharge sound plays while breath is recharging.

## Recommended implementation

Use a constant recharge rate:

```ts
const MAX_BREATH = 40;
const RECHARGE_RATE_PER_SECOND = MAX_BREATH / 1.6; // 25 breath/sec
```

This means:

- From empty to full takes exactly **1.6 seconds**.
- From partial to full takes proportionally less time once recharging is active.

## Recharge trigger logic

```ts
function shouldRechargeBreath(
  breath: number,
  firing: boolean,
  timeSinceLastShot: number,
  manualRechargeActive: boolean
): boolean {
  if (firing) return false;

  const autoFromEmpty = breath <= 0;
  const autoAfterStopFiring = timeSinceLastShot >= 2.0;

  return autoFromEmpty || autoAfterStopFiring || manualRechargeActive;
}
```

## R key behavior

Recommended:

- Pressing **R** activates manual recharge immediately.
- Manual recharge continues until breath is full or the player fires again.
- Firing cancels manual recharge.

Pseudo-code:

```ts
if (input.rPressed) {
  manualRechargeActive = true;
}

if (firing) {
  manualRechargeActive = false;
}

const recharging = shouldRechargeBreath(...);

if (recharging && breath < MAX_BREATH) {
  breath += RECHARGE_RATE_PER_SECOND * dt;
  audio.playLoop("breath_recharge");
} else {
  audio.stopLoop("breath_recharge", { fadeOut: 0.1 });
}
```

## Breath sound

Use a looping file:

```text
assets/audio/sfx/breath_recharge.ogg
```

Requirements:

- Seamless loop
- Short, 0.5–2 seconds long is fine
- Mono or stereo
- OGG Vorbis preferred
- Fade in/out to avoid clicks

---

# 6. Weapon System

All weapons are projectile-based. No hitscan.

Weapons should be defined in a data file like this:

```json
{
  "trumpet": {
    "name": "Trumpet",
    "breathCostPerShot": 4,
    "shotsPerClick": 1,
    "fireDelaySeconds": 0.3,
    "continuousFire": false,
    "spreadBaseRadians": 0.02,
    "projectileType": "trumpet_note",
    "damage": 9,
    "rangeMeters": 35,
    "audioMode": "random",
    "audioFiles": [
      "assets/audio/sfx/trumpet_fire_01.wav",
      "assets/audio/sfx/trumpet_fire_02.wav",
      "assets/audio/sfx/trumpet_fire_03.wav"
    ]
  }
}
```

---

## 6.1 Trumpet

### Required specs

- Breath cost: **4 per shot**
- Spread: minimal
- Shots per click: **1**
- Delay before able to fire again: **0.3 seconds**
- Audio: randomly play one of **3 audio files** when fired

### Recommended values

```json
{
  "id": "trumpet",
  "name": "Trumpet",
  "breathCostPerShot": 4,
  "shotsPerClick": 1,
  "fireDelaySeconds": 0.3,
  "continuousFire": false,
  "spreadBaseRadians": 0.02,
  "projectileType": "trumpet_note",
  "projectileSpeedMetersPerSecond": 28,
  "damage": 9,
  "rangeMeters": 35,
  "audioMode": "random",
  "audioFiles": [
    "assets/audio/sfx/trumpet_fire_01.wav",
    "assets/audio/sfx/trumpet_fire_02.wav",
    "assets/audio/sfx/trumpet_fire_03.wav"
  ]
}
```

### Behavior notes

- Single fast music-note projectile.
- Low spread, high accuracy.
- Good for weak-point hits.
- Visual: small gold/white note sprite moving forward.
- Audio: choose one of the three trumpet files randomly each shot.

---

## 6.2 Tuba

### Required specs

- Breath cost: **10 per shot**
- Shotgun-type soundwave blast
- Heavy damage close to target
- Wave spreads outward in a circle and dissipates at medium distance
- No damage to far targets
- Delay between shots: **0.8 seconds**
- Shots per click: **1**
- Audio: randomly play one of **2 audio files** when fired

### Recommended implementation

Use an expanding spherical/ring wave rather than normal bullets.

```json
{
  "id": "tuba",
  "name": "Tuba",
  "breathCostPerShot": 10,
  "shotsPerClick": 1,
  "fireDelaySeconds": 0.8,
  "continuousFire": false,
  "projectileType": "tuba_wave",
  "waveStartRadiusMeters": 0.2,
  "waveMaxRadiusMeters": 6.0,
  "waveExpansionTimeSeconds": 0.9,
  "maxEffectiveRangeMeters": 8.0,
  "baseDamageClose": 35,
  "audioMode": "random",
  "audioFiles": [
    "assets/audio/sfx/tuba_blast_01.wav",
    "assets/audio/sfx/tuba_blast_02.wav"
  ]
}
```

### Damage falloff formula

For an enemy at distance `d` from the wave center:

```ts
function tubaDamage(d: number): number {
  const maxRange = 8.0;
  if (d > maxRange) return 0;

  const falloff = Math.max(0, 1 - d / maxRange);
  return 35 * falloff;
}
```

This gives:

- Very high damage very close
- Reduced damage at medium distance
- Zero damage beyond 8 meters

### Visual behavior

- Expanding ring/sphere from the muzzle.
- Should look like a heavy brass soundwave blast.
- Can use an expanding billboard ring texture or shader-based ring.
- Placeholder: white/gold expanding circle with thick edge.

---

## 6.3 Saxophone

### Required specs

- Spread expands while firing
- Continuous fire when click is held down
- Breath cost: **0.5 per shot**
- Fire rate: **16 shots/second**
- Audio: single audio file looped during firing
- Loop restarts when player starts firing again

### Recommended values

```json
{
  "id": "saxophone",
  "name": "Saxophone",
  "breathCostPerShot": 0.5,
  "shotsPerClick": 1,
  "fireDelaySeconds": 0.0625,
  "continuousFire": true,
  "spreadBaseRadians": 0.03,
  "spreadGrowthPerSecond": 0.25,
  "spreadMaxRadians": 0.4,
  "projectileType": "sax_note",
  "projectileSpeedMetersPerSecond": 22,
  "damage": 2,
  "rangeMeters": 20,
  "audioMode": "loop_restart_on_new_burst",
  "audioFiles": [
    "assets/audio/sfx/saxophone_fire_loop.ogg"
  ]
}
```

### Spread behavior

While firing:

```ts
currentSpread = Math.min(
  spreadBase + spreadGrowthPerSecond * continuousFireTime,
  spreadMax
);
```

When the player stops firing for at least **0.5 seconds**, reset spread to base.

This creates:

- Accurate first few notes
- Increasing spray if held too long
- Reset after a short pause

### Audio behavior

Important detail:

- When the player begins a new burst, start the sax loop.
- While holding fire, keep that same loop playing.
- On release, stop with a short fade-out, e.g. 80–120 ms.
- If the player presses again later, restart a fresh loop instance.

Pseudo-code:

```ts
if (firing && !saxLoopPlaying) {
  audio.play("saxophone_fire_loop", { loop: true });
}

if (!firing && saxLoopPlaying) {
  audio.stop("saxophone_fire_loop", { fadeOut: 0.1 });
}
```

---

## 6.4 Electric Guitar

### Required specs

- Breath cost: **13.33 per shot**
- One of 3 audio files plays in sequence when fired
- Fires 3 different soundwave blasts in sequence:
  - Large area of effect, short range
  - Medium area of effect, medium range
  - Small area of effect, long range

### Recommended implementation

One click triggers a 3-stage combo.

```json
{
  "id": "electric_guitar",
  "name": "Electric Guitar",
  "breathCostPerShot": 13.33,
  "shotsPerClick": 1,
  "fireDelaySeconds": 0.7,
  "continuousFire": false,
  "projectileType": "guitar_wave_sequence",
  "audioMode": "sequence",
  "audioFiles": [
    "assets/audio/sfx/guitar_blast_01.wav",
    "assets/audio/sfx/guitar_blast_02.wav",
    "assets/audio/sfx/guitar_blast_03.wav"
  ],
  "blasts": [
    {
      "delaySeconds": 0.0,
      "targetDistanceMeters": 4.0,
      "explosionRadiusMeters": 4.0,
      "damage": 22,
      "audioIndex": 0
    },
    {
      "delaySeconds": 0.15,
      "targetDistanceMeters": 8.0,
      "explosionRadiusMeters": 3.0,
      "damage": 18,
      "audioIndex": 1
    },
    {
      "delaySeconds": 0.30,
      "targetDistanceMeters": 14.0,
      "explosionRadiusMeters": 1.5,
      "damage": 14,
      "audioIndex": 2
    }
  ]
}
```

### Behavior notes

- The three blasts occur along the player’s aim direction.
- Each blast is an expanding ring/sphere at a different distance.
- Audio files play in exact order:
  1. `guitar_blast_01.wav`
  2. `guitar_blast_02.wav`
  3. `guitar_blast_03.wav`
- The first blast is large but short range.
- The second is medium size and medium range.
- The third is small but long range.

This gives the guitar a unique “multi-wave riff” feel compared to the other weapons.

---

# 7. Enemy System

Enemies are demonic instruments in music hell.

All enemy stats should be data-driven so HP, speed, damage, weak point multiplier, and attack behavior can be adjusted without touching core logic.

## 7.1 Enemy Data Interface

```ts
interface WeakPoint {
  offset: [number, number, number]; // local world units relative to enemy center
  radiusMeters: number;
  damageMultiplier: number;
}

interface MeleeAttack {
  enabled: boolean;
  damage: number;
  rangeMeters: number;
  cooldownSeconds: number;
  windupSeconds: number;
}

interface RangedAttack {
  enabled: boolean;
  damage: number;
  projectileSpeedMetersPerSecond: number;
  rangeMeters: number;
  cooldownSeconds: number;
  chargeTelegraphSeconds?: number;
  aoeRadiusMeters?: number;
}

interface EnemyType {
  id: string;
  name: string;
  hp: number;
  speedMetersPerSecond: number;
  radiusMeters: number;
  weakPoint: WeakPoint;
  melee: MeleeAttack;
  ranged: RangedAttack;
}
```

## 7.2 Initial Enemy Types

Use these as the first 8 enemy archetypes.

| ID | Name | HP Class | Speed | Attack Style | Suggested Base Stats |
|---|---:|---:|---:|---|---|
| `hell_tambourine` | Hell Tambourine | Low HP | Slow | Weak melee | HP 20, speed 1.6, melee damage 5 |
| `infernal_maracas` | Infernal Maracas | Low HP | Fast | Weak melee | HP 14, speed 3.6, melee damage 4 |
| `damned_whistle` | Damned Whistle | Low HP | Slow | Weak ranged | HP 24, speed 1.3, ranged damage 5 |
| `abyssal_organ` | Abyssal Organ | Mid HP | Slow, big | Strong ranged | HP 90, speed 0.8, ranged damage 16 |
| `screaming_siren` | Screaming Siren | Mid HP | Fast | Intermittent charged ranged | HP 65, speed 3.1, charged damage 22 |
| `cursed_fiddle` | Cursed Fiddle | Mid HP | Fast | Mid melee + mid ranged | HP 55, speed 3.3, melee 8 / ranged 7 |
| `choir_of_ruin` | Choir of Ruin | High HP | Slow | Strong ranged AoE | HP 160, speed 1.0, AoE damage 25 |
| `wretched_zither` | Wretched Zither | Very low HP | Fast | Weak melee | HP 8, speed 4.6, melee damage 3 |

---

## 7.3 Example Enemy JSON

```json
{
  "hell_tambourine": {
    "name": "Hell Tambourine",
    "hp": 20,
    "speedMetersPerSecond": 1.6,
    "radiusMeters": 0.45,
    "weakPoint": {
      "offset": [0, 0.7, 0],
      "radiusMeters": 0.18,
      "damageMultiplier": 2.0
    },
    "melee": {
      "enabled": true,
      "damage": 5,
      "rangeMeters": 1.3,
      "cooldownSeconds": 1.8,
      "windupSeconds": 0.4
    },
    "ranged": {
      "enabled": false,
      "damage": 0,
      "projectileSpeedMetersPerSecond": 0,
      "rangeMeters": 0,
      "cooldownSeconds": 0
    }
  },

  "infernal_maracas": {
    "name": "Infernal Maracas",
    "hp": 14,
    "speedMetersPerSecond": 3.6,
    "radiusMeters": 0.35,
    "weakPoint": {
      "offset": [0, 0.6, 0],
      "radiusMeters": 0.15,
      "damageMultiplier": 2.0
    },
    "melee": {
      "enabled": true,
      "damage": 4,
      "rangeMeters": 1.2,
      "cooldownSeconds": 1.2,
      "windupSeconds": 0.3
    },
    "ranged": {
      "enabled": false,
      "damage": 0,
      "projectileSpeedMetersPerSecond": 0,
      "rangeMeters": 0,
      "cooldownSeconds": 0
    }
  },

  "damned_whistle": {
    "name": "Damned Whistle",
    "hp": 24,
    "speedMetersPerSecond": 1.3,
    "radiusMeters": 0.4,
    "weakPoint": {
      "offset": [0, 0.65, 0.2],
      "radiusMeters": 0.16,
      "damageMultiplier": 2.0
    },
    "melee": {
      "enabled": false,
      "damage": 0,
      "rangeMeters": 0,
      "cooldownSeconds": 0,
      "windupSeconds": 0
    },
    "ranged": {
      "enabled": true,
      "damage": 5,
      "projectileSpeedMetersPerSecond": 8,
      "rangeMeters": 9,
      "cooldownSeconds": 2.2
    }
  },

  "abyssal_organ": {
    "name": "Abyssal Organ",
    "hp": 90,
    "speedMetersPerSecond": 0.8,
    "radiusMeters": 0.9,
    "weakPoint": {
      "offset": [0, 0.9, 0],
      "radiusMeters": 0.25,
      "damageMultiplier": 2.0
    },
    "melee": {
      "enabled": false,
      "damage": 0,
      "rangeMeters": 0,
      "cooldownSeconds": 0,
      "windupSeconds": 0
    },
    "ranged": {
      "enabled": true,
      "damage": 16,
      "projectileSpeedMetersPerSecond": 7,
      "rangeMeters": 13,
      "cooldownSeconds": 3.2
    }
  },

  "screaming_siren": {
    "name": "Screaming Siren",
    "hp": 65,
    "speedMetersPerSecond": 3.1,
    "radiusMeters": 0.45,
    "weakPoint": {
      "offset": [0, 0.7, 0.2],
      "radiusMeters": 0.2,
      "damageMultiplier": 2.0
    },
    "melee": {
      "enabled": false,
      "damage": 0,
      "rangeMeters": 0,
      "cooldownSeconds": 0,
      "windupSeconds": 0
    },
    "ranged": {
      "enabled": true,
      "damage": 22,
      "projectileSpeedMetersPerSecond": 12,
      "rangeMeters": 14,
      "cooldownSeconds": 4.5,
      "chargeTelegraphSeconds": 1.0
    }
  },

  "cursed_fiddle": {
    "name": "Cursed Fiddle",
    "hp": 55,
    "speedMetersPerSecond": 3.3,
    "radiusMeters": 0.4,
    "weakPoint": {
      "offset": [0, 0.65, 0.1],
      "radiusMeters": 0.18,
      "damageMultiplier": 2.0
    },
    "melee": {
      "enabled": true,
      "damage": 8,
      "rangeMeters": 1.5,
      "cooldownSeconds": 1.5,
      "windupSeconds": 0.35
    },
    "ranged": {
      "enabled": true,
      "damage": 7,
      "projectileSpeedMetersPerSecond": 9,
      "rangeMeters": 7,
      "cooldownSeconds": 2.0
    }
  },

  "choir_of_ruin": {
    "name": "Choir of Ruin",
    "hp": 160,
    "speedMetersPerSecond": 1.0,
    "radiusMeters": 0.7,
    "weakPoint": {
      "offset": [0, 0.9, 0],
      "radiusMeters": 0.3,
      "damageMultiplier": 2.0
    },
    "melee": {
      "enabled": false,
      "damage": 0,
      "rangeMeters": 0,
      "cooldownSeconds": 0,
      "windupSeconds": 0
    },
    "ranged": {
      "enabled": true,
      "damage": 25,
      "projectileSpeedMetersPerSecond": 6,
      "rangeMeters": 12,
      "cooldownSeconds": 5.0,
      "aoeRadiusMeters": 4.5
    }
  },

  "wretched_zither": {
    "name": "Wretched Zither",
    "hp": 8,
    "speedMetersPerSecond": 4.6,
    "radiusMeters": 0.3,
    "weakPoint": {
      "offset": [0, 0.55, 0],
      "radiusMeters": 0.12,
      "damageMultiplier": 2.0
    },
    "melee": {
      "enabled": true,
      "damage": 3,
      "rangeMeters": 1.1,
      "cooldownSeconds": 1.0,
      "windupSeconds": 0.25
    },
    "ranged": {
      "enabled": false,
      "damage": 0,
      "projectileSpeedMetersPerSecond": 0,
      "rangeMeters": 0,
      "cooldownSeconds": 0
    }
  }
}
```

---

# 8. Weak Points and Damage

Each enemy should have:

- A body hitbox
- One or more weak point spheres
- A visible weak point in the sprite art or a code-generated overlay

## Weak point hit detection

For each projectile hit:

1. Check if projectile intersects weak point sphere.
2. If yes, apply damage multiplied by `weakPoint.damageMultiplier`.
3. Spawn stronger gold particle burst.
4. Optionally play a higher-pitched “crit” sound.
5. If no weak point hit but body is hit, apply normal damage.

Example:

```ts
function applyDamage(enemy: Enemy, projectile: Projectile) {
  const weak = enemy.type.weakPoint;
  const worldWeakPoint = addVectors(enemy.position, weak.offset);

  if (distance(projectile.position, worldWeakPoint) < weak.radiusMeters + projectile.radius) {
    return weak.damageMultiplier * projectile.damage;
  }

  return projectile.damage;
}
```

## HP adjustment

To adjust enemy toughness later, only change:

```json
"hp": 20
```

or

```ts
enemyType.hp = 35;
```

No core logic changes should be required.

---

# 9. Gold Particle Hits and Surface “Blood” Decals

## Required behavior

When enemies are hit:

- Yellow/gold particles erupt from the impact point.
- Their “blood” is blasted onto nearby surfaces.
- Weak point hits should produce a stronger burst than body hits.

## Particle system requirements

Use a pooled particle system to avoid garbage collection spikes.

### Suggested limits

```ts
const PARTICLES = {
  maxActive: 2048,
  normalHitCount: [12, 28],      // min/max particles
  weakPointHitCount: [30, 70],   // min/max particles
  lifetimeSeconds: [0.35, 0.9],
  sizeMeters: [0.04, 0.16],
  colorPrimary: "#ffd700",
  colorSecondary: "#ffaa00",
  blending: "additive"
};
```

### Particle behavior

On hit:

- Spawn particles at impact point.
- Velocity should be outward from enemy surface plus random spread.
- Slight gravity or drag is optional.
- Particles fade out and shrink over lifetime.
- Use additive blending for a glowing gold effect.

Placeholder particle texture:

```text
assets/textures/particles/particle_gold.png
```

Specs:

- 32x32 or 64x64 PNG
- Transparent background
- Radial gradient from bright yellow center to transparent edge
- Can be generated in code if needed

---

## Surface decal system

When an enemy is hit, especially on weak point hits and deaths, project a gold splat onto the nearest nearby surface.

### Decal behavior

1. From enemy position or impact point, raycast outward toward nearby walls/floor/ceiling.
2. If a surface is found within 3 meters:
   - Place a decal quad on that surface.
   - Offset slightly along surface normal to avoid z-fighting.
   - Random rotation.
   - Random scale between 0.5 and 1.5 meters.
   - Random opacity between 0.75 and 0.95.
3. Use one of several splat textures for variety.

### Decal limits

```ts
const DECALS = {
  maxPerLevel: 128,
  textureCount: 4,
  minScaleMeters: 0.5,
  maxScaleMeters: 1.5,
  offsetFromSurfaceMeters: 0.01
};
```

### Decal textures needed

If using image files:

```text
assets/textures/decals/gold_splat_01.png
assets/textures/decals/gold_splat_02.png
assets/textures/decals/gold_splat_03.png
assets/textures/decals/gold_splat_04.png
```

Specs:

- 256x256 PNG with alpha
- Irregular splatter shape
- Yellow/gold color
- Transparent background
- Should look like liquid gold or molten music residue

For placeholder, generate these at runtime using Canvas 2D random blobs.

---

# 10. Death Animations by Weapon and Overkill

## Required behavior

Enemy death should vary based on:

1. Which weapon killed them
2. Degree of overkill
3. Enemy type

Dead enemies must leave a corpse sprite in place where they died.

## Overkill tiers

Use three tiers for the tech demo.

```ts
function getOverkillTier(damageDealt: number, enemyMaxHp: number): 0 | 1 | 2 {
  const ratio = damageDealt / enemyMaxHp;

  if (ratio < 1.0) return 0;       // normal kill
  if (ratio < 2.5) return 1;       // heavy overkill
  return 2;                        // extreme overkill
}
```

## Death variant naming

Use this pattern:

```text
{enemyType}_{weapon}_{overkillTier}
```

Examples:

```text
hell_tambourine_trumpet_0
hell_tambourine_trumpet_1
hell_tambourine_trumpet_2

infernal_maracas_tuba_0
damned_whistle_saxophone_1
abyssal_organ_electric_guitar_2
```

## Recommended tech demo approach

For the first build, do not require a unique sprite sheet for every enemy/weapon/overkill combination. Instead use:

- Generic enemy death animation
- Weapon-specific particle/effect preset
- Overkill-tier scaling
- Persistent corpse sprite per enemy type

This satisfies the gameplay requirement while keeping placeholder art manageable.

## Weapon-specific death presets

### Trumpet kill

- Fast vertical gold shard burst
- Enemy sprite flashes white/gold
- Corpse tint slightly brighter
- Overkill tier 1: add small shockwave ring
- Overkill tier 2: larger ring + screen shake

### Tuba kill

- Radial blast outward from enemy center
- Strong knockback if enemy is not fixed in place
- Enemy sprite squashes vertically
- Corpse flattened/scaled down slightly
- Overkill tier 1: bigger radial burst
- Overkill tier 2: massive gold explosion + extra decal splats

### Saxophone kill

- Rapid horizontal shredding particles
- Multiple small note fragments fly outward
- Corpse tinted red/gold, as if torn apart
- Overkill tier 1: more fragments
- Overkill tier 2: enemy splits into multiple corpse pieces or larger shredded sprite variant

### Electric Guitar kill

- Three timed ring bursts at the enemy position
- Charred black/red/gold tint
- Lingering smoke or ember particles
- Overkill tier 1: stronger rings and longer embers
- Overkill tier 2: full explosion, extra decal splats, brief slow-motion optional

## Corpse sprites

Each enemy type needs at least one persistent corpse sprite.

Minimum files if using custom art:

```text
assets/sprites/enemies/hell_tambourine_corpse.png
assets/sprites/enemies/infernal_maracas_corpse.png
assets/sprites/enemies/damned_whistle_corpse.png
assets/sprites/enemies/abyssal_organ_corpse.png
assets/sprites/enemies/screaming_siren_corpse.png
assets/sprites/enemies/cursed_fiddle_corpse.png
assets/sprites/enemies/choir_of_ruin_corpse.png
assets/sprites/enemies/wretched_zither_corpse.png
```

Optional overkill corpse variants:

```text
assets/sprites/enemies/hell_tambourine_corpse_overkill.png
...
```

For placeholder, the code can use the normal enemy sprite with a dark/red/gold tint and reduced scale.

---

# 11. Image Asset Requirements

You said the tech demo can use **100% placeholder images**, either coded or requested from you.

I recommend coding placeholders first. If you want to request simple art, use this brief.

## General image specs

For all sprite/decals:

- Format: PNG with alpha transparency
- Color space: sRGB
- Power-of-two sizes recommended: 64, 128, 256, 512
- No checkerboard background in final files
- Consistent scale across enemy types
- Weak point should be visually obvious

For level textures:

- Format: PNG or WebP
- Tileable/seamless where possible
- Power-of-two recommended: 256x256 or 512x512
- sRGB color space
- No alpha needed for walls/floor/ceiling unless using special effects

---

## 11.1 Enemy Sprite Sheets

For each enemy type, request one sprite sheet with uniform frame size.

### Recommended frame size

```text
128x128 pixels per frame
```

or larger:

```text
256x256 pixels per frame
```

### Minimum rows/states per enemy

| Row | State | Frames | Notes |
|---:|---|---:|---|
| 0 | Idle | 4 frames | Subtle breathing/swaying |
| 1 | Walk/move | 6 frames | Movement cycle |
| 2 | Attack | 3–5 frames | Melee swing or ranged blast |
| 3 | Hit flash | 1 frame | Optional white/gold flash |
| 4 | Death generic | 8 frames | Disassemble/shatter/fade |
| 5 | Corpse | 1 frame | Remains where killed |

### Weak point requirement

Each enemy should have a clearly visible weak point, such as:

- glowing core
- red eye
- golden bell
- cracked tuning peg
- burning string cluster
- open mouth/horn
- pulsing center

The weak point must match the code-defined `weakPoint.offset`.

### Enemy types needing sheets

1. Hell Tambourine
2. Infernal Maracas
3. Damned Whistle
4. Abyssal Organ
5. Screaming Siren
6. Cursed Fiddle
7. Choir of Ruin
8. Wretched Zither

### Optional custom death variants

If you want full custom art instead of procedural weapon/overkill effects, request:

```text
enemy_{type}_death_{weapon}_{tier}.png
```

Examples:

```text
hell_tambourine_death_trumpet_0.png
hell_tambourine_death_trumpet_1.png
hell_tambourine_death_trumpet_2.png

infernal_maracas_death_tuba_0.png
damned_whistle_death_saxophone_1.png
abyssal_organ_death_electric_guitar_2.png
```

That is a lot of art: 8 enemies × 4 weapons × 3 overkill tiers = 96 sheets. For the tech demo, I strongly recommend using generic death + weapon effect presets instead.

---

## 11.2 Weapon View Model Sprites

These are first-person instrument sprites shown at the bottom/right of the screen.

### Recommended size

```text
512x512 pixels per frame
```

or:

```text
1024x512 sprite sheet with multiple frames
```

### Required states per weapon

| State | Frames | Notes |
|---|---:|---|
| Idle | 2–4 frames | Subtle sway or breathing motion |
| Fire/recoil | 3–6 frames | Instrument recoil and blast effect |
| Low breath | 1 frame | Optional desaturated/dimmed look |

### Weapon files

```text
assets/sprites/weapons/trumpet_viewmodel.png
assets/sprites/weapons/tuba_viewmodel.png
assets/sprites/weapons/saxophone_viewmodel.png
assets/sprites/weapons/electric_guitar_viewmodel.png
```

### Visual requirements

- Transparent background
- Instrument should point toward the center of the screen
- Muzzle/blast origin should be consistent
- Right-hand view preferred
- Should not cover too much of the crosshair area
- Placeholder can be simple colored rectangles with labels:
  - TRUMPET
  - TUBA
  - SAX
  - GUITAR

---

## 11.3 Projectile Sprites

Projectiles should be billboard sprites or shader rings.

### Trumpet note

```text
assets/sprites/projectiles/proj_trumpet_note.png
```

Specs:

- 64x64 PNG
- Transparent background
- Small music note shape
- Gold/white color
- Can rotate slowly in code

### Tuba wave ring

```text
assets/sprites/projectiles/proj_tuba_ring.png
```

Specs:

- 256x256 PNG
- Radial symmetric ring
- Thick outer edge
- Transparent center optional
- Gold/white/brass color

### Saxophone note

```text
assets/sprites/projectiles/proj_sax_note.png
```

Specs:

- 32x32 or 64x64 PNG
- Small note shape
- Bright gold/yellow

### Guitar waves

```text
assets/sprites/projectiles/proj_guitar_wave_1.png
assets/sprites/projectiles/proj_guitar_wave_2.png
assets/sprites/projectiles/proj_guitar_wave_3.png
```

Specs:

- 256x256 PNG each
- Radial ring shapes
- Wave 1: thick large ring
- Wave 2: medium ring
- Wave 3: thin small ring
- Electric purple/gold or neon gold colors work well

---

## 11.4 Particle and Decal Textures

### Gold particle

```text
assets/textures/particles/particle_gold.png
```

Specs:

- 32x32 or 64x64 PNG
- Transparent background
- Radial gradient
- Bright yellow center fading to transparent edge

### Gold splat decals

```text
assets/textures/decals/gold_splat_01.png
assets/textures/decals/gold_splat_02.png
assets/textures/decals/gold_splat_03.png
assets/textures/decals/gold_splat_04.png
```

Specs:

- 256x256 PNG with alpha
- Irregular splatter
- Yellow/gold
- Should look like liquid gold, molten brass, or glowing music residue

---

## 11.5 Key and Door Sprites

### Music-note keys

```text
assets/sprites/keys/key_red_note.png
assets/sprites/keys/key_blue_note.png
assets/sprites/keys/key_green_note.png
```

Specs:

- 128x128 PNG with alpha
- Clearly colored music note
- Optional glow
- Can rotate in code

### Door textures

For simple box doors:

```text
assets/textures/doors/door_red_front.png
assets/textures/doors/door_blue_front.png
assets/textures/doors/door_green_front.png
```

Specs:

- 256x256 or 512x512 PNG
- Tileable vertically if door is tall
- Should include a visible music-note lock symbol
- Color must match key color clearly

Optional side textures:

```text
assets/textures/doors/door_red_side.png
assets/textures/doors/door_blue_side.png
assets/textures/doors/door_green_side.png
```

---

# 12. Sound File Requirements

## General audio specs

Preferred formats:

- OGG Vorbis for loops and longer SFX
- WAV or OGG for short one-shots
- Sample rate: 44.1 kHz
- Bit depth if using WAV: 16-bit PCM
- Normalize peaks to around -3 dBFS
- Avoid clipping
- Loops must be seamless

Browser compatibility note:

OGG is widely supported in modern browsers. If you need maximum compatibility, provide both `.ogg` and `.wav` where practical.

---

## 12.1 Soundtrack

```text
assets/audio/soundtrack/music_hell_loop.ogg
```

Requirements:

- Loopable
- Seamless loop point
- Dark music-hell theme
- Can be turned on/off in pause menu
- Stereo recommended
- Length can be 30–90 seconds for tech demo, looped

---

## 12.2 Breath Recharge Sound

```text
assets/audio/sfx/breath_recharge.ogg
```

Requirements:

- Looping
- Seamless
- Should sound like inhaling/recharging breath
- Start when recharge begins
- Stop with short fade-out when full or firing resumes

---

## 12.3 Weapon Sounds

### Trumpet

```text
assets/audio/sfx/trumpet_fire_01.wav
assets/audio/sfx/trumpet_fire_02.wav
assets/audio/sfx/trumpet_fire_03.wav
```

Behavior:

- Randomly choose one of the three per shot.

---

### Tuba

```text
assets/audio/sfx/tuba_blast_01.wav
assets/audio/sfx/tuba_blast_02.wav
```

Behavior:

- Randomly choose one of the two per blast.

---

### Saxophone

```text
assets/audio/sfx/saxophone_fire_loop.ogg
```

Requirements:

- Seamless loop
- Should sound like continuous sax notes or sustained riff
- Must restart when player starts a new firing burst
- Stop with short fade-out on release

---

### Electric Guitar

```text
assets/audio/sfx/guitar_blast_01.wav
assets/audio/sfx/guitar_blast_02.wav
assets/audio/sfx/guitar_blast_03.wav
```

Behavior:

- Play in exact sequence:
  1. `guitar_blast_01`
  2. `guitar_blast_02`
  3. `guitar_blast_03`

These should match the three guitar wave blasts.

---

## 12.4 Enemy and World Sounds

Recommended files:

```text
assets/audio/sfx/enemy_hit_generic.ogg
assets/audio/sfx/enemy_death_generic.ogg
assets/audio/sfx/enemy_melee_windup.ogg
assets/audio/sfx/enemy_projectile_fire.ogg
assets/audio/sfx/key_pickup_red.ogg
assets/audio/sfx/key_pickup_blue.ogg
assets/audio/sfx/key_pickup_green.ogg
assets/audio/sfx/door_open.ogg
assets/audio/sfx/exit_portal.ogg
assets/audio/sfx/player_hurt.ogg
assets/audio/sfx/ui_click.ogg
```

Optional per-enemy sounds:

```text
assets/audio/sfx/enemy_hit_hell_tambourine.ogg
assets/audio/sfx/enemy_death_abyssal_organ.ogg
...
```

For the tech demo, generic enemy hit/death sounds are acceptable.

---

# 13. Level Texture Replacement Instructions

You asked what you would need to replace level textures.

## Required texture types

Each level needs:

- Wall texture(s)
- Floor texture
- Ceiling texture
- Optional door/key/exit portal textures

## Recommended replacement files

```text
assets/textures/walls/hell_wall_01.png
assets/textures/floors/music_floor_01.png
assets/textures/ceilings/void_ceiling_01.png
```

## Texture specs

### Walls

- PNG or WebP
- 256x256 or 512x512 recommended
- sRGB
- Tileable vertically if possible
- Should read as hellish music-themed wall:
  - cracked brass
  - obsidian with glowing staff lines
  - melted piano keys
  - demonic organ pipes
  - burning sheet metal

### Floor

- PNG or WebP
- 256x256 or 512x512 recommended
- Seamless horizontal/vertical tiling preferred
- Should read as floor:
  - cracked marble with gold veins
  - dark wood stage
  - obsidian tiles
  - melted brass plates

### Ceiling

- PNG or WebP
- 256x256 or 512x512 recommended
- Seamless tiling preferred
- Should read as ceiling:
  - void with faint stars/notes
  - dark clouds
  - inverted organ pipes
  - glowing hellfire

---

## Texture mapping file

Use a simple texture map so levels reference IDs instead of hard-coded paths.

```json
{
  "wall_hell": "assets/textures/walls/hell_wall_01.png",
  "floor_music": "assets/textures/floors/music_floor_01.png",
  "ceil_void": "assets/textures/ceilings/void_ceiling_01.png"
}
```

Then a level can use:

```json
{
  "textures": {
    "wall": "wall_hell",
    "floor": "floor_music",
    "ceiling": "ceil_void"
  }
}
```

## How to replace textures later

1. Create or obtain a new tileable PNG/WebP texture.
2. Put it in the correct folder:
   - `assets/textures/walls/`
   - `assets/textures/floors/`
   - `assets/textures/ceilings/`
3. Update `textures.json` if using a new ID, or replace the existing file with the same name.
4. Assign the texture ID in the level JSON or Tiled map properties.
5. Reload the level.

For placeholder textures, generate them at runtime:

- Walls: dark red/black checkerboard with gold staff lines
- Floor: black/dark gray tiles with faint gold grid
- Ceiling: near-black with random glowing note dots

---

# 14. Level Format and Mapping Instructions

For the tech demo, use a simple JSON level format. This is easier than requiring Tiled immediately, but you can still use Tiled later if desired.

## Coordinate system

Use a grid where each cell is 1 meter wide.

- `x` increases to the right
- `y` increases downward in map data
- The loader converts this into world coordinates:
  - world X = level x
  - world Z = level y
  - world Y = vertical height, usually fixed for player/enemies

Cell center:

```ts
worldX = cellX + 0.5;
worldZ = cellY + 0.5;
```

Player yaw:

- `0` degrees = facing negative Z / “up” on the map
- `90` degrees = facing positive X / right on the map

---

## Level JSON Schema

```json
{
  "id": "level_01",
  "name": "Tuning Room",
  "width": 10,
  "height": 5,
  "start": {
    "x": 1,
    "y": 1,
    "yawDegrees": 90
  },
  "textures": {
    "wall": "wall_hell",
    "floor": "floor_music",
    "ceiling": "ceil_void"
  },
  "walls": [
    [1,1,1,1,1,1,1,1,1,1],
    [1,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,1],
    [1,1,1,1,1,1,1,1,1,1]
  ],
  "doors": [
    {
      "id": "door_red_1",
      "x": 8,
      "y": 1,
      "keyColor": "red"
    }
  ],
  "keys": [
    {
      "color": "red",
      "x": 5,
      "y": 1
    }
  ],
  "enemies": [
    {
      "type": "hell_tambourine",
      "x": 3,
      "y": 2
    },
    {
      "type": "infernal_maracas",
      "x": 6,
      "y": 2
    }
  ],
  "exit": {
    "x": 5,
    "y": 3
  }
}
```

## Field meanings

| Field | Meaning |
|---|---|
| `id` | Unique level ID used by save system and overworld map |
| `name` | Display name |
| `width` / `height` | Grid size in cells |
| `start.x`, `start.y` | Player spawn cell |
| `start.yawDegrees` | Initial facing direction |
| `textures.wall` | Wall texture ID from `textures.json` |
| `textures.floor` | Floor texture ID |
| `textures.ceiling` | Ceiling texture ID |
| `walls` | 2D array. `0` = empty floor, `1+` = static wall with texture ID |
| `doors` | Dynamic door cells that block movement until opened by matching key |
| `keys` | Pickups that unlock doors of the same color |
| `enemies` | Enemy spawn points and types |
| `exit` | Exit portal cell that loads next level |

---

## Simple ASCII Mapping Convention

For hand-authoring levels, use this legend:

```text
# = wall
. = empty floor
S = player start
K = red key
B = blue key
G = green key
D = red door
E = exit portal
T = Hell Tambourine
M = Infernal Maracas
W = Damned Whistle
O = Abyssal Organ
I = Screaming Siren
F = Cursed Fiddle
C = Choir of Ruin
Z = Wretched Zither
```

Example map:

```text
##########
#S...K..D#
#........#
#....E...#
##########
```

This maps to the JSON example above.

---

## Mapping Rules for Tech Demo Levels

For each level:

1. Choose a grid size, e.g. 16x16 or 24x24.
2. Place player start near one corner.
3. Build walls using `#` or wall IDs in JSON.
4. Place at least one colored key.
5. Place at least one matching door blocking the path to exit.
6. Spawn a mix of enemy types:
   - 2–3 low HP enemies
   - 1 mid HP ranged enemy
   - 1 fast melee enemy
7. Place exit portal behind the door or after a second key/door if desired.
8. Ensure all spawn points are on empty floor cells.
9. Ensure doors occupy cells that would otherwise be open corridors.

---

## Optional Tiled Map Editor Setup

If you want a visual editor, use Tiled:

1. Create an orthogonal map.
2. Set tile size to 32 pixels.
3. Add layers:
   - `walls` terrain layer
   - `objects` object layer
4. Use custom properties on tiles/objects:
   - `wallTextureId`
   - `keyColor`
   - `enemyType`
5. Export as JSON.
6. Write a small converter from Tiled JSON to the simple level JSON format above, or make the loader read both formats.

For the tech demo, I recommend starting with the custom JSON format because it is simpler and fully controllable.

---

# 15. Overworld Descent Map

The game should have an overworld map that tracks the player’s descent into music hell.

## Data file

```json
{
  "nodes": [
    {
      "id": "level_01",
      "name": "Tuning Room",
      "x": 0,
      "y": 0
    },
    {
      "id": "level_02",
      "name": "Brass Catacombs",
      "x": 0,
      "y": -1
    }
  ],
  "edges": [
    ["level_01", "level_02"]
  ]
}
```

For the full game later:

- 10 nodes total
- Initial tech demo uses first two
- Nodes can be arranged vertically to imply descent

## Overworld behavior

- Show all level nodes.
- Locked levels appear grayed out.
- Current/available level appears highlighted.
- Completed levels appear marked as cleared.
- After exiting a level:
  - Mark it completed.
  - Unlock the next node.
  - Return to overworld map or auto-load next level, depending on preference.

For Doom-like feel, I recommend returning to the overworld after each exit so the player sees their descent progress.

---

# 16. Local Save System

Use `localStorage` for the tech demo.

## Save key

```ts
const SAVE_KEY = "musicHell_save_v1";
```

## Save schema

```json
{
  "version": 1,
  "settings": {
    "soundtrackEnabled": true,
    "sfxVolume": 0.8,
    "mouseSensitivity": 1.0
  },
  "progress": {
    "currentLevelId": "level_02",
    "completedLevels": ["level_01"],
    "unlockedLevels": ["level_01", "level_02"]
  },
  "levelState": {
    "breath": 32,
    "keysCollected": ["red"],
    "doorsOpened": ["door_red_1"],
    "killedEnemyIds": [
      "enemy_hell_tambourine_0",
      "enemy_infernal_maracas_1"
    ],
    "playerPosition": {
      "x": 4.5,
      "y": 2.5,
      "yawDegrees": 90
    }
  }
}
```

## When to save

Save immediately when:

- Settings change
- Key is collected
- Door opens
- Enemy dies
- Player exits level
- Pause menu resumes after a checkpoint event

Optional autosave:

- Every 5 seconds while in a level
- Store current breath, position, keys, doors opened, and killed enemies

This allows the player to refresh the browser and continue.

---

# 17. Pause Menu and Settings

## Open pause menu with

- `ESC`
- or `P`
- Also open automatically if pointer lock is lost

## Required options

### Soundtrack

- On/Off toggle
- Should immediately start/stop the soundtrack loop
- Save setting locally

### SFX Volume

- Slider from 0 to 100%
- Affects all non-soundtrack audio
- Save setting locally

### Mouse Sensitivity

- Slider from 0.25x to 3.0x
- Default 1.0x
- Applied live to mouse look
- Save setting locally

## Additional useful options

Optional but recommended:

- Breath sound on/off
- Particle intensity low/medium/high
- Screen shake toggle
- Restart level button
- Return to overworld map button

---

# 18. Input and Movement Details

## Keyboard

| Key | Action |
|---|---|
| W | Move forward |
| A | Strafe left |
| S | Move backward |
| D | Strafe right |
| R | Manual breath recharge |
| Left mouse button | Fire current weapon |
| 1 | Select Trumpet |
| 2 | Select Tuba |
| 3 | Select Saxophone |
| 4 | Select Electric Guitar |
| Mouse wheel | Cycle weapons |
| ESC / P | Pause menu |

## Mouse look

Use Pointer Lock API.

```ts
const sensitivity = settings.mouseSensitivity; // default 1.0

yaw -= event.movementX * 0.002 * sensitivity;
pitch -= event.movementY * 0.002 * sensitivity;

pitch = clamp(pitch, -85 * DEG_TO_RAD, 85 * DEG_TO_RAD);
```

## Movement feel

Recommended player movement:

- Base speed: 4 m/s
- Acceleration optional for smoother feel
- Friction/damping to prevent sliding too far
- Collision radius: 0.35 m
- Eye height: 1.6 m
- No jumping in tech demo unless you want it added later

---

# 19. Projectile System Details

All player weapons are projectile-based.

## Projectile object structure

```ts
interface Projectile {
  id: number;
  type: string;
  position: Vector3;
  velocity: Vector3;
  radiusMeters: number;
  damage: number;
  lifetimeSeconds: number;
  ageSeconds: number;
  owner: "player" | "enemy";
  hitEnemies: Set<number>; // for waves/AoE to avoid multiple hits
}
```

## Update loop

Each frame:

1. Move projectile by `velocity * dt`.
2. Check wall collision.
3. Check enemy collision if player-owned.
4. Check player collision if enemy-owned.
5. Remove expired projectiles.
6. For wave/AoE types, update radius and apply damage once per target.

## Spatial hashing

Use a simple spatial hash grid for performance:

```ts
const CELL_SIZE_METERS = 1.0;
```

This lets you query only nearby enemies/projectiles instead of checking every object against every other object.

---

# 20. Enemy AI States

Each enemy should have these states:

```text
SPAWNING
IDLE
CHASE
ATTACK_WINDUP
ATTACK_RECOVER
HIT_STUN
DYING
CORPSE
```

## Basic behavior

### Melee enemies

1. If player is within detection range, chase.
2. If within melee range and cooldown ready:
   - Enter windup state.
   - Play attack animation/sound.
3. After windup:
   - Deal damage if player is still in range/arc.
4. Enter recover state.

### Ranged enemies

1. Maintain preferred distance if possible.
2. If line of sight exists and cooldown ready:
   - Fire projectile or AoE blast.
3. Some ranged enemies can strafe while shooting later.

### Charged ranged enemy

For `screaming_siren`:

1. Chase player.
2. Every few seconds, enter charge state for 1 second.
3. Show visual/audio telegraph:
   - sprite glows
   - scale pulses
   - charging sound plays
4. Fire high-damage projectile or beam-like blast.

### AoE enemy

For `choir_of_ruin`:

1. Slowly move toward player.
2. Periodically create an expanding shockwave centered on itself or aimed at player.
3. Damage player if within radius and not blocked by wall.

---

# 21. Placeholder Asset Generation Plan

Since the tech demo can use 100% placeholder images, I recommend generating them in code first.

## What to generate procedurally

### Enemy placeholders

For each enemy type:

- Draw a colored rounded rectangle or circle.
- Add label text:
  - `TAMBOURINE`
  - `MARACAS`
  - `WHISTLE`
  - `ORGAN`
  - `SIREN`
  - `FIDDLE`
  - `CHOIR`
  - `ZITHER`
- Add a gold weak point circle at the configured offset.
- Death placeholder:
  - flash white/gold
  - shrink or squash sprite
  - spawn particles
- Corpse placeholder:
  - darkened/red-tinted version of enemy sprite

### Weapon placeholders

Draw simple first-person shapes:

- Trumpet: long gold rectangle with bell circle
- Tuba: large brass loop shape
- Saxophone: curved gold tube
- Electric Guitar: angular purple/gold body with strings

Each can have a recoil animation by moving the sprite slightly backward/downward for 100–200 ms.

### Projectile placeholders

- Trumpet: small white/gold circle or note glyph
- Tuba: expanding ring
- Saxophone: tiny gold dots/notes
- Guitar: three expanding rings with different sizes/colors

### Particle placeholder

Use a radial gradient square:

```ts
const canvas = document.createElement("canvas");
canvas.width = 64;
canvas.height = 64;

const ctx = canvas.getContext("2d")!;
const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
gradient.addColorStop(0, "rgba(255, 230, 120, 1)");
gradient.addColorStop(0.4, "rgba(255, 180, 0, 0.8)");
gradient.addColorStop(1, "rgba(255, 120, 0, 0)");

ctx.fillStyle = gradient;
ctx.fillRect(0, 0, 64, 64);
```

### Decal placeholder

Generate random splats:

- Draw 8–20 overlapping circles/blobs.
- Use gold/yellow colors with alpha.
- Randomize positions within a circular area.
- Save as CanvasTexture.

### Level texture placeholders

Walls:

- Dark red/black vertical stripes
- Gold horizontal staff lines
- Optional random note symbols

Floor:

- Dark gray tiles
- Faint gold grid lines

Ceiling:

- Near black
- Random small glowing dots or notes

This allows a fully playable tech demo with zero external image files.

---

# 22. If You Want to Request Placeholder Art

If you want me to request simple placeholder images from an artist or AI, use this brief:

> Create browser game placeholder sprites for a Doom-style first-person shooter called Music Hell. The theme is descent into music hell. Enemies are demonic instruments. Player weapons are regular instruments that fire music notes and soundwaves.
>
> Need transparent PNG sprite sheets with uniform frame size 128x128 or 256x256.
>
> Enemy types:
> 1. Hell Tambourine — low HP, slow, weak melee  
> 2. Infernal Maracas — low HP, fast, weak melee  
> 3. Damned Whistle — low HP, slow, weak ranged  
> 4. Abyssal Organ — mid HP, slow, big, strong ranged  
> 5. Screaming Siren — mid HP, fast, intermittent charged ranged  
> 6. Cursed Fiddle — mid HP, fast, mid melee and mid ranged  
> 7. Choir of Ruin — high HP, slow, strong ranged AoE  
> 8. Wretched Zither — very low HP, fast, weak melee  
>
> Each enemy needs idle, walk, attack, hit flash, death, and corpse frames. Include a clearly visible glowing weak point.
>
> Player weapon view models needed: trumpet, tuba, saxophone, electric guitar. Transparent PNG, 512x512 or larger, first-person right-hand style, with idle and fire/recoil frames.
>
> Projectile sprites: music note for trumpet, expanding brass ring for tuba, small gold notes for saxophone, three electric guitar soundwave rings of different sizes.
>
> Particle texture: 32x32 or 64x64 radial gold particle with transparent background.
>
> Decal textures: four 256x256 gold splatter decals with transparent backgrounds.
>
> Level textures: tileable wall, floor, and ceiling PNGs, 256x256 or 512x512, dark hellish music theme with brass, obsidian, sheet metal, glowing notes, and gold accents.

---

# 23. Build Milestones

## Milestone 1 — Project Setup

Deliverables:

- Vite + TypeScript project
- Three.js scene renders a simple room
- Pointer lock mouse look works
- WASD movement works inside walls
- Basic dev server and build commands work

Acceptance criteria:

- Player can move around a small box level.
- Mouse look changes camera yaw/pitch.
- Walls block movement.
- No crashes on resize or pointer lock loss.

---

## Milestone 2 — Level Loader and Tech Demo Levels

Deliverables:

- JSON level loader
- Two placeholder levels
- Wall/floor/ceiling rendering
- Door/key/exit system
- Basic collision for doors

Acceptance criteria:

- Level loads from JSON.
- Player spawns at start cell.
- Red key can be picked up.
- Matching red door opens when player has key and is near it.
- Exit portal triggers next level or overworld transition.
- Walls, floor, ceiling use placeholder textures.

---

## Milestone 3 — Enemy System

Deliverables:

- Enemy data file with all 8 types
- Enemy spawning from level JSON
- Basic chase/attack AI
- HP and weak point system
- Hit particles
- Death/corpse behavior
- Gold surface decals

Acceptance criteria:

- All 8 enemy types can spawn.
- Enemies move toward player when detected.
- Melee enemies attack in range.
- Ranged enemies fire projectiles or blasts.
- Weak point hits deal multiplied damage.
- HP values can be changed in JSON without code changes.
- Hit particles are yellow/gold.
- Gold decals appear on nearby surfaces.
- Dead enemy leaves a corpse sprite in place.

---

## Milestone 4 — Weapon and Breath System

Deliverables:

- Breath system with R key, auto recharge, and breath sound
- Trumpet weapon
- Tuba wave blast
- Saxophone continuous fire with expanding spread
- Electric Guitar 3-blast sequence
- Projectile collision
- Weapon switching
- HUD breath bar

Acceptance criteria:

- Trumpet fires once per click with 0.3s delay and random one of three sounds.
- Tuba costs 10 breath, has 0.8s delay, close-range heavy damage, no far damage, random one of two sounds.
- Saxophone holds to fire at 16 shots/sec, costs 0.5 breath/shot, spread expands while firing, loop restarts on new burst.
- Electric Guitar costs 13.33 breath and fires three sequential blasts with three audio files in order.
- Breath recharges according to the defined rules.
- Breath recharge sound plays during recharge.

---

## Milestone 5 — UI, Save, Overworld, Pause Menu

Deliverables:

- HUD for breath, weapon, keys
- Pause menu
- Settings save locally
- Progress save locally
- Overworld descent map with two nodes
- Level transition flow

Acceptance criteria:

- Soundtrack can be toggled on/off.
- Mouse sensitivity slider works live.
- SFX volume slider works.
- Save persists after browser refresh.
- Completed level appears completed on overworld.
- Next level unlocks after exit.
- Player can return to overworld and re-enter available levels.

---

## Milestone 6 — Polish and Testing

Deliverables:

- Performance pass
- Audio fade-in/out fixes
- Particle/decal caps
- Weapon feel tuning
- Enemy balance tuning
- Bug fixes
- Final tech demo build

Acceptance criteria:

- Game runs at acceptable frame rate with all placeholder effects active.
- No audio clipping or overlapping loops that break gameplay.
- Particles and decals do not crash performance.
- All weapons feel distinct.
- All enemy types behave according to their archetypes.
- Save/load is stable.
- Pause menu does not desync game state.

---

# 24. Testing Checklist

## Breath system tests

- [ ] Full breath starts at 40.
- [ ] Trumpet consumes 4 per shot.
- [ ] Tuba consumes 10 per shot.
- [ ] Saxophone consumes 0.5 per shot.
- [ ] Electric Guitar consumes 13.33 per combo.
- [ ] When empty and not firing, breath reaches full in approximately 1.6 seconds.
- [ ] After stopping firing for 2 seconds, partial breath recharges.
- [ ] Pressing R starts manual recharge.
- [ ] Firing cancels manual recharge.
- [ ] Breath recharge sound plays only while recharging.

## Weapon tests

### Trumpet

- [ ] One shot per click.
- [ ] 0.3 second delay between shots.
- [ ] Minimal spread.
- [ ] Random one of three audio files plays.

### Tuba

- [ ] One blast per click.
- [ ] 0.8 second delay.
- [ ] Close targets take heavy damage.
- [ ] Medium-distance targets take reduced damage.
- [ ] Far targets beyond max range take zero damage.
- [ ] Random one of two audio files plays.

### Saxophone

- [ ] Holding mouse fires continuously.
- [ ] Fire rate is approximately 16 shots/second.
- [ ] Spread increases while firing.
- [ ] Spread resets after stopping for about 0.5 seconds.
- [ ] Loop starts on new burst.
- [ ] Loop stops with short fade-out on release.

### Electric Guitar

- [ ] One click triggers full combo.
- [ ] Three blasts occur in sequence.
- [ ] First blast is large/short range.
- [ ] Second blast is medium/medium range.
- [ ] Third blast is small/long range.
- [ ] Audio files play in exact order 1, 2, 3.

## Enemy tests

- [ ] All 8 enemy types spawn correctly.
- [ ] HP can be adjusted in data file.
- [ ] Weak point hits deal multiplied damage.
- [ ] Body hits deal normal damage.
- [ ] Melee enemies attack when close.
- [ ] Ranged enemies fire projectiles/blasts.
- [ ] Charged enemy telegraphs before high-damage attack.
- [ ] AoE enemy damages player within radius.
- [ ] Death animation varies by weapon used.
- [ ] Overkill tier changes death intensity.
- [ ] Corpse remains where enemy died.
- [ ] Gold particles spawn on hit.
- [ ] Gold decals appear on nearby surfaces.

## Level tests

- [ ] Player starts at correct position/facing.
- [ ] Keys are collectible.
- [ ] Doors open with matching key.
- [ ] Exit portal loads next level or overworld.
- [ ] Overworld shows descent progress.
- [ ] Save persists after refresh.
- [ ] Settings persist after refresh.

## UI tests

- [ ] Pause menu opens with ESC/P.
- [ ] Pointer lock loss opens pause menu safely.
- [ ] Soundtrack toggle works immediately.
- [ ] Mouse sensitivity slider affects mouse look.
- [ ] SFX volume slider affects sound effects.
- [ ] HUD shows breath level clearly.
- [ ] HUD shows current weapon and collected keys.

---

# 25. Recommended First Playable Build Order

For fastest playable result, build in this order:

1. Three.js scene + WASD/mouse look
2. Simple box level with walls/floor/ceiling
3. Player breath bar and R key recharge
4. Trumpet projectile weapon only
5. One enemy type with HP, weak point, particles, corpse
6. Gold decal system
7. Key/door/exit flow
8. Add remaining weapons
9. Add remaining enemies
10. Add pause menu/settings/save
11. Add overworld map
12. Polish placeholder art and audio

This gets you a vertical slice quickly before expanding to the full 10-level structure.

---

# 26. Final Recommended Tech Demo Definition of Done

The tech demo is complete when:

- The player can enter Level 1 from the overworld map.
- WASD movement and mouse look work smoothly.
- All four weapons are usable with correct breath costs, fire rates, spread behavior, and audio behavior.
- Breath recharges according to the specified rules and plays a recharge sound.
- At least one colored music-note key opens a matching door.
- The exit portal advances the player to Level 2 or back to the overworld map.
- All eight enemy types can appear in levels.
- Enemy HP and weak point multipliers are adjustable in data files.
- Enemies spawn yellow/gold particles when hit.
- Gold “blood” decals stick to nearby surfaces.
- Death effects vary by weapon used and overkill degree.
- Dead enemies leave persistent corpse sprites where they die.
- The pause menu can toggle soundtrack, adjust SFX volume, and change mouse sensitivity.
- Settings and progress save locally on the user’s device.
- The game uses 100% placeholder art or simple requested placeholder images without blocking gameplay.
/**
 * Phase 6: polish guard rails.
 *
 * These are not behaviour checks so much as tripwires around the numbers and
 * paths that tuning tends to break: effect caps, the breath economy, kill times,
 * and whether every audio file the game asks for is one you were told to record.
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import weaponsJson from '../app/src/data/weapons.json';
import enemiesJson from '../app/src/data/enemies.json';
import type { EnemyType } from '../app/src/systems/EnemySystem';
import {
  tubaDamage,
  WEAPON_ORDER,
  type ProjectileWeapon,
  type SequenceWeapon,
  type WaveWeapon,
  type WeaponDef,
} from '../app/src/systems/WeaponSystem';
import { BREATH, DECALS, PARTICLES } from '../app/src/data/constants';
import { check, section } from './harness';

const weapons = weaponsJson as unknown as Record<string, WeaponDef>;
const enemies = enemiesJson as unknown as Record<string, EnemyType>;

/** `npm run checks` runs with the package directory as cwd. */
const APP = join(process.cwd(), 'app');

/** Damage per second at the weapon's own fire rate, ignoring breath. */
function damagePerSecond(def: WeaponDef): number {
  switch (def.projectileType) {
    case 'trumpet_note':
    case 'sax_note':
      return (def.damage * def.shotsPerClick) / def.fireDelaySeconds;
    case 'tuba_wave':
      return tubaDamage(def, 0) / def.fireDelaySeconds;
    case 'guitar_wave_sequence':
      return def.blasts.reduce((total, blast) => total + blast.damage, 0) / def.fireDelaySeconds;
  }
}

/** Seconds of continuous fire a full tank buys. */
function secondsOfFire(def: WeaponDef): number {
  return BREATH.max / (def.breathCostPerShot / def.fireDelaySeconds);
}

section('phase 6 — effect caps (plans.md §9)');

check('particle and decal caps match the spec', () => {
  assert.equal(PARTICLES.maxActive, 2048);
  assert.equal(DECALS.maxPerLevel, 128);
  assert.equal(DECALS.textureCount, 4);
  assert.equal(DECALS.maxDistanceMeters, 3.0);
});

check('a weak-point burst always outshines a body hit', () => {
  assert.ok(
    PARTICLES.weakPointHitCount[0]! > PARTICLES.normalHitCount[1]!,
    'the two burst sizes overlap, so a crit can look weaker than a graze',
  );
});

check('no single burst can fill the pool on its own', () => {
  assert.ok(PARTICLES.weakPointHitCount[1]! * 4 < PARTICLES.maxActive, 'a few kills would exhaust the pool');
});

section('phase 6 — weapon economy (plans.md §6)');

check('every weapon costs breath and a full tank affords several uses', () => {
  for (const id of WEAPON_ORDER) {
    const def = weapons[id]!;
    assert.ok(def.breathCostPerShot > 0, `${id} fires for free`);

    const uses = BREATH.max / def.breathCostPerShot;
    assert.ok(uses >= 3, `${id} only gets ${uses.toFixed(1)} uses from a full tank`);
  }
});

check('sustained fire drains a tank in a usable window', () => {
  for (const id of WEAPON_ORDER) {
    const seconds = secondsOfFire(weapons[id]!);
    assert.ok(seconds >= 1.5, `${id} empties in ${seconds.toFixed(1)} s — too little to fight with`);
    assert.ok(seconds <= 12, `${id} runs for ${seconds.toFixed(1)} s, so breath stops mattering`);
  }
});

check('no weapon dominates: damage rates stay within a factor of four', () => {
  const rates = WEAPON_ORDER.map((id) => ({ id, dps: damagePerSecond(weapons[id]!) }));
  const best = rates.reduce((a, b) => (a.dps > b.dps ? a : b));
  const worst = rates.reduce((a, b) => (a.dps < b.dps ? a : b));

  assert.ok(
    best.dps / worst.dps <= 4,
    `${best.id} does ${best.dps.toFixed(0)} dps against ${worst.id}'s ${worst.dps.toFixed(0)}`,
  );
});

check('the two burst weapons trade rate for reach', () => {
  // The tuba hits hardest but only up close; the guitar reaches furthest.
  const tuba = weapons.tuba as WaveWeapon;
  const guitar = weapons.electric_guitar as SequenceWeapon;
  const furthestGuitar = Math.max(...guitar.blasts.map((blast) => blast.targetDistanceMeters));

  assert.ok(tubaDamage(tuba, 0) > guitar.blasts[0]!.damage, 'the tuba should win at point blank');
  assert.ok(furthestGuitar > tuba.maxEffectiveRangeMeters, 'the guitar should out-range the tuba');
});

section('phase 6 — kill times (plans.md §7)');

check('nothing takes more than two tanks to kill, whatever you brought', () => {
  // Breath refills in 1.6 s, so a two-tank fight is a fight, not a wall. More
  // than that and a weapon is simply the wrong tool for the enemy.
  for (const [enemyId, type] of Object.entries(enemies)) {
    for (const weaponId of WEAPON_ORDER) {
      const def = weapons[weaponId]!;
      const perTank = damagePerSecond(def) * secondsOfFire(def);
      const tanks = type.hp / perTank;
      assert.ok(tanks <= 2, `${weaponId} needs ${tanks.toFixed(1)} tanks for ${enemyId}`);
    }
  }
});

check('accurate play with the trumpet one-tanks even the toughest enemy', () => {
  // Weak-point hits double, so aim is what closes the gap the raw rate leaves.
  // Blast weapons deal flat area damage and never crit, which is their tradeoff.
  const trumpet = weapons.trumpet as ProjectileWeapon;
  const perTank = (BREATH.max / trumpet.breathCostPerShot) * trumpet.damage;
  const toughest = Math.max(...Object.values(enemies).map((type) => type.hp));

  assert.ok(perTank < toughest, 'body shots alone should not be enough');
  assert.ok(perTank * 2 >= toughest, `even all-crit play falls short: ${perTank * 2} vs ${toughest}`);
});

check('the weakest enemies die fast and the toughest do not melt', () => {
  const trumpet = weapons.trumpet as ProjectileWeapon;
  const zitherHits = Math.ceil(enemies.wretched_zither!.hp / trumpet.damage);
  const choirHits = Math.ceil(enemies.choir_of_ruin!.hp / trumpet.damage);

  assert.equal(zitherHits, 1, 'the fast chaff should be a one-tap');
  assert.ok(choirHits >= 10, `the boss-weight enemy folds in ${choirHits} trumpet hits`);
});

section('phase 6 — audio manifest coverage (plans.md §12)');

/** Every audio path the code asks for, gathered from source rather than a list. */
function referencedAudioPaths(): Set<string> {
  const found = new Set<string>();
  const pattern = /['"`](audio\/[^'"`]+)['"`]/g;

  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) {
        walk(path);
        continue;
      }
      if (!/\.(ts|json)$/.test(entry)) continue;

      const source = readFileSync(path, 'utf8');
      for (const [, match] of source.matchAll(pattern)) {
        // Skip interpolated paths; they're asserted explicitly below.
        if (match!.includes('${')) continue;
        found.add(match!);
      }
    }
  };

  walk(join(APP, 'src'));
  return found;
}

/** The checklist the files are being recorded against. */
function manifestPaths(): Set<string> {
  const manifest = readFileSync(join(APP, 'assets/audio/MANIFEST.md'), 'utf8');
  const paths = new Set<string>();

  for (const [, match] of manifest.matchAll(/`((?:sfx|soundtrack)\/[^`]+)`/g)) {
    paths.add(`audio/${match!}`);
  }

  return paths;
}

check('the manifest lists all 22 files the spec calls for', () => {
  assert.equal(manifestPaths().size, 22);
});

check('every sound the game requests is one the manifest asks you to record', () => {
  const manifest = manifestPaths();

  for (const path of referencedAudioPaths()) {
    assert.ok(manifest.has(path), `code plays "${path}", which is not in MANIFEST.md`);
  }
});

check('the key pickup sounds cover every key colour in use', () => {
  const manifest = manifestPaths();
  // Built by interpolation in DoorKeySystem, so the scan above can't see them.
  for (const color of ['red', 'blue', 'green']) {
    assert.ok(manifest.has(`audio/sfx/key_pickup_${color}.ogg`), `no pickup sound for the ${color} key`);
  }
});

check('every weapon audio file is in the manifest, in the right family', () => {
  const manifest = manifestPaths();

  for (const id of WEAPON_ORDER) {
    const def = weapons[id]!;
    for (const file of def.audioFiles) {
      assert.ok(manifest.has(file), `${id} plays "${file}", which is not in MANIFEST.md`);
    }
  }
});

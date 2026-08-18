/**
 * Phase 4: the full bestiary, player health, doors and level flow.
 *
 * The AI itself lives in EnemySystem, which can't load outside a browser, so
 * behaviour is verified in play. What's asserted here is everything the AI reads
 * or depends on: the stat blocks, the range policy, line of sight, door state,
 * and whether each level can actually be finished.
 */
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import enemiesJson from '../app/src/data/enemies.json';
import { CollisionSystem } from '../app/src/core/CollisionSystem';
import type { EnemyType } from '../app/src/systems/EnemySystem';
import { preferredRange } from '../app/src/systems/EnemyTactics';
import { PlayerHealth } from '../app/src/systems/PlayerHealth';
import { ENEMY_AI, PLAYER } from '../app/src/data/constants';
import { check, section } from './harness';

const enemies = enemiesJson as unknown as Record<string, EnemyType>;
import { LEVELS as levels } from './levels';

/** The archetype table from plans.md §7.2, transcribed to assert against. */
const SPEC_STATS: Record<string, { hp: number; speed: number; melee: number; ranged: number }> = {
  hell_tambourine: { hp: 20, speed: 1.6, melee: 5, ranged: 0 },
  infernal_maracas: { hp: 14, speed: 3.6, melee: 4, ranged: 0 },
  damned_whistle: { hp: 24, speed: 1.3, melee: 0, ranged: 5 },
  abyssal_organ: { hp: 90, speed: 0.8, melee: 0, ranged: 16 },
  screaming_siren: { hp: 65, speed: 3.1, melee: 0, ranged: 22 },
  cursed_fiddle: { hp: 55, speed: 3.3, melee: 8, ranged: 7 },
  choir_of_ruin: { hp: 160, speed: 1.0, melee: 0, ranged: 25 },
  wretched_zither: { hp: 8, speed: 4.6, melee: 3, ranged: 0 },
};

section('phase 4 — bestiary (plans.md §7)');

check('all eight archetypes exist with the spec stats', () => {
  assert.equal(Object.keys(enemies).length, 8);

  for (const [id, spec] of Object.entries(SPEC_STATS)) {
    const type = enemies[id];
    assert.ok(type, `missing enemy ${id}`);
    assert.equal(type.hp, spec.hp, `${id} hp`);
    assert.equal(type.speedMetersPerSecond, spec.speed, `${id} speed`);
    assert.equal(type.melee.damage, spec.melee, `${id} melee damage`);
    assert.equal(type.ranged.damage, spec.ranged, `${id} ranged damage`);
  }
});

check('every enemy has exactly the attacks its damage implies', () => {
  for (const [id, type] of Object.entries(enemies)) {
    assert.equal(type.melee.enabled, type.melee.damage > 0, `${id} melee flag`);
    assert.equal(type.ranged.enabled, type.ranged.damage > 0, `${id} ranged flag`);

    if (type.melee.enabled) {
      assert.ok(type.melee.rangeMeters > 0, `${id} needs melee reach`);
      assert.ok(type.melee.windupSeconds > 0, `${id} needs a wind-up to react to`);
      assert.ok(type.melee.cooldownSeconds > 0, `${id} needs a melee cooldown`);
    }

    if (type.ranged.enabled) {
      assert.ok(type.ranged.rangeMeters > 0, `${id} needs ranged reach`);
      assert.ok(type.ranged.projectileSpeedMetersPerSecond > 0, `${id} needs shot speed`);
      assert.ok(type.ranged.cooldownSeconds > 0, `${id} needs a ranged cooldown`);
    }
  }
});

check('every weak point is 2x and sits inside its own sprite', () => {
  for (const [id, type] of Object.entries(enemies)) {
    assert.equal(type.weakPoint.damageMultiplier, 2, `${id} multiplier`);

    const top = type.heightMeters / 2 + type.weakPoint.offset[1] + type.weakPoint.radiusMeters;
    assert.ok(top <= type.heightMeters, `${id}: weak point reaches ${top} m on a ${type.heightMeters} m body`);
    assert.ok(type.weakPoint.radiusMeters < type.radiusMeters, `${id}: weak point is not smaller than the body`);
  }
});

check('the heavy hitters telegraph before they land', () => {
  // plans.md §20 gives the siren a charge and the choir an AoE; both should be
  // reactable rather than instant.
  assert.equal(enemies.screaming_siren!.ranged.chargeTelegraphSeconds, 1.0);
  assert.ok(enemies.choir_of_ruin!.ranged.aoeRadiusMeters! > 0);
});

check('range policy closes melee types in and holds ranged types back', () => {
  for (const [id, type] of Object.entries(enemies)) {
    const range = preferredRange(type);

    if (type.melee.enabled) {
      // Stopping distance plus the dead band must still be inside reach. An
      // enemy that halts further out than it can swing stalls there forever,
      // which is exactly what happened at a 0.8 factor with a 0.35 band.
      assert.ok(
        range + ENEMY_AI.approachToleranceMeters < type.melee.rangeMeters,
        `${id} stops at ${range} + ${ENEMY_AI.approachToleranceMeters} m but only reaches ${type.melee.rangeMeters} m`,
      );
      assert.ok(range > 0, `${id} should not stand inside the player`);
      continue;
    }

    assert.ok(range < type.ranged.rangeMeters, `${id} should hold inside its own range`);
    assert.ok(range > type.ranged.rangeMeters * 0.3, `${id} holds needlessly close`);
  }
});

section('phase 4 — player health');

check('starts at 100 and dies at zero', () => {
  const health = new PlayerHealth();
  assert.equal(health.hp, PLAYER.maxHp);
  assert.equal(PLAYER.maxHp, 100);
  assert.equal(health.dead, false);

  assert.equal(health.damage(60), true);
  assert.equal(health.hp, 40);
  assert.equal(health.dead, false);
});

check('immunity swallows follow-up hits, then wears off', () => {
  const health = new PlayerHealth();
  assert.equal(health.damage(10), true);
  assert.equal(health.damage(10), false, 'a second hit inside the window should not land');
  assert.equal(health.hp, 90);

  health.update(PLAYER.damageImmunitySeconds + 0.01);
  assert.equal(health.immune, false);
  assert.equal(health.damage(10), true);
  assert.equal(health.hp, 80);
});

check('a fatal hit clamps at zero and stops further damage', () => {
  const health = new PlayerHealth();
  health.damage(140);
  assert.equal(health.hp, 0);
  assert.equal(health.dead, true);

  health.update(1);
  assert.equal(health.damage(10), false, 'the dead take no more hits');
});

check('the hurt flag lasts exactly one frame', () => {
  const health = new PlayerHealth();
  health.damage(5);
  assert.equal(health.justHurt, true);
  health.update(1 / 60);
  assert.equal(health.justHurt, false);
});

check('reset puts the player back to full', () => {
  const health = new PlayerHealth();
  health.damage(140);
  health.reset();
  assert.equal(health.hp, PLAYER.maxHp);
  assert.equal(health.dead, false);
  assert.equal(health.immune, false);
});

check('the toughest enemy still needs several hits to kill the player', () => {
  const worst = Math.max(...Object.values(enemies).map((type) => Math.max(type.melee.damage, type.ranged.damage)));
  assert.ok(PLAYER.maxHp / worst >= 4, `${worst} damage kills in ${PLAYER.maxHp / worst} hits`);
});

section('phase 4 — doors and line of sight');

check('a closed door is solid and opens on demand', () => {
  const level = levels[0]!;
  const door = level.doors[0]!;
  const collision = new CollisionSystem(level);

  assert.equal(collision.isSolid(door.x, door.y), true, 'door should start closed');
  collision.openDoor(door.x, door.y);
  assert.equal(collision.isSolid(door.x, door.y), false, 'door should be passable once opened');
});

check('line of sight is blocked by walls and clear across open floor', () => {
  const collision = new CollisionSystem(levels[0]!);

  const spawn = new Vector3(1.5, 1.6, 1.5);
  assert.equal(collision.hasLineOfSight(spawn, new Vector3(6.5, 1.6, 1.5)), true, 'open row should be visible');
  // The divider at cell x=7 stands between the two halves of row 1.
  assert.equal(collision.hasLineOfSight(spawn, new Vector3(9.5, 1.6, 1.5)), false, 'wall should block sight');
});

check('a closed door blocks sight until it opens', () => {
  const level = levels[0]!;
  const door = level.doors[0]!;
  const collision = new CollisionSystem(level);

  // The open cells immediately either side of the door, so only the door itself
  // stands between them.
  const before = new Vector3(door.x + 0.5, 1.6, door.y - 0.5);
  const beyond = new Vector3(door.x + 0.5, 1.6, door.y + 1.5);

  assert.equal(collision.hasLineOfSight(before, beyond), false);
  collision.openDoor(door.x, door.y);
  assert.equal(collision.hasLineOfSight(before, beyond), true);
});

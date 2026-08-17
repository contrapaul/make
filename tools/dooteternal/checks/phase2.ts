/**
 * Phase 2: breath, the trumpet, weak points.
 *
 * Covers the breath and trumpet checklists in plans.md §24. EnemySystem itself
 * can't be reached from Node — it builds canvas textures on construction — so
 * weak-point hit detection is verified in the browser; what's asserted here is
 * the data geometry those hits depend on.
 */
import assert from 'node:assert/strict';
import * as THREE from 'three';
import levelJson from '../app/levels/level_01.json';
import weaponsJson from '../app/src/data/weapons.json';
import enemiesJson from '../app/src/data/enemies.json';
import type { LevelData } from '../app/src/core/LevelLoader';
import type { EnemyType } from '../app/src/systems/EnemySystem';
import { BreathSystem } from '../app/src/systems/BreathSystem';
import { withSpread, type WeaponDef } from '../app/src/systems/WeaponSystem';
import { BREATH, PLAYER } from '../app/src/data/constants';
import { check, section } from './harness';

const level = levelJson as LevelData;
const weapons = weaponsJson as unknown as Record<string, WeaponDef>;
const enemies = enemiesJson as unknown as Record<string, EnemyType>;

const trumpet = weapons.trumpet!;
const tambourine = enemies.hell_tambourine!;

/** Advances the breath system at 60 fps for a span of simulated seconds. */
function run(breath: BreathSystem, seconds: number, firing = false): void {
  const step = 1 / 60;
  for (let elapsed = 0; elapsed < seconds; elapsed += step) breath.update(step, firing);
}

section('phase 2 — breath (plans.md §5, §24)');

check('starts full at 40', () => {
  assert.equal(new BreathSystem().breath, 40);
  assert.equal(BREATH.max, PLAYER.maxBreath);
});

check('trumpet costs 4 per shot', () => {
  const breath = new BreathSystem();
  assert.equal(trumpet.breathCostPerShot, 4);
  breath.spend(trumpet.breathCostPerShot);
  assert.equal(breath.breath, 36);
});

check('ten trumpet shots empty the tank exactly', () => {
  const breath = new BreathSystem();
  for (let shot = 0; shot < 10; shot += 1) {
    assert.ok(breath.canSpend(4), `shot ${shot + 1} should be affordable`);
    breath.spend(4);
  }
  assert.equal(breath.breath, 0);
  assert.equal(breath.canSpend(4), false);
});

check('empty to full takes 1.6 s', () => {
  const breath = new BreathSystem();
  breath.spend(40);
  assert.equal(breath.breath, 0);

  run(breath, 1.6 - 1 / 60);
  assert.ok(breath.breath < 40, `should still be filling, got ${breath.breath}`);
  run(breath, 2 / 60);
  assert.equal(breath.breath, 40);
});

check('no recharge in the first 2 s after firing', () => {
  const breath = new BreathSystem();
  breath.spend(4);
  run(breath, 1.9);
  assert.equal(breath.breath, 36, `expected no refill yet, got ${breath.breath}`);
  assert.equal(breath.recharging, false);
});

check('partial breath refills once 2 s have passed', () => {
  const breath = new BreathSystem();
  breath.spend(4);
  run(breath, 2.1);
  assert.ok(breath.breath > 36, `expected refill after 2 s, got ${breath.breath}`);
});

check('R starts a manual recharge immediately', () => {
  const breath = new BreathSystem();
  breath.spend(20);
  breath.requestManualRecharge();
  run(breath, 0.2);
  assert.ok(breath.breath > 20, `expected manual refill, got ${breath.breath}`);
  assert.equal(breath.recharging, true);
});

check('firing cancels a manual recharge', () => {
  const breath = new BreathSystem();
  breath.spend(20);
  breath.requestManualRecharge();
  run(breath, 0.1);
  const afterManual = breath.breath;

  breath.spend(4);
  run(breath, 0.5);
  assert.equal(breath.breath, afterManual - 4, `expected refill to stop, got ${breath.breath}`);
});

check('holding fire blocks recharge even when empty', () => {
  const breath = new BreathSystem();
  breath.spend(40);
  run(breath, 3, true);
  assert.equal(breath.breath, 0);
  assert.equal(breath.recharging, false);
});

check('recharging flag is only set while actually refilling', () => {
  const breath = new BreathSystem();
  run(breath, 3);
  assert.equal(breath.breath, 40);
  assert.equal(breath.recharging, false, 'a full tank should not report recharging');
});

section('phase 2 — trumpet (plans.md §6.1, §24)');

check('trumpet stats match the spec', () => {
  assert.equal(trumpet.shotsPerClick, 1);
  assert.equal(trumpet.fireDelaySeconds, 0.3);
  assert.equal(trumpet.continuousFire, false);
  assert.equal(trumpet.damage, 9);
  assert.equal(trumpet.rangeMeters, 35);
  assert.equal(trumpet.audioMode, 'random');
  assert.equal(trumpet.audioFiles.length, 3);
});

check('spread stays inside the cone and is not stuck at centre', () => {
  const aim = new THREE.Vector3(0, 0, -1);
  let widest = 0;

  for (let shot = 0; shot < 2000; shot += 1) {
    const fired = withSpread(aim, trumpet.spreadBaseRadians);
    assert.ok(Math.abs(fired.length() - 1) < 1e-9, 'spread direction must stay normalised');
    widest = Math.max(widest, aim.angleTo(fired));
  }

  assert.ok(widest <= trumpet.spreadBaseRadians + 1e-9, `max spread ${widest} exceeded the cone`);
  assert.ok(widest > trumpet.spreadBaseRadians * 0.8, `spread looks stuck at centre: ${widest}`);
});

check('zero spread fires dead straight', () => {
  const aim = new THREE.Vector3(0.3, 0, -1).normalize();
  assert.ok(aim.angleTo(withSpread(aim, 0)) < 1e-12);
});

section('phase 2 — weak points and level data (plans.md §7–§8)');

check('weak point sits at eye height, dead ahead of a level shot', () => {
  const centre = tambourine.heightMeters / 2;
  const weakY = centre + tambourine.weakPoint.offset[1];
  assert.equal(weakY, PLAYER.eyeHeight, `weak point at ${weakY} m vs eye height ${PLAYER.eyeHeight} m`);
});

check('weak point multiplier is 2x and kills a tambourine in two hits', () => {
  assert.equal(tambourine.weakPoint.damageMultiplier, 2);
  const weakDamage = trumpet.damage * tambourine.weakPoint.damageMultiplier;
  assert.equal(weakDamage, 18);
  assert.ok(weakDamage * 2 >= tambourine.hp, 'two weak-point hits should kill');
  assert.ok(weakDamage < tambourine.hp, 'one weak-point hit should not');
});

check('body hits need three shots for the same kill', () => {
  assert.ok(trumpet.damage * 2 < tambourine.hp, 'two body hits should not kill');
  assert.ok(trumpet.damage * 3 >= tambourine.hp, 'three body hits should kill');
});

check('the weak point sphere sits inside the sprite it is drawn on', () => {
  const weakTop = tambourine.heightMeters / 2 + tambourine.weakPoint.offset[1] + tambourine.weakPoint.radiusMeters;
  assert.ok(weakTop <= tambourine.heightMeters, `weak point reaches ${weakTop} m on a ${tambourine.heightMeters} m body`);
});

check('every level enemy spawns on open floor', () => {
  assert.ok(level.enemies.length > 0, 'phase 2 needs targets');
  for (const spawn of level.enemies) {
    assert.equal(level.walls[spawn.y]![spawn.x], 0, `enemy at ${spawn.x},${spawn.y} is inside a wall`);
    assert.ok(enemies[spawn.type], `unknown enemy type ${spawn.type}`);
  }
});

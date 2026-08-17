/**
 * Phase 3: the full arsenal.
 *
 * WeaponSystem takes its projectile, blast, audio and wall dependencies as
 * narrow interfaces, so the whole firing path — fire rates, breath costs,
 * spread growth, the guitar's timed sequence, loop audio — can be driven here
 * with recording stubs instead of a renderer.
 */
import assert from 'node:assert/strict';
import * as THREE from 'three';
import levelJson from '../app/levels/level_01.json';
import weaponsJson from '../app/src/data/weapons.json';
import enemiesJson from '../app/src/data/enemies.json';
import { CollisionSystem } from '../app/src/core/CollisionSystem';
import type { LevelData } from '../app/src/core/LevelLoader';
import type { AudioSink } from '../app/src/systems/AudioManager';
import type { BlastSpec } from '../app/src/systems/BlastSystem';
import { BreathSystem } from '../app/src/systems/BreathSystem';
import { getOverkillTier } from '../app/src/systems/Overkill';
import { deathPreset } from '../app/src/systems/DeathEffects';
import type { ProjectileSpawn } from '../app/src/systems/ProjectileSystem';
import type { EnemyType } from '../app/src/systems/EnemySystem';
import {
  WeaponSystem,
  WEAPON_ORDER,
  tubaDamage,
  type ProjectileWeapon,
  type SequenceWeapon,
  type WaveWeapon,
  type WeaponDef,
} from '../app/src/systems/WeaponSystem';
import { check, section } from './harness';

const level = levelJson as LevelData;
const weapons = weaponsJson as unknown as Record<string, WeaponDef>;
const enemies = enemiesJson as unknown as Record<string, EnemyType>;

const tuba = weapons.tuba as WaveWeapon;
const sax = weapons.saxophone as ProjectileWeapon;
const guitar = weapons.electric_guitar as SequenceWeapon;

interface AudioCall {
  kind: 'oneOf' | 'one' | 'startLoop' | 'stopLoop';
  detail: string;
}

/** A weapon system wired to recorders instead of the renderer. */
function rig(weaponId: string) {
  const shots: ProjectileSpawn[] = [];
  const blasts: BlastSpec[] = [];
  const audioCalls: AudioCall[] = [];

  const audio: AudioSink = {
    playOneOf: (files) => audioCalls.push({ kind: 'oneOf', detail: files.join(',') }),
    playOne: (file) => audioCalls.push({ kind: 'one', detail: file }),
    startLoop: (id, file) => audioCalls.push({ kind: 'startLoop', detail: `${id}:${file}` }),
    stopLoop: (id) => audioCalls.push({ kind: 'stopLoop', detail: id }),
  };

  const breath = new BreathSystem();
  const weapon = new WeaponSystem(
    { spawn: (spawn) => shots.push(spawn) },
    { spawn: (spec) => blasts.push(spec) },
    breath,
    audio,
    new CollisionSystem(level),
  );
  weapon.select(weaponId);

  const origin = new THREE.Vector3(1.5, 1.6, 1.5);
  const aim = new THREE.Vector3(1, 0, 0); // yaw 90: straight down the open row

  /** Holds the trigger for a span of simulated time at 60 fps. */
  const hold = (seconds: number, held = true) => {
    const step = 1 / 60;
    for (let elapsed = 0; elapsed < seconds; elapsed += step) {
      weapon.update(step, held, held, origin, aim);
      breath.update(step, held);
    }
  };

  /** A single click: one edge frame, then released time. */
  const click = () => weapon.update(1 / 60, true, true, origin, aim);
  const release = (seconds: number) => hold(seconds, false);

  return { weapon, breath, shots, blasts, audioCalls, hold, click, release, origin, aim };
}

section('phase 3 — tuba (plans.md §6.2, §24)');

check('tuba stats match the spec', () => {
  assert.equal(tuba.breathCostPerShot, 10);
  assert.equal(tuba.fireDelaySeconds, 0.8);
  assert.equal(tuba.shotsPerClick, 1);
  assert.equal(tuba.continuousFire, false);
  assert.equal(tuba.baseDamageClose, 35);
  assert.equal(tuba.audioMode, 'random');
  assert.equal(tuba.audioFiles.length, 2);
});

check('wave radius and damage range agree', () => {
  // plans.md gives waveMaxRadius 6 but a damage range of 8, which would let the
  // wave hurt enemies two metres past where it is drawn.
  assert.equal(tuba.waveMaxRadiusMeters, tuba.maxEffectiveRangeMeters);
});

check('damage is heavy up close, halved mid-range, zero past 8 m', () => {
  assert.equal(tubaDamage(tuba, 0), 35);
  assert.ok(Math.abs(tubaDamage(tuba, 4) - 17.5) < 1e-9, `4 m: ${tubaDamage(tuba, 4)}`);
  assert.equal(tubaDamage(tuba, 8), 0);
  assert.equal(tubaDamage(tuba, 9), 0);
  assert.equal(tubaDamage(tuba, 40), 0);
});

check('damage falls off monotonically', () => {
  let previous = Number.POSITIVE_INFINITY;
  for (let distance = 0; distance <= 10; distance += 0.5) {
    const damage = tubaDamage(tuba, distance);
    assert.ok(damage <= previous, `damage rose at ${distance} m`);
    previous = damage;
  }
});

check('one blast per click, costing 10 breath', () => {
  const test = rig('tuba');
  test.click();
  assert.equal(test.blasts.length, 1);
  assert.equal(test.shots.length, 0, 'the tuba fires a wave, not projectiles');
  assert.equal(test.breath.breath, 30);
  assert.equal(test.blasts[0]!.orientation, 'horizontal');
  assert.equal(test.blasts[0]!.weaponId, 'tuba');
});

check('holding the trigger does not repeat before 0.8 s', () => {
  const test = rig('tuba');
  test.hold(0.7);
  assert.equal(test.blasts.length, 1, `fired ${test.blasts.length} times inside the delay`);
});

section('phase 3 — saxophone (plans.md §6.3, §24)');

check('saxophone stats match the spec', () => {
  assert.equal(sax.breathCostPerShot, 0.5);
  assert.equal(sax.continuousFire, true);
  assert.equal(sax.fireDelaySeconds, 0.0625);
  assert.equal(sax.damage, 2);
  assert.equal(sax.audioMode, 'loop_restart_on_new_burst');
  assert.equal(sax.audioFiles.length, 1);
});

check('holding fire runs at about 16 shots per second', () => {
  const test = rig('saxophone');
  test.hold(1);
  assert.ok(test.shots.length >= 15 && test.shots.length <= 17, `fired ${test.shots.length} in one second`);
});

check('a one-second burst costs about 8 breath', () => {
  const test = rig('saxophone');
  test.hold(1);
  const spent = 40 - test.breath.breath;
  assert.ok(Math.abs(spent - 8) <= 0.6, `spent ${spent}`);
});

check('spread widens while held and clamps at the maximum', () => {
  const test = rig('saxophone');
  assert.ok(Math.abs(test.weapon.spreadRadians - sax.spreadBaseRadians) < 1e-9, 'should start at base spread');

  test.hold(0.5);
  const halfSecond = test.weapon.spreadRadians;
  assert.ok(halfSecond > sax.spreadBaseRadians, `spread did not grow: ${halfSecond}`);

  test.hold(6);
  assert.ok(Math.abs(test.weapon.spreadRadians - sax.spreadMaxRadians!) < 1e-9, `did not clamp: ${test.weapon.spreadRadians}`);
});

check('spread resets after half a second off the trigger', () => {
  const test = rig('saxophone');
  test.hold(1);
  assert.ok(test.weapon.spreadRadians > sax.spreadBaseRadians);

  test.release(0.4);
  assert.ok(test.weapon.spreadRadians > sax.spreadBaseRadians, 'reset too early');

  test.release(0.2);
  assert.ok(Math.abs(test.weapon.spreadRadians - sax.spreadBaseRadians) < 1e-9, `did not reset: ${test.weapon.spreadRadians}`);
});

check('the fire loop starts once per burst and stops on release', () => {
  const test = rig('saxophone');
  test.hold(0.5);
  const starts = test.audioCalls.filter((call) => call.kind === 'startLoop');
  assert.equal(starts.length, 1, `started the loop ${starts.length} times during one burst`);
  assert.match(starts[0]!.detail, /saxophone_fire_loop\.ogg/);

  test.release(0.3);
  assert.equal(test.audioCalls.filter((call) => call.kind === 'stopLoop').length, 1, 'loop should stop on release');

  test.hold(0.2);
  assert.equal(test.audioCalls.filter((call) => call.kind === 'startLoop').length, 2, 'a new burst restarts the loop');
});

check('running out of breath stops the loop', () => {
  const test = rig('saxophone');
  test.hold(6); // 8 breath/second empties the tank inside five
  assert.equal(test.breath.breath < 0.5, true, `breath left: ${test.breath.breath}`);
  assert.ok(test.audioCalls.some((call) => call.kind === 'stopLoop'), 'starved fire should stop the loop');
});

section('phase 3 — electric guitar (plans.md §6.4, §24)');

check('guitar stats match the spec', () => {
  assert.equal(guitar.breathCostPerShot, 13.33);
  assert.equal(guitar.fireDelaySeconds, 0.7);
  assert.equal(guitar.audioMode, 'sequence');
  assert.equal(guitar.audioFiles.length, 3);
  assert.equal(guitar.blasts.length, 3);
});

check('blasts go large-and-near, medium, then small-and-far', () => {
  const [first, second, third] = guitar.blasts as [typeof guitar.blasts[0], typeof guitar.blasts[0], typeof guitar.blasts[0]];

  assert.ok(first.targetDistanceMeters < second.targetDistanceMeters);
  assert.ok(second.targetDistanceMeters < third.targetDistanceMeters);
  assert.ok(first.explosionRadiusMeters > second.explosionRadiusMeters);
  assert.ok(second.explosionRadiusMeters > third.explosionRadiusMeters);
  assert.ok(first.damage > second.damage);
  assert.ok(second.damage > third.damage);
  assert.deepEqual(
    guitar.blasts.map((blast) => blast.delaySeconds),
    [0, 0.15, 0.3],
  );
});

check('one click fires all three blasts, in order, over 0.3 s', () => {
  const test = rig('electric_guitar');
  test.click();
  assert.equal(test.blasts.length, 1, 'the first blast is immediate');

  test.release(0.5);
  assert.equal(test.blasts.length, 3, `ended with ${test.blasts.length} blasts`);

  const radii = test.blasts.map((blast) => blast.maxRadiusMeters);
  assert.deepEqual(radii, [4, 3, 1.5], `radii out of order: ${radii.join(', ')}`);
});

check('audio files play in exact order 1, 2, 3', () => {
  const test = rig('electric_guitar');
  test.click();
  test.release(0.5);

  const played = test.audioCalls.filter((call) => call.kind === 'one').map((call) => call.detail);
  assert.deepEqual(played, [
    'audio/sfx/guitar_blast_01.wav',
    'audio/sfx/guitar_blast_02.wav',
    'audio/sfx/guitar_blast_03.wav',
  ]);
});

check('a full tank affords exactly three guitar combos', () => {
  const test = rig('electric_guitar');
  for (let combo = 0; combo < 3; combo += 1) {
    const fired = test.weapon.update(1 / 60, true, true, test.origin, test.aim);
    assert.equal(fired, true, `combo ${combo + 1} should fire`);
    test.release(0.8); // clear the 0.7 s delay
  }

  assert.ok(test.breath.breath < 13.33, `should not afford a fourth: ${test.breath.breath} left`);
});

check('blasts stop short of walls instead of detonating through them', () => {
  const test = rig('electric_guitar');
  test.click();
  test.release(0.5);

  // Firing east from (1.5, 1.5) the divider wall at cell x=7 is 5.5 m away, so
  // the 8 m and 14 m blasts must be pulled back short of it.
  for (const blast of test.blasts) {
    assert.ok(blast.centre.x < 7, `blast landed at x=${blast.centre.x}, past the wall`);
  }
});

section('phase 3 — switching, overkill and death presets (plans.md §10, §18)');

check('weapon order matches keys 1-4', () => {
  assert.deepEqual([...WEAPON_ORDER], ['trumpet', 'tuba', 'saxophone', 'electric_guitar']);
  for (const id of WEAPON_ORDER) assert.ok(weapons[id], `no data for ${id}`);
});

check('selecting and cycling moves between weapons', () => {
  const test = rig('trumpet');
  test.weapon.select('saxophone');
  assert.equal(test.weapon.current.id, 'saxophone');

  test.weapon.cycle(1);
  assert.equal(test.weapon.current.id, 'electric_guitar');

  test.weapon.cycle(1);
  assert.equal(test.weapon.current.id, 'trumpet', 'cycling past the end wraps');

  test.weapon.cycle(-1);
  assert.equal(test.weapon.current.id, 'electric_guitar', 'cycling back wraps too');
});

check('switching away from the saxophone stops its loop', () => {
  const test = rig('saxophone');
  test.hold(0.3);
  test.weapon.select('trumpet');
  assert.ok(test.audioCalls.some((call) => call.kind === 'stopLoop'), 'loop kept playing after a switch');
});

check('an unknown weapon id is ignored', () => {
  const test = rig('trumpet');
  test.weapon.select('bagpipes');
  assert.equal(test.weapon.current.id, 'trumpet');
});

check('overkill tiers follow the spec thresholds', () => {
  assert.equal(getOverkillTier(19, 20), 0);
  assert.equal(getOverkillTier(20, 20), 1);
  assert.equal(getOverkillTier(49, 20), 1);
  assert.equal(getOverkillTier(50, 20), 2);
});

check('a tambourine kill tiers by which weapon landed it', () => {
  const hp = enemies.hell_tambourine!.hp; // 20
  // A trumpet body hit finishes a wounded enemy: a normal kill.
  assert.equal(getOverkillTier(9, hp), 0);
  // A point-blank tuba blast is 35: heavy overkill.
  assert.equal(getOverkillTier(tubaDamage(tuba, 0), hp), 1);
  // The guitar's opening blast plus its second, on a fresh one: still heavy.
  assert.equal(getOverkillTier(guitar.blasts[0]!.damage, hp), 1);
});

check('every weapon has a distinct death signature', () => {
  const patterns = WEAPON_ORDER.map((id) => deathPreset(id, 0));
  assert.equal(new Set(patterns.map((preset) => preset.pattern)).size >= 3, true, 'death bursts look too alike');
  assert.equal(deathPreset('trumpet', 0).pattern, 'up', 'trumpet: vertical shards');
  assert.equal(deathPreset('saxophone', 0).pattern, 'horizontal', 'saxophone: horizontal shredding');
  assert.equal(deathPreset('tuba', 0).pattern, 'radial', 'tuba: radial blast');
  assert.equal(deathPreset('electric_guitar', 0).ringCount, 3, 'guitar: three ring bursts');
  assert.ok(deathPreset('tuba', 0).corpseFlatten < 1, 'tuba should squash the corpse');
});

check('higher overkill is louder in every dimension', () => {
  for (const id of WEAPON_ORDER) {
    const normal = deathPreset(id, 0);
    const heavy = deathPreset(id, 1);
    const extreme = deathPreset(id, 2);

    assert.ok(heavy.burstScale > normal.burstScale, `${id}: tier 1 burst`);
    assert.ok(extreme.burstScale > heavy.burstScale, `${id}: tier 2 burst`);
    assert.ok(extreme.extraDecals > heavy.extraDecals, `${id}: tier 2 decals`);
    assert.ok(extreme.ringRadiusMeters > heavy.ringRadiusMeters, `${id}: tier 2 rings`);
    assert.ok(extreme.shake > normal.shake, `${id}: tier 2 shake`);
    assert.ok(extreme.ringCount >= 2, `${id}: tier 2 should throw rings`);
  }
});

check('an unknown weapon still gets a usable death preset', () => {
  const preset = deathPreset('bagpipes', 2);
  assert.ok(preset.burstScale > 0);
  assert.equal(preset.corpseFlatten > 0, true);
});

section('phase 3 — audio manifest');

check('every weapon points at files listed in the manifest', () => {
  for (const id of WEAPON_ORDER) {
    const def = weapons[id]!;
    assert.ok(def.audioFiles.length > 0, `${id} has no audio`);
    for (const file of def.audioFiles) {
      assert.match(file, /^audio\/sfx\/[a-z0-9_]+\.(wav|ogg)$/, `${id}: odd audio path ${file}`);
    }
  }
});

check('audio modes are the three the spec defines', () => {
  const modes = new Set(WEAPON_ORDER.map((id) => weapons[id]!.audioMode));
  assert.deepEqual([...modes].sort(), ['loop_restart_on_new_burst', 'random', 'sequence']);
});

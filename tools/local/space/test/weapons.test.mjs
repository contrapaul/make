import test from 'node:test';
import assert from 'node:assert/strict';
import { HULLS } from '../js/data/hulls.js';
import { WEAPONS } from '../js/data/weapons.js';
import { createState, createShip } from '../js/sim/state.js';
import {
  selectMount,
  rotateAim,
  tickCooldowns,
  tryFire,
  stepProjectiles,
  hitscanCircles,
} from '../js/sim/weapons.js';

const DT = 1 / 60;
const hull = HULLS.corvette;
const TWO_PI = Math.PI * 2;

function setup() {
  const state = createState({ seed: 555 });
  const ship = createShip(hull, { id: 1, team: 'blue' });
  state.ships.push(ship);
  return { state, ship };
}

test('cannon aim clamps at ±0.61 around its centre', () => {
  const { ship } = setup();
  for (let i = 0; i < 600; i++) rotateAim(ship, hull, 'port', 1, DT);
  assert.ok(Math.abs(ship.mounts.port.aim - (Math.PI / 2 + 0.61)) < 1e-9, 'upper clamp');
  for (let i = 0; i < 1200; i++) rotateAim(ship, hull, 'port', -1, DT);
  assert.ok(Math.abs(ship.mounts.port.aim - (Math.PI / 2 - 0.61)) < 1e-9, 'lower clamp');
});

test('turret aim wraps past 2π and stays in [0, 2π)', () => {
  const { ship } = setup();
  for (let i = 0; i < 3000; i++) rotateAim(ship, hull, 'turret', 1, DT); // ~17 full turns
  assert.ok(ship.mounts.turret.aim >= 0 && ship.mounts.turret.aim < TWO_PI, 'after CW');
  for (let i = 0; i < 5000; i++) rotateAim(ship, hull, 'turret', -1, DT);
  assert.ok(ship.mounts.turret.aim >= 0 && ship.mounts.turret.aim < TWO_PI, 'after CCW');
});

test('lance aim clamps at ±0.087 around 0', () => {
  const { ship } = setup();
  for (let i = 0; i < 600; i++) rotateAim(ship, hull, 'lance', 1, DT);
  assert.ok(Math.abs(ship.mounts.lance.aim - 0.087) < 1e-9, 'upper');
  for (let i = 0; i < 1200; i++) rotateAim(ship, hull, 'lance', -1, DT);
  assert.ok(Math.abs(ship.mounts.lance.aim + 0.087) < 1e-9, 'lower');
});

test('firing sets cooldown; second tryFire in same tick returns null', () => {
  const { state, ship } = setup();
  assert.equal(selectMount(ship, 'port'), 'port');
  const p = tryFire(state, ship, hull, 'port');
  assert.ok(p, 'first shot fires');
  assert.equal(p.kind, 'cannon');
  assert.equal(ship.mounts.port.cooldown, WEAPONS.cannon.reload);
  assert.equal(tryFire(state, ship, hull, 'port'), null, 'still cooling down');
  assert.equal(state.stats.rounds.cannon, 1);
});

test('gun at rate 15 fires 15 ± 1 rounds over 1 s of held fire', () => {
  const { state, ship } = setup();
  selectMount(ship, 'turret');
  let n = 0;
  for (let i = 0; i < 60; i++) {
    tickCooldowns(ship, DT);
    state.time += DT;
    if (tryFire(state, ship, hull, 'turret')) n++;
  }
  assert.ok(n >= 14 && n <= 16, `fired ${n} rounds in 1 s`);
});

test('projectile expires after ttl', () => {
  const { state, ship } = setup();
  selectMount(ship, 'turret');
  tryFire(state, ship, hull, 'turret');
  assert.equal(state.projectiles.length, 1);
  for (let i = 0; i < 120 && state.projectiles.length; i++) {
    stepProjectiles(state, DT);
    state.time += DT;
  }
  assert.equal(state.projectiles.length, 0, 'expired');
});

test('hitscan picks the nearest of two circles and ignores ones behind', () => {
  const origin = { x: 0, z: 0 };
  const near = { x: 100, z: 2, radius: 3, id: 'near' };
  const far = { x: 200, z: 0, radius: 3, id: 'far' };
  const behind = { x: -50, z: 0, radius: 5, id: 'behind' };
  const hit = hitscanCircles(origin, 0, 300, [behind, far, near]);
  assert.equal(hit.target.id, 'near');
  assert.equal(hitscanCircles(origin, 0, 300, [behind]), null, 'behind ignored');
  assert.equal(hitscanCircles(origin, 0, 50, [far]), null, 'out of range ignored');
});

test('lance fires a beam record and sets its reload', () => {
  const { state, ship } = setup();
  selectMount(ship, 'lance');
  const r = tryFire(state, ship, hull, 'lance');
  assert.ok(r.beam, 'beam returned');
  assert.equal(state.beams.length, 1);
  assert.equal(ship.mounts.lance.cooldown, WEAPONS.lance.reload);
  assert.equal(state.stats.rounds.lance, 1);
});

test('determinism: 600 ticks with continuous firing', () => {
  const mk = () => {
    const s = createState({ seed: 777 });
    const me = createShip(hull, { id: 1, team: 'blue' });
    const foe = createShip(hull, { id: 2, team: 'red', x: 150, z: 30 });
    s.ships.push(me, foe);
    selectMount(me, 'turret');
    return { s, me };
  };
  const a = mk();
  const b = mk();
  const runOne = ({ s, me }) => {
    tickCooldowns(me, DT);
    tryFire(s, me, hull, 'turret'); // held fire
    stepProjectiles(s, DT);
    s.time += DT;
    s.tick += 1;
  };
  for (let i = 0; i < 600; i++) {
    runOne(a);
    runOne(b);
  }
  const strip = (x) => {
    const { rng, ...rest } = x.s; // rng is a closure; compare the plain-data state
    return rest;
  };
  assert.deepStrictEqual(strip(a), strip(b));
});

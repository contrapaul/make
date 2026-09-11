import test from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../js/sim/rng.js';
import { HULLS } from '../js/data/hulls.js';
import { createState, createShip } from '../js/sim/state.js';
import { stepShip, applyBounds, speedOf } from '../js/sim/physics.js';

const DT = 1 / 60;
const hull = HULLS.corvette;

function makeState({ x = 0, z = 0, heading = 0 } = {}) {
  const state = createState({ seed: 1234 });
  state.ships.push(createShip(hull, { id: 1, x, z, heading, team: 'blue' }));
  return state;
}

function run(state, input, ticks) {
  const ship = state.ships[0];
  for (let i = 0; i < ticks; i++) {
    stepShip(ship, hull, input, DT);
    applyBounds(ship, state.bounds, DT);
    state.tick += 1;
    state.time += DT;
  }
}

test('thrust for 2 s: speed > 0 and <= maxSpeed', () => {
  const state = makeState();
  run(state, { thrust: 1, turn: 0 }, 120);
  const s = speedOf(state.ships[0]);
  assert.ok(s > 0, 'should be moving');
  assert.ok(s <= hull.maxSpeed, 'must not exceed maxSpeed');
});

test('coasting 10 s decays below 5 % of start speed', () => {
  const state = makeState();
  run(state, { thrust: 1, turn: 0 }, 120);
  const start = speedOf(state.ships[0]);
  run(state, { thrust: 0, turn: 0 }, 600);
  assert.ok(speedOf(state.ships[0]) < start * 0.05, 'should have nearly stopped');
});

test('turn:1 for 1 s: heading > 0 and angVel <= maxTurn', () => {
  const state = makeState();
  run(state, { thrust: 0, turn: 1 }, 60);
  const ship = state.ships[0];
  assert.ok(ship.heading > 0, 'should have turned');
  assert.ok(ship.angVel <= hull.maxTurn, 'angVel must stay clamped');
});

test('ship at x=990 is pushed back toward 0 over 3 s', () => {
  const state = makeState({ x: 990 });
  run(state, { thrust: 0, turn: 0 }, 180);
  const ship = state.ships[0];
  assert.ok(ship.x < 990, 'position must move back in');
  assert.ok(ship.x > 0, 'should push toward centre, not through it');
  assert.ok(ship.vx < 0, 'velocity should point inward');
});

test('rng with same seed yields the same 5 numbers', () => {
  const a = createRng(7);
  const b = createRng(7);
  const na = [a.next(), a.next(), a.next(), a.next(), a.next()];
  const nb = [b.next(), b.next(), b.next(), b.next(), b.next()];
  assert.deepEqual(na, nb);
  for (const v of na) assert.ok(v >= 0 && v < 1, 'next() in [0,1)');
  assert.ok(createRng(99).int(3, 8) >= 3 && createRng(99).int(3, 8) <= 8, 'int in range');
});

test('determinism: identical states stay identical over 600 ticks', () => {
  const make = () => makeState({ x: 100, z: -40, heading: 0.7 });
  const a = make();
  const b = make();
  const thrusts = [1, 0, -1, 1];
  const turns = [0, 1, 0, -1];
  const input = (i) => ({ thrust: thrusts[i % 4], turn: turns[(i >> 2) % 4] });
  for (let i = 0; i < 600; i++) {
    run(a, input(i), 1);
    run(b, input(i), 1);
  }
  const strip = (s) => {
    const { rng, ...rest } = s; // rng is a closure; compare its plain-data effect instead
    return rest;
  };
  assert.deepStrictEqual(strip(a), strip(b));
});

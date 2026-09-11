import test from 'node:test';
import assert from 'node:assert/strict';
import { HULLS } from '../js/data/hulls.js';
import { createState, createShip } from '../js/sim/state.js';
import { stepEnemies, stepMissiles } from '../js/sim/enemies.js';

const DT = 1 / 60;

function setup() {
  const state = createState({ seed: 8 });
  const me = createShip(HULLS.corvette, { id: 1, team: 'blue', x: 0, z: 200 });
  const foe = createShip(HULLS.corvette, { id: 2, team: 'red', x: 0, z: 0 });
  foe.launcherSpec = { period: 7, speed: 70, ttl: 9, damage: 120, hp: 5 };
  foe.launcherTimer = 0;
  state.ships.push(me, foe);
  state.playerId = 1;
  return { state, me, foe };
}

test('launcher fires exactly floor(T/period) missiles in T seconds', () => {
  const { state } = setup();
  const before = state.nextId;
  for (let i = 0; i < Math.round(20 / DT); i++) stepEnemies(state, DT);
  assert.equal(state.nextId - before, Math.floor(20 / 7)); // 2
});

test('missiles aim at the player current position and fly straight', () => {
  const { state, me } = setup();
  stepEnemies(state, DT * 425); // t = 7.08 s → first shot (7 s period, float headroom)
  assert.equal(state.missiles.length, 1);
  const m = state.missiles[0];
  // player at (0, 200), shooter at origin → straight +z at 70 u/s
  assert.ok(Math.abs(m.vz - 70) < 1e-9, `vz=${m.vz}`);
  assert.ok(Math.abs(m.vx) < 1e-9, `vx=${m.vx}`);
  for (let i = 0; i < 60; i++) stepMissiles(state, DT);
  assert.ok(Math.abs(m.z - 70) < 1e-6, 'linear flight');
  // player moved after launch: next missile re-aims at the NEW position
  me.z = 400;
  for (let i = 0; i < Math.round(7 / DT) + 5; i++) stepEnemies(state, DT);
  const m2 = state.missiles[1];
  assert.ok(m2 && Math.abs(m2.vz - 70) < 1e-9 && m2.vx === 0, 're-aimed at current player pos');
});

test('missiles expire after ttl', () => {
  const { state } = setup();
  stepEnemies(state, DT * 420);
  assert.equal(state.missiles.length, 1);
  for (let i = 0; i < Math.round(9 / DT) + 60; i++) stepMissiles(state, DT);
  assert.equal(state.missiles.length, 0, 'expired');
});

test('drifting enemy moves on its fixed line', () => {
  const { state, foe } = setup();
  foe.drift = { vx: 6, vz: 0 };
  for (let i = 0; i < Math.round(10 / DT); i++) stepEnemies(state, DT);
  assert.ok(Math.abs(foe.x - 60) < 1e-6, `x=${foe.x}`);
});

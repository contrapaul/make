import test from 'node:test';
import assert from 'node:assert/strict';
import { HULLS } from '../js/data/hulls.js';
import { createState, createShip, makeChunk } from '../js/sim/state.js';
import { stepCollisions } from '../js/sim/collide.js';

const DT = 1 / 60;

function fresh() {
  const state = createState({ seed: 3 });
  state.playerId = 1;
  return state;
}

test('head-on equal-mass collision: both damaged equally, velocities reverse partially', () => {
  const state = fresh();
  const a = createShip(HULLS.corvette, { id: 1, team: 'blue', x: 0, z: 0 });
  const b = createShip(HULLS.corvette, { id: 2, team: 'red', x: 20, z: 0 });
  a.vx = 30;
  b.vx = -30;
  state.ships.push(a, b);
  stepCollisions(state, DT);
  assert.ok(a.hp < 600 && b.hp < 600, 'both damaged');
  assert.ok(Math.abs(600 - a.hp - (600 - b.hp)) < 1e-9, 'equal damage');
  assert.ok(a.vx < 0 && Math.abs(a.vx) < 30, 'a reversed, slower');
  assert.ok(b.vx > 0 && Math.abs(b.vx) < 30, 'b reversed, slower');
  assert.ok(state.stats.collisions >= 1);
});

test('heavier body loses less speed', () => {
  const state = fresh();
  const ship = createShip(HULLS.corvette, { id: 1, team: 'blue', x: 0, z: 0 });
  ship.vx = 30;
  state.ships.push(ship);
  const chunk = makeChunk(state, { x: 20, z: 0, size: 10 }); // mass 2000 > ship 1200
  state.chunks.push(chunk);
  stepCollisions(state, DT);
  const dShip = Math.abs(ship.vx - 30);
  const dChunk = Math.abs(chunk.vx - 0);
  assert.ok(dChunk < dShip, `chunk Δv ${dChunk.toFixed(2)} < ship Δv ${dShip.toFixed(2)}`);
});

test('missile detonates on ship contact, dealing its damage', () => {
  const state = fresh();
  const ship = createShip(HULLS.corvette, { id: 1, team: 'blue', x: 0, z: 0 });
  state.ships.push(ship);
  const m = { id: 9, team: 'red', x: 10, z: 0, vx: 0, vz: 0, ttl: 5, hp: 5, damage: 120, radius: 4 };
  state.missiles.push(m);
  stepCollisions(state, DT);
  assert.equal(state.missiles.length, 0, 'missile gone');
  assert.equal(ship.hp, 600 - 120, 'full missile damage');
});

test('missile does not hit its own team', () => {
  const state = fresh();
  const own = createShip(HULLS.corvette, { id: 1, team: 'red', x: 0, z: 0 });
  state.ships.push(own);
  const m = { id: 9, team: 'red', x: 10, z: 0, vx: 0, vz: 0, ttl: 5, hp: 5, damage: 120, radius: 4 };
  state.missiles.push(m);
  stepCollisions(state, DT);
  assert.equal(state.missiles.length, 1, 'missile still there');
  assert.equal(own.hp, 600, 'no damage');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { HULLS } from '../js/data/hulls.js';
import { MAPS } from '../js/data/maps.js';
import { createState, createShip, makeChunk, spawnJunk } from '../js/sim/state.js';
import { spawnEnemies } from '../js/sim/enemies.js';
import { applyHit } from '../js/sim/damage.js';
import { step, updateOver } from '../js/sim/step.js';

const DT = 1 / 60;

function fresh() {
  const state = createState({ seed: 42 });
  state.playerId = 1;
  const me = createShip(HULLS.corvette, { id: 1, team: 'blue' });
  const foe = createShip(HULLS.corvette, { id: 2, team: 'red' });
  state.ships.push(me, foe);
  return { state, me, foe };
}

test('cannon on a size-10 chunk splits it into 2-3 smaller, total < original', () => {
  const { state } = fresh();
  const c = makeChunk(state, { x: 50, z: 0, size: 10, gen: 0 });
  state.chunks.push(c);
  applyHit(state, c, 40, { kind: 'cannon' }); // 40 × 3 = 120 > hp 30
  const kids = state.chunks;
  assert.ok(kids.length >= 2 && kids.length <= 3, `got ${kids.length} chunks`);
  assert.ok(kids.reduce((s, k) => s + k.size, 0) < 10, 'total size smaller');
  assert.ok(kids.every((k) => k.gen === 1 && k.size < 10), 'smaller, gen 1');
});

test('gen-2 chunk is removed, not split', () => {
  const { state } = fresh();
  const c = makeChunk(state, { size: 8, gen: 2 });
  state.chunks.push(c);
  applyHit(state, c, 40, { kind: 'cannon' });
  assert.equal(state.chunks.length, 0);
  assert.equal(state.stats.debrisDestroyed, 1);
});

test('gun rounds: missile (hp 5) survives 1 (2×1.5=3), dies on 2; cannon one-shots', () => {
  const { state } = fresh();
  const mk = (id) => {
    const m = { id, team: 'red', x: 0, z: 0, vx: 0, vz: 0, ttl: 9, hp: 5, damage: 120, radius: 4 };
    state.missiles.push(m);
    return m;
  };
  const m1 = mk(10);
  applyHit(state, m1, 2, { team: 'blue', kind: 'gun' });
  assert.equal(m1.hp, 2, 'survives first gun round');
  assert.ok(state.missiles.includes(m1));
  applyHit(state, m1, 2, { team: 'blue', kind: 'gun' });
  assert.ok(!state.missiles.includes(m1), 'dead on second');
  assert.equal(state.stats.missilesIntercepted, 1);
  const m2 = mk(11);
  applyHit(state, m2, 40, { team: 'blue', kind: 'cannon' });
  assert.ok(!state.missiles.includes(m2), 'cannon one-shots');
});

test('state.over flips when the last enemy dies', () => {
  const { state, foe } = fresh();
  const foe2 = createShip(HULLS.corvette, { id: 3, team: 'red' });
  state.ships.push(foe2);
  applyHit(state, foe, 9999, { team: 'blue', kind: 'cannon' });
  updateOver(state);
  assert.equal(state.over, false, 'one enemy left');
  applyHit(state, foe2, 9999, { team: 'blue', kind: 'cannon' });
  updateOver(state);
  assert.equal(state.over, true, 'last enemy dead');
});

test('player death sets state.over', () => {
  const { state, me } = fresh();
  applyHit(state, me, 9999, { team: 'red', kind: 'missile' });
  updateOver(state);
  assert.equal(state.over, true);
});

test('determinism: full map for 1200 ticks', () => {
  const build = () => {
    const state = createState({ seed: MAPS.skirmish.seed });
    const me = createShip(HULLS.corvette, {
      id: state.nextId++,
      team: 'blue',
      x: MAPS.skirmish.player.x,
      z: MAPS.skirmish.player.z,
      heading: MAPS.skirmish.player.heading,
    });
    state.playerId = me.id;
    state.ships.push(me);
    spawnEnemies(state, MAPS.skirmish, HULLS.corvette);
    spawnJunk(state, MAPS.skirmish);
    return { state, me };
  };
  const a = build();
  const b = build();
  const input = (i) => ({
    thrust: [1, 0, -1][i % 3],
    turn: [0, 1, 0, -1][i % 4],
    aim: i % 5 === 0 ? 1 : 0,
    select: i === 30 ? 'port' : i === 90 ? 'turret' : null,
    fire: i % 7 === 0,
    pause: false,
  });
  for (let i = 0; i < 1200; i++) {
    step(a.state, input(i), DT);
    step(b.state, input(i), DT);
  }
  const strip = (s) => {
    const { rng, ...rest } = s; // rng is a closure; compare the plain-data state
    return rest;
  };
  assert.deepStrictEqual(strip(a.state), strip(b.state));
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PLANETS,
  orbitAngle,
  planetPosition,
  createClock,
  describe,
} from '../js/sim.js';

const PI = Math.PI;
const EPS = 1e-9;

test('PLANETS has 6 entries with strictly increasing orbits and positive periods', () => {
  assert.equal(PLANETS.length, 6);
  for (let i = 1; i < PLANETS.length; i++) {
    assert.ok(PLANETS[i].orbit > PLANETS[i - 1].orbit, `orbit at ${i} not increasing`);
  }
  for (const p of PLANETS) {
    assert.ok(p.period > 0, `${p.name} period must be > 0`);
  }
});

test('orbitAngle is 0 at t = period and PI/2 at t = period/4', () => {
  const p = PLANETS[0];
  assert.ok(Math.abs(orbitAngle(p, p.period)) < EPS);
  assert.ok(Math.abs(orbitAngle(p, p.period / 4) - PI / 2) < EPS);
});

test('planetPosition at t=0 is (orbit, 0, 0) and tilt preserves radius', () => {
  for (const p of PLANETS) {
    const at0 = planetPosition(p, 0);
    assert.ok(Math.abs(at0.x - p.orbit) < EPS);
    assert.ok(Math.abs(at0.y) < EPS);
    assert.ok(Math.abs(at0.z) < EPS);

    for (const t of [0.3, 1.7, 5, p.period / 3, p.period * 2.25]) {
      const pos = planetPosition(p, t);
      const dist = Math.hypot(pos.x, pos.y, pos.z);
      assert.ok(Math.abs(dist - p.orbit) < EPS, `radius drift for ${p.name} at t=${t}`);
    }
  }
});

test('createClock advances by dt*speed and respects paused', () => {
  const clock = createClock();
  clock.advance(1);
  assert.equal(clock.t, 1);
  clock.speed = 3;
  clock.advance(1);
  assert.equal(clock.t, 4);
  clock.paused = true;
  clock.advance(5);
  assert.equal(clock.t, 4);
});

test('describe includes the planet name', () => {
  for (const p of PLANETS) {
    assert.ok(describe(p).includes(p.name));
  }
});

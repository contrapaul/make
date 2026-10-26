// e02s03t01: pure functions in js/tabs/random.js are Node-testable.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeRng, pickRandom, filterProjects } from '../js/tabs/random.js';

const P = [
  { id: 'p001-a', languages: ['js'], category: 'games', mode: 'online' },
  { id: 'p002-b', languages: ['python'], category: 'creative', mode: 'offline' },
  { id: 'p003-c', languages: ['js'], category: 'games', mode: 'either' },
  { id: 'p004-d', languages: ['python'], category: 'games', mode: 'offline' },
];

test('pickRandom: seeded draw is stable', () => {
  const a = pickRandom(P, null, makeRng(42)).record.id;
  const b = pickRandom(P, null, makeRng(42)).record.id;
  assert.equal(a, b);
  assert.ok(P.some(p => p.id === a));
});

test('pickRandom: avoids the last pick when the pool allows it', () => {
  // force deterministic: pick until we have a repeat-less run
  const ids = new Set();
  for (let i = 0; i < P.length * 3; i++) {
    const r = pickRandom(P, [...ids][ids.size - 1], makeRng(i + 1)).record;
    ids.add(r.id);
  }
  assert.ok(ids.size > 1, 'saw more than one distinct pick');
});

test('pickRandom: single-item pool returns it even when excluded', () => {
  const r = pickRandom([P[0]], P[0].id, makeRng(1));
  assert.equal(r.record.id, P[0].id);
  assert.equal(r.poolSize, 1);
});

test('pickRandom: empty pool yields null record', () => {
  assert.equal(pickRandom([], null, makeRng(1)).record, null);
});

test('filterProjects: each axis narrows, mode either matches both', () => {
  assert.equal(filterProjects(P, { language: 'js' }).length, 2);
  assert.equal(filterProjects(P, { category: 'games' }).length, 3);
  assert.equal(filterProjects(P, { mode: 'online' }).length, 2); // p001 + p003 (either)
  assert.equal(filterProjects(P, { mode: 'offline' }).length, 3); // p002, p003, p004
  assert.equal(filterProjects(P, { language: 'js', category: 'games', mode: 'online' }).length, 2);
  assert.equal(filterProjects(P, {}).length, 4);
});

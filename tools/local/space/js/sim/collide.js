// Collisions: ship<->ship, ship<->chunk, chunk<->chunk (overlap resolve +
// impulse + damage), missile<->ship / missile<->chunk (detonation).
// No broad-phase: entity counts are tiny.
import { HULLS } from '../data/hulls.js';
import { applyHit } from './damage.js';
import { emit } from './state.js';

const RESTITUTION = 0.3;
const CHUNK_K = 0.08; // collision-damage factor for chunks (mirrors hull.collisionK)

export function chunkMass(size) {
  return size * size * size * 2;
}

const shipBody = (s) => {
  const h = HULLS[s.hull];
  return { obj: s, r: h.radius, mass: h.mass, k: h.collisionK, isShip: true };
};
const chunkBody = (c) => ({ obj: c, r: c.size, mass: chunkMass(c.size), k: CHUNK_K, isShip: false });

export function stepCollisions(state, dt) {
  const pending = []; // damage applied after the full pass (no mutation while iterating)

  for (let i = 0; i < state.ships.length; i++) {
    const a = state.ships[i];
    if (!a.alive) continue;
    for (let j = i + 1; j < state.ships.length; j++) {
      const b = state.ships[j];
      if (b.alive) collide(state, shipBody(a), shipBody(b), pending);
    }
    for (const c of state.chunks) collide(state, shipBody(a), chunkBody(c), pending);
  }
  for (let i = 0; i < state.chunks.length; i++) {
    for (let j = i + 1; j < state.chunks.length; j++) {
      collide(state, chunkBody(state.chunks[i]), chunkBody(state.chunks[j]), pending);
    }
  }

  // Missiles detonate on first contact (ship of another team, or any chunk).
  for (let i = state.missiles.length - 1; i >= 0; i--) {
    const m = state.missiles[i];
    let hit = null;
    for (const s of state.ships) {
      if (s.alive && s.team !== m.team && dist(m, s) < HULLS[s.hull].radius + (m.radius || 4)) { hit = s; break; }
    }
    if (!hit) for (const c of state.chunks) if (dist(m, c) < c.size + (m.radius || 4)) { hit = c; break; }
    if (hit) {
      emit(state, { type: 'hit', point: { x: m.x, z: m.z }, kind: 'missile', damage: m.damage });
      applyHit(state, hit, m.damage, { team: m.team, kind: 'missile' });
      state.missiles.splice(i, 1);
    }
  }

  for (const { t, d } of pending) {
    applyHit(state, t, d, { kind: 'collision' });
    if (d > 0) emit(state, { type: 'hit', point: { x: t.x, z: t.z }, kind: 'collision', damage: d });
  }
}

function collide(state, A, B, pending) {
  const dx = B.obj.x - A.obj.x;
  const dz = B.obj.z - A.obj.z;
  const d = Math.hypot(dx, dz);
  const min = A.r + B.r;
  if (d >= min) return;
  const nx = d > 1e-6 ? dx / d : 1;
  const nz = d > 1e-6 ? dz / d : 0;

  // Positional separation, weighted by inverse mass.
  const invA = 1 / A.mass;
  const invB = 1 / B.mass;
  const wA = invA / (invA + invB);
  const overlap = min - d;
  A.obj.x -= nx * overlap * wA;
  A.obj.z -= nz * overlap * wA;
  B.obj.x += nx * overlap * (1 - wA);
  B.obj.z += nz * overlap * (1 - wA);

  // Impulse along the normal (only if approaching).
  const velN = (B.obj.vx - A.obj.vx) * nx + (B.obj.vz - A.obj.vz) * nz;
  if (velN < 0) {
    const j = (-(1 + RESTITUTION) * velN) / (invA + invB);
    A.obj.vx -= j * nx * invA;
    A.obj.vz -= j * nz * invA;
    B.obj.vx += j * nx * invB;
    B.obj.vz += j * nz * invB;
  }

  // Damage each party: K * relSpeed * otherMass / 1000.
  const relSpeed = Math.max(0, -velN);
  if (relSpeed > 0) {
    state.stats.collisions++;
    pending.push({ t: A.obj, d: A.k * relSpeed * B.mass / 1000 });
    pending.push({ t: B.obj, d: B.k * relSpeed * A.mass / 1000 });
  }
}

function dist(a, b) {
  return Math.hypot(b.x - a.x, b.z - a.z);
}

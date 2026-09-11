// Weapons sim: selection, aim arcs, cooldowns, projectiles, lance hitscan.
// Pure: no three, no DOM, rng from state.rng only.
import { WEAPONS } from '../data/weapons.js';
import { HULLS } from '../data/hulls.js';
import { applyHit } from './damage.js';

const EPS = 1e-9; // cooldown zero-crossing tolerance (keeps rate 15 exact at 60 Hz)
const TWO_PI = Math.PI * 2;

export function findHardpoint(hull, id) {
  return hull.hardpoints.find((hp) => hp.id === id);
}

export function selectMount(ship, id) {
  if (ship.mounts[id]) ship.selected = id;
  return ship.selected;
}

// dir: -1|0|1. Turret (arcHalf >= π) wraps; others clamp to arcCenter ± arcHalf.
export function rotateAim(ship, hull, id, dir, dt) {
  const mount = ship.mounts[id];
  if (!mount || dir === 0) return mount.aim;
  const hp = findHardpoint(hull, id);
  const wp = WEAPONS[hp.weapon];
  let aim = mount.aim + dir * wp.aimRate * dt;
  if (hp.arcHalf >= Math.PI - EPS) {
    let m = (aim - hp.arcCenter) % TWO_PI;
    if (m < 0) m += TWO_PI;
    aim = hp.arcCenter + m;
  } else {
    aim = Math.min(hp.arcCenter + hp.arcHalf, Math.max(hp.arcCenter - hp.arcHalf, aim));
  }
  mount.aim = aim;
  return aim;
}

// Absolute aim angle + muzzle world position (hardpoint offset in ship space:
// [forward, left]; left unit = (-sin h, cos h)).
export function worldAim(ship, hull, id) {
  const hp = findHardpoint(hull, id);
  const angle = ship.heading + ship.mounts[id].aim;
  const [fwd, left] = hp.offset;
  const cx = Math.cos(ship.heading);
  const sx = Math.sin(ship.heading);
  return {
    angle,
    x: ship.x + fwd * cx - left * sx,
    z: ship.z + fwd * sx + left * cx,
  };
}

export function tickCooldowns(ship, dt) {
  for (const id in ship.mounts) {
    const m = ship.mounts[id];
    if (m.cooldown > 0) m.cooldown = Math.max(0, m.cooldown - dt);
  }
}

// Returns null if cooling down; else the projectile (gun/cannon) or
// { beam, hit } record (lance).
export function tryFire(state, ship, hull, id) {
  const mount = ship.mounts[id];
  if (!mount || mount.cooldown > EPS) return null;
  const hp = findHardpoint(hull, id);
  const wp = WEAPONS[hp.weapon];
  const { angle, x, z } = worldAim(ship, hull, id);

  if (wp.kind === 'lance') {
    const targets = collectTargets(state, ship.team);
    const hit = hitscanCircles({ x, z }, angle, wp.range, targets);
    const end = hit
      ? hit.point
      : { x: x + Math.cos(angle) * wp.range, z: z + Math.sin(angle) * wp.range };
    const beam = { x0: x, z0: z, x1: end.x, z1: end.z, expires: state.time + wp.beamMs / 1000 };
    state.beams.push(beam);
    if (hit) {
      state.events.push({ type: 'hit', target: hit.target.ref, point: hit.point, kind: 'lance', damage: wp.damage });
    }
    mount.cooldown = wp.reload;
    bumpRounds(state, 'lance');
    return { beam, hit };
  }

  const a = angle + (state.rng.next() * 2 - 1) * wp.spread;
  const p = {
    id: state.nextId++,
    owner: ship.id,
    team: ship.team,
    kind: wp.kind,
    x,
    z,
    vx: Math.cos(a) * wp.speed,
    vz: Math.sin(a) * wp.speed,
    ttl: wp.ttl,
    damage: wp.damage,
  };
  state.projectiles.push(p);
  mount.cooldown = wp.kind === 'gun' ? 1 / wp.rate : wp.reload;
  bumpRounds(state, wp.kind);
  return p;
}

// Nearest target circle hit by the ray (origin, angle) within range; null if
// none. Behind (d <= 0) and out-of-range targets are ignored.
export function hitscanCircles(origin, angle, range, targets) {
  const dx = Math.cos(angle);
  const dz = Math.sin(angle);
  let best = null;
  for (const t of targets) {
    const rx = t.x - origin.x;
    const rz = t.z - origin.z;
    const d = rx * dx + rz * dz;
    if (d <= 0 || d > range) continue;
    const perp = Math.abs(rx * dz - rz * dx);
    if (perp > t.radius) continue;
    if (!best || d < best.d) {
      best = { d, target: t, point: { x: origin.x + dx * d, z: origin.z + dz * d } };
    }
  }
  return best ? { target: best.target, point: best.point } : null;
}

// Integrate, expire on ttl, circle-hit test vs ships/missiles/chunks.
export function stepProjectiles(state, dt) {
  const keep = [];
  for (const p of state.projectiles) {
    p.ttl -= dt;
    if (p.ttl <= 0) continue;
    p.x += p.vx * dt;
    p.z += p.vz * dt;
    const target = findHit(state, p);
    if (target) {
      state.events.push({ type: 'hit', point: { x: p.x, z: p.z }, kind: p.kind, damage: p.damage });
      applyHit(state, target, p.damage, { team: p.team, kind: p.kind });
      continue;
    }
    keep.push(p);
  }
  state.projectiles = keep;
}

export function expireBeams(state) {
  if (state.beams.length) state.beams = state.beams.filter((b) => b.expires > state.time);
}

function bumpRounds(state, kind) {
  state.stats.rounds = state.stats.rounds || {};
  state.stats.rounds[kind] = (state.stats.rounds[kind] || 0) + 1;
}

function collectTargets(state, team) {
  const out = [];
  for (const s of state.ships) {
    if (s.alive && s.team !== team) out.push({ x: s.x, z: s.z, radius: HULLS[s.hull].radius, ref: s });
  }
  for (const m of state.missiles) {
    if (m.team !== team) out.push({ x: m.x, z: m.z, radius: m.radius || 4, ref: m });
  }
  for (const c of state.chunks) {
    out.push({ x: c.x, z: c.z, radius: c.size, ref: c });
  }
  return out;
}

function findHit(state, p) {
  for (const s of state.ships) {
    if (!s.alive || s.team === p.team) continue;
    const r = HULLS[s.hull].radius;
    if (dist2(s, p) <= r * r) return s;
  }
  for (const m of state.missiles) {
    if (m.team === p.team) continue;
    const r = m.radius || 4;
    if (dist2(m, p) <= r * r) return m;
  }
  for (const c of state.chunks) {
    if (dist2(c, p) <= c.size * c.size) return c;
  }
  return null;
}

function dist2(a, b) {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return dx * dx + dz * dz;
}

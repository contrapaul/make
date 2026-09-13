// Entity factories + top-level game state. Plain data, no three, no DOM.
import { createRng } from './rng.js';
import { createStats } from './stats.js';

export function createShip(hull, { id = 1, x = 0, z = 0, heading = 0, team = 'blue', colors = null } = {}) {
  const mounts = {};
  for (const hp of hull.hardpoints) {
    mounts[hp.id] = { aim: hp.arcCenter, cooldown: 0, charge: 0 };
  }
  return {
    id,
    team,
    hull: hull.id,
    x,
    z,
    heading,
    vx: 0,
    vz: 0,
    angVel: 0,
    hp: hull.hp,
    mounts,
    selected: hull.hardpoints[0] ? hull.hardpoints[0].id : null,
    colors,
    alive: true,
  };
}

export function createState({ seed = 1 } = {}) {
  return {
    tick: 0,
    time: 0,
    rng: createRng(seed),
    ships: [],
    projectiles: [],
    missiles: [],
    chunks: [],
    beams: [],
    events: [],
    nextEventSeq: 1,
    bounds: { half: 1000 },
    nextId: 1,
    stats: createStats(),
  };
}

export function makeChunk(state, { x, z, vx = 0, vz = 0, size = 6, gen = 0, team = null }) {
  return {
    id: state.nextId++,
    x,
    z,
    vx,
    vz,
    size,
    gen,
    hp: size * 3,
    team,
    rot: state.rng.range(0, Math.PI * 2),
    angVel: state.rng.range(-1.2, 1.2),
    sx: state.rng.range(0.6, 1.4),
    sz: state.rng.range(0.6, 1.4),
  };
}

// Events get a monotonic seq so the renderer (pools, damage labels) can
// consume each one exactly once even when state.events outlives a frame.
export function emit(state, ev) {
  ev.seq = state.nextEventSeq++;
  state.events.push(ev);
  return ev;
}

export function spawnJunk(state, map) {
  const { count, sizeMin, sizeMax, spread } = map.junk;
  for (let i = 0; i < count; i++) {
    state.chunks.push(
      makeChunk(state, {
        x: state.rng.range(-spread, spread),
        z: state.rng.range(-spread, spread),
        size: state.rng.range(sizeMin, sizeMax),
        gen: 0,
      })
    );
  }
}

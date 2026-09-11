// Damage: weapon multipliers, HP, death → wreckage, chunk splitting, stats.
import { WEAPONS } from '../data/weapons.js';
import { makeChunk } from './state.js';

const isShip = (t) => t.hull !== undefined;
const isChunk = (t) => t.size !== undefined; // ships have hull, missiles have neither

function playerTeamOf(state) {
  const p = state.ships.find((s) => s.id === state.playerId);
  return p ? p.team : null;
}

// source = { team, kind } where kind is a WEAPONS key or 'collision'/'missile'.
export function applyHit(state, target, amount, source = {}) {
  const mult = multiplierFor(source, target);
  const dmg = amount * mult;
  if (target.hp !== undefined) target.hp -= dmg;

  const playerTeam = playerTeamOf(state);
  if (target.team === playerTeam) state.stats.damageTaken += dmg;
  else if (target.team) state.stats.damageDealt += dmg;
  if (source.team === playerTeam && source.kind && state.stats.hits[source.kind] !== undefined) {
    state.stats.hits[source.kind]++;
  }
  if (source.kind === 'collision') state.stats.collisionDamage += dmg;

  if (target.hp === undefined || target.hp > 0) return; // still alive

  if (isShip(target)) killShip(state, target, source);
  else if (isChunk(target)) killChunk(state, target, source);
  else {
    state.stats.missilesIntercepted++;
    const i = state.missiles.indexOf(target);
    if (i >= 0) state.missiles.splice(i, 1);
  }
}

function multiplierFor(source, target) {
  if (!source.kind || !WEAPONS[source.kind]) return 1;
  const wp = WEAPONS[source.kind];
  if (target.hp !== undefined && !isShip(target) && !isChunk(target) && wp.vsMissile) return wp.vsMissile;
  if (isChunk(target) && wp.vsChunk) return wp.vsChunk;
  return 1;
}

function killShip(state, ship, source) {
  ship.alive = false;
  const n = state.rng.int(4, 6);
  for (let i = 0; i < n; i++) {
    const size = state.rng.range(5, 12);
    state.chunks.push(
      makeChunk(state, {
        x: ship.x + state.rng.range(-8, 8),
        z: ship.z + state.rng.range(-8, 8),
        vx: ship.vx + state.rng.range(-8, 8),
        vz: ship.vz + state.rng.range(-8, 8),
        size,
        gen: 0,
        team: ship.team,
      })
    );
  }
  if (source.team === playerTeamOf(state)) state.stats.kills++;
}

// Cannon/lance kill + gen<2 + size>5 → 2-3 smaller chunks (total < original);
// otherwise removed and counted.
function killChunk(state, chunk, source) {
  if ((source.kind === 'cannon' || source.kind === 'lance') && chunk.gen < 2 && chunk.size > 5) {
    const i = state.chunks.indexOf(chunk);
    if (i >= 0) state.chunks.splice(i, 1);
    const n = state.rng.int(2, 3);
    for (let i = 0; i < n; i++) {
      const size = ((chunk.size * 0.7) / n) * state.rng.range(0.8, 1.2);
      state.chunks.push(
        makeChunk(state, {
          x: chunk.x + state.rng.range(-2, 2),
          z: chunk.z + state.rng.range(-2, 2),
          vx: chunk.vx + state.rng.range(-6, 6),
          vz: chunk.vz + state.rng.range(-6, 6),
          size,
          gen: chunk.gen + 1,
          team: chunk.team,
        })
      );
    }
  } else {
    state.stats.debrisDestroyed++;
    const i = state.chunks.indexOf(chunk);
    if (i >= 0) state.chunks.splice(i, 1);
  }
}

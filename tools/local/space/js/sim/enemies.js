// Enemies: straight-line drift + timed missile launcher. NOT AI — no pursuit,
// no lead, no evasion. Missiles aim at the player's *current* position.
import { createShip } from './state.js';

export function spawnEnemies(state, map, hull) {
  for (const e of map.enemies) {
    const ship = createShip(hull, {
      id: state.nextId++,
      team: e.team || 'red',
      x: e.x,
      z: e.z,
      heading: e.heading || 0,
    });
    ship.drift = e.drift || null;
    ship.launcherSpec = e.launcher || null;
    ship.launcherTimer = 0;
    state.ships.push(ship);
  }
}

export function stepEnemies(state, dt) {
  const player = state.ships.find((s) => s.id === state.playerId);
  for (const ship of state.ships) {
    if (ship.id === state.playerId || !ship.alive) continue;
    if (ship.drift) {
      ship.x += ship.drift.vx * dt;
      ship.z += ship.drift.vz * dt;
    }
    const spec = ship.launcherSpec;
    if (!spec) continue;
    ship.launcherTimer += dt;
    if (ship.launcherTimer < spec.period) continue;
    if (!player || !player.alive) { ship.launcherTimer = 0; continue; }
    ship.launcherTimer -= spec.period;
    const dx = player.x - ship.x;
    const dz = player.z - ship.z;
    const d = Math.hypot(dx, dz) || 1;
    state.missiles.push({
      id: state.nextId++,
      team: ship.team,
      x: ship.x,
      z: ship.z,
      vx: (dx / d) * spec.speed,
      vz: (dz / d) * spec.speed,
      ttl: spec.ttl,
      hp: spec.hp,
      damage: spec.damage,
      radius: 4,
    });
  }
}

export function stepMissiles(state, dt) {
  for (let i = state.missiles.length - 1; i >= 0; i--) {
    const m = state.missiles[i];
    m.ttl -= dt;
    if (m.ttl <= 0) {
      state.missiles.splice(i, 1);
      continue;
    }
    m.x += m.vx * dt;
    m.z += m.vz * dt;
  }
}

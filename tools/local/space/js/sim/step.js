// Fixed-step simulation entry.
// Order: input → player physics → enemies → all ship physics/bounds →
// chunks drift → weapons/projectiles → missiles → collisions →
// damage/cleanup → stats → end condition.
import { HULLS } from '../data/hulls.js';
import { stepShip, applyBounds, stepChunks } from './physics.js';
import { selectMount, rotateAim, tickCooldowns, tryFire, stepProjectiles, expireBeams } from './weapons.js';
import { stepEnemies, stepMissiles } from './enemies.js';
import { stepCollisions } from './collide.js';
import { accumulateDistance } from './stats.js';

export function step(state, input, dt) {
  const player = state.ships.find((s) => s.id === state.playerId) || state.ships[0];
  const hull = HULLS[player.hull];

  if (input.select) selectMount(player, input.select);
  if (input.aim) rotateAim(player, hull, player.selected, input.aim, dt);

  // Player physics with input, then everyone else with none (drift is applied
  // by stepEnemies as direct position changes).
  stepShip(player, hull, input, dt);
  applyBounds(player, state.bounds, dt);

  stepEnemies(state, dt);

  for (const ship of state.ships) {
    if (ship.id === player.id || !ship.alive) continue;
    stepShip(ship, HULLS[ship.hull], { thrust: 0, turn: 0 }, dt);
    applyBounds(ship, state.bounds, dt);
  }

  stepChunks(state, dt);

  tickCooldowns(player, dt);
  if (input.fire) tryFire(state, player, hull, player.selected);
  stepProjectiles(state, dt);
  expireBeams(state);

  stepMissiles(state, dt);
  stepCollisions(state, dt);

  accumulateDistance(state.stats, player, dt);
  state.stats.time = state.time;
  updateOver(state);

  state.events.length = 0; // consumed by the renderer this frame
  state.tick += 1;
  state.time += dt;
}

export function updateOver(state) {
  const player = state.ships.find((s) => s.id === state.playerId);
  if (!player) return;
  const enemies = state.ships.filter((s) => s.id !== state.playerId);
  state.over = !player.alive || (enemies.length > 0 && enemies.every((s) => !s.alive));
}

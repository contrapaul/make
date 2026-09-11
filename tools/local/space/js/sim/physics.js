// Ship motion: thrust, turn, damping, soft arena bounds. Pure, no three/DOM.
// Tuning numbers come from the hull definition (js/data/hulls.js).
//
// input = { thrust: -1|0|1, turn: -1|0|1 }

// Acceleration per unit of overshoot past the soft edge (half - 100).
const BOUNDS_STRENGTH = 2;

export function stepShip(ship, hull, input, dt) {
  input = input || { thrust: 0, turn: 0 };

  // Linear thrust along the forward vector (cos h, sin h).
  if (input.thrust !== 0) {
    const dir = input.thrust > 0 ? 1 : -1;
    const power = hull.thrust * (dir > 0 ? 1 : hull.reverseFactor);
    const a = (power * 1000) / hull.mass;
    ship.vx += Math.cos(ship.heading) * a * dir * dt;
    ship.vz += Math.sin(ship.heading) * a * dir * dt;
  } else {
    const k = Math.exp(-hull.linearDamping * dt);
    ship.vx *= k;
    ship.vz *= k;
  }

  // Angular: accelerate, clamp to maxTurn, integrate.
  if (input.turn !== 0) {
    ship.angVel += input.turn * hull.turnAccel * dt;
  } else {
    ship.angVel *= Math.exp(-hull.angularDamping * dt);
  }
  if (ship.angVel > hull.maxTurn) ship.angVel = hull.maxTurn;
  if (ship.angVel < -hull.maxTurn) ship.angVel = -hull.maxTurn;
  ship.heading += ship.angVel * dt;

  clampSpeed(ship, hull);
  ship.x += ship.vx * dt;
  ship.z += ship.vz * dt;
}

// Soft edge: beyond half-100, push inward proportional to overshoot.
export function applyBounds(ship, bounds, dt) {
  const edge = bounds.half - 100;
  if (Math.abs(ship.x) > edge) {
    const over = Math.abs(ship.x) - edge;
    ship.vx -= Math.sign(ship.x) * over * BOUNDS_STRENGTH * dt;
  }
  if (Math.abs(ship.z) > edge) {
    const over = Math.abs(ship.z) - edge;
    ship.vz -= Math.sign(ship.z) * over * BOUNDS_STRENGTH * dt;
  }
}

export function speedOf(ship) {
  return Math.hypot(ship.vx, ship.vz);
}

// Chunks drift, tumble, and slowly damp out.
const CHUNK_DAMPING = 0.1;

export function stepChunks(state, dt) {
  const k = Math.exp(-CHUNK_DAMPING * dt);
  for (const c of state.chunks) {
    c.x += c.vx * dt;
    c.z += c.vz * dt;
    c.rot += c.angVel * dt;
    c.vx *= k;
    c.vz *= k;
    c.angVel *= k;
  }
}

function clampSpeed(ship, hull) {
  const s = speedOf(ship);
  if (s > hull.maxSpeed) {
    const k = hull.maxSpeed / s;
    ship.vx *= k;
    ship.vz *= k;
  }
}

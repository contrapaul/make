// Stat counters + end-of-game summary. Pure.
export function createStats() {
  return {
    damageDealt: 0,
    damageTaken: 0,
    rounds: { gun: 0, cannon: 0, lance: 0 },
    hits: { gun: 0, cannon: 0, lance: 0 },
    missilesIntercepted: 0,
    kills: 0,
    collisions: 0,
    collisionDamage: 0,
    distance: 0,
    debrisDestroyed: 0,
    time: 0,
  };
}

export function accumulateDistance(stats, ship, dt) {
  stats.distance += Math.hypot(ship.vx, ship.vz) * dt;
}

export function summary(stats) {
  const rows = [
    { label: 'Time', value: Math.floor(stats.time / 60) + ':' + String(Math.floor(stats.time % 60)).padStart(2, '0') },
    { label: 'Distance', value: stats.distance.toFixed(0) + ' u' },
    { label: 'Kills', value: String(stats.kills) },
    { label: 'Missiles intercepted', value: String(stats.missilesIntercepted) },
    { label: 'Debris destroyed', value: String(stats.debrisDestroyed) },
    { label: 'Collisions', value: String(stats.collisions) },
    { label: 'Collision damage', value: stats.collisionDamage.toFixed(0) },
    { label: 'Damage dealt', value: stats.damageDealt.toFixed(0) },
    { label: 'Damage taken', value: stats.damageTaken.toFixed(0) },
  ];
  for (const k of ['gun', 'cannon', 'lance']) {
    const r = stats.rounds[k] || 0;
    const h = stats.hits[k] || 0;
    const acc = r ? (100 * h) / r : 0;
    rows.push({ label: k + ' rounds / hits', value: r + ' / ' + h + (r ? ' (' + acc.toFixed(0) + '%)' : '') });
  }
  return rows;
}

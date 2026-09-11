// Weapon definitions. rate = rounds/s while held (gun); reload = s between
// shots. vsX = damage multipliers (cannon overkills missiles/chunks).
export const WEAPONS = {
  gun: { kind: 'gun', damage: 2, rate: 15, aimRate: 2.09, speed: 420, ttl: 1.4, spread: 0.03, vsMissile: 1.5 },
  cannon: { kind: 'cannon', damage: 40, reload: 1.2, aimRate: 1.05, speed: 260, ttl: 2.5, spread: 0.01, vsMissile: 10, vsChunk: 3 },
  lance: { kind: 'lance', damage: 250, reload: 6, aimRate: 0.26, range: 420, beamMs: 120 },
};

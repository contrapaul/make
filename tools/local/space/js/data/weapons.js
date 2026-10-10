// Weapon definitions. rate = rounds/s while held (gun); reload = s between
// shots. vsX = damage multipliers (cannon overkills missiles/chunks).
export const WEAPONS = {
  // M7 tune: gun 2@15 → 3@18 (2 felt like sparks; 18 streams while tracking);
  // cannon reload 1.2 → 1.0 (1.2 felt dead between shots).
  gun: { kind: 'gun', damage: 3, rate: 18, aimRate: 2.09, speed: 420, ttl: 1.4, spread: 0.03, vsMissile: 1.5 },
  cannon: { kind: 'cannon', damage: 40, reload: 1.0, aimRate: 1.05, speed: 260, ttl: 2.5, spread: 0.01, vsMissile: 10, vsChunk: 3 },
  lance: { kind: 'lance', damage: 250, reload: 6, aimRate: 0.26, range: 420, beamMs: 120, charge: 1.2 },
};

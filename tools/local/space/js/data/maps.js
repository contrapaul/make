// Map definitions. Enemy launcher config is a spawner, not AI.
export const MAPS = {
  skirmish: {
    id: 'skirmish',
    seed: 20250,
    player: { x: 0, z: 400, heading: 0 },
    enemies: [
      {
        x: -200, z: -150, heading: 0.6,
        drift: { vx: 8, vz: 0 },
        launcher: { period: 7, speed: 70, ttl: 9, damage: 120, hp: 5 },
      },
      {
        x: 250, z: -300, heading: -1.2,
        drift: null,
        launcher: { period: 7, speed: 70, ttl: 9, damage: 120, hp: 5 },
      },
      {
        x: 60, z: -450, heading: 2.4,
        drift: { vx: 0, vz: -6 },
        launcher: { period: 7, speed: 70, ttl: 9, damage: 120, hp: 5 },
      },
    ],
    junk: { count: 12, sizeMin: 4, sizeMax: 10, spread: 700 },
  },
};

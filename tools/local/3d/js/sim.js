// Pure orbital math + planet data. No three.js import (unit-tested in Node).

const TWO_PI = Math.PI * 2;

export const PLANETS = [
  { name: 'Ember',   radius: 1.1, orbit: 8,  period: 6,  color: 0xff6b3d, tilt: 0.12 },
  { name: 'Cobalt',  radius: 1.6, orbit: 12, period: 12, color: 0x3d6bff, tilt: 0.05 },
  { name: 'Verdant', radius: 0.9, orbit: 17, period: 20, color: 0x43c97b, tilt: 0.22 },
  { name: 'Amber',   radius: 2.2, orbit: 22, period: 30, color: 0xffc24b, tilt: 0.08 },
  { name: 'Violet',  radius: 0.7, orbit: 28, period: 45, color: 0xa06bff, tilt: 0.30 },
  { name: 'Frost',   radius: 1.3, orbit: 34, period: 60, color: 0x9fd8ff, tilt: 0.18 },
];

export function orbitAngle(planet, tSeconds) {
  return (TWO_PI * tSeconds / planet.period) % TWO_PI;
}

export function planetPosition(planet, tSeconds) {
  const angle = orbitAngle(planet, tSeconds);
  const x = planet.orbit * Math.cos(angle);
  const z = planet.orbit * Math.sin(angle);
  // Rotate the XZ-plane circle about the X axis by the orbit tilt.
  return {
    x,
    y: z * Math.sin(planet.tilt),
    z: z * Math.cos(planet.tilt),
  };
}

export function createClock() {
  return {
    t: 0,
    speed: 1,
    paused: false,
    advance(dtSeconds) {
      if (!this.paused) this.t += dtSeconds * this.speed;
    },
  };
}

export function describe(planet) {
  return [
    planet.name,
    `orbit radius: ${planet.orbit}`,
    `period: ${planet.period}s`,
    `radius: ${planet.radius}`,
  ].join('\n');
}

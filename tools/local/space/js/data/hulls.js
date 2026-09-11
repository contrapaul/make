// Hull definitions. All gameplay tuning for a hull lives here.
// offset = [forward, left] in ship space; angles in radians.

export const TEAM_COLORS = {
  blue: { primary: 0x8fa8c8, accent: 0x3fa9ff, glow: 0x59d8ff },
  red: { primary: 0xb08a8a, accent: 0xff5a4d, glow: 0xff7a59 },
};

export const HULLS = {
  corvette: {
    id: 'corvette',
    name: 'Corvette',
    length: 40,
    radius: 14,
    mass: 1200,
    hp: 600,
    thrust: 180,
    reverseFactor: 0.4,
    maxSpeed: 60,
    turnAccel: 2.0, // M7: snappier A/D response; 1.6 felt mushy
    maxTurn: 1.0, // M7: a touch faster hard turns — evading missiles needs it
    linearDamping: 0.35,
    angularDamping: 2.5,
    collisionK: 0.06, // M7: ramming should hurt, not nearly kill (was 0.08)
    hardpoints: [
      { id: 'turret', weapon: 'gun', offset: [0, 0], arcCenter: 0, arcHalf: Math.PI },
      { id: 'port', weapon: 'cannon', offset: [0, 8], arcCenter: Math.PI / 2, arcHalf: 0.61 },
      { id: 'stbd', weapon: 'cannon', offset: [0, -8], arcCenter: -Math.PI / 2, arcHalf: 0.61 },
      { id: 'lance', weapon: 'lance', offset: [18, 0], arcCenter: 0, arcHalf: 0.087 },
    ],
  },
};

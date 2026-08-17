/** Tunable gameplay numbers, per plans.md §4.1. Nothing here is derived. */

export const PLAYER = {
  maxBreath: 40,
  moveSpeed: 4.0, // meters/second
  radius: 0.35, // collision circle
  eyeHeight: 1.6,
};

export const BREATH = {
  max: 40,
  rechargeTimeFullFromEmptySeconds: 1.6,
  autoRechargeDelayAfterStopFiringSeconds: 2.0,
};

/** 40 breath over 1.6 s. Partial refills therefore take proportionally less. */
export const BREATH_RECHARGE_PER_SECOND = BREATH.max / BREATH.rechargeTimeFullFromEmptySeconds;

export const WORLD = {
  cellSizeMeters: 1.0,
  /** Not specified in plans.md; picked to read as a corridor at 1.6 m eye height. */
  wallHeightMeters: 3.0,
};

export const INPUT = {
  /** Radians per pixel of mouse movement at sensitivity 1.0 (plans.md §18). */
  lookScaleRadiansPerPixel: 0.002,
  /** Phase 5 replaces this with the saved setting (0.25x–3.0x). */
  mouseSensitivity: 1.0,
  pitchLimitRadians: (85 * Math.PI) / 180,
};

/** Gold hit particles, plans.md §9. */
export const PARTICLES = {
  maxActive: 2048,
  normalHitCount: [12, 28],
  weakPointHitCount: [30, 70],
  lifetimeSeconds: [0.35, 0.9],
  sizeMeters: [0.04, 0.16],
  colorPrimary: 0xffd700,
  colorSecondary: 0xffaa00,
  /** Not specified; tuned so a burst reads as a spray rather than a puff. */
  speedMeters: [1.5, 5.5],
  dragPerSecond: 2.4,
  gravityMeters: 4.0,
};

/** Gold "blood" decals, plans.md §9. */
export const DECALS = {
  maxPerLevel: 128,
  textureCount: 4,
  minScaleMeters: 0.5,
  maxScaleMeters: 1.5,
  offsetFromSurfaceMeters: 0.01,
  maxDistanceMeters: 3.0,
  minOpacity: 0.75,
  maxOpacity: 0.95,
};

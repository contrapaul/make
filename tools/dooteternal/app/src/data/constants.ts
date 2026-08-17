/** Tunable gameplay numbers, per plans.md §4.1. Nothing here is derived. */

export const PLAYER = {
  maxBreath: 40,
  moveSpeed: 4.0, // meters/second
  radius: 0.35, // collision circle
  eyeHeight: 1.6,
  /**
   * Not in plans.md, which gives the player no health at all despite enemies
   * dealing 3–25 damage. 100 with a restart on death, no pickups or regen.
   */
  maxHp: 100,
  /** Grace period after a hit, so a swarm can't chain-stun you to death. */
  damageImmunitySeconds: 0.4,
};

/** Enemy behaviour, plans.md §20. The spec gives no ranges for these. */
export const ENEMY_AI = {
  /** How far an enemy notices the player, given line of sight. */
  detectionRangeMeters: 18,
  /** Ranged types hold roughly this fraction of their range as spacing. */
  preferredRangeFraction: 0.65,
  /** Brief flinch on being hit, per the HIT_STUN state in §20. */
  hitStunSeconds: 0.08,
  /** Enemies stop this far short of the player rather than standing inside them. */
  personalSpaceMeters: 0.15,
  /**
   * Dead band around the preferred range, so enemies don't jitter in place.
   * It has to stay well inside a melee type's reach: if an enemy stops moving
   * further out than it can swing, it stalls forever without ever attacking.
   */
  approachToleranceMeters: 0.15,
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

/** Keys, doors and the exit portal, plans.md §14. */
export const LEVEL_FLOW = {
  keyPickupRangeMeters: 1.0,
  /** How close you must be for a matching key to swing a door open. */
  doorOpenRangeMeters: 1.6,
  exitRangeMeters: 1.0,
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

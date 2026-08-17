/** Tunable gameplay numbers, per plans.md §4.1. Nothing here is derived. */

export const PLAYER = {
  maxBreath: 40,
  moveSpeed: 4.0, // metres/second
  radius: 0.35, // collision circle
  eyeHeight: 1.6,
};

export const WORLD = {
  cellSizeMetres: 1.0,
  /** Not specified in plans.md; picked to read as a corridor at 1.6 m eye height. */
  wallHeightMetres: 3.0,
};

export const INPUT = {
  /** Radians per pixel of mouse movement at sensitivity 1.0 (plans.md §18). */
  lookScaleRadiansPerPixel: 0.002,
  /** Phase 5 replaces this with the saved setting (0.25x–3.0x). */
  mouseSensitivity: 1.0,
  pitchLimitRadians: (85 * Math.PI) / 180,
};

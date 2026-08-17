import { ENEMY_AI } from '../data/constants';
import type { EnemyType } from './EnemySystem';

/**
 * How far an enemy wants to stand from the player (plans.md §20: melee types
 * close in, ranged types "maintain preferred distance"). The spec gives no
 * numbers, so this derives them from each type's own reach.
 *
 * Kept apart from EnemySystem, which can't load outside a browser because it
 * builds canvas textures — this way the policy stays checkable.
 */
export function preferredRange(type: EnemyType): number {
  // Melee types stop well inside their reach, not at the edge of it: stopping at
  // the edge leaves them a hair too far to swing and they never attack at all.
  if (type.melee.enabled) return Math.max(type.melee.rangeMeters * 0.6, ENEMY_AI.personalSpaceMeters);
  if (type.ranged.enabled) return type.ranged.rangeMeters * ENEMY_AI.preferredRangeFraction;

  return ENEMY_AI.personalSpaceMeters;
}

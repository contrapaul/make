/**
 * Overkill tiers, plans.md §10.
 *
 * The spec's formula takes `damageDealt` without saying whether that's the
 * killing blow or the running total. Cumulative would rate every slow trumpet
 * kill as overkill, since three 9-damage hits on a 20 HP enemy already exceed
 * its health — so this uses the killing blow, which is what "overkill" describes.
 */
export type OverkillTier = 0 | 1 | 2;

export function getOverkillTier(killingBlowDamage: number, enemyMaxHp: number): OverkillTier {
  const ratio = killingBlowDamage / enemyMaxHp;

  if (ratio < 1.0) return 0; // normal kill
  if (ratio < 2.5) return 1; // heavy overkill
  return 2; // extreme overkill
}

import { BREATH, BREATH_RECHARGE_PER_SECOND } from '../data/constants';

/**
 * Breath is the ammo for every weapon (plans.md §5). It refills when the player
 * runs dry, after two seconds without firing, or on demand with R — and firing
 * cancels a manual refill.
 */
export class BreathSystem {
  breath = BREATH.max;
  /** True while refilling; drives the HUD now and the breath loop in Phase 3. */
  recharging = false;

  private secondsSinceLastShot = Number.POSITIVE_INFINITY;
  private manualRecharge = false;
  /**
   * Once a refill starts it runs to full. The predicate in plans.md §5 is
   * evaluated per frame, so `breath <= 0` stops being true after the very first
   * frame of refilling and the tank would stall a hair above empty instead of
   * filling in 1.6 s. Latching is what actually produces the documented timing.
   */
  private latched = false;

  /** Restores a saved value (plans.md §16). */
  set(value: number): void {
    this.breath = Math.min(BREATH.max, Math.max(0, value));
  }

  canSpend(cost: number): boolean {
    return this.breath >= cost;
  }

  spend(cost: number): void {
    this.breath = Math.max(0, this.breath - cost);
    this.secondsSinceLastShot = 0;
    this.manualRecharge = false;
    this.latched = false;
    this.recharging = false;
  }

  /** The R key. Runs until breath is full or the player fires again. */
  requestManualRecharge(): void {
    this.manualRecharge = true;
  }

  update(dt: number, firing: boolean): void {
    this.secondsSinceLastShot += dt;

    // Holding the trigger suspends refilling, and drops any manual request.
    if (firing) {
      this.manualRecharge = false;
      this.latched = false;
      this.recharging = false;
      return;
    }

    if (!this.latched && this.shouldStartRecharge()) this.latched = true;

    this.recharging = this.latched && this.breath < BREATH.max;
    if (!this.recharging) return;

    this.breath = Math.min(BREATH.max, this.breath + BREATH_RECHARGE_PER_SECOND * dt);

    if (this.breath >= BREATH.max) {
      this.latched = false;
      this.manualRecharge = false;
    }
  }

  private shouldStartRecharge(): boolean {
    const fromEmpty = this.breath <= 0;
    const afterStopFiring = this.secondsSinceLastShot >= BREATH.autoRechargeDelayAfterStopFiringSeconds;

    return fromEmpty || afterStopFiring || this.manualRecharge;
  }
}

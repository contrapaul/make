import { PLAYER } from '../data/constants';

/**
 * Player health. plans.md gives the player none — no HP, no death, no pickups —
 * while specifying enemies that deal 3–25 damage and a player_hurt sound, so
 * this fills the gap at the scope agreed for the tech demo: 100 HP, a brief
 * immunity window after each hit, and a level restart on death.
 */
export class PlayerHealth {
  hp = PLAYER.maxHp;
  /** Set on the frame a hit lands, for the screen flash and hurt sound. */
  justHurt = false;
  dead = false;

  private immunityRemaining = 0;

  get immune(): boolean {
    return this.immunityRemaining > 0;
  }

  /** Returns true if the hit actually landed rather than being shrugged off. */
  damage(amount: number): boolean {
    if (this.dead || this.immune || amount <= 0) return false;

    this.hp = Math.max(0, this.hp - amount);
    this.immunityRemaining = PLAYER.damageImmunitySeconds;
    this.justHurt = true;
    if (this.hp === 0) this.dead = true;

    return true;
  }

  update(dt: number): void {
    this.justHurt = false;
    if (this.immunityRemaining > 0) this.immunityRemaining = Math.max(0, this.immunityRemaining - dt);
  }

  reset(): void {
    this.hp = PLAYER.maxHp;
    this.dead = false;
    this.justHurt = false;
    this.immunityRemaining = 0;
  }
}

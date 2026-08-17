import * as THREE from 'three';
import weaponsJson from '../data/weapons.json';
import type { BreathSystem } from './BreathSystem';
import type { ProjectileSystem } from './ProjectileSystem';

/** Weapon stats, plans.md §6. */
export interface WeaponDef {
  id: string;
  name: string;
  breathCostPerShot: number;
  shotsPerClick: number;
  fireDelaySeconds: number;
  continuousFire: boolean;
  spreadBaseRadians: number;
  projectileType: string;
  projectileSpeedMetersPerSecond: number;
  damage: number;
  rangeMeters: number;
  audioMode: string;
  audioFiles: string[];
}

const WEAPONS = weaponsJson as unknown as Record<string, WeaponDef>;

/**
 * Trigger handling for the trumpet (plans.md §6.1): one shot per click, 0.3 s
 * between shots, minimal spread. The tuba, saxophone and guitar join in Phase 3,
 * which is when weapon switching and firing audio arrive.
 */
export class WeaponSystem {
  readonly current: WeaponDef;

  private cooldownRemaining = 0;

  constructor(
    private readonly projectiles: ProjectileSystem,
    private readonly breath: BreathSystem,
  ) {
    this.current = WEAPONS.trumpet!;
  }

  get cooldown(): number {
    return this.cooldownRemaining;
  }

  /** Out of breath rather than mid-cooldown — the HUD reads differently. */
  get starved(): boolean {
    return !this.breath.canSpend(this.current.breathCostPerShot);
  }

  /**
   * `firePressed` is the click edge, not the held state: a non-continuous weapon
   * must not keep firing while the button is down.
   */
  update(dt: number, firePressed: boolean, origin: THREE.Vector3, direction: THREE.Vector3): void {
    this.cooldownRemaining = Math.max(0, this.cooldownRemaining - dt);

    if (!firePressed || this.cooldownRemaining > 0) return;
    if (!this.breath.canSpend(this.current.breathCostPerShot)) return;

    this.breath.spend(this.current.breathCostPerShot);
    this.cooldownRemaining = this.current.fireDelaySeconds;

    for (let shot = 0; shot < this.current.shotsPerClick; shot += 1) {
      this.projectiles.spawn({
        origin,
        direction: withSpread(direction, this.current.spreadBaseRadians),
        speedMetersPerSecond: this.current.projectileSpeedMetersPerSecond,
        damage: this.current.damage,
        rangeMeters: this.current.rangeMeters,
      });
    }
  }
}

/** Random direction within a cone, distributed evenly across the disc. */
export function withSpread(direction: THREE.Vector3, spreadRadians: number): THREE.Vector3 {
  const aim = direction.clone().normalize();
  if (spreadRadians <= 0) return aim;

  const reference = Math.abs(aim.y) < 0.99 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const right = new THREE.Vector3().crossVectors(aim, reference).normalize();
  const up = new THREE.Vector3().crossVectors(right, aim).normalize();

  const angle = Math.random() * Math.PI * 2;
  const radius = Math.sqrt(Math.random()) * Math.tan(spreadRadians);

  return aim
    .addScaledVector(right, Math.cos(angle) * radius)
    .addScaledVector(up, Math.sin(angle) * radius)
    .normalize();
}

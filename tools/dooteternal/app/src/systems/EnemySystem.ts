import * as THREE from 'three';
import enemyTypesJson from '../data/enemies.json';
import { corpseTexture, enemyTexture } from '../core/PlaceholderAssets';
import { cellCentre, type LevelData } from '../core/LevelLoader';
import type { DecalSystem } from './DecalSystem';
import type { ParticleSystem } from './ParticleSystem';
import { PARTICLES } from '../data/constants';

/** Enemy stats, plans.md §7.1. */
export interface WeakPoint {
  /** Meters from the enemy's centre, which sits at heightMeters / 2. */
  offset: [number, number, number];
  radiusMeters: number;
  damageMultiplier: number;
}

export interface EnemyType {
  name: string;
  hp: number;
  speedMetersPerSecond: number;
  radiusMeters: number;
  /** Added to the spec's stat block: billboards need a height to size against. */
  heightMeters: number;
  label: string;
  bodyColor: string;
  weakPoint: WeakPoint;
  melee: { enabled: boolean; damage: number; rangeMeters: number; cooldownSeconds: number; windupSeconds: number };
  ranged: {
    enabled: boolean;
    damage: number;
    projectileSpeedMetersPerSecond: number;
    rangeMeters: number;
    cooldownSeconds: number;
    chargeTelegraphSeconds?: number;
    aoeRadiusMeters?: number;
  };
}

export interface HitResult {
  damageDealt: number;
  weakPoint: boolean;
  killed: boolean;
}

const ENEMY_TYPES = enemyTypesJson as unknown as Record<string, EnemyType>;

interface Enemy {
  id: string;
  type: EnemyType;
  /** Floor position; the sprite is centred at heightMeters / 2 above it. */
  position: THREE.Vector3;
  hp: number;
  sprite: THREE.Sprite;
}

/**
 * Enemies as camera-facing billboards with a body hitbox and a weak point
 * sphere (plans.md §7–§8). Movement and attacks arrive in Phase 4; for now they
 * stand where the level put them and can be shot to pieces.
 */
export class EnemySystem {
  readonly group = new THREE.Group();

  private readonly enemies: Enemy[] = [];
  private readonly aliveTextures = new Map<string, THREE.CanvasTexture>();
  private readonly corpseTextures = new Map<string, THREE.CanvasTexture>();
  private corpses = 0;

  constructor(
    level: LevelData,
    private readonly particles: ParticleSystem,
    private readonly decals: DecalSystem,
  ) {
    level.enemies.forEach((spawn, index) => {
      const type = ENEMY_TYPES[spawn.type];
      if (!type) {
        throw new Error(`Unknown enemy type "${spawn.type}". Known: ${Object.keys(ENEMY_TYPES).join(', ')}`);
      }

      this.add(`enemy_${spawn.type}_${index}`, type, spawn.x, spawn.y);
    });
  }

  get aliveCount(): number {
    return this.enemies.length;
  }

  get corpseCount(): number {
    return this.corpses;
  }

  /**
   * Tests a projectile against every living enemy, applying damage to the first
   * one it overlaps. Returns the hit so the caller can retire the projectile.
   */
  tryHit(
    position: THREE.Vector3,
    direction: THREE.Vector3,
    projectileRadius: number,
    damage: number,
  ): HitResult | null {
    for (let i = 0; i < this.enemies.length; i += 1) {
      const enemy = this.enemies[i]!;
      const weakPointHit = this.hitsWeakPoint(enemy, position, direction, projectileRadius);

      if (!weakPointHit && !this.hitsBody(enemy, position, projectileRadius)) continue;

      const weak = enemy.type.weakPoint;
      const damageDealt = weakPointHit ? damage * weak.damageMultiplier : damage;
      enemy.hp -= damageDealt;

      const outward = position.clone().sub(this.centre(enemy));
      if (outward.lengthSq() < 1e-6) outward.set(0, 1, 0);
      outward.normalize();

      const killed = enemy.hp <= 0;
      if (killed) {
        this.kill(i, position, outward);
      } else {
        this.particles.burst(position, outward, randomCount(weakPointHit ? PARTICLES.weakPointHitCount : PARTICLES.normalHitCount));
        // Body hits spit less, so they only sometimes reach a surface.
        if (weakPointHit || Math.random() < 0.4) this.decals.splatter(position, 1);
      }

      return { damageDealt, weakPoint: weakPointHit, killed };
    }

    return null;
  }

  private add(id: string, type: EnemyType, cellX: number, cellY: number): void {
    const centre = cellCentre(cellX, cellY);
    const position = new THREE.Vector3(centre.x, 0, centre.z);

    let texture = this.aliveTextures.get(type.label);
    if (!texture) {
      // Draw the weak point where the data says it is, measured down from the top.
      const fromTop = 1 - (type.heightMeters / 2 + type.weakPoint.offset[1]) / type.heightMeters;
      texture = enemyTexture(type.label, type.bodyColor, fromTop);
      this.aliveTextures.set(type.label, texture);
    }

    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
    sprite.scale.set(type.radiusMeters * 2, type.heightMeters, 1);
    sprite.position.set(position.x, type.heightMeters / 2, position.z);

    this.group.add(sprite);
    this.enemies.push({ id, type, position, hp: type.hp, sprite });
  }

  private kill(index: number, impact: THREE.Vector3, outward: THREE.Vector3): void {
    const enemy = this.enemies[index]!;
    this.enemies.splice(index, 1);

    this.group.remove(enemy.sprite);
    enemy.sprite.material.dispose();

    // Generic death for now: weapon-specific presets and overkill tiers are Phase 3.
    this.particles.burst(this.centre(enemy), outward, randomCount(PARTICLES.weakPointHitCount));
    this.particles.burst(this.centre(enemy), new THREE.Vector3(0, 1, 0), 24);
    this.decals.splatter(impact, 3);

    this.addCorpse(enemy);
  }

  private addCorpse(enemy: Enemy): void {
    let texture = this.corpseTextures.get(enemy.type.label);
    if (!texture) {
      texture = corpseTexture(enemy.type.bodyColor);
      this.corpseTextures.set(enemy.type.label, texture);
    }

    const height = enemy.type.heightMeters * 0.35;
    const corpse = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
    corpse.scale.set(enemy.type.radiusMeters * 2.2, height, 1);
    corpse.position.set(enemy.position.x, height / 2, enemy.position.z);

    this.group.add(corpse);
    this.corpses += 1;
  }

  private centre(enemy: Enemy): THREE.Vector3 {
    return new THREE.Vector3(enemy.position.x, enemy.type.heightMeters / 2, enemy.position.z);
  }

  /**
   * Tests the shot's remaining path against the weak point rather than its
   * current point. The body cylinder is wider than the weak point sphere, so a
   * projectile always touches the body first: a point test would report every
   * dead-centre shot as a body hit and the 2x multiplier would be unreachable.
   */
  private hitsWeakPoint(
    enemy: Enemy,
    position: THREE.Vector3,
    direction: THREE.Vector3,
    projectileRadius: number,
  ): boolean {
    const weak = enemy.type.weakPoint;
    const reach = weak.radiusMeters + projectileRadius;

    const target = this.centre(enemy).add(new THREE.Vector3().fromArray(weak.offset));
    const toTarget = target.clone().sub(position);

    // How far along the shot the weak point sits, never behind it and never
    // further than the enemy is tall.
    const along = Math.min(Math.max(toTarget.dot(direction), 0), enemy.type.heightMeters);
    const closest = position.clone().addScaledVector(direction, along);

    return closest.distanceToSquared(target) <= reach * reach;
  }

  /** Upright cylinder: billboards read as columns, not spheres. */
  private hitsBody(enemy: Enemy, position: THREE.Vector3, projectileRadius: number): boolean {
    const reach = enemy.type.radiusMeters + projectileRadius;
    const dx = position.x - enemy.position.x;
    const dz = position.z - enemy.position.z;

    if (dx * dx + dz * dz > reach * reach) return false;

    return position.y >= -projectileRadius && position.y <= enemy.type.heightMeters + projectileRadius;
  }
}

function randomCount(range: number[]): number {
  const min = range[0]!;
  const max = range[1]!;
  return Math.floor(min + Math.random() * (max - min + 1));
}

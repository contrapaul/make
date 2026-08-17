import * as THREE from 'three';
import { WORLD } from '../data/constants';
import { noteTexture } from '../core/PlaceholderAssets';
import type { CollisionSystem } from '../core/CollisionSystem';
import type { EnemySystem } from './EnemySystem';

/**
 * Pooled projectiles (plans.md §19). Every weapon is projectile-based, so this
 * is the only path from a trigger pull to damage — nothing is hitscan.
 *
 * Movement is substepped: a 28 m/s note covers 0.45 m per frame at 60 fps and
 * 2.8 m on a clamped 100 ms frame, either of which could step clean over a
 * 0.9 m-wide enemy or through a 1 m wall in a single test.
 */
const MAX_SUBSTEP_METERS = 0.2;

/** Not specified in plans.md; sized to the note sprite so hits look fair. */
const DEFAULT_RADIUS_METERS = 0.12;

interface Projectile {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  radiusMeters: number;
  damage: number;
  lifetimeSeconds: number;
  ageSeconds: number;
  sprite: THREE.Sprite;
}

export interface ProjectileSpawn {
  origin: THREE.Vector3;
  direction: THREE.Vector3;
  speedMetersPerSecond: number;
  damage: number;
  rangeMeters: number;
  radiusMeters?: number;
}

export class ProjectileSystem {
  readonly group = new THREE.Group();

  private readonly live: Projectile[] = [];
  private readonly idle: Projectile[] = [];
  private readonly texture = noteTexture();
  private readonly scratchHeading = new THREE.Vector3();

  constructor(
    private readonly collision: CollisionSystem,
    private readonly enemies: EnemySystem,
  ) {}

  get activeCount(): number {
    return this.live.length;
  }

  spawn(spawn: ProjectileSpawn): void {
    const projectile = this.claim();

    projectile.position.copy(spawn.origin);
    projectile.velocity.copy(spawn.direction).normalize().multiplyScalar(spawn.speedMetersPerSecond);
    projectile.radiusMeters = spawn.radiusMeters ?? DEFAULT_RADIUS_METERS;
    projectile.damage = spawn.damage;
    projectile.lifetimeSeconds = spawn.rangeMeters / spawn.speedMetersPerSecond;
    projectile.ageSeconds = 0;

    projectile.sprite.position.copy(spawn.origin);
    projectile.sprite.visible = true;

    this.live.push(projectile);
  }

  update(dt: number): void {
    for (let i = this.live.length - 1; i >= 0; i -= 1) {
      const projectile = this.live[i]!;
      projectile.ageSeconds += dt;

      if (projectile.ageSeconds >= projectile.lifetimeSeconds || this.advance(projectile, dt)) {
        this.retire(i);
        continue;
      }

      projectile.sprite.position.copy(projectile.position);
    }
  }

  /** Moves in small steps; returns true when the projectile should be retired. */
  private advance(projectile: Projectile, dt: number): boolean {
    const travel = projectile.velocity.length() * dt;
    const steps = Math.max(1, Math.ceil(travel / MAX_SUBSTEP_METERS));
    const stepDt = dt / steps;
    const heading = this.scratchHeading.copy(projectile.velocity).normalize();

    for (let step = 0; step < steps; step += 1) {
      projectile.position.addScaledVector(projectile.velocity, stepDt);

      if (this.hitsGeometry(projectile.position)) return true;
      if (this.enemies.tryHit(projectile.position, heading, projectile.radiusMeters, projectile.damage)) return true;
    }

    return false;
  }

  private hitsGeometry(position: THREE.Vector3): boolean {
    if (position.y <= 0 || position.y >= WORLD.wallHeightMeters) return true;

    return this.collision.isSolid(Math.floor(position.x), Math.floor(position.z));
  }

  private claim(): Projectile {
    const pooled = this.idle.pop();
    if (pooled) return pooled;

    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.texture,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    sprite.scale.setScalar(0.3);
    this.group.add(sprite);

    return {
      position: new THREE.Vector3(),
      velocity: new THREE.Vector3(),
      radiusMeters: DEFAULT_RADIUS_METERS,
      damage: 0,
      lifetimeSeconds: 0,
      ageSeconds: 0,
      sprite,
    };
  }

  private retire(index: number): void {
    const projectile = this.live[index]!;
    projectile.sprite.visible = false;
    this.live.splice(index, 1);
    this.idle.push(projectile);
  }
}

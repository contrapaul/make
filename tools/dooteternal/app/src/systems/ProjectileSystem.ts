import * as THREE from 'three';
import { PLAYER, WORLD } from '../data/constants';
import { noteTexture } from '../core/PlaceholderAssets';
import type { CollisionSystem } from '../core/CollisionSystem';
import type { EnemySystem } from './EnemySystem';

/**
 * Pooled projectiles (plans.md §19). Every weapon is projectile-based, so this
 * is the only path from a trigger pull to damage — nothing is hitscan. Enemy
 * shots travel the same way, just aimed the other direction.
 *
 * Movement is substepped: a 28 m/s note covers 0.45 m per frame at 60 fps and
 * 2.8 m on a clamped 100 ms frame, either of which could step clean over a
 * 0.9 m-wide enemy or through a 1 m wall in a single test.
 */
const MAX_SUBSTEP_METERS = 0.2;

/** Not specified in plans.md; sized to the note sprite so hits look fair. */
const DEFAULT_RADIUS_METERS = 0.12;

const PLAYER_SHOT_COLOR = 0xffffff;
const ENEMY_SHOT_COLOR = 0xff5a4a;

export type ProjectileOwner = 'player' | 'enemy';

/** What an enemy shot needs to know about its target. */
export interface PlayerTarget {
  /** Eye position; the body is taken to run from the floor to just above it. */
  position: THREE.Vector3;
  radiusMeters: number;
  damage(amount: number): boolean;
}

interface Projectile {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  radiusMeters: number;
  damage: number;
  lifetimeSeconds: number;
  ageSeconds: number;
  weaponId: string;
  owner: ProjectileOwner;
  sprite: THREE.Sprite;
}

export interface ProjectileSpawn {
  origin: THREE.Vector3;
  direction: THREE.Vector3;
  speedMetersPerSecond: number;
  damage: number;
  rangeMeters: number;
  /** Which weapon fired it, so a kill can pick the right death preset. */
  weaponId: string;
  radiusMeters?: number;
  owner?: ProjectileOwner;
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
    private readonly player: PlayerTarget,
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
    projectile.weaponId = spawn.weaponId;
    projectile.owner = spawn.owner ?? 'player';

    projectile.sprite.material.color.setHex(
      projectile.owner === 'enemy' ? ENEMY_SHOT_COLOR : PLAYER_SHOT_COLOR,
    );
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

      if (projectile.owner === 'enemy') {
        if (this.hitsPlayer(projectile)) return true;
        continue;
      }

      const hit = this.enemies.tryHit(
        projectile.position,
        heading,
        projectile.radiusMeters,
        projectile.damage,
        projectile.weaponId,
      );
      if (hit) return true;
    }

    return false;
  }

  private hitsPlayer(projectile: Projectile): boolean {
    const reach = this.player.radiusMeters + projectile.radiusMeters;
    const dx = projectile.position.x - this.player.position.x;
    const dz = projectile.position.z - this.player.position.z;

    if (dx * dx + dz * dz > reach * reach) return false;
    if (projectile.position.y < 0 || projectile.position.y > PLAYER.eyeHeight + 0.2) return false;

    // Retire the shot either way: it struck the player, immune or not.
    this.player.damage(projectile.damage);
    return true;
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
      weaponId: '',
      owner: 'player',
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

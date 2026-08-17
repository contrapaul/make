import * as THREE from 'three';
import enemyTypesJson from '../data/enemies.json';
import { corpseTexture, enemyTexture } from '../core/PlaceholderAssets';
import { cellCentre, type LevelData } from '../core/LevelLoader';
import type { DecalSystem } from './DecalSystem';
import type { ParticleSystem } from './ParticleSystem';
import { ENEMY_AI, PARTICLES } from '../data/constants';
import { getOverkillTier } from './Overkill';
import { deathPreset, type BurstPattern, type DeathEffectSink, type DeathPreset } from './DeathEffects';
import type { DamageAtDistance } from './BlastSystem';
import type { BlastSink, ProjectileSink } from './WeaponSystem';
import type { CollisionSystem } from '../core/CollisionSystem';
import type { PlayerTarget } from './ProjectileSystem';
import { preferredRange } from './EnemyTactics';

/**
 * Enemy states, plans.md §20. SPAWNING is unused (enemies start placed), and
 * DYING/CORPSE collapse into a single frame: death swaps the sprite for a corpse
 * immediately, since there are no death animation frames to play through yet.
 */
export type EnemyState = 'IDLE' | 'CHASE' | 'CHARGING' | 'ATTACK_WINDUP' | 'ATTACK_RECOVER' | 'HIT_STUN';

/** Telegraph for AoE attacks, so a shockwave can be walked out of (§20). */
const AOE_TELEGRAPH_SECONDS = 0.6;
const ENEMY_SHOT_COLOR = 0xff7a5a;

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
  state: EnemyState;
  /** Counts down the current state, where the state is timed. */
  stateSeconds: number;
  attackCooldown: number;
  /** Where an AoE was aimed when its telegraph started. */
  aoeTarget: THREE.Vector3 | null;
}

/**
 * Enemies as camera-facing billboards with a body hitbox, a weak point sphere
 * (plans.md §7–§8) and the state machine from §20: notice the player, close to
 * their preferred range, then attack on a cooldown.
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
    private readonly effects: DeathEffectSink,
    private readonly collision: CollisionSystem,
    private readonly player: PlayerTarget,
    private readonly projectiles: ProjectileSink,
    private readonly blasts: BlastSink,
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

  /** Drives every living enemy's state machine (plans.md §20). */
  update(dt: number): void {
    for (const enemy of this.enemies) {
      enemy.attackCooldown = Math.max(0, enemy.attackCooldown - dt);
      enemy.stateSeconds = Math.max(0, enemy.stateSeconds - dt);

      const centre = this.centre(enemy);
      const distance = Math.hypot(this.player.position.x - enemy.position.x, this.player.position.z - enemy.position.z);
      const canSee = this.collision.hasLineOfSight(centre, this.player.position);

      switch (enemy.state) {
        case 'IDLE':
          if (canSee && distance <= ENEMY_AI.detectionRangeMeters) enemy.state = 'CHASE';
          break;

        case 'HIT_STUN':
        case 'ATTACK_RECOVER':
          if (enemy.stateSeconds === 0) enemy.state = 'CHASE';
          break;

        case 'CHASE':
          this.move(enemy, dt, distance);
          this.considerAttack(enemy, distance, canSee);
          break;

        case 'CHARGING':
          // Held in place while the wind-up plays, then released.
          if (enemy.stateSeconds === 0) this.releaseRangedAttack(enemy);
          break;

        case 'ATTACK_WINDUP':
          if (enemy.stateSeconds === 0) this.landMeleeAttack(enemy, distance);
          break;
      }

      this.updateSprite(enemy);
    }
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
    weaponId: string,
  ): HitResult | null {
    for (let i = 0; i < this.enemies.length; i += 1) {
      const enemy = this.enemies[i]!;
      const weakPointHit = this.hitsWeakPoint(enemy, position, direction, projectileRadius);

      if (!weakPointHit && !this.hitsBody(enemy, position, projectileRadius)) continue;

      const weak = enemy.type.weakPoint;
      const damageDealt = weakPointHit ? damage * weak.damageMultiplier : damage;

      const outward = position.clone().sub(this.centre(enemy));
      if (outward.lengthSq() < 1e-6) outward.set(0, 1, 0);
      outward.normalize();

      const killed = this.applyDamage(i, damageDealt, position, outward, weaponId);
      if (!killed) {
        this.particles.burst(
          position,
          outward,
          randomCount(weakPointHit ? PARTICLES.weakPointHitCount : PARTICLES.normalHitCount),
        );
        // Body hits spit less, so they only sometimes reach a surface.
        if (weakPointHit || Math.random() < 0.4) this.decals.splatter(position, 1);
      }

      return { damageDealt, weakPoint: weakPointHit, killed };
    }

    return null;
  }

  /**
   * Area damage from an expanding blast — the tuba's wave and the guitar's
   * sequenced bursts. `alreadyHit` is the blast's own record, so a wave front
   * that keeps growing can't hit the same enemy twice.
   */
  damageSphere(
    centre: THREE.Vector3,
    radiusMeters: number,
    damageAt: DamageAtDistance,
    alreadyHit: Set<string>,
    weaponId: string,
  ): void {
    for (let i = this.enemies.length - 1; i >= 0; i -= 1) {
      const enemy = this.enemies[i]!;
      if (alreadyHit.has(enemy.id)) continue;

      const enemyCentre = this.centre(enemy);
      const distance = enemyCentre.distanceTo(centre) - enemy.type.radiusMeters;
      if (distance > radiusMeters) continue;

      alreadyHit.add(enemy.id);

      const damage = damageAt(Math.max(0, distance));
      if (damage <= 0) continue;

      const outward = enemyCentre.clone().sub(centre);
      if (outward.lengthSq() < 1e-6) outward.set(0, 1, 0);
      outward.normalize();

      const killed = this.applyDamage(i, damage, enemyCentre, outward, weaponId);
      if (!killed) {
        this.particles.burst(enemyCentre, outward, randomCount(PARTICLES.normalHitCount));
        this.decals.splatter(enemyCentre, 1);
      }
    }
  }

  /** Returns true when the hit was fatal. */
  private applyDamage(
    index: number,
    damage: number,
    impact: THREE.Vector3,
    outward: THREE.Vector3,
    weaponId: string,
  ): boolean {
    const enemy = this.enemies[index]!;
    enemy.hp -= damage;

    if (enemy.hp > 0) {
      // Flinch, but never interrupt an attack that has already been committed.
      if (enemy.state === 'CHASE' || enemy.state === 'IDLE') {
        enemy.state = 'HIT_STUN';
        enemy.stateSeconds = ENEMY_AI.hitStunSeconds;
      }
      return false;
    }

    this.kill(index, damage, impact, outward, weaponId);
    return true;
  }

  /** Closes to the range this type prefers, and backs off if crowded. */
  private move(enemy: Enemy, dt: number, distance: number): void {
    const desired = preferredRange(enemy.type);
    const tolerance = ENEMY_AI.approachToleranceMeters;

    let towards = 0;
    if (distance > desired + tolerance) towards = 1;
    else if (distance < desired - tolerance) towards = -1;
    if (towards === 0) return;

    const dx = this.player.position.x - enemy.position.x;
    const dz = this.player.position.z - enemy.position.z;
    const length = Math.hypot(dx, dz);
    if (length < 1e-4) return;

    const step = enemy.type.speedMetersPerSecond * dt * towards;
    const resolved = this.collision.resolve(
      enemy.position.x + (dx / length) * step,
      enemy.position.z + (dz / length) * step,
      enemy.type.radiusMeters,
    );

    enemy.position.x = resolved.x;
    enemy.position.z = resolved.z;
  }

  /** Starts a melee wind-up or a ranged shot if one is off cooldown. */
  private considerAttack(enemy: Enemy, distance: number, canSee: boolean): void {
    if (enemy.attackCooldown > 0) return;

    const { melee, ranged } = enemy.type;

    if (melee.enabled && distance <= melee.rangeMeters) {
      enemy.state = 'ATTACK_WINDUP';
      enemy.stateSeconds = melee.windupSeconds;
      return;
    }

    if (!ranged.enabled || !canSee || distance > ranged.rangeMeters) return;

    // Charged and AoE attacks telegraph first so they can be reacted to.
    const telegraph = ranged.chargeTelegraphSeconds ?? (ranged.aoeRadiusMeters ? AOE_TELEGRAPH_SECONDS : 0);

    if (ranged.aoeRadiusMeters) {
      // Lock the target where the player stood when the wind-up began.
      enemy.aoeTarget = new THREE.Vector3(this.player.position.x, 0.9, this.player.position.z);
    }

    if (telegraph > 0) {
      enemy.state = 'CHARGING';
      enemy.stateSeconds = telegraph;
      return;
    }

    this.releaseRangedAttack(enemy);
  }

  private releaseRangedAttack(enemy: Enemy): void {
    const { ranged } = enemy.type;
    const centre = this.centre(enemy);

    if (ranged.aoeRadiusMeters) {
      const target = enemy.aoeTarget ?? new THREE.Vector3(this.player.position.x, 0.9, this.player.position.z);
      this.blasts.spawn({
        centre: target,
        maxRadiusMeters: ranged.aoeRadiusMeters,
        expansionSeconds: 0.45,
        color: ENEMY_SHOT_COLOR,
        orientation: 'horizontal',
        target: 'player',
        damageAt: () => ranged.damage,
      });
      enemy.aoeTarget = null;
    } else {
      this.projectiles.spawn({
        origin: centre,
        direction: this.player.position.clone().sub(centre).normalize(),
        speedMetersPerSecond: ranged.projectileSpeedMetersPerSecond,
        damage: ranged.damage,
        rangeMeters: ranged.rangeMeters,
        weaponId: `enemy_${enemy.type.label.toLowerCase()}`,
        owner: 'enemy',
      });
    }

    enemy.attackCooldown = ranged.cooldownSeconds;
    enemy.state = 'ATTACK_RECOVER';
    enemy.stateSeconds = 0.25;
  }

  /** Melee only connects if the player is still inside reach when it lands. */
  private landMeleeAttack(enemy: Enemy, distance: number): void {
    const { melee } = enemy.type;
    if (distance <= melee.rangeMeters + 0.2) this.player.damage(melee.damage);

    enemy.attackCooldown = melee.cooldownSeconds;
    enemy.state = 'ATTACK_RECOVER';
    enemy.stateSeconds = 0.25;
  }

  /** Keeps the billboard on its feet, and shows a charge as a swelling glow. */
  private updateSprite(enemy: Enemy): void {
    const height = enemy.type.heightMeters;
    enemy.sprite.position.set(enemy.position.x, height / 2, enemy.position.z);

    if (enemy.state === 'CHARGING') {
      const pulse = 1 + Math.sin(performance.now() * 0.02) * 0.08;
      enemy.sprite.scale.set(enemy.type.radiusMeters * 2 * pulse, height * pulse, 1);
      enemy.sprite.material.color.setHex(0xffdf9a);
      return;
    }

    enemy.sprite.scale.set(enemy.type.radiusMeters * 2, height, 1);
    enemy.sprite.material.color.setHex(0xffffff);
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
    this.enemies.push({
      id,
      type,
      position,
      hp: type.hp,
      sprite,
      state: 'IDLE',
      stateSeconds: 0,
      attackCooldown: 0,
      aoeTarget: null,
    });
  }

  /** Death, dressed by the killing weapon and the overkill tier (plans.md §10). */
  private kill(
    index: number,
    killingBlowDamage: number,
    impact: THREE.Vector3,
    outward: THREE.Vector3,
    weaponId: string,
  ): void {
    const enemy = this.enemies[index]!;
    this.enemies.splice(index, 1);

    this.group.remove(enemy.sprite);
    enemy.sprite.material.dispose();

    const tier = getOverkillTier(killingBlowDamage, enemy.type.hp);
    const preset = deathPreset(weaponId, tier);
    const centre = this.centre(enemy);

    const count = Math.round(randomCount(PARTICLES.weakPointHitCount) * preset.burstScale);
    this.burstFor(preset.pattern, centre, outward, count);

    if (preset.emberCount > 0) {
      // Embers drift rather than spray: straight up, tightly grouped.
      this.particles.burst(centre, new THREE.Vector3(0, 1, 0), preset.emberCount, 0.25);
    }

    for (let ring = 0; ring < preset.ringCount; ring += 1) {
      // Staggered sizes stand in for the guitar's three timed bursts.
      const scale = 1 + ring * 0.45;
      this.effects.ring(centre, preset.ringRadiusMeters * scale, preset.ringColor, 0.22 + ring * 0.12);
    }

    if (preset.shake > 0) this.effects.shake(preset.shake);

    this.decals.splatter(impact, 3 + preset.extraDecals);
    this.addCorpse(enemy, preset);
  }

  private burstFor(pattern: BurstPattern, centre: THREE.Vector3, outward: THREE.Vector3, count: number): void {
    if (pattern === 'up') {
      this.particles.burst(centre, new THREE.Vector3(0, 1, 0), count, 0.3);
      return;
    }

    if (pattern === 'horizontal') {
      const flat = new THREE.Vector3(outward.x, 0, outward.z);
      if (flat.lengthSq() < 1e-6) flat.set(1, 0, 0);
      this.particles.burst(centre, flat.normalize(), count, 0.35);
      return;
    }

    // Radial: no bias at all, so directions come out evenly spread.
    this.particles.burst(centre, new THREE.Vector3(), count, 1);
  }

  private addCorpse(enemy: Enemy, preset: DeathPreset): void {
    let texture = this.corpseTextures.get(enemy.type.label);
    if (!texture) {
      texture = corpseTexture(enemy.type.bodyColor);
      this.corpseTextures.set(enemy.type.label, texture);
    }

    const height = enemy.type.heightMeters * 0.35 * preset.corpseFlatten;
    const corpse = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
    corpse.material.color.setHex(preset.corpseTint);
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

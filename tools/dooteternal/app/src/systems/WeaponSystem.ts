import * as THREE from 'three';
import weaponsJson from '../data/weapons.json';
import type { BlastSpec } from './BlastSystem';
import type { ProjectileSpawn } from './ProjectileSystem';
import type { AudioSink } from './AudioManager';
import type { BreathSystem } from './BreathSystem';

/** Weapon stats, plans.md §6. `projectileType` says which family a weapon is. */
interface WeaponCommon {
  id: string;
  name: string;
  breathCostPerShot: number;
  shotsPerClick: number;
  fireDelaySeconds: number;
  continuousFire: boolean;
  audioMode: 'random' | 'loop_restart_on_new_burst' | 'sequence';
  audioFiles: string[];
}

export interface ProjectileWeapon extends WeaponCommon {
  projectileType: 'trumpet_note' | 'sax_note';
  projectileSpeedMetersPerSecond: number;
  damage: number;
  rangeMeters: number;
  spreadBaseRadians: number;
  /** Saxophone only: spread widens while the trigger is held (§6.3). */
  spreadGrowthPerSecond?: number;
  spreadMaxRadians?: number;
  spreadResetSeconds?: number;
}

export interface WaveWeapon extends WeaponCommon {
  projectileType: 'tuba_wave';
  waveStartRadiusMeters: number;
  waveMaxRadiusMeters: number;
  waveExpansionTimeSeconds: number;
  maxEffectiveRangeMeters: number;
  baseDamageClose: number;
}

export interface GuitarBlast {
  delaySeconds: number;
  targetDistanceMeters: number;
  explosionRadiusMeters: number;
  damage: number;
  audioIndex: number;
}

export interface SequenceWeapon extends WeaponCommon {
  projectileType: 'guitar_wave_sequence';
  blasts: GuitarBlast[];
}

export type WeaponDef = ProjectileWeapon | WaveWeapon | SequenceWeapon;

/** Narrow seams so firing logic can be exercised without a renderer. */
export interface ProjectileSink {
  spawn(spawn: ProjectileSpawn): void;
}

export interface BlastSink {
  spawn(spec: BlastSpec): void;
}

export interface Walls {
  isSolid(cellX: number, cellY: number): boolean;
}

const WEAPONS = weaponsJson as unknown as Record<string, WeaponDef>;

/** Selection order for keys 1–4 and the mouse wheel (plans.md §18). */
export const WEAPON_ORDER = ['trumpet', 'tuba', 'saxophone', 'electric_guitar'] as const;

const SAX_LOOP_ID = 'saxophone_fire';
const SAX_LOOP_FADE_SECONDS = 0.1;
const GUITAR_BLAST_COLOR = 0xc060ff;
const TUBA_WAVE_COLOR = 0xffc040;

/**
 * The tuba's wave rolls out at waist height rather than from the eye. A flat
 * ring centred on the camera is edge-on to it and therefore invisible — the
 * player would never see their own blast. This height also sits level with enemy
 * centres, so the falloff distance is effectively horizontal.
 */
const TUBA_WAVE_HEIGHT_METERS = 0.9;

/** Tuba falloff, plans.md §6.2: full damage at the muzzle, nothing past range. */
export function tubaDamage(def: WaveWeapon, distanceMeters: number): number {
  if (distanceMeters > def.maxEffectiveRangeMeters) return 0;

  const falloff = Math.max(0, 1 - distanceMeters / def.maxEffectiveRangeMeters);
  return def.baseDamageClose * falloff;
}

interface PendingBlast {
  blast: GuitarBlast;
  remainingSeconds: number;
  origin: THREE.Vector3;
  direction: THREE.Vector3;
  audioFiles: string[];
}

export class WeaponSystem {
  private currentId: string = WEAPON_ORDER[0];
  private cooldownRemaining = 0;
  /** How long the trigger has been held, which is what widens sax spread. */
  private burstSeconds = 0;
  private idleSeconds = Number.POSITIVE_INFINITY;
  private loopPlaying = false;
  private readonly pending: PendingBlast[] = [];

  constructor(
    private readonly projectiles: ProjectileSink,
    private readonly blasts: BlastSink,
    private readonly breath: BreathSystem,
    private readonly audio: AudioSink,
    private readonly walls: Walls,
  ) {}

  get current(): WeaponDef {
    return WEAPONS[this.currentId]!;
  }

  get cooldown(): number {
    return this.cooldownRemaining;
  }

  get starved(): boolean {
    return !this.breath.canSpend(this.current.breathCostPerShot);
  }

  /** Current cone half-angle; only the saxophone's grows (§6.3). */
  get spreadRadians(): number {
    const def = this.current;
    if (!('spreadBaseRadians' in def)) return 0;

    const growth = def.spreadGrowthPerSecond ?? 0;
    const max = def.spreadMaxRadians ?? def.spreadBaseRadians;
    return Math.min(def.spreadBaseRadians + growth * this.burstSeconds, max);
  }

  select(id: string): void {
    if (!WEAPONS[id] || id === this.currentId) return;

    this.stopBurstAudio();
    this.currentId = id;
    this.burstSeconds = 0;
    this.cooldownRemaining = 0;
  }

  cycle(steps: number): void {
    const index = WEAPON_ORDER.indexOf(this.currentId as (typeof WEAPON_ORDER)[number]);
    const next = (index + steps + WEAPON_ORDER.length * 8) % WEAPON_ORDER.length;
    this.select(WEAPON_ORDER[next]!);
  }

  /** Returns true on the frames a shot actually leaves the instrument. */
  update(
    dt: number,
    firePressed: boolean,
    fireHeld: boolean,
    origin: THREE.Vector3,
    direction: THREE.Vector3,
  ): boolean {
    this.cooldownRemaining = Math.max(0, this.cooldownRemaining - dt);
    this.advancePending(dt);

    const def = this.current;
    const wantsToFire = def.continuousFire ? fireHeld : firePressed;

    if (wantsToFire) {
      this.idleSeconds = 0;
      this.burstSeconds += dt;
    } else {
      this.idleSeconds += dt;
      if (this.idleSeconds >= spreadResetSeconds(def)) this.burstSeconds = 0;
      this.stopBurstAudio();
    }

    if (!wantsToFire || this.cooldownRemaining > 0) return false;
    if (!this.breath.canSpend(def.breathCostPerShot)) {
      this.stopBurstAudio();
      return false;
    }

    this.breath.spend(def.breathCostPerShot);
    this.cooldownRemaining = def.fireDelaySeconds;
    this.fire(def, origin, direction);
    return true;
  }

  private fire(def: WeaponDef, origin: THREE.Vector3, direction: THREE.Vector3): void {
    switch (def.projectileType) {
      case 'trumpet_note':
      case 'sax_note':
        this.fireProjectiles(def, origin, direction);
        break;
      case 'tuba_wave':
        this.fireWave(def, origin);
        break;
      case 'guitar_wave_sequence':
        this.fireSequence(def, origin, direction);
        break;
    }
  }

  private fireProjectiles(def: ProjectileWeapon, origin: THREE.Vector3, direction: THREE.Vector3): void {
    const spread = this.spreadRadians;

    for (let shot = 0; shot < def.shotsPerClick; shot += 1) {
      this.projectiles.spawn({
        origin,
        direction: withSpread(direction, spread),
        speedMetersPerSecond: def.projectileSpeedMetersPerSecond,
        damage: def.damage,
        rangeMeters: def.rangeMeters,
        weaponId: def.id,
      });
    }

    if (def.audioMode === 'loop_restart_on_new_burst') {
      // One loop per burst: started here, restarted only after a release.
      if (!this.loopPlaying) {
        this.audio.startLoop(SAX_LOOP_ID, def.audioFiles[0]!);
        this.loopPlaying = true;
      }
    } else {
      this.audio.playOneOf(def.audioFiles);
    }
  }

  private fireWave(def: WaveWeapon, origin: THREE.Vector3): void {
    const centre = origin.clone();
    centre.y = TUBA_WAVE_HEIGHT_METERS;

    this.blasts.spawn({
      centre,
      startRadiusMeters: def.waveStartRadiusMeters,
      maxRadiusMeters: def.waveMaxRadiusMeters,
      expansionSeconds: def.waveExpansionTimeSeconds,
      color: TUBA_WAVE_COLOR,
      orientation: 'horizontal',
      weaponId: def.id,
      damageAt: (distance) => tubaDamage(def, distance),
    });

    this.audio.playOneOf(def.audioFiles);
  }

  /** Queues the three blasts; `advancePending` releases them on their delays. */
  private fireSequence(def: SequenceWeapon, origin: THREE.Vector3, direction: THREE.Vector3): void {
    for (const blast of def.blasts) {
      this.pending.push({
        blast,
        remainingSeconds: blast.delaySeconds,
        origin: origin.clone(),
        direction: direction.clone().normalize(),
        audioFiles: def.audioFiles,
      });
    }

    this.advancePending(0); // the first blast has no delay
  }

  private advancePending(dt: number): void {
    for (let i = this.pending.length - 1; i >= 0; i -= 1) {
      const queued = this.pending[i]!;
      queued.remainingSeconds -= dt;

      if (queued.remainingSeconds > 0) continue;

      this.pending.splice(i, 1);
      this.releaseBlast(queued);
    }
  }

  private releaseBlast(queued: PendingBlast): void {
    const { blast } = queued;
    const centre = this.clampToWall(queued.origin, queued.direction, blast.targetDistanceMeters);

    this.blasts.spawn({
      centre,
      maxRadiusMeters: blast.explosionRadiusMeters,
      expansionSeconds: 0.18,
      color: GUITAR_BLAST_COLOR,
      weaponId: 'electric_guitar',
      damageAt: () => blast.damage,
    });

    this.audio.playOne(queued.audioFiles[blast.audioIndex]!);
  }

  /** Stops the aimed blast short of geometry so it can't detonate behind a wall. */
  private clampToWall(origin: THREE.Vector3, direction: THREE.Vector3, distance: number): THREE.Vector3 {
    const step = 0.25;
    const point = origin.clone();
    const probe = origin.clone();

    for (let travelled = step; travelled <= distance; travelled += step) {
      probe.copy(origin).addScaledVector(direction, travelled);
      if (this.walls.isSolid(Math.floor(probe.x), Math.floor(probe.z))) break;
      point.copy(probe);
    }

    return point;
  }

  private stopBurstAudio(): void {
    if (!this.loopPlaying) return;

    this.audio.stopLoop(SAX_LOOP_ID, SAX_LOOP_FADE_SECONDS);
    this.loopPlaying = false;
  }
}

function spreadResetSeconds(def: WeaponDef): number {
  return 'spreadResetSeconds' in def ? (def.spreadResetSeconds ?? 0.5) : 0.5;
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

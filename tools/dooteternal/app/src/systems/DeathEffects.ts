import type * as THREE from 'three';
import type { OverkillTier } from './Overkill';

/**
 * Weapon-specific death presets, plans.md §10. Rather than 96 bespoke sprite
 * sheets (8 enemies x 4 weapons x 3 tiers), a kill combines a generic death with
 * the killing weapon's effect preset scaled by overkill tier — the approach §10
 * recommends for the tech demo.
 */
export type BurstPattern = 'up' | 'horizontal' | 'radial';

export interface DeathPreset {
  /** Vertical shards, horizontal shredding, or an omnidirectional blast. */
  pattern: BurstPattern;
  burstScale: number;
  ringCount: number;
  ringRadiusMeters: number;
  ringColor: number;
  /** Multiplied into the corpse sprite's colour. */
  corpseTint: number;
  /** Vertical squash of the corpse sprite. */
  corpseFlatten: number;
  extraDecals: number;
  emberCount: number;
  shake: number;
}

export interface DeathEffectSink {
  ring(centre: THREE.Vector3, maxRadiusMeters: number, color: number, expansionSeconds: number): void;
  shake(intensity: number): void;
}

const BASE: Record<string, DeathPreset> = {
  // Fast vertical gold shard burst, corpse left brighter.
  trumpet: {
    pattern: 'up',
    burstScale: 1,
    ringCount: 0,
    ringRadiusMeters: 1.2,
    ringColor: 0xffd700,
    corpseTint: 0xfff0c8,
    corpseFlatten: 1,
    extraDecals: 0,
    emberCount: 0,
    shake: 0,
  },
  // Radial blast outward, corpse squashed by the pressure.
  tuba: {
    pattern: 'radial',
    burstScale: 1.4,
    ringCount: 1,
    ringRadiusMeters: 2.2,
    ringColor: 0xffc040,
    corpseTint: 0xd8b070,
    corpseFlatten: 0.55,
    extraDecals: 1,
    emberCount: 0,
    shake: 0.04,
  },
  // Rapid horizontal shredding, corpse torn and red-tinted.
  saxophone: {
    pattern: 'horizontal',
    burstScale: 1.2,
    ringCount: 0,
    ringRadiusMeters: 1.4,
    ringColor: 0xffb060,
    corpseTint: 0xff9060,
    corpseFlatten: 0.9,
    extraDecals: 0,
    emberCount: 0,
    shake: 0,
  },
  // Three ring bursts, charred remains, lingering embers.
  electric_guitar: {
    pattern: 'radial',
    burstScale: 1.3,
    ringCount: 3,
    ringRadiusMeters: 1.8,
    ringColor: 0xc060ff,
    corpseTint: 0x808080,
    corpseFlatten: 0.8,
    extraDecals: 1,
    emberCount: 14,
    shake: 0.05,
  },
};

/** Anything not listed — enemy attacks, future weapons — dies plainly. */
const FALLBACK: DeathPreset = {
  pattern: 'radial',
  burstScale: 1,
  ringCount: 0,
  ringRadiusMeters: 1.2,
  ringColor: 0xffd700,
  corpseTint: 0xffffff,
  corpseFlatten: 1,
  extraDecals: 0,
  emberCount: 0,
  shake: 0,
};

export function deathPreset(weaponId: string, tier: OverkillTier): DeathPreset {
  const base = BASE[weaponId] ?? FALLBACK;
  if (tier === 0) return { ...base };

  // Heavier overkill means more of everything, never less.
  const heavy = tier === 2;
  return {
    ...base,
    burstScale: base.burstScale * (heavy ? 2.4 : 1.6),
    ringCount: Math.max(base.ringCount, heavy ? 2 : 1),
    ringRadiusMeters: base.ringRadiusMeters * (heavy ? 1.9 : 1.4),
    extraDecals: base.extraDecals + (heavy ? 3 : 1),
    emberCount: Math.round(base.emberCount * (heavy ? 2.2 : 1.6)),
    shake: base.shake + (heavy ? 0.1 : 0.03),
  };
}

import * as THREE from 'three';

/**
 * Expanding shockwaves. Three things in plans.md are the same entity at
 * different settings: the tuba's soundwave (§6.2), each of the guitar's three
 * sequenced blasts (§6.4), and the rings thrown off by a kill (§10).
 *
 * Damage is applied as the front passes an enemy, once each, so an enemy caught
 * near the centre is hit early — which is what produces the tuba's falloff.
 */
export type DamageAtDistance = (distanceMeters: number) => number;

export interface BlastSpec {
  centre: THREE.Vector3;
  maxRadiusMeters: number;
  expansionSeconds: number;
  color: number;
  startRadiusMeters?: number;
  /** Omit for a visual-only ring, e.g. a death effect. */
  damageAt?: DamageAtDistance;
  /** Flat on the floor (a wave rolling outward) or facing the camera (a burst). */
  orientation?: 'horizontal' | 'billboard';
  /** Which weapon owns the blast, so kills can pick the right death preset. */
  weaponId?: string;
}

export type SphereDamage = (
  centre: THREE.Vector3,
  radiusMeters: number,
  damageAt: DamageAtDistance,
  alreadyHit: Set<string>,
  weaponId: string,
) => void;

interface Blast {
  centre: THREE.Vector3;
  startRadius: number;
  maxRadius: number;
  expansionSeconds: number;
  age: number;
  damageAt: DamageAtDistance | null;
  orientation: 'horizontal' | 'billboard';
  alreadyHit: Set<string>;
  weaponId: string;
  mesh: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
}

export class BlastSystem {
  readonly group = new THREE.Group();

  private readonly live: Blast[] = [];
  private readonly idle: Blast[] = [];

  constructor(private readonly damageSphere: SphereDamage) {}

  get activeCount(): number {
    return this.live.length;
  }

  spawn(spec: BlastSpec): void {
    const blast = this.claim();

    blast.centre.copy(spec.centre);
    blast.startRadius = spec.startRadiusMeters ?? 0.2;
    blast.maxRadius = spec.maxRadiusMeters;
    blast.expansionSeconds = spec.expansionSeconds;
    blast.age = 0;
    blast.damageAt = spec.damageAt ?? null;
    blast.orientation = spec.orientation ?? 'billboard';
    blast.weaponId = spec.weaponId ?? '';
    blast.alreadyHit.clear();

    blast.mesh.material.color.setHex(spec.color);
    blast.mesh.material.opacity = 1;
    blast.mesh.position.copy(spec.centre);
    blast.mesh.scale.setScalar(blast.startRadius);
    blast.mesh.visible = true;

    this.live.push(blast);
  }

  update(dt: number, cameraQuaternion: THREE.Quaternion): void {
    for (let i = this.live.length - 1; i >= 0; i -= 1) {
      const blast = this.live[i]!;
      blast.age += dt;

      const progress = Math.min(1, blast.age / blast.expansionSeconds);
      const radius = blast.startRadius + (blast.maxRadius - blast.startRadius) * progress;

      if (blast.damageAt) {
        this.damageSphere(blast.centre, radius, blast.damageAt, blast.alreadyHit, blast.weaponId);
      }

      blast.mesh.scale.setScalar(radius);
      blast.mesh.material.opacity = 1 - progress;

      if (blast.orientation === 'billboard') {
        blast.mesh.quaternion.copy(cameraQuaternion);
      } else {
        blast.mesh.rotation.set(-Math.PI / 2, 0, 0);
      }

      if (progress >= 1) this.retire(i);
    }
  }

  private claim(): Blast {
    const pooled = this.idle.pop();
    if (pooled) return pooled;

    // Unit ring, scaled to the current radius each frame.
    const mesh = new THREE.Mesh(
      new THREE.RingGeometry(0.82, 1, 48),
      new THREE.MeshBasicMaterial({
        transparent: true,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    this.group.add(mesh);

    return {
      centre: new THREE.Vector3(),
      startRadius: 0.2,
      maxRadius: 1,
      expansionSeconds: 0.3,
      age: 0,
      damageAt: null,
      orientation: 'billboard',
      alreadyHit: new Set<string>(),
      weaponId: '',
      mesh,
    };
  }

  private retire(index: number): void {
    const blast = this.live[index]!;
    blast.mesh.visible = false;
    this.live.splice(index, 1);
    this.idle.push(blast);
  }
}

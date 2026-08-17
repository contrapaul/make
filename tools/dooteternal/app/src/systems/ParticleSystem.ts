import * as THREE from 'three';
import { PARTICLES } from '../data/constants';
import { goldParticleTexture } from '../core/PlaceholderAssets';

/**
 * Pooled gold hit particles (plans.md §9). Active particles are packed at the
 * front of the pool and the instance count is trimmed to match, so nothing is
 * allocated per shot and no dead particle costs anything to draw.
 *
 * Additive blending means fading a particle out is just decaying its colour
 * toward black — no per-instance alpha needed.
 */
export class ParticleSystem {
  readonly mesh: THREE.InstancedMesh;

  private readonly position: THREE.Vector3[] = [];
  private readonly velocity: THREE.Vector3[] = [];
  private readonly age: Float32Array;
  private readonly lifetime: Float32Array;
  private readonly size: Float32Array;
  private readonly tint: THREE.Color[] = [];

  private active = 0;

  private readonly matrix = new THREE.Matrix4();
  private readonly scratchColor = new THREE.Color();
  private readonly scratchScale = new THREE.Vector3();

  constructor() {
    const max = PARTICLES.maxActive;

    this.mesh = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({
        map: goldParticleTexture(),
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
      }),
      max,
    );
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;

    this.age = new Float32Array(max);
    this.lifetime = new Float32Array(max);
    this.size = new Float32Array(max);

    for (let i = 0; i < max; i += 1) {
      this.position.push(new THREE.Vector3());
      this.velocity.push(new THREE.Vector3());
      this.tint.push(new THREE.Color());
    }
  }

  get activeCount(): number {
    return this.active;
  }

  /**
   * Erupts particles from an impact point, biased along `outward` — the surface
   * normal of the thing that was hit. A zero `outward` spits omnidirectionally.
   *
   * `spread` is how much random direction is mixed in: low values make a tight
   * jet (vertical shards, horizontal shredding), high values a loose puff.
   */
  burst(origin: THREE.Vector3, outward: THREE.Vector3, count: number, spread = 0.65): void {
    for (let i = 0; i < count; i += 1) {
      if (this.active >= PARTICLES.maxActive) return;

      const index = this.active;
      this.active += 1;

      this.position[index]!.copy(origin);

      const speed = randomBetween(PARTICLES.speedMeters);
      this.velocity[index]!
        .set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5)
        .normalize()
        .multiplyScalar(spread)
        .add(outward)
        .normalize()
        .multiplyScalar(speed);

      this.age[index] = 0;
      this.lifetime[index] = randomBetween(PARTICLES.lifetimeSeconds);
      this.size[index] = randomBetween(PARTICLES.sizeMeters);
      this.tint[index]!.setHex(Math.random() < 0.6 ? PARTICLES.colorPrimary : PARTICLES.colorSecondary);
    }
  }

  /** Billboards every live particle at the camera and retires the expired ones. */
  update(dt: number, cameraQuaternion: THREE.Quaternion): void {
    const drag = Math.max(0, 1 - PARTICLES.dragPerSecond * dt);

    for (let index = 0; index < this.active; index += 1) {
      this.age[index]! += dt;

      if (this.age[index]! >= this.lifetime[index]!) {
        this.swapRemove(index);
        index -= 1;
        continue;
      }

      const velocity = this.velocity[index]!;
      velocity.multiplyScalar(drag);
      velocity.y -= PARTICLES.gravityMeters * dt;
      this.position[index]!.addScaledVector(velocity, dt);
    }

    for (let index = 0; index < this.active; index += 1) {
      const remaining = 1 - this.age[index]! / this.lifetime[index]!;
      const scale = this.size[index]! * (0.4 + 0.6 * remaining);

      this.scratchScale.setScalar(scale);
      this.matrix.compose(this.position[index]!, cameraQuaternion, this.scratchScale);
      this.mesh.setMatrixAt(index, this.matrix);

      this.scratchColor.copy(this.tint[index]!).multiplyScalar(remaining);
      this.mesh.setColorAt(index, this.scratchColor);
    }

    this.mesh.count = this.active;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  private swapRemove(index: number): void {
    const last = this.active - 1;

    if (index !== last) {
      this.position[index]!.copy(this.position[last]!);
      this.velocity[index]!.copy(this.velocity[last]!);
      this.tint[index]!.copy(this.tint[last]!);
      this.age[index] = this.age[last]!;
      this.lifetime[index] = this.lifetime[last]!;
      this.size[index] = this.size[last]!;
    }

    this.active = last;
  }
}

function randomBetween(range: number[]): number {
  const min = range[0]!;
  const max = range[1]!;
  return min + Math.random() * (max - min);
}

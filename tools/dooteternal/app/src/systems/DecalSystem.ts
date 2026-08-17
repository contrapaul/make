import * as THREE from 'three';
import { DECALS } from '../data/constants';
import { splatTexture } from '../core/PlaceholderAssets';

/**
 * Gold "blood" projected onto nearby surfaces (plans.md §9). Rays are cast
 * outward from the impact point; the nearest surface within 3 m gets the splat.
 *
 * Decals are a fixed pool of quads, reused oldest-first once the cap is hit, so
 * a long firefight can't grow the scene without bound.
 */
const RAY_DIRECTIONS = 6;

export class DecalSystem {
  readonly group = new THREE.Group();

  private readonly pool: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>[] = [];
  private readonly textures: THREE.CanvasTexture[] = [];
  private readonly raycaster = new THREE.Raycaster();
  private nextSlot = 0;
  private used = 0;

  constructor(private readonly surfaces: THREE.Object3D) {
    this.raycaster.far = DECALS.maxDistanceMeters;

    for (let i = 0; i < DECALS.textureCount; i += 1) {
      this.textures.push(splatTexture());
    }
  }

  get count(): number {
    return this.used;
  }

  /** Splatters up to `attempts` decals around an impact point. */
  splatter(origin: THREE.Vector3, attempts: number): void {
    for (let i = 0; i < attempts; i += 1) {
      const hit = this.nearestSurface(origin);
      if (hit) this.place(hit.point, hit.normal);
    }
  }

  private nearestSurface(origin: THREE.Vector3): { point: THREE.Vector3; normal: THREE.Vector3 } | null {
    let nearest: THREE.Intersection | null = null;

    for (let i = 0; i < RAY_DIRECTIONS; i += 1) {
      // Random directions, biased downward so floors catch their share.
      const direction = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.75, Math.random() - 0.5).normalize();

      this.raycaster.set(origin, direction);
      const hit = this.raycaster.intersectObject(this.surfaces, true)[0];
      if (hit && (!nearest || hit.distance < nearest.distance)) nearest = hit;
    }

    if (!nearest?.face) return null;

    // Instanced walls carry translation only, but floor and ceiling are rotated,
    // so face normals need the object's normal matrix to reach world space.
    const normal = nearest.face.normal
      .clone()
      .applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(nearest.object.matrixWorld))
      .normalize();

    return { point: nearest.point, normal };
  }

  private place(point: THREE.Vector3, normal: THREE.Vector3): void {
    const decal = this.claim();
    const scale = DECALS.minScaleMeters + Math.random() * (DECALS.maxScaleMeters - DECALS.minScaleMeters);

    decal.material.map = this.textures[Math.floor(Math.random() * this.textures.length)]!;
    decal.material.opacity = DECALS.minOpacity + Math.random() * (DECALS.maxOpacity - DECALS.minOpacity);
    decal.material.needsUpdate = true;

    decal.position.copy(point).addScaledVector(normal, DECALS.offsetFromSurfaceMeters);
    decal.lookAt(decal.position.clone().add(normal));
    decal.rotateZ(Math.random() * Math.PI * 2);
    decal.scale.setScalar(scale);
    decal.visible = true;
  }

  private claim(): THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> {
    if (this.pool.length < DECALS.maxPerLevel) {
      const decal = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false }),
      );
      this.pool.push(decal);
      this.group.add(decal);
      this.used = this.pool.length;
      return decal;
    }

    // Pool is full: overwrite the oldest.
    const decal = this.pool[this.nextSlot]!;
    this.nextSlot = (this.nextSlot + 1) % DECALS.maxPerLevel;
    return decal;
  }
}
